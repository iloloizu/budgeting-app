import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { categorizeTransaction } from '@/lib/csv-import'
import { smartCategorizeTransaction } from '@/lib/smart-categorization'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, transactionIds } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    if (!transactionIds || !Array.isArray(transactionIds)) {
      return NextResponse.json(
        { error: 'transactionIds array is required' },
        { status: 400 }
      )
    }

    // Fetch ALL transactions with the given IDs first, including category info
    const allTransactions = await prisma.transaction.findMany({
      where: {
        id: { in: transactionIds },
        userId,
      },
      select: {
        id: true,
        userId: true,
        date: true,
        description: true,
        amount: true,
        type: true,
        merchantName: true,
        csvCategory: true, // Include csvCategory for Robinhood/Investment detection
        expenseCategoryId: true,
        incomeSourceId: true,
        fingerprint: true,
        expenseCategory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Filter to ONLY uncategorized transactions
    // A transaction is uncategorized if:
    // - For expenses: expenseCategoryId is null/undefined, OR expenseCategory name is "Uncategorized" or "N/A"
    // - For income: incomeSourceId is null/undefined
    // Also include transactions that might be Robinhood/Investment that need to be recategorized
    const transactions = allTransactions.filter((t) => {
      if (t.type === 'expense') {
        // Check if this is a Robinhood/Investment transaction that should be recategorized
        const desc = (t.description || '').toLowerCase()
        const merchant = (t.merchantName || '').toLowerCase()
        const csvCat = (t.csvCategory || '').toLowerCase()
        const isRobinhood = desc.includes('robinhood') || merchant.includes('robinhood') || 
                           desc.includes('robin hood') || merchant.includes('robin hood')
        const isInvestment = csvCat === 'investment' || csvCat === 'investing'
        
        // If it's Robinhood/Investment, check if it's already categorized as "Investing"
        if (isRobinhood || isInvestment) {
          const currentCategoryName = t.expenseCategory?.name?.toLowerCase() || ''
          // If not already "Investing", include it for recategorization
          if (currentCategoryName !== 'investing') {
            return true
          }
          // Already categorized as "Investing", skip it
          return false
        }
        
        // Expense is uncategorized if:
        // 1. No category ID assigned, OR
        // 2. Category exists but is named "Uncategorized" or "N/A"
        const hasNoCategory = !t.expenseCategoryId
        const isUncategorizedCategory = t.expenseCategory && 
          (t.expenseCategory.name === 'Uncategorized' || t.expenseCategory.name === 'N/A')
        return hasNoCategory || isUncategorizedCategory
      } else if (t.type === 'income') {
        // Income is uncategorized if no income source ID assigned
        return !t.incomeSourceId
      }
      return false
    })

    if (transactions.length === 0) {
      console.log(`[Smart Categorize] No uncategorized transactions found. Total fetched: ${allTransactions.length}, Transaction IDs sent: ${transactionIds.length}`)
      return NextResponse.json({
        success: true,
        categorized: 0,
        message: `No uncategorized transactions found. Received ${transactionIds.length} transaction IDs, fetched ${allTransactions.length} transactions from database.`,
      })
    }

    console.log(`[Smart Categorize] Found ${transactions.length} uncategorized transactions out of ${allTransactions.length} total`)

    // Get all categories once to check for "Uncategorized" efficiently
    const allCategories = await prisma.expenseCategory.findMany({
      where: { userId },
      select: { id: true, name: true },
    })
    const uncategorizedCategoryIds = new Set(
      allCategories
        .filter(cat => cat.name === 'Uncategorized' || cat.name === 'N/A')
        .map(cat => cat.id)
    )

    let categorizedCount = 0
    const errors: string[] = []
    const updates: Array<{ id: string; expenseCategoryId?: string; incomeSourceId?: string }> = []

    // Process each transaction - these are already filtered to be uncategorized
    for (const transaction of transactions) {
      try {
        // Double-check: Skip if somehow already categorized (shouldn't happen, but safety check)
        if (transaction.type === 'expense') {
          const hasCategory = transaction.expenseCategoryId && 
            transaction.expenseCategory && 
            transaction.expenseCategory.name !== 'Uncategorized' && 
            transaction.expenseCategory.name !== 'N/A'
          if (hasCategory) {
            console.log(`[Smart Categorize] Skipping transaction ${transaction.id} - already categorized as "${transaction.expenseCategory?.name}"`)
            continue
          }
        }
        if (transaction.type === 'income' && transaction.incomeSourceId) {
          console.log(`[Smart Categorize] Skipping transaction ${transaction.id} - already has income source`)
          continue
        }

        // Create a parsed transaction object for categorization
        // Note: We need to provide all required fields for ParsedTransaction type
        // Use merchantName if available, otherwise fall back to description
        const merchantName = transaction.merchantName || transaction.description || ''
        const description = transaction.description || ''
        
        const parsed = {
          date: transaction.date,
          amount: transaction.amount,
          type: transaction.type as 'income' | 'expense',
          description: description,
          merchantName: merchantName,
          csvCategory: transaction.csvCategory || undefined, // Include csvCategory for Robinhood/Investment detection
          fingerprint: '', // Not needed for categorization, but required by type
        }
        
        console.log(`[Smart Categorize] Processing transaction ${transaction.id}: merchantName="${merchantName}", description="${description}", csvCategory="${transaction.csvCategory || 'none'}"`)

        // Step 1: Try existing categorization rules first (from the rules page)
        // This will also check for Robinhood/Investment transactions and categorize them as "Investing"
        let result = await categorizeTransaction(parsed, userId, prisma)

        // Check if a rule matched
        if (result.ruleUsed) {
          // A rule matched! Check if it's assigning to "Uncategorized"
          if (result.categoryId && uncategorizedCategoryIds.has(result.categoryId)) {
            // Rule matched but assigned to "Uncategorized" - treat as no match, try smart algorithm
            console.log(`[Smart Categorize] Rule matched for transaction ${transaction.id} but assigned to "Uncategorized", trying smart algorithm: ${transaction.merchantName || transaction.description}`)
            result = {}
          } else {
            // Rule matched successfully!
            const categoryName = allCategories.find(c => c.id === result.categoryId)?.name || 'unknown'
            console.log(`[Smart Categorize] ✓ Rule matched for transaction ${transaction.id}: "${transaction.merchantName || transaction.description}" -> "${categoryName}" (rule pattern: "${result.ruleUsed}")`)
          }
        }

        // Step 2: If no rule matched (or rule assigned to "Uncategorized"), use smart algorithm
        if (!result.categoryId && !result.incomeSourceId) {
          console.log(`[Smart Categorize] No rule matched for transaction ${transaction.id}, trying smart algorithm: ${transaction.merchantName || transaction.description}`)
          const smartResult = await smartCategorizeTransaction(
            transaction.merchantName || transaction.description || '',
            transaction.description || '',
            transaction.amount,
            transaction.type as 'income' | 'expense',
            userId,
            prisma
          )

          if (smartResult && smartResult.categoryId && !uncategorizedCategoryIds.has(smartResult.categoryId)) {
            const categoryName = allCategories.find(c => c.id === smartResult.categoryId)?.name || 'unknown'
            console.log(`[Smart Categorize] ✓ Smart algorithm matched for transaction ${transaction.id}: "${transaction.merchantName || transaction.description}" -> "${categoryName}"`)
            result = {
              categoryId: smartResult.categoryId,
              incomeSourceId: smartResult.incomeSourceId,
            }
          } else {
            console.log(`[Smart Categorize] ✗ Could not categorize transaction ${transaction.id} with smart algorithm: ${transaction.merchantName || transaction.description}`)
          }
        }

        if (result.categoryId || result.incomeSourceId) {
          // Collect updates to batch process
          updates.push({
            id: transaction.id,
            expenseCategoryId: result.categoryId || undefined,
            incomeSourceId: result.incomeSourceId || undefined,
          })
        } else {
          console.log(`[Smart Categorize] Could not categorize transaction ${transaction.id}: ${transaction.merchantName || transaction.description}`)
        }
      } catch (error: any) {
        errors.push(`Transaction ${transaction.id}: ${error.message}`)
        console.error(`Error categorizing transaction ${transaction.id}:`, error)
      }
    }

    // Batch update all transactions in parallel
    if (updates.length > 0) {
      await Promise.all(
        updates.map((update) =>
          prisma.transaction.update({
            where: { id: update.id },
            data: {
              expenseCategoryId: update.expenseCategoryId,
              incomeSourceId: update.incomeSourceId,
            },
          })
        )
      )
      categorizedCount = updates.length
    }

    return NextResponse.json({
      success: true,
      categorized: categorizedCount,
      total: transactions.length,
      message: categorizedCount === 0 
        ? 'No transactions could be categorized. Make sure you have categorization rules set up.'
        : undefined,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    console.error('Error in smart categorization:', error)
    return NextResponse.json(
      { error: 'Failed to categorize transactions', message: error.message },
      { status: 500 }
    )
  }
}

