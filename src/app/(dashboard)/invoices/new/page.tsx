import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { SimpleDocumentForm } from '@/components/billing/SimpleDocumentForm'
import { Receipt } from 'lucide-react'
import Link from 'next/link'

interface PageProps {
  searchParams: Promise<{ clientId?: string; projectId?: string; amount?: string; fromQuote?: string }>
}

export default async function NewInvoicePage({ searchParams }: PageProps) {
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

  const fromQuoteLabel = sp.fromQuote ? `Facture — Devis ${sp.fromQuote}` : ''

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-sm text-nv-text-muted mb-2">
          <Link href="/invoices" className="hover:text-white transition-colors">Factures</Link>
          <span>/</span>
          <span className="text-white">Nouvelle</span>
        </div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Receipt size={22} className="text-primary" />
          Nouvelle facture
        </h1>
        {sp.fromQuote && (
          <p className="text-sm text-emerald-400 mt-1">Créée depuis le devis {sp.fromQuote}</p>
        )}
      </div>
      <SimpleDocumentForm
        type="invoice"
        clients={clients}
        projects={projects}
        preselectedClientId={sp.clientId}
        preselectedProjectId={sp.projectId}
        prefilledAmount={sp.amount}
        prefilledTitle={fromQuoteLabel}
      />
    </div>
  )
}
