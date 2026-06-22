import { prisma } from '@/lib/db'

// ── CSV parser (compatible Google Sheets export) ──────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }

  function parseLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim()); current = ''
      } else {
        current += ch
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseLine(lines[0])
  const rows = lines.slice(1).map(line => {
    const values = parseLine(line)
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = values[i] ?? '' })
    return obj
  })
  return { headers, rows }
}

// ── Normalisation pour matching ───────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractNameCandidates(row: Record<string, string>, headers: string[]): string[] {
  const namePattern = /nom|prenom|prénom|name|entreprise|societe|société|client|raison|infopreneur/i
  const nameHeaders = headers.filter(h => namePattern.test(h))

  const candidates = new Set<string>()

  // Champs identifiés comme "nom"
  for (const h of nameHeaders) {
    const val = (row[h] || '').trim()
    if (val) {
      candidates.add(normalize(val))
      // Essaie aussi prénom + nom séparément si plusieurs mots
      val.split(/[\s,]+/).filter(Boolean).forEach(p => candidates.add(normalize(p)))
    }
  }

  // Fallback : 2e colonne (souvent le nom dans les Google Forms)
  if (candidates.size === 0 && headers[1]) {
    const val = (row[headers[1]] || '').trim()
    if (val) candidates.add(normalize(val))
  }

  return [...candidates].filter(Boolean)
}

function matchesClient(candidates: string[], clientName: string, clientCompany?: string | null): boolean {
  const targets = [normalize(clientName)]
  if (clientCompany) targets.push(normalize(clientCompany))
  // Aussi les mots individuels (prénom seul peut suffire)
  normalize(clientName).split(' ').filter(w => w.length > 2).forEach(w => targets.push(w))

  for (const candidate of candidates) {
    if (candidate.length < 3) continue
    for (const target of targets) {
      if (target.includes(candidate) || candidate.includes(target)) return true
    }
  }
  return false
}

// ── URL Google Sheets → CSV ───────────────────────────────────────────────────

function toCSVUrl(sheetUrl: string): string {
  const idMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (!idMatch) throw new Error('URL Google Sheets invalide')
  const sheetId = idMatch[1]
  const gidMatch = sheetUrl.match(/[#&?]gid=(\d+)/)
  const gid = gidMatch ? gidMatch[1] : '0'
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
}

// ── Sync principal ────────────────────────────────────────────────────────────

export interface SyncResult {
  total: number
  matched: number
  unmatched: number
  errors: string[]
}

export async function syncAdaForms(targetClientId?: string): Promise<SyncResult> {
  const result: SyncResult = { total: 0, matched: 0, unmatched: 0, errors: [] }

  // 1. Récupère l'URL de la sheet
  const settings = await prisma.agencySetting.findFirst({ select: { adaSheetUrl: true } })
  if (!settings?.adaSheetUrl) {
    result.errors.push('Aucune Google Sheet configurée dans les paramètres')
    return result
  }

  // 2. Fetch CSV
  let csvText: string
  try {
    const csvUrl = toCSVUrl(settings.adaSheetUrl)
    const res = await fetch(csvUrl, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    csvText = await res.text()
  } catch (e) {
    result.errors.push(`Impossible de lire la Google Sheet: ${e}`)
    return result
  }

  // 3. Parse
  const { headers, rows } = parseCSV(csvText)
  if (!headers.length) {
    result.errors.push('CSV vide ou mal formé')
    return result
  }

  // 4. Charge tous les clients pour le matching
  const clients = await prisma.client.findMany({
    select: { id: true, name: true, company: true },
    where: targetClientId ? { id: targetClientId } : {},
  })

  // 5. Timestamp column (always first in Google Forms: "Horodateur" or "Timestamp")
  const tsColumn = headers[0]

  // 6. Process each row
  for (const row of rows) {
    const timestamp = row[tsColumn]?.trim()
    if (!timestamp) continue

    result.total++

    const candidates = extractNameCandidates(row, headers)
    let matchedClientId: string | null = null
    let matchedOn: string | null = null

    for (const client of clients) {
      if (matchesClient(candidates, client.name, client.company)) {
        matchedClientId = client.id
        matchedOn = candidates[0] || null
        break
      }
    }

    // Upsert
    try {
      await prisma.adaFormResponse.upsert({
        where: { responseTimestamp: timestamp },
        update: {
          clientId: matchedClientId,
          matchedOn,
          data: row as object,
          updatedAt: new Date(),
        },
        create: {
          responseTimestamp: timestamp,
          clientId: matchedClientId,
          matchedOn,
          data: row as object,
        },
      })
      if (matchedClientId) result.matched++
      else result.unmatched++
    } catch (e) {
      result.errors.push(`Erreur ligne ${timestamp}: ${e}`)
    }
  }

  // 7. Re-tente de matcher les réponses orphelines avec les clients existants
  if (!targetClientId) {
    const unmatched = await prisma.adaFormResponse.findMany({
      where: { clientId: null },
      select: { id: true, responseTimestamp: true, data: true },
    })
    const allClients = await prisma.client.findMany({ select: { id: true, name: true, company: true } })
    for (const resp of unmatched) {
      const row = resp.data as Record<string, string>
      const candidates = extractNameCandidates(row, headers)
      for (const client of allClients) {
        if (matchesClient(candidates, client.name, client.company)) {
          await prisma.adaFormResponse.update({
            where: { id: resp.id },
            data: { clientId: client.id, matchedOn: candidates[0] || null },
          })
          break
        }
      }
    }
  }

  return result
}
