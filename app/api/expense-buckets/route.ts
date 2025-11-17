import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PASTEL_PALETTE, getNextAvailableColor } from '@/constants/colors'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const year = searchParams.get('year')
    const month = searchParams.get('month')

    if (!userId || !year || !month) {
      return NextResponse.json(
        { error: 'userId, year, and month are required' },
        { status: 400 }
      )
    }

    const buckets = await prisma.expenseBucket.findMany({
      where: {
        userId,
        year: parseInt(year),
        month: parseInt(month),
      },
      include: {
        bucketCategories: {
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
        },
      },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json(buckets)
  } catch (error) {
    console.error('Error fetching expense buckets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch expense buckets' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, name, year, month, colorHex, percentage, order } = body

    if (!userId || !name || !year || !month) {
      return NextResponse.json(
        { error: 'userId, name, year, and month are required' },
        { status: 400 }
      )
    }

    // Check if the model exists (defensive check)
    if (!prisma.expenseBucket) {
      console.error('Prisma client missing expenseBucket model. Please restart the dev server.')
      return NextResponse.json(
        { 
          error: 'Database model not available. Please restart the development server.',
          message: 'The ExpenseBucket model is not available in the Prisma client. This usually means the server needs to be restarted after schema changes.'
        },
        { status: 500 }
      )
    }

    // Get used colors for this user to assign a unique one
    const allUserBuckets = await prisma.expenseBucket.findMany({
      where: { userId, year: parseInt(year), month: parseInt(month) },
      select: { colorHex: true },
    })
    const usedColors = allUserBuckets
      .map((b) => b.colorHex)
      .filter((c): c is string => c !== null && c !== undefined)
    const nextColor = colorHex || getNextAvailableColor(usedColors)

    // Get max order if not provided
    let bucketOrder = order
    if (bucketOrder === undefined) {
      const maxOrder = await prisma.expenseBucket.findFirst({
        where: { userId, year: parseInt(year), month: parseInt(month) },
        orderBy: { order: 'desc' },
        select: { order: true },
      })
      bucketOrder = (maxOrder?.order ?? -1) + 1
    }

    const bucket = await prisma.expenseBucket.create({
      data: {
        userId,
        name,
        year: parseInt(year),
        month: parseInt(month),
        colorHex: nextColor,
        percentage: percentage ?? 0,
        order: bucketOrder,
      },
      include: {
        bucketCategories: {
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
        },
      },
    })

    return NextResponse.json(bucket, { status: 201 })
  } catch (error: any) {
    console.error('Error creating expense bucket:', error)
    console.error('Error details:', JSON.stringify(error, null, 2))
    
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'A bucket with this name already exists for this month' },
        { status: 409 }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to create expense bucket',
        message: error?.message || 'Unknown error',
        details: error?.meta || null
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, colorHex, percentage, order } = body

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (colorHex !== undefined) updateData.colorHex = colorHex
    if (percentage !== undefined) updateData.percentage = percentage
    if (order !== undefined) updateData.order = order

    const bucket = await prisma.expenseBucket.update({
      where: { id },
      data: updateData,
      include: {
        bucketCategories: {
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
        },
      },
    })

    return NextResponse.json(bucket)
  } catch (error) {
    console.error('Error updating expense bucket:', error)
    return NextResponse.json(
      { error: 'Failed to update expense bucket' },
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

    await prisma.expenseBucket.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting expense bucket:', error)
    return NextResponse.json(
      { error: 'Failed to delete expense bucket' },
      { status: 500 }
    )
  }
}

