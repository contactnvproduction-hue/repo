import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { decryptLogins } from '@/lib/crypto'

const db = prisma as any

// Accès sécurisé à l'espace de programmation : code secret (mot) + mot de passe.
// Les deux sont hachés (bcrypt). 1re connexion : ce qui est saisi devient les
// identifiants. Les logs des canaux sont déchiffrés uniquement après validation.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const clientId: string | undefined = b.clientId
  const code: string = (b.code || '').trim()
  const password: string = (b.password || '').trim()
  if (!clientId || !code || !password) return NextResponse.json({ error: 'Code et mot de passe requis' }, { status: 400 })

  let prog = await db.clientProgramming.findUnique({ where: { clientId } }).catch(() => null)
  if (!prog) prog = await db.clientProgramming.create({ data: { clientId } }).catch(() => null)
  if (!prog) return NextResponse.json({ error: 'Erreur' }, { status: 500 })

  const firstTime = !prog.accessCode || !prog.accessPassword
  if (firstTime) {
    prog = await db.clientProgramming.update({
      where: { clientId },
      data: { accessCode: await bcrypt.hash(code, 10), accessPassword: await bcrypt.hash(password, 10), ...(b.login ? { accessLogin: String(b.login).trim() } : {}) },
    })
  } else {
    const okCode = await bcrypt.compare(code, prog.accessCode).catch(() => false)
    const okPass = await bcrypt.compare(password, prog.accessPassword).catch(() => false)
    if (!okCode || !okPass) return NextResponse.json({ error: 'Code ou mot de passe incorrect' }, { status: 401 })
  }

  const [videos, client] = await Promise.all([
    db.clientVideo.findMany({ where: { clientId }, orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }] }).catch(() => []),
    prisma.client.findUnique({ where: { id: clientId }, select: { id: true, name: true } }).catch(() => null),
  ])

  // Déchiffrement des logs uniquement pour le client authentifié
  const dec = decryptLogins(prog.channelData, prog.channelLogins)
  const programming = { ...prog, accessCode: undefined, accessPassword: undefined, channelData: dec.channelData, channelLogins: dec.channelLogins }
  return NextResponse.json({ ok: true, firstTime, programming, videos, client })
}
