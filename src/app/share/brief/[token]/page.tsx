import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { PrintButton } from '@/components/share/PrintButton'

export const dynamic = 'force-dynamic'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Livrable {
  id?: string
  label: string
  qty?: string
  format?: string
  notes?: string
}

interface Inspiration {
  id?: string
  url: string
  label?: string
}

interface ColorEntry {
  id?: string
  hex: string
  name?: string
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PublicBriefPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const brief = await (prisma as any).clientBrief.findUnique({
    where: { shareToken: token },
    include: {
      client: { select: { name: true, company: true, avatar: true } },
    },
  })

  if (!brief) return notFound()

  const livrables: Livrable[] = Array.isArray(brief.livrables) ? brief.livrables : []
  const inspirations: Inspiration[] = Array.isArray(brief.inspirations) ? brief.inspirations : []
  const colors: ColorEntry[] = Array.isArray(brief.colors) ? brief.colors : []
  const canaux: string[] = Array.isArray(brief.canaux) ? brief.canaux : []

  const createdDate = new Date(brief.createdAt).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;600;700&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #fafaf8;
          color: #1a1a1a;
          font-family: 'Inter', system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        .page-wrapper {
          min-height: 100vh;
          background: #fafaf8;
        }

        /* ── Header ── */
        .pub-header {
          background: #0a0a0a;
          color: #fafaf8;
          padding: 0;
        }

        .pub-header-inner {
          max-width: 900px;
          margin: 0 auto;
          padding: 36px 48px 32px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
        }

        .pub-logo {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .pub-logo-name {
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.2em;
          color: #c9a96e;
          text-transform: uppercase;
        }

        .pub-logo-dot {
          color: #e8b84b;
        }

        .pub-logo-sub {
          font-size: 10px;
          font-weight: 400;
          letter-spacing: 0.18em;
          color: #585858;
          text-transform: uppercase;
        }

        .pub-header-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 10px;
        }

        .print-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: transparent;
          border: 1px solid #c9a96e;
          color: #c9a96e;
          padding: 8px 18px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s;
          font-family: 'Inter', sans-serif;
        }

        .print-btn:hover {
          background: #c9a96e;
          color: #0a0a0a;
        }

        .pub-date {
          font-size: 11px;
          color: #444;
          letter-spacing: 0.08em;
        }

        /* ── Hero client ── */
        .pub-hero {
          max-width: 900px;
          margin: 0 auto;
          padding: 52px 48px 36px;
          border-bottom: 1px solid #e8e4dc;
        }

        .pub-hero-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.22em;
          color: #c9a96e;
          text-transform: uppercase;
          margin-bottom: 16px;
        }

        .pub-client-name {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 42px;
          font-weight: 600;
          color: #0a0a0a;
          line-height: 1.1;
          margin-bottom: 10px;
        }

        .pub-client-company {
          font-size: 16px;
          font-weight: 400;
          color: #666;
          letter-spacing: 0.04em;
        }

        .pub-meta-row {
          display: flex;
          gap: 32px;
          margin-top: 28px;
          flex-wrap: wrap;
        }

        .pub-meta-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .pub-meta-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.15em;
          color: #999;
          text-transform: uppercase;
        }

        .pub-meta-value {
          font-size: 13px;
          font-weight: 500;
          color: #2a2a2a;
        }

        /* ── Content ── */
        .pub-content {
          max-width: 900px;
          margin: 0 auto;
          padding: 0 48px 80px;
        }

        /* ── Section ── */
        .pub-section {
          padding: 40px 0 0;
          border-bottom: 1px solid #f0ece4;
          padding-bottom: 36px;
        }

        .pub-section:last-child {
          border-bottom: none;
        }

        .pub-section-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 24px;
        }

        .pub-section-bar {
          width: 3px;
          height: 22px;
          background: linear-gradient(180deg, #e8b84b, #c9a96e);
          border-radius: 2px;
          flex-shrink: 0;
        }

        .pub-section-title {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.22em;
          color: #0a0a0a;
          text-transform: uppercase;
        }

        /* ── Grid 2 colonnes ── */
        .pub-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }

        /* ── Bloc info ── */
        .info-block {
          background: white;
          border: 1px solid #e8e4dc;
          border-radius: 8px;
          padding: 20px 22px;
        }

        .info-block-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.15em;
          color: #c9a96e;
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .info-block-value {
          font-size: 14px;
          color: #2a2a2a;
          line-height: 1.6;
        }

        /* ── Livrables table ── */
        .livrables-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .livrables-table thead th {
          text-align: left;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.12em;
          color: #999;
          text-transform: uppercase;
          padding: 0 12px 12px 0;
          border-bottom: 1px solid #e8e4dc;
        }

        .livrables-table tbody tr:not(:last-child) td {
          border-bottom: 1px solid #f5f2ee;
        }

        .livrables-table tbody td {
          padding: 14px 12px 14px 0;
          color: #2a2a2a;
          vertical-align: top;
        }

        .livrable-qty-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #f5f2ee;
          color: #666;
          border-radius: 4px;
          padding: 2px 8px;
          font-size: 12px;
          font-weight: 600;
          min-width: 32px;
        }

        .livrable-format {
          font-size: 12px;
          color: #888;
          margin-top: 2px;
        }

        /* ── Inspirations ── */
        .inspirations-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .inspiration-item {
          display: flex;
          align-items: center;
          gap: 14px;
          background: white;
          border: 1px solid #e8e4dc;
          border-radius: 8px;
          padding: 14px 18px;
        }

        .inspiration-icon {
          width: 32px;
          height: 32px;
          background: #f5f2ee;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #c9a96e;
          font-size: 14px;
        }

        .inspiration-label {
          font-size: 13px;
          font-weight: 500;
          color: #2a2a2a;
        }

        .inspiration-url {
          font-size: 11px;
          color: #999;
          margin-top: 2px;
          word-break: break-all;
        }

        /* ── Palette ── */
        .palette-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
        }

        .palette-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .palette-swatch {
          width: 64px;
          height: 64px;
          border-radius: 10px;
          border: 1px solid rgba(0,0,0,0.06);
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }

        .palette-hex {
          font-size: 11px;
          font-family: 'SF Mono', 'Fira Code', monospace;
          color: #555;
          text-transform: uppercase;
        }

        .palette-name {
          font-size: 11px;
          color: #888;
          text-align: center;
        }

        /* ── Canaux chips ── */
        .canaux-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .canal-chip {
          background: white;
          border: 1px solid #e8e4dc;
          border-radius: 20px;
          padding: 6px 14px;
          font-size: 12px;
          font-weight: 500;
          color: #444;
        }

        /* ── Texte long ── */
        .pub-text-block {
          background: white;
          border: 1px solid #e8e4dc;
          border-radius: 8px;
          padding: 20px 22px;
          font-size: 14px;
          color: #2a2a2a;
          line-height: 1.75;
          white-space: pre-wrap;
        }

        /* ── Avoid list ── */
        .avoid-block {
          background: #fff8f5;
          border: 1px solid #f5d9c8;
          border-left: 3px solid #e8755a;
          border-radius: 0 8px 8px 0;
          padding: 20px 22px;
          font-size: 14px;
          color: #3a2a20;
          line-height: 1.75;
          white-space: pre-wrap;
        }

        /* ── Footer ── */
        .pub-footer {
          background: #0a0a0a;
          color: #444;
          text-align: center;
          padding: 28px 24px;
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .pub-footer-logo {
          color: #c9a96e;
          font-weight: 600;
        }

        /* ── Print ── */
        @media print {
          .print-btn { display: none !important; }
          .pub-header-right { display: none; }
          .page-wrapper { background: white; }
          .pub-hero, .pub-content { padding-left: 32px; padding-right: 32px; }
          .pub-section { page-break-inside: avoid; }
          .pub-footer { background: white; border-top: 1px solid #e0e0e0; }
        }

        @media (max-width: 640px) {
          .pub-header-inner { padding: 24px; }
          .pub-hero { padding: 32px 24px 24px; }
          .pub-content { padding: 0 24px 60px; }
          .pub-client-name { font-size: 28px; }
          .pub-grid-2 { grid-template-columns: 1fr; }
          .pub-meta-row { gap: 16px; }
        }
      `}</style>

      <div className="page-wrapper">
        {/* ── Header ── */}
        <header className="pub-header">
          <div className="pub-header-inner">
            <div className="pub-logo">
              <Image src="/nv-logo.png" alt="NV" width={48} height={48} style={{ display: 'block', marginBottom: '8px', filter: 'brightness(0) invert(1)' }} />
              <div className="pub-logo-name">
                New Vision Production
              </div>
              <div className="pub-logo-sub">Fiche de pilotage — Usage interne</div>
            </div>
            <div className="pub-header-right">
              <PrintButton />
              <div className="pub-date">Créé le {createdDate}</div>
            </div>
          </div>
        </header>

        {/* ── Hero ── */}
        <div className="pub-hero">
          <div className="pub-hero-label">Brief client</div>
          <h1 className="pub-client-name">{brief.client.name}</h1>
          {brief.client.company && (
            <div className="pub-client-company">{brief.client.company}</div>
          )}
          {(brief.niche || brief.positionnement || brief.ton || brief.deadline) && (
            <div className="pub-meta-row">
              {brief.niche && (
                <div className="pub-meta-item">
                  <span className="pub-meta-label">Niche</span>
                  <span className="pub-meta-value">{brief.niche}</span>
                </div>
              )}
              {brief.ton && (
                <div className="pub-meta-item">
                  <span className="pub-meta-label">Ton</span>
                  <span className="pub-meta-value">{brief.ton}</span>
                </div>
              )}
              {brief.monteur && (
                <div className="pub-meta-item">
                  <span className="pub-meta-label">Monteur assigné</span>
                  <span className="pub-meta-value">{brief.monteur}</span>
                </div>
              )}
              {brief.deadline && (
                <div className="pub-meta-item">
                  <span className="pub-meta-label">Deadline</span>
                  <span className="pub-meta-value">{brief.deadline}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Contenu ── */}
        <main className="pub-content">

          {/* Direction artistique */}
          {(brief.positionnement || brief.avatar || canaux.length > 0) && (
            <div className="pub-section">
              <div className="pub-section-header">
                <div className="pub-section-bar" />
                <div className="pub-section-title">Direction artistique</div>
              </div>
              <div className="pub-grid-2" style={{ marginBottom: canaux.length > 0 ? '20px' : 0 }}>
                {brief.positionnement && (
                  <div className="info-block" style={{ gridColumn: '1 / -1' }}>
                    <div className="info-block-label">Positionnement</div>
                    <div className="info-block-value">{brief.positionnement}</div>
                  </div>
                )}
                {brief.avatar && (
                  <div className="info-block" style={{ gridColumn: '1 / -1' }}>
                    <div className="info-block-label">Avatar client</div>
                    <div className="info-block-value">{brief.avatar}</div>
                  </div>
                )}
              </div>
              {canaux.length > 0 && (
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.15em', color: '#999', textTransform: 'uppercase', marginBottom: '10px' }}>
                    Canaux de diffusion
                  </div>
                  <div className="canaux-list">
                    {canaux.map((c: string, i: number) => (
                      <span key={i} className="canal-chip">{c}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Livrables */}
          {livrables.length > 0 && (
            <div className="pub-section">
              <div className="pub-section-header">
                <div className="pub-section-bar" />
                <div className="pub-section-title">Livrables</div>
              </div>
              <table className="livrables-table">
                <thead>
                  <tr>
                    <th>Format / Contenu</th>
                    <th style={{ width: 60 }}>Qté</th>
                    <th style={{ width: 140 }}>Résolution</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {livrables.map((l, i) => (
                    <tr key={l.id ?? i}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{l.label}</div>
                        {l.format && <div className="livrable-format">{l.format}</div>}
                      </td>
                      <td>
                        <span className="livrable-qty-badge">{l.qty ?? '1'}</span>
                      </td>
                      <td style={{ color: '#666', fontSize: 12 }}>{l.format ?? '—'}</td>
                      <td style={{ color: '#666', fontSize: 12 }}>{l.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Inspirations */}
          {inspirations.length > 0 && (
            <div className="pub-section">
              <div className="pub-section-header">
                <div className="pub-section-bar" />
                <div className="pub-section-title">Inspirations</div>
              </div>
              <div className="inspirations-list">
                {inspirations.map((ins, i) => (
                  <div key={ins.id ?? i} className="inspiration-item">
                    <div className="inspiration-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                      </svg>
                    </div>
                    <div>
                      {ins.label && <div className="inspiration-label">{ins.label}</div>}
                      <div className="inspiration-url">{ins.url}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Palette */}
          {colors.length > 0 && (
            <div className="pub-section">
              <div className="pub-section-header">
                <div className="pub-section-bar" />
                <div className="pub-section-title">Palette</div>
              </div>
              <div className="palette-grid">
                {colors.map((c, i) => (
                  <div key={c.id ?? i} className="palette-item">
                    <div
                      className="palette-swatch"
                      style={{ background: c.hex }}
                    />
                    <div className="palette-hex">{c.hex}</div>
                    {c.name && <div className="palette-name">{c.name}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {brief.notes && (
            <div className="pub-section">
              <div className="pub-section-header">
                <div className="pub-section-bar" />
                <div className="pub-section-title">Notes</div>
              </div>
              <div className="pub-text-block">{brief.notes}</div>
            </div>
          )}

          {/* À éviter */}
          {brief.avoidList && (
            <div className="pub-section">
              <div className="pub-section-header">
                <div className="pub-section-bar" style={{ background: 'linear-gradient(180deg, #e8755a, #c95a3a)' }} />
                <div className="pub-section-title">À éviter</div>
              </div>
              <div className="avoid-block">{brief.avoidList}</div>
            </div>
          )}

        </main>

        {/* ── Footer ── */}
        <footer className="pub-footer">
          <span className="pub-footer-logo">NV · New Vision Production</span>
          {' '}—{' '}
          Document confidentiel · Ne pas diffuser
        </footer>
      </div>
    </>
  )
}
