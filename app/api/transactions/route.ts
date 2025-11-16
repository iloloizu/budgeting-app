import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { learnCategoryRule } from '@/lib/csv-import'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const year = searchParams.get('year')
    const month = searchParams.get('month')
    const categoryId = searchParams.get('categoryId')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    const where: any = { userId }

    if (year && month) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1)
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59)
      where.date = {
        gte: startDate,
        lte: endDate,
      }
    }

    if (categoryId) {
      where.expenseCategoryId = categoryId
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        incomeSource: true,
        expenseCategory: true,
      },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json(transactions)
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      userId,
      date,
      description,
      amount,
      type,
      incomeSourceId,
      expenseCategoryId,
    } = body

    if (!userId || !date || !description || amount === undefined || !type) {
      return NextResponse.json(
        { error: 'userId, date, description, amount, and type are required' },
        { status: 400 }
      )
    }

    if (type === 'income' && !incomeSourceId) {
      return NextResponse.json(
        { error: 'incomeSourceId is required for income transactions' },
        { status: 400 }
      )
    }

    if (type === 'expense' && !expenseCategoryId) {
      return NextResponse.json(
        { error: 'expenseCategoryId is required for expense transactions' },
        { status: 400 }
      )
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId,
        date: new Date(date),
        description,
        amount: parseFloat(amount),
        type,
        incomeSourceId: type === 'income' ? incomeSourceId : null,
        expenseCategoryId: type === 'expense' ? expenseCategoryId : null,
      },
      include: {
        incomeSource: true,
        expenseCategory: true,
      },
    })

    // Learn from the transaction if it has a merchant name
    if (transaction.merchantName) {
      await learnCategoryRule(
        userId,
        transaction.merchantName,
        prisma,
        transaction.expenseCategoryId || undefined,
        transaction.incomeSourceId || undefined
      )
    }

    return NextResponse.json(transaction, { status: 201 })
  } catch (error) {
    console.error('Error creating transaction:', error)
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      id,
      expenseCategoryId,
      incomeSourceId,
      description,
      amount,
    } = body

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    // Get existing transaction to check for changes
    const existing = await prisma.transaction.findUnique({
      where: { id },
      include: {
        expenseCategory: true,
        incomeSource: true,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      )
    }

    // Update transaction
    const transaction = await prisma.transaction.update({
      where: { id },
      data: {
        ...(expenseCategoryId !== undefined && { expenseCategoryId }),
        ...(incomeSourceId !== undefined && { incomeSourceId }),
        ...(description !== undefined && { description }),
        ...(amount !== undefined && { amount: parseFloat(amount) }),
      },
      include: {
        incomeSource: true,
        expenseCategory: true,
      },
    })

    // Learn from category changes
    const categoryChanged =
      expenseCategoryId !== undefined &&
      expenseCategoryId !== existing.expenseCategoryId
    const incomeSourceChanged =
      incomeSourceId !== undefined && incomeSourceId !== existing.incomeSourceId

    if ((categoryChanged || incomeSourceChanged) && transaction.merchantName) {
      await learnCategoryRule(
        transaction.userId,
        transaction.merchantName,
        prisma,
        transaction.expenseCategoryId || undefined,
        transaction.incomeSourceId || undefined
      )
    }

    return NextResponse.json(transaction)
  } catch (error) {
    console.error('Error updating transaction:', error)
    return NextResponse.json(
      { error: 'Failed to update transaction' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    await prisma.transaction.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting transaction:', error)
    return NextResponse.json(
      { error: 'Failed to delete transaction' },
      { status: 500 }
    )
  }
}

