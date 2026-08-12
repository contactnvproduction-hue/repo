'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { MessageDock } from '@/components/messages/MessageDock'
import { RunningTimerReminder } from '@/components/ceo/RunningTimerReminder'
import type { UserRole } from '@prisma/client'

type MessageLite = {
  id: string; senderId: string | null; senderName: string | null; recipientId: string
  subject: string | null; content: string; label: string; read: boolean; createdAt: string
}

interface DashboardShellProps {
  user: {
    id: string
    name: string
    email: string
    role: UserRole
    avatar?: string | null
  }
  notifCount: number
  messageRecipients: { id: string; name: string }[]
  initialMessages: MessageLite[]
  children: React.ReactNode
}

export function DashboardShell({ user, notifCount, messageRecipients, initialMessages, children }: DashboardShellProps) {
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
      <MessageDock currentUserId={user.id} recipients={messageRecipients} initialReceived={initialMessages} />
      <RunningTimerReminder />
    </div>
  )
}
