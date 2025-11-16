import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTellerAccounts, getTellerBalances, isAssetAccount, getBalanceValue, TellerBalance } from '@/lib/teller'

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

    // Fetch accounts and balances from Teller
    const [accounts, balances] = await Promise.all([
      getTellerAccounts(accessToken),
      getTellerBalances(accessToken),
    ])

    // Create a map of account ID to balance
    const balanceMap = new Map<string, TellerBalance>()
    balances.forEach((balance) => {
      balanceMap.set(balance.account_id, balance)
    })

    // Sync accounts to database
    const syncedAccounts = []
    for (const account of accounts) {
      const balance = balanceMap.get(account.id)
      const isAsset = isAssetAccount(account.type)
      const balanceValue = balance ? getBalanceValue(balance, account.type) : 0

      // Upsert account
      const dbAccount = await prisma.tellerAccount.upsert({
        where: {
          userId_tellerAccountId: {
            userId,
            tellerAccountId: account.id,
          },
        },
        update: {
          institutionId: account.institution.id,
          institutionName: account.institution.name,
          name: account.name,
          type: account.type,
          currency: account.currency,
          enrollmentId: account.enrollment_id,
          isActive: true,
        },
        create: {
          userId,
          tellerAccountId: account.id,
          institutionId: account.institution.id,
          institutionName: account.institution.name,
          name: account.name,
          type: account.type,
          currency: account.currency,
          enrollmentId: account.enrollment_id,
        },
      })

      syncedAccounts.push({
        ...dbAccount,
        currentBalance: balanceValue,
        availableBalance: balance ? parseFloat(balance.available || '0') : 0,
        limit: balance?.limit ? parseFloat(balance.limit) : null,
      })
    }

    return NextResponse.json(syncedAccounts)
  } catch (error: any) {
    console.error('Error fetching Teller accounts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch accounts', message: error.message },
      { status: 500 }
    )
  }
}

