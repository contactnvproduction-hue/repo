import { PrismaClient } from '@prisma/client'

// Prisma v7: supports both prisma+postgres:// (local/Accelerate) and postgresql:// (direct PrismaPg)
function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL || ''

  // prisma+postgres:// → Prisma Postgres local dev server or Accelerate
  if (connectionString.startsWith('prisma+postgres://') || connectionString.startsWith('prisma://')) {
    const { withAccelerate } = require('@prisma/extension-accelerate')
    return new PrismaClient().$extends(withAccelerate()) as unknown as PrismaClient
  }

  // postgresql:// or postgres:// → direct connection via PrismaPg adapter (production/Render)
  if (connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://')) {
    const { PrismaPg } = require('@prisma/adapter-pg')
    const adapter = new PrismaPg({ connectionString })
    return new PrismaClient({ adapter })
  }

  // Fallback (build time without DATABASE_URL)
  console.warn('[Prisma] DATABASE_URL not set or unrecognized format')
  const { PrismaPg } = require('@prisma/adapter-pg')
  const adapter = new PrismaPg({ connectionString: '' })
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
