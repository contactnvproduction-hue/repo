// Impôt sur les sociétés (IS) — barème progressif France.
// Taux réduit de 15% sur les bénéfices jusqu'à 42 500 €, puis taux normal 25%.
// (Taux réduit sous conditions : CA < 10 M€, capital entièrement libéré,
//  détenu ≥ 75% par des personnes physiques.)

export const IS_REDUCED_RATE = 0.15
export const IS_NORMAL_RATE = 0.25
export const IS_REDUCED_THRESHOLD = 42_500

export type ISBreakdown = {
  total: number          // IS total dû
  reducedBase: number    // part de bénéfice au taux réduit
  reducedTax: number     // IS au taux réduit
  normalBase: number     // part de bénéfice au taux normal
  normalTax: number      // IS au taux normal
  effectiveRate: number  // taux effectif (%)
}

// Calcule l'IS progressif sur un bénéfice imposable. Si eligibleReducedRate=false,
// tout est au taux normal (25%).
export function computeIS(profit: number, eligibleReducedRate = true): ISBreakdown {
  if (profit <= 0) {
    return { total: 0, reducedBase: 0, reducedTax: 0, normalBase: 0, normalTax: 0, effectiveRate: 0 }
  }
  if (!eligibleReducedRate) {
    const total = profit * IS_NORMAL_RATE
    return { total, reducedBase: 0, reducedTax: 0, normalBase: profit, normalTax: total, effectiveRate: IS_NORMAL_RATE * 100 }
  }
  const reducedBase = Math.min(profit, IS_REDUCED_THRESHOLD)
  const normalBase = Math.max(0, profit - IS_REDUCED_THRESHOLD)
  const reducedTax = reducedBase * IS_REDUCED_RATE
  const normalTax = normalBase * IS_NORMAL_RATE
  const total = reducedTax + normalTax
  return {
    total, reducedBase, reducedTax, normalBase, normalTax,
    effectiveRate: profit > 0 ? Math.round((total / profit) * 1000) / 10 : 0,
  }
}
