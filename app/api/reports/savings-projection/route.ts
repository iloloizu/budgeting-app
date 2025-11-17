import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { roundCurrency } from '@/lib/format'

export const runtime = 'nodejs'

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

    // Build array of year/month pairs: 6 months back + current + 6 months forward
    // But also check for earliest transaction to show all available historical data
    const earliestTransaction = await prisma.transaction.findFirst({
      where: { userId },
      orderBy: { date: 'asc' },
      select: { date: true },
    })

    const monthKeys: Array<{ year: number; month: number }> = []
    
    // Determine start month: either 6 months back or earliest transaction month, whichever is earlier
    let startMonth = currentMonth - 6
    let startYear = currentYear
    
    if (startMonth <= 0) {
      startMonth += 12
      startYear -= 1
    }

    if (earliestTransaction) {
      const earliestYear = earliestTransaction.date.getFullYear()
      const earliestMonth = earliestTransaction.date.getMonth() + 1
      
      // If earliest transaction is before our 6-month window, start from there
      if (earliestYear < startYear || (earliestYear === startYear && earliestMonth < startMonth)) {
        startYear = earliestYear
        startMonth = earliestMonth
      }
    }

    // Build month array from start to 6 months forward
    let year = startYear
    let month = startMonth
    const endMonth = currentMonth + 6
    const endYear = currentMonth + 6 > 12 ? currentYear + 1 : currentYear

    while (year < endYear || (year === endYear && month <= endMonth)) {
      monthKeys.push({ year, month })
      month++
      if (month > 12) {
        month = 1
        year++
      }
    }

    // Fetch all budgets in a single query
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

    // Fetch all transactions for the date range
    const startDate = new Date(startYear, startMonth - 1, 1)
    const endDate = new Date(endYear, endMonth, 0, 23, 59, 59)
    
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        date: true,
        amount: true,
        type: true,
      },
    })

    // Group transactions by month in a single O(n) pass
    const transactionMap = new Map<string, { income: number; expenses: number }>()
    
    for (const transaction of transactions) {
      const tYear = transaction.date.getFullYear()
      const tMonth = transaction.date.getMonth() + 1
      const key = `${tYear}-${tMonth}`
      
      if (!transactionMap.has(key)) {
        transactionMap.set(key, { income: 0, expenses: 0 })
      }
      
      const totals = transactionMap.get(key)!
      if (transaction.type === 'income') {
        totals.income += transaction.amount
      } else if (transaction.type === 'expense') {
        totals.expenses += transaction.amount
      }
    }

    // Round all transaction totals
    transactionMap.forEach((totals, key) => {
      totals.income = roundCurrency(totals.income)
      totals.expenses = roundCurrency(totals.expenses)
    })

    // Build projection array with actual and planned data
    const projection = monthKeys.map(({ year, month }) => {
      const budget = budgetMap.get(`${year}-${month}`)
      const actuals = transactionMap.get(`${year}-${month}`) || { income: 0, expenses: 0 }
      const actualSavings = roundCurrency(actuals.income - actuals.expenses)
      
      const isPast = year < currentYear || (year === currentYear && month < currentMonth)
      const isCurrent = year === currentYear && month === currentMonth
      const isFuture = year > currentYear || (year === currentYear && month > currentMonth)

      return {
        year,
        month,
        monthName: new Date(year, month - 1).toLocaleString('default', {
          month: 'short',
        }),
        // For past months: show actuals, for future: show planned, for current: show both
        actualIncome: (isPast || isCurrent) ? actuals.income : 0,
        actualExpenses: (isPast || isCurrent) ? actuals.expenses : 0,
        actualSavings: (isPast || isCurrent) ? actualSavings : 0,
        plannedIncome: budget?.totalPlannedIncome || 0,
        plannedExpenses: budget?.totalPlannedExpenses || 0,
        plannedSavings: budget?.totalPlannedSavings || 0,
        // For display: use actuals for past/current, planned for future
        income: (isPast || isCurrent) ? actuals.income : (budget?.totalPlannedIncome || 0),
        expenses: (isPast || isCurrent) ? actuals.expenses : (budget?.totalPlannedExpenses || 0),
        savings: (isPast || isCurrent) ? actualSavings : (budget?.totalPlannedSavings || 0),
        isPast,
        isCurrent,
        isFuture,
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

