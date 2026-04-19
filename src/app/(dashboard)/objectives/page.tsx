import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { formatCurrency, calcPercent, formatDate, daysUntil, isOverdue } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Target, Clock, AlertTriangle } from 'lucide-react'
import { ObjectivesManager } from '@/components/objectives/ObjectivesManager'
import { ObjectiveSnapshotPanel } from '@/components/objectives/ObjectiveSnapshotPanel'
import { DeleteButton } from '@/components/ui/DeleteButton'

// Calcul automatique de la valeur actuelle selon la catégorie
async function computeCurrentValues() {
  const now = new Date()
  const startYear = new Date(now.getFullYear(), 0, 1)

  const [caYear, newClients, projectsDone, teamSize] = await Promise.all([
    prisma.payment.aggregate({ where: { confirmed: true, date: { gte: startYear } }, _sum: { amount: true } }),
    prisma.client.count({ where: { createdAt: { gte: startYear } } }),
    prisma.project.count({ where: { status: 'LIVRÉ', updatedAt: { gte: startYear } } }),
    prisma.user.count(),
  ])

  return {
    CA: caYear._sum.amount || 0,
    NOUVEAUX_CLIENTS: newClients,
    'PROJETS_LIVRÉS': projectsDone,
    'CROISSANCE_ÉQUIPE': teamSize,
  }
}

export default async function ObjectivesPage() {
  const session = await auth()
  if (!session?.user) return null

  const [objectives, users] = await Promise.all([
    prisma.objective.findMany({
      include: {
        user: { select: { id: true, name: true } },
        snapshots: { orderBy: { date: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ])

  const autoValues = await computeCurrentValues()

  // Mettre à jour les valeurs actuelles pour les objectifs liés aux métriques auto
  const enrichedObjectives = objectives.map((obj) => {
    const auto = autoValues[obj.category as keyof typeof autoValues]
    // Pour les métriques auto, on utilise la valeur calculée
    // Pour les autres, on utilise le dernier snapshot s'il existe, sinon currentValue
    let currentValue: number
    if (auto !== undefined) {
      currentValue = auto
    } else if (obj.snapshots.length > 0) {
      // Dernier snapshot (snapshots triés par date asc, donc le dernier est le plus récent)
      currentValue = obj.snapshots[obj.snapshots.length - 1].value
    } else {
      currentValue = obj.currentValue
    }
    const progress = calcPercent(currentValue, obj.targetValue)
    return { ...obj, currentValue, progress }
  })

  const periodLabel: Record<string, string> = {
    MENSUEL: 'Mensuel', TRIMESTRIEL: 'Trimestriel', ANNUEL: 'Annuel',
  }
  const statusBadge: Record<string, 'success' | 'info' | 'danger' | 'warning'> = {
    EN_COURS: 'info', ATTEINT: 'success', ÉCHOUÉ: 'danger', EN_PAUSE: 'warning',
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Target size={24} className="text-primary" />
            Objectifs
          </h1>
          <p className="text-sm text-nv-text-muted mt-1">Suivez vos objectifs et progressions</p>
        </div>
        <ObjectivesManager users={users} />
      </div>

      {enrichedObjectives.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16 text-nv-text-muted">
            <Target size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucun objectif défini</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {enrichedObjectives.map((obj) => (
            <Card key={obj.id} className="hover:border-nv-border-light transition-colors group">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-nv-text-faint mb-0.5">{obj.category || '—'} · {periodLabel[obj.period]}</p>
                    <p className="text-sm font-semibold text-white leading-tight">{obj.title}</p>
                    {obj.user && <p className="text-xs text-nv-text-muted mt-0.5">{obj.user.name}</p>}
                  </div>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <Badge variant={statusBadge[obj.status] || 'info'}>
                      {obj.status === 'EN_COURS' ? 'En cours' : obj.status === 'ATTEINT' ? 'Atteint' : obj.status === 'ÉCHOUÉ' ? 'Échoué' : 'En pause'}
                    </Badge>
                    <DeleteButton
                      endpoint={`/api/objectives/${obj.id}`}
                      confirmMessage={`Supprimer l'objectif "${obj.title}" ?`}
                      size={13}
                      className="opacity-0 group-hover:opacity-100"
                    />
                  </div>
                </div>

                {/* Progression */}
                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-nv-text-muted">Progression</span>
                    <span className={`font-bold ${obj.progress >= 100 ? 'text-emerald-400' : 'text-white'}`}>{obj.progress}%</span>
                  </div>
                  <div className="h-2 bg-nv-border rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${obj.progress >= 100 ? 'bg-emerald-500' : obj.progress >= 75 ? 'bg-primary' : obj.progress >= 50 ? 'bg-yellow-500' : 'bg-orange-500'}`}
                      style={{ width: `${Math.min(obj.progress, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-nv-text-muted">
                    {obj.unit === '€' ? formatCurrency(obj.currentValue) : `${obj.currentValue} ${obj.unit}`}
                  </span>
                  <span className="text-white font-medium">
                    {obj.unit === '€' ? formatCurrency(obj.targetValue) : `${obj.targetValue} ${obj.unit}`}
                  </span>
                </div>

                {/* Deadline */}
                {obj.deadline && (() => {
                  const overdue = isOverdue(obj.deadline)
                  const days = daysUntil(obj.deadline)
                  return (
                    <div className={`flex items-center gap-1.5 text-xs mt-2 pt-2 border-t border-nv-border ${overdue ? 'text-red-400' : days !== null && days <= 7 ? 'text-yellow-500' : 'text-nv-text-muted'}`}>
                      {overdue ? <AlertTriangle size={11} /> : <Clock size={11} />}
                      {overdue
                        ? `Deadline dépassée (${formatDate(obj.deadline)})`
                        : days === 0
                        ? 'Deadline aujourd\'hui'
                        : `Deadline dans ${days}j — ${formatDate(obj.deadline)}`}
                    </div>
                  )
                })()}

                {/* Snapshots */}
                <ObjectiveSnapshotPanel
                  objective={{ id: obj.id, title: obj.title, targetValue: obj.targetValue, currentValue: obj.currentValue, unit: obj.unit }}
                  initialSnapshots={obj.snapshots.map(s => ({ ...s, date: s.date.toISOString() }))}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
