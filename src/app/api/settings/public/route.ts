import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Route publique (pas d'auth) pour les infos agence utilisées côté client (PDF)
export async function GET(req: NextRequest) {
  const settings = await prisma.agencySetting.findFirst({
    select: {
      name: true,
      email: true,
      phone: true,
      address: true,
      siret: true,
      tvaNumber: true,
      bankDetails: true,
      cgv: true,
      logo: true,
      defaultVatRate: true,
      invoicePrefix: true,
      quotePrefix: true,
    },
  })

  return NextResponse.json(settings || {
    name: 'New Vision Production',
    email: 'contact@newvision.fr',
    defaultVatRate: 20,
  })
}
