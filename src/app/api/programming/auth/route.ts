import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const db = prisma as any

// Accès à l'espace de programmation d'un client (page publique).
// 1re connexion : le code saisi devient le code d'accès. Ensuite il faut le
// saisir pour entrer. Retourne les données du client si le code est bon.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const clientId: string | undefined = b.clientId
  const code: string = (b.code || '').trim()
  if (!clientId || !code) return NextResponse.json({ error: 'Client et code requis' }, { status: 400 })

  let prog = await db.clientProgramming.findUnique({ where: { clientId } }).catch(() => null)
  if (!prog) prog = await db.clientProgramming.create({ data: { clientId } }).catch(() => null)
  if (!prog) return NextResponse.json({ error: 'Erreur' }, { status: 500 })

  const firstTime = !prog.accessCode
  if (firstTime) {
    prog = await db.clientProgramming.update({ where: { clientId }, data: { accessCode: code, ...(b.login ? { accessLogin: String(b.login).trim() } : {}) } })
  } else if (prog.accessCode !== code) {
    return NextResponse.json({ error: 'Code incorrect' }, { status: 401 })
  }

  const [videos, client] = await Promise.all([
    db.clientVideo.findMany({ where: { clientId }, orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }] }).catch(() => []),
    prisma.client.findUnique({ where: { id: clientId }, select: { id: true, name: true } }).catch(() => null),
  ])
  return NextResponse.json({ ok: true, firstTime, programming: prog, videos, client })
}
