// Questions du formulaire d'onboarding client — configuration par défaut.
// Les libellés/options peuvent être surchargés depuis Paramètres (OnboardingConfig).
// Les `key` sont stables : elles mappent vers les colonnes de ClientOnboardingForm.

export type QuestionType = 'text' | 'textarea' | 'chips' | 'chips-multi' | 'links' | 'file-image' | 'file-pdf'

export type OnboardingQuestion = {
  key: string
  step: 'branding' | 'icp'
  type: QuestionType
  label: string
  hint?: string
  options?: string[]
  maxSelect?: number
  active: boolean
  custom?: boolean // question libre ajoutée depuis le dashboard (réponse en textarea)
}

// Libellés alignés sur le Google Forms d'origine (sheet onboarding NVP)
export const DEFAULT_QUESTIONS: OnboardingQuestion[] = [
  {
    key: 'brandName', step: 'branding', type: 'text',
    label: 'Nom de votre marque / entreprise',
    active: true,
  },
  {
    key: 'acquisitionChannels', step: 'branding', type: 'chips-multi',
    label: "Vos réseaux / canaux d'acquisition",
    options: ['Instagram', 'YouTube', 'LinkedIn', 'TikTok', 'Facebook', 'Ads Meta', 'Podcast', 'Email', 'Site web'],
    active: true,
  },
  {
    key: 'inspirationLinks', step: 'branding', type: 'links',
    label: 'Liens de vos inspirations actuelles en terme de contenu',
    hint: '3 à 5 liens max — profils ou créateurs dont vous aimez le contenu vidéo',
    active: true,
  },
  {
    key: 'inspirationNotes', step: 'branding', type: 'textarea',
    label: "Dans ces inspirations, qu'est-ce que vous aimez le plus ?",
    hint: 'Rythme, style, ambiance, transitions, vibe générale…',
    active: true,
  },
  {
    key: 'visualPerception', step: 'branding', type: 'chips-multi',
    label: 'Comment voulez-vous que votre marque personnelle soit perçue sur le plan visuel ?',
    options: ['Lumineux', 'Chaud', 'Sombre', 'Froid', 'Naturel', 'Épuré', 'Luxueux', 'Dynamique'],
    active: true,
  },
  {
    key: 'editingStyles', step: 'branding', type: 'chips-multi',
    label: 'Parmi ces styles de montage, lequel correspond le mieux à vos exigences actuelles ?',
    hint: 'Maximum 2 choix',
    options: ['Rapide / punchy', 'Cinématique', 'Authentique minimaliste', 'Storytelling narratif', 'Corporate premium', 'Éducatif / tutoriel'],
    maxSelect: 2,
    active: true,
  },
  {
    key: 'mustHighlight', step: 'branding', type: 'textarea',
    label: 'Y a-t-il un / des aspects à mettre en avant absolument dans notre collaboration ?',
    active: true,
  },
  {
    key: 'mustAvoid', step: 'branding', type: 'textarea',
    label: 'Y a-t-il quelque chose à éviter absolument ?',
    hint: 'Mots interdits, styles refusés, mauvaises expériences passées',
    active: true,
  },
  {
    key: 'brandFont', step: 'branding', type: 'text',
    label: 'Avez-vous une police spécifique ou un branding à utiliser ?',
    hint: 'Si oui, précisez les noms ici',
    active: true,
  },
  {
    key: 'musicVibe', step: 'branding', type: 'text',
    label: 'Liens de musiques ou vibe musicale souhaitée dans le montage',
    active: true,
  },
  {
    key: 'callToAction', step: 'branding', type: 'text',
    label: 'Y a-t-il un call-to-action spécifique à insérer au sein de vos contenus vidéo ?',
    active: true,
  },
  {
    key: 'channelsScreenshot', step: 'branding', type: 'file-image',
    label: "Capture d'écran de l'état actuel de vos canaux d'acquisition",
    hint: 'Nous la gardons comme référence de début de collaboration',
    active: true,
  },
  // ─── ICP / Avatar client ───
  {
    key: 'icpSector', step: 'icp', type: 'text',
    label: "Votre secteur d'activité",
    active: true,
  },
  {
    key: 'icpTargetAge', step: 'icp', type: 'chips',
    label: "Tranche d'âge de votre cible principale",
    options: ['18-25 ans', '25-35 ans', '35-45 ans', '45-55 ans', '55+ ans', 'Tous âges'],
    active: true,
  },
  {
    key: 'icpTargetStatus', step: 'icp', type: 'chips',
    label: 'Statut de votre cible',
    options: ["Entrepreneur / chef d'entreprise", 'Salarié en reconversion', 'Freelance', 'Étudiant', 'Cadre supérieur', 'Parent actif', 'Retraité', 'Grand public'],
    active: true,
  },
  {
    key: 'icpTargetProblem', step: 'icp', type: 'textarea',
    label: 'Problématique principale de votre cible',
    hint: 'Le problème numéro 1 que votre client idéal essaie de résoudre',
    active: true,
  },
  {
    key: 'icpOffer', step: 'icp', type: 'textarea',
    label: 'Votre offre / promesse principale',
    active: true,
  },
  {
    key: 'icpTone', step: 'icp', type: 'chips',
    label: 'Ton de voix',
    options: ['Expert & autoritaire', 'Bienveillant & pédagogue', 'Direct & sans filtre', 'Inspirant & motivant', 'Élégant & premium', 'Proximal & ami'],
    active: true,
  },
  {
    key: 'icpPdf', step: 'icp', type: 'file-pdf',
    label: 'Vous avez déjà un document ICP / avatar client ?',
    hint: 'Uploadez-le en PDF — il remplacera les questions écrites ci-dessus si vous préférez',
    active: true,
  },
]

// Fusionne la config DB (si présente) avec les défauts — les questions custom sont ajoutées à la fin
export function mergeQuestions(dbQuestions: OnboardingQuestion[] | null | undefined): OnboardingQuestion[] {
  if (!dbQuestions || !Array.isArray(dbQuestions) || dbQuestions.length === 0) return DEFAULT_QUESTIONS
  const merged: OnboardingQuestion[] = []
  for (const def of DEFAULT_QUESTIONS) {
    const override = dbQuestions.find(q => q.key === def.key)
    merged.push(override ? { ...def, ...override, type: def.type, custom: false } : def)
  }
  for (const q of dbQuestions) {
    if (q.custom && !DEFAULT_QUESTIONS.some(d => d.key === q.key)) {
      merged.push({ ...q, type: 'textarea', custom: true })
    }
  }
  return merged
}
