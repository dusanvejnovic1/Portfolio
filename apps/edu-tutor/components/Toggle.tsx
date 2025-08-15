'use client'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
}

export default function Toggle({ checked, onChange, label, disabled = false }: ToggleProps) {
  return (
    <div className="flex items-center space-x-3">
      <label htmlFor="hints-toggle" className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <button
        id="hints-toggle"
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full
          transition-colors duration-200 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed
          ${checked 
            ? 'bg-blue-600' 
            : 'bg-gray-300 dark:bg-gray-600'
          }
        `}
      >
        <span
          className={`
            ${checked ? 'translate-x-6' : 'translate-x-1'}
            inline-block h-4 w-4 transform rounded-full bg-white
            transition duration-200 ease-in-out
          `}
        />
      </button>
    </div>
  )
}