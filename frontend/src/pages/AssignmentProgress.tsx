import { useEffect, useMemo, useState } from "react";
import {
  listAssignments,
  listAssignmentSubmissions,
  listClasses,
  listCourseMembers,
  listGroupMembers,
  listGroups,
} from "../util/api";
import { isTeacher } from "../util/login";
import "./AssignmentProgress.css";

type ProgressTab = "student" | "group";

type CourseSummary = {
  id: number;
  name: string;
};

type AssignmentSummary = {
  id: number;
  name: string;
  due_date?: string | null;
};

type SubmissionSummary = {
  studentID?: number;
};

type GroupMemberSummary = {
  id?: number;
  userID?: number;
  name?: string;
};

type StudentProgressRow = {
  studentId: number;
  studentName: string;
  submitted: boolean;
};

type GroupProgressRow = {
  groupId: number;
  groupName: string;
  memberNames: string[];
  submitted: boolean;
};

function formatDueDate(dueDate?: string | null): string {
  if (!dueDate) return "No due date";
  const parsed = new Date(dueDate);
  if (Number.isNaN(parsed.getTime())) return "No due date";
  return `Due: ${parsed.toLocaleDateString()}`;
}

function byDueDateAscending(
  a: AssignmentSummary,
  b: AssignmentSummary,
): number {
  const aValue = a.due_date
    ? new Date(a.due_date).getTime()
    : Number.MAX_SAFE_INTEGER;
  const bValue = b.due_date
    ? new Date(b.due_date).getTime()
    : Number.MAX_SAFE_INTEGER;
  return aValue - bValue;
}

export default function AssignmentProgress() {
  const [activeTab, setActiveTab] = useState<ProgressTab>("student");
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [courseAssignments, setCourseAssignments] = useState<
    Record<number, AssignmentSummary[]>
  >({});
  const [expandedCourses, setExpandedCourses] = useState<
    Record<number, boolean>
  >({});
  const [expandedAssignments, setExpandedAssignments] = useState<
    Record<string, boolean>
  >({});
  const [studentProgress, setStudentProgress] = useState<
    Record<number, StudentProgressRow[]>
  >({});
  const [groupProgress, setGroupProgress] = useState<
    Record<number, GroupProgressRow[]>
  >({});
  const [loadingCourses, setLoadingCourses] = useState<boolean>(true);
  const [loadingAssignments, setLoadingAssignments] = useState<
    Record<number, boolean>
  >({});
  const [loadingProgress, setLoadingProgress] = useState<
    Record<string, boolean>
  >({});
  const [errorMessage, setErrorMessage] = useState<string>("");

  const teacherView = isTeacher();

  useEffect(() => {
    const fetchCourses = async () => {
      if (!teacherView) {
        setLoadingCourses(false);
        return;
      }

      try {
        setLoadingCourses(true);
        setErrorMessage("");
        const classResponse = await listClasses();
        const nextCourses = ((classResponse || []) as CourseSummary[]).map(
          (c) => ({
            id: c.id,
            name: c.name,
          }),
        );
        setCourses(nextCourses);
      } catch (error) {
        console.error("Failed to load courses for assignment progress:", error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load assignment progress data.",
        );
      } finally {
        setLoadingCourses(false);
      }
    };

    fetchCourses();
  }, [teacherView]);

  const expandedCourseIds = useMemo(
    () =>
      Object.keys(expandedCourses).filter((id) => expandedCourses[Number(id)]),
    [expandedCourses],
  );

  const toggleCourse = async (courseId: number) => {
    const isOpen = !!expandedCourses[courseId];
    const nextOpen = !isOpen;

    setExpandedCourses((prev) => ({
      ...prev,
      [courseId]: nextOpen,
    }));

    if (!nextOpen || courseAssignments[courseId]) {
      return;
    }

    try {
      setLoadingAssignments((prev) => ({ ...prev, [courseId]: true }));
      const assignments = (await listAssignments(
        String(courseId),
      )) as AssignmentSummary[];
      setCourseAssignments((prev) => ({
        ...prev,
        [courseId]: [...(assignments || [])].sort(byDueDateAscending),
      }));
    } catch (error) {
      console.error(
        `Failed to load assignments for course ${courseId}:`,
        error,
      );
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load assignments.",
      );
    } finally {
      setLoadingAssignments((prev) => ({ ...prev, [courseId]: false }));
    }
  };

  const loadStudentProgress = async (
    courseId: number,
    assignmentId: number,
  ) => {
    if (studentProgress[assignmentId]) return;

    const loadingKey = `student-${assignmentId}`;
    setLoadingProgress((prev) => ({ ...prev, [loadingKey]: true }));

    try {
      const [membersResponse, submissionResponse] = await Promise.all([
        listCourseMembers(String(courseId)),
        listAssignmentSubmissions(assignmentId),
      ]);

      const studentMembers = ((membersResponse || []) as User[]).filter(
        (member) => member.role === "student",
      );
      const submittedIds = new Set(
        ((submissionResponse || []) as SubmissionSummary[])
          .map((submission) => Number(submission.studentID))
          .filter((id) => Number.isFinite(id)),
      );

      const rows: StudentProgressRow[] = studentMembers.map((student) => ({
        studentId: student.id,
        studentName: student.name,
        submitted: submittedIds.has(student.id),
      }));

      setStudentProgress((prev) => ({ ...prev, [assignmentId]: rows }));
    } catch (error) {
      console.error(
        `Failed to load student progress for assignment ${assignmentId}:`,
        error,
      );
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to load student progress.",
      );
    } finally {
      setLoadingProgress((prev) => ({ ...prev, [loadingKey]: false }));
    }
  };

  const loadGroupProgress = async (courseId: number, assignmentId: number) => {
    if (groupProgress[assignmentId]) return;

    const loadingKey = `group-${assignmentId}`;
    setLoadingProgress((prev) => ({ ...prev, [loadingKey]: true }));

    try {
      const [membersResponse, groupsResponse, submissionResponse] =
        await Promise.all([
          listCourseMembers(String(courseId)),
          listGroups(assignmentId),
          listAssignmentSubmissions(assignmentId),
        ]);

      const memberNameById = new Map<number, string>();
      ((membersResponse || []) as User[]).forEach((member) => {
        memberNameById.set(member.id, member.name);
      });

      const submittedIds = new Set(
        ((submissionResponse || []) as SubmissionSummary[])
          .map((submission) => Number(submission.studentID))
          .filter((id) => Number.isFinite(id)),
      );

      const groups = (groupsResponse || []) as CourseGroup[];
      const membersByGroup = await Promise.all(
        groups.map((group) => listGroupMembers(assignmentId, group.id)),
      );

      const rows: GroupProgressRow[] = groups.map((group, index) => {
        const normalizedMembers = (
          (membersByGroup[index] || []) as GroupMemberSummary[]
        )
          .map((member) => {
            const userId = Number(member.userID ?? member.id);
            if (!Number.isFinite(userId)) return null;
            return {
              userId,
              name:
                member.name ?? memberNameById.get(userId) ?? `User ${userId}`,
            };
          })
          .filter(
            (member): member is { userId: number; name: string } =>
              member !== null,
          );

        return {
          groupId: group.id,
          groupName: group.name,
          memberNames: normalizedMembers.map((member) => member.name),
          submitted: normalizedMembers.some((member) =>
            submittedIds.has(member.userId),
          ),
        };
      });

      setGroupProgress((prev) => ({ ...prev, [assignmentId]: rows }));
    } catch (error) {
      console.error(
        `Failed to load group progress for assignment ${assignmentId}:`,
        error,
      );
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to load group progress.",
      );
    } finally {
      setLoadingProgress((prev) => ({ ...prev, [loadingKey]: false }));
    }
  };

  const toggleAssignment = async (courseId: number, assignmentId: number) => {
    const key = `${activeTab}-${assignmentId}`;
    const nextOpen = !expandedAssignments[key];

    setExpandedAssignments((prev) => ({
      ...prev,
      [key]: nextOpen,
    }));

    if (!nextOpen) {
      return;
    }

    if (activeTab === "student") {
      await loadStudentProgress(courseId, assignmentId);
      return;
    }

    await loadGroupProgress(courseId, assignmentId);
  };

  if (!teacherView) {
    return (
      <div className="AssignmentProgressPage">
        <h1>Assignment Progress</h1>
        <p>Only teachers can access this page.</p>
      </div>
    );
  }

  return (
    <div className="AssignmentProgressPage">
      <h1>Assignment Progress</h1>

      <div
        className="AssignmentProgressTabs"
        role="tablist"
        aria-label="Progress view tabs"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "student"}
          className={`AssignmentProgressTab ${activeTab === "student" ? "active" : ""}`}
          onClick={() => setActiveTab("student")}
        >
          Student
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "group"}
          className={`AssignmentProgressTab ${activeTab === "group" ? "active" : ""}`}
          onClick={() => setActiveTab("group")}
        >
          Group
        </button>
      </div>

      {errorMessage && (
        <p className="AssignmentProgressError">{errorMessage}</p>
      )}

      {loadingCourses ? (
        <p>Loading courses...</p>
      ) : courses.length === 0 ? (
        <p>No courses found.</p>
      ) : (
        <div className="CourseProgressList">
          {courses.map((course) => {
            const courseOpen = !!expandedCourses[course.id];
            const assignments = courseAssignments[course.id] || [];

            return (
              <section className="CourseProgressCard" key={course.id}>
                <button
                  type="button"
                  className="CourseButton"
                  onClick={() => void toggleCourse(course.id)}
                >
                  <span>{course.name}</span>
                  <span>{courseOpen ? "Hide" : "Show"}</span>
                </button>

                {courseOpen && (
                  <div className="AssignmentList">
                    {loadingAssignments[course.id] ? (
                      <p>Loading assignments...</p>
                    ) : assignments.length === 0 ? (
                      <p>No assignments in this course.</p>
                    ) : (
                      assignments.map((assignment) => {
                        const assignmentKey = `${activeTab}-${assignment.id}`;
                        const isOpen = !!expandedAssignments[assignmentKey];
                        const isLoading = loadingProgress[assignmentKey];

                        return (
                          <div className="AssignmentCard" key={assignment.id}>
                            <button
                              type="button"
                              className="AssignmentButton"
                              onClick={() =>
                                void toggleAssignment(course.id, assignment.id)
                              }
                            >
                              <div>
                                <p className="AssignmentName">
                                  {assignment.name}
                                </p>
                                <p className="AssignmentDue">
                                  {formatDueDate(assignment.due_date)}
                                </p>
                              </div>
                              <span>{isOpen ? "Hide" : "View"}</span>
                            </button>

                            {isOpen && (
                              <div className="AssignmentDetails">
                                {isLoading ? (
                                  <p>Loading progress...</p>
                                ) : activeTab === "student" ? (
                                  <table className="ProgressTable">
                                    <thead>
                                      <tr>
                                        <th>Student</th>
                                        <th>Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(
                                        studentProgress[assignment.id] || []
                                      ).map((row) => (
                                        <tr key={row.studentId}>
                                          <td>{row.studentName}</td>
                                          <td>
                                            <span
                                              className={`StatusBadge ${
                                                row.submitted
                                                  ? "submitted"
                                                  : "missing"
                                              }`}
                                            >
                                              {row.submitted
                                                ? "Submitted"
                                                : "Not Submitted"}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  <table className="ProgressTable">
                                    <thead>
                                      <tr>
                                        <th>Group</th>
                                        <th>Members</th>
                                        <th>Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(groupProgress[assignment.id] || []).map(
                                        (row) => (
                                          <tr key={row.groupId}>
                                            <td>{row.groupName}</td>
                                            <td>
                                              {row.memberNames.length > 0
                                                ? row.memberNames.join(", ")
                                                : "No members"}
                                            </td>
                                            <td>
                                              <span
                                                className={`StatusBadge ${
                                                  row.submitted
                                                    ? "submitted"
                                                    : "missing"
                                                }`}
                                              >
                                                {row.submitted
                                                  ? "Submitted"
                                                  : "Not Submitted"}
                                              </span>
                                            </td>
                                          </tr>
                                        ),
                                      )}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {expandedCourseIds.length === 0 &&
        !loadingCourses &&
        courses.length > 0 && <p>Select a course to view assignments.</p>}
    </div>
  );
}
