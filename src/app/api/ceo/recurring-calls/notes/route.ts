import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

const db = prisma as any

// Upsert de la note d'une occurrence (callId + date "YYYY-MM-DD")
export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const body = await req.json()
    const { callId, date } = body
    if (!callId || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) {
      return NextResponse.json({ error: 'callId et date (YYYY-MM-DD) requis' }, { status: 400 })
    }

    const data: Record<string, unknown> = {}
    if ('content' in body) data.content = body.content?.trim() || null
    if ('done' in body) data.done = body.done === true

    const note = await db.recurringCallNote.upsert({
      where: { callId_date: { callId, date } },
      update: data,
      create: {
        callId,
        date,
        content: (body.content?.trim() || null) as string | null,
        done: body.done === true,
      },
    })
    return NextResponse.json(note)
  } catch (e) {
    console.error('[recurring-calls/notes PUT]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
