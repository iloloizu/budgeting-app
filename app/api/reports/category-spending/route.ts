import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { roundCurrency } from '@/lib/format'
import { shouldExcludeTransaction } from '@/lib/csv-import'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const year = searchParams.get('year')
    const month = searchParams.get('month')

    if (!userId || !year) {
      return NextResponse.json(
        { error: 'userId and year are required' },
        { status: 400 }
      )
    }

    // If month is provided, filter to that specific month
    // Otherwise, filter to the entire year
    const startDate = month !== null
      ? new Date(parseInt(year), parseInt(month), 1)
      : new Date(parseInt(year), 0, 1)
    const endDate = month !== null
      ? new Date(parseInt(year), parseInt(month) + 1, 0, 23, 59, 59)
      : new Date(parseInt(year), 11, 31, 23, 59, 59)

    // Use aggregation for better performance - O(n) single pass
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        type: 'expense',
        date: {
          gte: startDate,
          lte: endDate,
        },
        expenseCategoryId: {
          not: null,
        },
      },
      select: {
        amount: true,
        description: true,
        merchantName: true,
        csvCategory: true,
        expenseCategory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Group by category in a single O(n) pass, excluding filtered transactions
    const categoryTotals: Record<string, { name: string; total: number }> = {}

    for (const transaction of transactions) {
      // Skip excluded transactions
      if (shouldExcludeTransaction(
        transaction.description,
        transaction.merchantName || undefined,
        transaction.csvCategory || undefined,
        transaction.expenseCategory?.name
      )) {
        continue
      }

      if (transaction.expenseCategory) {
        const categoryId = transaction.expenseCategory.id
        const categoryName = transaction.expenseCategory.name

        if (!categoryTotals[categoryId]) {
          categoryTotals[categoryId] = {
            name: categoryName,
            total: 0,
          }
        }

        categoryTotals[categoryId].total += transaction.amount
      }
    }

    // Round all totals at once
    Object.keys(categoryTotals).forEach((id) => {
      categoryTotals[id].total = roundCurrency(categoryTotals[id].total)
    })

    const totalExpenses = roundCurrency(
      Object.values(categoryTotals).reduce((sum, cat) => sum + cat.total, 0)
    )

    const result = Object.entries(categoryTotals).map(([id, data]) => ({
      categoryId: id,
      categoryName: data.name,
      totalSpent: roundCurrency(data.total),
      percentage: roundCurrency(
        totalExpenses > 0 ? (data.total / totalExpenses) * 100 : 0
      ),
    }))

    return NextResponse.json({
      year: parseInt(year),
      month: month !== null ? parseInt(month) : null,
      totalExpenses: roundCurrency(totalExpenses),
      categories: result.sort((a, b) => b.totalSpent - a.totalSpent),
    })
  } catch (error) {
    console.error('Error fetching category spending:', error)
    return NextResponse.json(
      { error: 'Failed to fetch category spending' },
      { status: 500 }
    )
  }
}

