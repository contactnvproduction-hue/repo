import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

function todayStr() {
  return new Date().toISOString().slice(0, 10) // "2026-06-04"
}

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const checkin = await prisma.userDailyCheckin.findFirst({
    where: { userId: session.user.id, date: todayStr() },
  })
  return NextResponse.json({ done: !!checkin })
}

export async function POST() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const checkin = await prisma.userDailyCheckin.upsert({
      where: { userId_date: { userId: session.user.id, date: todayStr() } },
      update: {},
      create: { userId: session.user.id, date: todayStr() },
    })
    return NextResponse.json(checkin)
  } catch {
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}
