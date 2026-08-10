// Barème kilométrique officiel (administration fiscale française) — voitures.
// Valeurs du barème applicable en 2025 (revenus 2024). Majoration +20% pour les
// véhicules électriques. Utilisable côté serveur et client.
export type MileageRow = { a: number; b: number; c: number; e: number }

// Clé = puissance fiscale (CV) : 3 = « 3 CV et moins », 7 = « 7 CV et plus ».
export const BAREME: Record<number, MileageRow> = {
  3: { a: 0.529, b: 0.316, c: 1065, e: 0.370 },
  4: { a: 0.606, b: 0.340, c: 1330, e: 0.407 },
  5: { a: 0.636, b: 0.357, c: 1395, e: 0.427 },
  6: { a: 0.665, b: 0.374, c: 1457, e: 0.447 },
  7: { a: 0.697, b: 0.394, c: 1515, e: 0.470 },
}
export const CV_OPTIONS = [
  { value: 3, label: '3 CV et moins' },
  { value: 4, label: '4 CV' },
  { value: 5, label: '5 CV' },
  { value: 6, label: '6 CV' },
  { value: 7, label: '7 CV et plus' },
]

const rowFor = (cv: number) => BAREME[Math.min(7, Math.max(3, Math.round(cv)))]

// Indemnité ANNUELLE pour une distance totale d (km), selon le barème officiel.
export function annualIndemnity(cv: number, km: number, electric = false): number {
  if (km <= 0) return 0
  const r = rowFor(cv)
  let base: number
  if (km <= 5000) base = km * r.a
  else if (km <= 20000) base = km * r.b + r.c
  else base = km * r.e
  return electric ? base * 1.2 : base
}

// Indemnité MENSUELLE = incrément du barème annuel entre le cumul avant ce mois
// et le cumul après. Sommée sur l'année, elle reproduit exactement le total
// officiel annuel (le barème étant progressif par tranches de km annuels).
export function monthlyIndemnity(cv: number, electric: boolean, kmBefore: number, kmThisMonth: number): number {
  return annualIndemnity(cv, kmBefore + kmThisMonth, electric) - annualIndemnity(cv, kmBefore, electric)
}
