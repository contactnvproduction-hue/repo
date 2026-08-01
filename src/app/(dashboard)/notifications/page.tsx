import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Card, CardContent } from '@/components/ui/card'
import { Bell } from 'lucide-react'
import { NotificationsActions } from '@/components/notifications/NotificationsActions'
import { NotificationRow } from '@/components/notifications/NotificationRow'

export default async function NotificationsPage() {
  const session = await auth()
  if (!session?.user) return null

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })

  const unread = notifications.filter((n) => !n.read).length

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Bell size={24} className="text-primary" />
            Notifications
          </h1>
          <p className="text-sm text-nv-text-muted mt-1">
            {unread > 0 ? `${unread} non lue${unread > 1 ? 's' : ''}` : 'Tout est lu'}
          </p>
        </div>
        {unread > 0 && <NotificationsActions userId={session.user.id} />}
      </div>

      <Card>
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <div className="text-center py-16 text-nv-text-muted">
              <Bell size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucune notification</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <NotificationRow key={notif.id} notif={{ id: notif.id, type: notif.type, title: notif.title, message: notif.message, link: notif.link, read: notif.read, createdAt: notif.createdAt.toISOString() }} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
