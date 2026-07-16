import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Target, FileSignature, ExternalLink, CheckCircle2, Clock } from 'lucide-react'
import { CallPipeline } from '@/components/sales/CallPipeline'
import { ContentTracker } from '@/components/sales/ContentTracker'
import { AverageTicket } from '@/components/sales/AverageTicket'
import { RevenueByProduct } from '@/components/acquisition/RevenueByProduct'
import { AcquisitionTabs } from '@/components/acquisition/AcquisitionTabs'
import { SalesForecast } from '@/components/sales/SalesForecast'
import { computeSalesForecast } from '@/lib/mrr-forecast'
import { ensureRetainerInvoices } from '@/lib/retainer-invoices'
import { FinanceSection } from '@/components/finance/FinanceSection'
import { TreasuryForecast } from '@/components/finance/TreasuryForecast'
import { FollowUpStats } from '@/components/sales/FollowUpStats'
import Link from 'next/link'

// Plateforme de signature hébergée sur Netlify (site statique dédié)
// API Render : CORS * → les appels cross-origin fonctionnent sans restriction
const NETLIFY_SIGNATURE = 'https://newvision-contrat.netlify.app'

export default async function SalesPage() {
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

  // Données du pipeline v2 (liste + fiche lead + re-close)
  const pipelineLeads = leads.map(l => ({
    id: l.id, name: l.name, company: l.company, email: l.email, phone: l.phone,
    statusId: l.statusId, convertedClientId: l.convertedClientId,
    createdAt: l.createdAt.toISOString(),
    status: l.status ? { id: l.status.id, name: l.status.name, color: l.status.color, isClosed: l.status.isClosed, order: l.status.order } : null,
    calls: l.calls.map((c: any) => ({
      id: c.id, leadId: l.id, date: c.date.toISOString(), duration: c.duration,
      showedUp: c.showedUp, qualified: c.qualified,
      closed: c.closed ?? false, followUpNeeded: c.followUpNeeded ?? false, followUpDone: c.followUpDone ?? false,
      notes: c.notes,
    })),
  }))
  const pipelineStatuses = statuses.map(s => ({ id: s.id, name: s.name, color: s.color, isClosed: s.isClosed, order: s.order }))
  const pipelineClients = await prisma.client.findMany({
    where: { status: { not: 'ARCHIVÉ' } },
    select: { id: true, name: true, company: true },
    orderBy: { name: 'asc' },
  })
  const nowDate = new Date()
  const nowMonthStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1)
  const sixMonthsStart = new Date(nowDate.getFullYear(), nowDate.getMonth() - 5, 1)
  const allClosings: any[] = await (async () => {
    try { return await (prisma as any).closingEvent.findMany({ where: { date: { gte: sixMonthsStart } }, orderBy: { date: 'asc' } }) } catch { return [] }
  })()
  const monthClosings = allClosings.filter(c => new Date(c.date) >= nowMonthStart)
  const closingsThisMonth = {
    count: monthClosings.length,
    amount: monthClosings.reduce((s, c) => s + (c.amount ?? 0), 0),
  }
  // Historique 6 mois pour l'infographie
  const closings6m = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - 5 + i, 1)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    const inMonth = allClosings.filter(c => { const cd = new Date(c.date); return cd.getFullYear() === d.getFullYear() && cd.getMonth() === d.getMonth() })
    return {
      year: d.getFullYear(), month: d.getMonth(),
      count: inMonth.length,
      amount: inMonth.reduce((s, c) => s + (c.amount ?? 0), 0),
      isCurrent: i === 5,
    }
  })
  const agencySettings = await prisma.agencySetting.findFirst().catch(() => null)
  const closingScriptUrl = (agencySettings as any)?.closingScriptUrl ?? null

  // Contenu organique — canaux + pièces des 12 derniers mois
  const contentSince = new Date(new Date().getFullYear() - 1, 0, 1)
  const [contentChannels, contentPieces] = await Promise.all([
    (async () => { try { return await (prisma as any).contentChannel.findMany({ include: { _count: { select: { pieces: true } } }, orderBy: [{ owner: 'asc' }, { platform: 'asc' }] }) } catch { return [] } })(),
    (async () => { try { return await (prisma as any).contentPiece.findMany({ where: { publishedAt: { gte: contentSince } }, include: { channel: { select: { owner: true, platform: true, handle: true } } }, orderBy: { publishedAt: 'desc' } }) } catch { return [] } })(),
  ])
  const contentChannelsSer = contentChannels.map((c: any) => ({
    id: c.id, owner: c.owner, platform: c.platform, handle: c.handle, url: c.url,
    followers: c.followers, lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null, _count: c._count,
    connected: !!(c.accessToken && c.platformUserId),
  }))
  const contentPiecesSer = contentPieces.map((p: any) => ({
    id: p.id, channelId: p.channelId, title: p.title, url: p.url, thumbnail: p.thumbnail,
    format: p.format, publishedAt: p.publishedAt.toISOString(),
    views: p.views, likes: p.likes, comments: p.comments, shares: p.shares,
    engagementRate: p.engagementRate, manual: p.manual, channel: p.channel,
  }))

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

  // Mensualités : chaque retainer actif génère ses factures à venir (idempotent,
  // backfill compris pour les clients déjà closés via la plateforme de signature)
  await ensureRetainerInvoices(prisma as any)

  // Prévisionnel MRR — généré depuis les retainers contractés + factures en attente
  const forecast = await computeSalesForecast(prisma as any, 6)

  const contractsSection = (
    <div className="rounded-xl border border-nv-border bg-nv-card p-4">
      {signedContracts.length === 0 ? (
        <p className="text-sm text-nv-text-faint text-center py-8">Aucun contrat pour l&apos;instant.</p>
      ) : (
        <>
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
        </>
      )}
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Target size={24} className="text-primary" />
            Sales
          </h1>
          <p className="text-sm text-nv-text-muted mt-1">
            Pipeline, prévisionnel, contrats et répartition du CA — tout au même endroit
          </p>
        </div>
        <a href={SIGNATURE_ADMIN} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary/15 hover:bg-primary/25 border border-primary/30 text-primary text-sm font-medium rounded-xl transition-colors">
          <FileSignature size={15} />
          Plateforme de signature
          <ExternalLink size={12} className="opacity-60" />
        </a>
      </div>

      <AcquisitionTabs
        pipeline={<><FollowUpStats /><CallPipeline initialLeads={pipelineLeads} statuses={pipelineStatuses} clients={pipelineClients} closingsThisMonth={closingsThisMonth} closings6m={closings6m} initialScriptUrl={closingScriptUrl} /></>}
        finance={
          <FinanceSection previsionnel={
            <div className="space-y-5">
              <AverageTicket />
              <TreasuryForecast />
              <SalesForecast months={forecast.months} suggestions={forecast.suggestions} />
            </div>
          } />
        }
        contracts={contractsSection}
        products={<RevenueByProduct productStats={productStats} topClients={topClients} />}
        content={<ContentTracker initialChannels={contentChannelsSer} initialPieces={contentPiecesSer} />}
      />
    </div>
  )
}
