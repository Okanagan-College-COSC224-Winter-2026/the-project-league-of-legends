import './DateTimePicker.css'

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  includeTime?: boolean
  minDate?: string
}

export default function DateTimePicker(props: Props) {
  // Format date for display
  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return ''
    try {
      const date = new Date(dateString)
      if (props.includeTime) {
        return date.toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      } else {
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      }
    } catch {
      return dateString
    }
  }

  // Convert date to input format (YYYY-MM-DD or YYYY-MM-DDTHH:mm)
  const formatInputValue = (dateString: string) => {
    if (!dateString) return ''
    try {
      const date = new Date(dateString)
      if (props.includeTime) {
        return date.toISOString().slice(0, 16)
      } else {
        return date.toISOString().slice(0, 10)
      }
    } catch {
      return dateString
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    props.onChange(e.target.value)
  }

  const handleClear = () => {
    props.onChange('')
  }

  const handleToday = () => {
    const today = new Date()
    if (props.includeTime) {
      props.onChange(today.toISOString().slice(0, 16))
    } else {
      props.onChange(today.toISOString().slice(0, 10))
    }
  }

  return (
    <div className="datetime-picker">
      <label className="datetime-label">{props.label}</label>
      <div className="datetime-input-group">
        <input
          type={props.includeTime ? 'datetime-local' : 'date'}
          value={formatInputValue(props.value)}
          onChange={handleChange}
          disabled={props.disabled}
          min={props.minDate}
          className="datetime-input"
        />
        <div className="datetime-display">
          {props.value ? formatDisplayDate(props.value) : 'No date selected'}
        </div>
        <div className="datetime-buttons">
          {props.value && (
            <button
              type="button"
              className="datetime-btn datetime-btn-clear"
              onClick={handleClear}
              disabled={props.disabled}
              title="Clear date"
            >
              ✕
            </button>
          )}
          <button
            type="button"
            className="datetime-btn datetime-btn-today"
            onClick={handleToday}
            disabled={props.disabled}
            title="Set to today"
          >
            Today
          </button>
        </div>
      </div>
    </div>
  )
}
