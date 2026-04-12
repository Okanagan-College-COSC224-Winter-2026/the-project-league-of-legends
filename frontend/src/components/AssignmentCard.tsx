import './AssignmentCard.css'
import { useState } from 'react'

interface Props {
  id: number | string
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

  return (
    <div
      onClick={handleNavigate}
      className='A_Card'
      onMouseEnter={() => props.isTeacher && setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <img src="/icons/document.svg" alt="document" />
      <div className="card-content">
        {props.children}
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