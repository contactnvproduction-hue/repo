import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ProjectsHeader } from '@/components/projects/ProjectsHeader'
import { ProjectFrise } from '@/components/projects/ProjectFrise'
import { PRODUCTION_STEPS } from '@/lib/production-steps'
import { FolderKanban } from 'lucide-react'

interface PageProps {
  searchParams: Promise<{ search?: string }>
}

export default async function ProjectsPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user) return null

  const sp = await searchParams
  const search = sp.search || ''

  const projects = await prisma.project.findMany({
    where: {
      status: { not: 'ARCHIVÉ' },
      ...(search && { title: { contains: search, mode: 'insensitive' } }),
    },
    include: {
      client: { select: { id: true, name: true, company: true, avatar: true } },
      category: true,
      members: { include: { user: { select: { id: true, name: true, avatar: true } } } },
      onboardingSteps: true,
      _count: { select: { tasks: true } },
    },
    orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
  })

  const clients = await prisma.client.findMany({
    where: { status: { in: ['ACTIF', 'PROSPECT'] } },
    select: { id: true, name: true, company: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <FolderKanban size={24} className="text-primary" />
            Projets
          </h1>
          <p className="text-sm text-nv-text-muted mt-1">
            {projects.length} projet{projects.length !== 1 ? 's' : ''} actif{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <ProjectsHeader clients={clients} />
      </div>

      <div className="space-y-2">
        {/* Steps legend */}
        <div className="flex items-center gap-1 text-[10px] text-nv-text-faint flex-wrap px-1 pb-1 border-b border-nv-border/50">
          {PRODUCTION_STEPS.map((s, i) => (
            <span key={s.id} className="flex items-center gap-0.5">
              {i > 0 && <span className="text-nv-border mx-0.5">›</span>}
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </span>
          ))}
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-16 text-nv-text-muted">
            <FolderKanban size={40} className="mx-auto mb-3 opacity-20" />
            <p>Aucun projet actif</p>
          </div>
        ) : (
          projects.map(project => (
            <ProjectFrise
              key={project.id}
              project={{
                id: project.id,
                title: project.title,
                status: project.status,
                productionStep: (project as any).productionStep ?? 0,
                deadline: project.deadline,
                client: project.client ? {
                  id: project.client.id,
                  name: project.client.name,
                  company: project.client.company,
                  avatar: project.client.avatar ?? null,
                } : { id: '', name: '—', company: null, avatar: null },
                category: project.category,
                members: project.members ?? [],
              }}
            />
          ))
        )}
      </div>
    </div>
  )
}
