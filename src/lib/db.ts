import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL || ''

  // prisma+postgres:// → Accelerate (local dev only)
  if (connectionString.startsWith('prisma+postgres://') || connectionString.startsWith('prisma://')) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { withAccelerate } = require('@prisma/extension-accelerate')
    return new PrismaClient().$extends(withAccelerate()) as unknown as PrismaClient
  }

  // postgresql:// or postgres:// → direct connection via PrismaPg (production/Render)
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
