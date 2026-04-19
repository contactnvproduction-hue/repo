import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Calendar } from 'lucide-react'
import { PlanningCalendar } from '@/components/planning/PlanningCalendar'

export default async function PlanningPage() {
  const session = await auth()
  if (!session?.user) return null

  const projects = await prisma.project.findMany({
    where: { status: { not: 'ARCHIVÉ' }, deadline: { not: null } },
    include: {
      client: { select: { name: true } },
      members: { include: { user: { select: { id: true, name: true } } } },
    },
    orderBy: { deadline: 'asc' },
  })

  const users = await prisma.user.findMany({
    select: { id: true, name: true, role: true, disponible: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Calendar size={24} className="text-primary" />
          Planning
        </h1>
        <p className="text-sm text-nv-text-muted mt-1">Calendrier des projets et disponibilités de l'équipe</p>
      </div>
      <PlanningCalendar projects={projects} users={users} />
    </div>
  )
}
