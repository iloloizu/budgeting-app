import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PASTEL_PALETTE, getNextAvailableColor } from '@/constants/colors'

export const runtime = 'nodejs'

// Preset categories that should be available for all users
const PRESET_CATEGORIES = [
  { name: 'Bills', type: 'fixed' as const },
  { name: 'Dining & Drinks', type: 'variable' as const },
  { name: 'Auto & Transport', type: 'variable' as const },
]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    // Get all existing categories for this user
    const existingCategories = await prisma.expenseCategory.findMany({
      where: { userId },
      select: { name: true, colorHex: true },
    })

    const existingNames = new Set(
      existingCategories.map((cat) => cat.name.toLowerCase())
    )
    const usedColors = existingCategories
      .map((c) => c.colorHex)
      .filter((c): c is string => c !== null && c !== undefined)

    const created: string[] = []
    const skipped: string[] = []

    // Create preset categories that don't exist
    for (const preset of PRESET_CATEGORIES) {
      if (existingNames.has(preset.name.toLowerCase())) {
        skipped.push(preset.name)
        continue
      }

      const nextColor = getNextAvailableColor(usedColors)
      usedColors.push(nextColor)

      await prisma.expenseCategory.create({
        data: {
          userId,
          name: preset.name,
          type: preset.type,
          colorHex: nextColor,
        },
      })

      created.push(preset.name)
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      message:
        created.length > 0
          ? `Created ${created.length} preset categor${created.length > 1 ? 'ies' : 'y'}: ${created.join(', ')}`
          : 'All preset categories already exist',
    })
  } catch (error: any) {
    console.error('Error initializing preset categories:', error)
    return NextResponse.json(
      { error: 'Failed to initialize preset categories', message: error.message },
      { status: 500 }
    )
  }
}

