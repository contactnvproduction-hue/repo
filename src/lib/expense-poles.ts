// Pôles de charges — customisables dans les paramètres. Défauts couvrant les
// grands postes d'une SAS de production vidéo.
export type ExpensePole = { name: string; color: string }

export const DEFAULT_POLES: ExpensePole[] = [
  { name: 'Investissement matériel', color: '#3b82f6' },
  { name: 'Frais de déplacement', color: '#f59e0b' },
  { name: 'Abonnements SaaS / MRR', color: '#8b5cf6' },
  { name: 'Investissement croissance', color: '#10b981' },
  { name: 'Freelances / prestataires', color: '#ec4899' },
  { name: 'Loyer / bureau', color: '#06b6d4' },
  { name: 'Marketing / publicité', color: '#ef4444' },
  { name: 'Frais généraux', color: '#94a3b8' },
]

export function resolvePoles(raw: unknown): ExpensePole[] {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .filter((p: any) => p && typeof p.name === 'string' && p.name.trim())
      .map((p: any) => ({ name: String(p.name), color: typeof p.color === 'string' ? p.color : '#94a3b8' }))
  }
  return DEFAULT_POLES
}
