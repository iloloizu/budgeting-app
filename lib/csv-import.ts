import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'

export interface CSVRow {
  Date: string
  'Original Date'?: string
  Amount: string
  Name?: string
  Description?: string
  Category?: string
  'Account Name'?: string
  'Account Number'?: string
  'Institution Name'?: string
  [key: string]: string | undefined
}

export interface ParsedTransaction {
  date: Date
  amount: number
  type: 'income' | 'expense'
  description: string
  merchantName?: string
  csvCategory?: string
  accountName?: string
  accountNumber?: string
  institutionName?: string
  fingerprint: string
}

export function normalizeMerchant(merchant: string | undefined): string {
  if (!merchant) return ''
  return merchant.toUpperCase().trim().replace(/\s+/g, ' ')
}

export function generateFingerprint(
  userId: string,
  date: Date,
  amount: number,
  merchant: string,
  accountNumber?: string
): string {
  const normalizedMerchant = normalizeMerchant(merchant)
  const dateStr = date.toISOString().split('T')[0]
  const amountStr = Math.abs(amount).toFixed(2)
  const accountStr = accountNumber || ''
  
  const data = `${userId}|${dateStr}|${amountStr}|${normalizedMerchant}|${accountStr}`
  return crypto.createHash('sha256').update(data).digest('hex')
}

export function parseCSVRow(row: CSVRow, userId: string): ParsedTransaction | null {
  try {
    // Parse date
    const dateStr = row['Original Date'] || row.Date
    if (!dateStr) return null
    
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return null

    // Parse amount
    const amountStr = row.Amount?.trim() || '0'
    const amount = parseFloat(amountStr)
    if (isNaN(amount)) return null

    // Determine type: negative amounts are income, positive are expenses
    const type: 'income' | 'expense' = amount < 0 ? 'income' : 'expense'
    const absoluteAmount = Math.abs(amount)

    // Get description
    const merchantName = row.Name || row.Description || ''
    const description = row.Description || row.Name || ''

    // Generate fingerprint
    const fingerprint = generateFingerprint(
      userId,
      date,
      absoluteAmount,
      merchantName,
      row['Account Number']
    )

    return {
      date,
      amount: absoluteAmount,
      type,
      description: description || merchantName,
      merchantName,
      csvCategory: row.Category,
      accountName: row['Account Name'],
      accountNumber: row['Account Number'],
      institutionName: row['Institution Name'],
      fingerprint,
    }
  } catch (error) {
    console.error('Error parsing CSV row:', error)
    return null
  }
}

export async function categorizeTransaction(
  parsed: ParsedTransaction,
  userId: string,
  prisma: PrismaClient
): Promise<{ categoryId?: string; incomeSourceId?: string; ruleUsed?: string }> {
  if (!prisma) {
    throw new Error('Prisma client is required for categorization')
  }
  
  const normalizedMerchant = normalizeMerchant(parsed.merchantName)

  // 1. Check learned rules (exact match first, then contains)
  const rules = await prisma.categorizationRule.findMany({
    where: {
      userId,
      appliesTo: { in: [parsed.type, 'both'] },
    },
    orderBy: [
      { matchType: 'desc' }, // exact first
    ],
  })

  for (const rule of rules) {
    const matches =
      rule.matchType === 'exact'
        ? normalizedMerchant === normalizeMerchant(rule.pattern)
        : normalizedMerchant.includes(normalizeMerchant(rule.pattern))

    if (matches) {
      if (parsed.type === 'expense' && rule.categoryId) {
        return { categoryId: rule.categoryId, ruleUsed: rule.pattern }
      } else if (parsed.type === 'income' && rule.incomeSourceId) {
        return { incomeSourceId: rule.incomeSourceId, ruleUsed: rule.pattern }
      }
    }
  }

  // 2. Try CSV category column
  if (parsed.csvCategory && parsed.type === 'expense') {
    // Try to find existing category by name (case-insensitive for SQLite)
    // SQLite doesn't support mode: 'insensitive', so we fetch all and filter
    const allCategories = await prisma.expenseCategory.findMany({
      where: { userId },
    })
    
    let category = allCategories.find(
      (cat) => cat.name.toLowerCase() === parsed.csvCategory!.toLowerCase()
    )

    // If not found, create it
    if (!category) {
      const isFixed = /rent|insurance|loan|mortgage|subscription/i.test(parsed.csvCategory)
      category = await prisma.expenseCategory.create({
        data: {
          userId,
          name: parsed.csvCategory,
          type: isFixed ? 'fixed' : 'variable',
        },
      })
    }

    return { categoryId: category.id }
  }

  // 3. Fallback: Uncategorized
  if (parsed.type === 'expense') {
    let uncategorized = await prisma.expenseCategory.findFirst({
      where: {
        userId,
        name: 'Uncategorized',
      },
    })

    if (!uncategorized) {
      uncategorized = await prisma.expenseCategory.create({
        data: {
          userId,
          name: 'Uncategorized',
          type: 'variable',
        },
      })
    }

    return { categoryId: uncategorized.id }
  }

  return {}
}

export async function learnCategoryRule(
  userId: string,
  merchantName: string,
  prisma: PrismaClient,
  categoryId?: string,
  incomeSourceId?: string
): Promise<void> {
  const normalizedMerchant = normalizeMerchant(merchantName)
  if (!normalizedMerchant) return

  const appliesTo = categoryId ? 'expense' : incomeSourceId ? 'income' : 'both'

  // Check if rule already exists
  const existing = await prisma.categorizationRule.findFirst({
    where: {
      userId,
      pattern: normalizedMerchant,
      matchType: 'contains',
    },
  })

  if (existing) {
    // Update existing rule
    await prisma.categorizationRule.update({
      where: { id: existing.id },
      data: {
        categoryId: categoryId || existing.categoryId,
        incomeSourceId: incomeSourceId || existing.incomeSourceId,
        appliesTo,
      },
    })
  } else {
    // Create new rule
    await prisma.categorizationRule.create({
      data: {
        userId,
        pattern: normalizedMerchant,
        matchType: 'contains',
        categoryId,
        incomeSourceId,
        appliesTo,
      },
    })
  }
}

export function filterByMonth(
  transactions: ParsedTransaction[],
  year: number,
  month: number
): ParsedTransaction[] {
  return transactions.filter((t) => {
    const tYear = t.date.getFullYear()
    const tMonth = t.date.getMonth() + 1
    return tYear === year && tMonth === month
  })
}

