import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { formatCurrency, formatDate, formatDateLong } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import {
  Building2, Mail, Phone, MapPin, FileText, Receipt,
  FolderKanban, Plus, ClipboardList,
  Hash, TrendingUp, StickyNote, Bell, RepeatIcon,
} from 'lucide-react'
import { ClientActions } from '@/components/clients/ClientActions'
import { ClientNotes } from '@/components/clients/ClientNotes'
import { ClientOnboarding } from '@/components/clients/ClientOnboarding'
import { ClientSocialKPIs } from '@/components/clients/ClientSocialKPIs'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { ClientInteractions } from '@/components/clients/ClientInteractions'
import { ClientRetainerManager } from '@/components/clients/ClientRetainerManager'
import { ClientBilanSection } from '@/components/clients/ClientBilanSection'
import { ClientChargesSection } from '@/components/clients/ClientChargesSection'
import { ClientAdaSection } from '@/components/clients/ClientAdaSection'
import { ClientDocumentsSection } from '@/components/clients/ClientDocumentsSection'
import { ClientOnboardingFormSection } from '@/components/clients/ClientOnboardingFormSection'

const statusBadge: Record<string, 'success' | 'info' | 'warning' | 'muted'> = {
  ACTIF: 'success', PROSPECT: 'info', EN_PAUSE: 'warning', ARCHIVÉ: 'muted',
}
const statusLabel: Record<string, string> = {
  ACTIF: 'Actif', PROSPECT: 'Prospect', EN_PAUSE: 'En pause', ARCHIVÉ: 'Archivé',
}
const projectStatusLabel: Record<string, string> = {
  BRIEF_REÇU: 'Brief reçu', EN_PRODUCTION: 'En production',
  EN_POST_PRODUCTION: 'Post-prod', EN_VALIDATION: 'Validation',
  LIVRÉ: 'Livré', ARCHIVÉ: 'Archivé',
}
const projectStatusBadge: Record<string, 'info' | 'warning' | 'orange' | 'purple' | 'success' | 'muted'> = {
  BRIEF_REÇU: 'info', EN_PRODUCTION: 'warning', EN_POST_PRODUCTION: 'orange',
  EN_VALIDATION: 'purple', LIVRÉ: 'success', ARCHIVÉ: 'muted',
}
const invoiceStatusBadge: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'muted'> = {
  PAYÉE: 'success', EN_ATTENTE: 'warning', EN_RETARD: 'danger',
  PARTIELLEMENT_PAYÉE: 'info', ANNULÉE: 'muted',
}
const invoiceStatusLabel: Record<string, string> = {
  PAYÉE: 'Payée', EN_ATTENTE: 'En attente', EN_RETARD: 'En retard',
  PARTIELLEMENT_PAYÉE: 'Partiel', ANNULÉE: 'Annulée',
}
const quoteStatusBadge: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'muted'> = {
  ACCEPTÉ: 'success', ENVOYÉ: 'info', BROUILLON: 'muted',
  REFUSÉ: 'danger', EXPIRÉ: 'warning',
}
const quoteStatusLabel: Record<string, string> = {
  ACCEPTÉ: 'Accepté', ENVOYÉ: 'Envoyé', BROUILLON: 'Brouillon',
  REFUSÉ: 'Refusé', EXPIRÉ: 'Expiré',
}
const sourceLabel: Record<string, string> = {
  INSTAGRAM: 'Instagram', YOUTUBE: 'YouTube', BOUCHE_A_OREILLE: 'Bouche à oreille',
  GOOGLE: 'Google', SITE_WEB: 'Site web', RECOMMANDATION: 'Recommandation',
  LINKEDIN: 'LinkedIn', AUTRE: 'Autre',
}
const typeLabel: Record<string, string> = {
  PARTICULIER: 'Particulier', ENTREPRISE: 'Entreprise', AGENCE: 'Agence',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ClientDetailPage({ params }: PageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) return null

  const [client, allTeam, settings, brief, shootingPlans] = await Promise.all([
    prisma.client.findUnique({
      where: { id },
      include: {
        socialKpis: {
          orderBy: [{ platform: 'asc' }, { month: 'desc' }],
        },
        projects: {
          orderBy: { createdAt: 'desc' },
          include: { category: true, _count: { select: { tasks: true } } },
        },
        quotes: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        invoices: {
          include: { payments: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        interactions: {
          orderBy: { date: 'desc' },
          take: 10,
        },
        prestas: {
          orderBy: { createdAt: 'desc' },
        },
        clientNotes: {
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        retainers: {
          orderBy: { startDate: 'asc' },
        },
        charges: {
          orderBy: [{ month: 'desc' }, { createdAt: 'asc' }],
        },
        adaResponses: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    }),
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.agencySetting.findFirst({ select: { adaSheetUrl: true } }),
    (async () => { try { return await (prisma as any).clientBrief.findUnique({ where: { clientId: id } }) } catch { return null } })(),
    (async () => { try { return await (prisma as any).shootingPlan.findMany({ where: { clientId: id }, orderBy: { createdAt: 'desc' }, select: { id: true, title: true, shareToken: true, shootDate: true, location: true, updatedAt: true } }) } catch { return [] } })(),
  ])

  const [onboardingForm, spotSelections, contentTopics] = await Promise.all([
    // icpPdf exclu : base64 jusqu'à 8 Mo — servi à la demande via /api/onboarding/file
    (async () => { try { return await (prisma as any).clientOnboardingForm.findUnique({
      where: { clientId: id },
      omit: { icpPdf: true },
    }) } catch { return null } })(),
    (async () => { try { return await (prisma as any).clientSpotSelection.findMany({ where: { clientId: id }, include: { spot: { select: { id: true, name: true, city: true } } } }) } catch { return [] } })(),
    (async () => { try { return await (prisma as any).clientContentTopic.findMany({ where: { clientId: id }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] }) } catch { return [] } })(),
  ])

  if (!client) notFound()

  const now = new Date()

  // Retainer actif ?
  const hasActiveRetainer = (client.retainers ?? []).some(r => {
    const end = new Date(r.startDate)
    end.setMonth(end.getMonth() + r.durationMonths)
    return now < end
  })

  // Calcul CA total ce client
  const totalCA = await prisma.payment.aggregate({
    where: {
      confirmed: true,
      invoice: { clientId: id },
    },
    _sum: { amount: true },
  })

  const caTotal = totalCA._sum.amount || 0

  // MRR actuel et LTV contractée
  const activeMRR = (client.retainers ?? []).reduce((sum, r) => {
    const start = new Date(r.startDate)
    const end = new Date(r.startDate)
    end.setMonth(end.getMonth() + r.durationMonths)
    return now >= start && now < end ? sum + r.monthlyAmount : sum
  }, 0)
  const ltvContractée = (client.retainers ?? []).reduce((sum, r) => sum + r.monthlyAmount * r.durationMonths, 0)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
            {client.avatar
              ? <img src={client.avatar} alt={client.name} className="w-full h-full object-cover" />
              : <span className="text-2xl font-bold text-primary">{client.name.charAt(0).toUpperCase()}</span>
            }
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-white">{client.name}</h1>
              <Badge variant={statusBadge[client.status] || 'muted'}>
                {statusLabel[client.status]}
              </Badge>
            </div>
            {client.company && (
              <p className="text-nv-text-muted flex items-center gap-1.5 mt-1">
                <Building2 size={14} />
                {client.company}
              </p>
            )}
            <p className="text-xs text-nv-text-faint mt-1">
              Client depuis {formatDateLong(client.createdAt)} • Source : {sourceLabel[client.source]}
            </p>
            {client.status === 'PROSPECT' && client.relanceDate && (
              <p className="text-xs flex items-center gap-1 mt-1">
                <Bell size={11} className="text-amber-400" />
                <span className="text-amber-400">Relance prévue : {formatDate(client.relanceDate)}</span>
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ClientActions client={{ id: client.id, name: client.name, status: client.status, avatar: client.avatar, relanceDate: client.relanceDate }} />
          <DeleteButton
            endpoint={`/api/clients/${client.id}`}
            confirmMessage={`Supprimer le client "${client.name}" ? Cette action est irréversible.`}
            redirectTo="/clients"
          />
        </div>
      </div>

      {/* KPIs client */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-nv-card border border-nv-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-nv-text-muted text-xs mb-2"><TrendingUp size={14} />CA total</div>
          <p className="text-xl font-bold text-white">{formatCurrency(caTotal)}</p>
        </div>
        <div className="bg-nv-card border border-nv-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-nv-text-muted text-xs mb-2"><RepeatIcon size={14} className="text-primary" />MRR actuel</div>
          <p className="text-xl font-bold text-primary">{activeMRR > 0 ? formatCurrency(activeMRR) : '—'}<span className="text-xs text-nv-text-muted font-normal">{activeMRR > 0 ? '/m' : ''}</span></p>
        </div>
        <div className="bg-nv-card border border-nv-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-nv-text-muted text-xs mb-2"><TrendingUp size={14} className="text-emerald-400" />LTV contractée</div>
          <p className="text-xl font-bold text-emerald-400">{ltvContractée > 0 ? formatCurrency(ltvContractée) : '—'}</p>
        </div>
        <div className="bg-nv-card border border-nv-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-nv-text-muted text-xs mb-2"><FolderKanban size={14} />Projets</div>
          <p className="text-xl font-bold text-white">{(client.projects ?? []).length}</p>
        </div>
      </div>

      {/* Onboarding */}
      <ClientOnboarding
        clientId={client.id}
        initialChecklist={client.onboardingChecklist as Array<{ id: string; label: string; done: boolean }> | null}
      />

      {/* Formulaire d'onboarding rempli par le client + sujets de contenu */}
      <ClientOnboardingFormSection
        clientId={client.id}
        data={onboardingForm ? {
          ...onboardingForm,
          completedAt: onboardingForm.completedAt
            ? (onboardingForm.completedAt instanceof Date ? onboardingForm.completedAt.toISOString() : String(onboardingForm.completedAt))
            : null,
        } : null}
        spotSelections={(spotSelections ?? []).map((s: any) => ({ id: s.spot.id, name: s.spot.name, city: s.spot.city }))}
        initialTopics={(contentTopics ?? []).map((t: any) => ({ id: t.id, title: t.title, notes: t.notes, status: t.status, order: t.order }))}
      />

      {/* INFOS DA — pleine largeur */}
      <ClientAdaSection
        clientId={client.id}
        hasSheetConfigured={!!(settings?.adaSheetUrl)}
        initialResponse={client.adaResponses?.[0]
          ? {
              id: client.adaResponses[0].id,
              responseTimestamp: client.adaResponses[0].responseTimestamp,
              data: client.adaResponses[0].data as Record<string, string>,
              matchedOn: client.adaResponses[0].matchedOn,
              updatedAt: client.adaResponses[0].updatedAt.toISOString(),
            }
          : null}
        initialNotes={
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (() => { const n = (client as any).adaNotes as { overrides?: Record<string,string>; extras?: { key:string; value:string }[] } | null; return n ? { overrides: n.overrides ?? {}, extras: n.extras ?? [] } : null })()
        }
      />

      {/* Documents — briefs & plans de tournage */}
      <ClientDocumentsSection
        clientId={client.id}
        brief={brief ? {
          id: brief.id,
          shareToken: brief.shareToken,
          updatedAt: brief.updatedAt instanceof Date ? brief.updatedAt.toISOString() : String(brief.updatedAt),
          niche: brief.niche ?? null,
          monteur: brief.monteur ?? null,
        } : null}
        shootingPlans={(shootingPlans ?? []).map((p: any) => ({
          id: p.id,
          title: p.title,
          shareToken: p.shareToken,
          shootDate: p.shootDate ? (p.shootDate instanceof Date ? p.shootDate.toISOString() : String(p.shootDate)) : null,
          location: p.location ?? null,
          updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : String(p.updatedAt),
        }))}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne gauche - Infos */}
        <div className="space-y-4">

          {/* Coordonnées */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Coordonnées</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {client.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail size={14} className="text-nv-text-muted shrink-0" />
                  <a href={`mailto:${client.email}`} className="text-primary hover:underline truncate">{client.email}</a>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone size={14} className="text-nv-text-muted shrink-0" />
                  <a href={`tel:${client.phone}`} className="text-nv-text hover:text-white transition-colors">{client.phone}</a>
                </div>
              )}
              {client.address && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin size={14} className="text-nv-text-muted shrink-0 mt-0.5" />
                  <span className="text-nv-text">{client.address}</span>
                </div>
              )}
              {client.siret && (
                <div className="flex items-center gap-2 text-sm">
                  <Hash size={14} className="text-nv-text-muted shrink-0" />
                  <span className="text-nv-text">SIRET : {client.siret}</span>
                </div>
              )}
              {client.notes && (
                <div className="mt-3 pt-3 border-t border-nv-border">
                  <p className="text-xs text-nv-text-muted mb-1">Notes internes</p>
                  <p className="text-sm text-nv-text">{client.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Infos */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Informations</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-nv-text-muted">Type</span>
                <span className="text-white">{typeLabel[client.type]}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-nv-text-muted">Statut</span>
                <Badge variant={statusBadge[client.status] || 'muted'} className="text-xs">{statusLabel[client.status]}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-nv-text-muted">Source</span>
                <span className="text-white">{sourceLabel[client.source]}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-nv-text-muted">Créé le</span>
                <span className="text-white">{formatDate(client.createdAt)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Suivi mensuel */}
          {client.status === 'ACTIF' && (
            <ClientBilanSection
              clientId={client.id}
              clientName={client.name}
              lastBilanDate={client.lastBilanDate?.toISOString() ?? null}
              nextBilanDate={client.nextBilanDate?.toISOString() ?? null}
              followUpEnabled={client.followUpEnabled}
              hasActiveRetainer={hasActiveRetainer}
            />
          )}

          {/* Charges client */}
          <ClientChargesSection
            clientId={client.id}
            initialCharges={(client.charges ?? []).map(c => ({
              ...c,
              month: c.month.toISOString(),
              createdAt: c.createdAt.toISOString(),
            }))}
          />

          {/* Historique interactions */}
          <ClientInteractions
            clientId={client.id}
            initialInteractions={(client.interactions ?? []).map(i => ({
              ...i,
              date: i.date.toISOString(),
              createdAt: i.createdAt.toISOString(),
            }))}
            isAdmin={['ADMIN', 'MANAGER'].includes(session.user.role)}
          />
        </div>

        {/* Colonne droite - Projets & Facturation */}
        <div className="lg:col-span-2 space-y-4">
          {/* Projets */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><FolderKanban size={16} className="text-primary" />Projets ({(client.projects ?? []).length})</CardTitle>
                <div className="flex items-center gap-2">
                  <Link href={`/clients/${client.id}/brief`} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary hover:bg-primary/20 transition-colors">
                    <ClipboardList size={11} />Brief PDF
                  </Link>
                  <Link href={`/projects/new?clientId=${client.id}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                    <Plus size={12} />Nouveau
                  </Link>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {(client.projects ?? []).length === 0 ? (
                <p className="text-sm text-nv-text-muted">Aucun projet</p>
              ) : (
                <div className="space-y-2">
                  {(client.projects ?? []).map((p) => (
                    <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center justify-between p-3 rounded-lg border border-nv-border hover:border-nv-border-light hover:bg-white/3 transition-colors group">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          {p.category && (
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.category.color }} />
                              <span className="text-[10px] font-medium" style={{ color: p.category.color }}>{p.category.name}</span>
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-white group-hover:text-primary transition-colors">{p.title}</p>
                        <p className="text-xs text-nv-text-muted">{p._count?.tasks ?? 0} tâche{(p._count?.tasks ?? 0) !== 1 ? 's' : ''} • {p.deadline ? `Deadline ${formatDate(p.deadline)}` : 'Pas de deadline'}</p>
                      </div>
                      <Badge variant={projectStatusBadge[p.status] || 'muted'}>{projectStatusLabel[p.status]}</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Devis */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><FileText size={16} className="text-primary" />Devis</CardTitle>
                <Link href={`/quotes/new?clientId=${client.id}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Plus size={12} />Nouveau
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {(client.quotes ?? []).length === 0 ? (
                <p className="text-sm text-nv-text-muted">Aucun devis</p>
              ) : (
                <div className="space-y-2">
                  {(client.quotes ?? []).map((q) => (
                    <Link key={q.id} href={`/quotes/${q.id}`} className="flex items-center justify-between p-3 rounded-lg border border-nv-border hover:border-nv-border-light hover:bg-white/3 transition-colors">
                      <div>
                        <p className="text-sm font-medium text-white">{q.number}</p>
                        <p className="text-xs text-nv-text-muted">{formatDate(q.issueDate)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-white">{formatCurrency(q.totalTTC)}</p>
                        <Badge variant={quoteStatusBadge[q.status] || 'muted'} className="text-xs">{quoteStatusLabel[q.status]}</Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Factures */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Receipt size={16} className="text-primary" />Factures</CardTitle>
                <Link href={`/invoices/new?clientId=${client.id}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Plus size={12} />Nouvelle
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {(client.invoices ?? []).length === 0 ? (
                <p className="text-sm text-nv-text-muted">Aucune facture</p>
              ) : (
                <div className="space-y-2">
                  {(client.invoices ?? []).map((inv) => {
                    const paid = (inv.payments ?? []).reduce((s, p) => s + (p.confirmed ? p.amount : 0), 0)
                    return (
                      <Link key={inv.id} href={`/invoices/${inv.id}`} className="flex items-center justify-between p-3 rounded-lg border border-nv-border hover:border-nv-border-light hover:bg-white/3 transition-colors">
                        <div>
                          <p className="text-sm font-medium text-white">{inv.number}</p>
                          <p className="text-xs text-nv-text-muted">Échéance : {inv.dueDate ? formatDate(inv.dueDate) : '—'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-white">{formatCurrency(inv.totalTTC)}</p>
                          <Badge variant={invoiceStatusBadge[inv.status] || 'muted'} className="text-xs">{invoiceStatusLabel[inv.status]}</Badge>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* KPIs Sociaux */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp size={16} className="text-primary" />
                KPIs Sociaux
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ClientSocialKPIs
                clientId={client.id}
                initialKpis={(client.socialKpis ?? []).map(k => ({
                  ...k,
                  month: k.month.toISOString(),
                  screenshotDate: k.screenshotDate?.toISOString() ?? null,
                }))}
              />
            </CardContent>
          </Card>

          {/* Retainers MRR */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RepeatIcon size={16} className="text-primary" />
                Retainers &amp; MRR
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ClientRetainerManager
                clientId={client.id}
                initialRetainers={(client.retainers ?? []).map(r => ({
                  ...r,
                  startDate: r.startDate.toISOString(),
                  createdAt: r.createdAt.toISOString(),
                }))}
              />
            </CardContent>
          </Card>

          {/* Notes internes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <StickyNote size={16} className="text-primary" />
                Notes internes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ClientNotes
                clientId={client.id}
                initialNotes={(client.clientNotes ?? []).map((n) => ({
                  ...n,
                  createdAt: n.createdAt.toISOString(),
                }))}
                teamMembers={allTeam}
                currentUserId={session.user.id}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
