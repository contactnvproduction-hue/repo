import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary/10 text-primary',
        success: 'bg-emerald-400/10 text-emerald-400',
        warning: 'bg-yellow-400/10 text-yellow-400',
        danger: 'bg-red-400/10 text-red-400',
        info: 'bg-blue-400/10 text-blue-400',
        muted: 'bg-white/5 text-nv-text-muted',
        orange: 'bg-orange-400/10 text-orange-400',
        purple: 'bg-purple-400/10 text-purple-400',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
