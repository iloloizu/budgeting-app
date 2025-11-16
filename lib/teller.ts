// Teller API client utilities

import https from 'https'
import fs from 'fs'
import { URL } from 'url'

const TELLER_API_BASE = 'https://api.teller.io'

// Get client certificate paths from environment variables
const getTellerCertConfig = () => {
  // Option 1: Use certificate and key from environment variables (direct content)
  const certContent = process.env.TELLER_CERT
  const keyContent = process.env.TELLER_KEY
  
  if (certContent && keyContent) {
    return {
      cert: certContent,
      key: keyContent,
    }
  }
  
  // Option 2: Use certificate and key from file paths
  const certPath = process.env.TELLER_CERT_PATH
  const keyPath = process.env.TELLER_KEY_PATH
  
  if (!certPath || !keyPath) {
    return null
  }
  
  // Check if files exist
  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    return null
  }
  return {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
  }
}

// Create HTTPS agent with client certificate
const getTellerHttpsAgent = () => {
  const certConfig = getTellerCertConfig()
  if (!certConfig) {
    return undefined // Will use default agent (may fail for non-sandbox)
  }
  
  return new https.Agent({
    cert: certConfig.cert,
    key: certConfig.key,
    rejectUnauthorized: true, // Verify server certificate
  })
}

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

// Helper function to make HTTPS requests with mTLS
async function tellerApiRequest<T>(path: string, accessToken: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${TELLER_API_BASE}${path}`)
    const agent = getTellerHttpsAgent()
    
    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      agent,
    }
    
    const req = https.request(options, (res) => {
      let data = ''
      
      res.on('data', (chunk) => {
        data += chunk
      })
      
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const jsonData = JSON.parse(data)
            resolve(jsonData)
          } catch (error) {
            reject(new Error(`Failed to parse JSON response: ${error}`))
          }
        } else {
          const errorMsg = `Teller API error: ${res.statusCode} ${res.statusMessage} - ${data}`
          reject(new Error(errorMsg))
        }
      })
    })
    
    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`))
    })
    
    req.end()
  })
}

export async function getTellerAccounts(accessToken: string): Promise<TellerAccount[]> {
  return tellerApiRequest<TellerAccount[]>('/accounts', accessToken)
}

export async function getTellerBalances(accessToken: string): Promise<TellerBalance[]> {
  return tellerApiRequest<TellerBalance[]>('/balances', accessToken)
}

export async function getTellerEnrollments(accessToken: string): Promise<TellerEnrollment[]> {
  return tellerApiRequest<TellerEnrollment[]>('/enrollments', accessToken)
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

