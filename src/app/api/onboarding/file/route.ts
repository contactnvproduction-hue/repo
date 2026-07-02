import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

const db = prisma as any

// Sert le PDF ICP d'un client (stocké en base64 dans la DB) — réservé au dashboard
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ error: 'clientId requis' }, { status: 400 })

  const form = await db.clientOnboardingForm.findUnique({
    where: { clientId },
    select: { icpPdf: true, icpPdfName: true },
  })
  if (!form?.icpPdf) return NextResponse.json({ error: 'Aucun PDF' }, { status: 404 })

  // data:application/pdf;base64,XXXX → binaire
  const base64 = form.icpPdf.split(',')[1] ?? form.icpPdf
  const buffer = Buffer.from(base64, 'base64')
  const fileName = form.icpPdfName || 'icp-avatar-client.pdf'

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName.replace(/[^\w.\- ]/g, '_')}"`,
      'Content-Length': String(buffer.length),
    },
  })
}
