// Pastel color palette for expense categories (light colors)
const PASTEL_LIGHT = [
  '#FDE2E4', // pastel pink
  '#E2F0CB', // pastel green
  '#CDE7F0', // pastel blue
  '#FFF1BA', // pastel yellow
  '#EAD7F7', // pastel purple
  '#F9D5E5', // light rose
  '#D8E2DC', // soft gray-blue
  '#FFE5D9', // peach
  '#E2ECE9', // teal-ish
  '#F6DFEB', // blush
  '#D7E3FC', // periwinkle
  '#F0E6FF', // lavender
  '#FFE4E1', // misty rose
  '#E0F2F1', // mint
  '#FFF8DC', // cornsilk
  '#F5F5DC', // beige
  '#E6E6FA', // lavender
  '#FFEFD5', // papaya whip
  '#F0FFF0', // honeydew
  '#FDF5E6', // old lace
]

// Darker, more saturated colors
const PASTEL_DARK = [
  '#D4A5A9', // darker pink
  '#B8D4A0', // darker green
  '#A5C4D9', // darker blue
  '#E6D48A', // darker yellow
  '#C9B0D9', // darker purple
  '#D9B5C5', // darker rose
  '#B0C0B8', // darker gray-blue
  '#E6C4B5', // darker peach
  '#B8D0C9', // darker teal
  '#D9BFC9', // darker blush
  '#B3C7E6', // darker periwinkle
  '#C9B0E6', // darker lavender
  '#E6C0BD', // darker misty rose
  '#B8D9D4', // darker mint
  '#E6E0B8', // darker cornsilk
  '#D9D9B8', // darker beige
  '#C9C9E6', // darker lavender
  '#E6D9B0', // darker papaya whip
  '#C9E6C9', // darker honeydew
  '#E6D9C9', // darker old lace
]

// Combined palette: alternate between light and dark
export const PASTEL_PALETTE = [
  ...PASTEL_LIGHT,
  ...PASTEL_DARK,
]

// Get next available color from palette for a user
export function getNextAvailableColor(
  usedColors: string[],
  palette: string[] = PASTEL_PALETTE
): string {
  // Normalize used colors (handle case sensitivity)
  const normalizedUsed = usedColors.map((c) => c?.toUpperCase().trim()).filter(Boolean)
  
  // Filter out used colors (case-insensitive)
  const available = palette.filter(
    (color) => !normalizedUsed.includes(color.toUpperCase().trim())
  )
  
  // If all colors are used, cycle through and find least used
  if (available.length === 0) {
    // Count usage of each color
    const colorCounts: Record<string, number> = {}
    usedColors.forEach((color) => {
      const normalized = color?.toUpperCase().trim()
      if (normalized) {
        colorCounts[normalized] = (colorCounts[normalized] || 0) + 1
      }
    })
    
    // Find the least used color
    let leastUsed = palette[0]
    let minCount = Infinity
    palette.forEach((color) => {
      const normalized = color.toUpperCase().trim()
      const count = colorCounts[normalized] || 0
      if (count < minCount) {
        minCount = count
        leastUsed = color
      }
    })
    
    return leastUsed
  }
  
  // Return first available color
  return available[0]
}

// Get a light tint of a color for row backgrounds
export function getLightTint(hex: string, opacity: number = 0.1): string {
  // Convert hex to RGB
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

