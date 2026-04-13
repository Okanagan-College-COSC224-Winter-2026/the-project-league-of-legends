// src/pages/ClassHome.tsx
import AssignmentCard from "../components/AssignmentCard";
import Button from "../components/Button";
import CreateAssignmentModal from "../components/CreateAssignmentModal";
import "./ClassHome.css";
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import TabNavigation from "../components/TabNavigation";
import { importCSV } from "../util/csv";
import StatusMessage from "../components/StatusMessage";
import { isTeacher } from "../util/login";

import {
  deleteAssignment,
  editAssignment,
  listAssignments,
  listClasses,
} from "../util/api";

// US9 - import the model for assignment editor
import AssignmentEditor from "../components/AssignmentEditor";

type AssignmentUpdate = {
  name?: string;
  due_date?: string | null;
  rubric?: string | null;
  file?: File | null;
};

export default function ClassHome() {
  const { id } = useParams();
  const idNew = Number(id);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [className, setClassName] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState<"error" | "success">("error");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [editingAssignment, setEditingAssignment] =
    useState<Assignment | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!id) return;

      try {
        const resp = await listAssignments(String(id));
        const classes = await listClasses();
        const currentClass = classes.find(
          (c: { id: number }) => c.id === Number(id)
        );

        if (cancelled) return;

        setAssignments(resp || []);
        setClassName(currentClass?.name || null);
      } catch (error) {
        console.error("Error loading class data:", error);
        if (!cancelled) {
          setStatusMessage("Error loading assignments");
          setStatusType("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const tryCreateAssingment = async (data: {
    name: string
    startDate: string
    dueDate: string
    comments: string
  }) => {
    try {
      setStatusMessage("");

      if (!id || Number.isNaN(idNew)) {
        throw new Error("Invalid class id");
      }

      const response = await fetch(`http://localhost:5000/assignment/create_assignment`, {
        method: "POST",
        body: JSON.stringify({
          courseID: idNew,
          name: data.name,
          start_date: data.startDate || null,
          due_date: data.dueDate || null,
          rubric_text: data.comments || null,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to create assignment");
      }

      const result = await response.json();
      const createdAssignment = result?.assignment;

      if (!createdAssignment?.id) {
        throw new Error("Failed to create assignment");
      }

      setAssignments((prev) => [...prev, createdAssignment]);
      setShowCreateModal(false);
      setStatusType("success");
      setStatusMessage("Assignment created successfully!");
    } catch (error) {
      console.error("Error creating assignment:", error);
      setStatusType("error");
      setStatusMessage("Error creating assignment.");
    }
  };

  // US9 - handle edit assignment
  const handleEditAssignment = async (updates: AssignmentUpdate) => {
    if (!editingAssignment) return;

    try {
      await editAssignment(editingAssignment.id, updates);
      setStatusType("success");
      setStatusMessage("Assignment updated successfully!");

      // Refresh assignments list
      const resp = await listAssignments(String(id));
      setAssignments(resp);

      setEditingAssignment(null);
    } catch (error) {
      console.error("Error updating assignment:", error);
      setStatusType("error");
      setStatusMessage("Error updating assignment.");
    }
  };

  // US9 - handle delete assignment
  const handleDeleteAssignment = async (assignmentId: number) => {
    try {
      await deleteAssignment(assignmentId);
      setStatusType("success");
      setStatusMessage("Assignment deleted successfully!");

      setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
    } catch (error) {
      console.error("Error deleting assignment:", error);
      setStatusType("error");
      setStatusMessage("Error deleting assignment.");
    }
  };

  return (
    <>
      <div className="ClassHeader">
        <div className="ClassHeaderLeft">
          <h2>{className}</h2>
        </div>

        <div className="ClassHeaderRight">
          {isTeacher() ? (
            <>
              <Button onClick={() => setShowCreateModal(true)}>
                Create Assignment
              </Button>
              <Button onClick={() => importCSV(id as string)}>
                Add Students via CSV
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <TabNavigation
        tabs={[
          {
            label: "Home",
            path: `/classes/${id}/home`,
          },
          {
            label: "Members",
            path: `/classes/${id}/members`,
          },
        ]}
      />

      <StatusMessage message={statusMessage} type={statusType} />

      <div className="Class">
        <div className="Assignments">
          <ul className="Assignment">
            {assignments.map((assignment) => (
              <li key={assignment.id}>
                <AssignmentCard
                  id={assignment.id}
                  name={assignment.name}
                  startDate={(assignment as any).start_date}
                  dueDate={assignment.due_date}
                  status={(assignment as any).status}
                  onEdit={() => setEditingAssignment(assignment)}
                  onDelete={handleDeleteAssignment}
                  isTeacher={isTeacher()}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>

      {showCreateModal && (
        <CreateAssignmentModal
          onCreate={tryCreateAssingment}
          onCancel={() => setShowCreateModal(false)}
        />
      )}

      {editingAssignment && (
        <AssignmentEditor
          assignment={editingAssignment}
          onSave={handleEditAssignment}
          onCancel={() => setEditingAssignment(null)}
        />
      )}
    </>
  );
}