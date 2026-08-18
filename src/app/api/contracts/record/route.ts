import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { materializeContract } from '@/lib/contract-materialize'

// Comptabilise manuellement un contrat signé qui n'avait pas été enregistré :
// crée le retainer (→ contracté du mois) + la 1ʳᵉ facture pour un client existant.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  try {
    const b = await req.json()
    const clientId: string = b.clientId
    const monthlyAmount = Number(b.monthlyAmount)
    const durationMonths = b.durationMonths != null && b.durationMonths !== '' ? Number(b.durationMonths) : 12
    if (!clientId) return NextResponse.json({ error: 'client requis' }, { status: 400 })
    if (!monthlyAmount || monthlyAmount <= 0) return NextResponse.json({ error: 'montant invalide' }, { status: 400 })
    const { retainer, invoice } = await materializeContract({ clientId, monthlyAmount, durationMonths })
    return NextResponse.json({ ok: true, retainerId: retainer?.id ?? null, invoiceId: invoice?.id ?? null })
  } catch (e) {
    console.error('[contracts/record]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
