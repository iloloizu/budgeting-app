import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { suggestCategory } from '@/lib/ai-categorization'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, merchantName, description, amount } = body

    if (!userId || !merchantName) {
      return NextResponse.json(
        { error: 'userId and merchantName are required' },
        { status: 400 }
      )
    }

    // Get existing categories for the user
    const categories = await prisma.expenseCategory.findMany({
      where: { userId },
      select: { name: true },
    })

    const categoryNames = categories.map((c) => c.name)

    // Get AI suggestion
    const suggestion = await suggestCategory(
      merchantName,
      description || '',
      amount || 0,
      categoryNames
    )

    if (!suggestion) {
      return NextResponse.json(
        { error: 'AI categorization not available. Please set ANTHROPIC_API_KEY.' },
        { status: 503 }
      )
    }

    return NextResponse.json(suggestion)
  } catch (error: any) {
    console.error('Error getting category suggestion:', error)
    return NextResponse.json(
      { error: 'Failed to get category suggestion', message: error.message },
      { status: 500 }
    )
  }
}

