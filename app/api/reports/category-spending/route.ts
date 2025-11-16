import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { roundCurrency } from '@/lib/format'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const year = searchParams.get('year')

    if (!userId || !year) {
      return NextResponse.json(
        { error: 'userId and year are required' },
        { status: 400 }
      )
    }

    const startDate = new Date(parseInt(year), 0, 1)
    const endDate = new Date(parseInt(year), 11, 31, 23, 59, 59)

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        type: 'expense',
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        expenseCategory: true,
      },
    })

    // Group by category
    const categoryTotals: Record<string, { name: string; total: number }> = {}

    transactions.forEach((transaction) => {
      if (transaction.expenseCategory) {
        const categoryId = transaction.expenseCategory.id
        const categoryName = transaction.expenseCategory.name

        if (!categoryTotals[categoryId]) {
          categoryTotals[categoryId] = {
            name: categoryName,
            total: 0,
          }
        }

        categoryTotals[categoryId].total = roundCurrency(
          categoryTotals[categoryId].total + transaction.amount
        )
      }
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

