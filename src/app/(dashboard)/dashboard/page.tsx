import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { formatCurrency, daysUntil, isOverdue } from '@/lib/utils'
import { StatCard } from '@/components/ui/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  TrendingUp, Users, FolderKanban, Receipt, Clock,
  AlertTriangle, CheckCircle2, ArrowRight, Bell, Crosshair, PhoneCall, UserCheck, RepeatIcon, Briefcase, Calendar,
  AlertCircle, Phone,
} from 'lucide-react'
import Link from 'next/link'
import { DashboardCharts } from '@/components/dashboard/DashboardCharts'
import { LeadFollowUpModal } from '@/components/dashboard/LeadFollowUpModal'
import { DailyCheckinModal } from '@/components/dashboard/DailyCheckinModal'
import { MrrSection } from '@/components/dashboard/MrrSection'

function todayStr() { return new Date().toISOString().slice(0, 10) }

async function getDashboardData(userId: string) {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

  const [
    caMonth,
    caLastMonth,
    caYear,
    activeClients,
    activeProjects,
    pendingInvoices,
    urgentTasks,
    recentProjects,
    overdueInvoices,
    prospectsToRelance,
    monthlyPayments,
    leadCalls,
    leadsFollowUp,
    allRetainers,
    upcomingCeoMeetings,
    todayCheckin,
    upcomingBilans,
    allClientInvoices,
  ] = await Promise.all([
    // CA du mois (factures payées)
    prisma.payment.aggregate({
      where: { date: { gte: startOfMonth }, confirmed: true },
      _sum: { amount: true },
    }),
    // CA mois dernier
    prisma.payment.aggregate({
      where: { date: { gte: lastMonthStart, lte: lastMonthEnd }, confirmed: true },
      _sum: { amount: true },
    }),
    // CA année
    prisma.payment.aggregate({
      where: { date: { gte: startOfYear }, confirmed: true },
      _sum: { amount: true },
    }),
    // Clients actifs
    prisma.client.count({ where: { status: 'ACTIF' } }),
    // Projets actifs
    prisma.project.count({
      where: { status: { notIn: ['LIVRÉ', 'ARCHIVÉ'] } },
    }),
    // Factures en attente
    prisma.invoice.count({ where: { status: { in: ['EN_ATTENTE', 'EN_RETARD'] } } }),
    // Tâches urgentes
    prisma.task.findMany({
      where: {
        priority: 'URGENTE',
        status: { notIn: ['TERMINÉE'] },
        OR: [{ assignedToId: userId }, { createdById: userId }],
      },
      include: { project: true },
      take: 5,
    }),
    // Projets récents
    prisma.project.findMany({
      where: { status: { notIn: ['LIVRÉ', 'ARCHIVÉ'] } },
      include: { client: true },
      orderBy: { deadline: 'asc' },
      take: 5,
    }),
    // Factures en retard
    prisma.invoice.findMany({
      where: {
        status: { in: ['EN_ATTENTE', 'EN_RETARD'] },
        dueDate: { lt: now },
      },
      include: { client: true },
      take: 5,
    }),
    // Prospects à relancer
    prisma.client.findMany({
      where: {
        status: 'PROSPECT',
        relanceDate: { lte: now },
      },
      select: { id: true, name: true, company: true, relanceDate: true },
      orderBy: { relanceDate: 'asc' },
    }),
    // Paiements des 6 derniers mois pour le graphique
    prisma.$queryRaw`
      SELECT
        DATE_TRUNC('month', date) as month,
        SUM(amount) as total
      FROM payments
      WHERE confirmed = true
        AND date >= NOW() - INTERVAL '6 months'
      GROUP BY month
      ORDER BY month ASC
    ` as Promise<Array<{ month: Date; total: number }>>,
    // Stats acquisition
    prisma.leadCall.findMany({
      select: { showedUp: true, qualified: true, lead: { select: { convertedClientId: true, status: { select: { isClosed: true } } } } },
    }),
    // Leads avec follow-up aujourd'hui ou en retard
    prisma.lead.findMany({
      where: { followUpDate: { lte: now }, convertedClientId: null },
      select: { id: true, name: true, company: true, followUpDate: true },
      orderBy: { followUpDate: 'asc' },
    }),
    // MRR global (retainers actifs avec client)
    prisma.clientRetainer.findMany({
      where: { startDate: { lte: now } },
      include: { client: { select: { id: true, name: true, company: true } } },
      orderBy: { startDate: 'asc' },
    }),
    // Réunions CEO à venir
    prisma.ceoMeeting.findMany({
      where: { date: { gte: now } },
      orderBy: { date: 'asc' },
      take: 5,
    }),
    // Daily checkin du jour
    prisma.userDailyCheckin.findFirst({
      where: { userId, date: todayStr() },
    }),
    // Bilans planifiés dans les 7 prochains jours
    prisma.client.findMany({
      where: {
        status: 'ACTIF',
        nextBilanDate: { gte: now, lte: new Date(now.getTime() + 7 * 86_400_000) },
      },
      select: { id: true, name: true, company: true, nextBilanDate: true },
      orderBy: { nextBilanDate: 'asc' },
    }),
    // Factures (toutes) pour le filtre "payé ce mois" des retainers MRR
    prisma.invoice.findMany({
      where: {
        status: { in: ['EN_ATTENTE', 'PARTIELLEMENT_PAYÉE', 'EN_RETARD', 'PAYÉE'] },
        type:   { in: ['TOTALE', 'SOLDE'] },
      },
      orderBy: { createdAt: 'desc' },
      select:  { id: true, clientId: true, status: true, totalTTC: true },
    }),
  ])

  const caMonthVal = caMonth._sum.amount || 0
  const caLastMonthVal = caLastMonth._sum.amount || 0
  const trend = caLastMonthVal > 0
    ? Math.round(((caMonthVal - caLastMonthVal) / caLastMonthVal) * 100)
    : 0

  const totalCalls = leadCalls.length
  const showedUp = leadCalls.filter(c => c.showedUp).length
  const qualified = leadCalls.filter(c => c.qualified).length
  const converted = leadCalls.filter(c => c.lead?.convertedClientId).length
  const showupRate = totalCalls > 0 ? Math.round((showedUp / totalCalls) * 100) : 0
  const qualifRate = showedUp > 0 ? Math.round((qualified / showedUp) * 100) : 0
  const closingRate = qualified > 0 ? Math.round((converted / qualified) * 100) : 0

  // Séparation today vs overdue pour les leads follow-up
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(todayStart.getTime() + 86_400_000)

  // MRR = retainers dont la date de fin > now
  const currentMRR = allRetainers.reduce((sum, r) => {
    const end = new Date(r.startDate)
    end.setMonth(end.getMonth() + r.durationMonths)
    return end > now ? sum + r.monthlyAmount : sum
  }, 0)

  const nextMeeting = upcomingCeoMeetings[0] ?? null

  // Réunion CEO dans moins de 48h
  const ceoMeetingSoon = nextMeeting && (new Date(nextMeeting.date).getTime() - now.getTime()) < 48 * 3600 * 1000
    ? nextMeeting
    : null

  // Index : dernière facture (tous statuts) par client → pour filtrer les payés
  const latestInvoiceByClient = new Map<string, typeof allClientInvoices[0]>()
  for (const inv of allClientInvoices) {
    if (!latestInvoiceByClient.has(inv.clientId)) {
      latestInvoiceByClient.set(inv.clientId, inv) // déjà trié desc → premier = plus récent
    }
  }

  // Retainers actifs + alertes fin de contrat (15 jours)
  const activeRetainers = allRetainers.filter(r => {
    const end = new Date(r.startDate)
    end.setMonth(end.getMonth() + r.durationMonths)
    return end > now
  })
  const retainersEndingSoon = allRetainers
    .map(r => {
      const end = new Date(r.startDate)
      end.setMonth(end.getMonth() + r.durationMonths)
      const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86_400_000)
      return { ...r, endDate: end.toISOString(), daysLeft }
    })
    .filter(r => r.daysLeft > 0 && r.daysLeft <= 15)
    .sort((a, b) => a.daysLeft - b.daysLeft)

  return {
    caMonth: caMonthVal,
    caYear: caYear._sum.amount || 0,
    trend,
    activeClients,
    activeProjects,
    pendingInvoices,
    urgentTasks,
    recentProjects,
    overdueInvoices,
    prospectsToRelance,
    monthlyPayments,
    acquisition: { totalCalls, showupRate, qualifRate, closingRate },
    currentMRR,
    ceoMeetingSoon: ceoMeetingSoon ? { ...ceoMeetingSoon, date: ceoMeetingSoon.date.toISOString() } : null,
    upcomingMeetings: upcomingCeoMeetings.map(m => ({ id: m.id, title: m.title, date: m.date.toISOString() })),
    checkinDone: !!todayCheckin,
    // Seulement les retainers dont le client n'a PAS encore payé sa dernière facture
    activeRetainers: activeRetainers.filter(r => r.client).filter(r => {
      const latestInv = latestInvoiceByClient.get(r.client!.id)
      return !latestInv || latestInv.status !== 'PAYÉE'
    }).map(r => {
      const inv = latestInvoiceByClient.get(r.client!.id) ?? null
      return {
        id:            r.id,
        clientId:      r.client!.id,
        clientName:    r.client!.name,
        clientCompany: r.client!.company,
        monthlyAmount: r.monthlyAmount,
        durationMonths: r.durationMonths,
        startDate:     r.startDate.toISOString(),
        description:   r.description,
        invoiceId:     inv?.id ?? null,
        invoiceTTC:    inv?.totalTTC ?? r.monthlyAmount,
      }
    }),
    retainersEndingSoon: retainersEndingSoon.filter(r => r.client).map(r => ({
      id: r.id,
      clientId: r.client!.id,
      clientName: r.client!.name,
      clientCompany: r.client!.company,
      monthlyAmount: r.monthlyAmount,
      daysLeft: r.daysLeft,
      endDate: r.endDate,
    })),
    leadsFollowUp: leadsFollowUp.map(l => ({
      ...l,
      followUpDate: l.followUpDate!.toISOString(),
      isToday: l.followUpDate! >= todayStart && l.followUpDate! < todayEnd,
    })),
    upcomingBilans: upcomingBilans.map(c => ({
      id: c.id,
      name: c.name,
      company: c.company,
      nextBilanDate: c.nextBilanDate!.toISOString(),
    })),
  }
}

const projectStatusLabel: Record<string, string> = {
  BRIEF_REÇU: 'Brief reçu',
  EN_PRODUCTION: 'En production',
  EN_POST_PRODUCTION: 'Post-prod',
  EN_VALIDATION: 'Validation',
  LIVRÉ: 'Livré',
  ARCHIVÉ: 'Archivé',
}

const projectStatusBadge: Record<string, 'info' | 'warning' | 'orange' | 'purple' | 'success' | 'muted'> = {
  BRIEF_REÇU: 'info',
  EN_PRODUCTION: 'warning',
  EN_POST_PRODUCTION: 'orange',
  EN_VALIDATION: 'purple',
  LIVRÉ: 'success',
  ARCHIVÉ: 'muted',
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) return null

  const data = await getDashboardData(session.user.id)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Popup daily checkin to-do */}
      <DailyCheckinModal initialDone={data.checkinDone} />

      {/* Popup relances leads */}
      <LeadFollowUpModal leads={data.leadsFollowUp} />

      {/* Banner réunion CEO imminente */}
      {data.ceoMeetingSoon && (
        <Link href="/ceo" className="flex items-center gap-3 p-4 rounded-xl border border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
            <Briefcase size={16} className="text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Réunion CEO dans moins de 48h</p>
            <p className="text-xs text-nv-text-muted">{data.ceoMeetingSoon.title} — {new Date(data.ceoMeetingSoon.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <ArrowRight size={15} className="text-primary shrink-0" />
        </Link>
      )}

      {/* Titre */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Bonjour, {session.user.name.split(' ')[0]} 👋
        </h1>
        <p className="text-nv-text-muted text-sm mt-1">
          Voici l&apos;état de votre agence aujourd&apos;hui
        </p>
      </div>

      {/* Banner relances prospects */}
      {data.prospectsToRelance.length > 0 && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-amber-400/20 flex items-center justify-center">
              <Bell size={14} className="text-amber-400" />
            </div>
            <p className="text-sm font-semibold text-amber-300">
              {data.prospectsToRelance.length} relance{data.prospectsToRelance.length > 1 ? 's' : ''} en attente
            </p>
          </div>
          <div className="space-y-2">
            {data.prospectsToRelance.map(p => {
              const days = Math.floor((new Date().getTime() - new Date(p.relanceDate!).getTime()) / 86400000)
              return (
                <Link key={p.id} href={`/clients/${p.id}`}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-amber-400/5 border border-amber-400/10 hover:border-amber-400/30 hover:bg-amber-400/10 transition-colors group">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-amber-400/20 flex items-center justify-center text-xs font-bold text-amber-400">
                      {p.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{p.name}</p>
                      {p.company && <p className="text-xs text-nv-text-muted">{p.company}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">
                      {days === 0 ? "Aujourd'hui" : `+${days}j de retard`}
                    </span>
                    <ArrowRight size={13} className="text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Banner leads follow-up */}
      {data.leadsFollowUp.length > 0 && (
        <div className={`rounded-xl border p-4 ${
          data.leadsFollowUp.some(l => !l.isToday)
            ? 'border-red-500/30 bg-red-500/5'
            : 'border-amber-400/30 bg-amber-400/5'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
              data.leadsFollowUp.some(l => !l.isToday) ? 'bg-red-500/20' : 'bg-amber-400/20'
            }`}>
              <Bell size={14} className={data.leadsFollowUp.some(l => !l.isToday) ? 'text-red-400' : 'text-amber-400'} />
            </div>
            <p className={`text-sm font-semibold ${
              data.leadsFollowUp.some(l => !l.isToday) ? 'text-red-300' : 'text-amber-300'
            }`}>
              {data.leadsFollowUp.length} follow-up{data.leadsFollowUp.length > 1 ? 's' : ''} lead{data.leadsFollowUp.length > 1 ? 's' : ''} — Acquisition
            </p>
            <Link href="/acquisition" className="ml-auto text-xs text-nv-text-muted hover:text-white transition-colors flex items-center gap-1">
              Voir <ArrowRight size={11} />
            </Link>
          </div>
          <div className="space-y-2">
            {data.leadsFollowUp.map(lead => {
              const overdue = !lead.isToday
              const days = Math.floor((new Date().getTime() - new Date(lead.followUpDate).getTime()) / 86_400_000)
              return (
                <Link key={lead.id} href="/acquisition"
                  className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors group ${
                    overdue
                      ? 'bg-red-500/5 border-red-500/10 hover:border-red-500/30 hover:bg-red-500/10'
                      : 'bg-amber-400/5 border-amber-400/10 hover:border-amber-400/30 hover:bg-amber-400/10'
                  }`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      overdue ? 'bg-red-500/20 text-red-400' : 'bg-amber-400/20 text-amber-400'
                    }`}>
                      {lead.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{lead.name}</p>
                      {lead.company && <p className="text-xs text-nv-text-muted">{lead.company}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      overdue ? 'bg-red-500/20 text-red-400' : 'bg-amber-400/20 text-amber-400'
                    }`}>
                      {days === 0 ? "Aujourd'hui" : `+${days}j de retard`}
                    </span>
                    <ArrowRight size={13} className={`opacity-0 group-hover:opacity-100 transition-opacity ${overdue ? 'text-red-400' : 'text-amber-400'}`} />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="CA du mois"
          value={formatCurrency(data.caMonth)}
          icon={TrendingUp}
          trend={data.trend}
          color="primary"
          subtitle={`${formatCurrency(data.caYear)} cette année`}
        />
        <StatCard
          title="MRR actuel"
          value={formatCurrency(data.currentMRR)}
          icon={RepeatIcon}
          color="success"
          subtitle="Revenu récurrent / mois"
        />
        <StatCard
          title="Projets en cours"
          value={String(data.activeProjects)}
          icon={FolderKanban}
          color="warning"
        />
        <StatCard
          title="Factures impayées"
          value={String(data.pendingInvoices)}
          icon={Receipt}
          color={data.pendingInvoices > 0 ? 'danger' : 'success'}
        />
      </div>

      {/* ── Alertes fin de contrat MRR (15 jours) ── */}
      {data.retainersEndingSoon.length > 0 && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-400/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={15} className="text-amber-400 shrink-0" />
            <p className="text-sm font-semibold text-amber-300">
              {data.retainersEndingSoon.length} contrat{data.retainersEndingSoon.length > 1 ? 's' : ''} MRR se termine{data.retainersEndingSoon.length > 1 ? 'nt' : ''} dans moins de 15 jours
            </p>
            <Link href="/finance" className="ml-auto text-xs text-nv-text-muted hover:text-white flex items-center gap-1 transition-colors">
              Finance <ArrowRight size={11} />
            </Link>
          </div>
          <div className="space-y-2">
            {data.retainersEndingSoon.map(r => (
              <Link key={r.id} href={`/clients/${r.clientId}`}
                className="flex items-center justify-between p-2.5 rounded-lg bg-amber-400/5 border border-amber-400/15 hover:border-amber-400/35 hover:bg-amber-400/10 transition-colors group">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-amber-400/20 flex items-center justify-center text-xs font-bold text-amber-300 shrink-0">
                    {r.clientName.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{r.clientName}</p>
                    {r.clientCompany && <p className="text-xs text-nv-text-muted">{r.clientCompany}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold text-amber-300">
                    {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(r.monthlyAmount)}/mois
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${r.daysLeft <= 7 ? 'bg-red-500/20 text-red-300' : 'bg-amber-400/20 text-amber-300'}`}>
                    J-{r.daysLeft}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Clients MRR actifs — à facturer ce mois (filtre auto si payé) ── */}
      <MrrSection retainers={data.activeRetainers} />

      {/* Réunions CEO à venir */}
      {data.upcomingMeetings.length > 0 && (
        <div className="rounded-xl border border-nv-border bg-nv-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Briefcase size={15} className="text-primary" />
              <p className="text-sm font-semibold text-white">Réunions à venir</p>
            </div>
            <Link href="/ceo" className="text-xs text-nv-text-muted hover:text-primary transition-colors flex items-center gap-1">
              Voir tout <ArrowRight size={11} />
            </Link>
          </div>
          <div className="space-y-2">
            {data.upcomingMeetings.map(meeting => {
              const msUntil = new Date(meeting.date).getTime() - Date.now()
              const daysUntilMeeting = Math.ceil(msUntil / 86_400_000)
              const isSoon = msUntil < 48 * 3600 * 1000
              return (
                <Link key={meeting.id} href="/ceo"
                  className="flex items-center justify-between p-2.5 rounded-lg border border-nv-border hover:border-primary/30 hover:bg-white/3 transition-colors group">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isSoon ? 'bg-primary/20' : 'bg-nv-border'}`}>
                      <Calendar size={13} className={isSoon ? 'text-primary' : 'text-nv-text-muted'} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{meeting.title}</p>
                      <p className="text-xs text-nv-text-muted">
                        {new Date(meeting.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isSoon && <span className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary rounded-full font-medium">Bientôt</span>}
                    <span className={`text-xs ${isSoon ? 'text-primary font-medium' : 'text-nv-text-muted'}`}>
                      {daysUntilMeeting <= 0 ? "Aujourd'hui" : daysUntilMeeting === 1 ? 'Demain' : `Dans ${daysUntilMeeting}j`}
                    </span>
                    <ArrowRight size={13} className="text-nv-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Bilans mensuels à venir */}
      {data.upcomingBilans.length > 0 && (
        <div className="rounded-xl border border-blue-400/30 bg-blue-400/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-blue-400/20 flex items-center justify-center">
              <Phone size={13} className="text-blue-400" />
            </div>
            <p className="text-sm font-semibold text-blue-300">
              {data.upcomingBilans.length} bilan{data.upcomingBilans.length > 1 ? 's' : ''} mensuel{data.upcomingBilans.length > 1 ? 's' : ''} cette semaine
            </p>
            <Link href="/clients" className="ml-auto text-xs text-nv-text-muted hover:text-white transition-colors flex items-center gap-1">
              Clients <ArrowRight size={11} />
            </Link>
          </div>
          <div className="space-y-2">
            {data.upcomingBilans.map(c => {
              const d = new Date(c.nextBilanDate)
              const daysLeft = Math.ceil((d.getTime() - Date.now()) / 86_400_000)
              return (
                <Link key={c.id} href={`/clients/${c.id}`}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-blue-400/5 border border-blue-400/10 hover:border-blue-400/30 hover:bg-blue-400/10 transition-colors group">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-blue-400/20 flex items-center justify-center text-xs font-bold text-blue-400 shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{c.name}</p>
                      {c.company && <p className="text-xs text-nv-text-muted">{c.company}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-blue-300">
                      {d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${daysLeft <= 1 ? 'bg-blue-400/30 text-blue-200' : 'bg-blue-400/15 text-blue-300'}`}>
                      {daysLeft <= 0 ? "Aujourd'hui" : daysLeft === 1 ? 'Demain' : `Dans ${daysLeft}j`}
                    </span>
                    <ArrowRight size={13} className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Stats acquisition */}
      {data.acquisition.totalCalls > 0 && (
        <div className="rounded-xl border border-nv-border bg-nv-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Crosshair size={15} className="text-primary" />
            <p className="text-sm font-semibold text-white">Performance commerciale</p>
            <Link href="/acquisition" className="ml-auto text-xs text-nv-text-muted hover:text-primary transition-colors flex items-center gap-1">
              Voir l&apos;acquisition <ArrowRight size={11} />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <PhoneCall size={13} className="text-blue-400" />
                <span className="text-xs text-nv-text-muted">Taux show-up</span>
              </div>
              <p className="text-xl font-bold text-blue-400">{data.acquisition.showupRate}%</p>
              <p className="text-xs text-nv-text-faint">{data.acquisition.totalCalls} appels</p>
            </div>
            <div className="text-center border-x border-nv-border">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <CheckCircle2 size={13} className="text-amber-400" />
                <span className="text-xs text-nv-text-muted">Taux qualification</span>
              </div>
              <p className="text-xl font-bold text-amber-400">{data.acquisition.qualifRate}%</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <UserCheck size={13} className="text-emerald-400" />
                <span className="text-xs text-nv-text-muted">Taux de closing</span>
              </div>
              <p className="text-xl font-bold text-emerald-400">{data.acquisition.closingRate}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Graphique + Alertes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graphique CA */}
        <div className="lg:col-span-2">
          <DashboardCharts monthlyData={data.monthlyPayments} />
        </div>

        {/* Alertes */}
        <div className="space-y-4">
          {/* Factures en retard */}
          {data.overdueInvoices.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-400">
                  <AlertTriangle size={16} />
                  Factures en retard ({data.overdueInvoices.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.overdueInvoices.map((inv) => (
                  <Link
                    key={inv.id}
                    href={`/invoices/${inv.id}`}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors group"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{inv.client?.name ?? '—'}</p>
                      <p className="text-xs text-nv-text-muted">{inv.number}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium text-red-400">{formatCurrency(inv.totalTTC - inv.amountPaid)}</p>
                    </div>
                  </Link>
                ))}
                <Link href="/invoices?filter=retard" className="flex items-center gap-1 text-xs text-nv-text-muted hover:text-white transition-colors mt-2">
                  Voir tout <ArrowRight size={12} />
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Tâches urgentes */}
          {data.urgentTasks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-400">
                  <Clock size={16} />
                  Tâches urgentes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.urgentTasks.map((task) => (
                  <Link
                    key={task.id}
                    href={`/tasks?id=${task.id}`}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors"
                  >
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

      {/* Projets actifs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FolderKanban size={16} className="text-primary" />
              Projets actifs
            </CardTitle>
            <Link href="/projects" className="text-xs text-nv-text-muted hover:text-primary transition-colors flex items-center gap-1">
              Voir tout <ArrowRight size={12} />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.recentProjects.map((project) => {
              const days = daysUntil(project.deadline)
              const overdue = isOverdue(project.deadline)
              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-nv-border hover:border-nv-border-light hover:bg-white/3 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <FolderKanban size={14} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{project.title}</p>
                      <p className="text-xs text-nv-text-muted">{project.client?.name ?? '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant={projectStatusBadge[project.status] || 'muted'}>
                      {projectStatusLabel[project.status]}
                    </Badge>
                    {project.deadline && (
                      <span className={`text-xs ${overdue ? 'text-red-400' : days !== null && days <= 3 ? 'text-yellow-400' : 'text-nv-text-muted'}`}>
                        {overdue ? `${Math.abs(days!)}j retard` : days !== null ? `J-${days}` : ''}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
            {data.recentProjects.length === 0 && (
              <div className="text-center py-8 text-nv-text-muted">
                <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-400" />
                <p className="text-sm">Aucun projet actif</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
