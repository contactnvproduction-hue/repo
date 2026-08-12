import { prisma } from '@/lib/db'
import { ProgrammingForm } from '@/components/programming/ProgrammingForm'

export const dynamic = 'force-dynamic'

export default async function ProgrammationPage() {
  const [clients, progs] = await Promise.all([
    prisma.client.findMany({ where: { status: { not: 'ARCHIVÉ' } }, select: { id: true, name: true, company: true }, orderBy: { name: 'asc' } }).catch(() => []),
    (async () => { try { return await (prisma as any).clientProgramming.findMany({ select: { clientId: true, accessCode: true, accessPassword: true } }) } catch { return [] } })(),
  ])
  const hasCode = new Set((progs as any[]).filter(p => p.accessCode && p.accessPassword).map(p => p.clientId))

  return <ProgrammingForm clients={clients.map(c => ({ id: c.id, name: c.name, company: c.company, hasCode: hasCode.has(c.id) }))} />
}
