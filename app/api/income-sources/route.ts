import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { roundCurrency } from '@/lib/format'

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

    const incomeSources = await prisma.incomeSource.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(incomeSources)
  } catch (error) {
    console.error('Error fetching income sources:', error)
    return NextResponse.json(
      { error: 'Failed to fetch income sources' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, name, amount, type, isActive } = body

    if (!userId || !name || amount === undefined || !type) {
      return NextResponse.json(
        { error: 'userId, name, amount, and type are required' },
        { status: 400 }
      )
    }

    const incomeSource = await prisma.incomeSource.create({
      data: {
        userId,
        name,
        amount: roundCurrency(parseFloat(amount)),
        type,
        isActive: isActive !== undefined ? isActive : true,
      },
    })

    return NextResponse.json(incomeSource, { status: 201 })
  } catch (error) {
    console.error('Error creating income source:', error)
    return NextResponse.json(
      { error: 'Failed to create income source' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, amount, type, isActive } = body

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const incomeSource = await prisma.incomeSource.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(amount !== undefined && { amount: parseFloat(amount) }),
        ...(type && { type }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json(incomeSource)
  } catch (error) {
    console.error('Error updating income source:', error)
    return NextResponse.json(
      { error: 'Failed to update income source' },
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

    await prisma.incomeSource.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting income source:', error)
    return NextResponse.json(
      { error: 'Failed to delete income source' },
      { status: 500 }
    )
  }
}

