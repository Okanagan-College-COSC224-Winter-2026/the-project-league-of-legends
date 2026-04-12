import { useState } from 'react'
import './AssignmentEditor.css'

interface Assignment {
  id: number
  name: string
  due_date?: string
  rubric_text?: string
}

interface Props {
  assignment: Assignment
  // Use a structured update type instead of `any` to satisfy eslint
  onSave: (updates: {
    name?: string
    due_date?: string | null
    rubric?: string | null
    file?: File | null
  }) => Promise<void>
  onCancel: () => void
}

export default function AssignmentEditor(props: Props) {
  const [name, setName] = useState(props.assignment.name)
  const [dueDate, setDueDate] = useState(props.assignment.due_date || '')
  const [rubric, setRubric] = useState(props.assignment.rubric_text || '')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setLoading(true)
    setError('')
    try {
      await props.onSave({
        name,
        due_date: dueDate || null,
        rubric: rubric || null,
        file,
      })
      props.onCancel() // Close modal on success
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg || 'Failed to save assignment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={props.onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Edit Assignment</h2>
        
        {error && <div className="error-message">{error}</div>}

        <div className="form-group">
          <label>Assignment Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Assignment name"
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label>Due Date</label>
          <input
            type="datetime-local"
            value={dueDate ? new Date(dueDate).toISOString().slice(0, 16) : ''}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label>Rubric/Instructions</label>
          <textarea
            value={rubric}
            onChange={(e) => setRubric(e.target.value)}
            placeholder="Add rubric or peer review settings..."
            rows={6}
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label>Replace Assignment File (Optional)</label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={loading}
          />
          {file && <small>Selected file: {file.name}</small>}
        </div>

        <div className="modal-actions">
          <button onClick={props.onCancel} disabled={loading} className="btn-cancel">
            Cancel
          </button>
          <button onClick={handleSave} disabled={loading} className="btn-save">
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}