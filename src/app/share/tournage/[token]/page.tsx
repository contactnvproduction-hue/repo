import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { PrintButton } from '@/components/share/PrintButton'

export const dynamic = 'force-dynamic'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TeamMember {
  name: string
  role: string
  phone?: string
}

interface ScheduleSlot {
  time: string
  description: string
  notes?: string
}

interface DaInfo {
  format?: string
  style?: string
  ambiance?: string
  typographie?: string
  couleurs?: string
  [key: string]: string | undefined
}

interface ExternalLink {
  label: string
  url: string
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PublicShootingPlanPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const plan = await (prisma as any).shootingPlan.findUnique({
    where: { shareToken: token },
    include: {
      client: { select: { name: true, company: true } },
    },
  })

  if (!plan) return notFound()

  const team: TeamMember[] = Array.isArray(plan.team) ? plan.team : []
  const schedule: ScheduleSlot[] = Array.isArray(plan.schedule) ? plan.schedule : []
  const daInfo: DaInfo = (plan.daInfo && typeof plan.daInfo === 'object' && !Array.isArray(plan.daInfo)) ? plan.daInfo as DaInfo : {}
  const links: ExternalLink[] = Array.isArray(plan.links) ? plan.links : []

  const shootDateStr = plan.shootDate
    ? new Date(plan.shootDate).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  const createdDate = new Date(plan.createdAt).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  const daKeys = Object.keys(daInfo).filter((k) => daInfo[k])

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
        }

        .pub-header-inner {
          max-width: 960px;
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
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.2em;
          color: #c9a96e;
          text-transform: uppercase;
        }

        .pub-logo-dot { color: #e8b84b; }

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

        /* ── Hero ── */
        .pub-hero {
          background: #0a0a0a;
          border-top: 1px solid #1e1e1e;
          padding-bottom: 0;
        }

        .pub-hero-inner {
          max-width: 960px;
          margin: 0 auto;
          padding: 32px 48px 40px;
        }

        .pub-type-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.25em;
          color: #e8b84b;
          text-transform: uppercase;
          margin-bottom: 14px;
        }

        .pub-plan-title {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 38px;
          font-weight: 600;
          color: #fafaf8;
          line-height: 1.15;
          margin-bottom: 8px;
        }

        .pub-plan-client {
          font-size: 15px;
          color: #888;
          margin-bottom: 28px;
        }

        .pub-plan-client strong {
          color: #c9a96e;
          font-weight: 500;
        }

        .hero-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .hero-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #161616;
          border: 1px solid #2a2a2a;
          border-radius: 6px;
          padding: 10px 16px;
        }

        .hero-badge-icon {
          width: 16px;
          height: 16px;
          color: #c9a96e;
          flex-shrink: 0;
        }

        .hero-badge-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.12em;
          color: #666;
          text-transform: uppercase;
          margin-bottom: 2px;
        }

        .hero-badge-value {
          font-size: 13px;
          font-weight: 500;
          color: #d0ccc4;
        }

        /* ── Content layout ── */
        .pub-content {
          max-width: 960px;
          margin: 0 auto;
          padding: 48px 48px 80px;
        }

        .pub-grid-main {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 48px;
        }

        .pub-col-left, .pub-col-right {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* ── Card ── */
        .pub-card {
          background: white;
          border: 1px solid #e8e4dc;
          border-radius: 10px;
          overflow: hidden;
        }

        .pub-card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          border-bottom: 1px solid #f0ece4;
          background: #fdfcfa;
        }

        .pub-card-bar {
          width: 3px;
          height: 18px;
          background: linear-gradient(180deg, #e8b84b, #c9a96e);
          border-radius: 2px;
          flex-shrink: 0;
        }

        .pub-card-title {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.2em;
          color: #0a0a0a;
          text-transform: uppercase;
        }

        .pub-card-body {
          padding: 20px;
        }

        /* ── Team list ── */
        .team-list {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .team-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid #f5f2ee;
        }

        .team-item:last-child { border-bottom: none; }

        .team-name {
          font-size: 13px;
          font-weight: 600;
          color: #1a1a1a;
        }

        .team-role {
          font-size: 11px;
          color: #888;
          margin-top: 2px;
        }

        .team-phone {
          font-size: 12px;
          color: #c9a96e;
          font-family: 'SF Mono', 'Fira Code', monospace;
        }

        /* ── Logistique ── */
        .logistique-rows {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .logistique-row {
          display: flex;
          gap: 14px;
        }

        .logistique-row-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.12em;
          color: #c9a96e;
          text-transform: uppercase;
          min-width: 80px;
          padding-top: 2px;
        }

        .logistique-row-value {
          font-size: 13px;
          color: #2a2a2a;
          line-height: 1.5;
        }

        /* ── Timeline schedule ── */
        .pub-section {
          margin-bottom: 48px;
        }

        .pub-section:last-child { margin-bottom: 0; }

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

        .timeline {
          position: relative;
          padding-left: 80px;
        }

        .timeline::before {
          content: '';
          position: absolute;
          left: 56px;
          top: 0;
          bottom: 0;
          width: 1px;
          background: linear-gradient(180deg, #e8b84b 0%, #e8b84b 80%, transparent 100%);
          opacity: 0.3;
        }

        .timeline-item {
          position: relative;
          display: flex;
          gap: 20px;
          padding-bottom: 28px;
        }

        .timeline-item:last-child { padding-bottom: 0; }

        .timeline-time {
          position: absolute;
          left: -80px;
          width: 56px;
          text-align: right;
          font-size: 12px;
          font-weight: 600;
          color: #c9a96e;
          font-family: 'SF Mono', 'Fira Code', monospace;
          padding-top: 2px;
        }

        .timeline-dot {
          position: absolute;
          left: -28px;
          top: 4px;
          width: 10px;
          height: 10px;
          background: white;
          border: 2px solid #e8b84b;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .timeline-content {
          background: white;
          border: 1px solid #e8e4dc;
          border-radius: 8px;
          padding: 14px 18px;
          flex: 1;
        }

        .timeline-desc {
          font-size: 13px;
          font-weight: 500;
          color: #1a1a1a;
          line-height: 1.4;
        }

        .timeline-notes {
          font-size: 12px;
          color: #888;
          margin-top: 6px;
          line-height: 1.5;
        }

        /* ── DA Format ── */
        .da-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
        }

        .da-item {
          background: white;
          border: 1px solid #e8e4dc;
          border-radius: 8px;
          padding: 16px 18px;
        }

        .da-item-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.14em;
          color: #c9a96e;
          text-transform: uppercase;
          margin-bottom: 6px;
        }

        .da-item-value {
          font-size: 13px;
          color: #2a2a2a;
          line-height: 1.5;
        }

        /* ── DA format display ── */
        .da-format-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #0a0a0a;
          color: #e8b84b;
          border-radius: 6px;
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.08em;
        }

        /* ── Resources & Liens ── */
        .links-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .link-item {
          display: flex;
          align-items: center;
          gap: 12px;
          background: white;
          border: 1px solid #e8e4dc;
          border-radius: 8px;
          padding: 12px 16px;
        }

        .link-icon {
          width: 32px;
          height: 32px;
          background: #f5f2ee;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #c9a96e;
        }

        .link-label {
          font-size: 13px;
          font-weight: 500;
          color: #1a1a1a;
        }

        .link-url {
          font-size: 11px;
          color: #999;
          margin-top: 2px;
          word-break: break-all;
        }

        /* ── Text areas ── */
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
          .pub-header-right .print-btn { display: none; }
          .page-wrapper { background: white; }
          .pub-section { page-break-inside: avoid; }
          .pub-card { page-break-inside: avoid; }
          .pub-footer { background: white; border-top: 1px solid #e0e0e0; }
          .pub-hero { background: #0a0a0a !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }

        @media (max-width: 640px) {
          .pub-header-inner { padding: 24px; }
          .pub-hero-inner { padding: 24px; }
          .pub-content { padding: 32px 24px 60px; }
          .pub-plan-title { font-size: 26px; }
          .pub-grid-main { grid-template-columns: 1fr; }
          .da-grid { grid-template-columns: 1fr; }
          .timeline { padding-left: 64px; }
          .timeline-time { left: -64px; width: 44px; font-size: 11px; }
        }
      `}</style>

      <div className="page-wrapper">
        {/* ── Header ── */}
        <header className="pub-header">
          <div className="pub-header-inner">
            <div className="pub-logo">
              <Image src="/nv-logo.png" alt="NV" width={48} height={48} style={{ display: 'block', marginBottom: '8px', filter: 'brightness(0) invert(1)' }} />
              <div className="pub-logo-name">New Vision Production</div>
              <div className="pub-logo-sub">Plan de tournage</div>
            </div>
            <div className="pub-header-right">
              <PrintButton />
              <div className="pub-date">Créé le {createdDate}</div>
            </div>
          </div>
        </header>

        {/* ── Hero ── */}
        <div className="pub-hero">
          <div className="pub-hero-inner">
            <div className="pub-type-label">Plan de tournage</div>
            <h1 className="pub-plan-title">
              {plan.title || `Tournage — ${plan.client.name}`}
            </h1>
            <div className="pub-plan-client">
              Client : <strong>{plan.client.name}</strong>
              {plan.client.company && ` · ${plan.client.company}`}
            </div>

            <div className="hero-badges">
              {shootDateStr && (
                <div className="hero-badge">
                  <svg className="hero-badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <div>
                    <div className="hero-badge-label">Date</div>
                    <div className="hero-badge-value">{shootDateStr}</div>
                  </div>
                </div>
              )}
              {plan.meetTime && (
                <div className="hero-badge">
                  <svg className="hero-badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <div>
                    <div className="hero-badge-label">Heure de rdv</div>
                    <div className="hero-badge-value">{plan.meetTime}</div>
                  </div>
                </div>
              )}
              {plan.duration && (
                <div className="hero-badge">
                  <svg className="hero-badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8h1a4 4 0 010 8h-1" />
                    <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" />
                    <line x1="6" y1="1" x2="6" y2="4" />
                    <line x1="10" y1="1" x2="10" y2="4" />
                    <line x1="14" y1="1" x2="14" y2="4" />
                  </svg>
                  <div>
                    <div className="hero-badge-label">Durée</div>
                    <div className="hero-badge-value">{plan.duration}</div>
                  </div>
                </div>
              )}
              {plan.location && (
                <div className="hero-badge">
                  <svg className="hero-badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <div>
                    <div className="hero-badge-label">Lieu</div>
                    <div className="hero-badge-value">{plan.location}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Contenu principal ── */}
        <main className="pub-content">

          {/* Grid 2 colonnes : client & équipe | logistique */}
          <div className="pub-grid-main">
            <div className="pub-col-left">

              {/* Client & Positionnement */}
              {(plan.client.company || plan.deliverables) && (
                <div className="pub-card">
                  <div className="pub-card-header">
                    <div className="pub-card-bar" />
                    <div className="pub-card-title">Client & Objectifs</div>
                  </div>
                  <div className="pub-card-body">
                    <div className="logistique-rows">
                      {plan.client.company && (
                        <div className="logistique-row">
                          <div className="logistique-row-label">Entreprise</div>
                          <div className="logistique-row-value">{plan.client.company}</div>
                        </div>
                      )}
                      {plan.deliverables && (
                        <div className="logistique-row">
                          <div className="logistique-row-label">Livrables</div>
                          <div className="logistique-row-value">{plan.deliverables}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Équipe */}
              {team.length > 0 && (
                <div className="pub-card">
                  <div className="pub-card-header">
                    <div className="pub-card-bar" />
                    <div className="pub-card-title">Équipe</div>
                  </div>
                  <div className="pub-card-body" style={{ padding: '0 20px' }}>
                    <div className="team-list">
                      {team.map((m, i) => (
                        <div key={i} className="team-item">
                          <div>
                            <div className="team-name">{m.name}</div>
                            <div className="team-role">{m.role}</div>
                          </div>
                          {m.phone && (
                            <div className="team-phone">{m.phone}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pub-col-right">
              {/* Logistique */}
              {(plan.location || plan.locationAddress || plan.equipment || plan.outfits) && (
                <div className="pub-card">
                  <div className="pub-card-header">
                    <div className="pub-card-bar" />
                    <div className="pub-card-title">Logistique</div>
                  </div>
                  <div className="pub-card-body">
                    <div className="logistique-rows">
                      {plan.location && (
                        <div className="logistique-row">
                          <div className="logistique-row-label">Lieu</div>
                          <div className="logistique-row-value">{plan.location}</div>
                        </div>
                      )}
                      {plan.locationAddress && (
                        <div className="logistique-row">
                          <div className="logistique-row-label">Adresse</div>
                          <div className="logistique-row-value">{plan.locationAddress}</div>
                        </div>
                      )}
                      {plan.meetTime && (
                        <div className="logistique-row">
                          <div className="logistique-row-label">Rdv à</div>
                          <div className="logistique-row-value">{plan.meetTime}</div>
                        </div>
                      )}
                      {plan.equipment && (
                        <div className="logistique-row">
                          <div className="logistique-row-label">Équipement</div>
                          <div className="logistique-row-value">{plan.equipment}</div>
                        </div>
                      )}
                      {plan.outfits && (
                        <div className="logistique-row">
                          <div className="logistique-row-label">Tenues</div>
                          <div className="logistique-row-value">{plan.outfits}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Déroulé de la journée */}
          {schedule.length > 0 && (
            <div className="pub-section">
              <div className="pub-section-header">
                <div className="pub-section-bar" />
                <div className="pub-section-title">Déroulé de la journée</div>
              </div>
              <div className="timeline">
                {schedule.map((slot, i) => (
                  <div key={i} className="timeline-item">
                    <div className="timeline-time">{slot.time}</div>
                    <div className="timeline-dot" />
                    <div className="timeline-content">
                      <div className="timeline-desc">{slot.description}</div>
                      {slot.notes && (
                        <div className="timeline-notes">{slot.notes}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Format & DA */}
          {(plan.daFormat || daKeys.length > 0) && (
            <div className="pub-section">
              <div className="pub-section-header">
                <div className="pub-section-bar" />
                <div className="pub-section-title">Format & DA client</div>
              </div>
              {plan.daFormat && (
                <div style={{ marginBottom: daKeys.length > 0 ? '20px' : 0 }}>
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      letterSpacing: '0.14em',
                      color: '#999',
                      textTransform: 'uppercase',
                      marginBottom: '10px',
                    }}
                  >
                    Format principal
                  </div>
                  <span className="da-format-chip">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58 2.78 2.78 0 001.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.96A29 29 0 0023 12a29 29 0 00-.46-5.58z" />
                      <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" />
                    </svg>
                    {plan.daFormat}
                  </span>
                </div>
              )}
              {daKeys.length > 0 && (
                <div className="da-grid">
                  {daKeys.map((key) => (
                    <div key={key} className="da-item">
                      <div className="da-item-label">{key}</div>
                      <div className="da-item-value">{daInfo[key]}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {plan.notes && (
            <div className="pub-section">
              <div className="pub-section-header">
                <div className="pub-section-bar" />
                <div className="pub-section-title">Informations clés & Notes</div>
              </div>
              <div className="pub-text-block">{plan.notes}</div>
            </div>
          )}

          {/* Liens & Ressources */}
          {links.length > 0 && (
            <div className="pub-section">
              <div className="pub-section-header">
                <div className="pub-section-bar" />
                <div className="pub-section-title">Ressources & Liens</div>
              </div>
              <div className="links-list">
                {links.map((link, i) => (
                  <div key={i} className="link-item">
                    <div className="link-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                      </svg>
                    </div>
                    <div>
                      <div className="link-label">{link.label}</div>
                      <div className="link-url">{link.url}</div>
                    </div>
                  </div>
                ))}
              </div>
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
