import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const year = searchParams.get('year')
    const month = searchParams.get('month')

    if (!userId || !year || !month) {
      return NextResponse.json(
        { error: 'userId, year, and month are required' },
        { status: 400 }
      )
    }

    const budget = await prisma.monthlyBudget.findUnique({
      where: {
        userId_year_month: {
          userId,
          year: parseInt(year),
          month: parseInt(month),
        },
      },
      include: {
        budgetLineItems: {
          include: {
            expenseCategory: true,
          },
        },
      },
    })

    return NextResponse.json(budget)
  } catch (error) {
    console.error('Error fetching budget:', error)
    return NextResponse.json(
      { error: 'Failed to fetch budget' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      userId,
      year,
      month,
      totalPlannedIncome,
      totalPlannedExpenses,
      budgetLineItems,
    } = body

    if (!userId || !year || !month) {
      return NextResponse.json(
        { error: 'userId, year, and month are required' },
        { status: 400 }
      )
    }

    const totalPlannedSavings =
      (totalPlannedIncome || 0) - (totalPlannedExpenses || 0)

    // Upsert the monthly budget
    const budget = await prisma.monthlyBudget.upsert({
      where: {
        userId_year_month: {
          userId,
          year: parseInt(year),
          month: parseInt(month),
        },
      },
      update: {
        totalPlannedIncome: parseFloat(totalPlannedIncome || 0),
        totalPlannedExpenses: parseFloat(totalPlannedExpenses || 0),
        totalPlannedSavings,
      },
      create: {
        userId,
        year: parseInt(year),
        month: parseInt(month),
        totalPlannedIncome: parseFloat(totalPlannedIncome || 0),
        totalPlannedExpenses: parseFloat(totalPlannedExpenses || 0),
        totalPlannedSavings,
      },
    })

    // Delete existing line items
    await prisma.budgetLineItem.deleteMany({
      where: { monthlyBudgetId: budget.id },
    })

    // Create new line items
    if (budgetLineItems && Array.isArray(budgetLineItems)) {
      await prisma.budgetLineItem.createMany({
        data: budgetLineItems.map((item: any) => ({
          monthlyBudgetId: budget.id,
          expenseCategoryId: item.expenseCategoryId,
          plannedAmount: parseFloat(item.plannedAmount || 0),
        })),
      })
    }

    const updatedBudget = await prisma.monthlyBudget.findUnique({
      where: { id: budget.id },
      include: {
        budgetLineItems: {
          include: {
            expenseCategory: true,
          },
        },
      },
    })

    return NextResponse.json(updatedBudget, { status: 201 })
  } catch (error) {
    console.error('Error creating/updating budget:', error)
    return NextResponse.json(
      { error: 'Failed to create/update budget' },
      { status: 500 }
    )
  }
}

