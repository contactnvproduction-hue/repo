import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /contrat/[code]
 * Route publique — redirige vers la page HTML de signature avec le code en paramètre.
 * Donne une URL propre à envoyer aux clients : /contrat/NVP-XXXX
 * au lieu de /nv-signature.html?c=NVP-XXXX
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  // Redirect vers le fichier HTML statique avec le code injecté en query param
  const target = new URL(`/nv-signature.html?c=${encodeURIComponent(code)}`, req.url)
  return NextResponse.redirect(target, { status: 302 })
}
