'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { PieChart as PieChartIcon, Trophy, Star, Target } from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from 'recharts'

type ProductStat = {
  productId: string
  name: string
  color: string
  quantity: number
  total: number
}

type ClientStat = {
  clientId: string
  name: string
  total: number
}

export function RevenueByProduct({
  productStats,
  topClients,
}: {
  productStats: ProductStat[]
  topClients: ClientStat[]
}) {
  const totalCA = useMemo(() => productStats.reduce((s, p) => s + p.total, 0), [productStats])
  const maxClient = topClients[0]?.total ?? 0

  const chartData = productStats
    .filter(p => p.total > 0)
    .map(p => ({ name: p.name, value: p.total, color: p.color }))

  return (
   <div className="space-y-4">
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Donut CA par produit */}
      <div className="lg:col-span-2 bg-nv-card border border-nv-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <PieChartIcon size={16} className="text-primary" />
          Répartition CA par produit
        </h2>
        <p className="text-xs text-nv-text-muted mt-0.5 mb-4">
          Le CA collecté (paiements confirmés) de chaque client tagué est réparti entre ses produits (fiche client, fiche projet ou close de vente).
        </p>

        {chartData.length === 0 ? (
          <div className="text-center py-12 text-nv-text-faint text-sm">
            Aucun produit vendu pour l'instant — ajoutez des produits depuis une fiche client ou au close d'une vente.
          </div>
        ) : (
          <>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="55%"
                    outerRadius="90%"
                    paddingAngle={2}
                    stroke="#1f1f1f"
                    strokeWidth={2}
                  >
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [`${Number(value).toLocaleString('fr-FR')} €`, '']}
                    contentStyle={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 8, color: '#f0ece6', fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Légende détaillée : qty × montant × % */}
            <div className="mt-4 space-y-1.5">
              {productStats.filter(p => p.total > 0).sort((a, b) => b.total - a.total).map(p => (
                <div key={p.productId} className="flex items-center gap-3 text-sm">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="text-nv-text flex-1 min-w-0 truncate">{p.name}</span>
                  <span className="text-nv-text-muted text-xs shrink-0">{p.quantity} client{p.quantity > 1 ? 's' : ''}</span>
                  <span className="text-nv-text font-semibold shrink-0 w-24 text-right">{p.total.toLocaleString('fr-FR')} €</span>
                  <span className="text-nv-text-faint text-xs shrink-0 w-10 text-right">
                    {totalCA > 0 ? Math.round((p.total / totalCA) * 100) : 0}%
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-3 text-sm pt-2 border-t border-nv-border">
                <span className="text-nv-text-muted flex-1">Total</span>
                <span className="text-primary font-bold">{totalCA.toLocaleString('fr-FR')} €</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Top clients */}
      <div className="bg-nv-card border border-nv-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
          <Trophy size={16} className="text-primary" />
          Top clients — CA collecté
        </h2>
        {topClients.length === 0 ? (
          <p className="text-xs text-nv-text-faint text-center py-8">Aucune donnée.</p>
        ) : (
          <div className="space-y-3">
            {topClients.map((c, i) => (
              <div key={c.clientId}>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-nv-text-faint w-4 shrink-0">{i + 1}</span>
                  <Link href={`/clients/${c.clientId}`} className="text-sm text-nv-text hover:text-primary transition-colors flex-1 min-w-0 truncate">
                    {c.name}
                  </Link>
                  <span className="text-xs text-nv-text-muted shrink-0">{c.total.toLocaleString('fr-FR')} €</span>
                </div>
                <div className="ml-6 mt-1 h-1 rounded-full bg-nv-border overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: maxClient > 0 ? `${Math.max(4, (c.total / maxClient) * 100)}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

    {/* Tier-list des produits phares */}
    <ProductTierList productStats={productStats} totalCA={totalCA} />
   </div>
  )
}

// ── Tier-list : quels produits performent auprès de la cible ──
const TIERS: { key: string; label: string; color: string; desc: string }[] = [
  { key: 'S', label: 'Phare', color: '#e8b84b', desc: 'Produits phares — forte traction sur ta cible' },
  { key: 'A', label: 'Fort', color: '#10b981', desc: 'Validés par la cible, bonne demande' },
  { key: 'B', label: 'Moyen', color: '#3b82f6', desc: 'Corrects, à pousser' },
  { key: 'C', label: 'Faible', color: '#f59e0b', desc: 'Peu de traction — à questionner' },
  { key: 'D', label: 'Non validé', color: '#6b7280', desc: 'Jamais vendu — à tester ou retirer' },
]

function tierOf(pct: number, total: number): string {
  if (total <= 0 || pct <= 0) return 'D'
  if (pct >= 30) return 'S'
  if (pct >= 15) return 'A'
  if (pct >= 5) return 'B'
  return 'C'
}

function ProductTierList({ productStats, totalCA }: { productStats: ProductStat[]; totalCA: number }) {
  const ranked = useMemo(() => {
    return productStats.map(p => {
      const pct = totalCA > 0 ? (p.total / totalCA) * 100 : 0
      return { ...p, pct, tier: tierOf(pct, p.total) }
    })
  }, [productStats, totalCA])

  const byTier = useMemo(() => {
    const map: Record<string, typeof ranked> = { S: [], A: [], B: [], C: [], D: [] }
    for (const p of ranked) map[p.tier].push(p)
    for (const k in map) map[k].sort((a, b) => b.total - a.total)
    return map
  }, [ranked])

  if (productStats.length === 0) return null
  const activeTiers = TIERS.filter(t => byTier[t.key].length > 0)

  return (
    <div className="bg-nv-card border border-nv-border rounded-xl p-5">
      <h2 className="text-sm font-semibold text-white flex items-center gap-2">
        <Star size={16} className="text-primary" /> Tier-list des offres
      </h2>
      <p className="text-xs text-nv-text-muted mt-0.5 mb-4 flex items-center gap-1.5">
        <Target size={12} className="text-primary shrink-0" />
        Classement par part de CA : repère tes produits phares et ceux qui accrochent (ou non) ta cible. <span className="text-nv-text-faint">S/A = validés par la cible · C/D = à questionner.</span>
      </p>

      <div className="space-y-2">
        {activeTiers.map(t => (
          <div key={t.key} className="flex items-stretch gap-3 rounded-xl border border-nv-border overflow-hidden">
            <div className="flex flex-col items-center justify-center w-16 shrink-0 py-3" style={{ backgroundColor: `${t.color}1f` }}>
              <span className="text-2xl font-black leading-none" style={{ color: t.color }}>{t.key}</span>
              <span className="text-[9px] uppercase tracking-wider font-semibold mt-1" style={{ color: t.color }}>{t.label}</span>
            </div>
            <div className="flex-1 min-w-0 py-3 pr-3">
              <div className="flex flex-wrap gap-1.5">
                {byTier[t.key].map(p => (
                  <span key={p.productId} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border" style={{ borderColor: `${p.color}55`, backgroundColor: `${p.color}12` }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="text-nv-text font-medium">{p.name}</span>
                    {p.total > 0 && <span className="text-nv-text-faint tabular-nums">· {Math.round(p.pct)}% · {p.quantity} client{p.quantity > 1 ? 's' : ''}</span>}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-nv-text-faint mt-1.5">{t.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
