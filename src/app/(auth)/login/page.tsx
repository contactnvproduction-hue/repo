'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const result = await signIn('credentials', { email, password, redirect: false })
      toast(JSON.stringify(result), { duration: 8000 })
      if (result?.error) {
        toast.error('Email ou mot de passe incorrect')
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch {
      toast.error('Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-nv-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Fond subtil */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/3 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm animate-fade-in relative z-10">
        {/* Logo NV */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center mb-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/nv-logo.png"
              alt="New Vision Production"
              style={{ width: 120, height: 'auto' }}
              className="object-contain"
            />
          </div>
          <p className="text-nv-text-muted text-sm tracking-wide">Dashboard de pilotage</p>
        </div>

        {/* Formulaire */}
        <div className="bg-nv-card border border-nv-border rounded-2xl p-8">
          <h2 className="text-lg font-semibold text-white mb-6">Connexion</h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-nv-text-muted mb-1.5">Adresse email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@newvision.fr"
                required
                className="w-full px-4 py-2.5 bg-nv-dark border border-nv-border rounded-lg text-white placeholder-nv-text-faint focus:border-primary focus:ring-1 focus:ring-primary transition-colors outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-nv-text-muted mb-1.5">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-2.5 bg-nv-dark border border-nv-border rounded-lg text-white placeholder-nv-text-faint focus:border-primary focus:ring-1 focus:ring-primary transition-colors outline-none pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-nv-text-muted hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 size={18} className="animate-spin" />Connexion...</> : 'Se connecter'}
            </button>
          </form>
        </div>

        <p className="text-center text-nv-text-faint text-xs mt-6">
          New Vision Production &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
