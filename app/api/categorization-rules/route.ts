import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// Type assertion to help TypeScript recognize the model
// The Prisma client has been regenerated and includes categorizationRule
// This assertion is needed until the IDE's TypeScript server refreshes
const typedPrisma = prisma as any

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

    const rules = await typedPrisma.categorizationRule.findMany({
      where: { userId },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            type: true,
            colorHex: true,
          },
        },
        incomeSource: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json(rules)
  } catch (error) {
    console.error('Error fetching categorization rules:', error)
    return NextResponse.json(
      { error: 'Failed to fetch categorization rules' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      userId,
      pattern,
      matchType = 'contains',
      categoryId,
      incomeSourceId,
      appliesTo,
    } = body

    if (!userId || !pattern) {
      return NextResponse.json(
        { error: 'userId and pattern are required' },
        { status: 400 }
      )
    }

    // Validate that we have the required category/source based on appliesTo
    let finalAppliesTo = appliesTo
    if (!finalAppliesTo) {
      // Auto-detect appliesTo if not provided
      finalAppliesTo = categoryId ? 'expense' : incomeSourceId ? 'income' : 'both'
    }
    
    if (finalAppliesTo === 'expense' && !categoryId) {
      return NextResponse.json(
        { error: 'categoryId is required for expense rules' },
        { status: 400 }
      )
    }
    
    if (finalAppliesTo === 'income' && !incomeSourceId) {
      return NextResponse.json(
        { error: 'incomeSourceId is required for income rules' },
        { status: 400 }
      )
    }
    
    if (finalAppliesTo === 'both' && !categoryId && !incomeSourceId) {
      return NextResponse.json(
        { error: 'Either categoryId or incomeSourceId (or both) is required for "both" rules' },
        { status: 400 }
      )
    }
    
    if (!categoryId && !incomeSourceId) {
      return NextResponse.json(
        { error: 'Either categoryId or incomeSourceId is required' },
        { status: 400 }
      )
    }

    // Validate that category is not "Uncategorized" or "N/A"
    if (categoryId) {
      const category = await prisma.expenseCategory.findUnique({
        where: { id: categoryId },
        select: { name: true },
      })

      if (category && (category.name.toLowerCase() === 'uncategorized' || category.name.toLowerCase() === 'n/a')) {
        return NextResponse.json(
          { error: 'Rules cannot use "Uncategorized" or "N/A" categories. Please select a specific category.' },
          { status: 400 }
        )
      }
    }

    // Validate matchType
    if (!['exact', 'contains', 'regex'].includes(matchType)) {
      return NextResponse.json(
        { error: 'matchType must be "exact", "contains", or "regex"' },
        { status: 400 }
      )
    }

    // Validate regex pattern if matchType is regex
    if (matchType === 'regex') {
      try {
        new RegExp(pattern)
      } catch (error) {
        return NextResponse.json(
          { error: 'Invalid regex pattern' },
          { status: 400 }
        )
      }
    }

    // Validate pattern doesn't contain numeric IDs or transaction-specific numbers
    // Check for patterns that look like IDs (long numeric strings, UUIDs, etc.)
    const hasNumericId = /\d{6,}/.test(pattern) // 6+ consecutive digits likely an ID
    const hasUUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(pattern)
    
    if (hasNumericId || hasUUID) {
      return NextResponse.json(
        { error: 'Pattern should not include transaction IDs or long numeric sequences. Use text-based patterns instead (e.g., "UBER", "STARBUCKS", "AMAZON").' },
        { status: 400 }
      )
    }

    const rule = await typedPrisma.categorizationRule.create({
      data: {
        userId,
        pattern,
        matchType,
        categoryId: categoryId || null,
        incomeSourceId: incomeSourceId || null,
        appliesTo: finalAppliesTo,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            type: true,
            colorHex: true,
          },
        },
        incomeSource: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    })

    return NextResponse.json(rule, { status: 201 })
  } catch (error: any) {
    console.error('Error creating categorization rule:', error)
    return NextResponse.json(
      { error: 'Failed to create categorization rule', message: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    await typedPrisma.categorizationRule.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting categorization rule:', error)
    return NextResponse.json(
      { error: 'Failed to delete categorization rule' },
      { status: 500 }
    )
  }
}

