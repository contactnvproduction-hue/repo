import { prisma } from '@/lib/db'

const db = prisma as any

// Valeur contractée d'un closing : MRR → mensualité × durée ; PONCTUEL → total.
export function contractedValue(e: { missionType?: string | null; amount?: number | null; durationMonths?: number | null }): number {
  const amount = e.amount ?? 0
  if ((e.missionType ?? 'MRR') === 'PONCTUEL') return amount
  return amount * Math.max(1, e.durationMonths ?? 1)
}

// Enregistre UNE signature dans le registre du contracté (ClosingEvent).
// Idempotent : on ne crée pas deux fois le même closing pour un client au même
// montant dans le même mois (protège contre les double-clics / doubles chemins).
export async function ensureClosingEvent(opts: {
  clientId: string | null
  clientName: string
  leadId?: string | null
  missionType?: string | null
  amount?: number | null
  durationMonths?: number | null
  commercialId?: string | null
  type?: string | null
  date?: Date | string | null
}) {
  const date = opts.date ? new Date(opts.date) : new Date()
  const amount = opts.amount ?? null
  if (!amount || amount <= 0) return null
  const mStart = new Date(date.getFullYear(), date.getMonth(), 1)
  const mEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59)

  const existing = await db.closingEvent.findFirst({
    where: {
      ...(opts.clientId ? { clientId: opts.clientId } : { clientName: opts.clientName }),
      amount, date: { gte: mStart, lte: mEnd },
    },
  }).catch(() => null)
  if (existing) {
    // Complète la durée si elle manquait (anciens events)
    if (existing.durationMonths == null && opts.durationMonths != null) {
      await db.closingEvent.update({ where: { id: existing.id }, data: { durationMonths: opts.durationMonths } }).catch(() => {})
    }
    return existing
  }

  return db.closingEvent.create({
    data: {
      clientId: opts.clientId ?? null,
      clientName: opts.clientName,
      leadId: opts.leadId ?? null,
      missionType: opts.missionType ?? 'MRR',
      amount,
      durationMonths: opts.durationMonths ?? null,
      commercialId: opts.commercialId ?? null,
      type: ['NEW', 'UPSELL', 'RENEWAL'].includes(opts.type ?? '') ? opts.type : 'NEW',
      date,
    },
  }).catch(() => null)
}
