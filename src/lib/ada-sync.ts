import { prisma } from '@/lib/db'

const DEFAULT_SHEET_ID = '1zNfAZHSKOjSJBd1VDZ4Le_kVqwrBwhOemORU1M8CB4U'

// ── CSV parser ────────────────────────────────────────────────────────────────

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
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(s: string, minLen = 2): string[] {
  return normalize(s).split(' ').filter(t => t.length >= minLen)
}

// ── Extraction des handles sociaux depuis les URLs ────────────────────────────
// Parcourt TOUTES les colonnes du formulaire

function extractHandleFromUrl(url: string): string | null {
  // Instagram: instagram.com/handle (skip p/, reel/, explore/, stories/)
  const ig = url.match(/instagram\.com\/([^/?#\s]+)/i)
  if (ig) {
    const skip = ['p', 'reel', 'reels', 'explore', 'stories', 'tv', 'accounts']
    if (!skip.includes(ig[1].toLowerCase())) return ig[1]
  }
  // YouTube: @handle, /c/handle, /user/handle
  const yt = url.match(/youtube\.com\/(?:@|c\/|user\/)([^/?#\s]+)/i)
  if (yt) return yt[1]
  // TikTok: @handle
  const tt = url.match(/tiktok\.com\/@([^/?#\s]+)/i)
  if (tt) return tt[1]
  // LinkedIn: /in/handle ou /company/handle
  const li = url.match(/linkedin\.com\/(?:in|company)\/([^/?#\s]+)/i)
  if (li) return li[1]
  // Twitter/X
  const tw = url.match(/(?:twitter|x)\.com\/([^/?#\s]+)/i)
  if (tw && !['home', 'i', 'search', 'intent', 'settings', 'hashtag'].includes(tw[1].toLowerCase())) return tw[1]
  // Dernier segment de chemin significatif (≥4 chars)
  const generic = url.match(/\/([a-zA-Z][a-zA-Z0-9_.\-]{3,})\/?(?:[?#]|$)/i)
  return generic ? generic[1] : null
}

function extractSocialIdentifiers(row: Record<string, string>): string[] {
  const ids = new Set<string>()

  for (const value of Object.values(row)) {
    if (!value || value.length < 3) continue

    // 1. URLs http/https
    const urls = value.match(/https?:\/\/[^\s,;'"<>]+/gi) || []
    for (const url of urls) {
      const handle = extractHandleFromUrl(url)
      if (handle) {
        const norm = normalize(handle)
        ids.add(norm)
        // Tokens séparés par _ . - (ex: "sapiens_co" → ["sapiens", "co"])
        handle.split(/[_.\-]/).filter(p => p.length > 2).forEach(p => ids.add(normalize(p)))
      }
    }

    // 2. @handles sans URL (ex: "@neat_paris", "Inoz.intvw", "@konbini")
    const ats = value.match(/@([a-zA-Z][a-zA-Z0-9_.\-]+)/g) || []
    for (const at of ats) {
      const handle = at.slice(1)
      ids.add(normalize(handle))
      handle.split(/[_.\-]/).filter(p => p.length > 2).forEach(p => ids.add(normalize(p)))
    }

    // 3. Patterns "mot.mot" sans http (ex: "Inoz.intvw", "marketingpourcgp")
    const dotted = value.match(/\b([a-zA-Z][a-zA-Z0-9]{2,}(?:[._][a-zA-Z0-9]{2,})+)\b/g) || []
    for (const d of dotted) {
      d.split(/[._]/).filter(p => p.length > 2).forEach(p => ids.add(normalize(p)))
    }
  }

  return [...ids].filter(id => id.length > 2)
}

// ── Matching multi-niveaux ────────────────────────────────────────────────────

interface MatchResult { clientId: string; matchedOn: string; confidence: 'high' | 'medium' | 'low' }

function findNameColumn(headers: string[]): string | null {
  return headers.find(h => /nom.*pr[eé]nom|pr[eé]nom.*nom/i.test(h))
    || headers.find(h => /^1[\.\s].*nom/i.test(h))
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
): MatchResult | null {
  const nomCol = findNameColumn(headers)
  const companyCol = findCompanyColumn(headers)

  const nomVal = nomCol ? (row[nomCol] || '') : ''
  const companyVal = companyCol ? (row[companyCol] || '') : ''

  const nomTokens = tokens(nomVal, 3)  // tokens nom/prénom (min 3 chars)
  const compTokens = tokens(companyVal, 3) // tokens marque

  // Identifiants sociaux extraits de tout le formulaire
  const socialIds = extractSocialIdentifiers(row)

  for (const client of clients) {
    const cNameTokens = tokens(client.name, 3)
    const cCompTokens = client.company ? tokens(client.company, 3) : []

    // Niveau 1 — Token match sur Nom & Prénom (haute confiance)
    const nameMatch = nomTokens.some(t => cNameTokens.includes(t))
      || cNameTokens.some(ct => nomTokens.includes(ct))
    if (nameMatch) return { clientId: client.id, matchedOn: nomVal, confidence: 'high' }

    // Niveau 2 — Token match sur Marque / Entreprise
    const compMatch = compTokens.length > 0 && (
      compTokens.some(t => cNameTokens.includes(t) || cCompTokens.includes(t))
      || cCompTokens.some(ct => compTokens.includes(ct))
      || cNameTokens.some(ct => compTokens.includes(ct))
    )
    // Aussi vérifie si le nom complet du client est inclus dans la valeur entreprise
    const nameInCompany = companyVal && normalize(client.name).split(' ')
      .filter(w => w.length > 3)
      .some(w => normalize(companyVal).includes(w))
    if (compMatch || nameInCompany) return { clientId: client.id, matchedOn: companyVal, confidence: 'medium' }

    // Niveau 3 — Social handle vs nom/marque client
    const allClientIds = [
      ...cNameTokens,
      ...cCompTokens,
      normalize(client.name),
      ...(client.company ? [normalize(client.company)] : []),
    ]
    for (const socialId of socialIds) {
      if (socialId.length < 3) continue
      for (const cid of allClientIds) {
        if (cid.length < 3) continue
        // Match exact OU inclusion (ex: "sapiens_co" contient "sapiens")
        if (socialId === cid || socialId.includes(cid) || cid.includes(socialId)) {
          return {
            clientId: client.id,
            matchedOn: `handle:${socialId} → ${client.name}`,
            confidence: 'low',
          }
        }
      }
    }
  }

  return null
}

// ── URL CSV ───────────────────────────────────────────────────────────────────

function toCSVUrl(sheetIdOrUrl: string): string {
  const m = sheetIdOrUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  const id = m ? m[1] : sheetIdOrUrl
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv`
}

// ── Sync ──────────────────────────────────────────────────────────────────────

export interface SyncResult {
  total: number
  matched: number
  unmatched: number
  newEntries: number
  errors: string[]
}

export async function syncAdaForms(targetClientId?: string): Promise<SyncResult> {
  const result: SyncResult = { total: 0, matched: 0, unmatched: 0, newEntries: 0, errors: [] }

  const settings = await prisma.agencySetting.findFirst({ select: { adaSheetUrl: true } })
  const csvUrl = toCSVUrl(settings?.adaSheetUrl || DEFAULT_SHEET_ID)

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
  if (!headers.length) { result.errors.push('CSV vide ou mal formé'); return result }

  const clients = await prisma.client.findMany({
    select: { id: true, name: true, company: true },
    where: targetClientId ? { id: targetClientId } : undefined,
  })

  const tsCol = headers[0]

  for (const row of rows) {
    const timestamp = row[tsCol]?.trim()
    if (!timestamp) continue
    result.total++

    const matchResult = matchClient(row, headers, clients)
    const existing = await prisma.adaFormResponse.findUnique({ where: { responseTimestamp: timestamp } })
    if (!existing) result.newEntries++

    try {
      await prisma.adaFormResponse.upsert({
        where: { responseTimestamp: timestamp },
        update: { clientId: matchResult?.clientId ?? null, matchedOn: matchResult?.matchedOn ?? null, data: row as object, updatedAt: new Date() },
        create: { responseTimestamp: timestamp, clientId: matchResult?.clientId ?? null, matchedOn: matchResult?.matchedOn ?? null, data: row as object },
      })
      if (matchResult) result.matched++
      else result.unmatched++
    } catch (e) {
      result.errors.push(`Erreur ligne ${timestamp}: ${e}`)
    }
  }

  // Re-tente les orphelines sur tous les clients
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
