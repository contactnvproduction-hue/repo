import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import sharp from 'sharp'

const db = prisma as any

// Upload public (page client /programmation). Les images sont recompressées et
// redimensionnées (max 1600px, webp) puis stockées en base → URL stable.
export async function POST(req: NextRequest) {
  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Aucun fichier' }, { status: 400 })
  if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'Image uniquement' }, { status: 400 })
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: 'Fichier trop lourd (max 15 Mo)' }, { status: 400 })

  const input = Buffer.from(await file.arrayBuffer())
  let data: Buffer, mime = 'image/webp'
  try {
    data = await sharp(input).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer()
  } catch {
    // Fallback : on garde l'original si sharp échoue (format exotique)
    data = input; mime = file.type
  }

  const saved = await db.storedFile.create({
    data: { name: file.name || null, mime, data, size: data.length },
    select: { id: true },
  })
  return NextResponse.json({ url: `/api/files/${saved.id}`, id: saved.id })
}
