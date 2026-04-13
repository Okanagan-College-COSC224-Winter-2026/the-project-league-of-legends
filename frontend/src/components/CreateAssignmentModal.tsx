import { useState } from "react";
import "./CreateAssignmentModal.css";
import DateTimePicker from "./DateTimePicker";

interface Props {
  onCreate: (data: {
    name: string;
    dueDate: string;
    comments: string;
    file: File | null;
  }) => Promise<void>;
  onCancel: () => void;
}

export default function CreateAssignmentModal(props: Props) {
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [comments, setComments] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Assignment name is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await props.onCreate({
        name: name.trim(),
        dueDate,
        comments: comments.trim(),
        file,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create assignment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="CreateAssignmentModal-Overlay" onClick={props.onCancel}>
      <div
        className="CreateAssignmentModal-Content"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="CreateAssignmentModal-Header">
          <div>
            <h2>Create Assignment</h2>
            <p>Add an assignment with an optional deadline, rubric notes, and file.</p>
          </div>
        </div>

        {error ? <div className="CreateAssignmentModal-Error">{error}</div> : null}

        <div className="CreateAssignmentModal-Body">
          <label className="CreateAssignmentModal-Field">
            <span>Assignment Name</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Weekly reflection, Lab 3, Final presentation..."
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
              value={comments}
              onChange={(event) => setComments(event.target.value)}
              placeholder="Add instructions, grading notes, or rubric text..."
              rows={5}
              disabled={loading}
            />
          </label>

          <label className="CreateAssignmentModal-Field">
            <span>Attachment</span>
            <input
              type="file"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              disabled={loading}
            />
            <small>
              {file ? `Selected: ${file.name}` : "Optional: upload a handout or assignment brief."}
            </small>
          </label>
        </div>

        <div className="CreateAssignmentModal-Footer">
          <button
            type="button"
            className="CreateAssignmentModal-Secondary"
            onClick={props.onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="CreateAssignmentModal-Primary"
            onClick={handleCreate}
            disabled={loading}
          >
            {loading ? "Creating..." : "Create Assignment"}
          </button>
        </div>
      </div>
    </div>
  );
}
