import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { roundCurrency } from '@/lib/format'

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

    const totalPlannedSavings = roundCurrency(
      (totalPlannedIncome || 0) - (totalPlannedExpenses || 0)
    )

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
        totalPlannedIncome: roundCurrency(parseFloat(totalPlannedIncome || 0)),
        totalPlannedExpenses: roundCurrency(
          parseFloat(totalPlannedExpenses || 0)
        ),
        totalPlannedSavings,
      },
      create: {
        userId,
        year: parseInt(year),
        month: parseInt(month),
        totalPlannedIncome: roundCurrency(parseFloat(totalPlannedIncome || 0)),
        totalPlannedExpenses: roundCurrency(
          parseFloat(totalPlannedExpenses || 0)
        ),
        totalPlannedSavings,
      },
    })

    // Delete existing line items and create new ones in a transaction
    if (budgetLineItems && Array.isArray(budgetLineItems)) {
      // Use transaction to ensure atomicity
      await prisma.$transaction([
        prisma.budgetLineItem.deleteMany({
          where: { monthlyBudgetId: budget.id },
        }),
        prisma.budgetLineItem.createMany({
          data: budgetLineItems.map((item: any) => ({
            monthlyBudgetId: budget.id,
            expenseCategoryId: item.expenseCategoryId,
            plannedAmount: roundCurrency(parseFloat(item.plannedAmount || 0)),
          })),
        }),
      ])
    } else {
      // If no line items, just delete existing ones
      await prisma.budgetLineItem.deleteMany({
        where: { monthlyBudgetId: budget.id },
      })
    }

    // Fetch updated budget with only needed fields
    const updatedBudget = await prisma.monthlyBudget.findUnique({
      where: { id: budget.id },
      select: {
        id: true,
        userId: true,
        year: true,
        month: true,
        totalPlannedIncome: true,
        totalPlannedExpenses: true,
        totalPlannedSavings: true,
        createdAt: true,
        updatedAt: true,
        budgetLineItems: {
          select: {
            id: true,
            monthlyBudgetId: true,
            expenseCategoryId: true,
            plannedAmount: true,
            expenseCategory: {
              select: {
                id: true,
                name: true,
                type: true,
                colorHex: true,
              },
            },
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

