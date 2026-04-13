import { useState } from 'react'
import './AssignmentEditor.css'
import DateTimePicker from './DateTimePicker'

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
    <div className="CreateAssignmentModal-Overlay" onClick={props.onCancel}>
      <div className="CreateAssignmentModal-Content AssignmentEditor-Content" onClick={(e) => e.stopPropagation()}>
        <div className="CreateAssignmentModal-Header">
          <div>
            <h2>Edit Assignment</h2>
            <p>Update the assignment details, deadline, notes, or attached file.</p>
          </div>
        </div>

        {error && <div className="CreateAssignmentModal-Error">{error}</div>}

        <div className="CreateAssignmentModal-Body">
          <label className="CreateAssignmentModal-Field">
            <span>Assignment Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Assignment name"
              disabled={loading}
            />
          </label>

          <DateTimePicker
            label="Due Date"
            value={dueDate}
            onChange={setDueDate}
            includeTime={true}
            disabled={loading}
          />

          <label className="CreateAssignmentModal-Field">
            <span>Instructions or Rubric</span>
            <textarea
              value={rubric}
              onChange={(e) => setRubric(e.target.value)}
              placeholder="Add rubric or peer review settings..."
              rows={6}
              disabled={loading}
            />
          </label>

          <label className="CreateAssignmentModal-Field">
            <span>Replace Assignment File</span>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={loading}
            />
            <small>{file ? `Selected file: ${file.name}` : 'Optional: upload a replacement file.'}</small>
          </label>
        </div>

        <div className="CreateAssignmentModal-Footer">
          <button onClick={props.onCancel} disabled={loading} className="CreateAssignmentModal-Secondary">
            Cancel
          </button>
          <button onClick={handleSave} disabled={loading} className="CreateAssignmentModal-Primary">
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
