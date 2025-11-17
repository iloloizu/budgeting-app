import { PrismaClient } from '@prisma/client'
import { normalizeMerchant } from './csv-import'

/**
 * Smart categorization algorithm that uses pattern matching and heuristics
 * to categorize transactions that don't match existing rules
 */
export async function smartCategorizeTransaction(
  merchantName: string,
  description: string,
  amount: number,
  type: 'income' | 'expense',
  userId: string,
  prisma: PrismaClient
): Promise<{ categoryId?: string; incomeSourceId?: string; confidence: number } | null> {
  if (type !== 'expense') {
    // For now, only handle expenses
    return null
  }

  const normalizedMerchant = normalizeMerchant(merchantName || description)
  const normalizedDescription = normalizeMerchant(description || '')
  const combinedText = `${normalizedMerchant} ${normalizedDescription}`.toUpperCase()

  // Get all expense categories
  const categories = await prisma.expenseCategory.findMany({
    where: { userId },
    select: { id: true, name: true },
  })

  // Pattern-based categorization using keywords
  const categoryPatterns: Array<{
    keywords: string[]
    categoryName: string
    confidence: number
  }> = [
    // Food & Dining
    {
      keywords: ['UBER EATS', 'DOORDASH', 'GRUBHUB', 'POSTMATES', 'STARBUCKS', 'MCDONALDS', 'CHIPOTLE', 'PANERA', 'RESTAURANT', 'CAFE', 'COFFEE', 'PIZZA', 'BURGER', 'FOOD', 'DINING', 'EATERY'],
      categoryName: 'Food & Dining',
      confidence: 0.85,
    },
    // Transportation
    {
      keywords: ['UBER', 'LYFT', 'TAXI', 'GAS', 'SHELL', 'EXXON', 'MOBIL', 'BP', 'CHEVRON', 'PARKING', 'METRO', 'SUBWAY', 'BUS', 'TRAIN', 'AIRLINE', 'DELTA', 'UNITED', 'AMERICAN'],
      categoryName: 'Transportation',
      confidence: 0.85,
    },
    // Shopping
    {
      keywords: ['AMAZON', 'TARGET', 'WALMART', 'COSTCO', 'BEST BUY', 'HOME DEPOT', 'LOWES', 'MACYS', 'NORDSTROM', 'SHOPPING', 'RETAIL'],
      categoryName: 'Shopping',
      confidence: 0.85,
    },
    // Bills & Utilities
    {
      keywords: ['ELECTRIC', 'GAS BILL', 'WATER', 'INTERNET', 'PHONE', 'CELLULAR', 'VERIZON', 'AT&T', 'T-MOBILE', 'SPECTRUM', 'COMCAST', 'XFINITY', 'UTILITY', 'BILL'],
      categoryName: 'Bills & Utilities',
      confidence: 0.9,
    },
    // Entertainment
    {
      keywords: ['NETFLIX', 'SPOTIFY', 'DISNEY', 'HULU', 'APPLE MUSIC', 'MOVIE', 'THEATER', 'CINEMA', 'CONCERT', 'TICKET', 'ENTERTAINMENT'],
      categoryName: 'Entertainment',
      confidence: 0.8,
    },
    // Healthcare
    {
      keywords: ['CVS', 'WALGREENS', 'PHARMACY', 'DOCTOR', 'HOSPITAL', 'MEDICAL', 'HEALTH', 'DENTAL', 'VISION', 'INSURANCE'],
      categoryName: 'Healthcare',
      confidence: 0.85,
    },
    // Travel
    {
      keywords: ['HOTEL', 'AIRBNB', 'BOOKING', 'EXPEDIA', 'TRAVEL', 'VACATION', 'RESORT'],
      categoryName: 'Travel',
      confidence: 0.85,
    },
    // Groceries
    {
      keywords: ['WHOLE FOODS', 'TRADER JOES', 'SAFEWAY', 'KROGER', 'ALBERTSONS', 'GROCERY', 'SUPERMARKET'],
      categoryName: 'Groceries',
      confidence: 0.9,
    },
    // Subscription
    {
      keywords: ['SUBSCRIPTION', 'MONTHLY', 'ANNUAL', 'MEMBERSHIP', 'PREMIUM'],
      categoryName: 'Subscription',
      confidence: 0.75,
    },
  ]

  // Try to match against patterns
  for (const pattern of categoryPatterns) {
    for (const keyword of pattern.keywords) {
      if (combinedText.includes(keyword)) {
        // Find or create the category
        let category = categories.find(
          (cat) => cat.name.toLowerCase() === pattern.categoryName.toLowerCase()
        )

        if (!category) {
          // Try to find a similar category
          category = categories.find(
            (cat) => cat.name.toLowerCase().includes(pattern.categoryName.toLowerCase().split(' ')[0]) ||
                     pattern.categoryName.toLowerCase().includes(cat.name.toLowerCase().split(' ')[0])
          )
        }

        if (category) {
          return {
            categoryId: category.id,
            confidence: pattern.confidence,
          }
        }
      }
    }
  }

  // Amount-based heuristics
  if (amount > 0) {
    // Very small amounts (< $5) might be fees or small purchases
    if (amount < 5) {
      const feesCategory = categories.find(
        (cat) => cat.name.toLowerCase().includes('fee') || cat.name.toLowerCase().includes('misc')
      )
      if (feesCategory) {
        return {
          categoryId: feesCategory.id,
          confidence: 0.6,
        }
      }
    }

    // Large amounts (> $1000) might be rent, insurance, or major purchases
    if (amount > 1000) {
      const largeExpenseCategory = categories.find(
        (cat) => cat.name.toLowerCase().includes('rent') ||
                 cat.name.toLowerCase().includes('insurance') ||
                 cat.name.toLowerCase().includes('mortgage')
      )
      if (largeExpenseCategory) {
        return {
          categoryId: largeExpenseCategory.id,
          confidence: 0.7,
        }
      }
    }
  }

  // Partial word matching - check if any part of merchant name matches category name
  const merchantWords = normalizedMerchant.split(' ').filter(w => w.length > 3)
  for (const word of merchantWords) {
    const matchingCategory = categories.find(
      (cat) => cat.name.toUpperCase().includes(word) || word.includes(cat.name.toUpperCase().split(' ')[0])
    )
    if (matchingCategory) {
      return {
        categoryId: matchingCategory.id,
        confidence: 0.65,
      }
    }
  }

  return null
}

