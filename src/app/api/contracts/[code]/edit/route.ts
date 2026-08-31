import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Édition d'un contrat NON SIGNÉ (PENDING) depuis le dashboard : infos client,
// mission, montants, durée, livrables. Interdit dès que le contrat est signé.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { code } = await params
  try {
    const contract = await prisma.signedContract.findUnique({ where: { shortCode: code } })
    if (!contract) return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404 })
    if (contract.status === 'SIGNED') {
      return NextResponse.json({ error: 'Un contrat signé ne peut plus être modifié' }, { status: 409 })
    }

    const b = await req.json()
    const num = (v: any) => (v !== undefined && v !== null && v !== '' ? Number(v) : null)
    const int = (v: any) => (v !== undefined && v !== null && v !== '' ? parseInt(String(v), 10) : null)

    const data: Record<string, any> = {}
    if (b.clientName !== undefined) data.clientName = String(b.clientName).trim()
    if (b.clientEmail !== undefined) data.clientEmail = b.clientEmail || null
    if (b.clientCompany !== undefined) data.clientCompany = b.clientCompany || null
    if (b.clientAddress !== undefined) data.clientAddress = b.clientAddress || null
    if (b.missionType !== undefined) data.missionType = b.missionType === 'PONCTUEL' ? 'PONCTUEL' : 'MRR'
    if (b.monthlyAmount !== undefined) data.monthlyAmount = num(b.monthlyAmount)
    if (b.totalAmount !== undefined) data.totalAmount = num(b.totalAmount)
    if (b.durationMonths !== undefined) data.durationMonths = int(b.durationMonths)
    if (b.depositPercent !== undefined) data.depositPercent = int(b.depositPercent)
    if (b.startDate !== undefined) data.startDate = b.startDate || null
    if (b.deliverables !== undefined) data.deliverables = Array.isArray(b.deliverables) ? b.deliverables : []

    // Synchronise contractData (source du rendu du contrat) avec les valeurs éditées
    const cd = (contract.contractData && typeof contract.contractData === 'object') ? { ...(contract.contractData as any) } : {}
    for (const k of ['clientName', 'clientEmail', 'clientCompany', 'clientAddress', 'missionType', 'monthlyAmount', 'totalAmount', 'durationMonths', 'depositPercent', 'startDate', 'deliverables']) {
      if (data[k] !== undefined) cd[k] = data[k]
    }
    data.contractData = cd

    const updated = await prisma.signedContract.update({ where: { shortCode: code }, data })
    return NextResponse.json({ ok: true, contract: updated })
  } catch (e) {
    console.error('[contracts/edit]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
