import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Fusion de classes Tailwind
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Formatage monétaire français
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

// Formatage date française
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

// Formatage date longue
export function formatDateLong(date: Date | string | null | undefined): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date))
}

// Calcul du pourcentage
export function calcPercent(current: number, target: number): number {
  if (target === 0) return 0
  return Math.min(Math.round((current / target) * 100), 100)
}

// Génération d'un numéro de document
export function generateDocNumber(prefix: string, counter: number, year?: number): string {
  const y = year || new Date().getFullYear()
  return `${prefix}-${y}-${String(counter).padStart(4, '0')}`
}

// Couleur selon le statut facture
export function getInvoiceStatusColor(status: string): string {
  switch (status) {
    case 'PAYÉE': return 'text-emerald-400 bg-emerald-400/10'
    case 'EN_ATTENTE': return 'text-yellow-400 bg-yellow-400/10'
    case 'EN_RETARD': return 'text-red-400 bg-red-400/10'
    case 'PARTIELLEMENT_PAYÉE': return 'text-blue-400 bg-blue-400/10'
    case 'ANNULÉE': return 'text-gray-400 bg-gray-400/10'
    default: return 'text-gray-400 bg-gray-400/10'
  }
}

// Couleur selon le statut projet
export function getProjectStatusColor(status: string): string {
  switch (status) {
    case 'BRIEF_REÇU': return 'text-blue-400 bg-blue-400/10'
    case 'EN_PRODUCTION': return 'text-yellow-400 bg-yellow-400/10'
    case 'EN_POST_PRODUCTION': return 'text-orange-400 bg-orange-400/10'
    case 'EN_VALIDATION': return 'text-purple-400 bg-purple-400/10'
    case 'LIVRÉ': return 'text-emerald-400 bg-emerald-400/10'
    case 'ARCHIVÉ': return 'text-gray-400 bg-gray-400/10'
    default: return 'text-gray-400 bg-gray-400/10'
  }
}

// Couleur selon la priorité tâche
export function getTaskPriorityColor(priority: string): string {
  switch (priority) {
    case 'URGENTE': return 'text-red-400 bg-red-400/10'
    case 'HAUTE': return 'text-orange-400 bg-orange-400/10'
    case 'NORMALE': return 'text-yellow-400 bg-yellow-400/10'
    case 'BASSE': return 'text-green-400 bg-green-400/10'
    default: return 'text-gray-400 bg-gray-400/10'
  }
}

// Tronquer un texte
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.substring(0, maxLength) + '...'
}

// Calculer si une date est en retard
export function isOverdue(date: Date | string | null | undefined): boolean {
  if (!date) return false
  return new Date(date) < new Date()
}

// Jours restants avant une deadline
export function daysUntil(date: Date | string | null | undefined): number | null {
  if (!date) return null
  const diff = new Date(date).getTime() - new Date().getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}
