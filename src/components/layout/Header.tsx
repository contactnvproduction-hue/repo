'use client'

import { useState } from 'react'
import { Menu, Bell, Search } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface HeaderProps {
  onMenuClick: () => void
  notifCount?: number
}

const breadcrumbMap: Record<string, string> = {
  dashboard: 'Dashboard',
  clients: 'Clients',
  projects: 'Projets',
  quotes: 'Devis',
  invoices: 'Factures',
  finance: 'Finance',
  tasks: 'Tâches',
  objectives: 'Objectifs',
  planning: 'Planning',
  documents: 'Documents',
  team: 'Équipe',
  settings: 'Paramètres',
  new: 'Nouveau',
}

export function Header({ onMenuClick, notifCount = 0 }: HeaderProps) {
  const pathname = usePathname()
  const [searchOpen, setSearchOpen] = useState(false)

  const segments = pathname.split('/').filter(Boolean)

  return (
    <header className="h-16 bg-nv-dark border-b border-nv-border flex items-center px-4 gap-4 sticky top-0 z-30">
      {/* Menu mobile */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 text-nv-text-muted hover:text-white transition-colors rounded-lg hover:bg-white/5"
      >
        <Menu size={20} />
      </button>

      {/* Breadcrumbs */}
      <nav className="flex-1 flex items-center gap-1 text-sm overflow-hidden">
        <Link href="/dashboard" className="text-nv-text-muted hover:text-white transition-colors shrink-0">
          New Vision
        </Link>
        {segments.map((seg, i) => {
          const href = '/' + segments.slice(0, i + 1).join('/')
          const label = breadcrumbMap[seg] || seg
          const isLast = i === segments.length - 1
          return (
            <span key={seg} className="flex items-center gap-1 min-w-0">
              <span className="text-nv-text-faint mx-0.5">/</span>
              {isLast ? (
                <span className="text-white font-medium truncate">{label}</span>
              ) : (
                <Link href={href} className="text-nv-text-muted hover:text-white transition-colors truncate">
                  {label}
                </Link>
              )}
            </span>
          )
        })}
      </nav>

      {/* Actions droite */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Recherche */}
        <button
          onClick={() => setSearchOpen(!searchOpen)}
          className="p-2 text-nv-text-muted hover:text-white transition-colors rounded-lg hover:bg-white/5"
        >
          <Search size={18} />
        </button>

        {/* Notifications */}
        <Link
          href="/notifications"
          className="relative p-2 text-nv-text-muted hover:text-white transition-colors rounded-lg hover:bg-white/5"
        >
          <Bell size={18} />
          {notifCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
              {notifCount > 9 ? '9+' : notifCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  )
}
