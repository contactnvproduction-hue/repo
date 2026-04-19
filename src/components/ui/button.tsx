import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
  {
    variants: {
      variant: {
        default: 'bg-primary hover:bg-primary-hover text-nv-black font-semibold',
        outline: 'border border-nv-border hover:border-nv-border-light hover:bg-white/5 text-nv-text',
        ghost: 'hover:bg-white/5 text-nv-text',
        danger: 'bg-red-600 hover:bg-red-700 text-white',
        success: 'bg-emerald-600 hover:bg-emerald-700 text-white',
        secondary: 'bg-nv-card border border-nv-border hover:border-nv-border-light text-nv-text',
      },
      size: {
        sm: 'px-3 py-1.5 text-sm',
        default: 'px-4 py-2 text-sm',
        lg: 'px-6 py-2.5 text-base',
        icon: 'p-2',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean
}

export function Button({ className, variant, size, loading, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  )
}
