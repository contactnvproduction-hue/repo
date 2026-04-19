'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MessageSquare, Send, AtSign } from 'lucide-react'
import toast from 'react-hot-toast'

interface Comment {
  id: string
  content: string
  authorName: string
  mentions: string[]
  createdAt: Date | string
  author: { id: string; name: string } | null
}
interface TeamMember { id: string; name: string }

export function ProjectComments({
  comments: initialComments,
  projectId,
  currentUserId,
  teamMembers = [],
}: {
  comments: Comment[]
  projectId: string
  currentUserName?: string
  currentUserId?: string
  teamMembers?: TeamMember[]
}) {
  const router = useRouter()
  const [comments, setComments] = useState(initialComments)
  const [content, setContent] = useState('')
  const [mentions, setMentions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [showMentions, setShowMentions] = useState(false)

  const toggleMention = (userId: string) => {
    setMentions(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, mentions }),
      })
      if (!res.ok) { toast.error('Erreur'); return }
      const comment = await res.json()
      setComments(prev => [comment, ...prev])
      setContent('')
      setMentions([])
      setShowMentions(false)
      if (mentions.length > 0) toast.success('Commentaire envoyé + notifications')
      else toast.success('Commentaire ajouté')
      router.refresh()
    } catch {
      toast.error('Erreur')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (dateStr: Date | string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'à l\'instant'
    if (diffMin < 60) return `il y a ${diffMin}min`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `il y a ${diffH}h`
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare size={16} className="text-primary" />
          Commentaires internes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="space-y-2">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Ajouter un commentaire..."
            rows={3}
            className="w-full bg-nv-dark border border-nv-border rounded-lg px-3 py-2 text-sm text-nv-text placeholder:text-nv-text-faint resize-none focus:outline-none focus:border-primary/50 transition-colors"
          />
          <div className="flex items-center justify-between">
            {teamMembers.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowMentions(v => !v)}
                className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors ${
                  mentions.length > 0 ? 'text-primary bg-primary/10' : 'text-nv-text-muted hover:text-white'
                }`}
              >
                <AtSign size={13} />
                {mentions.length > 0
                  ? `${mentions.length} mention${mentions.length > 1 ? 's' : ''}`
                  : 'Mentionner'}
              </button>
            ) : <span />}
            <Button type="submit" size="sm" loading={loading} disabled={!content.trim()}>
              <Send size={13} />Envoyer
            </Button>
          </div>

          {/* Sélecteur de mentions */}
          {showMentions && teamMembers.length > 0 && (
            <div className="bg-nv-dark border border-nv-border rounded-lg p-2 space-y-1">
              <p className="text-xs text-nv-text-muted mb-2">Notifier un membre :</p>
              {teamMembers
                .filter(m => m.id !== currentUserId)
                .map(member => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => toggleMention(member.id)}
                    className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm transition-colors ${
                      mentions.includes(member.id)
                        ? 'bg-primary/10 text-primary'
                        : 'text-nv-text hover:bg-white/5'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      mentions.includes(member.id) ? 'bg-primary/20 text-primary' : 'bg-nv-border text-nv-text-muted'
                    }`}>
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    {member.name}
                    {mentions.includes(member.id) && <span className="ml-auto text-xs">✓</span>}
                  </button>
                ))}
            </div>
          )}
        </form>

        {/* Liste des commentaires */}
        {comments.length === 0
          ? <p className="text-sm text-nv-text-muted">Aucun commentaire</p>
          : (
            <div className="space-y-3">
              {comments.map(c => (
                <div key={c.id} className="p-3 bg-nv-dark border border-nv-border rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-primary">
                      {c.author?.name ?? c.authorName}
                    </span>
                    <span className="text-xs text-nv-text-faint">{formatTime(c.createdAt)}</span>
                  </div>
                  <p className="text-sm text-nv-text whitespace-pre-wrap">{c.content}</p>
                  {c.mentions && c.mentions.length > 0 && teamMembers.length > 0 && (
                    <p className="text-xs text-nv-text-muted mt-1.5">
                      @ {teamMembers
                        .filter(m => c.mentions.includes(m.id))
                        .map(m => m.name)
                        .join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
      </CardContent>
    </Card>
  )
}
