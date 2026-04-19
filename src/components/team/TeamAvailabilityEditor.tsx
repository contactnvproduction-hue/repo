'use client'

import { useState } from 'react'
import { Clock, Check, Edit2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface AvailabilityRecord {
  hours: number
  notes?: string | null
}

function getWeekStart(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

export function TeamAvailabilityEditor({
  userId,
  currentAvailability,
  isAdmin,
}: {
  userId: string
  currentAvailability: AvailabilityRecord | null
  isAdmin: boolean
}) {
  const weekStart = getWeekStart(new Date())
  const [hours, setHours] = useState(currentAvailability?.hours ?? 35)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(currentAvailability?.hours ?? null)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/team-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, weekStart, hours }),
      })
      if (!res.ok) { toast.error('Erreur'); return }
      setSaved(hours)
      setEditing(false)
      toast.success('Disponibilité mise à jour')
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  const displayHours = saved !== null ? saved : null
  const pct = displayHours !== null ? Math.min((displayHours / 40) * 100, 100) : 0
  const color = displayHours === null ? 'bg-gray-500' : displayHours >= 35 ? 'bg-emerald-500' : displayHours >= 20 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div className="mt-3 pt-3 border-t border-nv-border">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs text-nv-text-muted flex items-center gap-1.5">
          <Clock size={11} />
          Dispo cette semaine
        </p>
        {isAdmin && !editing && (
          <button onClick={() => setEditing(true)} className="p-0.5 text-nv-text-faint hover:text-white transition-colors">
            <Edit2 size={11} />
          </button>
        )}
      </div>

      {editing && isAdmin ? (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={hours}
            onChange={(e) => setHours(Math.max(0, Math.min(80, Number(e.target.value))))}
            min={0}
            max={80}
            className="w-16 px-2 py-1 text-xs bg-nv-black border border-nv-border rounded text-white focus:border-primary outline-none"
          />
          <span className="text-xs text-nv-text-muted">h / semaine</span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="ml-auto p-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <Check size={12} />
          </button>
        </div>
      ) : (
        <div>
          {displayHours !== null ? (
            <>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className={`font-semibold ${displayHours >= 35 ? 'text-emerald-400' : displayHours >= 20 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {displayHours}h
                </span>
                <span className="text-nv-text-faint">/ 40h</span>
              </div>
              <div className="h-1.5 bg-nv-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${color}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </>
          ) : (
            <p className="text-xs text-nv-text-faint italic">
              {isAdmin ? 'Cliquer pour saisir' : 'Non renseigné'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
