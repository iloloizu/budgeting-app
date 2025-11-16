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
  try {
    const body = await request.json()
    const { userId, name, type } = body

    if (!userId || !name || !type) {
      return NextResponse.json(
        { error: 'userId, name, and type are required' },
        { status: 400 }
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
  } catch (error) {
    console.error('Error creating expense category:', error)
    return NextResponse.json(
      { error: 'Failed to create expense category' },
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

    await prisma.expenseCategory.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting expense category:', error)
    return NextResponse.json(
      { error: 'Failed to delete expense category' },
      { status: 500 }
    )
  }
}

