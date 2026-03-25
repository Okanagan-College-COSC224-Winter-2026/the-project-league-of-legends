import { useEffect, useState } from "react";
import {
  AssignmentProgressCourse,
  AssignmentProgressItem,
  getAssignmentProgress,
  GroupProgressRow,
  StudentProgressRow,
} from "../util/api";
import "./AssignmentProgress.css";

type ProgressTab = "student" | "group";

function formatSubmissionStatus(
  status: StudentProgressRow["submission_status"],
) {
  return status === "submitted" ? "Submitted" : "Not submitted";
}

function formatEvaluationStatus(status: GroupProgressRow["evaluation_status"]) {
  if (status === "evaluated") {
    return "Evaluated";
  }
  if (status === "partially_evaluated") {
    return "Partially evaluated";
  }
  if (status === "no_members") {
    return "No members";
  }
  return "Not evaluated";
}

export default function AssignmentProgress() {
  const [activeTab, setActiveTab] = useState<ProgressTab>("student");
  const [courses, setCourses] = useState<AssignmentProgressCourse[]>([]);
  const [expandedCourses, setExpandedCourses] = useState<
    Record<number, boolean>
  >({});
  const [expandedAssignments, setExpandedAssignments] = useState<
    Record<string, boolean>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const data = await getAssignmentProgress();
        if (cancelled) {
          return;
        }
        setCourses(data.courses ?? []);
      } catch (err) {
        if (cancelled) {
          return;
        }
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load assignment progress.",
        );
        console.error(err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleCourse = (courseId: number) => {
    setExpandedCourses((prev) => ({
      ...prev,
      [courseId]: !prev[courseId],
    }));
  };

  const toggleAssignment = (courseId: number, assignmentId: number) => {
    const key = `${courseId}-${assignmentId}`;
    setExpandedAssignments((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const renderStudentTable = (assignment: AssignmentProgressItem) => {
    return (
      <table className="ProgressTable">
        <thead>
          <tr>
            <th>Student</th>
            <th>Submission</th>
          </tr>
        </thead>
        <tbody>
          {assignment.student_progress.length === 0 ? (
            <tr>
              <td colSpan={2}>No students enrolled in this course.</td>
            </tr>
          ) : (
            assignment.student_progress.map((row) => (
              <tr key={row.student_id}>
                <td>{row.student_name}</td>
                <td>
                  <span
                    className={`StatusBadge ${
                      row.submission_status === "submitted"
                        ? "is-positive"
                        : "is-negative"
                    }`}
                  >
                    {formatSubmissionStatus(row.submission_status)}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    );
  };

  const renderGroupTable = (assignment: AssignmentProgressItem) => {
    return (
      <table className="ProgressTable">
        <thead>
          <tr>
            <th>Group</th>
            <th>Evaluation</th>
            <th>Members</th>
          </tr>
        </thead>
        <tbody>
          {assignment.group_progress.length === 0 ? (
            <tr>
              <td colSpan={3}>No groups created for this assignment.</td>
            </tr>
          ) : (
            assignment.group_progress.map((row) => (
              <tr key={row.group_id}>
                <td>{row.group_name}</td>
                <td>
                  <span
                    className={`StatusBadge ${
                      row.evaluation_status === "evaluated"
                        ? "is-positive"
                        : row.evaluation_status === "partially_evaluated"
                          ? "is-warning"
                          : "is-negative"
                    }`}
                  >
                    {formatEvaluationStatus(row.evaluation_status)} (
                    {row.reviewed_member_count}/{row.total_members})
                  </span>
                </td>
                <td>
                  {row.members.length > 0
                    ? row.members.map((member) => member.user_name).join(", ")
                    : "-"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    );
  };

  if (loading) {
    return (
      <div className="AssignmentProgress">Loading assignment progress...</div>
    );
  }

  return (
    <div className="AssignmentProgress">
      <h1>Assignment progress</h1>

      <div
        className="ProgressTabs"
        role="tablist"
        aria-label="Assignment progress tabs"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "student"}
          className={`ProgressTabButton ${activeTab === "student" ? "active" : ""}`}
          onClick={() => setActiveTab("student")}
        >
          By student
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "group"}
          className={`ProgressTabButton ${activeTab === "group" ? "active" : ""}`}
          onClick={() => setActiveTab("group")}
        >
          By group
        </button>
      </div>

      {error ? <div className="ProgressError">{error}</div> : null}

      {!error && courses.length === 0 ? (
        <div className="ProgressEmpty">No courses with assignments found.</div>
      ) : !error ? (
        <div className="ProgressCourseList">
          {courses.map((course) => {
            const isCourseOpen = Boolean(expandedCourses[course.course_id]);

            return (
              <section className="ProgressCourse" key={course.course_id}>
                <button
                  type="button"
                  className="ProgressCourseButton"
                  onClick={() => toggleCourse(course.course_id)}
                  aria-expanded={isCourseOpen}
                >
                  <span>{course.course_name}</span>
                  <span>{isCourseOpen ? "Hide" : "Show"}</span>
                </button>

                {isCourseOpen ? (
                  <div className="ProgressAssignments">
                    {course.assignments.length === 0 ? (
                      <div className="ProgressEmptyInline">
                        No assignments in this course.
                      </div>
                    ) : (
                      course.assignments.map((assignment) => {
                        const assignmentKey = `${course.course_id}-${assignment.assignment_id}`;
                        const isAssignmentOpen = Boolean(
                          expandedAssignments[assignmentKey],
                        );

                        return (
                          <div
                            className="ProgressAssignment"
                            key={assignment.assignment_id}
                          >
                            <button
                              type="button"
                              className="ProgressAssignmentButton"
                              onClick={() =>
                                toggleAssignment(
                                  course.course_id,
                                  assignment.assignment_id,
                                )
                              }
                              aria-expanded={isAssignmentOpen}
                            >
                              <span>{assignment.assignment_name}</span>
                              <span>{isAssignmentOpen ? "Hide" : "Show"}</span>
                            </button>

                            {isAssignmentOpen ? (
                              <div className="ProgressTableWrap">
                                {activeTab === "student"
                                  ? renderStudentTable(assignment)
                                  : renderGroupTable(assignment)}
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
