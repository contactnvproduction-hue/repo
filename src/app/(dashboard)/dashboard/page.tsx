import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { formatCurrency, daysUntil, isOverdue } from '@/lib/utils'
import { StatCard } from '@/components/ui/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  TrendingUp, Users, FolderKanban, Receipt, Clock,
  AlertTriangle, CheckCircle2, ArrowRight, Bell, Crosshair, PhoneCall, UserCheck, RepeatIcon, Briefcase, Calendar,
  AlertCircle, Phone, Zap, Award,
} from 'lucide-react'

const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
import Link from 'next/link'
import { DashboardCharts } from '@/components/dashboard/DashboardCharts'
import { LeadFollowUpModal } from '@/components/dashboard/LeadFollowUpModal'
import { DailyCheckinModal } from '@/components/dashboard/DailyCheckinModal'
import { MrrSection } from '@/components/dashboard/MrrSection'

function todayStr() { return new Date().toISOString().slice(0, 10) }

// CA réellement encaissé sur une fenêtre :
//  - déduplique les doublons (même facture + même montant + même jour)
//  - plafonne par facture au montant TTC (paiements en double d'un même montant)
//  - option excludeDueAfter : ignore les mensualités FUTURES validées d'avance
//    (l'ancien bouton MRR payait la dernière facture, parfois un mois à venir,
//    ce qui gonflait le CA du mois)
async function collectedDedup(where: any, opts?: { excludeDueAfter?: Date }): Promise<number> {
  const payments = await prisma.payment.findMany({
    where: { confirmed: true, ...where },
    select: { amount: true, invoiceId: true, date: true, invoice: { select: { totalTTC: true, dueDate: true } } },
  })
  const seen = new Set<string>()
  const perInvoice = new Map<string, { sum: number; cap: number }>()
  let total = 0
  for (const p of payments) {
    if (opts?.excludeDueAfter && p.invoice?.dueDate && p.invoice.dueDate > opts.excludeDueAfter) continue
    const key = `${p.invoiceId ?? 'x'}|${p.amount}|${p.date.toISOString().slice(0, 10)}`
    if (seen.has(key)) continue
    seen.add(key)
    if (!p.invoiceId) { total += p.amount; continue }
    const cur = perInvoice.get(p.invoiceId) ?? { sum: 0, cap: p.invoice?.totalTTC ?? Number.POSITIVE_INFINITY }
    cur.sum += p.amount
    perInvoice.set(p.invoiceId, cur)
  }
  for (const { sum, cap } of perInvoice.values()) total += Math.min(sum, cap)
  return total
}

async function getDashboardData(userId: string) {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

  const [
    caMonth, caLastMonth, caYear, activeClients, activeProjects, pendingInvoices,
    urgentTasks, recentProjects, overdueInvoices, prospectsToRelance, monthlyPayments,
    leadCalls, leadsFollowUp, allRetainers, upcomingCeoMeetings, todayCheckin,
    upcomingBilans, allClientInvoices, recentClosings, contractedRetainers,
  ] = await Promise.all([
    collectedDedup({ date: { gte: startOfMonth } }, { excludeDueAfter: endOfMonth }),
    collectedDedup({ date: { gte: lastMonthStart, lte: lastMonthEnd } }, { excludeDueAfter: lastMonthEnd }),
    collectedDedup({ date: { gte: startOfYear } }),
    prisma.client.count({ where: { status: 'ACTIF' } }),
    prisma.project.count({ where: { status: { notIn: ['LIVRÉ', 'ARCHIVÉ'] } } }),
    prisma.invoice.count({ where: { status: { in: ['EN_ATTENTE', 'EN_RETARD'] } } }),
    prisma.task.findMany({
      where: { priority: 'URGENTE', status: { notIn: ['TERMINÉE'] }, OR: [{ assignedToId: userId }, { createdById: userId }] },
      include: { project: true }, take: 5,
    }),
    prisma.project.findMany({
      where: { status: { notIn: ['LIVRÉ', 'ARCHIVÉ'] } },
      include: { client: true }, orderBy: { deadline: 'asc' }, take: 5,
    }),
    prisma.invoice.findMany({
      where: { status: { in: ['EN_ATTENTE', 'EN_RETARD'] }, dueDate: { lt: now } },
      include: { client: true }, take: 5,
    }),
    prisma.client.findMany({
      where: { status: 'PROSPECT', relanceDate: { lte: now } },
      select: { id: true, name: true, company: true, relanceDate: true },
      orderBy: { relanceDate: 'asc' },
    }),
    prisma.$queryRaw`
      SELECT DATE_TRUNC('month', date) as month, SUM(amount) as total
      FROM payments WHERE confirmed = true AND date >= NOW() - INTERVAL '6 months'
      GROUP BY month ORDER BY month ASC
    ` as Promise<Array<{ month: Date; total: number }>>,
    prisma.leadCall.findMany({
      select: { showedUp: true, qualified: true, lead: { select: { convertedClientId: true, status: { select: { isClosed: true } } } } },
    }),
    prisma.lead.findMany({
      where: { followUpDate: { lte: now }, convertedClientId: null },
      select: { id: true, name: true, company: true, followUpDate: true },
      orderBy: { followUpDate: 'asc' },
    }),
    prisma.clientRetainer.findMany({
      where: { startDate: { lte: now } },
      include: { client: { select: { id: true, name: true, company: true } } },
      orderBy: { startDate: 'asc' },
    }),
    prisma.ceoMeeting.findMany({ where: { date: { gte: now } }, orderBy: { date: 'asc' }, take: 5 }),
    prisma.userDailyCheckin.findFirst({ where: { userId, date: todayStr() } }),
    // Clients actifs sans relance depuis plus de 3 jours (« Client relancé ? »)
    (async () => {
      try {
        return await (prisma as any).client.findMany({
          where: {
            status: 'ACTIF',
            OR: [
              { lastFollowUpAt: null },
              { lastFollowUpAt: { lt: new Date(now.getTime() - 3 * 86_400_000) } },
            ],
          },
          select: { id: true, name: true, company: true, lastFollowUpAt: true },
          orderBy: { lastFollowUpAt: 'asc' },
          take: 8,
        })
      } catch { return [] }
    })(),
    prisma.invoice.findMany({
      where: { status: { in: ['EN_ATTENTE', 'PARTIELLEMENT_PAYÉE', 'EN_RETARD', 'PAYÉE'] }, type: { in: ['TOTALE', 'SOLDE'] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, clientId: true, status: true, totalTTC: true, dueDate: true },
    }),
    // Closings des 6 derniers mois (KPI mois par mois)
    (async () => {
      try {
        const start = new Date(now.getFullYear(), now.getMonth() - 5, 1)
        return await (prisma as any).closingEvent.findMany({ where: { date: { gte: start } }, select: { date: true, amount: true, type: true } })
      } catch { return [] }
    })(),
    // Contrats (retainers) signés ce mois → CA contracté du mois (mensualité × durée)
    prisma.clientRetainer.findMany({ where: { createdAt: { gte: startOfMonth } }, select: { monthlyAmount: true, durationMonths: true } }),
  ])

  const caMonthVal = caMonth
  const caLastMonthVal = caLastMonth
  const trend = caLastMonthVal > 0 ? Math.round(((caMonthVal - caLastMonthVal) / caLastMonthVal) * 100) : 0
  // CA contracté ce mois = valeur totale des contrats signés ce mois (mensualité × durée)
  const contractedThisMonth = contractedRetainers.reduce((s, r) => s + r.monthlyAmount * r.durationMonths, 0)
  const totalCalls = leadCalls.length
  const showedUp = leadCalls.filter(c => c.showedUp).length
  const qualified = leadCalls.filter(c => c.qualified).length
  const converted = leadCalls.filter(c => c.lead?.convertedClientId).length
  const showupRate = totalCalls > 0 ? Math.round((showedUp / totalCalls) * 100) : 0
  const qualifRate = showedUp > 0 ? Math.round((qualified / showedUp) * 100) : 0
  const closingRate = qualified > 0 ? Math.round((converted / qualified) * 100) : 0
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(todayStart.getTime() + 86_400_000)
  const currentMRR = allRetainers.reduce((sum, r) => {
    const end = new Date(r.startDate); end.setMonth(end.getMonth() + r.durationMonths)
    return end > now ? sum + r.monthlyAmount : sum
  }, 0)
  const nextMeeting = upcomingCeoMeetings[0] ?? null
  const ceoMeetingSoon = nextMeeting && (new Date(nextMeeting.date).getTime() - now.getTime()) < 48 * 3600 * 1000 ? nextMeeting : null
  // Facture de la MENSUALITÉ DU MOIS EN COURS par client (échéance ce mois-ci).
  // C'est celle qu'on doit encaisser ce mois → on ne cible plus la « dernière »
  // facture (qui pouvait être un mois futur et fausser le CA + la liste MRR).
  const currentMonthInvoiceByClient = new Map<string, typeof allClientInvoices[0]>()
  for (const inv of allClientInvoices) {
    if (!inv.dueDate) continue
    const d = new Date(inv.dueDate)
    if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) continue
    const existing = currentMonthInvoiceByClient.get(inv.clientId)
    // Préfère une facture NON payée ; sinon garde la première rencontrée
    if (!existing || (existing.status === 'PAYÉE' && inv.status !== 'PAYÉE')) {
      currentMonthInvoiceByClient.set(inv.clientId, inv)
    }
  }
  const activeRetainers = allRetainers.filter(r => { const end = new Date(r.startDate); end.setMonth(end.getMonth() + r.durationMonths); return end > now })
  const retainersEndingSoon = allRetainers.map(r => {
    const end = new Date(r.startDate); end.setMonth(end.getMonth() + r.durationMonths)
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86_400_000)
    return { ...r, endDate: end.toISOString(), daysLeft }
  }).filter(r => r.daysLeft > 0 && r.daysLeft <= 15).sort((a, b) => a.daysLeft - b.daysLeft)

  return {
    caMonth: caMonthVal, caYear, trend, contractedThisMonth,
    activeClients, activeProjects, pendingInvoices,
    urgentTasks, recentProjects, overdueInvoices, prospectsToRelance, monthlyPayments,
    acquisition: { totalCalls, showupRate, qualifRate, closingRate },
    currentMRR,
    ceoMeetingSoon: ceoMeetingSoon ? { ...ceoMeetingSoon, date: ceoMeetingSoon.date.toISOString() } : null,
    upcomingMeetings: upcomingCeoMeetings.map(m => ({ id: m.id, title: m.title, date: m.date.toISOString() })),
    checkinDone: !!todayCheckin,
    activeRetainers: activeRetainers.filter(r => r.client).filter(r => {
      // À relancer ce mois = mensualité du mois en cours pas encore réglée.
      // Payée → retirée de la liste. Pas encore générée → à facturer (affichée).
      const inv = currentMonthInvoiceByClient.get(r.client!.id)
      return !inv || inv.status !== 'PAYÉE'
    }).map(r => {
      const inv = currentMonthInvoiceByClient.get(r.client!.id) ?? null
      return { id: r.id, clientId: r.client!.id, clientName: r.client!.name, clientCompany: r.client!.company, monthlyAmount: r.monthlyAmount, durationMonths: r.durationMonths, startDate: r.startDate.toISOString(), description: r.description, invoiceId: inv?.id ?? null, invoiceTTC: inv?.totalTTC ?? r.monthlyAmount }
    }),
    retainersEndingSoon: retainersEndingSoon.filter(r => r.client).map(r => ({ id: r.id, clientId: r.client!.id, clientName: r.client!.name, clientCompany: r.client!.company, monthlyAmount: r.monthlyAmount, daysLeft: r.daysLeft, endDate: r.endDate })),
    leadsFollowUp: leadsFollowUp.map(l => ({ ...l, followUpDate: l.followUpDate!.toISOString(), isToday: l.followUpDate! >= todayStart && l.followUpDate! < todayEnd })),
    clientsToFollowUp: (upcomingBilans as any[]).map((c: any) => ({
      id: c.id, name: c.name, company: c.company,
      lastFollowUpAt: c.lastFollowUpAt ? new Date(c.lastFollowUpAt).toISOString() : null,
    })),
    closingsByMonth: Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
      const inMonth = (recentClosings as any[]).filter((c: any) => {
        const cd = new Date(c.date); return cd.getFullYear() === d.getFullYear() && cd.getMonth() === d.getMonth()
      })
      return { month: d.getMonth(), count: inMonth.length, amount: inMonth.reduce((s: number, c: any) => s + (c.amount ?? 0), 0), isCurrent: i === 5 }
    }),
  }
}

const projectStatusLabel: Record<string, string> = {
  BRIEF_REÇU: 'Brief reçu', EN_PRODUCTION: 'En production', EN_POST_PRODUCTION: 'Post-prod',
  EN_VALIDATION: 'Validation', LIVRÉ: 'Livré', ARCHIVÉ: 'Archivé',
}
const projectStatusBadge: Record<string, 'info' | 'warning' | 'orange' | 'purple' | 'success' | 'muted'> = {
  BRIEF_REÇU: 'info', EN_PRODUCTION: 'warning', EN_POST_PRODUCTION: 'orange',
  EN_VALIDATION: 'purple', LIVRÉ: 'success', ARCHIVÉ: 'muted',
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) return null
  const data = await getDashboardData(session.user.id)

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const alertCount = data.prospectsToRelance.length + data.leadsFollowUp.length + data.retainersEndingSoon.length

  return (
    <div className="space-y-6 animate-fade-in">
      <DailyCheckinModal initialDone={data.checkinDone} />
      <LeadFollowUpModal leads={data.leadsFollowUp} />

      {/* ── Hero greeting ── */}
      <div className="relative overflow-hidden rounded-2xl border border-nv-border bg-nv-card p-6">
        {/* Glow décoratif */}
        <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full bg-primary/8 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-primary/5 blur-2xl" />
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-nv-text-faint capitalize mb-2 tracking-wide">{today}</p>
            <h1 className="text-3xl font-black text-white leading-none mb-2">
              Bonjour, {session.user.name.split(' ')[0]}
            </h1>
            <div className="flex items-center gap-3 text-sm text-nv-text-muted flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {data.activeClients} clients actifs
              </span>
              <span className="text-nv-border">·</span>
              <span>{data.activeProjects} projets en cours</span>
              {data.currentMRR > 0 && (
                <>
                  <span className="text-nv-border">·</span>
                  <span className="text-primary font-semibold">{formatCurrency(data.currentMRR)}/m MRR</span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {alertCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-amber-400/10 border border-amber-400/25 text-amber-300">
                <Zap size={11} />
                {alertCount} action{alertCount > 1 ? 's' : ''} en attente
              </div>
            )}
            <div className="flex items-center gap-4 text-right">
              <div>
                <p className="text-[10px] text-nv-text-faint uppercase tracking-wider">CA ce mois</p>
                <p className="text-xl font-bold text-white">{formatCurrency(data.caMonth)}</p>
              </div>
              <div className="w-px h-8 bg-nv-border" />
              <div>
                <p className="text-[10px] text-nv-text-faint uppercase tracking-wider">Cette année</p>
                <p className="text-xl font-bold text-primary">{formatCurrency(data.caYear)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── CEO meeting imminent ── */}
      {data.ceoMeetingSoon && (
        <Link href="/ceo" className="flex items-center gap-3 p-4 rounded-2xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
            <Briefcase size={16} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Réunion CEO dans moins de 48h</p>
            <p className="text-xs text-nv-text-muted truncate">{data.ceoMeetingSoon.title} — {new Date(data.ceoMeetingSoon.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <ArrowRight size={15} className="text-primary shrink-0" />
        </Link>
      )}

      {/* ── Vue chiffre d'affaires ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Collecté ce mois" value={formatCurrency(data.caMonth)} icon={TrendingUp} color="primary" subtitle={data.trend !== 0 ? `${data.trend > 0 ? '▲' : '▼'} ${Math.abs(data.trend)}% vs mois dernier` : 'encaissé ce mois'} />
        <StatCard title="Contracté ce mois" value={formatCurrency(data.contractedThisMonth)} icon={Briefcase} color="success" subtitle="contrats signés × durée" />
        <StatCard title="MRR actuel" value={formatCurrency(data.currentMRR)} icon={RepeatIcon} color="warning" subtitle="récurrent / mois" />
        <StatCard title="Collecté cette année" value={formatCurrency(data.caYear)} icon={TrendingUp} color="primary" subtitle={`année ${new Date().getFullYear()}`} />
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard title="Clients actifs" value={String(data.activeClients)} icon={Users} color="primary" />
        <StatCard title="Projets en cours" value={String(data.activeProjects)} icon={FolderKanban} color="warning" />
        <StatCard title="Factures impayées" value={String(data.pendingInvoices)} icon={Receipt} color={data.pendingInvoices > 0 ? 'danger' : 'success'} />
      </div>

      {/* ── Alertes groupées ── */}
      {(data.prospectsToRelance.length > 0 || data.leadsFollowUp.length > 0 || data.retainersEndingSoon.length > 0) && (
        <div className="space-y-3">
          {/* Relances prospects */}
          {data.prospectsToRelance.length > 0 && (
            <div className="rounded-2xl border border-amber-400/25 bg-amber-400/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-amber-400/20 flex items-center justify-center shrink-0">
                  <Bell size={12} className="text-amber-400" />
                </div>
                <p className="text-sm font-semibold text-amber-300">
                  {data.prospectsToRelance.length} relance{data.prospectsToRelance.length > 1 ? 's' : ''} prospects
                </p>
                <Link href="/clients?status=PROSPECT" className="ml-auto text-xs text-nv-text-muted hover:text-white transition-colors flex items-center gap-1">
                  Voir <ArrowRight size={11} />
                </Link>
              </div>
              <div className="space-y-1.5">
                {data.prospectsToRelance.map(p => {
                  const days = Math.floor((new Date().getTime() - new Date(p.relanceDate!).getTime()) / 86400000)
                  return (
                    <Link key={p.id} href={`/clients/${p.id}`}
                      className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-400/5 border border-amber-400/10 hover:border-amber-400/30 hover:bg-amber-400/8 transition-colors group">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-lg bg-amber-400/20 flex items-center justify-center text-xs font-bold text-amber-400 shrink-0">{p.name.charAt(0)}</div>
                        <div>
                          <p className="text-sm font-medium text-white">{p.name}</p>
                          {p.company && <p className="text-xs text-nv-text-muted">{p.company}</p>}
                        </div>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 font-medium shrink-0">
                        {days === 0 ? "Aujourd'hui" : `+${days}j`}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* Follow-ups leads */}
          {data.leadsFollowUp.length > 0 && (
            <div className={`rounded-2xl border p-4 ${data.leadsFollowUp.some(l => !l.isToday) ? 'border-red-500/25 bg-red-500/5' : 'border-amber-400/25 bg-amber-400/5'}`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${data.leadsFollowUp.some(l => !l.isToday) ? 'bg-red-500/20' : 'bg-amber-400/20'}`}>
                  <Bell size={12} className={data.leadsFollowUp.some(l => !l.isToday) ? 'text-red-400' : 'text-amber-400'} />
                </div>
                <p className={`text-sm font-semibold ${data.leadsFollowUp.some(l => !l.isToday) ? 'text-red-300' : 'text-amber-300'}`}>
                  {data.leadsFollowUp.length} follow-up{data.leadsFollowUp.length > 1 ? 's' : ''} leads
                </p>
                <Link href="/acquisition" className="ml-auto text-xs text-nv-text-muted hover:text-white transition-colors flex items-center gap-1">
                  Acquisition <ArrowRight size={11} />
                </Link>
              </div>
              <div className="space-y-1.5">
                {data.leadsFollowUp.map(lead => {
                  const overdue = !lead.isToday
                  const days = Math.floor((new Date().getTime() - new Date(lead.followUpDate).getTime()) / 86_400_000)
                  return (
                    <Link key={lead.id} href="/acquisition"
                      className={`flex items-center justify-between px-3 py-2 rounded-xl border transition-colors group ${overdue ? 'bg-red-500/5 border-red-500/10 hover:border-red-500/30' : 'bg-amber-400/5 border-amber-400/10 hover:border-amber-400/30'}`}>
                      <div className="flex items-center gap-2.5">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${overdue ? 'bg-red-500/20 text-red-400' : 'bg-amber-400/20 text-amber-400'}`}>
                          {lead.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{lead.name}</p>
                          {lead.company && <p className="text-xs text-nv-text-muted">{lead.company}</p>}
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${overdue ? 'bg-red-500/15 text-red-400' : 'bg-amber-400/15 text-amber-400'}`}>
                        {days === 0 ? "Aujourd'hui" : `+${days}j`}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* Contrats MRR expirant */}
          {data.retainersEndingSoon.length > 0 && (
            <div className="rounded-2xl border border-amber-400/25 bg-amber-400/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-amber-400/20 flex items-center justify-center shrink-0">
                  <AlertCircle size={12} className="text-amber-400" />
                </div>
                <p className="text-sm font-semibold text-amber-300">
                  {data.retainersEndingSoon.length} contrat{data.retainersEndingSoon.length > 1 ? 's' : ''} MRR expirent bientôt
                </p>
                <Link href="/finance" className="ml-auto text-xs text-nv-text-muted hover:text-white flex items-center gap-1 transition-colors">
                  Finance <ArrowRight size={11} />
                </Link>
              </div>
              <div className="space-y-1.5">
                {data.retainersEndingSoon.map(r => (
                  <Link key={r.id} href={`/clients/${r.clientId}`}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-400/5 border border-amber-400/10 hover:border-amber-400/30 transition-colors group">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-amber-400/20 flex items-center justify-center text-xs font-bold text-amber-300 shrink-0">{r.clientName.charAt(0)}</div>
                      <div>
                        <p className="text-sm font-medium text-white">{r.clientName}</p>
                        {r.clientCompany && <p className="text-xs text-nv-text-muted">{r.clientCompany}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-semibold text-amber-300">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(r.monthlyAmount)}/m</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${r.daysLeft <= 7 ? 'bg-red-500/20 text-red-300' : 'bg-amber-400/15 text-amber-300'}`}>J-{r.daysLeft}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MRR à facturer ── */}
      <MrrSection retainers={data.activeRetainers} />

      {/* ── Closings mois par mois ── */}
      {data.closingsByMonth.some(m => m.count > 0) && (
        <div className="rounded-2xl border border-nv-border bg-nv-card p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-white flex items-center gap-2"><Award size={15} className="text-primary" /> Closings — 6 derniers mois</p>
            <Link href="/sales" className="text-xs text-nv-text-muted hover:text-white transition-colors flex items-center gap-1">Pipeline <ArrowRight size={11} /></Link>
          </div>
          {(() => {
            const maxCount = Math.max(1, ...data.closingsByMonth.map(m => m.count))
            return (
              <div className="flex items-end justify-between gap-3 h-32">
                {data.closingsByMonth.map((m, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <span className="text-sm font-bold text-white tabular-nums">{m.count > 0 ? m.count : ''}</span>
                    {m.amount > 0 && <span className="text-[9px] text-nv-text-faint tabular-nums">{formatCurrency(m.amount)}</span>}
                    <div className="w-full rounded-t-lg transition-all" style={{
                      height: `${(m.count / maxCount) * 100}%`,
                      minHeight: m.count > 0 ? '8px' : '2px',
                      backgroundColor: m.isCurrent ? '#e8b84b' : 'rgba(232,184,75,0.35)',
                    }} />
                    <span className={`text-[11px] ${m.isCurrent ? 'text-primary font-semibold' : 'text-nv-text-faint'}`}>{MONTHS_FR[m.month]}</span>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      )}

      {/* ── Bilans & Réunions ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Clients à relancer (>3 jours sans relance) */}
        {data.clientsToFollowUp.length > 0 && (
          <div className="rounded-2xl border border-amber-400/25 bg-amber-400/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-amber-400/20 flex items-center justify-center shrink-0">
                <Phone size={12} className="text-amber-400" />
              </div>
              <p className="text-sm font-semibold text-amber-300">
                {data.clientsToFollowUp.length} client{data.clientsToFollowUp.length > 1 ? 's' : ''} à relancer
              </p>
              <Link href="/clients" className="ml-auto text-xs text-nv-text-muted hover:text-white transition-colors flex items-center gap-1">
                Clients <ArrowRight size={11} />
              </Link>
            </div>
            <div className="space-y-1.5">
              {data.clientsToFollowUp.map(c => {
                const daysSince = c.lastFollowUpAt
                  ? Math.floor((Date.now() - new Date(c.lastFollowUpAt).getTime()) / 86_400_000)
                  : null
                return (
                  <Link key={c.id} href={`/clients/${c.id}`}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-400/5 border border-amber-400/10 hover:border-amber-400/30 transition-colors group">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-amber-400/20 flex items-center justify-center text-xs font-bold text-amber-400 shrink-0">{c.name.charAt(0).toUpperCase()}</div>
                      <div>
                        <p className="text-sm font-medium text-white">{c.name}</p>
                        {c.company && <p className="text-xs text-nv-text-muted">{c.company}</p>}
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${daysSince === null || daysSince >= 7 ? 'bg-red-400/20 text-red-300' : 'bg-amber-400/15 text-amber-300'}`}>
                      {daysSince === null ? 'Jamais relancé' : `${daysSince} j sans relance`}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Réunions CEO */}
        {data.upcomingMeetings.length > 0 && (
          <div className="rounded-2xl border border-nv-border bg-nv-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                <Briefcase size={12} className="text-primary" />
              </div>
              <p className="text-sm font-semibold text-white">Réunions à venir</p>
              <Link href="/ceo" className="ml-auto text-xs text-nv-text-muted hover:text-primary transition-colors flex items-center gap-1">
                Voir tout <ArrowRight size={11} />
              </Link>
            </div>
            <div className="space-y-1.5">
              {data.upcomingMeetings.map(meeting => {
                const msUntil = new Date(meeting.date).getTime() - Date.now()
                const daysUntilMeeting = Math.ceil(msUntil / 86_400_000)
                const isSoon = msUntil < 48 * 3600 * 1000
                return (
                  <Link key={meeting.id} href="/ceo"
                    className="flex items-center justify-between px-3 py-2 rounded-xl border border-nv-border hover:border-primary/30 hover:bg-white/3 transition-colors group">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${isSoon ? 'bg-primary/20' : 'bg-nv-border'}`}>
                        <Calendar size={12} className={isSoon ? 'text-primary' : 'text-nv-text-muted'} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{meeting.title}</p>
                        <p className="text-xs text-nv-text-muted">{new Date(meeting.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isSoon && <span className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary rounded-full font-medium">Bientôt</span>}
                      <span className={`text-xs ${isSoon ? 'text-primary font-medium' : 'text-nv-text-muted'}`}>
                        {daysUntilMeeting <= 0 ? "Auj." : daysUntilMeeting === 1 ? 'Demain' : `Dans ${daysUntilMeeting}j`}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Acquisition ── */}
      {data.acquisition.totalCalls > 0 && (
        <div className="rounded-2xl border border-nv-border bg-nv-card p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <Crosshair size={12} className="text-primary" />
            </div>
            <p className="text-sm font-semibold text-white">Performance commerciale</p>
            <Link href="/acquisition" className="ml-auto text-xs text-nv-text-muted hover:text-primary transition-colors flex items-center gap-1">
              Acquisition <ArrowRight size={11} />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Taux show-up', value: `${data.acquisition.showupRate}%`, sub: `${data.acquisition.totalCalls} appels`, color: '#60a5fa', icon: PhoneCall },
              { label: 'Qualification', value: `${data.acquisition.qualifRate}%`, sub: 'des show-ups', color: '#fbbf24', icon: CheckCircle2 },
              { label: 'Closing', value: `${data.acquisition.closingRate}%`, sub: 'des qualifiés', color: '#34d399', icon: UserCheck },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-nv-border/60 bg-nv-bg/50 p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-2">
                  <s.icon size={12} style={{ color: s.color }} />
                  <span className="text-xs text-nv-text-muted">{s.label}</span>
                </div>
                <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[10px] text-nv-text-faint mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Charts + Alertes ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <DashboardCharts monthlyData={data.monthlyPayments} />
        </div>
        <div className="space-y-4">
          {data.overdueInvoices.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-400">
                  <AlertTriangle size={15} />
                  Factures en retard ({data.overdueInvoices.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {data.overdueInvoices.map(inv => (
                  <Link key={inv.id} href={`/invoices/${inv.id}`}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors group">
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{inv.client?.name ?? '—'}</p>
                      <p className="text-xs text-nv-text-muted">{inv.number}</p>
                    </div>
                    <p className="text-sm font-medium text-red-400 shrink-0">{formatCurrency(inv.totalTTC - inv.amountPaid)}</p>
                  </Link>
                ))}
                <Link href="/invoices?filter=retard" className="flex items-center gap-1 text-xs text-nv-text-muted hover:text-white transition-colors pt-1">
                  Voir tout <ArrowRight size={12} />
                </Link>
              </CardContent>
            </Card>
          )}
          {data.urgentTasks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-400">
                  <Clock size={15} />Tâches urgentes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {data.urgentTasks.map(task => (
                  <Link key={task.id} href={`/tasks?id=${task.id}`}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{task.title}</p>
                      {task.project && <p className="text-xs text-nv-text-muted">{task.project.title}</p>}
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── Projets actifs ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FolderKanban size={15} className="text-primary" />Projets actifs
            </CardTitle>
            <Link href="/projects" className="text-xs text-nv-text-muted hover:text-primary transition-colors flex items-center gap-1">
              Voir tout <ArrowRight size={12} />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.recentProjects.map(project => {
              const days = daysUntil(project.deadline)
              const overdue = isOverdue(project.deadline)
              return (
                <Link key={project.id} href={`/projects/${project.id}`}
                  className="flex items-center justify-between p-3 rounded-xl border border-nv-border hover:border-nv-border-light hover:bg-white/[0.02] transition-colors group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <FolderKanban size={13} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate group-hover:text-primary transition-colors">{project.title}</p>
                      <p className="text-xs text-nv-text-muted">{project.client?.name ?? '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant={projectStatusBadge[project.status] || 'muted'}>{projectStatusLabel[project.status]}</Badge>
                    {project.deadline && (
                      <span className={`text-xs tabular-nums ${overdue ? 'text-red-400' : days !== null && days <= 3 ? 'text-yellow-400' : 'text-nv-text-muted'}`}>
                        {overdue ? `${Math.abs(days!)}j retard` : days !== null ? `J-${days}` : ''}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
            {data.recentProjects.length === 0 && (
              <div className="text-center py-8 text-nv-text-muted">
                <CheckCircle2 size={28} className="mx-auto mb-2 text-emerald-400 opacity-70" />
                <p className="text-sm">Aucun projet actif</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
