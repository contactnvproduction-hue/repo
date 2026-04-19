import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { SimpleDocumentForm } from '@/components/billing/SimpleDocumentForm'
import { FileText } from 'lucide-react'
import Link from 'next/link'

interface PageProps {
  searchParams: Promise<{ clientId?: string; projectId?: string }>
}

export default async function NewQuotePage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user) return null

  const sp = await searchParams

  const [clients, projects] = await Promise.all([
    prisma.client.findMany({
      where: { status: { in: ['ACTIF', 'PROSPECT'] } },
      select: { id: true, name: true, company: true },
      orderBy: { name: 'asc' },
    }),
    prisma.project.findMany({
      where: { status: { not: 'ARCHIVÉ' } },
      select: { id: true, title: true, clientId: true },
      orderBy: { title: 'asc' },
    }),
  ])

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-sm text-nv-text-muted mb-2">
          <Link href="/quotes" className="hover:text-white transition-colors">Devis</Link>
          <span>/</span>
          <span className="text-white">Nouveau</span>
        </div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <FileText size={22} className="text-primary" />
          Nouveau devis
        </h1>
        <p className="text-sm text-nv-text-muted mt-1">Référencez un devis avec son PDF et liez-le à un projet</p>
      </div>
      <SimpleDocumentForm
        type="quote"
        clients={clients}
        projects={projects}
        preselectedClientId={sp.clientId}
        preselectedProjectId={sp.projectId}
      />
    </div>
  )
}
