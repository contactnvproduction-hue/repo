import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { syncAdaForms } from '@/lib/ada-sync'
import { revalidatePath } from 'next/cache'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const clientId = body.clientId as string | undefined

  const result = await syncAdaForms(clientId)

  // Invalide le cache de la fiche client si ciblée
  if (clientId) revalidatePath(`/clients/${clientId}`)

  return NextResponse.json(result)
}
