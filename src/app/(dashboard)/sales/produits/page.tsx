import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { PieChart } from 'lucide-react'
import { RevenueByProduct } from '@/components/acquisition/RevenueByProduct'

export const dynamic = 'force-dynamic'

export default async function ProduitsPage() {
  const session = await auth()
  if (!session?.user) return null
  const dbAny = prisma as any

  try {
    const productCount = await dbAny.product.count()
    if (productCount === 0) {
      await dbAny.product.createMany({ data: [
        { name: 'Offre batch content', color: '#10b981', order: 0 },
        { name: 'Documentaire', color: '#3b82f6', order: 1 },
        { name: 'Offre montage', color: '#8b5cf6', order: 2 },
      ] })
    }
  } catch {}

  const clientProductItems: any[] = await (async () => {
    try { return await dbAny.clientProduct.findMany({ include: { product: { select: { id: true, name: true, color: true } }, client: { select: { id: true, name: true } } } }) } catch { return [] }
  })()

  const byClient: Record<string, { name: string; collected: number; tags: { productId: string; name: string; color: string }[] }> = {}
  for (const item of clientProductItems) {
    const entry = byClient[item.clientId] ??= { name: item.client.name, collected: 0, tags: [] }
    if (!entry.tags.some(t => t.productId === item.productId)) entry.tags.push({ productId: item.productId, name: item.product.name, color: item.product.color })
  }
  const taggedClientIds = Object.keys(byClient)
  if (taggedClientIds.length > 0) {
    const payments = await prisma.payment.findMany({ where: { confirmed: true, invoice: { clientId: { in: taggedClientIds } } }, select: { amount: true, invoice: { select: { clientId: true } } } })
    for (const pay of payments) { const cId = pay.invoice?.clientId; if (cId && byClient[cId]) byClient[cId].collected += pay.amount }
  }
  const productStatsMap: Record<string, { productId: string; name: string; color: string; quantity: number; total: number }> = {}
  const clientStatsMap: Record<string, { clientId: string; name: string; total: number }> = {}
  for (const [clientId, entry] of Object.entries(byClient)) {
    const share = entry.tags.length > 0 ? entry.collected / entry.tags.length : 0
    for (const tag of entry.tags) {
      const p = productStatsMap[tag.productId] ??= { productId: tag.productId, name: tag.name, color: tag.color, quantity: 0, total: 0 }
      p.quantity += 1; p.total += share
    }
    clientStatsMap[clientId] = { clientId, name: entry.name, total: entry.collected }
  }
  const productStats = Object.values(productStatsMap).map(p => ({ ...p, total: Math.round(p.total) }))
  const topClients = Object.values(clientStatsMap).filter(c => c.total > 0).sort((a, b) => b.total - a.total).slice(0, 8)

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3"><PieChart size={24} className="text-primary" /> Répartition du CA</h1>
        <p className="text-sm text-nv-text-muted mt-1">Ventilation du CA collecté par offre + tier-list des produits.</p>
      </div>
      <RevenueByProduct productStats={productStats} topClients={topClients} />
    </div>
  )
}
