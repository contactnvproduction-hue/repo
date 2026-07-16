// Pôles de charges — customisables dans les paramètres. Défauts couvrant les
// grands postes d'une SAS de production vidéo.
export type ExpensePole = { name: string; color: string }

export const DEFAULT_POLES: ExpensePole[] = [
  { name: 'Salaires', color: '#22d3ee' },
  { name: 'Investissement matériel', color: '#3b82f6' },
  { name: 'Frais de déplacement', color: '#f59e0b' },
  { name: 'Abonnements SaaS / MRR', color: '#8b5cf6' },
  { name: 'Investissement croissance', color: '#10b981' },
  { name: 'Freelances / prestataires', color: '#ec4899' },
  { name: 'Loyer / bureau', color: '#06b6d4' },
  { name: 'Marketing / publicité', color: '#ef4444' },
  { name: 'Frais généraux', color: '#94a3b8' },
]

// Détecte le pôle "Salaires" (calcul de la masse salariale)
export function isSalaryPole(pole: string | null | undefined): boolean {
  return !!pole && /salaire/i.test(pole)
}

// TVA récupérable estimée par pôle : taux de TVA déductible (%) applique au TTC.
// 0 = non récupérable. Estimations basées sur la nature des dépenses NV.
export function recoverableVatRate(pole: string | null | undefined): number {
  const p = (pole || '').toLowerCase()
  if (/salaire|freelance|prestataire/.test(p)) return 0          // freelances/salaires : pas de TVA récupérable
  if (/matériel|materiel|électronique|electronique/.test(p)) return 20 // Amazon/électronique : 20%
  if (/saas|mrr|abonnement|logiciel/.test(p)) return 20          // SaaS : 20%
  if (/location|loyer|bureau/.test(p)) return 20                 // location : 20%
  if (/déplacement|deplacement|voyage/.test(p)) return 8         // mix transport/hôtel (non déduct.) + restos (déduct.) → ~8% effectif
  if (/marketing|publicité|publicite|ads/.test(p)) return 20     // pub : 20%
  if (/croissance|général|general|divers|autre/.test(p)) return 20
  return 20
}

// TVA récupérable estimée sur un montant TTC : TTC × taux/(100+taux)
export function estimateRecoverableVat(amountTTC: number, pole: string | null | undefined): number {
  const rate = recoverableVatRate(pole)
  if (rate <= 0) return 0
  return amountTTC * (rate / (100 + rate))
}

export function resolvePoles(raw: unknown): ExpensePole[] {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .filter((p: any) => p && typeof p.name === 'string' && p.name.trim())
      .map((p: any) => ({ name: String(p.name), color: typeof p.color === 'string' ? p.color : '#94a3b8' }))
  }
  return DEFAULT_POLES
}
