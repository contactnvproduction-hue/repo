import { prisma } from '@/lib/db'

// Sheet publique NVP — fallback si non configurée dans les paramètres
const DEFAULT_SHEET_ID = '1zNfAZHSKOjSJBd1VDZ4Le_kVqwrBwhOemORU1M8CB4U'

// ── CSV parser (compatible Google Sheets gviz/tq export) ─────────────────────

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

// ── Normalisation ─────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(s: string): string[] {
  return normalize(s).split(' ').filter(t => t.length > 1)
}

// ── Matching client ───────────────────────────────────────────────────────────
// Cherche dans les colonnes "Nom & Prénom" et "Marque / Entreprise"

function findNameColumn(headers: string[]): string | null {
  return headers.find(h => /nom.*pr[eé]nom|pr[eé]nom.*nom/i.test(h))
    || headers.find(h => /^1[\.\s].*nom/i.test(h))
    || headers.find(h => /^nom\b/i.test(h))
    || null
}

function findCompanyColumn(headers: string[]): string | null {
  return headers.find(h => /marque|entreprise|soci[eé]t[eé]|brand|company/i.test(h))
    || headers.find(h => /^2[\.\s]/i.test(h))
    || null
}

function matchClient(
  row: Record<string, string>,
  headers: string[],
  clients: { id: string; name: string; company?: string | null }[]
): { clientId: string; matchedOn: string } | null {
  const nomCol = findNameColumn(headers)
  const companyCol = findCompanyColumn(headers)

  const nomVal = nomCol ? (row[nomCol] || '') : ''
  const companyVal = companyCol ? (row[companyCol] || '') : ''

  const nomTokens = tokens(nomVal)
  const companyTokens = tokens(companyVal).filter(t => t.length > 2)

  for (const client of clients) {
    const clientTokens = tokens(client.name)
    const clientCompanyTokens = client.company ? tokens(client.company).filter(t => t.length > 2) : []

    // Match sur nom/prénom : au moins un token commun de longueur > 3
    const nameMatch = nomTokens.some(t => t.length > 3 && clientTokens.some(ct => ct === t))
      || clientTokens.some(ct => ct.length > 3 && nomTokens.some(t => t === ct))

    if (nameMatch) return { clientId: client.id, matchedOn: nomVal }

    // Match sur entreprise/marque
    if (companyTokens.length > 0 && clientCompanyTokens.length > 0) {
      const compMatch = companyTokens.some(t => clientCompanyTokens.some(ct => ct === t || ct.includes(t) || t.includes(ct)))
      if (compMatch) return { clientId: client.id, matchedOn: companyVal }
    }

    // Fallback : nom du client dans la valeur de l'entreprise ou vice versa
    if (companyVal) {
      const normCompany = normalize(companyVal)
      const normClientName = normalize(client.name)
      if (normCompany.includes(normClientName) || normClientName.includes(normCompany)) {
        return { clientId: client.id, matchedOn: companyVal }
      }
    }
  }

  return null
}

// ── URL CSV (format gviz — fiable sans redirect pour sheets publiques) ────────

function toCSVUrl(sheetIdOrUrl: string): string {
  const idMatch = sheetIdOrUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  const sheetId = idMatch ? idMatch[1] : sheetIdOrUrl
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`
}

// ── Sync principal ────────────────────────────────────────────────────────────

export interface SyncResult {
  total: number
  matched: number
  unmatched: number
  newEntries: number
  errors: string[]
}

export async function syncAdaForms(targetClientId?: string): Promise<SyncResult> {
  const result: SyncResult = { total: 0, matched: 0, unmatched: 0, newEntries: 0, errors: [] }

  // URL : priorité aux paramètres, fallback sur la sheet NVP
  const settings = await prisma.agencySetting.findFirst({ select: { adaSheetUrl: true } })
  const sheetSource = settings?.adaSheetUrl || DEFAULT_SHEET_ID
  const csvUrl = toCSVUrl(sheetSource)

  // Fetch CSV
  let csvText: string
  try {
    const res = await fetch(csvUrl, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    csvText = await res.text()
  } catch (e) {
    result.errors.push(`Impossible de lire la Google Sheet: ${e}`)
    return result
  }

  const { headers, rows } = parseCSV(csvText)
  if (!headers.length) {
    result.errors.push('CSV vide ou mal formé')
    return result
  }

  // Tous les clients (ou seulement le ciblé)
  const clients = await prisma.client.findMany({
    select: { id: true, name: true, company: true },
    where: targetClientId ? { id: targetClientId } : undefined,
  })

  const tsColumn = headers[0] // "Horodateur"

  for (const row of rows) {
    const timestamp = row[tsColumn]?.trim()
    if (!timestamp) continue

    result.total++

    const matchResult = matchClient(row, headers, clients)

    const existing = await prisma.adaFormResponse.findUnique({ where: { responseTimestamp: timestamp } })
    if (!existing) result.newEntries++

    try {
      await prisma.adaFormResponse.upsert({
        where: { responseTimestamp: timestamp },
        update: {
          clientId: matchResult?.clientId ?? null,
          matchedOn: matchResult?.matchedOn ?? null,
          data: row as object,
          updatedAt: new Date(),
        },
        create: {
          responseTimestamp: timestamp,
          clientId: matchResult?.clientId ?? null,
          matchedOn: matchResult?.matchedOn ?? null,
          data: row as object,
        },
      })
      if (matchResult) result.matched++
      else result.unmatched++
    } catch (e) {
      result.errors.push(`Erreur ligne ${timestamp}: ${e}`)
    }
  }

  // Re-tente de matcher les orphelines avec tous les clients
  if (!targetClientId) {
    const orphans = await prisma.adaFormResponse.findMany({
      where: { clientId: null },
      select: { id: true, data: true },
    })
    const allClients = await prisma.client.findMany({ select: { id: true, name: true, company: true } })
    for (const resp of orphans) {
      const row = resp.data as Record<string, string>
      const m = matchClient(row, headers, allClients)
      if (m) {
        await prisma.adaFormResponse.update({
          where: { id: resp.id },
          data: { clientId: m.clientId, matchedOn: m.matchedOn },
        })
      }
    }
  }

  return result
}
