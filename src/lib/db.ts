import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

function createMockClient(): PrismaClient {
  const genId = () => `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

  type Store = Record<string, any[]>
  const gThis = globalThis as any

  if (!gThis.__devStore) {
    gThis.__devStore = {
      taskCategory: [
        { id: 'cat-gen', name: 'Général', color: '#6366f1', options: [], order: 0, createdAt: new Date(), updatedAt: new Date() },
        { id: 'cat-prod', name: 'Production', color: '#f59e0b', options: ['Tournage', 'Montage', 'Révision', 'Livré'], order: 1, createdAt: new Date(), updatedAt: new Date() },
        { id: 'cat-admin', name: 'Administratif', color: '#10b981', options: ['Devis envoyé', 'Contrat signé', 'Archivé'], order: 2, createdAt: new Date(), updatedAt: new Date() },
        { id: 'cat-client', name: 'Client', color: '#3b82f6', options: [], order: 3, createdAt: new Date(), updatedAt: new Date() },
      ],
    } as Store
  }
  const store: Store = gThis.__devStore

  const emptyAggregate = {
    _sum: { amount: null, totalTTC: null, totalHT: null, monthlyAmount: null },
    _count: 0, _avg: null, _min: null, _max: null,
  }

  const makeModel = (modelName: string) => {
    const getItems = () => store[modelName] ?? (store[modelName] = [])
    return {
      findMany: async () => getItems(),
      findFirst: async () => getItems()[0] ?? null,
      findUnique: async (a: any) => getItems().find((x: any) => x.id === a?.where?.id) ?? null,
      count: async () => getItems().length,
      aggregate: async () => emptyAggregate,
      groupBy: async () => [],
      create: async (a: any) => {
        const newItem = {
          id: genId(),
          createdAt: new Date(),
          updatedAt: new Date(),
          // Relation defaults so UI doesn't crash on optional chaining
          project: null,
          client: null,
          assignedTo: null,
          createdBy: null,
          taskCategory: null,
          topics: [],
          actionSteps: [],
          retainers: [],
          ...a?.data,
        }
        getItems().push(newItem)
        return newItem
      },
      createMany: async () => ({ count: 0 }),
      update: async (a: any) => {
        const items = getItems()
        const idx = items.findIndex((x: any) => x.id === a?.where?.id)
        if (idx !== -1) {
          items[idx] = { ...items[idx], ...a?.data, updatedAt: new Date() }
          return items[idx]
        }
        return { id: a?.where?.id, updatedAt: new Date(), ...a?.data }
      },
      updateMany: async () => ({ count: 0 }),
      delete: async (a: any) => {
        const items = getItems()
        const idx = items.findIndex((x: any) => x.id === a?.where?.id)
        if (idx !== -1) items.splice(idx, 1)
        return {}
      },
      deleteMany: async () => ({ count: 0 }),
      upsert: async (a: any) => {
        const items = getItems()
        const existing = items.find((x: any) => x.id === a?.where?.id)
        if (existing) {
          Object.assign(existing, a?.update, { updatedAt: new Date() })
          return existing
        }
        const newItem = { id: genId(), createdAt: new Date(), updatedAt: new Date(), ...a?.create }
        items.push(newItem)
        return newItem
      },
    }
  }

  const proxy = new Proxy({} as PrismaClient, {
    get(_, prop: string) {
      if (prop === '$queryRaw') return async () => []
      if (prop === '$transaction') return async (fn: any) => (typeof fn === 'function' ? fn(proxy) : Promise.all(fn))
      if (prop === '$connect' || prop === '$disconnect') return async () => {}
      return makeModel(prop)
    },
  })
  return proxy
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL || ''

  if (process.env.DEV_MOCK_DB === 'true') {
    return createMockClient()
  }

  if (connectionString.startsWith('prisma+postgres://') || connectionString.startsWith('prisma://')) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { withAccelerate } = require('@prisma/extension-accelerate')
    return new PrismaClient().$extends(withAccelerate()) as unknown as PrismaClient
  }

  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
