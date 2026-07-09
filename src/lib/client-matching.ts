// Matching universel des clients — évite les fiches en doublon quand un client
// resigne un contrat, remplit l'onboarding, ou est closé depuis l'acquisition.
// Signaux, du plus fort au plus faible : email → nom+prénom (deux sens) → entreprise.

export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokens(s: string): string[] {
  return norm(s).split(' ').filter(t => t.length >= 2)
}

// Deux noms matchent si tous les tokens de l'un sont dans l'autre, ordre libre :
// "Laborde Nicolas" ↔ "Nicolas Laborde". Un seul token ne suffit pas (trop faible).
export function namesMatch(a: string, b: string): boolean {
  const ta = tokens(a)
  const tb = tokens(b)
  if (ta.length === 0 || tb.length === 0) return false
  const [small, big] = ta.length <= tb.length ? [ta, tb] : [tb, ta]
  return small.every(t => big.includes(t)) && small.length >= Math.min(2, big.length)
}

export type ClientMatchInput = {
  email?: string | null
  fullName?: string | null // "Prénom Nom" ou "Nom Prénom"
  company?: string | null
}

// Retourne le client existant correspondant, ou null. `db` = prisma (as any).
export async function findMatchingClient(db: any, input: ClientMatchInput): Promise<any | null> {
  // 1. Email — signal le plus fort
  if (input.email?.trim()) {
    const byEmail = await db.client.findFirst({
      where: { email: { equals: input.email.trim(), mode: 'insensitive' } },
    })
    if (byEmail) return byEmail
  }

  const clients = await db.client.findMany({
    select: { id: true, name: true, company: true },
  })

  // 2. Nom + prénom (dans les deux sens)
  if (input.fullName?.trim()) {
    const byName = clients.find((c: any) => namesMatch(input.fullName!, c.name))
    if (byName) return db.client.findUnique({ where: { id: byName.id } })
  }

  // 3. Nom d'entreprise / marque
  if (input.company?.trim()) {
    const nc = norm(input.company)
    const byCompany = clients.find((c: any) =>
      (c.company && norm(c.company) === nc) || norm(c.name) === nc
    )
    if (byCompany) return db.client.findUnique({ where: { id: byCompany.id } })
  }

  return null
}

// Paires de doublons probables parmi les clients existants (même personne/entreprise)
export function detectDuplicates(
  clients: { id: string; name: string; company: string | null; email: string | null; createdAt: Date | string }[]
): { primary: (typeof clients)[0]; duplicate: (typeof clients)[0]; reason: string }[] {
  const pairs: { primary: (typeof clients)[0]; duplicate: (typeof clients)[0]; reason: string }[] = []
  const seen = new Set<string>()

  for (let i = 0; i < clients.length; i++) {
    for (let j = i + 1; j < clients.length; j++) {
      const a = clients[i]
      const b = clients[j]
      const pairKey = [a.id, b.id].sort().join('_')
      if (seen.has(pairKey)) continue

      let reason: string | null = null
      if (a.email && b.email && norm(a.email) === norm(b.email)) reason = 'même email'
      else if (namesMatch(a.name, b.name)) reason = 'même nom'
      else if (a.company && b.company && norm(a.company) === norm(b.company)) reason = 'même entreprise'

      if (reason) {
        seen.add(pairKey)
        // La fiche la plus ancienne devient la principale
        const [primary, duplicate] = new Date(a.createdAt) <= new Date(b.createdAt) ? [a, b] : [b, a]
        pairs.push({ primary, duplicate, reason })
      }
    }
  }
  return pairs
}
