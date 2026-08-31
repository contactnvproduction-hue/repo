import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Target } from 'lucide-react'
import { CallPipeline } from '@/components/sales/CallPipeline'
import { CallAgenda } from '@/components/sales/CallAgenda'

export const dynamic = 'force-dynamic'

export default async function ClosingPage() {
  const session = await auth()
  if (!session?.user) return null

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
    include: { status: true, calls: { orderBy: { date: 'desc' } } },
    orderBy: { createdAt: 'desc' },
  })
  const pipelineLeads = leads.map(l => ({
    id: l.id, name: l.name, company: l.company, email: l.email, phone: l.phone,
    statusId: l.statusId, convertedClientId: l.convertedClientId,
    wonAt: l.wonAt ? l.wonAt.toISOString() : null,
    saleMonthlyAmount: l.saleMonthlyAmount ?? null,
    createdAt: l.createdAt.toISOString(),
    status: l.status ? { id: l.status.id, name: l.status.name, color: l.status.color, isClosed: l.status.isClosed, order: l.status.order } : null,
    calls: l.calls.map((c: any) => ({
      id: c.id, leadId: l.id, date: c.date.toISOString(), duration: c.duration, round: c.round ?? null,
      showedUp: c.showedUp, qualified: c.qualified,
      closed: c.closed ?? false, followUpNeeded: c.followUpNeeded ?? false, followUpDone: c.followUpDone ?? false,
      notes: c.notes,
    })),
  }))
  const pipelineStatuses = statuses.map(s => ({ id: s.id, name: s.name, color: s.color, isClosed: s.isClosed, order: s.order }))
  const pipelineClients = await prisma.client.findMany({ where: { status: { not: 'ARCHIVÉ' } }, select: { id: true, name: true, company: true }, orderBy: { name: 'asc' } })
  const commercials = (await prisma.user.findMany({ where: { OR: [{ role: 'COMMERCIAL' }, { roles: { has: 'COMMERCIAL' } }] } as any, select: { id: true, name: true }, orderBy: { name: 'asc' } }).catch(() => []))
    .map(u => ({ id: u.id, name: u.name }))

  const nowDate = new Date()
  const nowMonthStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1)
  const sixMonthsStart = new Date(nowDate.getFullYear(), nowDate.getMonth() - 5, 1)
  const allClosings: any[] = await (async () => {
    try { return await (prisma as any).closingEvent.findMany({ where: { date: { gte: sixMonthsStart } }, orderBy: { date: 'asc' } }) } catch { return [] }
  })()
  const monthClosings = allClosings.filter(c => new Date(c.date) >= nowMonthStart)
  const closingsThisMonth = { count: monthClosings.length, amount: monthClosings.reduce((s, c) => s + (c.amount ?? 0), 0) }
  const closings6m = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - 5 + i, 1)
    const inM = allClosings.filter(c => { const cd = new Date(c.date); return cd.getFullYear() === d.getFullYear() && cd.getMonth() === d.getMonth() })
    return { year: d.getFullYear(), month: d.getMonth(), count: inM.length, amount: inM.reduce((s, c) => s + (c.amount ?? 0), 0), isCurrent: i === 5 }
  })
  const agencySettingsRow = await prisma.agencySetting.findFirst().catch(() => null)
  const closingScriptUrl = (agencySettingsRow as any)?.closingScriptUrl ?? null

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3"><Target size={24} className="text-primary" /> Pipeline closing</h1>
        <p className="text-sm text-nv-text-muted mt-1">Calls, taux de closing mois par mois et agenda des rendez-vous.</p>
      </div>
      <CallAgenda leads={pipelineLeads.map(l => ({ id: l.id, name: l.name, company: l.company, calls: l.calls.map(c => ({ id: c.id, date: c.date, showedUp: c.showedUp, qualified: c.qualified })) }))} />
      <CallPipeline initialLeads={pipelineLeads} statuses={pipelineStatuses} clients={pipelineClients} commercials={commercials} closingsThisMonth={closingsThisMonth} closings6m={closings6m} initialScriptUrl={closingScriptUrl} />
    </div>
  )
}
