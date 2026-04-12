import { useEffect, useState } from 'react';
import Criteria from './Criteria';
import { getCriteria, getRubric, deleteRubric } from '../util/api';
import { isTeacher } from '../util/login';
import './RubricDisplay.css';

interface RubricDisplayProps {
    rubricId: number | null;
    onCriterionSelect: (row: number, column: number) => void;
    grades: (number | null)[];
    criterionComments?: Record<number, string>;
    onCriterionCommentChange?: (row: number, comment: string) => void;
}

interface RubricInfo {
    id: number;
    assignmentID: number;
    canComment: boolean;
    grades: number[];
}

export default function RubricDisplay({ rubricId, onCriterionSelect, grades, criterionComments, onCriterionCommentChange }: RubricDisplayProps) {
    const [criteria, setCriteria] = useState<Criterion[]>([]);
    const [rubricInfo, setRubricInfo] = useState<RubricInfo | null>(null);
    const questions: string[] = [];
    const scoreMaxes: number[] = [];
    const hasScores: boolean[] = [];

    useEffect(() => {
        const loadData = async () => {
            if (rubricId) {
                const [criteriaResp, rubricResp] = await Promise.all([
                    getCriteria(rubricId),
                    getRubric(rubricId)
                ]);
                setCriteria(criteriaResp);
                setRubricInfo(rubricResp);
            }
        };
        loadData();
    }, [rubricId]);

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

    return (
        <div className="RubricDisplay">
            <h2>Rubric</h2>
            {isTeacher() && (
                <div style={{ textAlign: 'right', marginBottom: 8 }}>
                    <button className="delete-button"
                        onClick={async () => {
                            if (!rubricId) return;
                            if (!confirm('Delete this rubric? This cannot be undone.')) return;
                            try {
                                await deleteRubric(rubricId);
                                // clear local state
                                setCriteria([]);
                                setRubricInfo(null);
                            } catch (err) {
                                console.error('Failed to delete rubric', err);
                                alert('Failed to delete rubric');
                            }
                        }}
                    >
                        Delete Rubric
                    </button>
                </div>
            )}
            <Criteria
                questions={questions}
                scoreMaxes={scoreMaxes}
                canComment={rubricInfo?.canComment ?? false}
                hasScores={hasScores}
                onCriterionSelect={onCriterionSelect}
                grades={grades}
                comments={criterionComments}
                onCriterionCommentChange={onCriterionCommentChange}
            />
        </div>
    );
} 