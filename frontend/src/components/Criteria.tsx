import './Criteria.css';
import Criterion from '../components/Criterion';

interface CriterionData {
  id: number;
  question: string;
  scoreMax: number;
  hasScore: boolean;
}

interface props {
  questions: Array<string>;
  scoreMaxes: Array<number>;
  canComment: boolean;
  hasScores: Array<boolean>;
  onCriterionSelect: (row: number, column: number) => void;
  grades: number[];
  criteria?: CriterionData[];
  onCriteriaUpdate?: () => void;
}

export default function Criteria(props: props) {
  return (
    <div className="Criteria">
      <table className='criteriaTable'>
        {props.questions.map((question, i) => (
          <Criterion
            key={i}
            question={question}
            scoreMax={props.scoreMaxes[i]}
            hasScore={props.hasScores[i]}
            onCriterionSelect={props.onCriterionSelect}
            questionIndex={i}
            grade={props.grades[i]}
            criteriaID={props.criteria?.[i]?.id}
            onCriteriaUpdate={props.onCriteriaUpdate}
          />
        ))}
      </table>
      {props.canComment &&
        <textarea className="criteriaText" />}
    </div>
  );
}