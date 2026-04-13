// src/pages/ClassHome.tsx
import AssignmentCard from "../components/AssignmentCard";
import Button from "../components/Button";
import "./ClassHome.css";
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import TabNavigation from "../components/TabNavigation";
import { importCSV } from "../util/csv";
import Textbox from "../components/Textbox";
import StatusMessage from "../components/StatusMessage";
import { isTeacher } from "../util/login";

import {
  createAssignment,
  deleteAssignment,
  editAssignment,
  getMySubmissionInfo,
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

type AssignmentStatus = "complete" | "late" | "upcoming" | null;

type AssignmentSection = {
  key: string;
  title: string;
  assignments: Assignment[];
};

function sortAssignmentsByDueDate(items: Assignment[]) {
  return [...items].sort((a, b) => {
    const aTime = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
    const bTime = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;

    if (aTime !== bTime) {
      return aTime - bTime;
    }

    return a.name.localeCompare(b.name);
  });
}

function groupAssignments(
  items: Assignment[],
  statuses: Record<number, AssignmentStatus>,
  isTeacherView: boolean,
): AssignmentSection[] {
  if (isTeacherView) {
    const scheduled = items.filter((assignment) => assignment.due_date);
    const noDueDate = items.filter((assignment) => !assignment.due_date);

    return [
      { key: "scheduled", title: "Scheduled", assignments: scheduled },
      { key: "no-due-date", title: "No Due Date", assignments: noDueDate },
    ].filter((section) => section.assignments.length > 0);
  }

  const late = items.filter((assignment) => statuses[assignment.id] === "late");
  const upcoming = items.filter(
    (assignment) => statuses[assignment.id] === "upcoming",
  );
  const complete = items.filter(
    (assignment) => statuses[assignment.id] === "complete",
  );
  const noDueDate = items.filter(
    (assignment) => !assignment.due_date && !statuses[assignment.id],
  );

  return [
    { key: "late", title: "Needs Attention", assignments: late },
    { key: "upcoming", title: "Upcoming", assignments: upcoming },
    { key: "complete", title: "Complete", assignments: complete },
    { key: "no-due-date", title: "No Due Date", assignments: noDueDate },
  ].filter((section) => section.assignments.length > 0);
}

export default function ClassHome() {
  const { id } = useParams();
  const idNew = Number(id);
  const isTeacherView = isTeacher();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentStatuses, setAssignmentStatuses] = useState<Record<number, AssignmentStatus>>({});
  const [newAssignmentName, setNewAssignmentName] = useState("");
  const [className, setClassName] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState<"error" | "success">("error");

  const [editingAssignment, setEditingAssignment] =
    useState<Assignment | null>(null);

  const assignmentSections = groupAssignments(
    assignments,
    assignmentStatuses,
    isTeacherView,
  );

  const loadClassData = async (classId: string) => {
    const resp = await listAssignments(classId);
    const sortedAssignments = sortAssignmentsByDueDate(resp || []);
    const classes = await listClasses();
    const currentClass = classes.find(
      (c: { id: number }) => c.id === Number(classId)
    );

    setAssignments(sortedAssignments);
    setClassName(currentClass?.name || null);

    if (isTeacherView) {
      setAssignmentStatuses({});
      return;
    }

    const statuses = await Promise.all(
      sortedAssignments.map(async (assignment) => {
        const dueTime = assignment.due_date
          ? new Date(assignment.due_date).getTime()
          : null;

        try {
          const submission = await getMySubmissionInfo(assignment.id);
          if (submission) {
            return [assignment.id, "complete"] as const;
          }
        } catch (error) {
          console.error(
            `Error loading submission status for assignment ${assignment.id}:`,
            error,
          );
        }

        if (dueTime !== null && !Number.isNaN(dueTime) && dueTime < Date.now()) {
          return [assignment.id, "late"] as const;
        }

        return [assignment.id, assignment.due_date ? "upcoming" : null] as const;
      }),
    );

    setAssignmentStatuses(Object.fromEntries(statuses));
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!id) return;

      if (cancelled) return;
      await loadClassData(String(id));
    })();

    return () => {
      cancelled = true;
    };
  }, [id, isTeacherView]);

  const tryCreateAssingment = async () => {
    try {
      setStatusMessage("");

      if (!id || Number.isNaN(idNew)) {
        throw new Error("Invalid class id");
      }

      const response = await createAssignment(idNew, newAssignmentName);
      const createdAssignment = response?.assignment;

      if (!createdAssignment?.id) {
        throw new Error("Failed to create assignment");
      }

      setAssignments((prev) => sortAssignmentsByDueDate([...prev, createdAssignment]));
      setNewAssignmentName("");
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
      await loadClassData(String(id));

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

      {isTeacher() ? (
        <div className="ClassPageActions">
          <button
            className="ClassHeaderCsvButton"
            onClick={() => importCSV(id as string, {
              onSuccess: async () => {
                setStatusType("success");
                setStatusMessage("Students enrolled successfully.");
              },
              onError: (message) => {
                setStatusType("error");
                setStatusMessage(message);
              },
            })}
          >
            Add Students via CSV
          </button>
        </div>
      ) : null}

      <StatusMessage message={statusMessage} type={statusType} />

      <div className="Class">
        <div className="Assignments">
          {assignmentSections.length === 0 ? (
            <div className="AssignmentsEmptyState">No assignments yet.</div>
          ) : (
            <div className="AssignmentSections">
              {assignmentSections.map((section) => (
                <section key={section.key} className="AssignmentSection">
                  <div className="AssignmentSectionHeader">
                    <h3>{section.title}</h3>
                    <span>{section.assignments.length}</span>
                  </div>

                  <ul className="Assignment">
                    {section.assignments.map((assignment) => (
                      <li key={assignment.id}>
                        <AssignmentCard
                          id={assignment.id}
                          dueDate={assignment.due_date ?? null}
                          status={assignmentStatuses[assignment.id] ?? null}
                          onEdit={() => setEditingAssignment(assignment)}
                          onDelete={handleDeleteAssignment}
                          isTeacher={isTeacherView}
                        >
                          {assignment.name}
                        </AssignmentCard>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>

        {isTeacherView ? (
          <div className="AssInputChunk">
            <span>New Assignment Name:</span>
            <Textbox
              placeholder="New Assignment..."
              onInput={setNewAssignmentName}
              className="AssignmentInput"
            />
            <Button onClick={tryCreateAssingment}>Add</Button>
          </div>
        ) : null}
      </div>

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
