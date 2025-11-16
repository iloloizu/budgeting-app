// Teller API client utilities

const TELLER_API_BASE = 'https://api.teller.io'

export interface TellerAccount {
  id: string
  institution: {
    id: string
    name: string
  }
  name: string
  type: string
  currency: string
  enrollment_id?: string
}

export interface TellerBalance {
  account_id: string
  available: string
  current: string
  limit?: string
}

export interface TellerEnrollment {
  id: string
  institution: {
    id: string
    name: string
  }
  status: string
}

export async function getTellerAccounts(accessToken: string): Promise<TellerAccount[]> {
  const response = await fetch(`${TELLER_API_BASE}/accounts`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Teller API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

export async function getTellerBalances(accessToken: string): Promise<TellerBalance[]> {
  const response = await fetch(`${TELLER_API_BASE}/balances`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Teller API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

export async function getTellerEnrollments(accessToken: string): Promise<TellerEnrollment[]> {
  const response = await fetch(`${TELLER_API_BASE}/enrollments`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Teller API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

// Helper to determine if an account is an asset or liability
export function isAssetAccount(accountType: string): boolean {
  // Credit accounts are liabilities, everything else is an asset
  return accountType !== 'credit'
}

// Helper to get balance value (handle credit accounts differently)
export function getBalanceValue(balance: TellerBalance, accountType: string): number {
  const current = parseFloat(balance.current || '0')
  
  // For credit accounts, the balance is typically negative (what you owe)
  // For other accounts, positive balance is what you have
  if (accountType === 'credit') {
    // Credit limit minus current balance = available credit
    // What you owe = current balance (usually positive, but represents debt)
    return -Math.abs(current) // Make it negative to represent liability
  }
  
  return current
}

