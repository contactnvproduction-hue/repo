import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Aucun fichier' }, { status: 400 })

  const maxSize = 10 * 1024 * 1024 // 10 MB
  if (file.size > maxSize) return NextResponse.json({ error: 'Fichier trop lourd (max 10 Mo)' }, { status: 400 })

  const allowedTypes = [
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ]
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Type de fichier non autorisé' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const uploadDir = path.join(process.cwd(), 'public', 'uploads')

  await mkdir(uploadDir, { recursive: true })
  await writeFile(path.join(uploadDir, safeName), buffer)

  return NextResponse.json({ url: `/uploads/${safeName}`, name: file.name })
}
