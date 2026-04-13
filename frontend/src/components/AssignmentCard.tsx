import './AssignmentCard.css'
import { useState } from 'react'

interface Props {
  id: number | string
  name?: string
  startDate?: string
  dueDate?: string
  status?: string
  children?: React.ReactNode
  onEdit?: (id: number) => void
  onDelete?: (id: number) => void
  isTeacher?: boolean
}

export default function AssignmentCard(props: Props) {
  const [showActions, setShowActions] = useState(false)

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

  // Format date to readable format
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return dateString
    }
  }

  // Calculate status based on dates
  const calculateStatus = () => {
    if (props.status) return props.status

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let startDate: Date | null = null
    let dueDate: Date | null = null

    if (props.startDate) {
      startDate = new Date(props.startDate)
      startDate.setHours(0, 0, 0, 0)
    }

    if (props.dueDate) {
      dueDate = new Date(props.dueDate)
      dueDate.setHours(0, 0, 0, 0)
    }

    // If due date has passed, it's overdue
    if (dueDate && dueDate < today) {
      return 'Overdue'
    }

    // If start date is in the future, it's upcoming
    if (startDate && startDate > today) {
      return 'Upcoming'
    }

    // If start date is today or before, and due date is in future (or no due date), it's active
    if (!startDate || startDate <= today) {
      if (!dueDate || dueDate >= today) {
        return 'Active'
      }
    }

    return 'Pending'
  }

  const status = calculateStatus()

  return (
    <div
      onClick={handleNavigate}
      className='A_Card'
      onMouseEnter={() => props.isTeacher && setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <img src="/icons/document.svg" alt="document" />
      <div className="card-content">
        <div className="assignment-name">
          {props.name || props.children}
        </div>
        <div className="assignment-details">
          {props.startDate && (
            <div className="detail-item">
              <span className="detail-label">Start:</span>
              <span className="detail-value">{formatDate(props.startDate)}</span>
            </div>
          )}
          {props.dueDate && (
            <div className="detail-item">
              <span className="detail-label">Due:</span>
              <span className="detail-value">{formatDate(props.dueDate)}</span>
            </div>
          )}
          <div className="detail-item">
            <span className="detail-label">Status:</span>
            <span className={`detail-value status-${status.toLowerCase()}`}>
              {status}
            </span>
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