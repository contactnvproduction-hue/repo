import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const db = prisma as any

// Modèle vision : rapide + fiable pour lire des chiffres dans une capture d'écran
const MODEL = 'claude-sonnet-5'

// Analyse une ou plusieurs captures d'écran du bilan mensuel (Instagram Insights /
// YouTube Studio) et extrait la data de chaque contenu via Claude vision.
// Ne sauvegarde rien : renvoie les lignes détectées pour validation par l'utilisateur.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Permission refusée' }, { status: 403 })
  }

  try {
    const { images, platform } = await req.json()
    if (!Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: 'Aucune capture fournie' }, { status: 400 })
    }
    if (images.length > 6) {
      return NextResponse.json({ error: 'Maximum 6 captures à la fois' }, { status: 400 })
    }

    const settings = await db.agencySetting.findFirst()
    const apiKey = process.env.ANTHROPIC_API_KEY || settings?.anthropicApiKey
    if (!apiKey) {
      return NextResponse.json({
        needKey: true,
        message: "Ajoutez une clé API Claude pour analyser les captures (bouton « Clé IA »).",
      }, { status: 400 })
    }

    // Blocs image (data URL base64 → format API Anthropic)
    const imageBlocks: any[] = []
    for (const dataUrl of images) {
      const m = /^data:(image\/(?:png|jpe?g|webp));base64,([\s\S]+)$/.exec(String(dataUrl))
      if (!m) return NextResponse.json({ error: 'Format d\'image non supporté' }, { status: 400 })
      imageBlocks.push({ type: 'image', source: { type: 'base64', media_type: m[1] === 'image/jpg' ? 'image/jpeg' : m[1], data: m[2] } })
    }

    const isYT = platform === 'YOUTUBE'
    const formats = isYT ? 'SHORT (vidéo courte < 1 min) ou LONG (vidéo classique)' : 'REEL (vidéo) ou POST (photo/carrousel)'
    const prompt = `Tu analyses une ou plusieurs captures d'écran du bilan de performance ${isYT ? 'YouTube Studio' : 'Instagram (Insights / tableau de bord professionnel)'} d'un créateur de contenu.

Extrais CHAQUE contenu (publication/vidéo) visible dans les captures, avec ses statistiques.

Réponds STRICTEMENT avec un objet JSON valide, sans aucun texte autour ni balises markdown, au format exact :
{"pieces":[{"title":"titre ou début de la légende","format":"${isYT ? 'SHORT|LONG' : 'REEL|POST'}","views":0,"likes":0,"comments":0,"shares":0,"publishedDay":null}],"followers":null}

Règles impératives :
- Une ligne par contenu réellement visible. N'invente RIEN. Si aucun contenu n'est lisible, renvoie "pieces":[].
- format : ${formats}.
- Convertis les nombres abrégés en entiers : "1,2 k" ou "1.2K" → 1200 ; "12,3 k" → 12300 ; "1,5 M" → 1500000 ; "834" → 834.
- Si une métrique n'est pas visible pour un contenu, mets 0 (ne devine pas).
- publishedDay : le jour du mois (1-31) si une date est visible, sinon null.
- followers : le nombre total d'abonnés du compte s'il est affiché quelque part, sinon null.
- title : reprends le texte/la légende visible ; si aucun, mets "Contenu ${isYT ? 'YouTube' : 'Instagram'}".`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        messages: [{ role: 'user', content: [...imageBlocks, { type: 'text', text: prompt }] }],
      }),
    })

    const data = await res.json()
    if (data.error) {
      const msg = data.error.message || 'Erreur API Claude'
      const hint = /authentication|api key|x-api-key|invalid/i.test(msg) ? ' (clé API invalide ?)' : ''
      return NextResponse.json({ error: `Analyse IA : ${msg}${hint}` }, { status: 400 })
    }

    let text = (data.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim()
    // Retire d'éventuelles balises ```json ... ```
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

    let parsed: any = null
    try { parsed = JSON.parse(text) } catch {
      const m = text.match(/\{[\s\S]*\}/)
      if (m) { try { parsed = JSON.parse(m[0]) } catch {} }
    }
    if (!parsed || !Array.isArray(parsed.pieces)) {
      return NextResponse.json({ error: "L'IA n'a pas pu lire de contenu exploitable dans la capture." }, { status: 422 })
    }

    const pieces = parsed.pieces.slice(0, 100).map((p: any) => ({
      title: String(p.title || (isYT ? 'Contenu YouTube' : 'Contenu Instagram')).slice(0, 200),
      format: ['SHORT', 'LONG', 'REEL', 'POST'].includes(p.format) ? p.format : (isYT ? 'LONG' : 'REEL'),
      views: Math.max(0, Math.round(Number(p.views) || 0)),
      likes: Math.max(0, Math.round(Number(p.likes) || 0)),
      comments: Math.max(0, Math.round(Number(p.comments) || 0)),
      shares: Math.max(0, Math.round(Number(p.shares) || 0)),
      publishedDay: p.publishedDay != null && Number(p.publishedDay) >= 1 && Number(p.publishedDay) <= 31 ? Math.round(Number(p.publishedDay)) : null,
    }))

    const followers = parsed.followers != null && Number(parsed.followers) > 0 ? Math.round(Number(parsed.followers)) : null

    return NextResponse.json({ pieces, followers })
  } catch (e) {
    console.error('[content/analyze-screenshot POST]', e)
    return NextResponse.json({ error: 'Erreur lors de l\'analyse' }, { status: 500 })
  }
}
