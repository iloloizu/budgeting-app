import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Create or get Prisma client
// In development, always create a fresh instance to ensure we have the latest models
// This helps when Prisma client is regenerated without a full server restart
let prisma: PrismaClient

if (process.env.NODE_ENV !== 'production') {
  // Disconnect existing client if it exists
  if (globalForPrisma.prisma) {
    globalForPrisma.prisma.$disconnect().catch(() => {})
  }
  // Always create a new instance in development
  prisma = new PrismaClient({
    log: ['error', 'warn'],
  })
  globalForPrisma.prisma = prisma
} else {
  // In production, reuse the global instance
  // For serverless environments (like Netlify), we need to handle connections carefully
  prisma = globalForPrisma.prisma ?? new PrismaClient({
    log: ['error', 'warn'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = prisma
  }
}

export { prisma }

