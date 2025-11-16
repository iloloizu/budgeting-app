import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

    const rules = await prisma.categorizationRule.findMany({
      where: { userId },
      include: {
        category: true,
        incomeSource: true,
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

    await prisma.categorizationRule.delete({
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

