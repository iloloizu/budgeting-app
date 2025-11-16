import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const { colorHex } = await request.json()

    if (!id || !colorHex) {
      return NextResponse.json(
        { error: 'id and colorHex are required' },
        { status: 400 }
      )
    }

    const category = await prisma.expenseCategory.update({
      where: { id },
      data: { colorHex },
    })

    return NextResponse.json(category)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update category' },
      { status: 500 }
    )
  }
}
