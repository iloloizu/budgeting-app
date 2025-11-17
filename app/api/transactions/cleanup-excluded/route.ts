import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { shouldSkipImport } from '@/lib/csv-import'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    // Fetch all transactions for the user
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      select: {
        id: true,
        description: true,
        merchantName: true,
        csvCategory: true,
      },
    })

    // Find transactions that should be completely deleted (Payment Thank You-Mobile, Credit Card Payment, Payment to Chase card ending, AMERICAN EXPRESS ACH PMT)
    // NOTE: Investment/Robinhood transactions should NOT be deleted - they should be kept and categorized as "Investing"
    const excludedIds: string[] = []
    for (const transaction of transactions) {
      if (shouldSkipImport(
        transaction.description,
        transaction.merchantName || undefined,
        transaction.csvCategory || undefined
      )) {
        excludedIds.push(transaction.id)
      }
    }

    if (excludedIds.length === 0) {
      return NextResponse.json({
        success: true,
        deletedCount: 0,
        message: 'No excluded transactions found to delete (Payment Thank You-Mobile, Credit Card Payment, Payment to Chase card ending, AMERICAN EXPRESS ACH PMT). Note: Investment/Robinhood transactions are kept and categorized as "Investing".',
      })
    }

    // Delete all excluded transactions (Payment Thank You-Mobile, Credit Card Payment, Payment to Chase card ending, AMERICAN EXPRESS ACH PMT)
    // Investment/Robinhood transactions are NOT deleted - they are kept and categorized as "Investing"
    const result = await prisma.transaction.deleteMany({
      where: {
        id: { in: excludedIds },
      },
    })

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      message: `Deleted ${result.count} excluded transaction${result.count > 1 ? 's' : ''} (Payment Thank You-Mobile, Credit Card Payment, Payment to Chase card ending, AMERICAN EXPRESS ACH PMT). Note: Investment/Robinhood transactions are kept and categorized as "Investing".`,
    })
  } catch (error: any) {
    console.error('Error cleaning up excluded transactions:', error)
    return NextResponse.json(
      { error: 'Failed to cleanup excluded transactions', message: error.message },
      { status: 500 }
    )
  }
}

