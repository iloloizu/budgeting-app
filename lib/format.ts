// Helper function to format monetary values to 2 decimal places with commas
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '0.00'
  }
  const rounded = Math.round(amount * 100) / 100
  return rounded.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// Helper function to round monetary values to 2 decimal places
export function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100
}

