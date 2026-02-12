import './Criterion.css';
import { useState } from 'react';
import { isTeacher } from '../util/login';
import { editCriteria, deleteCriteria } from '../util/api';

interface props {
  question: string;
  scoreMax: number;
  hasScore: boolean;
  onCriterionSelect: (row: number, column: number) => void;
  questionIndex: number;
  grade: number;
  criteriaID?: number;
  onCriteriaUpdate?: () => void;
}

export default function Criterion(props: props) {
  const [clickedCell, setClickedCell] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedQuestion, setEditedQuestion] = useState(props.question);
  const [editedScore, setEditedScore] = useState(props.scoreMax);

  const handleCellClick = (columnIndex: number) => {
    if (isEditing) return;
    const column = columnIndex + 1;

    if (clickedCell === column) {
      setClickedCell(null);
      props.onCriterionSelect(props.questionIndex, column);
    } else {
      setClickedCell(column);
      props.onCriterionSelect(props.questionIndex, column);
    }
  };

  const handleSave = async () => {
    try {
      if (props.criteriaID) {
        await editCriteria(props.criteriaID, {
          question: editedQuestion,
          scoreMax: editedScore
        });
        props.onCriteriaUpdate?.();
      }
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save criteria', err);
      alert('Failed to save changes');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this criterion?')) return;
    try {
      if (props.criteriaID) {
        await deleteCriteria(props.criteriaID);
        props.onCriteriaUpdate?.();
      }
    } catch (err) {
      console.error('Failed to delete criteria', err);
      alert('Failed to delete criterion');
    }
  };

  if (isEditing && isTeacher()) {
    return (
      <tr className='criterionRow'>
        <td style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '8px' }}>
          <input
            type="text"
            value={editedQuestion}
            onChange={(e) => setEditedQuestion(e.target.value)}
            placeholder="Question"
            style={{ flex: 1 }}
          />
          <input
            type="number"
            value={editedScore}
            onChange={(e) => setEditedScore(parseInt(e.target.value) || 1)}
            min={1}
            style={{ width: '72px' }}
          />
          <button onClick={handleSave}>Save</button>
          <button onClick={() => { setIsEditing(false); setEditedQuestion(props.question); setEditedScore(props.scoreMax); }}>Cancel</button>
          <button onClick={handleDelete} style={{ backgroundColor: '#d9534f', color: '#fff' }}>Delete</button>
        </td>
      </tr>
    );
  }

  return (
    <tr className='criterionRow'>
      <th
        className='criterionHead'
        onDoubleClick={() => isTeacher() && setIsEditing(true)}
        style={{ cursor: isTeacher() ? 'pointer' : 'default' }}
        title={isTeacher() ? 'Double-click to edit' : ''}
      >
        {props.question}
      </th>
      {props.hasScore ? (
        Array.from({ length: props.scoreMax }, (_, i) => {
          const cellValue = i + 1;
          const isReviewed = cellValue === props.grade;
          return (
            <td
              key={i}
              onClick={() => handleCellClick(i)}
              className={isReviewed ? 'reviewedCell' : (clickedCell === cellValue ? 'clickedCell' : '')}
            >
              {cellValue}
            </td>
          );
        })
      ) : (
        <td className='criterionData'>
          <textarea className='comment' placeholder='Comment here' />
        </td>
      )}
    </tr>
  );
}