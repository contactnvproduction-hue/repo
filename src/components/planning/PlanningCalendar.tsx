'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Users, Calendar } from 'lucide-react'

interface Project {
  id: string
  title: string
  status: string
  type: string
  deadline?: Date | string | null
  startDate?: Date | string | null
  client: { name: string }
  members: Array<{ user: { id: string; name: string } }>
}

interface User { id: string; name: string; role: string; disponible: boolean }

const STATUS_COLOR: Record<string, string> = {
  BRIEF_REÇU: 'bg-blue-500/80', EN_PRODUCTION: 'bg-yellow-500/80',
  EN_POST_PRODUCTION: 'bg-orange-500/80', EN_VALIDATION: 'bg-purple-500/80',
  LIVRÉ: 'bg-emerald-500/80', ARCHIVÉ: 'bg-gray-500/80',
}
const STATUS_LABEL: Record<string, string> = {
  BRIEF_REÇU: 'Brief', EN_PRODUCTION: 'Prod', EN_POST_PRODUCTION: 'Post',
  EN_VALIDATION: 'Valid.', LIVRÉ: 'Livré',
}

export function PlanningCalendar({ projects, users }: { projects: Project[]; users: User[] }) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDay = new Date(firstDay)
  // Ajuster pour commencer le lundi
  const dow = startDay.getDay()
  startDay.setDate(startDay.getDate() - (dow === 0 ? 6 : dow - 1))

  const days: Date[] = []
  const d = new Date(startDay)
  while (d <= lastDay || days.length % 7 !== 0) {
    days.push(new Date(d))
    d.setDate(d.getDate() + 1)
    if (days.length > 42) break
  }

  const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

  const getProjectsForDay = (day: Date) => {
    return projects.filter((p) => {
      if (!p.deadline) return false
      const dl = new Date(p.deadline)
      return dl.getFullYear() === day.getFullYear() &&
             dl.getMonth() === day.getMonth() &&
             dl.getDate() === day.getDate()
    })
  }

  const isToday = (day: Date) => {
    const now = new Date()
    return day.getDate() === now.getDate() &&
           day.getMonth() === now.getMonth() &&
           day.getFullYear() === now.getFullYear()
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Calendrier */}
      <div className="lg:col-span-3">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar size={16} className="text-primary" />
                {MONTH_NAMES[month]} {year}
              </CardTitle>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentDate(new Date(year, month - 1))}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-nv-text-muted hover:text-white transition-colors">
                  <ChevronLeft size={18} />
                </button>
                <button onClick={() => setCurrentDate(new Date())}
                  className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors">
                  Aujourd'hui
                </button>
                <button onClick={() => setCurrentDate(new Date(year, month + 1))}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-nv-text-muted hover:text-white transition-colors">
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Jours semaine */}
            <div className="grid grid-cols-7 mb-2">
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
                <div key={d} className="text-center text-xs font-medium text-nv-text-muted py-2">{d}</div>
              ))}
            </div>
            {/* Jours */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, i) => {
                const isCurrentMonth = day.getMonth() === month
                const todayClass = isToday(day)
                const dayProjects = getProjectsForDay(day)
                return (
                  <div key={i} className={cn(
                    'min-h-[70px] p-1.5 rounded-lg border transition-colors',
                    isCurrentMonth ? 'border-nv-border/50 hover:border-nv-border' : 'border-transparent opacity-40',
                    todayClass && 'border-primary/50 bg-primary/5'
                  )}>
                    <p className={cn(
                      'text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full',
                      todayClass ? 'bg-primary text-white' : 'text-nv-text-muted'
                    )}>{day.getDate()}</p>
                    {dayProjects.map((p) => (
                      <Link key={p.id} href={`/projects/${p.id}`}
                        className={cn('block text-[9px] px-1 py-0.5 rounded mb-0.5 truncate text-white font-medium', STATUS_COLOR[p.status] || 'bg-gray-500/80')}>
                        {p.title}
                      </Link>
                    ))}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Légende + Équipe */}
      <div className="space-y-4">
        {/* Projets du mois */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Deadlines ce mois</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {projects.filter((p) => {
              if (!p.deadline) return false
              const d = new Date(p.deadline)
              return d.getMonth() === month && d.getFullYear() === year
            }).length === 0
              ? <p className="text-xs text-nv-text-muted">Aucune deadline</p>
              : projects
                .filter((p) => {
                  if (!p.deadline) return false
                  const d = new Date(p.deadline)
                  return d.getMonth() === month && d.getFullYear() === year
                })
                .map((p) => (
                  <Link key={p.id} href={`/projects/${p.id}`}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors">
                    <div className={cn('w-2 h-2 rounded-full shrink-0', STATUS_COLOR[p.status] || 'bg-gray-500')} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white truncate">{p.title}</p>
                      <p className="text-[10px] text-nv-text-muted">{formatDate(p.deadline!)}</p>
                    </div>
                  </Link>
                ))}
          </CardContent>
        </Card>

        {/* Disponibilités équipe */}
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Users size={13} />Équipe</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-2">
                <div className={cn('w-2 h-2 rounded-full shrink-0', u.disponible ? 'bg-emerald-400' : 'bg-gray-400')} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{u.name}</p>
                </div>
                <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full', u.disponible ? 'text-emerald-400 bg-emerald-400/10' : 'text-gray-400 bg-gray-400/10')}>
                  {u.disponible ? 'Dispo' : 'Occupé'}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
