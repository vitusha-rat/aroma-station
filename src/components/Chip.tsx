interface ChipProps {
  name: string
  label?: string
  active: boolean
  disabled?: boolean
  onClick: () => void
  onRemove?: (() => void) | undefined
}

export function Chip({ name, label = name, active, disabled, onClick, onRemove }: ChipProps) {
  return (
    <span className={active ? 'chip chip-active' : 'chip'}>
      <button aria-pressed={active} disabled={disabled} onClick={onClick}>
        {label}
      </button>
      {onRemove && (
        <button className="chip-remove" aria-label={`Удалить ${name}`} onClick={onRemove}>
          ×
        </button>
      )}
    </span>
  )
}
