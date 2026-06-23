'use client'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        background: 'transparent',
        border: '1px solid #c9a96e',
        color: '#c9a96e',
        padding: '8px 18px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 500,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        fontFamily: "'Inter', sans-serif",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget
        el.style.background = '#c9a96e'
        el.style.color = '#0a0a0a'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget
        el.style.background = 'transparent'
        el.style.color = '#c9a96e'
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" />
      </svg>
      Imprimer / PDF
    </button>
  )
}
