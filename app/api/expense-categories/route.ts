import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PASTEL_PALETTE, getNextAvailableColor } from '@/constants/colors'

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

    const categories = await prisma.expenseCategory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(categories)
  } catch (error) {
    console.error('Error fetching expense categories:', error)
    return NextResponse.json(
      { error: 'Failed to fetch expense categories' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  let categoryName = 'this name' // Store name for error handling
  
  try {
    const body = await request.json()
    const { userId, name, type } = body
    categoryName = name || 'this name' // Store for error handling

    if (!userId || !name || !type) {
      return NextResponse.json(
        { error: 'userId, name, and type are required' },
        { status: 400 }
      )
    }

    // Check for duplicate category name (case-insensitive)
    const existingCategory = await prisma.expenseCategory.findFirst({
      where: {
        userId,
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    })

    if (existingCategory) {
      return NextResponse.json(
        { error: `A category with the name "${name}" already exists` },
        { status: 409 }
      )
    }

    // Get used colors for this user to assign a unique one
    const allUserCategories = await prisma.expenseCategory.findMany({
      where: { userId },
      select: { colorHex: true },
    })
    const usedColors = allUserCategories
      .map((c) => c.colorHex)
      .filter((c): c is string => c !== null && c !== undefined)
    const nextColor = getNextAvailableColor(usedColors)

    const category = await prisma.expenseCategory.create({
      data: {
        userId,
        name,
        type,
        colorHex: nextColor,
      },
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error: any) {
    console.error('Error creating expense category:', error)
    
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: `A category with the name "${categoryName}" already exists` },
        { status: 409 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to create expense category', message: error.message },
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

    // Check if category is "Uncategorized" or "N/A" - don't allow deletion
    const category = await prisma.expenseCategory.findUnique({
      where: { id },
      select: { name: true },
    })

    if (category && (category.name.toLowerCase() === 'uncategorized' || category.name.toLowerCase() === 'n/a')) {
      return NextResponse.json(
        { error: 'Cannot delete "Uncategorized" or "N/A" categories' },
        { status: 400 }
      )
    }

    // Delete the category - cascading deletes will handle related rules and transactions
    await prisma.expenseCategory.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting expense category:', error)
    
    // Handle foreign key constraint errors
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: 'Cannot delete category: it is still being used by transactions or budgets. Please reassign them first.' },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to delete expense category', message: error.message },
      { status: 500 }
    )
  }
}

