import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { ensureInvoiceReminder } from '@/lib/invoice-reminder'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  // Rappel factures freelances à partir du 28 (idempotent, admins uniquement)
  await ensureInvoiceReminder(prisma, { id: session.user.id, role: session.user.role })

  // Fetch notifs + avatar + rôle frais en parallèle (le rôle en base fait foi,
  // pas le JWT figé — un changement de rôle est pris en compte au prochain chargement)
  const [notifCount, currentUser, recipients, received] = await Promise.all([
    prisma.notification.count({ where: { userId: session.user.id, read: false } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { avatar: true, role: true, roles: true } as any }),
    prisma.user.findMany({ where: { hasLogin: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }).catch(() => []),
    (async () => { try { return await (prisma as any).internalMessage.findMany({ where: { recipientId: session.user.id }, orderBy: { createdAt: 'desc' }, take: 100 }) } catch { return [] } })(),
  ])

  const userWithAvatar: any = {
    ...session.user,
    avatar: currentUser?.avatar ?? null,
    role: (currentUser as any)?.role ?? session.user.role,
    roles: (currentUser as any)?.roles ?? session.user.roles ?? [],
  }

  // Filet de sécurité : Noah Rapharin = ADMIN (principal) + COMMERCIAL (additionnel),
  // appliqué immédiatement dès l'ouverture de n'importe quelle page du dashboard.
  const isNoah = session.user.email === 'nrapharin@gmail.com' || /rapharin/i.test(session.user.name || '')
  if (isNoah && (userWithAvatar.role !== 'ADMIN' || !userWithAvatar.roles.includes('COMMERCIAL'))) {
    const base: string[] = Array.isArray(userWithAvatar.roles) ? userWithAvatar.roles : []
    const nextRoles = Array.from(new Set([...base, ...(userWithAvatar.role !== 'ADMIN' && userWithAvatar.role !== 'COMMERCIAL' ? [userWithAvatar.role] : []), 'COMMERCIAL'])).filter((r: string) => r !== 'ADMIN')
    await prisma.user.update({ where: { id: session.user.id }, data: { role: 'ADMIN', roles: nextRoles } as any }).catch(() => {})
    userWithAvatar.role = 'ADMIN'
    userWithAvatar.roles = nextRoles
  }
  const initialReceived = (received as any[]).map(m => ({ ...m, createdAt: new Date(m.createdAt).toISOString() }))

  return (
    <DashboardShell
      user={userWithAvatar}
      notifCount={notifCount}
      messageRecipients={recipients}
      initialMessages={initialReceived}
    >
      {children}
    </DashboardShell>
  )
}
