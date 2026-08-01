import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { FileSignature, ExternalLink, CheckCircle2, Clock, ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

const NETLIFY_SIGNATURE = 'https://newvision-contrat.netlify.app'

export default async function ContratsPage() {
  const session = await auth()
  if (!session?.user) return null

  const signedContracts = await prisma.signedContract.findMany({ orderBy: { createdAt: 'desc' }, take: 40 })
  const contractUrl = (code: string) => `${NETLIFY_SIGNATURE}?c=${code}`
  const completedContracts = signedContracts.filter(c => c.status === 'SIGNED')
  const pendingContracts = signedContracts.filter(c => c.status === 'PENDING')

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3"><FileSignature size={24} className="text-primary" /> Contrats</h1>
          <p className="text-sm text-nv-text-muted mt-1">{completedContracts.length} signé(s){pendingContracts.length > 0 ? ` · ${pendingContracts.length} en attente` : ''}</p>
        </div>
        <a href={NETLIFY_SIGNATURE} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary/15 hover:bg-primary/25 border border-primary/30 text-primary text-sm font-medium rounded-xl transition-colors shrink-0">
          <FileSignature size={15} /> Nouveau contrat <ExternalLink size={12} className="opacity-60" />
        </a>
      </div>

      <div className="rounded-xl border border-nv-border bg-nv-card p-4">
        {signedContracts.length === 0 ? (
          <p className="text-sm text-nv-text-faint text-center py-8">Aucun contrat pour l&apos;instant.</p>
        ) : (
          <div className="space-y-2">
            {signedContracts.map(c => {
              const isSigned = c.status === 'SIGNED'
              const amount = c.missionType === 'MRR' ? c.monthlyAmount : c.totalAmount
              return (
                <div key={c.id} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${isSigned ? 'border-emerald-500/20 bg-emerald-500/3' : 'border-nv-border bg-nv-bg'}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isSigned ? 'bg-emerald-500/15' : 'bg-amber-400/15'}`}>
                      {isSigned ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Clock size={14} className="text-amber-400" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{c.clientName}</p>
                      <p className="text-xs text-nv-text-muted">{c.clientCompany || c.clientEmail || '—'} · {c.missionType === 'MRR' ? 'Retainer' : 'Ponctuel'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {amount != null && (
                      <div className="text-right">
                        <p className="text-sm font-semibold text-white">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount)}</p>
                        <p className="text-[10px] text-nv-text-muted">{c.missionType === 'MRR' ? '/mois' : 'one-shot'}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-nv-text-muted bg-nv-border px-1.5 py-0.5 rounded">{c.shortCode}</span>
                      {c.clientId && (
                        <Link href={`/clients/${c.clientId}`} title="Fiche client" className="p-1.5 text-nv-text-muted hover:text-primary transition-colors"><ArrowRight size={12} /></Link>
                      )}
                      <a href={contractUrl(c.shortCode)} target="_blank" rel="noopener noreferrer" title="Voir le contrat signé" className="p-1.5 text-nv-text-muted hover:text-primary transition-colors"><ExternalLink size={12} /></a>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
