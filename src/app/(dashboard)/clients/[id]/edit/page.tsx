import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ClientEditForm } from '@/components/clients/ClientEditForm'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function ClientEditPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return null

  const { id } = await params
  const client = await prisma.client.findUnique({ where: { id } })
  if (!client) notFound()

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <Link href={`/clients/${id}`} className="flex items-center gap-2 text-sm text-nv-text-muted hover:text-white transition-colors mb-4">
          <ArrowLeft size={14} />
          Retour à la fiche client
        </Link>
        <h1 className="text-2xl font-bold text-white">Modifier {client.name}</h1>
      </div>
      <ClientEditForm client={client} />
    </div>
  )
}
