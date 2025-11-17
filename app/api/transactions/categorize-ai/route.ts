import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { suggestCategory } from '@/lib/ai-categorization'
import { suggestCategoryOpenAI } from '@/lib/openai-categorization'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, transactionIds, provider = 'claude' } = body

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

    if (provider === 'claude' && !process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Claude AI categorization is not available. ANTHROPIC_API_KEY is not set.' },
        { status: 503 }
      )
    }

    if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI categorization is not available. OPENAI_API_KEY is not set.' },
        { status: 503 }
      )
    }

    // Fetch ALL expense transactions with the given IDs first, including category info
    const allTransactions = await prisma.transaction.findMany({
      where: {
        id: { in: transactionIds },
        userId,
        type: 'expense',
      },
      select: {
        id: true,
        merchantName: true,
        description: true,
        amount: true,
        expenseCategoryId: true,
        expenseCategory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Filter to ONLY uncategorized expense transactions
    // A transaction is uncategorized if:
    // - expenseCategoryId is null/undefined, OR
    // - expenseCategory name is "Uncategorized" or "N/A"
    const transactions = allTransactions.filter((t) => {
      const hasNoCategory = !t.expenseCategoryId
      const isUncategorizedCategory = t.expenseCategory && 
        (t.expenseCategory.name === 'Uncategorized' || t.expenseCategory.name === 'N/A')
      return hasNoCategory || isUncategorizedCategory
    })

    if (transactions.length === 0) {
      console.log(`[AI Categorize] No uncategorized transactions found. Total fetched: ${allTransactions.length}, Transaction IDs sent: ${transactionIds.length}`)
      if (allTransactions.length > 0) {
        console.log(`[AI Categorize] Sample transaction categories:`, allTransactions.slice(0, 3).map(t => ({
          id: t.id,
          merchant: t.merchantName,
          categoryId: t.expenseCategoryId,
          categoryName: t.expenseCategory?.name
        })))
      }
      return NextResponse.json({
        success: true,
        categorized: 0,
        message: `No uncategorized expense transactions found. Received ${transactionIds.length} transaction IDs, fetched ${allTransactions.length} transactions from database.`,
      })
    }

    console.log(`[AI Categorize] Found ${transactions.length} uncategorized transactions out of ${allTransactions.length} total`)

    // Get all expense categories for the user (fetch once, use throughout)
    const expenseCategories = await prisma.expenseCategory.findMany({
      where: { userId },
      select: { id: true, name: true, colorHex: true },
    })

    // Pre-compute used colors once
    const usedColors = expenseCategories
      .map((c) => c.colorHex)
      .filter((c): c is string => c !== null && c !== undefined)
    
    const { getNextAvailableColor } = await import('@/constants/colors')

    let categorizedCount = 0
    const errors: string[] = []

    // Get category names for AI suggestions
    const categoryNames = expenseCategories.map((cat) => cat.name)

    // Get "Uncategorized" category IDs to exclude from results
    const uncategorizedCategoryIds = new Set(
      expenseCategories
        .filter(cat => cat.name === 'Uncategorized' || cat.name === 'N/A')
        .map(cat => cat.id)
    )

    // Process each transaction
    for (const transaction of transactions) {
      try {
        // Double-check this transaction is actually uncategorized
        // ONLY process transactions that are "Uncategorized" or have null categoryId
        const isUncategorized = !transaction.expenseCategoryId || 
                                !transaction.expenseCategory || 
                                transaction.expenseCategory.name === 'Uncategorized' || 
                                transaction.expenseCategory.name === 'N/A' ||
                                uncategorizedCategoryIds.has(transaction.expenseCategoryId)
        
        if (!isUncategorized) {
          console.log(`[AI Categorize] Skipping transaction ${transaction.id} - already categorized as "${transaction.expenseCategory?.name}" (not "Uncategorized")`)
          continue
        }

        const merchantName = transaction.merchantName || ''
        const description = transaction.description || ''

        if (!merchantName && !description) {
          console.log(`[AI Categorize] Skipping transaction ${transaction.id} - no merchant name or description`)
          continue
        }

        // Use the appropriate AI categorization function based on provider
        const suggestion = provider === 'openai'
          ? await suggestCategoryOpenAI(
              merchantName,
              description,
              transaction.amount,
              categoryNames
            )
          : await suggestCategory(
              merchantName,
              description,
              transaction.amount,
              categoryNames
            )

        if (suggestion && suggestion.categoryName) {
          // NEVER assign to "Uncategorized" or "N/A" - skip if AI suggests these
          const suggestedName = suggestion.categoryName.trim()
          if (suggestedName.toLowerCase() === 'uncategorized' || 
              suggestedName.toLowerCase() === 'n/a' ||
              suggestedName.toLowerCase() === 'uncategorised') {
            console.log(`[AI Categorize] Skipping transaction ${transaction.id} - AI suggested "${suggestedName}" (not allowed)`)
            continue
          }

          // Find or create the category
          let category = expenseCategories.find(
            (cat) => cat.name.toLowerCase() === suggestion.categoryName.toLowerCase()
          )

          if (!category) {
            // Create the category
            const isFixed = /rent|insurance|loan|mortgage|subscription/i.test(suggestion.categoryName)
            
            // Use pre-computed used colors
            const nextColor = getNextAvailableColor(usedColors)

            category = await prisma.expenseCategory.create({
              data: {
                userId,
                name: suggestion.categoryName,
                type: isFixed ? 'fixed' : 'variable',
                colorHex: nextColor,
              },
              select: { id: true, name: true, colorHex: true },
            })

            // Add to local array for future lookups and update used colors
            expenseCategories.push(category)
            usedColors.push(nextColor)
            categoryNames.push(category.name)
          }

          // NEVER assign to "Uncategorized" category - final safety check
          if (uncategorizedCategoryIds.has(category.id) || 
              category.name === 'Uncategorized' || 
              category.name === 'N/A') {
            console.log(`[AI Categorize] Skipping transaction ${transaction.id} - category "${category.name}" is "Uncategorized" (not allowed)`)
            continue
          }

          // Update the transaction
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: {
              expenseCategoryId: category.id,
            },
          })
          categorizedCount++
          console.log(`[AI Categorize] Categorized transaction ${transaction.id} (${merchantName}) as "${category.name}"`)
        } else {
          console.log(`[AI Categorize] No suggestion for transaction ${transaction.id} (${merchantName})`)
        }
      } catch (error: any) {
        errors.push(`Transaction ${transaction.id}: ${error.message}`)
        console.error(`Error categorizing transaction ${transaction.id}:`, error)
      }
    }

    const message = categorizedCount === 0 
      ? `No transactions could be categorized. Processed ${transactions.length} uncategorized transaction(s). Make sure AI is properly configured and transactions have merchant names or descriptions.`
      : undefined

    console.log(`[AI Categorize] Complete: ${categorizedCount} categorized out of ${transactions.length} uncategorized transactions`)

    return NextResponse.json({
      success: true,
      categorized: categorizedCount,
      total: transactions.length,
      message,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    console.error('Error in AI categorization:', error)
    return NextResponse.json(
      { error: 'Failed to categorize transactions', message: error.message },
      { status: 500 }
    )
  }
}

