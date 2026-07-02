import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Target, FileSignature, ExternalLink, CheckCircle2, Clock } from 'lucide-react'
import { AcquisitionBoard } from '@/components/acquisition/AcquisitionBoard'
import { RevenueByProduct } from '@/components/acquisition/RevenueByProduct'
import Link from 'next/link'

// Plateforme de signature hébergée sur Netlify (site statique dédié)
// API Render : CORS * → les appels cross-origin fonctionnent sans restriction
const NETLIFY_SIGNATURE = 'https://newvision-contrat.netlify.app'

export default async function AcquisitionPage() {
  const session = await auth()
  if (!session?.user) return null

  // Page admin (création de contrat) = Netlify sans paramètre
  const SIGNATURE_ADMIN = NETLIFY_SIGNATURE
  // Lien client : Netlify?c=CODE
  const contractUrl = (code: string) => `${NETLIFY_SIGNATURE}?c=${code}`

  // Contrats signés
  const signedContracts = await prisma.signedContract.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  let statuses = await prisma.leadStatus.findMany({ orderBy: { order: 'asc' } })

  if (statuses.length === 0) {
    await prisma.leadStatus.createMany({
      data: [
        { name: 'R1', color: '#3b82f6', order: 0, isClosed: false },
        { name: 'R2', color: '#8b5cf6', order: 1, isClosed: false },
        { name: 'Follow-up', color: '#f59e0b', order: 2, isClosed: false },
        { name: 'Signé', color: '#10b981', order: 3, isClosed: true },
      ],
    })
    statuses = await prisma.leadStatus.findMany({ orderBy: { order: 'asc' } })
  }

  const leads = await prisma.lead.findMany({
    include: {
      status: true,
      calls: { orderBy: { date: 'desc' } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const serialize = (d: Date | null | undefined) => d ? d.toISOString() : null

  const serialized = leads.map(l => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
    followUpDate: serialize(l.followUpDate),
    calls: l.calls.map(c => ({
      ...c,
      date: c.date.toISOString(),
      createdAt: c.createdAt.toISOString(),
    })),
    status: l.status ? { ...l.status, createdAt: l.status.createdAt.toISOString() } : null,
  }))

  const serializedStatuses = statuses.map(s => ({ ...s, createdAt: s.createdAt.toISOString() }))

  // ── Répartition CA par produit ──────────────────────────────────────────────
  const dbAny = prisma as any

  // Produits de départ (modifiables/supprimables depuis les fiches clients)
  try {
    const productCount = await dbAny.product.count()
    if (productCount === 0) {
      await dbAny.product.createMany({
        data: [
          { name: 'Offre batch content', color: '#10b981', order: 0 },
          { name: 'Documentaire', color: '#3b82f6', order: 1 },
          { name: 'Offre montage', color: '#8b5cf6', order: 2 },
        ],
      })
    }
  } catch {}

  // Seul le CA des clients ayant un tag produit est pris en compte.
  // LTV = CA COLLECTÉ (paiements confirmés), pas le contracté — réparti
  // équitablement entre les produits tagués du client.
  const clientProductItems: any[] = await (async () => {
    try {
      return await dbAny.clientProduct.findMany({
        include: {
          product: { select: { id: true, name: true, color: true } },
          client: { select: { id: true, name: true } },
        },
      })
    } catch { return [] }
  })()

  // Regroupe les tags par client
  const byClient: Record<string, { name: string; collected: number; tags: { productId: string; name: string; color: string }[] }> = {}
  for (const item of clientProductItems) {
    const entry = byClient[item.clientId] ??= { name: item.client.name, collected: 0, tags: [] }
    if (!entry.tags.some(t => t.productId === item.productId)) {
      entry.tags.push({ productId: item.productId, name: item.product.name, color: item.product.color })
    }
  }

  // CA collecté par client tagué (paiements confirmés sur ses factures)
  const taggedClientIds = Object.keys(byClient)
  if (taggedClientIds.length > 0) {
    const payments = await prisma.payment.findMany({
      where: { confirmed: true, invoice: { clientId: { in: taggedClientIds } } },
      select: { amount: true, invoice: { select: { clientId: true } } },
    })
    for (const pay of payments) {
      const cId = pay.invoice?.clientId
      if (cId && byClient[cId]) byClient[cId].collected += pay.amount
    }
  }

  const productStatsMap: Record<string, { productId: string; name: string; color: string; quantity: number; total: number }> = {}
  const clientStatsMap: Record<string, { clientId: string; name: string; total: number }> = {}
  for (const [clientId, entry] of Object.entries(byClient)) {
    const share = entry.tags.length > 0 ? entry.collected / entry.tags.length : 0
    for (const tag of entry.tags) {
      const p = productStatsMap[tag.productId] ??= {
        productId: tag.productId, name: tag.name, color: tag.color, quantity: 0, total: 0,
      }
      p.quantity += 1 // nombre de clients tagués
      p.total += share
    }
    clientStatsMap[clientId] = { clientId, name: entry.name, total: entry.collected }
  }
  const productStats = Object.values(productStatsMap).map(p => ({ ...p, total: Math.round(p.total) }))
  const topClients = Object.values(clientStatsMap).filter(c => c.total > 0).sort((a, b) => b.total - a.total).slice(0, 8)

  const pendingContracts = signedContracts.filter(c => c.status === 'PENDING')
  const completedContracts = signedContracts.filter(c => c.status === 'SIGNED')

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Target size={24} className="text-primary" />
            Acquisition
          </h1>
          <p className="text-sm text-nv-text-muted mt-1">
            Tracker de leads — suivez vos prospects de la prospection à la signature
          </p>
        </div>
        <a href={SIGNATURE_ADMIN} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary/15 hover:bg-primary/25 border border-primary/30 text-primary text-sm font-medium rounded-xl transition-colors">
          <FileSignature size={15} />
          Plateforme de signature
          <ExternalLink size={12} className="opacity-60" />
        </a>
      </div>

      {/* ── Section Contrats ── */}
      {signedContracts.length > 0 && (
        <div className="rounded-xl border border-nv-border bg-nv-card p-4">
          <div className="flex items-center gap-2 mb-4">
            <FileSignature size={15} className="text-primary" />
            <p className="text-sm font-semibold text-white">Contrats</p>
            <span className="text-xs px-2 py-0.5 bg-emerald-500/15 text-emerald-400 rounded-full">{completedContracts.length} signés</span>
            {pendingContracts.length > 0 && <span className="text-xs px-2 py-0.5 bg-amber-400/15 text-amber-400 rounded-full">{pendingContracts.length} en attente</span>}
          </div>
          <div className="space-y-2">
            {signedContracts.map(c => {
              const isSigned = c.status === 'SIGNED'
              const amount = c.missionType === 'MRR' ? c.monthlyAmount : c.totalAmount
              const amountLabel = c.missionType === 'MRR' ? '/mois' : 'one-shot'
              const cUrl = contractUrl(c.shortCode)
              return (
                <div key={c.id} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${isSigned ? 'border-emerald-500/20 bg-emerald-500/3' : 'border-nv-border bg-nv-bg'}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isSigned ? 'bg-emerald-500/15' : 'bg-amber-400/15'}`}>
                      {isSigned
                        ? <CheckCircle2 size={14} className="text-emerald-400" />
                        : <Clock size={14} className="text-amber-400" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{c.clientName}</p>
                      <p className="text-xs text-nv-text-muted">{c.clientCompany || c.clientEmail || '—'} · {c.missionType === 'MRR' ? 'Retainer' : 'Ponctuel'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {amount && (
                      <div className="text-right">
                        <p className="text-sm font-semibold text-white">
                          {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount)}
                        </p>
                        <p className="text-[10px] text-nv-text-muted">{amountLabel}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-nv-text-muted bg-nv-border px-1.5 py-0.5 rounded">{c.shortCode}</span>
                      <a href={cUrl} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 text-nv-text-muted hover:text-primary transition-colors">
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Répartition CA par produit ── */}
      <RevenueByProduct productStats={productStats} topClients={topClients} />

      <AcquisitionBoard initialLeads={serialized} initialStatuses={serializedStatuses} />
    </div>
  )
}
