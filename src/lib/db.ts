import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

function createMockClient(): PrismaClient {
  const genId = () => `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

  type Store = Record<string, any[]>
  const gThis = globalThis as any

  if (!gThis.__devStore) {
    gThis.__devStore = {
      taskCategory: [
        { id: 'cat-gen',   name: 'Général',        color: '#6366f1', options: [], order: 0, createdAt: new Date(), updatedAt: new Date() },
        { id: 'cat-prod',  name: 'Production',      color: '#f59e0b', options: ['Tournage','Montage','Révision','Livré'], order: 1, createdAt: new Date(), updatedAt: new Date() },
        { id: 'cat-admin', name: 'Administratif',   color: '#10b981', options: ['Devis envoyé','Contrat signé','Archivé'], order: 2, createdAt: new Date(), updatedAt: new Date() },
        { id: 'cat-client',name: 'Client',          color: '#3b82f6', options: [], order: 3, createdAt: new Date(), updatedAt: new Date() },
      ],
      userDailyCheckin: [],
      signedContract: [],
    } as Store
  }
  const store: Store = gThis.__devStore

  const emptyAggregate = {
    _sum: { amount: null, totalTTC: null, totalHT: null, monthlyAmount: null },
    _count: 0, _avg: null, _min: null, _max: null,
  }

  // ── Where clause evaluator ─────────────────────────────────────────────────
  function matchWhere(item: any, where: Record<string, unknown>): boolean {
    return Object.entries(where).every(([k, v]) => {
      if (k === 'AND') return (v as any[]).every(sub =>
        sub && typeof sub === 'object' && Object.keys(sub).length > 0
          ? matchWhere(item, sub as Record<string, unknown>) : true)
      if (k === 'OR') return (v as any[]).some(sub =>
        sub && typeof sub === 'object' && Object.keys(sub).length > 0
          ? matchWhere(item, sub as Record<string, unknown>) : false)
      if (k === 'NOT') return !matchWhere(item, v as Record<string, unknown>)
      if (v === null || v === undefined) return item[k] == null
      if (typeof v === 'object' && !Array.isArray(v)) {
        const ops = v as Record<string, unknown>
        if ('not' in ops) return ops.not === null ? item[k] != null : item[k] !== ops.not
        if ('in' in ops) return Array.isArray(ops.in) && (ops.in as any[]).includes(item[k])
        if ('notIn' in ops) return Array.isArray(ops.notIn) && !(ops.notIn as any[]).includes(item[k])
        if ('contains' in ops) {
          const str = String(item[k] ?? '')
          const search = String(ops.contains ?? '')
          return ops.mode === 'insensitive'
            ? str.toLowerCase().includes(search.toLowerCase())
            : str.includes(search)
        }
        if ('startsWith' in ops) return String(item[k] ?? '').startsWith(String(ops.startsWith ?? ''))
        if ('endsWith' in ops) return String(item[k] ?? '').endsWith(String(ops.endsWith ?? ''))
        if ('gte' in ops) return item[k] >= (ops.gte as any)
        if ('lte' in ops) return item[k] <= (ops.lte as any)
        if ('gt' in ops) return item[k] > (ops.gt as any)
        if ('lt' in ops) return item[k] < (ops.lt as any)
        return item[k] === v
      }
      return item[k] === v
    })
  }

  // ── Relation metadata ──────────────────────────────────────────────────────
  // many:true  → child has fk pointing to parent (hasMany)
  // many:false → item has fk pointing to related record (belongsTo)
  const REL: Record<string, { model: string; fk: string; many: boolean }> = {
    // client → has many
    projects:        { model: 'project',           fk: 'clientId',   many: true  },
    invoices:        { model: 'invoice',            fk: 'clientId',   many: true  },
    retainers:       { model: 'clientRetainer',     fk: 'clientId',   many: true  },
    interactions:    { model: 'clientInteraction',  fk: 'clientId',   many: true  },
    quotes:          { model: 'quote',              fk: 'clientId',   many: true  },
    socialKpis:      { model: 'socialKpi',          fk: 'clientId',   many: true  },
    clientNotes:     { model: 'clientNote',         fk: 'clientId',   many: true  },
    // project → has many
    deliverables:    { model: 'deliverable',        fk: 'projectId',  many: true  },
    members:         { model: 'projectMember',      fk: 'projectId',  many: true  },
    tasks:           { model: 'task',               fk: 'projectId',  many: true  },
    comments:        { model: 'projectComment',     fk: 'projectId',  many: true  },
    onboardingSteps: { model: 'onboardingStep',     fk: 'projectId',  many: true  },
    // invoice → has many
    payments:        { model: 'payment',            fk: 'invoiceId',  many: true  },
    lines:           { model: 'invoiceLine',        fk: 'invoiceId',  many: true  },
    // belongs-to (item has fk)
    client:          { model: 'client',             fk: 'clientId',   many: false },
    project:         { model: 'project',            fk: 'projectId',  many: false },
    quote:           { model: 'quote',              fk: 'quoteId',    many: false },
    category:        { model: 'taskCategory',       fk: 'categoryId', many: false },
    user:            { model: 'user',               fk: 'userId',     many: false },
    author:          { model: 'user',               fk: 'authorId',   many: false },
    assignedTo:      { model: 'user',               fk: 'assignedToId', many: false },
    createdBy:       { model: 'user',               fk: 'createdById',  many: false },
  }

  // ── Include/Select resolver ────────────────────────────────────────────────
  async function applyArg(item: any, a: any): Promise<any> {
    if (!item || !a) return item
    const { include, select } = a as { include?: Record<string, any>; select?: Record<string, any> }
    if (!include && !select) return item

    let result = { ...item }

    if (include) {
      for (const [rel, val] of Object.entries(include)) {
        if (!val) continue

        // Handle _count aggregation
        if (rel === '_count') {
          result._count = result._count || {}
          const countSel: Record<string, any> =
            typeof val === 'object' && val !== true ? (val as any).select ?? val : {}
          for (const [cr, sv] of Object.entries(countSel)) {
            if (!sv) continue
            const meta = REL[cr]
            if (meta?.many) {
              result._count[cr] = (store[meta.model] ?? [])
                .filter((x: any) => x[meta.fk] === item.id).length
            }
          }
          continue
        }

        const meta = REL[rel]
        if (!meta) continue

        const subA: any = typeof val === 'object' && val !== true ? val : {}

        if (!meta.many) {
          // belongs-to: find single related record by FK on this item
          const fkVal = item[meta.fk]
          if (fkVal == null) { result[rel] = null; continue }
          const found = (store[meta.model] ?? []).find((x: any) => x.id === fkVal) ?? null
          if (!found) { result[rel] = null; continue }
          const resolved = subA.include || subA.select
            ? await applyArg(found, { include: subA.include, select: subA.select })
            : found
          result[rel] = resolved
        } else {
          // has-many: find all related records with matching FK
          let relItems = (store[meta.model] ?? []).filter((x: any) => x[meta.fk] === item.id)
          if (subA.where) relItems = relItems.filter((x: any) => matchWhere(x, subA.where))
          if (subA.orderBy) {
            const orders = Array.isArray(subA.orderBy) ? subA.orderBy : [subA.orderBy]
            relItems.sort((a: any, b: any) => {
              for (const ob of orders) {
                if (!ob || typeof ob !== 'object') continue
                const [[f, d]] = Object.entries(ob as Record<string, string>)
                const av = a[f], bv = b[f]
                if (av == null && bv == null) continue
                if (av == null) return 1
                if (bv == null) return -1
                if (av < bv) return d === 'desc' ? 1 : -1
                if (av > bv) return d === 'desc' ? -1 : 1
              }
              return 0
            })
          }
          if (subA.skip) relItems = relItems.slice(subA.skip)
          if (subA.take) relItems = relItems.slice(0, subA.take)
          if (subA.include || subA.select) {
            relItems = await Promise.all(
              relItems.map((x: any) => applyArg(x, { include: subA.include, select: subA.select }))
            )
          }
          result[rel] = relItems
        }
      }
    }

    // Apply top-level select (pick only specified fields)
    if (select && !include) {
      const sel: any = {}
      for (const [k, v] of Object.entries(select)) {
        if (v === true) sel[k] = result[k]
        // nested select not fully supported but handle common pattern
      }
      return sel
    }

    return result
  }

  // ── Sort helper ────────────────────────────────────────────────────────────
  function applySort(items: any[], orderBy: any): any[] {
    if (!orderBy) return items
    const orders = Array.isArray(orderBy) ? orderBy : [orderBy]
    return [...items].sort((a, b) => {
      for (const ob of orders) {
        if (!ob || typeof ob !== 'object') continue
        const [[f, d]] = Object.entries(ob as Record<string, string>)
        const av = a[f], bv = b[f]
        if (av == null && bv == null) continue
        if (av == null) return 1
        if (bv == null) return -1
        if (av < bv) return d === 'desc' ? 1 : -1
        if (av > bv) return d === 'desc' ? -1 : 1
      }
      return 0
    })
  }

  const makeModel = (modelName: string) => {
    const getItems = () => store[modelName] ?? (store[modelName] = [])
    return {
      findMany: async (a?: any) => {
        let items = [...getItems()]
        if (a?.where && typeof a.where === 'object') {
          items = items.filter((x: any) => matchWhere(x, a.where as Record<string, unknown>))
        }
        items = applySort(items, a?.orderBy)
        if (a?.skip) items = items.slice(a.skip)
        if (a?.take) items = items.slice(0, a.take)
        if (a?.include || a?.select) {
          items = await Promise.all(items.map((x: any) => applyArg(x, a)))
        }
        return items
      },

      findFirst: async (a?: any) => {
        const items = getItems()
        let found: any = null
        if (!a?.where) {
          found = items[0] ?? null
        } else {
          found = items.find((x: any) => matchWhere(x, a.where as Record<string, unknown>)) ?? null
        }
        if (!found) return null
        return applyArg(found, a)
      },

      findUnique: async (a: any) => {
        const items = getItems()
        if (!a?.where) return items[0] ?? null
        const entries = Object.entries(a.where as Record<string, unknown>)
        if (entries.length === 0) return items[0] ?? null
        const [key, val] = entries[0]
        let found: any = null
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          const subEntries = Object.entries(val as Record<string, unknown>)
          found = items.find((x: any) => subEntries.every(([sk, sv]) => x[sk] === sv)) ?? null
        } else {
          found = items.find((x: any) => x[key] === val) ?? null
        }
        if (!found) return null
        return applyArg(found, a)
      },

      count: async (a?: any) => {
        const items = getItems()
        if (a?.where) return items.filter((x: any) => matchWhere(x, a.where)).length
        return items.length
      },

      aggregate: async () => emptyAggregate,
      groupBy: async () => [],

      create: async (a: any) => {
        const data = { ...(a?.data ?? {}) }

        // Handle nested creates (e.g. lines: { create: [...] }, payments: { create: [...] })
        const nestedCreates: Array<{ rel: string; items: any[] }> = []
        for (const [key, val] of Object.entries(data)) {
          if (val && typeof val === 'object' && !Array.isArray(val) && 'create' in (val as any)) {
            const nested = (val as any).create
            nestedCreates.push({ rel: key, items: Array.isArray(nested) ? nested : [nested] })
            delete data[key]
          }
        }

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
          members: [],
          tasks: [],
          deliverables: [],
          comments: [],
          payments: [],
          lines: [],
          ...data,
        }
        getItems().push(newItem)

        // Process nested creates
        for (const { rel, items } of nestedCreates) {
          const meta = REL[rel]
          if (meta?.many) {
            const relStore = store[meta.model] ?? (store[meta.model] = [])
            for (const item of items) {
              const child = {
                id: genId(),
                createdAt: new Date(),
                updatedAt: new Date(),
                [meta.fk]: newItem.id,
                ...item,
              }
              relStore.push(child)
            }
          }
        }

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
        let existing: any = null
        if (a?.where) {
          const entries = Object.entries(a.where as Record<string, unknown>)
          for (const [key, val] of entries) {
            if (val && typeof val === 'object' && !Array.isArray(val)) {
              const subEntries = Object.entries(val as Record<string, unknown>)
              existing = items.find((x: any) => subEntries.every(([sk, sv]) => x[sk] === sv)) ?? null
            } else {
              existing = items.find((x: any) => x[key] === val) ?? null
            }
            if (existing) break
          }
        }
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
