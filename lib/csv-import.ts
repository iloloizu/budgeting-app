import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'
import { PASTEL_PALETTE, getNextAvailableColor } from '@/constants/colors'

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

/**
 * Derives a generic, ID-free pattern from a transaction description.
 * Strips out numeric IDs, card numbers, and other volatile identifiers.
 */
export function deriveGenericPatternFromDescription(description: string): string {
  let text = description.toUpperCase().trim()
  
  // Remove long numeric sequences (IDs, card numbers, account numbers, etc.)
  // Match 6+ consecutive digits
  text = text.replace(/\d{6,}/g, ' ')
  
  // Remove common ID patterns
  text = text.replace(/\bWEB\s+ID[:\s]*\d*/gi, ' ')
  text = text.replace(/\bID[:\s]*\d+/gi, ' ')
  text = text.replace(/\bACCOUNT[#:\s]*\d+/gi, ' ')
  text = text.replace(/\bCARD[#:\s]*\d+/gi, ' ')
  text = text.replace(/\bREF[#:\s]*\d+/gi, ' ')
  text = text.replace(/\bCONF[#:\s]*\d+/gi, ' ')
  
  // Remove standalone long numbers (likely IDs)
  text = text.replace(/\b\d{10,}\b/g, ' ')
  
  // Collapse multiple spaces and trim
  text = text.replace(/\s+/g, ' ').trim()
  
  // Extract meaningful words (at least 3 characters)
  const words = text.split(/\s+/).filter(word => word.length >= 3)
  
  // If we have meaningful words, return them joined
  if (words.length > 0) {
    // Return the first significant word or phrase (up to first 3 words)
    return words.slice(0, 3).join(' ')
  }
  
  // If result is too short or empty, return empty string
  return ''
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

  // IMPORTANT: Rules should ONLY apply when the transaction is uncategorized
  // Check if CSV category is provided and is NOT "Uncategorized" or "N/A"
  const csvCategoryLower = parsed.csvCategory?.toLowerCase().trim()
  const isUncategorizedFromCSV = !parsed.csvCategory || 
                                  csvCategoryLower === 'uncategorized' || 
                                  csvCategoryLower === 'n/a' ||
                                  csvCategoryLower === 'uncategorised'

  // 1. If CSV has a valid category (not Uncategorized/N/A), use it directly - skip rules
  if (parsed.csvCategory && parsed.type === 'expense' && !isUncategorizedFromCSV) {
    const allCategories = await prisma.expenseCategory.findMany({
      where: { userId },
      select: { id: true, name: true, colorHex: true },
    })
    
    const categoryNameLower = parsed.csvCategory.toLowerCase()
    let category = allCategories.find(
      (cat) => cat.name.toLowerCase() === categoryNameLower
    )

    // If not found, create it with a color
    if (!category) {
      const isFixed = /rent|insurance|loan|mortgage|subscription/i.test(parsed.csvCategory)
      
      const usedColors = allCategories
        .map((c) => c.colorHex)
        .filter((c): c is string => c !== null && c !== undefined)
      const nextColor = getNextAvailableColor(usedColors)
      
      category = await prisma.expenseCategory.create({
        data: {
          userId,
          name: parsed.csvCategory,
          type: isFixed ? 'fixed' : 'variable',
          colorHex: nextColor,
        },
        select: { id: true, name: true, colorHex: true },
      })
    }

    return { categoryId: category.id }
  }

  // 2. Only check learned rules if transaction is uncategorized (from CSV or no CSV category)
  // Fetch all rules and sort by priority: exact > regex > contains
  const allRules = await prisma.categorizationRule.findMany({
    where: {
      userId,
      appliesTo: { in: [parsed.type, 'both'] },
    },
  })

  // Sort rules by priority: exact first, then regex, then contains
  const rules = allRules.sort((a, b) => {
    const priority: Record<string, number> = { exact: 3, regex: 2, contains: 1 }
    return (priority[b.matchType] || 0) - (priority[a.matchType] || 0)
  })

  // Also check description for matching
  const normalizedDescription = (parsed.description || '').toUpperCase().trim()
  
  console.log(`[Categorize] Checking ${rules.length} rules for transaction: merchant="${normalizedMerchant}", description="${normalizedDescription}", type="${parsed.type}", isUncategorized=${isUncategorizedFromCSV}`)

  // Only apply rules if transaction is uncategorized
  if (isUncategorizedFromCSV) {
    for (const rule of rules) {
    // Skip rules that don't apply to this transaction type
    if (rule.appliesTo !== 'both' && rule.appliesTo !== parsed.type) {
      console.log(`[Categorize] Skipping rule "${rule.pattern}" - appliesTo="${rule.appliesTo}" but transaction type="${parsed.type}"`)
      continue
    }
    
    // For "both" rules, check if they have the appropriate category/source
    if (rule.appliesTo === 'both') {
      if (parsed.type === 'expense' && !rule.categoryId) {
        console.log(`[Categorize] Skipping rule "${rule.pattern}" - expense transaction but no categoryId (appliesTo=both)`)
        continue
      }
      if (parsed.type === 'income' && !rule.incomeSourceId) {
        console.log(`[Categorize] Skipping rule "${rule.pattern}" - income transaction but no incomeSourceId (appliesTo=both)`)
        continue
      }
    } else {
      // For specific type rules, check if they have the required category/source
      if (parsed.type === 'expense' && !rule.categoryId) {
        console.log(`[Categorize] Skipping rule "${rule.pattern}" - expense transaction but no categoryId`)
        continue
      }
      if (parsed.type === 'income' && !rule.incomeSourceId) {
        console.log(`[Categorize] Skipping rule "${rule.pattern}" - income transaction but no incomeSourceId`)
        continue
      }
    }
    
    let matches = false
    
    if (rule.matchType === 'exact') {
      // Exact match: merchant name must exactly match the pattern
      const normalizedPattern = normalizeMerchant(rule.pattern)
      matches = normalizedMerchant === normalizedPattern
      console.log(`[Categorize] Checking exact rule "${rule.pattern}": normalized="${normalizedPattern}" vs "${normalizedMerchant}" = ${matches}`)
    } else if (rule.matchType === 'regex') {
      // Regex match: test against merchant name and description
      try {
        // If pattern already has (?i) flag, don't add 'i' flag again
        let pattern = rule.pattern
        let flags = 'i'
        if (pattern.startsWith('(?i)')) {
          pattern = pattern.substring(4)
          flags = 'i'
        } else if (pattern.startsWith('(?-i)')) {
          pattern = pattern.substring(5)
          flags = ''
        }
        
        const regex = new RegExp(pattern, flags)
        matches = regex.test(normalizedMerchant) || regex.test(normalizedDescription)
        console.log(`[Categorize] Checking regex rule "${rule.pattern}": pattern="${pattern}", flags="${flags}", matches=${matches}`)
        if (matches) {
          console.log(`[Categorize] Regex matched! Testing "${normalizedMerchant}" and "${normalizedDescription}" against pattern "${pattern}"`)
        }
      } catch (error) {
        // Invalid regex pattern, skip this rule
        console.warn(`[Categorize] Invalid regex pattern in rule ${rule.id}: ${rule.pattern}`, error)
        continue
      }
    } else {
      // Contains match (default): check if pattern is contained in merchant name or description
      const normalizedPattern = normalizeMerchant(rule.pattern)
      matches = normalizedMerchant.includes(normalizedPattern) ||
                normalizedDescription.includes(normalizedPattern)
      console.log(`[Categorize] Checking contains rule "${rule.pattern}": normalized="${normalizedPattern}", in merchant=${normalizedMerchant.includes(normalizedPattern)}, in description=${normalizedDescription.includes(normalizedPattern)}`)
    }

    if (matches) {
      console.log(`[Categorize] ✓ Rule matched! Rule ID: ${rule.id}, Pattern: "${rule.pattern}", MatchType: ${rule.matchType}, appliesTo: ${rule.appliesTo}`)
      if (parsed.type === 'expense' && rule.categoryId) {
        console.log(`[Categorize] Returning categoryId: ${rule.categoryId}`)
        return { categoryId: rule.categoryId, ruleUsed: rule.pattern }
      } else if (parsed.type === 'income' && rule.incomeSourceId) {
        console.log(`[Categorize] Returning incomeSourceId: ${rule.incomeSourceId}`)
        return { incomeSourceId: rule.incomeSourceId, ruleUsed: rule.pattern }
      } else {
        console.log(`[Categorize] ⚠️ Rule matched but missing required field! type=${parsed.type}, categoryId=${rule.categoryId}, incomeSourceId=${rule.incomeSourceId}, appliesTo=${rule.appliesTo}`)
        // Don't return - continue to next rule or fallback
      }
    }
    }
  }
  
  console.log(`[Categorize] No rules matched for transaction`)

  // 3. Fallback: Uncategorized (only if no rules matched and no valid CSV category)
  if (parsed.type === 'expense') {
    let uncategorized = await prisma.expenseCategory.findFirst({
      where: {
        userId,
        name: 'Uncategorized',
      },
      select: { id: true },
    })

    if (!uncategorized) {
      // Fetch categories once for color lookup
      const allUserCategories = await prisma.expenseCategory.findMany({
        where: { userId },
        select: { colorHex: true },
      })
      const usedColors = allUserCategories
        .map((c) => c.colorHex)
        .filter((c): c is string => c !== null && c !== undefined)
      const nextColor = getNextAvailableColor(usedColors)
      
      uncategorized = await prisma.expenseCategory.create({
        data: {
          userId,
          name: 'Uncategorized',
          type: 'variable',
          colorHex: nextColor,
        },
        select: { id: true },
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
  incomeSourceId?: string,
  useRegex: boolean = false
): Promise<void> {
  // Don't create rules for "Uncategorized" or "N/A" categories
  if (categoryId) {
    const category = await prisma.expenseCategory.findUnique({
      where: { id: categoryId },
      select: { name: true },
    })
    
    if (category && (category.name.toLowerCase() === 'uncategorized' || category.name.toLowerCase() === 'n/a')) {
      // Don't create a rule for uncategorized items
      return
    }
  }

  // IMPORTANT: Derive a generic, ID-free pattern from the merchant name
  // This ensures rules are reusable and don't include transaction-specific IDs
  const genericPattern = deriveGenericPatternFromDescription(merchantName)
  
  if (!genericPattern || genericPattern.length < 3) {
    // Pattern is too short or empty after stripping IDs - don't create a rule
    console.log(`[Learn Rule] Skipping rule creation - pattern too short after ID stripping: "${merchantName}" -> "${genericPattern}"`)
    return
  }

  const appliesTo = categoryId ? 'expense' : incomeSourceId ? 'income' : 'both'

  // Always prefer "contains" match type for generic patterns (unless user explicitly wants regex)
  // Generic patterns like "SOUTHWES" work better with "contains" than regex
  let pattern = genericPattern
  let matchType: 'exact' | 'contains' | 'regex' = 'contains'
  
  // Only use regex if explicitly requested AND the pattern is meaningful
  if (useRegex && genericPattern.length >= 3) {
    // Create a flexible regex pattern
    // Escape special regex characters and make it case-insensitive
    const escaped = genericPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Match the merchant name with optional spaces, dashes, or variations
    pattern = `(?i)${escaped.replace(/\s+/g, '[\\s\\-]*')}`
    matchType = 'regex'
  }

  // Check if a generic rule already exists for this pattern and category
  // This prevents creating duplicate rules with different specificity
  const existingGeneric = await prisma.categorizationRule.findFirst({
    where: {
      userId,
      pattern: matchType === 'regex' ? undefined : genericPattern,
      matchType: matchType === 'regex' ? undefined : 'contains',
      categoryId: categoryId || undefined,
      incomeSourceId: incomeSourceId || undefined,
      appliesTo,
    },
  })

  // Also check for any existing rule with the same pattern (to avoid duplicates)
  const existingByPattern = await prisma.categorizationRule.findFirst({
    where: {
      userId,
      pattern,
      matchType,
    },
  })

  if (existingGeneric || existingByPattern) {
    const existing = existingGeneric || existingByPattern
    
    // Explicit null check - TypeScript needs this to narrow the type
    if (!existing) {
      // This should never happen, but TypeScript needs the check
      return
    }
    
    // Don't update to "Uncategorized" or "N/A" - keep existing category if new one is invalid
    // Use optional chaining to safely access existing.categoryId
    let finalCategoryId: string | null = categoryId || existing?.categoryId || null
    if (finalCategoryId && finalCategoryId !== existing?.categoryId) {
      const newCategory = await prisma.expenseCategory.findUnique({
        where: { id: finalCategoryId },
        select: { name: true },
      })
      
      if (newCategory && (newCategory.name.toLowerCase() === 'uncategorized' || newCategory.name.toLowerCase() === 'n/a')) {
        // Keep the existing category instead of updating to uncategorized
        finalCategoryId = existing?.categoryId || null
      }
    }
    
    // Update existing rule to ensure it uses the generic pattern
    // If existing rule has a more specific pattern (with IDs), replace it with generic
    const hasNumericIds = /\d{6,}/.test(existing.pattern) // Check if pattern contains 6+ digit sequences
    const shouldUpdatePattern = existing.pattern !== pattern && 
                                 (hasNumericIds || existing.matchType !== matchType)
    
    // If existing rule has IDs and we have a generic pattern, always update to generic
    const finalPattern = (shouldUpdatePattern && hasNumericIds) ? pattern : existing.pattern
    const finalMatchType = (shouldUpdatePattern && hasNumericIds) ? matchType : existing.matchType
    
    await prisma.categorizationRule.update({
      where: { id: existing.id },
      data: {
        pattern: finalPattern, // Use generic pattern if existing has IDs
        matchType: finalMatchType, // Prefer contains over regex for generic patterns
        categoryId: finalCategoryId,
        incomeSourceId: incomeSourceId || existing.incomeSourceId,
        appliesTo,
      },
    })
    
    console.log(`[Learn Rule] Updated existing rule: "${existing.pattern}" -> "${pattern}" (${matchType})`)
  } else {
    // Create new rule with generic pattern
    await prisma.categorizationRule.create({
      data: {
        userId,
        pattern,
        matchType,
        categoryId,
        incomeSourceId,
        appliesTo,
      },
    })
    
    console.log(`[Learn Rule] Created new rule: "${pattern}" (${matchType}) for "${merchantName}"`)
  }
}

export function filterByMonth(
  transactions: ParsedTransaction[],
  year: number,
  month: number
): ParsedTransaction[] {
  return transactions.filter((t) => {
    // Handle both Date objects and date strings (from JSON)
    const date = t.date instanceof Date ? t.date : new Date(t.date)
    if (isNaN(date.getTime())) {
      // Invalid date, skip
      return false
    }
    const tYear = date.getFullYear()
    const tMonth = date.getMonth() + 1
    return tYear === year && tMonth === month
  })
}

