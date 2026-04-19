import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileArchive, Download, ExternalLink } from 'lucide-react'
import { DocumentManager } from '@/components/documents/DocumentManager'

const typeLabel: Record<string, string> = {
  CONTRAT: 'Contrat', BON_DE_COMMANDE: 'Bon de commande', BRIEF: 'Brief',
  CHARTE_GRAPHIQUE: 'Charte graphique', LIVRABLE: 'Livrable',
  FACTURE: 'Facture', DEVIS: 'Devis', AUTRE: 'Autre',
}
const typeBadge: Record<string, 'success' | 'info' | 'warning' | 'purple' | 'orange' | 'muted'> = {
  CONTRAT: 'success', BON_DE_COMMANDE: 'info', BRIEF: 'warning',
  CHARTE_GRAPHIQUE: 'purple', LIVRABLE: 'orange',
  FACTURE: 'success', DEVIS: 'info', AUTRE: 'muted',
}

export default async function DocumentsPage() {
  const session = await auth()
  if (!session?.user) return null

  const documents = await prisma.document.findMany({
    include: {
      client: { select: { id: true, name: true } },
      project: { select: { id: true, title: true } },
      uploadedBy: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const clients = await prisma.client.findMany({
    where: { status: { in: ['ACTIF', 'PROSPECT'] } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  const projects = await prisma.project.findMany({
    where: { status: { not: 'ARCHIVÉ' } },
    select: { id: true, title: true, clientId: true },
    orderBy: { title: 'asc' },
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <FileArchive size={24} className="text-primary" />
            Documents
          </h1>
          <p className="text-sm text-nv-text-muted mt-1">{documents.length} document{documents.length !== 1 ? 's' : ''}</p>
        </div>
        <DocumentManager clients={clients} projects={projects} userId={session.user.id} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="px-6 py-3 border-b border-nv-border grid grid-cols-12 gap-4 text-xs font-medium text-nv-text-muted uppercase tracking-wide">
            <div className="col-span-4">Document</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-2">Client</div>
            <div className="col-span-2">Projet</div>
            <div className="col-span-1">Uploadé par</div>
            <div className="col-span-1">Date</div>
          </div>
          {documents.length === 0 ? (
            <div className="text-center py-16 text-nv-text-muted">
              <FileArchive size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucun document</p>
            </div>
          ) : (
            documents.map((doc) => (
              <div key={doc.id} className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-nv-border/50 hover:bg-white/2 transition-colors items-center">
                <div className="col-span-4 min-w-0">
                  <a href={doc.url} target="_blank" rel="noopener noreferrer"
                    className="text-sm font-medium text-white hover:text-primary transition-colors truncate flex items-center gap-1.5">
                    <ExternalLink size={12} className="text-nv-text-muted shrink-0" />
                    {doc.name}
                  </a>
                </div>
                <div className="col-span-2">
                  <Badge variant={typeBadge[doc.type] || 'muted'} className="text-[10px]">{typeLabel[doc.type]}</Badge>
                </div>
                <div className="col-span-2 min-w-0">
                  {doc.client ? <p className="text-sm text-nv-text-muted truncate">{doc.client.name}</p> : <span className="text-nv-text-faint">—</span>}
                </div>
                <div className="col-span-2 min-w-0">
                  {doc.project ? <p className="text-sm text-nv-text-muted truncate">{doc.project.title}</p> : <span className="text-nv-text-faint">—</span>}
                </div>
                <div className="col-span-1">
                  {doc.uploadedBy ? <p className="text-xs text-nv-text-muted truncate">{doc.uploadedBy.name}</p> : <span className="text-nv-text-faint">—</span>}
                </div>
                <div className="col-span-1">
                  <p className="text-xs text-nv-text-muted">{formatDate(doc.createdAt)}</p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
