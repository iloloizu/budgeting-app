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

    // Get active enrollments for this user
    const enrollments = await (prisma as any).tellerEnrollment.findMany({
      where: { userId, isActive: true },
    })

    if (enrollments.length === 0) {
      return NextResponse.json(
        { error: 'No Teller enrollments found. Please connect your accounts first.' },
        { status: 404 }
      )
    }

    // Fetch accounts and balances for all enrollments
    const allAccounts: any[] = []
    const allBalances: TellerBalance[] = []
    const errors: string[] = []

    for (const enrollment of enrollments) {
      try {
        // Use the stored access token from enrollment
        const [accounts, balances] = await Promise.all([
          getTellerAccounts(enrollment.accessToken),
          getTellerBalances(enrollment.accessToken),
        ])

        // Tag accounts with enrollment ID
        accounts.forEach((account: any) => {
          allAccounts.push({ ...account, enrollmentId: enrollment.enrollmentId })
        })
        allBalances.push(...balances)
      } catch (error: any) {
        const errorMsg = `Enrollment ${enrollment.enrollmentId}: ${error.message || 'Unknown error'}`
        errors.push(errorMsg)
        
        // If enrollment returns 404, mark it as inactive
        if (error.message?.includes('404') || error.message?.includes('not_found')) {
          try {
            await (prisma as any).tellerEnrollment.update({
              where: { id: enrollment.id },
              data: { isActive: false, status: 'disconnected' },
            })
          } catch (updateError) {
            // Continue even if update fails
          }
        }
      }
    }

    if (allAccounts.length === 0) {
      const all404 = enrollments.length > 0 && errors.some(e => e.includes('404') || e.includes('not_found'))
      
      const errorMessage = all404
        ? `All ${enrollments.length} enrollment(s) appear to be invalid or expired. Please reconnect your bank accounts using the "Connect Bank Account" button.`
        : errors.length > 0 
          ? `Errors occurred while fetching accounts: ${errors.join('; ')}`
          : `Checked ${enrollments.length} enrollment(s). This may mean the accounts haven't been synced yet, or there was an error fetching them.`
      
      return NextResponse.json(
        { 
          error: 'No accounts found for connected enrollments',
          message: errorMessage,
          errors: errors.length > 0 ? errors : undefined
        },
        { status: 404 }
      )
    }

    // Use allAccounts and allBalances instead of accounts and balances
    const accounts = allAccounts
    const balances = allBalances

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
    const snapshot = await (prisma as any).netWorthSnapshot.upsert({
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
    await (prisma as any).netWorthAccountBalance.deleteMany({
      where: { snapshotId: snapshot.id },
    })

    // Get or create TellerAccount records for foreign key references
    const tellerAccountMap = new Map<string, string>()
    for (const account of accounts) {
      const enrollment = enrollments.find((e: any) => e.enrollmentId === account.enrollmentId)
      if (!enrollment) continue

      const dbAccount = await (prisma as any).tellerAccount.upsert({
        where: {
          userId_tellerAccountId: {
            userId,
            tellerAccountId: account.id,
          },
        },
        update: {
          enrollmentId: enrollment.id,
          institutionId: account.institution.id,
          institutionName: account.institution.name,
          name: account.name,
          type: account.type,
          currency: account.currency,
          isActive: true,
        },
        create: {
          userId,
          enrollmentId: enrollment.id,
          tellerAccountId: account.id,
          institutionId: account.institution.id,
          institutionName: account.institution.name,
          name: account.name,
          type: account.type,
          currency: account.currency,
        },
      })
      tellerAccountMap.set(account.id, dbAccount.id)
    }

    // Create account balance records
    await (prisma as any).netWorthAccountBalance.createMany({
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
    const completeSnapshot = await (prisma as any).netWorthSnapshot.findUnique({
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

    const snapshots = await (prisma as any).netWorthSnapshot.findMany({
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

