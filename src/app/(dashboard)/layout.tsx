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

  // Compter les notifications non lues
  const notifCount = await prisma.notification.count({
    where: { userId: session.user.id, read: false },
  })

  return (
    <DashboardShell
      user={session.user}
      notifCount={notifCount}
    >
      {children}
    </DashboardShell>
  )
}
