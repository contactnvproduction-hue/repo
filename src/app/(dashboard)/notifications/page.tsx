import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Bell, CheckCheck } from 'lucide-react'
import { NotificationsActions } from '@/components/notifications/NotificationsActions'

const typeIcon: Record<string, string> = {
  INFO: '💬',
  SUCCESS: '✅',
  WARNING: '⚠️',
  ERROR: '❌',
}

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
              <div
                key={notif.id}
                className={`flex items-start gap-4 px-6 py-4 border-b border-nv-border/50 transition-colors ${
                  !notif.read ? 'bg-primary/5' : 'hover:bg-white/2'
                }`}
              >
                <div className="text-xl mt-0.5 shrink-0">{typeIcon[notif.type] || '💬'}</div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!notif.read ? 'text-white font-medium' : 'text-nv-text-muted'}`}>
                    {notif.message}
                  </p>
                  <p className="text-xs text-nv-text-faint mt-1">{formatDate(notif.createdAt)}</p>
                </div>
                {!notif.read && (
                  <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
