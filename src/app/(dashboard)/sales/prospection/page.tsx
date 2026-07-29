import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ProspectionPipeline } from '@/components/sales/ProspectionPipeline'

export const dynamic = 'force-dynamic'

export default async function ProspectionPage() {
  const session = await auth()
  if (!session?.user) return null
  const isAdmin = ['ADMIN', 'MANAGER'].includes(session.user.role)

  const [allLeads, users, settings] = await Promise.all([
    (prisma as any).lead.findMany({ orderBy: { createdAt: 'desc' } }).catch(() => []),
    prisma.user.findMany({ select: { id: true, name: true, avatar: true, role: true }, orderBy: { name: 'asc' } }),
    prisma.agencySetting.findFirst(),
  ])

  const leads = (allLeads as any[]).map(l => ({
    id: l.id, name: l.name, company: l.company, email: l.email, phone: l.phone,
    source: l.source, notes: l.notes, commercialId: l.commercialId ?? null,
    followUpDate: l.followUpDate ? new Date(l.followUpDate).toISOString() : null,
    rdvBookedAt: l.rdvBookedAt ? new Date(l.rdvBookedAt).toISOString() : null,
    rdvDate: l.rdvDate ? new Date(l.rdvDate).toISOString() : null,
    saleMonthlyAmount: l.saleMonthlyAmount ?? null,
    wonAt: l.wonAt ? new Date(l.wonAt).toISOString() : null,
    lostAt: l.lostAt ? new Date(l.lostAt).toISOString() : null,
    createdAt: new Date(l.createdAt).toISOString(),
  }))

  // Commerciaux = rôle COMMERCIAL en priorité ; sinon tous les membres (Léo apparaît quoi qu'il arrive)
  const commercialUsers = users.filter(u => u.role === 'COMMERCIAL')
  const commercials = (commercialUsers.length > 0 ? commercialUsers : users).map(u => ({ id: u.id, name: u.name, avatar: u.avatar }))

  return (
    <div className="animate-fade-in">
      <ProspectionPipeline
        leads={leads}
        commercials={commercials}
        settings={{
          commissionPerBookedCall: (settings as any)?.commissionPerBookedCall ?? 0,
          commissionPercent: (settings as any)?.commissionPercent ?? 0,
        }}
        isAdmin={isAdmin}
      />
    </div>
  )
}
