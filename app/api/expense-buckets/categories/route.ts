import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// Add category to bucket
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { bucketId, categoryId } = body

    if (!bucketId || !categoryId) {
      return NextResponse.json(
        { error: 'bucketId and categoryId are required' },
        { status: 400 }
      )
    }

    // Check if already exists
    const existing = await prisma.expenseBucketCategory.findUnique({
      where: {
        bucketId_expenseCategoryId: {
          bucketId,
          expenseCategoryId: categoryId,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Category already in this bucket' },
        { status: 409 }
      )
    }

    const bucketCategory = await prisma.expenseBucketCategory.create({
      data: {
        bucketId,
        expenseCategoryId: categoryId,
      },
      include: {
        expenseCategory: {
          select: {
            id: true,
            name: true,
            type: true,
            colorHex: true,
          },
        },
      },
    })

    return NextResponse.json(bucketCategory, { status: 201 })
  } catch (error: any) {
    console.error('Error adding category to bucket:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Category already in this bucket' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to add category to bucket' },
      { status: 500 }
    )
  }
}

// Remove category from bucket
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const bucketId = searchParams.get('bucketId')
    const categoryId = searchParams.get('categoryId')

    if (!bucketId || !categoryId) {
      return NextResponse.json(
        { error: 'bucketId and categoryId are required' },
        { status: 400 }
      )
    }

    await prisma.expenseBucketCategory.delete({
      where: {
        bucketId_expenseCategoryId: {
          bucketId,
          expenseCategoryId: categoryId,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing category from bucket:', error)
    return NextResponse.json(
      { error: 'Failed to remove category from bucket' },
      { status: 500 }
    )
  }
}

