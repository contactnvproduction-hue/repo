import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Réservé aux admins et managers' }, { status: 403 })
  }

  const [
    clients, projects, quotes, invoices, payments,
    tasks, objectives, prestas, clientNotes, documents,
    agencySettings,
  ] = await Promise.all([
    prisma.client.findMany({ include: { interactions: true } }),
    prisma.project.findMany({ include: { members: true, onboardingSteps: true } }),
    prisma.quote.findMany({ include: { lines: true } }),
    prisma.invoice.findMany({ include: { lines: true, payments: true } }),
    prisma.payment.findMany(),
    prisma.task.findMany(),
    prisma.objective.findMany(),
    prisma.presta.findMany(),
    prisma.clientNote.findMany(),
    prisma.document.findMany(),
    prisma.agencySetting.findFirst(),
  ])

  const exportData = {
    exportedAt: new Date().toISOString(),
    exportedBy: session.user.name,
    version: '1.0',
    data: {
      clients,
      projects,
      quotes,
      invoices,
      payments,
      tasks,
      objectives,
      prestas,
      clientNotes,
      documents,
      agencySettings,
    },
  }

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="nv-backup-${new Date().toISOString().split('T')[0]}.json"`,
    },
  })
}
