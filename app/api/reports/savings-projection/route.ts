import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    // Build array of year/month pairs for the next 12 months
    const monthKeys: Array<{ year: number; month: number }> = []
    for (let i = 0; i < 12; i++) {
      let year = currentYear
      let month = currentMonth + i

      if (month > 12) {
        month = month - 12
        year = year + 1
      }

      monthKeys.push({ year, month })
    }

    // Fetch all budgets in a single query using OR conditions
    const budgets = await prisma.monthlyBudget.findMany({
      where: {
        userId,
        OR: monthKeys.map(({ year, month }) => ({
          year,
          month,
        })),
      },
    })

    // Create a map for O(1) lookup
    const budgetMap = new Map<string, typeof budgets[0]>()
    budgets.forEach((budget) => {
      budgetMap.set(`${budget.year}-${budget.month}`, budget)
    })

    // Build projection array with O(n) complexity
    const projection = monthKeys.map(({ year, month }) => {
      const budget = budgetMap.get(`${year}-${month}`)
      return {
        year,
        month,
        monthName: new Date(year, month - 1).toLocaleString('default', {
          month: 'short',
        }),
        plannedIncome: budget?.totalPlannedIncome || 0,
        plannedExpenses: budget?.totalPlannedExpenses || 0,
        plannedSavings: budget?.totalPlannedSavings || 0,
      }
    })

    return NextResponse.json(projection)
  } catch (error) {
    console.error('Error fetching savings projection:', error)
    return NextResponse.json(
      { error: 'Failed to fetch savings projection' },
      { status: 500 }
    )
  }
}

