// Transforme les réponses du formulaire d'onboarding client en données
// pré-remplies pour le brief monteur et le plan de tournage.
// Objectif : quasiment aucune saisie manuelle côté agence.

type OnboardingFormData = {
  brandName?: string | null
  acquisitionChannels?: string[]
  inspirationLinks?: string[]
  inspirationNotes?: string | null
  visualPerception?: string[]
  editingStyles?: string[]
  mustHighlight?: string | null
  mustAvoid?: string | null
  brandFont?: string | null
  musicVibe?: string | null
  callToAction?: string | null
  icpSector?: string | null
  icpTargetAge?: string | null
  icpTargetStatus?: string | null
  icpTargetProblem?: string | null
  icpOffer?: string | null
  icpTone?: string | null
}

const CANAL_MAP: Record<string, string> = {
  instagram: 'instagram',
  youtube: 'youtube',
  tiktok: 'tiktok',
  linkedin: 'linkedin',
  facebook: 'facebook',
}

function genId() {
  return Math.random().toString(36).slice(2, 10)
}

// Prépare un objet BriefData (sans id → la sauvegarde créera un nouveau brief)
export function briefPrefillFromOnboarding(ob: OnboardingFormData | null | undefined) {
  if (!ob) return null

  const avatarParts = [
    ob.icpTargetStatus,
    ob.icpTargetAge,
    ob.icpTargetProblem ? `Problématique : ${ob.icpTargetProblem}` : null,
  ].filter(Boolean)

  const notesParts = [
    ob.mustHighlight ? `À mettre en avant : ${ob.mustHighlight}` : null,
    ob.callToAction ? `CTA : ${ob.callToAction}` : null,
    ob.musicVibe ? `Musique : ${ob.musicVibe}` : null,
    ob.brandFont ? `Police / branding : ${ob.brandFont}` : null,
    ob.inspirationNotes ? `Ce qu'il aime dans ses inspirations : ${ob.inspirationNotes}` : null,
    ob.visualPerception?.length ? `Perception visuelle souhaitée : ${ob.visualPerception.join(', ')}` : null,
    ob.editingStyles?.length ? `Styles de montage : ${ob.editingStyles.join(', ')}` : null,
  ].filter(Boolean)

  return {
    niche: ob.icpSector ?? '',
    positionnement: ob.icpOffer ?? '',
    avatar: avatarParts.join(' — '),
    ton: ob.icpTone ?? '',
    avoidList: ob.mustAvoid ?? '',
    notes: notesParts.join('\n\n'),
    canaux: (ob.acquisitionChannels ?? [])
      .map(c => CANAL_MAP[c.toLowerCase()])
      .filter((c): c is string => !!c),
    inspirations: (ob.inspirationLinks ?? [])
      .filter(Boolean)
      .map(url => ({ id: genId(), url, label: '' })),
  }
}

// Prépare les champs pré-remplis d'un plan de tournage
export function shootingPlanPrefillFromOnboarding(
  ob: OnboardingFormData | null | undefined,
  spots: { name: string; address?: string | null }[],
) {
  if (!ob && spots.length === 0) return null

  const daInfoParts = [
    ob?.visualPerception?.length ? `Perception : ${ob.visualPerception.join(', ')}` : null,
    ob?.editingStyles?.length ? `Montage : ${ob.editingStyles.join(', ')}` : null,
    ob?.brandFont ? `Police : ${ob.brandFont}` : null,
  ].filter(Boolean)

  return {
    title: ob?.brandName ? `Tournage ${ob.brandName}` : '',
    location: spots.map(s => s.name).join(' + '),
    locationAddress: spots.map(s => s.address).filter(Boolean).join(' / '),
    notes: [
      ob?.mustHighlight ? `À mettre en avant : ${ob.mustHighlight}` : null,
      ob?.mustAvoid ? `À éviter : ${ob.mustAvoid}` : null,
      daInfoParts.length ? daInfoParts.join(' • ') : null,
    ].filter(Boolean).join('\n\n'),
  }
}
