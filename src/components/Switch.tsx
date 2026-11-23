interface SwitchProps {
  checked: boolean
  label?: string
  labelledBy?: string
  large?: boolean
  onChange: (checked: boolean) => void
}

export function Switch({ checked, label, labelledBy, large = false, onChange }: SwitchProps) {
  return (
    <span className={large ? 'switch switch-large' : 'switch'}>
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        aria-labelledby={labelledBy}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span aria-hidden="true" />
    </span>
  )
}
