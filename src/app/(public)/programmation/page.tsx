import { prisma } from '@/lib/db'
import { ProgrammingForm } from '@/components/programming/ProgrammingForm'

export const dynamic = 'force-dynamic'

export default async function ProgrammationPage() {
  const clients = await prisma.client.findMany({
    where: { status: { not: 'ARCHIVÉ' } },
    select: { id: true, name: true, company: true },
    orderBy: { name: 'asc' },
  }).catch(() => [])

  return <ProgrammingForm clients={clients.map(c => ({ id: c.id, name: c.name, company: c.company }))} />
}
