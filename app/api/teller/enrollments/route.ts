import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export const runtime = 'nodejs'

// Verify Teller enrollment signatures (optional but recommended for security)
function verifyTellerSignatures(
  nonce: string,
  accessToken: string,
  userId: string,
  enrollmentId: string,
  environment: string,
  signatures: string[]
): boolean {
  const signingKey = process.env.TELLER_TOKEN_SIGNING_KEY
  
  // If no signing key is configured, skip verification (not recommended for production)
  if (!signingKey) {
    console.warn('Teller token signing key not configured. Skipping signature verification.')
    return true
  }
  
  if (!signatures || signatures.length === 0) {
    console.warn('No signatures provided in enrollment data.')
    return false
  }
  
  try {
    // Create the message that was signed: nonce + accessToken + userId + enrollmentId + environment
    const message = `${nonce}${accessToken}${userId}${enrollmentId}${environment}`
    
    // Decode the base64 signing key
    const publicKey = Buffer.from(signingKey, 'base64')
    
    // Verify at least one signature is valid
    for (const signature of signatures) {
      try {
        const signatureBuffer = Buffer.from(signature, 'base64')
        
        // Use Node.js crypto to verify ED25519 signature
        const verify = crypto.createVerify('SHA256')
        verify.update(message)
        verify.end()
        
        // ED25519 verification
        const isValid = crypto.verify(
          null,
          Buffer.from(message),
          publicKey,
          signatureBuffer
        )
        
        if (isValid) {
          return true
        }
      } catch (err) {
        console.error('Error verifying signature:', err)
        continue
      }
    }
    
    return false
  } catch (error) {
    console.error('Error in signature verification:', error)
    return false
  }
}

// Store enrollment with access token
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      userId, 
      enrollmentId, 
      accessToken, 
      institutionId, 
      institutionName, 
      status,
      nonce,
      signatures 
    } = body

    if (!userId || !enrollmentId || !accessToken) {
      return NextResponse.json(
        { error: 'userId, enrollmentId, and accessToken are required' },
        { status: 400 }
      )
    }
    
    // Verify signatures if provided (optional but recommended for production)
    if (nonce && signatures && signatures.length > 0) {
      const environment = process.env.NEXT_PUBLIC_TELLER_ENVIRONMENT || 'sandbox'
      const signingKey = process.env.TELLER_TOKEN_SIGNING_KEY
      
      if (signingKey) {
        const isValid = verifyTellerSignatures(
          nonce,
          accessToken,
          userId,
          enrollmentId,
          environment,
          signatures
        )
        
        if (!isValid) {
          console.error('Signature verification failed for enrollment:', enrollmentId)
          return NextResponse.json(
            { error: 'Invalid enrollment signatures. Enrollment data may have been tampered with.' },
            { status: 400 }
          )
        }
        console.log('Signature verification passed for enrollment:', enrollmentId)
      } else {
        console.warn('Teller token signing key not configured. Skipping signature verification (not recommended for production).')
      }
    }

    // Store enrollment with access token
    // Note: In production, you should encrypt the accessToken before storing
    
    // Check if Prisma client has the model (for debugging)
    if (!('tellerEnrollment' in prisma)) {
      console.error('Prisma client does not have tellerEnrollment model. Please restart your dev server.')
      return NextResponse.json(
        { error: 'Database model not available. Please restart your dev server.' },
        { status: 500 }
      )
    }
    
    const enrollment = await (prisma as any).tellerEnrollment.upsert({
      where: {
        userId_enrollmentId: {
          userId,
          enrollmentId,
        },
      },
      update: {
        accessToken,
        institutionId: institutionId || '',
        institutionName: institutionName || '',
        status: status || 'active',
        isActive: true,
      },
      create: {
        userId,
        enrollmentId,
        accessToken,
        institutionId: institutionId || '',
        institutionName: institutionName || '',
        status: status || 'active',
      },
    })

    return NextResponse.json({ id: enrollment.id, enrollmentId: enrollment.enrollmentId }, { status: 201 })
  } catch (error: any) {
    console.error('Error storing enrollment:', error)
    console.error('Error stack:', error.stack)
    
    // Provide more helpful error messages
    let errorMessage = error.message || 'Unknown error'
    if (error.message?.includes('tellerEnrollment') || error.message?.includes('findMany')) {
      errorMessage = 'Database model not available. Please restart your dev server to load the updated Prisma client.'
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to store enrollment', 
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

// Get enrollments for a user
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

    const enrollments = await (prisma as any).tellerEnrollment.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        enrollmentId: true,
        institutionId: true,
        institutionName: true,
        status: true,
        createdAt: true,
        // Don't return accessToken for security
      },
    })

    return NextResponse.json(enrollments)
  } catch (error: any) {
    console.error('Error fetching enrollments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch enrollments', message: error.message },
      { status: 500 }
    )
  }
}

