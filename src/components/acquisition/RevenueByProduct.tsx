'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { PieChart as PieChartIcon, Trophy } from 'lucide-react'
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Donut CA par produit */}
      <div className="lg:col-span-2 bg-nv-card border border-nv-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <PieChartIcon size={16} className="text-primary" />
          Répartition CA par produit
        </h2>
        <p className="text-xs text-nv-text-muted mt-0.5 mb-4">
          Basé sur les produits associés aux clients (fiche client, fiche projet ou close de vente).
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
                  <span className="text-nv-text-muted text-xs shrink-0">{p.quantity}x</span>
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
          Top clients — CA produits
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
  )
}
