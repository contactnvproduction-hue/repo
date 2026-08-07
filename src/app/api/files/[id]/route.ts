import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const db = prisma as any

// Sert un fichier stocké (image) avec cache long (le contenu est immuable par id).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const file = await db.storedFile.findUnique({ where: { id } }).catch(() => null)
  if (!file) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  const body = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data)
  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      'Content-Type': file.mime || 'application/octet-stream',
      'Content-Length': String(body.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
