'use client'

import { useRef, useState } from 'react'
import { Camera, X, Loader2 } from 'lucide-react'

interface AvatarUploaderProps {
  value: string | null | undefined
  name: string
  onChange: (dataUrl: string | null) => void
  size?: number
}

export function AvatarUploader({ value, name, onChange, size = 80 }: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [processing, setProcessing] = useState(false)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    setProcessing(true)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        const MAX = 400
        const scale = Math.min(MAX / img.width, MAX / img.height, 1)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        onChange(canvas.toDataURL('image/jpeg', 0.85))
        setProcessing(false)
      }
      img.src = ev.target?.result as string
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const initials = name.split(' ').map(w => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() || '?'
  const iconSize = Math.round(size * 0.28)
  const fontSize = Math.round(size * 0.3)

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full h-full rounded-2xl overflow-hidden border-2 border-dashed border-nv-border hover:border-primary/50 transition-colors group relative focus:outline-none"
      >
        {value ? (
          <img src={value} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-primary/10 flex items-center justify-center">
            <span className="text-primary font-bold" style={{ fontSize }}>{initials}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {processing
            ? <Loader2 size={iconSize} className="text-white animate-spin" />
            : <>
                <Camera size={iconSize} className="text-white" />
                <span className="text-white font-medium" style={{ fontSize: 10 }}>Photo</span>
              </>
          }
        </div>
      </button>
      {value && !processing && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-nv-dark border border-nv-border rounded-full flex items-center justify-center text-nv-text-muted hover:text-white hover:border-nv-border-light transition-colors z-10"
          title="Supprimer la photo"
        >
          <X size={10} />
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="sr-only" />
    </div>
  )
}
