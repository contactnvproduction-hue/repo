'use client'

import { useState } from 'react'
import { Package, Plus, Trash2, Check, Loader2, X } from 'lucide-react'
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
  quantity: number
  amount: number
  notes: string | null
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
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)

  // Formulaire d'ajout
  const [selProductId, setSelProductId] = useState('')
  const [qty, setQty] = useState('1')
  const [amount, setAmount] = useState('')
  const [creatingProduct, setCreatingProduct] = useState(false)
  const [newProductName, setNewProductName] = useState('')
  const [newProductPrice, setNewProductPrice] = useState('')

  const selectProduct = (id: string) => {
    setSelProductId(id)
    const p = products.find(x => x.id === id)
    if (p?.defaultPrice != null) {
      setAmount(String(p.defaultPrice * (parseInt(qty) || 1)))
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
          defaultPrice: newProductPrice ? parseFloat(newProductPrice) : null,
          color: `hsl(${Math.floor(Math.random() * 360)}, 65%, 55%)`,
        }),
      })
      if (!res.ok) throw new Error()
      const product = await res.json()
      setProducts(p => [...p, product])
      setSelProductId(product.id)
      if (product.defaultPrice != null) setAmount(String(product.defaultPrice))
      setCreatingProduct(false)
      setNewProductName('')
      setNewProductPrice('')
      toast.success('Produit créé')
    } catch {
      toast.error('Erreur')
    } finally {
      setSaving(false)
    }
  }

  const addItem = async () => {
    if (!selProductId) { toast.error('Choisissez un produit'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/client-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          productId: selProductId,
          quantity: parseInt(qty) || 1,
          amount: parseFloat(amount) || 0,
        }),
      })
      if (!res.ok) throw new Error()
      const item = await res.json()
      setItems(i => [item, ...i])
      setAdding(false)
      setSelProductId('')
      setQty('1')
      setAmount('')
      toast.success('Produit ajouté')
    } catch {
      toast.error('Erreur')
    } finally {
      setSaving(false)
    }
  }

  const updateItem = async (id: string, patch: { quantity?: number; amount?: number }) => {
    setItems(i => i.map(x => x.id === id ? { ...x, ...patch } : x))
    await fetch('/api/client-products', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    })
  }

  const deleteItem = async (id: string) => {
    if (!confirm('Retirer ce produit du client ?')) return
    const res = await fetch(`/api/client-products?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setItems(i => i.filter(x => x.id !== id))
      toast.success('Produit retiré')
    }
  }

  const total = items.reduce((s, i) => s + i.amount, 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package size={16} className="text-primary" />
            Produits / Offres
            {items.length > 0 && (
              <span className="text-xs font-normal text-nv-text-muted">
                {items.length} · {total.toLocaleString('fr-FR')} €
              </span>
            )}
          </CardTitle>
          <button
            type="button"
            onClick={() => setAdding(a => !a)}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary-light transition-colors"
          >
            <Plus className="w-3 h-3" /> Ajouter
          </button>
        </div>
        <p className="text-sm text-nv-text-muted">Offres vendues à ce client — alimentent la répartition CA par produit (Acquisition).</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {adding && (
          <div className="bg-nv-dark border border-primary/30 rounded-xl p-3 space-y-3">
            {creatingProduct ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input className={inputCls} placeholder="Nom — ex: Offre batch content" value={newProductName} onChange={e => setNewProductName(e.target.value)} />
                  <input className={inputCls} type="number" placeholder="Prix par défaut (€)" value={newProductPrice} onChange={e => setNewProductPrice(e.target.value)} />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setCreatingProduct(false)} className="px-3 py-1.5 text-xs border border-nv-border rounded-lg text-nv-text-muted flex items-center gap-1">
                    <X className="w-3 h-3" /> Annuler
                  </button>
                  <button type="button" onClick={createProduct} disabled={saving} className="px-3 py-1.5 text-xs bg-primary text-nv-black rounded-lg font-medium flex items-center gap-1 disabled:opacity-60">
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Créer le produit
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {products.filter(p => p.active).map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectProduct(p.id)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition-all flex items-center gap-1.5 ${
                        selProductId === p.id
                          ? 'border-primary bg-primary/15 text-primary font-medium'
                          : 'border-nv-border bg-nv-card text-nv-text-muted hover:text-nv-text hover:border-nv-border-light'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                      {p.name}
                      {p.defaultPrice != null && <span className="text-nv-text-faint">{p.defaultPrice.toLocaleString('fr-FR')} €</span>}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCreatingProduct(true)}
                    className="px-3 py-1.5 rounded-full text-xs border border-dashed border-nv-border text-nv-text-faint hover:text-primary hover:border-primary/40 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Nouveau produit
                  </button>
                </div>
                <div className="flex items-end gap-2">
                  <div>
                    <label className="text-[10px] text-nv-text-muted block mb-1">Quantité</label>
                    <input
                      className={`${inputCls} w-20`}
                      type="number"
                      min="1"
                      value={qty}
                      onChange={e => {
                        setQty(e.target.value)
                        const p = products.find(x => x.id === selProductId)
                        if (p?.defaultPrice != null) setAmount(String(p.defaultPrice * (parseInt(e.target.value) || 1)))
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-nv-text-muted block mb-1">Montant total (€)</label>
                    <input className={`${inputCls} w-full`} type="number" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} />
                  </div>
                  <button
                    type="button"
                    onClick={addItem}
                    disabled={saving || !selProductId}
                    className="px-4 py-2 text-sm bg-primary text-nv-black rounded-lg font-medium flex items-center gap-1.5 disabled:opacity-40"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Ajouter
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {items.length === 0 && !adding ? (
          <p className="text-sm text-nv-text-faint text-center py-4 border border-dashed border-nv-border rounded-xl">
            Aucun produit associé à ce client.
          </p>
        ) : (
          <div className="space-y-1.5">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-3 py-2 bg-nv-dark border border-nv-border rounded-lg">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.product?.color ?? '#e8b84b' }} />
                <span className="text-sm text-nv-text flex-1 min-w-0 truncate">{item.product?.name}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    className={`${inputCls} w-14 text-center py-1 text-xs`}
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={e => updateItem(item.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                  />
                  <span className="text-[10px] text-nv-text-faint">×</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    className={`${inputCls} w-24 text-right py-1 text-xs`}
                    type="number"
                    value={item.amount}
                    onChange={e => updateItem(item.id, { amount: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="text-[10px] text-nv-text-faint">€</span>
                </div>
                <button
                  type="button"
                  onClick={() => deleteItem(item.id)}
                  className="p-1 rounded text-nv-text-faint hover:text-red-400 transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
