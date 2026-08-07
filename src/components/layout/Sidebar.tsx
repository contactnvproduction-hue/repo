'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, FolderKanban,
  CheckSquare, Target, Users2, Settings,
  LogOut, X, ChevronRight, Database, Crosshair, Briefcase,
  ClipboardCheck, Wallet, type LucideIcon,
} from 'lucide-react'

type NavLink = { href: string; icon: LucideIcon; label: string }
type NavGroup = { label: string; icon: LucideIcon; children: { href: string; label: string }[] }
type NavItem = NavLink | NavGroup
type NavSection = { section: string; items: NavItem[] }

const ventesGroup: NavGroup = {
  label: 'Ventes',
  icon: Crosshair,
  children: [
    { href: '/sales/prospection', label: 'Dashboard commercial' },
    { href: '/sales/closing', label: 'Pipeline closing' },
    { href: '/sales/contrats', label: 'Contrats' },
    { href: '/sales/produits', label: 'Répartition CA' },
  ],
}
const comptaGroup: NavGroup = {
  label: 'Compta',
  icon: Wallet,
  children: [
    { href: '/compta', label: 'Prévisionnel & tréso' },
    { href: '/invoices', label: 'Factures' },
  ],
}

// Navigation regroupée par pôle → sidebar plus lisible, rien retiré.
const navSections: NavSection[] = [
  {
    section: 'Pilotage',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/ceo', icon: Briefcase, label: 'Espace CEO' },
    ],
  },
  { section: 'Business', items: [ventesGroup, comptaGroup] },
  {
    section: 'Production',
    items: [
      { href: '/clients', icon: Users, label: 'Clients' },
      { href: '/onboardings', icon: ClipboardCheck, label: 'Onboarding' },
      { href: '/projects', icon: FolderKanban, label: 'Projets' },
      { href: '/tasks', icon: CheckSquare, label: 'Tâches' },
      { href: '/objectives', icon: Target, label: 'Objectifs' },
    ],
  },
  {
    section: 'Agence',
    items: [
      { href: '/team', icon: Users2, label: 'Équipe' },
      { href: '/donnees', icon: Database, label: 'Données' },
      { href: '/settings', icon: Settings, label: 'Paramètres' },
    ],
  },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  userName: string
  userRole: string
  userAvatar?: string | null
}

export function Sidebar({ isOpen, onClose, userName, userRole, userAvatar }: SidebarProps) {
  const pathname = usePathname()

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  // Le rôle COMMERCIAL ne voit QUE son espace Ventes (dashboard commercial + closing)
  const sections: NavSection[] = userRole === 'COMMERCIAL'
    ? [{ section: 'Ventes', items: [ventesGroup] }]
    : navSections

  const roleLabel: Record<string, string> = {
    ADMIN: 'Administrateur',
    MANAGER: 'Manager',
    MONTEUR: 'Monteur',
    'VIDÉASTE': 'Vidéaste',
    PHOTOGRAPHE: 'Photographe',
    COMMERCIAL: 'Commercial',
  }

  return (
    <>
      {/* Overlay mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed top-0 left-0 h-full w-[260px] bg-nv-dark border-r border-nv-border z-50',
        'flex flex-col transition-transform duration-300',
        'lg:translate-x-0 lg:static lg:z-auto',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-nv-border shrink-0">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/nv-logo.png"
              alt="New Vision Production"
              style={{ width: 72, height: 'auto' }}
              className="object-contain"
            />
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1 text-nv-text-muted hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation — regroupée par pôle */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {sections.map((sec, si) => (
            <div key={sec.section} className={si === 0 ? '' : 'mt-5'}>
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-nv-text-faint/70">{sec.section}</p>
              {sec.items.map((item) => {
                if ('children' in item) {
                  const anyActive = item.children.some((c) => isActive(c.href))
                  return (
                    <div key={item.label} className="mb-0.5">
                      <div className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm',
                        anyActive ? 'text-white' : 'text-nv-text-muted'
                      )}>
                        <item.icon size={17} />
                        <span className="font-medium">{item.label}</span>
                      </div>
                      <div className="ml-4 pl-3 border-l border-nv-border space-y-0.5 mt-0.5">
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={onClose}
                            className={cn(
                              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors',
                              isActive(child.href)
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'text-nv-text-muted hover:text-white hover:bg-white/5'
                            )}
                          >
                            <ChevronRight size={13} />
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href!}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors mb-0.5',
                      isActive(item.href!)
                        ? 'bg-primary/10 text-primary font-medium border border-primary/20'
                        : 'text-nv-text-muted hover:text-white hover:bg-white/5'
                    )}
                  >
                    <item.icon size={17} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Profil utilisateur */}
        <div className="p-3 border-t border-nv-border shrink-0">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
              {userAvatar ? (
                <img src={userAvatar} alt={userName} className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="text-xs font-bold text-primary">{userName.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{userName}</p>
              <p className="text-xs text-nv-text-muted">{roleLabel[userRole] || userRole}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="p-1 text-nv-text-muted hover:text-red-400 transition-colors"
              title="Déconnexion"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
