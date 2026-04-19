'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Play, Camera, TrendingUp } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Plus, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

interface SocialKPI {
  id: string
  platform: string
  handle: string | null
  month: string
  followers: number
  views: number | null
  engagement: number | null
  screenshotUrl?: string | null
  screenshotDate?: string | null
}

const PLATFORM_CONFIG: Record<string, { label: string; color: string; textColor: string; Icon: React.ElementType }> = {
  YOUTUBE: { label: 'YouTube', color: '#ef4444', textColor: 'text-red-400', Icon: Play },
  INSTAGRAM: { label: 'Instagram', color: '#10b981', textColor: 'text-emerald-400', Icon: Camera },
  TIKTOK: { label: 'TikTok', color: '#f59e0b', textColor: 'text-yellow-400', Icon: TrendingUp },
  LINKEDIN: { label: 'LinkedIn', color: '#3b82f6', textColor: 'text-blue-400', Icon: TrendingUp },
  FACEBOOK: { label: 'Facebook', color: '#6366f1', textColor: 'text-indigo-400', Icon: TrendingUp },
}

export function ClientSocialKPIs({
  clientId,
  initialKpis,
}: {
  clientId: string
  initialKpis: SocialKPI[]
}) {
  const router = useRouter()
  const [kpis, setKpis] = useState(initialKpis)
  const [showModal, setShowModal] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    platform: 'YOUTUBE',
    handle: '',
    month: new Date().toISOString().slice(0, 7),
    followers: '',
    views: '',
    likes: '',
    comments: '',
    screenshotUrl: '',
    screenshotDate: new Date().toISOString().split('T')[0],
  })
  const [showScreenshot, setShowScreenshot] = useState<string | null>(null)

  // Latest per platform
  const latestByPlatform: Record<string, SocialKPI> = {}
  for (const k of kpis) {
    if (!latestByPlatform[k.platform] || new Date(k.month) > new Date(latestByPlatform[k.platform].month)) {
      latestByPlatform[k.platform] = k
    }
  }
  const latest = Object.values(latestByPlatform)

  const handleYouTubeSync = async () => {
    const ytKpi = kpis.find(k => k.platform === 'YOUTUBE')
    const handle = ytKpi?.handle || prompt('Handle YouTube (sans @) ?')
    if (!handle) return
    setSyncing(true)
    try {
      const res = await fetch('/api/youtube-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: handle.replace(/^@/, ''), clientId }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erreur'); return }
      toast.success(`${data.channel?.name || 'Chaîne'} synchronisée — ${data.channel?.subscribers?.toLocaleString()} abonnés`)
      router.refresh()
    } catch { toast.error('Erreur réseau') }
    finally { setSyncing(false) }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const engagement = form.followers && (form.likes || form.comments)
        ? ((Number(form.likes || 0) + Number(form.comments || 0)) / Number(form.followers)) * 100
        : undefined

      const res = await fetch(`/api/clients/${clientId}/social-kpis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: form.platform,
          handle: form.handle || undefined,
          month: form.month + '-01',
          followers: Number(form.followers) || 0,
          views: form.views ? Number(form.views) : undefined,
          likes: form.likes ? Number(form.likes) : undefined,
          comments: form.comments ? Number(form.comments) : undefined,
          engagement,
          screenshotUrl: form.screenshotUrl || undefined,
          screenshotDate: form.screenshotDate || undefined,
        }),
      })
      if (!res.ok) { toast.error('Erreur'); return }
      const kpi = await res.json()
      setKpis(prev => [
        ...prev.filter(k => !(k.platform === form.platform && k.month.startsWith(form.month))),
        kpi,
      ])
      toast.success('KPI ajouté')
      setShowModal(false)
      router.refresh()
    } catch { toast.error('Erreur') }
    finally { setLoading(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-nv-text-muted">Derniers KPIs par plateforme</p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleYouTubeSync} loading={syncing}>
            <RefreshCw size={11} />YouTube
          </Button>
          <Button size="sm" onClick={() => setShowModal(true)}>
            <Plus size={11} />Saisir
          </Button>
        </div>
      </div>

      {latest.length === 0 ? (
        <p className="text-xs text-nv-text-faint text-center py-4">
          Aucun KPI social enregistré pour ce client.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {latest.map((kpi) => {
            const cfg = PLATFORM_CONFIG[kpi.platform]
            const Icon = cfg?.Icon || TrendingUp
            return (
              <div
                key={kpi.platform}
                className="flex items-center gap-3 p-3 rounded-lg bg-nv-dark border border-nv-border"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${cfg?.color}20` }}
                >
                  <Icon size={14} style={{ color: cfg?.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white">{cfg?.label || kpi.platform}</p>
                  {kpi.handle && <p className="text-[10px] text-nv-text-faint">{kpi.handle}</p>}
                  {kpi.screenshotUrl && (
                    <button
                      onClick={() => setShowScreenshot(kpi.screenshotUrl!)}
                      className="text-[10px] text-primary hover:underline"
                    >
                      📸 Capture
                    </button>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-white">{kpi.followers.toLocaleString('fr-FR')}</p>
                  <p className="text-[10px] text-nv-text-faint">abonnés</p>
                  {kpi.engagement != null && (
                    <p className="text-[10px] text-primary">{kpi.engagement.toFixed(1)}% eng.</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Saisir un KPI social">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select label="Plateforme *" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}
              options={Object.entries(PLATFORM_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))} />
            <Input label="Handle / @compte" value={form.handle}
              onChange={(e) => setForm({ ...form, handle: e.target.value })} placeholder="@moncompte" />
          </div>
          <Input label="Mois" type="month" value={form.month}
            onChange={(e) => setForm({ ...form, month: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Abonnés *" type="number" value={form.followers}
              onChange={(e) => setForm({ ...form, followers: e.target.value })} required />
            <Input label="Vues / Impressions" type="number" value={form.views}
              onChange={(e) => setForm({ ...form, views: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Likes" type="number" value={form.likes}
              onChange={(e) => setForm({ ...form, likes: e.target.value })} />
            <Input label="Commentaires" type="number" value={form.comments}
              onChange={(e) => setForm({ ...form, comments: e.target.value })} />
          </div>
          <div className="border-t border-nv-border pt-3">
            <p className="text-xs font-medium text-nv-text-muted mb-2">Capture d'écran (optionnel)</p>
            <Input label="URL de la capture" value={form.screenshotUrl}
              onChange={(e) => setForm({ ...form, screenshotUrl: e.target.value })} placeholder="https://..." />
            <div className="mt-2">
              <Input label="Date de la capture" type="date" value={form.screenshotDate}
                onChange={(e) => setForm({ ...form, screenshotDate: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Annuler</Button>
            <Button type="submit" loading={loading}>Enregistrer</Button>
          </div>
        </form>
      </Modal>

      {/* Screenshot viewer */}
      {showScreenshot && (
        <Modal open={!!showScreenshot} onClose={() => setShowScreenshot(null)} title="Capture KPI" size="lg">
          <img src={showScreenshot} alt="Capture KPI" className="w-full rounded-lg" onError={() => setShowScreenshot(null)} />
        </Modal>
      )}
    </div>
  )
}
