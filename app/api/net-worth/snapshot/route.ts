import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTellerAccounts, getTellerBalances, isAssetAccount, getBalanceValue, TellerBalance } from '@/lib/teller'
import { roundCurrency } from '@/lib/format'

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

    // Server-side only - API key never exposed to client
    const accessToken = process.env.TELLER_API_KEY
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Teller API key not configured' },
        { status: 500 }
      )
    }

    // Sanitize: Ensure API key is never logged or exposed
    if (process.env.NODE_ENV === 'development') {
      console.log('Teller API: Using configured API key (key not logged for security)')
    }

    // Fetch current accounts and balances
    const [accounts, balances] = await Promise.all([
      getTellerAccounts(accessToken),
      getTellerBalances(accessToken),
    ])

    const balanceMap = new Map<string, TellerBalance>()
    balances.forEach((balance) => {
      balanceMap.set(balance.account_id, balance)
    })

    // Calculate totals
    let totalAssets = 0
    let totalLiabilities = 0
    const accountBalances: Array<{
      tellerAccountId: string | null
      accountName: string
      institutionName: string
      accountType: string
      balance: number
      isAsset: boolean
    }> = []

    for (const account of accounts) {
      const balance = balanceMap.get(account.id)
      const isAsset = isAssetAccount(account.type)
      const balanceValue = balance ? getBalanceValue(balance, account.type) : 0

      accountBalances.push({
        tellerAccountId: account.id,
        accountName: account.name,
        institutionName: account.institution.name,
        accountType: account.type,
        balance: roundCurrency(balanceValue),
        isAsset,
      })

      if (isAsset) {
        totalAssets += balanceValue
      } else {
        totalLiabilities += Math.abs(balanceValue)
      }
    }

    totalAssets = roundCurrency(totalAssets)
    totalLiabilities = roundCurrency(totalLiabilities)
    const netWorth = roundCurrency(totalAssets - totalLiabilities)

    // Get current month/year
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    // Create or update snapshot
    const snapshot = await prisma.netWorthSnapshot.upsert({
      where: {
        userId_year_month: {
          userId,
          year,
          month,
        },
      },
      update: {
        totalAssets,
        totalLiabilities,
        netWorth,
        snapshotDate: now,
      },
      create: {
        userId,
        year,
        month,
        totalAssets,
        totalLiabilities,
        netWorth,
        snapshotDate: now,
      },
    })

    // Delete old account balances and create new ones
    await prisma.netWorthAccountBalance.deleteMany({
      where: { snapshotId: snapshot.id },
    })

    // Get or create TellerAccount records for foreign key references
    const tellerAccountMap = new Map<string, string>()
    for (const account of accounts) {
      const dbAccount = await prisma.tellerAccount.findUnique({
        where: {
          userId_tellerAccountId: {
            userId,
            tellerAccountId: account.id,
          },
        },
      })
      if (dbAccount) {
        tellerAccountMap.set(account.id, dbAccount.id)
      }
    }

    // Create account balance records
    await prisma.netWorthAccountBalance.createMany({
      data: accountBalances.map((ab) => ({
        snapshotId: snapshot.id,
        tellerAccountId: ab.tellerAccountId ? tellerAccountMap.get(ab.tellerAccountId) || null : null,
        accountName: ab.accountName,
        institutionName: ab.institutionName,
        accountType: ab.accountType,
        balance: ab.balance,
        isAsset: ab.isAsset,
      })),
    })

    // Fetch complete snapshot with account balances
    const completeSnapshot = await prisma.netWorthSnapshot.findUnique({
      where: { id: snapshot.id },
      include: {
        accountBalances: {
          include: {
            tellerAccount: true,
          },
        },
      },
    })

    return NextResponse.json(completeSnapshot, { status: 201 })
  } catch (error: any) {
    console.error('Error creating net worth snapshot:', error)
    console.error('Error stack:', error.stack)
    return NextResponse.json(
      { 
        error: 'Failed to create snapshot', 
        message: error.message || 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const limit = parseInt(searchParams.get('limit') || '12')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    const snapshots = await prisma.netWorthSnapshot.findMany({
      where: { userId },
      include: {
        accountBalances: {
          include: {
            tellerAccount: true,
          },
        },
      },
      orderBy: { snapshotDate: 'desc' },
      take: limit,
    })

    return NextResponse.json(snapshots)
  } catch (error: any) {
    console.error('Error fetching net worth snapshots:', error)
    return NextResponse.json(
      { error: 'Failed to fetch snapshots', message: error.message },
      { status: 500 }
    )
  }
}

