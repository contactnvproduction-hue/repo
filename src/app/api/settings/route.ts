import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Vraies coordonnées de la société — complètent les champs vides ou restés
// aux valeurs génériques par défaut (seed idempotent, modifiable dans Paramètres)
const NV_COMPANY = {
  name: 'SAS NEW VISION PRODUCTION',
  email: 'contact.nvproduction@gmail.com',
  siret: '94442853100015',
  bankDetails: 'Bénéficiaire : SAS NEW VISION PRODUCTION\nIBAN : FR7616958000013635597638274\nBIC : QNTOFRP1XXX',
}

// Infos agence (coordonnées, SIRET, TVA, RIB) — utilisées par la génération de factures PDF
export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  let settings = await prisma.agencySetting.findFirst()

  if (settings) {
    const fix: Record<string, string> = {}
    if (!settings.name || settings.name === 'New Vision Production') fix.name = NV_COMPANY.name
    if (!settings.email || settings.email === 'contact@newvision.fr') fix.email = NV_COMPANY.email
    if (!settings.siret) fix.siret = NV_COMPANY.siret
    if (!settings.bankDetails) fix.bankDetails = NV_COMPANY.bankDetails
    if (Object.keys(fix).length > 0) {
      settings = await prisma.agencySetting.update({ where: { id: settings.id }, data: fix })
    }
  }

  return NextResponse.json(settings ?? NV_COMPANY)
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Permission refusée' }, { status: 403 })
  }

  const body = await req.json()
  // Strip fields that shouldn't be directly updated
  const { id, createdAt, updatedAt, invoiceCounter, quoteCounter, ...data } = body

  const existing = await prisma.agencySetting.findFirst()
  const settings = existing
    ? await prisma.agencySetting.update({ where: { id: existing.id }, data })
    : await prisma.agencySetting.create({ data: { ...data, updatedAt: new Date() } })

  return NextResponse.json(settings)
}
