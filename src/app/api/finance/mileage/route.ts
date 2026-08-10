import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const db = prisma as any

const schema = z.object({
  id: z.string().optional(),
  userId: z.string().min(1),
  userName: z.string().optional().nullable(),
  year: z.number().int(),
  month: z.number().int().min(0).max(11),
  vehicle: z.string().optional(),
  vehicleType: z.enum(['VOITURE', 'MOTO', 'CYCLOMOTEUR']).optional(),
  cv: z.number().int().min(1).max(7),
  electric: z.boolean().optional(),
  km: z.number().min(0),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const yearParam = new URL(req.url).searchParams.get('year')
  const year = yearParam ? Number(yearParam) : new Date().getFullYear()
  const entries = await db.mileageEntry.findMany({ where: { year }, orderBy: [{ userId: 'asc' }, { month: 'asc' }] }).catch(() => [])
  return NextResponse.json(entries)
}

// Upsert d'une saisie (membre + véhicule + mois unique)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const d = parsed.data
  const vehicle = d.vehicle?.trim() || 'Véhicule'
  const vehicleType = d.vehicleType ?? 'VOITURE'
  const entry = await db.mileageEntry.upsert({
    where: { userId_vehicle_year_month: { userId: d.userId, vehicle, year: d.year, month: d.month } },
    update: { vehicleType, cv: d.cv, electric: !!d.electric, km: d.km, userName: d.userName ?? null },
    create: { userId: d.userId, userName: d.userName ?? null, year: d.year, month: d.month, vehicle, vehicleType, cv: d.cv, electric: !!d.electric, km: d.km },
  })
  return NextResponse.json(entry, { status: 201 })
}

// Toggle « versée » (ou autre champ ponctuel)
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  if (!b.id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
  const entry = await db.mileageEntry.update({ where: { id: b.id }, data: { ...(b.paid !== undefined && { paid: !!b.paid }) } })
  return NextResponse.json(entry)
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
  await db.mileageEntry.delete({ where: { id } }).catch(() => {})
  return NextResponse.json({ ok: true })
}
