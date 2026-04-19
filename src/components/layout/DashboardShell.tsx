'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import type { UserRole } from '@prisma/client'

interface DashboardShellProps {
  user: {
    id: string
    name: string
    email: string
    role: UserRole
    avatar?: string | null
  }
  notifCount: number
  children: React.ReactNode
}

export function DashboardShell({ user, notifCount, children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-nv-black overflow-hidden">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userName={user.name}
        userRole={user.role}
        userAvatar={user.avatar}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          notifCount={notifCount}
        />
        <main className="flex-1 overflow-y-auto bg-nv-black">
          <div className="p-6 max-w-[1600px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
