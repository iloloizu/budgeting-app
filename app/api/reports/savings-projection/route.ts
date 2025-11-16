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

    const projection = []

    for (let i = 0; i < 12; i++) {
      let year = currentYear
      let month = currentMonth + i

      if (month > 12) {
        month = month - 12
        year = year + 1
      }

      const budget = await prisma.monthlyBudget.findUnique({
        where: {
          userId_year_month: {
            userId,
            year,
            month,
          },
        },
      })

      projection.push({
        year,
        month,
        monthName: new Date(year, month - 1).toLocaleString('default', {
          month: 'short',
        }),
        plannedIncome: budget?.totalPlannedIncome || 0,
        plannedExpenses: budget?.totalPlannedExpenses || 0,
        plannedSavings: budget?.totalPlannedSavings || 0,
      })
    }

    return NextResponse.json(projection)
  } catch (error) {
    console.error('Error fetching savings projection:', error)
    return NextResponse.json(
      { error: 'Failed to fetch savings projection' },
      { status: 500 }
    )
  }
}

