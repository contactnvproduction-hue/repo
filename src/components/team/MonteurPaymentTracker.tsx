'use client'

import { useState, useTransition } from 'react'
import { ChevronLeft, ChevronRight, Wallet, Save, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import toast from 'react-hot-toast'

type PaymentType = 'SALAIRE' | 'FREELANCE' | 'BONUS'

interface Member {
  id: string
  name: string
  role: string
  avatar: string | null
}

interface Payment {
  id: string
  userId: string
  month: string
  amount: number
  type: PaymentType
  notes: string | null
}

interface Row {
  userId: string
  amount: string
  type: PaymentType
  notes: string
  existingId?: string
}

const TYPE_LABELS: Record<PaymentType, string> = {
  SALAIRE: 'Salaire',
  FREELANCE: 'Freelance',
  BONUS: 'Bonus',
}

const ROLE_COLORS: Record<string, string> = {
  MONTEUR: 'text-blue-400',
  'VIDÉASTE': 'text-emerald-400',
  PHOTOGRAPHE: 'text-yellow-400',
  ADMIN: 'text-red-400',
  MANAGER: 'text-purple-400',
  COMMERCIAL: 'text-gray-400',
}

function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function fmtMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

function initRows(members: Member[], payments: Payment[], month: string): Row[] {
  return members.map(m => {
    const p = payments.find(p => p.userId === m.id && p.month === month)
    return {
      userId: m.id,
      amount: p ? String(p.amount) : '',
      type: p?.type ?? 'FREELANCE',
      notes: p?.notes ?? '',
      existingId: p?.id,
    }
  })
}

export function MonteurPaymentTracker({ members, initialPayments, initialMonth }: {
  members: Member[]
  initialPayments: Payment[]
  initialMonth: string
}) {
  const [month, setMonth] = useState(initialMonth)
  const [rows, setRows] = useState<Row[]>(() => initRows(members, initialPayments, initialMonth))
  const [payments, setPayments] = useState<Payment[]>(initialPayments)
  const [isPending, startTransition] = useTransition()

  async function loadMonth(newMonth: string) {
    const res = await fetch(`/api/member-payments?month=${newMonth}`)
    const data: Payment[] = await res.json()
    setPayments(prev => {
      const filtered = prev.filter(p => p.month !== newMonth)
      return [...filtered, ...data]
    })
    setRows(initRows(members, [...payments.filter(p => p.month !== newMonth), ...data], newMonth))
    setMonth(newMonth)
  }

  function updateRow(userId: string, patch: Partial<Row>) {
    setRows(prev => prev.map(r => r.userId === userId ? { ...r, ...patch } : r))
  }

  async function saveRow(userId: string) {
    const row = rows.find(r => r.userId === userId)
    if (!row) return
    const amount = parseFloat(row.amount)
    if (isNaN(amount) || amount < 0) { toast.error('Montant invalide'); return }

    startTransition(async () => {
      const res = await fetch('/api/member-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, month, amount, type: row.type, notes: row.notes || null }),
      })
      if (!res.ok) { toast.error('Erreur lors de la sauvegarde'); return }
      const saved: Payment = await res.json()
      setPayments(prev => [...prev.filter(p => !(p.userId === userId && p.month === month && p.type === row.type)), saved])
      setRows(prev => prev.map(r => r.userId === userId ? { ...r, existingId: saved.id } : r))
      toast.success('Sauvegardé')
    })
  }

  async function deleteRow(userId: string) {
    const row = rows.find(r => r.userId === userId)
    if (!row?.existingId) return
    startTransition(async () => {
      await fetch(`/api/member-payments?id=${row.existingId}`, { method: 'DELETE' })
      setPayments(prev => prev.filter(p => p.id !== row.existingId))
      setRows(prev => prev.map(r => r.userId === userId ? { ...r, amount: '', notes: '', existingId: undefined } : r))
      toast.success('Supprimé')
    })
  }

  const total = rows.reduce((s, r) => {
    const n = parseFloat(r.amount)
    return s + (isNaN(n) ? 0 : n)
  }, 0)

  const savedThisMonth = payments.filter(p => p.month === month)
  const totalSaved = savedThisMonth.reduce((s, p) => s + p.amount, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <Wallet size={16} className="text-primary" />
            Rémunérations équipe
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => loadMonth(addMonths(month, -1))}
              className="p-1.5 rounded-lg hover:bg-white/5 text-nv-text-muted hover:text-white transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-white capitalize w-36 text-center">{fmtMonth(month)}</span>
            <button onClick={() => loadMonth(addMonths(month, 1))}
              className="p-1.5 rounded-lg hover:bg-white/5 text-nv-text-muted hover:text-white transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rows.map(row => {
            const member = members.find(m => m.id === row.userId)!
            return (
              <div key={row.userId} className="flex items-center gap-3 p-3 rounded-xl border border-nv-border bg-nv-dark hover:border-nv-border-light transition-colors">
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center overflow-hidden shrink-0">
                  {member.avatar
                    ? <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                    : <span className="text-xs font-bold text-primary">{member.name.charAt(0)}</span>
                  }
                </div>

                {/* Nom + rôle */}
                <div className="w-36 shrink-0">
                  <p className="text-sm font-medium text-white truncate">{member.name}</p>
                  <p className={`text-[10px] ${ROLE_COLORS[member.role] ?? 'text-nv-text-muted'}`}>{member.role}</p>
                </div>

                {/* Type */}
                <select
                  value={row.type}
                  onChange={e => updateRow(row.userId, { type: e.target.value as PaymentType })}
                  className="text-xs px-2 py-1.5 bg-nv-black border border-nv-border rounded-lg text-nv-text focus:border-primary outline-none w-28 shrink-0"
                >
                  {(Object.keys(TYPE_LABELS) as PaymentType[]).map(t => (
                    <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                  ))}
                </select>

                {/* Montant */}
                <div className="relative flex-1 min-w-0">
                  <input
                    type="number"
                    min={0}
                    step={50}
                    placeholder="0"
                    value={row.amount}
                    onChange={e => updateRow(row.userId, { amount: e.target.value })}
                    className="w-full text-sm px-3 py-1.5 pr-8 bg-nv-black border border-nv-border rounded-lg text-white placeholder:text-nv-text-faint focus:border-primary outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-nv-text-muted pointer-events-none">€</span>
                </div>

                {/* Notes */}
                <input
                  type="text"
                  placeholder="Notes…"
                  value={row.notes}
                  onChange={e => updateRow(row.userId, { notes: e.target.value })}
                  className="flex-1 min-w-0 text-xs px-3 py-1.5 bg-nv-black border border-nv-border rounded-lg text-nv-text placeholder:text-nv-text-faint focus:border-primary outline-none hidden lg:block"
                />

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => saveRow(row.userId)}
                    disabled={isPending || !row.amount}
                    className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors disabled:opacity-30"
                    title="Sauvegarder"
                  >
                    <Save size={14} />
                  </button>
                  {row.existingId && (
                    <button
                      onClick={() => deleteRow(row.userId)}
                      disabled={isPending}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-nv-text-muted hover:text-red-400 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Total */}
        <div className="mt-4 pt-4 border-t border-nv-border flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-nv-text-muted">Saisi ce mois</p>
              <p className="text-lg font-bold text-white">{total.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</p>
            </div>
            {totalSaved !== total && totalSaved > 0 && (
              <div>
                <p className="text-xs text-nv-text-muted">Enregistré</p>
                <p className="text-sm font-semibold text-emerald-400">{totalSaved.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</p>
              </div>
            )}
          </div>
          <p className="text-xs text-nv-text-faint">{savedThisMonth.length} entrée{savedThisMonth.length > 1 ? 's' : ''} enregistrée{savedThisMonth.length > 1 ? 's' : ''}</p>
        </div>
      </CardContent>
    </Card>
  )
}
