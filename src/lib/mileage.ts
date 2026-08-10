// Barème kilométrique officiel (administration fiscale française).
// Voiture, motocyclette (>50cc) et cyclomoteur (≤50cc) ont des barèmes DIFFÉRENTS
// (taux et tranches de distance différents). Majoration +20% pour l'électrique.
// Valeurs applicables en 2025 (revenus 2024). Utilisable serveur + client.
export type VehicleType = 'VOITURE' | 'MOTO' | 'CYCLOMOTEUR'
type Row = { a: number; b: number; c: number; e: number } // a: 1re tranche · b/c: tranche mid · e: tranche haute

// ── Voiture (tranches 5 000 / 20 000 km), par CV ──
const VOITURE: Record<number, Row> = {
  3: { a: 0.529, b: 0.316, c: 1065, e: 0.370 },
  4: { a: 0.606, b: 0.340, c: 1330, e: 0.407 },
  5: { a: 0.636, b: 0.357, c: 1395, e: 0.427 },
  6: { a: 0.665, b: 0.374, c: 1457, e: 0.447 },
  7: { a: 0.697, b: 0.394, c: 1515, e: 0.470 },
}
// ── Motocyclette >50cc (tranches 3 000 / 6 000 km), par CV ──
function motoRow(cv: number): Row {
  if (cv <= 2) return { a: 0.395, b: 0.099, c: 891, e: 0.248 }
  if (cv <= 5) return { a: 0.468, b: 0.082, c: 1158, e: 0.275 }
  return { a: 0.606, b: 0.079, c: 1583, e: 0.343 }
}
// ── Cyclomoteur ≤50cc (tranches 3 000 / 6 000 km, sans CV) ──
const CYCLO: Row = { a: 0.315, b: 0.079, c: 711, e: 0.198 }

export const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [
  { value: 'VOITURE', label: 'Voiture' },
  { value: 'MOTO', label: 'Motocyclette (>50cc)' },
  { value: 'CYCLOMOTEUR', label: 'Cyclomoteur (≤50cc)' },
]

// Options de puissance fiscale par type (le cyclomoteur n'a pas de CV).
export function cvOptions(type: VehicleType) {
  if (type === 'CYCLOMOTEUR') return []
  if (type === 'MOTO') return [
    { value: 2, label: '1 ou 2 CV' },
    { value: 5, label: '3, 4 ou 5 CV' },
    { value: 6, label: 'Plus de 5 CV' },
  ]
  return [
    { value: 3, label: '3 CV et moins' },
    { value: 4, label: '4 CV' },
    { value: 5, label: '5 CV' },
    { value: 6, label: '6 CV' },
    { value: 7, label: '7 CV et plus' },
  ]
}

function resolve(type: VehicleType, cv: number): { row: Row; t1: number; t2: number } {
  if (type === 'CYCLOMOTEUR') return { row: CYCLO, t1: 3000, t2: 6000 }
  if (type === 'MOTO') return { row: motoRow(cv), t1: 3000, t2: 6000 }
  return { row: VOITURE[Math.min(7, Math.max(3, Math.round(cv)))], t1: 5000, t2: 20000 }
}

// Indemnité ANNUELLE pour une distance totale d (km), selon le barème du type.
export function annualIndemnity(type: VehicleType, cv: number, km: number, electric = false): number {
  if (km <= 0) return 0
  const { row, t1, t2 } = resolve(type, cv)
  let base: number
  if (km <= t1) base = km * row.a
  else if (km <= t2) base = km * row.b + row.c
  else base = km * row.e
  return electric ? base * 1.2 : base
}

// Indemnité MENSUELLE = incrément du barème annuel entre le cumul avant ce mois
// et le cumul après (le barème étant progressif par tranches de km annuels).
export function monthlyIndemnity(type: VehicleType, cv: number, electric: boolean, kmBefore: number, kmThisMonth: number): number {
  return annualIndemnity(type, cv, kmBefore + kmThisMonth, electric) - annualIndemnity(type, cv, kmBefore, electric)
}
