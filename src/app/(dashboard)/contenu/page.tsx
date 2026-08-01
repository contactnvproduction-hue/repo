import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Clapperboard } from 'lucide-react'
import { ContentTracker } from '@/components/sales/ContentTracker'

export const dynamic = 'force-dynamic'

export default async function ContenuPage() {
  const session = await auth()
  if (!session?.user) return null

  const contentSince = new Date(new Date().getFullYear() - 1, 0, 1)
  const [contentChannels, contentPieces] = await Promise.all([
    (async () => { try { return await (prisma as any).contentChannel.findMany({ include: { _count: { select: { pieces: true } } }, orderBy: [{ owner: 'asc' }, { platform: 'asc' }] }) } catch { return [] } })(),
    (async () => { try { return await (prisma as any).contentPiece.findMany({ where: { publishedAt: { gte: contentSince } }, include: { channel: { select: { owner: true, platform: true, handle: true } } }, orderBy: { publishedAt: 'desc' } }) } catch { return [] } })(),
  ])
  const contentChannelsSer = contentChannels.map((c: any) => ({
    id: c.id, owner: c.owner, platform: c.platform, handle: c.handle, url: c.url,
    followers: c.followers, lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null, _count: c._count,
    connected: !!(c.accessToken && c.platformUserId),
  }))
  const contentPiecesSer = contentPieces.map((p: any) => ({
    id: p.id, channelId: p.channelId, title: p.title, url: p.url, thumbnail: p.thumbnail,
    format: p.format, publishedAt: p.publishedAt.toISOString(),
    views: p.views, likes: p.likes, comments: p.comments, shares: p.shares,
    engagementRate: p.engagementRate, manual: p.manual, channel: p.channel,
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3"><Clapperboard size={24} className="text-primary" /> Contenu</h1>
        <p className="text-sm text-nv-text-muted mt-1">Performance du contenu organique (Instagram, YouTube…).</p>
      </div>
      <ContentTracker initialChannels={contentChannelsSer} initialPieces={contentPiecesSer} />
    </div>
  )
}
