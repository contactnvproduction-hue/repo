import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'New Vision Production | Dashboard',
  description: 'Dashboard de pilotage - Agence de production vidéo et photo',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className="dark">
      <body className={`${inter.className} bg-nv-black text-nv-text antialiased`}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#13131f',
              color: '#e2e2f0',
              border: '1px solid #1e1e2e',
              borderRadius: '8px',
            },
            success: {
              iconTheme: { primary: '#10b981', secondary: '#13131f' },
            },
            error: {
              iconTheme: { primary: '#ef4444', secondary: '#13131f' },
            },
          }}
        />
      </body>
    </html>
  )
}
