import './AssignmentCard.css'
import { useState } from 'react'

interface Props {
  id: number | string
  name?: string
  children?: React.ReactNode
  dueDate?: string | null
  status?: 'complete' | 'late' | 'upcoming' | null
  onEdit?: (id: number) => void
  onDelete?: (id: number) => void
  isTeacher?: boolean
}

export default function AssignmentCard(props: Props) {
  const [showActions, setShowActions] = useState(false)
  const formattedDueDate =
    props.dueDate && !Number.isNaN(new Date(props.dueDate).getTime())
      ? new Date(props.dueDate).toLocaleString([], {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : 'No due date'

  const statusLabel =
    props.status === 'complete'
      ? 'Complete'
      : props.status === 'late'
        ? 'Late'
        : props.status === 'upcoming'
          ? 'Upcoming'
          : null

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    props.onEdit?.(Number(props.id))
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.confirm('Are you sure you want to delete this assignment?')) {
      props.onDelete?.(Number(props.id))
    }
  }

  const handleNavigate = () => {
    window.location.href = `/assignments/${props.id}`
  }

  return (
    <div
      onClick={handleNavigate}
      className={`A_Card ${props.isTeacher ? 'teacher-card' : ''}`}
      onMouseEnter={() => props.isTeacher && setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <img src="/icons/document.svg" alt="document" />
      <div className="card-content">
        <div className="assignment-card-main">
          <div className="assignment-card-header">
            <div className="assignment-card-title">{props.name ?? props.children}</div>
            {statusLabel && (
              <span className={`assignment-status assignment-status-${props.status}`}>
                {statusLabel}
              </span>
            )}
          </div>
          <div className="assignment-card-metaRow">
            <div className="assignment-card-meta">Due: {formattedDueDate}</div>
            <div className="assignment-card-meta subtle">Open assignment</div>
          </div>
        </div>
      </div>
      
      {props.isTeacher && showActions && (
        <div className="card-actions" onClick={(e) => e.stopPropagation()}>
          <button className="btn-edit" onClick={handleEdit} title="Edit">
            ✏️
          </button>
          <button className="btn-delete" onClick={handleDelete} title="Delete">
            🗑️
          </button>
        </div>
      )}
    </div>
  )
}
