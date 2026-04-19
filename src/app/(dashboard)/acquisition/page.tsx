import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Target } from 'lucide-react'
import { AcquisitionBoard } from '@/components/acquisition/AcquisitionBoard'

export default async function AcquisitionPage() {
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Target size={24} className="text-primary" />
          Acquisition
        </h1>
        <p className="text-sm text-nv-text-muted mt-1">
          Tracker de leads — suivez vos prospects de la prospection à la signature
        </p>
      </div>

      <AcquisitionBoard initialLeads={serialized} initialStatuses={serializedStatuses} />
    </div>
  )
}
