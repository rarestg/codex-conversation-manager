interface ToggleProps {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export const Toggle = ({ label, description, checked, onChange }: ToggleProps) => {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-white/70 bg-white/70 px-4 py-3 text-sm text-slate-700 shadow-sm">
      <div className="min-w-0 flex-1">
        <div className="font-medium text-slate-900">{label}</div>
        {description && <div className="text-xs text-slate-500">{description}</div>}
      </div>
      <span className="relative inline-flex h-6 w-11 shrink-0 items-center overflow-hidden rounded-full">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span className="absolute inset-0 rounded-full bg-slate-200 transition-colors peer-checked:bg-teal-600" />
        <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  )
}
