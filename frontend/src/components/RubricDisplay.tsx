import { useEffect, useState, useCallback } from 'react';
import Criteria from './Criteria';
import { getCriteria, getRubric, editRubric, deleteRubric } from '../util/api';
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

export default function RubricDisplay({ rubricId, onCriterionSelect, grades, refresh = 0 }: RubricDisplayProps & { refresh?: number }) {
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [rubricInfo, setRubricInfo] = useState<RubricInfo | null>(null);
  const questions: string[] = [];
  const scoreMaxes: number[] = [];
  const hasScores: boolean[] = [];

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

  useEffect(() => {
    loadData();
  }, [rubricId, refresh, loadData]);

  criteria.forEach((crit) => {
    questions.push(crit.question);
    scoreMaxes.push(crit.scoreMax);
    hasScores.push(crit.hasScore);
  });

  if (!rubricId || criteria.length === 0) {
    return (
      <div className="RubricDisplay">
        <p>No rubric available yet</p>
      </div>
    );
  }

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
      />
    </div>
  );
}