'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { PartyPopper, X, Check, Loader2, Tag } from 'lucide-react'
import toast from 'react-hot-toast'

type Product = { id: string; name: string; color: string }
type SignedClient = { clientId: string; clientName: string; company: string | null; signedAt: string }

// Popup « Nouveau client signé » : à l'ouverture du dashboard, propose de taguer
// une catégorie de produit au(x) client(s) récemment signé(s) via la plateforme
// de signature. S'affiche pour chaque admin tant que le client n'est pas tagué.
export function NewSignedClientModal({ clients, products }: { clients: SignedClient[]; products: Product[] }) {
  const router = useRouter()
  const [queue, setQueue] = useState<SignedClient[]>(clients)
  const [busy, setBusy] = useState<string | null>(null)

  if (typeof document === 'undefined' || queue.length === 0) return null
  const current = queue[0]

  const next = () => setQueue(q => q.slice(1))

  const assign = async (p: Product) => {
    setBusy(p.id)
    try {
      const res = await fetch('/api/client-products', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: current.clientId, productId: p.id }),
      })
      if (!res.ok) throw new Error()
      toast.success(`${current.clientName} → ${p.name}`)
      next()
      router.refresh()
    } catch { toast.error('Erreur') } finally { setBusy(null) }
  }

  const signedLabel = new Date(current.signedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-md bg-nv-dark border border-primary/30 rounded-2xl p-6 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full bg-primary/10 blur-3xl" />
        <button onClick={next} className="absolute top-4 right-4 text-nv-text-muted hover:text-white transition-colors"><X size={18} /></button>

        <div className="relative">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center mb-4">
            <PartyPopper size={22} className="text-primary" />
          </div>
          <p className="text-[11px] uppercase tracking-widest text-primary font-bold">Nouveau client signé</p>
          <h3 className="text-xl font-black text-white mt-1">{current.clientName}</h3>
          <p className="text-sm text-nv-text-muted mt-0.5">
            {current.company ? `${current.company} · ` : ''}signé le {signedLabel}
          </p>

          <div className="mt-5 flex items-center gap-2 text-sm text-nv-text">
            <Tag size={14} className="text-primary" /> Quelle offre lui associer ?
          </div>
          <p className="text-[11px] text-nv-text-faint mb-3">Pour la répartition du CA par produit et la tier-list des offres.</p>

          {products.length === 0 ? (
            <p className="text-xs text-nv-text-faint">Aucune catégorie de produit — créez-en depuis une fiche client.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {products.map(p => (
                <button
                  key={p.id}
                  onClick={() => assign(p)}
                  disabled={busy !== null}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all disabled:opacity-50 hover:border-transparent"
                  style={{ borderColor: `${p.color}55`, backgroundColor: `${p.color}14` }}
                >
                  {busy === p.id ? <Loader2 size={12} className="animate-spin" /> : <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />}
                  <span className="text-white font-medium">{p.name}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-6">
            {queue.length > 1 && <span className="text-[11px] text-nv-text-faint">+{queue.length - 1} autre{queue.length > 2 ? 's' : ''} à traiter</span>}
            <button onClick={next} className="ml-auto text-xs text-nv-text-muted hover:text-white transition-colors flex items-center gap-1">
              Plus tard <Check size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
