import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ClipboardCheck } from 'lucide-react'
import { OnboardingHub } from '@/components/onboarding/OnboardingHub'
import { importLegacyResponses } from '@/lib/onboarding-import'

export const dynamic = 'force-dynamic'

export default async function OnboardingsPage() {
  const session = await auth()
  if (!session?.user) return null

  const db = prisma as any

  // Réintègre l'ancienne data Google Forms (idempotent, ne touche pas l'existant)
  await importLegacyResponses(db)

  const [forms, selections] = await Promise.all([
    (async () => { try { return await db.clientOnboardingForm.findMany({
      omit: { icpPdf: true },
      include: { client: { select: { id: true, name: true, status: true } } },
      orderBy: { completedAt: 'desc' },
    }) } catch { return [] } })(),
    (async () => { try { return await db.clientSpotSelection.findMany({
      include: { spot: { select: { name: true, city: true } } },
    }) } catch { return [] } })(),
  ])

  const spotsByClient: Record<string, { name: string; city: string }[]> = {}
  for (const sel of selections) {
    ;(spotsByClient[sel.clientId] ??= []).push({ name: sel.spot.name, city: sel.spot.city })
  }

  const rows = forms.map((f: any) => ({
    clientId: f.clientId,
    clientName: f.client?.name ?? `${f.firstName ?? ''} ${f.lastName ?? ''}`.trim(),
    clientStatus: f.client?.status ?? '',
    brandName: f.brandName,
    acquisitionChannels: f.acquisitionChannels ?? [],
    editingStyles: f.editingStyles ?? [],
    visualPerception: f.visualPerception ?? [],
    icpSector: f.icpSector,
    icpTone: f.icpTone,
    callToAction: f.callToAction,
    mustHighlight: f.mustHighlight,
    mustAvoid: f.mustAvoid,
    musicVibe: f.musicVibe,
    brandFont: f.brandFont,
    inspirationLinks: f.inspirationLinks ?? [],
    icpPdfName: f.icpPdfName,
    completedAt: f.completedAt
      ? (f.completedAt instanceof Date ? f.completedAt.toISOString() : String(f.completedAt))
      : null,
    spots: spotsByClient[f.clientId] ?? [],
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <ClipboardCheck size={24} className="text-primary" />
          Onboarding
        </h1>
        <p className="text-sm text-nv-text-muted mt-1">
          Un lien universel pour tous les clients — chaque réponse est rattachée automatiquement à la bonne fiche client (nom, prénom, marque, email) et se reporte dans les briefs et plans de tournage.
        </p>
      </div>

      <OnboardingHub rows={rows} />
    </div>
  )
}
