'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  BarChart3, TrendingUp, TrendingDown, Wallet, Layers, Rocket, Landmark, Loader2, Check, Gauge,
} from 'lucide-react'
import {
  ComposedChart, Bar, Line, BarChart, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
} from 'recharts'
import toast from 'react-hot-toast'
import { ChargesManager } from './ChargesManager'
import { InvestmentPlanner } from './InvestmentPlanner'
import type { ExpensePole } from '@/lib/expense-poles'

const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`
const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

type Synthese = {
  year: number; caYear: number; caLastYear: number; expensesYear: number; salariesYear: number
  chargesTotalYear: number; resultBeforeTax: number; taxAmount: number
  resultNet: number; margin: number; monthly: { month: number; ca: number; charges: number; profit: number }[]
  is: { reducedBase: number; reducedTax: number; normalBase: number; normalTax: number; effectiveRate: number }
  eligibleReduced: boolean
  poleTotalsYear: Record<string, number>
}
type CaData = { year: number; caYear: number; caLastYear: number; monthlyCa: number[]; topClients: { id: string; name: string; total: number }[] }
type ChargesData = { poles: ExpensePole[]; currentMonthKey: string; allExpenses: any[]; salariesByMonth: Record<string, number>; salariesYear: number; expensesYear: number; recurring: { id: string; amount: number; description: string; pole: string | null }[] }
type Investment = { id: string; month: string; label: string; pole: string | null; amount: number; done: boolean; notes: string | null }

const TABS = [
  { id: 'synthese', label: 'Synthèse', icon: BarChart3 },
  { id: 'ca', label: 'CA annuel', icon: TrendingUp },
  { id: 'charges', label: 'Charges', icon: Layers },
  { id: 'previsionnel', label: 'Prévisionnel', icon: Wallet },
  { id: 'investissements', label: 'Investissements', icon: Rocket },
] as const

export function FinanceHub({
  synthese, ca, charges, investments, previsionnel, resultNetYear,
}: {
  synthese: Synthese; ca: CaData; charges: ChargesData; investments: Investment[]; previsionnel: React.ReactNode; resultNetYear: number
}) {
  const [tab, setTab] = useState<typeof TABS[number]['id']>('synthese')
  return (
    <div className="space-y-5">
      {/* Sous-onglets */}
      <div className="flex gap-1 bg-nv-card border border-nv-border rounded-xl p-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${tab === t.id ? 'bg-primary text-nv-black' : 'text-nv-text-muted hover:text-nv-text'}`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      <div className={tab === 'synthese' ? '' : 'hidden'}><Synthese data={synthese} /></div>
      <div className={tab === 'ca' ? '' : 'hidden'}><CaAnnuel data={ca} /></div>
      <div className={tab === 'charges' ? '' : 'hidden'}><ChargesManager data={charges} /></div>
      <div className={tab === 'previsionnel' ? '' : 'hidden'}>{previsionnel}</div>
      <div className={tab === 'investissements' ? '' : 'hidden'}><InvestmentPlanner initial={investments} poles={charges.poles} resultNetYear={resultNetYear} /></div>
    </div>
  )
}

// ── Synthèse ──
function Synthese({ data }: { data: Synthese }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const toggleReduced = async (val: boolean) => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isReducedRate: val }) })
      if (!res.ok) throw new Error(); toast.success('Recalcul de l\'IS'); router.refresh()
    } catch { toast.error('Erreur') } finally { setSaving(false) }
  }
  const chart = data.monthly.map(m => ({ name: MONTHS[m.month], CA: m.ca, Charges: m.charges, Profit: m.profit }))
  const trend = data.caLastYear > 0 ? Math.round(((data.caYear - data.caLastYear) / data.caLastYear) * 100) : null

  const kpis = [
    { label: 'CA encaissé', value: eur(data.caYear), sub: trend !== null ? `${trend >= 0 ? '▲' : '▼'} ${Math.abs(trend)}% vs N-1` : `année ${data.year}`, color: '#e8b84b' },
    { label: 'Charges totales', value: eur(data.chargesTotalYear), sub: data.salariesYear > 0 ? `dont ${eur(data.salariesYear)} de salaires` : 'tous pôles confondus', color: '#ef4444' },
    { label: 'Résultat avant IS', value: eur(data.resultBeforeTax), sub: 'CA − charges', color: data.resultBeforeTax >= 0 ? '#3b82f6' : '#ef4444' },
    { label: `IS (${data.is.effectiveRate}% eff.)`, value: eur(data.taxAmount), sub: 'barème progressif auto', color: '#f59e0b' },
    { label: 'Résultat net', value: eur(data.resultNet), sub: `marge ${data.margin}%`, color: data.resultNet >= 0 ? '#10b981' : '#ef4444' },
  ]

  // Charges par pôle (année) triées pour le compte de résultat
  const polesYear = Object.entries(data.poleTotalsYear).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])

  // Ligne du compte de résultat
  const Line2 = ({ label, value, bold, indent, positive, muted, border }: { label: string; value: number; bold?: boolean; indent?: boolean; positive?: boolean; muted?: boolean; border?: boolean }) => (
    <div className={`flex items-center justify-between py-2 ${border ? 'border-t border-nv-border mt-1 pt-2.5' : 'border-b border-nv-border/40'} ${indent ? 'pl-4' : ''}`}>
      <span className={`${bold ? 'text-sm font-bold text-white' : muted ? 'text-xs text-nv-text-muted' : 'text-sm text-nv-text'}`}>{label}</span>
      <span className={`tabular-nums ${bold ? 'text-sm font-bold' : 'text-sm'} ${positive === true ? 'text-emerald-400' : positive === false ? 'text-red-400' : bold ? 'text-white' : 'text-nv-text-muted'}`}>
        {value < 0 ? '−' : ''}{eur(Math.abs(value))}
      </span>
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="bg-nv-card border border-nv-border rounded-2xl p-4">
            <p className="text-[11px] uppercase tracking-wider text-nv-text-faint font-semibold">{k.label}</p>
            <p className="text-xl font-bold tabular-nums leading-tight mt-0.5" style={{ color: k.color }}>{k.value}</p>
            <p className="text-[11px] text-nv-text-muted mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      <MarginHealthGauge marginNet={data.margin} marginPre={data.caYear > 0 ? Math.round((data.resultBeforeTax / data.caYear) * 100) : 0} hasData={data.caYear > 0} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Compte de résultat (bilan) */}
        <div className="bg-nv-card border border-nv-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3"><Landmark size={15} className="text-primary" /> Compte de résultat — {data.year}</h3>
          <div>
            <Line2 label="Chiffre d'affaires encaissé" value={data.caYear} bold positive />
            <p className="text-[10px] uppercase tracking-wider text-nv-text-faint font-semibold mt-3 mb-1">Charges</p>
            {polesYear.map(([pole, amount]) => <Line2 key={pole} label={pole} value={-amount} indent />)}
            <Line2 label="Total charges" value={-data.chargesTotalYear} bold border />
            <Line2 label="Résultat avant impôt" value={data.resultBeforeTax} bold positive={data.resultBeforeTax >= 0} border />
            {/* Détail IS progressif */}
            {data.taxAmount > 0 && (
              <>
                <p className="text-[10px] uppercase tracking-wider text-nv-text-faint font-semibold mt-3 mb-1">Impôt sur les sociétés</p>
                {data.is.reducedTax > 0 && <Line2 label={`15% jusqu'à 42 500 € (sur ${eur(data.is.reducedBase)})`} value={-data.is.reducedTax} indent muted />}
                {data.is.normalTax > 0 && <Line2 label={`25% au-delà (sur ${eur(data.is.normalBase)})`} value={-data.is.normalTax} indent muted />}
                <Line2 label={`IS total (${data.is.effectiveRate}% effectif)`} value={-data.taxAmount} border />
              </>
            )}
            <Line2 label="Résultat net" value={data.resultNet} bold positive={data.resultNet >= 0} border />
          </div>
          <label className="flex items-center gap-2 mt-4 pt-3 border-t border-nv-border cursor-pointer text-xs text-nv-text-muted">
            <input type="checkbox" checked={data.eligibleReduced} disabled={saving} onChange={e => toggleReduced(e.target.checked)} className="w-4 h-4 accent-[#e8b84b]" />
            Éligible au taux réduit d&apos;IS à 15% (CA &lt; 10 M€, capital libéré, détenu ≥ 75% par des personnes physiques)
          </label>
        </div>

        {/* Graphique CA / charges / profit */}
        <div className="bg-nv-card border border-nv-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4"><BarChart3 size={15} className="text-primary" /> CA · Charges · Profit — {data.year}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: '#a0a0a0', fontSize: 11 }} axisLine={{ stroke: '#2a2a2a' }} tickLine={false} />
                <YAxis tick={{ fill: '#a0a0a0', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v: any, n: any) => [eur(Number(v)), n]} contentStyle={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 8, color: '#f0ece6', fontSize: 12 }} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="CA" fill="#e8b84b" radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="Charges" fill="#3f3f46" radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Line dataKey="Profit" stroke="#10b981" strokeWidth={2} dot={{ r: 2, fill: '#10b981' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Indicateur santé de la marge (repères secteur agence de contenu) ──
// Repère : pour une agence de création de contenu qui délègue captation/montage
// à des freelances, une marge nette (après IS) saine se situe autour de 15-25%.
// En-dessous de 10% la structure de coûts est fragile ; au-dessus de 30% c'est
// excellent. Zones sur une échelle 0-40%.
function MarginHealthGauge({ marginNet, marginPre, hasData }: { marginNet: number; marginPre: number; hasData: boolean }) {
  const zone =
    marginNet < 0 ? { label: 'Déficitaire', color: '#b91c1c', verdict: 'Vous perdez de l\'argent : la structure de coûts (freelances, charges) est à revoir en priorité.' }
    : marginNet < 10 ? { label: 'Fragile', color: '#ef4444', verdict: 'Rentabilité faible pour une agence. La marge est à sécuriser avant de scaler.' }
    : marginNet < 20 ? { label: 'Correct', color: '#f59e0b', verdict: 'Dans la norme, mais il reste de la marge d\'optimisation (coût de délégation, pricing).' }
    : marginNet < 30 ? { label: 'Sain', color: '#10b981', verdict: 'Bonne rentabilité pour une agence de création de contenu. Modèle solide.' }
    : { label: 'Excellent', color: '#059669', verdict: 'Très bonne rentabilité — modèle très sain, tu peux réinvestir sereinement.' }

  // Position du curseur sur l'échelle 0-40% (négatif → 0)
  const pos = Math.min(100, Math.max(0, (marginNet / 40) * 100))
  const segments = [
    { w: 25, color: '#ef4444' },  // 0-10%
    { w: 25, color: '#f59e0b' },  // 10-20%
    { w: 25, color: '#10b981' },  // 20-30%
    { w: 25, color: '#059669' },  // 30-40%+
  ]

  return (
    <div className="bg-nv-card border border-nv-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Gauge size={15} className="text-primary" /> Santé de la marge</h3>
        {hasData && (
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums" style={{ color: zone.color }}>{marginNet}%</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: zone.color, backgroundColor: `${zone.color}1f` }}>{zone.label}</span>
          </div>
        )}
      </div>

      {!hasData ? (
        <p className="text-xs text-nv-text-faint text-center py-4">Renseignez du CA et des charges pour évaluer la rentabilité.</p>
      ) : (
        <>
          {/* Jauge segmentée rouge → vert */}
          <div className="relative mt-2">
            <div className="flex h-2.5 rounded-full overflow-hidden">
              {segments.map((s, i) => <div key={i} style={{ width: `${s.w}%`, backgroundColor: s.color, opacity: 0.85 }} />)}
            </div>
            {/* Curseur position marge */}
            <div className="absolute -top-1 -bottom-1 flex flex-col items-center" style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}>
              <div className="w-0.5 h-[18px] bg-white rounded-full shadow-[0_0_0_2px_rgba(0,0,0,0.6)]" />
            </div>
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] text-nv-text-faint tabular-nums">
            <span>0%</span><span>10%</span><span>20%</span><span>30%</span><span>40%+</span>
          </div>

          <p className="text-xs text-nv-text mt-3">{zone.verdict}</p>
          <p className="text-[11px] text-nv-text-faint mt-2 pt-2 border-t border-nv-border/50">
            Repère secteur — agence de création de contenu (captation & montage délégués) : marge nette saine ≈ <span className="text-nv-text-muted">15-25%</span>.
            {' '}Ta marge est calculée après IS{marginPre !== marginNet ? ` (soit ${marginPre}% avant impôt)` : ''}.
          </p>
        </>
      )}
    </div>
  )
}

// ── CA annuel ──
function CaAnnuel({ data }: { data: CaData }) {
  const chart = data.monthlyCa.map((v, m) => ({ name: MONTHS[m], CA: v }))
  const trend = data.caLastYear > 0 ? Math.round(((data.caYear - data.caLastYear) / data.caLastYear) * 100) : null
  const maxClient = data.topClients[0]?.total ?? 1
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-nv-card border border-nv-border rounded-2xl p-5">
          <p className="text-[11px] uppercase tracking-wider text-nv-text-faint font-semibold">CA encaissé {data.year}</p>
          <p className="text-3xl font-bold text-primary tabular-nums">{eur(data.caYear)}</p>
          {trend !== null && <p className={`text-sm mt-1 font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}% vs {eur(data.caLastYear)} en {data.year - 1}</p>}
        </div>
        <div className="lg:col-span-2 bg-nv-card border border-nv-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">CA encaissé mois par mois</h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: '#a0a0a0', fontSize: 10 }} axisLine={{ stroke: '#2a2a2a' }} tickLine={false} />
                <YAxis tick={{ fill: '#a0a0a0', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} width={30} />
                <Tooltip formatter={(v: any) => [eur(Number(v)), 'CA']} contentStyle={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 8, color: '#f0ece6', fontSize: 12 }} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="CA" radius={[4, 4, 0, 0]} maxBarSize={30}>
                  {chart.map((_, i) => <Cell key={i} fill={i === new Date().getMonth() ? '#e8b84b' : 'rgba(232,184,75,0.4)'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="bg-nv-card border border-nv-border rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Top clients — CA encaissé {data.year}</h3>
        {data.topClients.length === 0 ? <p className="text-xs text-nv-text-faint">Aucun encaissement.</p> : (
          <div className="space-y-2.5">
            {data.topClients.map(c => (
              <div key={c.id}>
                <div className="flex justify-between text-sm mb-1"><Link href={`/clients/${c.id}`} className="text-nv-text hover:text-primary transition-colors">{c.name}</Link><span className="text-nv-text-muted tabular-nums">{eur(c.total)}</span></div>
                <div className="h-2 rounded-full bg-nv-dark overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, (c.total / maxClient) * 100)}%` }} /></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
