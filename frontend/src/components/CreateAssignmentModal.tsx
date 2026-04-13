import { useState } from 'react'
import './CreateAssignmentModal.css'
import DateTimePicker from './DateTimePicker'

interface Props {
  onCreate: (data: {
    name: string
    startDate: string
    dueDate: string
    comments: string
  }) => Promise<void>
  onCancel: () => void
}

export default function CreateAssignmentModal(props: Props) {
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [comments, setComments] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Assignment name is required')
      return
    }

    setLoading(true)
    setError('')
    try {
      await props.onCreate({
        name: name.trim(),
        startDate,
        dueDate,
        comments,
      })
      // Clear form on success (parent will close modal)
      setName('')
      setStartDate('')
      setDueDate('')
      setComments('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg || 'Failed to create assignment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={props.onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Create New Assignment</h2>

        {error && <div className="modal-error">{error}</div>}

        <div className="form-group">
          <label htmlFor="assignmentName">Assignment Name *</label>
          <input
            id="assignmentName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter assignment name"
            disabled={loading}
          />
        </div>

        <div className="form-row">
          <DateTimePicker
            label="Start Date"
            value={startDate}
            onChange={setStartDate}
            disabled={loading}
            includeTime={false}
          />
          <DateTimePicker
            label="Due Date"
            value={dueDate}
            onChange={setDueDate}
            disabled={loading}
            includeTime={false}
            minDate={startDate}
          />
        </div>

        <div className="form-group">
          <label htmlFor="comments">Comments / Rubric</label>
          <textarea
            id="comments"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Enter assignment details, rubric, or instructions..."
            rows={4}
            disabled={loading}
          />
        </div>

        <div className="modal-buttons">
          <button
            className="btn-cancel"
            onClick={props.onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="btn-create"
            onClick={handleCreate}
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Assignment'}
          </button>
        </div>
      </div>
    </div>
  )
}
