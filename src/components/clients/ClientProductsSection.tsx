'use client'

import { useState } from 'react'
import { Package, Plus, X, Check, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Product = {
  id: string
  name: string
  color: string
  defaultPrice: number | null
  active: boolean
}

type ClientProductItem = {
  id: string
  productId: string
  product: Product
}

const inputCls = 'bg-nv-black border border-nv-border rounded-lg px-3 py-2 text-sm text-nv-text placeholder-nv-text-faint focus:outline-none focus:border-primary/60 transition-colors'

export function ClientProductsSection({
  clientId,
  allProducts,
  initialItems,
}: {
  clientId: string
  allProducts: Product[]
  initialItems: ClientProductItem[]
}) {
  const [products, setProducts] = useState<Product[]>(allProducts)
  const [items, setItems] = useState<ClientProductItem[]>(initialItems)
  const [saving, setSaving] = useState(false)
  const [creatingProduct, setCreatingProduct] = useState(false)
  const [newProductName, setNewProductName] = useState('')

  const taggedIds = new Set(items.map(i => i.productId))

  const toggleTag = async (p: Product) => {
    const existing = items.find(i => i.productId === p.id)
    if (existing) {
      // Retirer le tag
      setItems(list => list.filter(i => i.id !== existing.id))
      const res = await fetch(`/api/client-products?id=${existing.id}`, { method: 'DELETE' })
      if (!res.ok) {
        setItems(list => [...list, existing])
        toast.error('Erreur')
      }
    } else {
      // Ajouter le tag
      setSaving(true)
      try {
        const res = await fetch('/api/client-products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, productId: p.id }),
        })
        if (!res.ok) throw new Error()
        const item = await res.json()
        setItems(list => [...list, item])
      } catch {
        toast.error('Erreur')
      } finally {
        setSaving(false)
      }
    }
  }

  const createProduct = async () => {
    if (!newProductName.trim()) { toast.error('Nom du produit requis'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProductName,
          color: `hsl(${Math.floor(Math.random() * 360)}, 65%, 55%)`,
        }),
      })
      if (!res.ok) throw new Error()
      const product = await res.json()
      setProducts(p => [...p, product])
      setCreatingProduct(false)
      setNewProductName('')
      toast.success('Produit créé — cliquez dessus pour le taguer')
    } catch {
      toast.error('Erreur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Package size={16} className="text-primary" />
          Produits / Offres
          {items.length > 0 && (
            <span className="text-xs font-normal text-nv-text-muted">{items.length} tag(s)</span>
          )}
        </CardTitle>
        <p className="text-sm text-nv-text-muted">
          Taguez les offres vendues à ce client — son CA collecté est automatiquement réparti entre ses tags dans le graphique CA par produit (Acquisition).
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {products.filter(p => p.active).map(p => {
            const tagged = taggedIds.has(p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleTag(p)}
                disabled={saving}
                className={`px-3 py-1.5 rounded-full text-sm border transition-all flex items-center gap-1.5 ${
                  tagged
                    ? 'border-primary bg-primary/15 text-primary font-medium'
                    : 'border-nv-border bg-nv-card text-nv-text-muted hover:text-nv-text hover:border-nv-border-light'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                {p.name}
                {tagged && <Check className="w-3 h-3" />}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setCreatingProduct(c => !c)}
            className="px-3 py-1.5 rounded-full text-sm border border-dashed border-nv-border text-nv-text-faint hover:text-primary hover:border-primary/40 transition-colors flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Nouveau produit
          </button>
        </div>

        {creatingProduct && (
          <div className="flex items-center gap-2">
            <input
              className={`${inputCls} flex-1`}
              placeholder="Nom — ex: Offre batch content, Documentaire…"
              value={newProductName}
              onChange={e => setNewProductName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createProduct()}
            />
            <button type="button" onClick={createProduct} disabled={saving} className="px-3 py-2 text-sm bg-primary text-nv-black rounded-lg font-medium flex items-center gap-1 disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </button>
            <button type="button" onClick={() => setCreatingProduct(false)} className="px-3 py-2 text-sm border border-nv-border rounded-lg text-nv-text-muted">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {items.length === 0 && (
          <p className="text-xs text-nv-text-faint">Aucun produit tagué sur ce client.</p>
        )}
      </CardContent>
    </Card>
  )
}
