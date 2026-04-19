import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
}

export function Select({ className, label, error, id, options, ...props }: SelectProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-nv-text-muted">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={id}
          className={cn(
            'w-full px-3 py-2 bg-nv-dark border border-nv-border rounded-lg text-white appearance-none',
            'focus:border-primary focus:ring-1 focus:ring-primary transition-colors outline-none text-sm pr-8',
            error && 'border-red-500',
            className
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-nv-dark">
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-nv-text-muted pointer-events-none" />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
