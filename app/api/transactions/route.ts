import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { learnCategoryRule, shouldExcludeTransaction } from '@/lib/csv-import'
import { roundCurrency } from '@/lib/format'

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
      select: {
        id: true,
        userId: true,
        date: true,
        description: true,
        amount: true,
        type: true,
        incomeSourceId: true,
        expenseCategoryId: true,
        merchantName: true,
        accountName: true,
        accountNumber: true,
        institutionName: true,
        csvCategory: true,
        createdAt: true,
        incomeSource: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        expenseCategory: {
          select: {
            id: true,
            name: true,
            type: true,
            colorHex: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    })

    // Filter out excluded transactions
    const filteredTransactions = transactions.filter((t) => 
      !shouldExcludeTransaction(
        t.description,
        t.merchantName || undefined,
        t.csvCategory || undefined,
        t.expenseCategory?.name
      )
    )

    return NextResponse.json(filteredTransactions)
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
        amount: roundCurrency(parseFloat(amount)),
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
      // Only learn rules if the category is not "Uncategorized" or "N/A"
      const category = transaction.expenseCategory
      const shouldLearn = !category || 
        (category.name.toLowerCase() !== 'uncategorized' && category.name.toLowerCase() !== 'n/a')
      
      if (shouldLearn) {
        // Don't use regex by default - let learnCategoryRule create generic "contains" patterns
        // This ensures rules are reusable and don't include transaction-specific IDs
        await learnCategoryRule(
          transaction.userId,
          transaction.merchantName,
          prisma,
          transaction.expenseCategoryId || undefined,
          transaction.incomeSourceId || undefined,
          false // useRegex = false to prefer generic "contains" patterns
        )
      }
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
    const ids = searchParams.get('ids') // Comma-separated list of IDs for bulk delete

    if (ids) {
      // Bulk delete
      const idArray = ids.split(',').filter((id) => id.trim())
      if (idArray.length === 0) {
        return NextResponse.json(
          { error: 'At least one id is required for bulk delete' },
          { status: 400 }
        )
      }

      const result = await prisma.transaction.deleteMany({
        where: {
          id: { in: idArray },
        },
      })

      return NextResponse.json({ success: true, deletedCount: result.count })
    }

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

