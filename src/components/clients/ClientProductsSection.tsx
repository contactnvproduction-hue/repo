'use client'

import { useState } from 'react'
import { Package, Plus, X, Check, Loader2, Trash2, Settings2 } from 'lucide-react'
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
  const [manageMode, setManageMode] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const taggedIds = new Set(items.map(i => i.productId))

  // Supprime une offre globalement (de tous les clients + du graphique CA par produit)
  const deleteProduct = async (p: Product) => {
    if (!confirm(`Supprimer l'offre « ${p.name} » ?\n\nElle sera retirée de TOUS les clients et disparaîtra du graphique CA par produit. Le CA global du client reste inchangé.`)) return
    setDeletingId(p.id)
    const prevProducts = products
    const prevItems = items
    // Optimiste
    setProducts(list => list.filter(x => x.id !== p.id))
    setItems(list => list.filter(i => i.productId !== p.id))
    try {
      const res = await fetch(`/api/products?id=${p.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Offre supprimée')
    } catch {
      setProducts(prevProducts)
      setItems(prevItems)
      toast.error('Erreur — suppression annulée')
    } finally {
      setDeletingId(null)
    }
  }

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
            if (manageMode) {
              return (
                <div
                  key={p.id}
                  className="px-3 py-1.5 rounded-full text-sm border border-red-500/30 bg-red-500/5 text-nv-text-muted flex items-center gap-1.5"
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.name}
                  <button
                    type="button"
                    onClick={() => deleteProduct(p)}
                    disabled={deletingId === p.id}
                    title="Supprimer cette offre"
                    className="ml-0.5 text-red-400/70 hover:text-red-400 transition-colors disabled:opacity-50"
                  >
                    {deletingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )
            }
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
          {!manageMode && (
            <button
              type="button"
              onClick={() => setCreatingProduct(c => !c)}
              className="px-3 py-1.5 rounded-full text-sm border border-dashed border-nv-border text-nv-text-faint hover:text-primary hover:border-primary/40 transition-colors flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Nouveau produit
            </button>
          )}
          {products.filter(p => p.active).length > 0 && (
            <button
              type="button"
              onClick={() => { setManageMode(m => !m); setCreatingProduct(false) }}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors flex items-center gap-1 ${
                manageMode
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-dashed border-nv-border text-nv-text-faint hover:text-nv-text hover:border-nv-border-light'
              }`}
            >
              {manageMode ? <><Check className="w-3.5 h-3.5" /> Terminé</> : <><Settings2 className="w-3.5 h-3.5" /> Gérer</>}
            </button>
          )}
        </div>
        {manageMode && (
          <p className="text-xs text-red-400/80">Mode gestion : supprime une offre pour l&apos;enlever de tous les clients et du graphique CA par produit.</p>
        )}

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
