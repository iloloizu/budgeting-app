import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  parseCSVRow,
  filterByMonth,
  categorizeTransaction,
  learnCategoryRule,
  type CSVRow,
  type ParsedTransaction,
} from '@/lib/csv-import'

// Ensure we're not using Edge runtime (Prisma doesn't work with Edge)
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    // Ensure prisma is initialized
    if (!prisma || !('categorizationRule' in prisma)) {
      console.error('Prisma client is undefined or not properly initialized')
      console.error('Prisma object:', prisma)
      return NextResponse.json(
        { error: 'Database connection error', message: 'Prisma client not initialized' },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const userId = formData.get('userId') as string
    const targetYear = parseInt(formData.get('targetYear') as string)
    const targetMonth = parseInt(formData.get('targetMonth') as string)
    const transactionsJson = formData.get('transactions') as string // Pre-processed transactions with user edits

    if (!file && !transactionsJson) {
      return NextResponse.json(
        { error: 'File or transactions data is required' },
        { status: 400 }
      )
    }

    if (!userId || !targetYear || !targetMonth) {
      return NextResponse.json(
        { error: 'userId, targetYear, and targetMonth are required' },
        { status: 400 }
      )
    }

    // Verify user exists before proceeding
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      })

      if (!user) {
        console.error(`User not found: ${userId}`)
        // List available users for debugging
        const allUsers = await prisma.user.findMany({
          select: { id: true, name: true, email: true },
          take: 10,
        })
        console.error('Available users:', allUsers)
        
        return NextResponse.json(
          { 
            error: 'User not found', 
            message: `User with ID "${userId}" does not exist in the database. Please ensure you're logged in with a valid user account.`,
            availableUsers: allUsers.map(u => ({ id: u.id, name: u.name, email: u.email }))
          },
          { status: 404 }
        )
      }
    } catch (userCheckError: any) {
      console.error('Error checking user:', userCheckError)
      return NextResponse.json(
        { 
          error: 'Database error', 
          message: `Failed to verify user: ${userCheckError.message || 'Unknown error'}` 
        },
        { status: 500 }
      )
    }

    let parsedTransactions: ParsedTransaction[] = []

    if (transactionsJson) {
      // Use pre-processed transactions (from preview with user edits)
      const parsed = JSON.parse(transactionsJson)
      // Convert date strings back to Date objects
      parsedTransactions = parsed.map((t: any) => ({
        ...t,
        date: new Date(t.date),
      }))
    } else if (file) {
      // Parse CSV file
      const text = await file.text()
      const lines = text.split('\n').filter((line) => line.trim())
      if (lines.length < 2) {
        return NextResponse.json(
          { error: 'CSV file must have at least a header and one data row' },
          { status: 400 }
        )
      }

      // Parse header
      const header = parseCSVLine(lines[0]).map((h) => h.trim())
      const headerMap: Record<string, number> = {}
      header.forEach((h, i) => {
        headerMap[h] = i
      })

      // Parse rows
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = parseCSVLine(lines[i])
          const row: CSVRow = { Date: '', Amount: '' }
          header.forEach((h, idx) => {
            row[h] = values[idx]?.trim() || ''
          })

          const parsed = parseCSVRow(row, userId)
          if (parsed) {
            parsedTransactions.push(parsed)
          }
        } catch (rowError) {
          console.error(`Error parsing row ${i + 1}:`, rowError)
        }
      }
    }

    // Filter by month
    const filteredTransactions = filterByMonth(
      parsedTransactions,
      targetYear,
      targetMonth
    )

    // Check for duplicates and categorize
    const toImport: Array<{
      parsed: ParsedTransaction
      categoryId?: string
      incomeSourceId?: string
      isDuplicate: boolean
      ruleUsed?: string
    }> = []

    const duplicates: ParsedTransaction[] = []

    for (const parsed of filteredTransactions) {
      // Check if duplicate (only if fingerprint exists)
      if (parsed.fingerprint) {
        try {
          // Use findMany with limit as workaround for compound unique constraint
          const existing = await prisma.transaction.findMany({
            where: {
              userId,
              fingerprint: parsed.fingerprint,
            } as any,
            take: 1,
          })

          if (existing.length > 0) {
            duplicates.push(parsed)
            continue
          }
        } catch (error: any) {
          // If unique constraint doesn't exist yet, just continue
          if (error.code !== 'P2001') {
            console.error('Error checking duplicate:', error)
          }
        }
      }

      // Categorize - ensure prisma is passed correctly
      if (!prisma || !('categorizationRule' in prisma)) {
        console.error('Prisma client issue before categorization:', {
          prismaExists: !!prisma,
          hasCategorizationRule: prisma ? 'categorizationRule' in prisma : false,
        })
        throw new Error('Prisma client is not properly initialized for categorization')
      }
      const categorization = await categorizeTransaction(parsed, userId, prisma)

      toImport.push({
        parsed,
        categoryId: categorization.categoryId,
        incomeSourceId: categorization.incomeSourceId,
        isDuplicate: false,
        ruleUsed: categorization.ruleUsed,
      })
    }

    // If this is the final import (not preview), insert transactions
    const isImport = formData.get('action') === 'import'
    let importedCount = 0

    if (isImport) {
      for (const item of toImport) {
        try {
          // Only include fingerprint if it exists
          const transactionData: any = {
            userId,
            date: item.parsed.date,
            description: item.parsed.description,
            amount: item.parsed.amount,
            type: item.parsed.type,
            incomeSourceId: item.incomeSourceId || null,
            expenseCategoryId: item.categoryId || null,
            accountName: item.parsed.accountName || null,
            accountNumber: item.parsed.accountNumber || null,
            institutionName: item.parsed.institutionName || null,
            merchantName: item.parsed.merchantName || null,
          }

          // Only add fingerprint if it exists (for deduplication)
          if (item.parsed.fingerprint) {
            transactionData.fingerprint = item.parsed.fingerprint
          }

          await prisma.transaction.create({
            data: transactionData,
          })
          importedCount++

          // Learn from the categorization
          if (item.parsed.merchantName) {
            await learnCategoryRule(
              userId,
              item.parsed.merchantName,
              prisma,
              item.categoryId,
              item.incomeSourceId
            )
          }
        } catch (error: any) {
          // Skip if duplicate (race condition or unique constraint violation)
          if (error.code === 'P2002' || error.code === 'P2001') {
            // Duplicate, skip
            continue
          }
          console.error('Error importing transaction:', error)
          // Continue with next transaction
        }
      }
    }

    const response: any = {
      success: true,
      preview: {
        totalRows: filteredTransactions.length,
        toImport: toImport.length,
        duplicateCount: duplicates.length,
        transactions: toImport.map((item) => ({
          date: item.parsed.date.toISOString(),
          amount: item.parsed.amount,
          type: item.parsed.type,
          description: item.parsed.description,
          merchantName: item.parsed.merchantName,
          categoryId: item.categoryId,
          incomeSourceId: item.incomeSourceId,
          fingerprint: item.parsed.fingerprint,
          ruleUsed: item.ruleUsed,
          isDuplicate: item.isDuplicate,
        })),
        duplicates: duplicates.map((d) => ({
          date: d.date.toISOString(),
          amount: d.amount,
          description: d.description,
          merchantName: d.merchantName,
        })),
      },
    }

    if (isImport) {
      response.imported = importedCount
      response.skipped = duplicates.length
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Error importing CSV:', error)
    return NextResponse.json(
      {
        error: 'Failed to import CSV',
        message: error.message || 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        details: error.toString(),
      },
      { status: 500 }
    )
  }
}

// Helper to parse CSV line (handles quoted values)
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"'
        i++ // Skip next quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

