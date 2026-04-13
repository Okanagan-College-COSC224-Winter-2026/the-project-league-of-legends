import { useEffect, useMemo, useState } from "react";
import StatusMessage from "../components/StatusMessage";
import {
  enrollStudentInClass,
  getAllClassesWithStudents,
  getAllStudents,
  unenrollStudentFromClass,
} from "../util/api";
import "./AdminStudentEnrollment.css";

interface EnrolledCourse {
  id: number;
  name: string;
  teacher_name: string;
}

interface Student {
  id: number;
  name: string;
  email: string;
  enrolled_courses: EnrolledCourse[];
  enrollment_count: number;
}

interface ClassStudent {
  id: number;
  name: string;
  email: string;
}

interface ClassData {
  id: number;
  name: string;
  teacher_id: number;
  teacher_name: string;
  enrolled_students: ClassStudent[];
  student_count: number;
}

type ViewMode = "students" | "classes";

export default function AdminStudentEnrollment() {
  const [viewMode, setViewMode] = useState<ViewMode>("students");
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);

  const selectedStudent = students.find((student) => student.id === selectedStudentId) ?? null;
  const selectedClass = classes.find((course) => course.id === selectedClassId) ?? null;

  const availableClasses = useMemo(() => {
    if (!selectedStudent) {
      return [];
    }

    const enrolledClassIds = new Set(selectedStudent.enrolled_courses.map((course) => course.id));
    return classes.filter((course) => !enrolledClassIds.has(course.id));
  }, [classes, selectedStudent]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");
      const [studentsResponse, classesResponse] = await Promise.all([
        getAllStudents(),
        getAllClassesWithStudents(),
      ]);
      setStudents(studentsResponse);
      setClasses(classesResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load enrollment data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEnroll = async (studentId: number, classId: number) => {
    try {
      setError("");
      setSuccess("");
      const response = await enrollStudentInClass(studentId, classId);
      setSuccess(response.msg || "Student enrolled successfully");
      await fetchData();
      setSelectedStudentId(studentId);
      setSelectedClassId(classId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enroll student");
    }
  };

  const handleUnenroll = async (studentId: number, classId: number) => {
    try {
      setError("");
      setSuccess("");
      const response = await unenrollStudentFromClass(studentId, classId);
      setSuccess(response.msg || "Student removed successfully");
      await fetchData();
      setSelectedStudentId(studentId);
      setSelectedClassId(classId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove student");
    }
  };

  if (loading) {
    return <div className="AdminStudentEnrollment-Loading">Loading enrollment data...</div>;
  }

  return (
    <div className="AdminStudentEnrollment-Page">
      <div className="AdminStudentEnrollment-Hero">
        <div>
          <p className="AdminStudentEnrollment-Eyebrow">Admin Tools</p>
          <h1>Student Enrollment</h1>
          <p className="AdminStudentEnrollment-Subtitle">
            Review who is enrolled where, then add or remove students without leaving the page.
          </p>
        </div>
        <div className="AdminStudentEnrollment-Stats">
          <div>
            <strong>{students.length}</strong>
            <span>Students</span>
          </div>
          <div>
            <strong>{classes.length}</strong>
            <span>Classes</span>
          </div>
          <div>
            <strong>{classes.reduce((sum, course) => sum + course.student_count, 0)}</strong>
            <span>Total Enrollments</span>
          </div>
        </div>
      </div>

      <StatusMessage message={error} type="error" />
      <StatusMessage message={success} type="success" />

      <div className="AdminStudentEnrollment-Tabs">
        <button
          className={viewMode === "students" ? "active" : ""}
          onClick={() => setViewMode("students")}
        >
          Students
        </button>
        <button
          className={viewMode === "classes" ? "active" : ""}
          onClick={() => setViewMode("classes")}
        >
          Classes
        </button>
      </div>

      {viewMode === "students" ? (
        <div className="AdminStudentEnrollment-Grid">
          <section className="AdminStudentEnrollment-Panel">
            <div className="AdminStudentEnrollment-PanelHeader">
              <h2>Students</h2>
              <span>{students.length}</span>
            </div>
            <div className="AdminStudentEnrollment-List">
              {students.map((student) => (
                <button
                  key={student.id}
                  className={`AdminStudentEnrollment-Card ${selectedStudentId === student.id ? "selected" : ""}`}
                  onClick={() =>
                    setSelectedStudentId(selectedStudentId === student.id ? null : student.id)
                  }
                >
                  <div className="AdminStudentEnrollment-CardInfo">
                    <strong className="AdminStudentEnrollment-CardTitle">{student.name}</strong>
                    <p className="AdminStudentEnrollment-CardMeta">{student.email}</p>
                  </div>
                  <span className="AdminStudentEnrollment-CardBadge">{student.enrollment_count}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="AdminStudentEnrollment-Panel AdminStudentEnrollment-DetailPanel">
            <div className="AdminStudentEnrollment-PanelHeader">
              <h2>{selectedStudent ? selectedStudent.name : "Select a student"}</h2>
            </div>

            {!selectedStudent ? (
              <div className="AdminStudentEnrollment-Empty">
                Choose a student to review current classes and add new enrollments.
              </div>
            ) : (
              <div className="AdminStudentEnrollment-DetailBody">
                <div className="AdminStudentEnrollment-DetailSection">
                  <h3>Current Classes</h3>
                  {selectedStudent.enrolled_courses.length === 0 ? (
                    <p className="AdminStudentEnrollment-EmptyInline">Not enrolled in any classes.</p>
                  ) : (
                    <ul className="AdminStudentEnrollment-DetailList">
                      {selectedStudent.enrolled_courses.map((course) => (
                        <li key={course.id}>
                          <div>
                            <strong>{course.name}</strong>
                            <p>{course.teacher_name}</p>
                          </div>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              handleUnenroll(selectedStudent.id, course.id);
                            }}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="AdminStudentEnrollment-DetailSection">
                  <h3>Available Classes</h3>
                  {availableClasses.length === 0 ? (
                    <p className="AdminStudentEnrollment-EmptyInline">
                      This student is already enrolled in every available class.
                    </p>
                  ) : (
                    <ul className="AdminStudentEnrollment-DetailList">
                      {availableClasses.map((course) => (
                        <li key={course.id}>
                          <div>
                            <strong>{course.name}</strong>
                            <p>{course.teacher_name}</p>
                          </div>
                          <button
                            className="secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleEnroll(selectedStudent.id, course.id);
                            }}
                          >
                            Enroll
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="AdminStudentEnrollment-Grid">
          <section className="AdminStudentEnrollment-Panel">
            <div className="AdminStudentEnrollment-PanelHeader">
              <h2>Classes</h2>
              <span>{classes.length}</span>
            </div>
            <div className="AdminStudentEnrollment-List">
              {classes.map((course) => (
                <button
                  key={course.id}
                  className={`AdminStudentEnrollment-Card ${selectedClassId === course.id ? "selected" : ""}`}
                  onClick={() => setSelectedClassId(selectedClassId === course.id ? null : course.id)}
                >
                  <div className="AdminStudentEnrollment-CardInfo AdminStudentEnrollment-ClassInfo">
                    <div className="AdminStudentEnrollment-ClassName">{course.name}</div>
                    <div className="AdminStudentEnrollment-ClassTeacher">
                      Taught by {course.teacher_name}
                    </div>
                  </div>
                  <span className="AdminStudentEnrollment-CardBadge">{course.student_count}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="AdminStudentEnrollment-Panel AdminStudentEnrollment-DetailPanel">
            <div className="AdminStudentEnrollment-PanelHeader">
              <h2>{selectedClass ? selectedClass.name : "Select a class"}</h2>
            </div>

            {!selectedClass ? (
              <div className="AdminStudentEnrollment-Empty">
                Choose a class to review everyone currently enrolled.
              </div>
            ) : selectedClass.enrolled_students.length === 0 ? (
              <div className="AdminStudentEnrollment-Empty">
                No students are enrolled in this class yet.
              </div>
            ) : (
              <ul className="AdminStudentEnrollment-DetailList">
                {selectedClass.enrolled_students.map((student) => (
                  <li key={student.id}>
                    <div>
                      <strong>{student.name}</strong>
                      <p>{student.email}</p>
                    </div>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        handleUnenroll(student.id, selectedClass.id);
                      }}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
