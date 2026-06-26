import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users2 } from 'lucide-react'
import { TeamManager } from '@/components/team/TeamManager'
import { TeamAvailabilityEditor } from '@/components/team/TeamAvailabilityEditor'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { DailyFollowUpSection } from '@/components/team/DailyFollowUpSection'
import { UserAvatarUpload } from '@/components/team/UserAvatarUpload'

const roleLabel: Record<string, string> = {
  ADMIN: 'Administrateur', MANAGER: 'Manager', MONTEUR: 'Monteur',
  'VIDÉASTE': 'Vidéaste', PHOTOGRAPHE: 'Photographe', COMMERCIAL: 'Commercial',
}
const roleBadge: Record<string, 'danger' | 'purple' | 'warning' | 'info' | 'success' | 'muted'> = {
  ADMIN: 'danger', MANAGER: 'purple', MONTEUR: 'info',
  'VIDÉASTE': 'success', PHOTOGRAPHE: 'warning', COMMERCIAL: 'muted',
}

export default async function TeamPage() {
  const session = await auth()
  if (!session?.user) return null

  const todayStr = new Date().toISOString().slice(0, 10)

  const [users, availabilities, todayFollowUps] = await Promise.all([
    prisma.user.findMany({
      include: {
        assignedProjects: {
          include: { project: { select: { id: true, title: true, status: true } } },
          where: { project: { status: { notIn: ['LIVRÉ', 'ARCHIVÉ'] } } },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.teamAvailability.findMany({
      orderBy: { weekStart: 'desc' },
    }),
    prisma.dailyClientFollowUp.findMany({
      where: { date: todayStr },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  // Garder uniquement la disponibilité la plus récente par user
  const availByUser: Record<string, { hours: number; notes?: string | null }> = {}
  for (const a of availabilities) {
    if (!availByUser[a.userId]) {
      availByUser[a.userId] = { hours: a.hours, notes: a.notes }
    }
  }

  const isAdmin = ['ADMIN', 'MANAGER'].includes(session.user.role)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users2 size={24} className="text-primary" />
            Équipe
          </h1>
          <p className="text-sm text-nv-text-muted mt-1">{users.length} membres · {users.filter((u) => u.disponible).length} disponibles</p>
        </div>
        {isAdmin && <TeamManager />}
      </div>

      <DailyFollowUpSection
        members={users.map(u => ({ id: u.id, name: u.name, role: u.role, avatar: u.avatar, includeInSuivi: u.includeInSuivi }))}
        todayStr={todayStr}
        initialToday={todayFollowUps.map(e => ({
          id: e.id,
          memberName: e.memberName,
          date: e.date,
          clientNames: e.clientNames.length > 0 ? e.clientNames : (e.clientName ? [e.clientName] : []),
          types: e.types,
          notes: e.notes,
          createdAt: e.createdAt.toISOString(),
        }))}
        isAdmin={isAdmin}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {users.map((user) => (
          <Card key={user.id} className="hover:border-nv-border-light transition-colors group">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <UserAvatarUpload
                  userId={user.id}
                  currentAvatar={user.avatar}
                  name={user.name}
                  size={48}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white">{user.name}</p>
                    <Badge variant={roleBadge[user.role] || 'muted'} className="text-[10px]">{roleLabel[user.role] || user.role}</Badge>
                  </div>
                  <p className="text-xs text-nv-text-muted mt-0.5">{user.email}</p>
                  {user.specialty && <p className="text-xs text-primary mt-0.5">{user.specialty}</p>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${user.disponible ? 'bg-emerald-400' : 'bg-gray-400'}`} title={user.disponible ? 'Disponible' : 'Occupé'} />
                  {isAdmin && user.id !== session.user.id && (
                    <DeleteButton
                      endpoint={`/api/users/${user.id}`}
                      confirmMessage={`Supprimer le membre "${user.name}" ? Cette action est irréversible.`}
                      size={12}
                      className="opacity-0 group-hover:opacity-100"
                    />
                  )}
                </div>
              </div>

              {user.assignedProjects.length > 0 && (
                <div className="mt-4 pt-3 border-t border-nv-border">
                  <p className="text-xs text-nv-text-muted mb-2">Projets actifs ({user.assignedProjects.length})</p>
                  <div className="space-y-1">
                    {user.assignedProjects.slice(0, 3).map((pm) => (
                      <div key={pm.project?.id ?? pm.id ?? Math.random()} className="flex items-center gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-primary shrink-0" />
                        <p className="text-xs text-nv-text truncate">{pm.project?.title ?? '—'}</p>
                      </div>
                    ))}
                    {user.assignedProjects.length > 3 && (
                      <p className="text-xs text-nv-text-faint">+{user.assignedProjects.length - 3} autres</p>
                    )}
                  </div>
                </div>
              )}

              <TeamAvailabilityEditor
                userId={user.id}
                currentAvailability={availByUser[user.id] ?? null}
                isAdmin={isAdmin}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
