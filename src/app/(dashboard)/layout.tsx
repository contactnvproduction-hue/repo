import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { DashboardShell } from '@/components/layout/DashboardShell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  // Fetch notifs + avatar in parallel (avatar no longer in JWT to keep token small)
  const [notifCount, currentUser] = await Promise.all([
    prisma.notification.count({ where: { userId: session.user.id, read: false } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { avatar: true } }),
  ])

  const userWithAvatar = { ...session.user, avatar: currentUser?.avatar ?? null }

  return (
    <DashboardShell
      user={userWithAvatar}
      notifCount={notifCount}
    >
      {children}
    </DashboardShell>
  )
}
