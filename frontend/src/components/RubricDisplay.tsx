// frontend/src/components/RubricDisplay.tsx
import { useEffect, useState, useCallback } from 'react';
import Criteria from './Criteria';
import { getCriteria, getRubric, createCriteria, editRubric, deleteRubric } from '../util/api';
import { isTeacher } from '../util/login';
import './RubricDisplay.css';

interface RubricDisplayProps {
  rubricId: number | null;
  onCriterionSelect: (row: number, column: number) => void;
  grades: number[];
  refresh?: number;
}

interface RubricInfo {
  id: number;
  assignmentID: number;
  canComment: boolean;
  grades: number[];
}

interface CriterionData {
  id: number;
  question: string;
  scoreMax: number;
  hasScore: boolean;
}

export default function RubricDisplay({ rubricId, onCriterionSelect, grades, refresh = 0 }: RubricDisplayProps & { refresh?: number }) {
  const [criteria, setCriteria] = useState<CriterionData[]>([]);
  const [rubricInfo, setRubricInfo] = useState<RubricInfo | null>(null);

  // New criterion form state
  const [newQuestion, setNewQuestion] = useState('');
  const [newScoreMax, setNewScoreMax] = useState<number>(3);
  const [newHasScore, setNewHasScore] = useState<boolean>(true);
  const [adding, setAdding] = useState(false);

  const loadData = useCallback(async () => {
    if (rubricId) {
      const [criteriaResp, rubricResp] = await Promise.all([
        getCriteria(rubricId),
        getRubric(rubricId)
      ]);
      setCriteria(criteriaResp);
      setRubricInfo(rubricResp);
    }
  }, [rubricId]);

  useEffect(() => { loadData(); }, [rubricId, refresh, loadData]);

  if (!rubricId || criteria.length === 0) {
    return (
      <div className="RubricDisplay">
        <p>No rubric available yet</p>
      </div>
    );
  }

  const questions = criteria.map(c => c.question);
  const scoreMaxes = criteria.map(c => c.scoreMax);
  const hasScores = criteria.map(c => c.hasScore);

  const handleAddCriterion = async () => {
    if (!rubricInfo || !newQuestion.trim() || newScoreMax < 1) return;
    setAdding(true);
    try {
      // createCriteria signature: (rubricID, question, scoreMax, canComment, hasScore)
      await createCriteria(rubricInfo.id, newQuestion.trim(), newScoreMax, rubricInfo.canComment, newHasScore);
      setNewQuestion('');
      setNewScoreMax(3);
      setNewHasScore(true);
      await loadData();
    } catch (err) {
      console.error('Failed to add criterion', err);
      alert('Failed to add criterion');
    } finally {
      setAdding(false);
    }
  };

  const handleToggleCanComment = async () => {
    if (!rubricInfo) return;
    try {
      await editRubric(rubricInfo.id, { canComment: !rubricInfo.canComment });
      await loadData();
    } catch (err) {
      console.error('Failed to edit rubric', err);
      alert('Failed to update rubric');
    }
  };

  const handleDelete = async () => {
    if (!rubricInfo) return;
    if (!window.confirm('Delete this rubric? This cannot be undone.')) return;
    try {
      await deleteRubric(rubricInfo.id);
      setCriteria([]);
      setRubricInfo(null);
    } catch (err) {
      console.error('Failed to delete rubric', err);
      alert('Failed to delete rubric');
    }
  };

  return (
    <div className="RubricDisplay">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2>Rubric</h2>
        {isTeacher() && rubricInfo && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleToggleCanComment}>
              {rubricInfo.canComment ? 'Disable Comments' : 'Enable Comments'}
            </button>
            <button onClick={handleDelete} style={{ backgroundColor: '#d9534f', color: '#fff' }}>
              Delete Rubric
            </button>
          </div>
        )}
      </div>

      <Criteria
        questions={questions}
        scoreMaxes={scoreMaxes}
        canComment={rubricInfo?.canComment ?? false}
        hasScores={hasScores}
        onCriterionSelect={onCriterionSelect}
        grades={grades}
        criteria={criteria}
        onCriteriaUpdate={loadData}
      />

      {isTeacher() && rubricInfo && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="New criterion question"
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            style={{ flex: 1 }}
          />
          <input
            type="number"
            min={1}
            value={newScoreMax}
            onChange={(e) => setNewScoreMax(Math.max(1, parseInt(e.target.value || '1')))}
            style={{ width: 72 }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={newHasScore} onChange={(e) => setNewHasScore(e.target.checked)} />
            hasScore
          </label>
          <button onClick={handleAddCriterion} disabled={adding || !newQuestion.trim()}>Add</button>
        </div>
      )}
    </div>
  );
}