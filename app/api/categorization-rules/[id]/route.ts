import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const {
      pattern,
      matchType,
      categoryId,
      incomeSourceId,
      appliesTo,
    } = body

    const id = params.id

    if (!id) {
      return NextResponse.json(
        { error: 'Rule ID is required' },
        { status: 400 }
      )
    }

    // Get the existing rule to check the category
    const existingRule = await prisma.categorizationRule.findUnique({
      where: { id },
      include: {
        category: true,
        incomeSource: true,
      },
    })

    if (!existingRule) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
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

    // Validate matchType if provided
    if (matchType && !['exact', 'contains', 'regex'].includes(matchType)) {
      return NextResponse.json(
        { error: 'matchType must be "exact", "contains", or "regex"' },
        { status: 400 }
      )
    }

    // Validate regex pattern if matchType is regex
    if (matchType === 'regex' && pattern) {
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
    if (pattern) {
      const hasNumericId = /\d{6,}/.test(pattern) // 6+ consecutive digits likely an ID
      const hasUUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(pattern)
      
      if (hasNumericId || hasUUID) {
        return NextResponse.json(
          { error: 'Pattern should not include transaction IDs or long numeric sequences. Use text-based patterns instead (e.g., "UBER", "STARBUCKS", "AMAZON").' },
          { status: 400 }
        )
      }
    }

    // Prepare update data - ensure proper null handling
    const updateData: any = {}
    if (pattern !== undefined) updateData.pattern = pattern
    if (matchType !== undefined) updateData.matchType = matchType
    if (appliesTo !== undefined) updateData.appliesTo = appliesTo
    
    // Handle categoryId and incomeSourceId based on appliesTo
    if (appliesTo === 'expense' || appliesTo === 'both') {
      updateData.categoryId = categoryId || null
      if (appliesTo === 'expense') {
        updateData.incomeSourceId = null
      }
    }
    if (appliesTo === 'income' || appliesTo === 'both') {
      updateData.incomeSourceId = incomeSourceId || null
      if (appliesTo === 'income') {
        updateData.categoryId = null
      }
    }
    
    // If appliesTo is not being updated, handle categoryId/incomeSourceId separately
    if (appliesTo === undefined) {
      if (categoryId !== undefined) updateData.categoryId = categoryId || null
      if (incomeSourceId !== undefined) updateData.incomeSourceId = incomeSourceId || null
    }

    // Update the rule
    const updatedRule = await prisma.categorizationRule.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json(updatedRule)
  } catch (error: any) {
    console.error('Error updating categorization rule:', error)
    return NextResponse.json(
      { error: 'Failed to update categorization rule', message: error.message },
      { status: 500 }
    )
  }
}

