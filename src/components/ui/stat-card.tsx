import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string
  subtitle?: string
  icon: LucideIcon
  trend?: number // pourcentage de variation
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  className?: string
}

export function StatCard({ title, value, subtitle, icon: Icon, trend, color = 'primary', className }: StatCardProps) {
  const colorConfig = {
    primary: { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20' },
    success: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
    warning: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' },
    danger: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
    info: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  }[color]

  return (
    <div className={cn(
      'bg-nv-card border border-nv-border rounded-xl p-5 hover:border-nv-border-light transition-colors',
      className
    )}>
      <div className="flex items-start justify-between mb-3">
        <div className={cn('p-2.5 rounded-lg border', colorConfig.bg, colorConfig.border)}>
          <Icon size={20} className={colorConfig.text} />
        </div>
        {trend !== undefined && (
          <div className={cn(
            'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full',
            trend > 0 ? 'text-emerald-400 bg-emerald-400/10' :
            trend < 0 ? 'text-red-400 bg-red-400/10' :
            'text-nv-text-muted bg-white/5'
          )}>
            {trend > 0 ? <TrendingUp size={12} /> : trend < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-white mb-0.5">{value}</p>
        <p className="text-sm font-medium text-nv-text-muted">{title}</p>
        {subtitle && <p className="text-xs text-nv-text-faint mt-1">{subtitle}</p>}
      </div>
    </div>
  )
}
