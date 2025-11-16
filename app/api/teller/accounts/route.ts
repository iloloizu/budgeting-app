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
    let has404Error = false

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
          has404Error = true
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
      return NextResponse.json(
        { 
          error: 'No accounts found for connected enrollments',
          message: has404Error
            ? `All ${enrollments.length} enrollment(s) appear to be invalid or expired. Please reconnect your bank accounts using the "Connect Bank Account" button.`
            : `Checked ${enrollments.length} enrollment(s). This may mean the accounts haven't been synced yet, or there was an error fetching them.`,
          errors: errors.length > 0 ? errors : undefined
        },
        { status: 404 }
      )
    }

    // Create a map of account ID to balance
    const balanceMap = new Map<string, TellerBalance>()
    allBalances.forEach((balance) => {
      balanceMap.set(balance.account_id, balance)
    })

    // Sync accounts to database
    const syncedAccounts = []
    for (const account of allAccounts) {
      const balance = balanceMap.get(account.id)
      const isAsset = isAssetAccount(account.type)
      const balanceValue = balance ? getBalanceValue(balance, account.type) : 0

      // Find the enrollment for this account
      const enrollment = enrollments.find((e: any) => e.enrollmentId === account.enrollmentId)
      if (!enrollment) continue

      // Upsert account
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

