import { useState, useEffect } from 'react';
import Button from '../components/Button';
import StatusMessage from '../components/StatusMessage';
import {
  getAllStudents,
  getAllClassesWithStudents,
  enrollStudentInClass,
  unenrollStudentFromClass,
  listClasses,
} from '../util/api';
import './AdminStudentEnrollment.css';

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

type ViewMode = 'students' | 'classes';

export default function AdminStudentEnrollment() {
  const [viewMode, setViewMode] = useState<ViewMode>('students');
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [allClasses, setAllClasses] = useState<ClassData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [enrollmentClass, setEnrollmentClass] = useState<ClassData | null>(null);
  const [enrollmentStudent, setEnrollmentStudent] = useState<Student | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const [studentsData, classesData, allClassesData] = await Promise.all([
        getAllStudents(),
        getAllClassesWithStudents(),
        listClasses(),
      ]);
      setStudents(studentsData);
      setClasses(classesData);
      setAllClasses(allClassesData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load data';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleEnrollClick = (student: Student, availableClass: ClassData) => {
    setEnrollmentStudent(student);
    setEnrollmentClass(availableClass);
    setEnrollModalOpen(true);
  };

  const handleConfirmEnroll = async () => {
    if (!enrollmentStudent || !enrollmentClass) return;

    try {
      setError('');
      await enrollStudentInClass(enrollmentStudent.id, enrollmentClass.id);
      setSuccess(`${enrollmentStudent.name} enrolled in ${enrollmentClass.name}`);
      setEnrollModalOpen(false);
      setEnrollmentStudent(null);
      setEnrollmentClass(null);
      await fetchData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to enroll student';
      setError(message);
    }
  };

  const handleUnenroll = async (student: Student, courseId: number) => {
    if (!window.confirm(`Remove ${student.name} from this class?`)) return;

    try {
      setError('');
      await unenrollStudentFromClass(student.id, courseId);
      setSuccess(`${student.name} has been removed from the class`);
      await fetchData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unenroll student';
      setError(message);
    }
  };

  const getAvailableClasses = (student: Student): ClassData[] => {
    const enrolledClassIds = student.enrolled_courses.map(c => c.id);
    return allClasses.filter(c => !enrolledClassIds.includes(c.id));
  };

  if (loading) {
    return (
      <div className="AdminStudentEnrollment-Container">
        <div className="AdminStudentEnrollment-Header">
          <h1>Student Enrollment Management</h1>
        </div>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Loading data...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="AdminStudentEnrollment-Header">
        <div className="AdminStudentEnrollment-HeaderLeft">
          <h1>Student Enrollment Management</h1>
        </div>
      </div>

      <StatusMessage message={error} type="error" />
      <StatusMessage message={success} type="success" />

      <div className="AdminStudentEnrollment-Container">
        <div className="AdminStudentEnrollment-Tabs">
          <button
            className={`AdminStudentEnrollment-Tab ${viewMode === 'students' ? 'active' : ''}`}
            onClick={() => setViewMode('students')}
          >
            Students View
          </button>
          <button
            className={`AdminStudentEnrollment-Tab ${viewMode === 'classes' ? 'active' : ''}`}
            onClick={() => setViewMode('classes')}
          >
            Classes View
          </button>
        </div>

        {viewMode === 'students' && (
          <div className="AdminStudentEnrollment-Content">
            <div className="AdminStudentEnrollment-StatsBar">
              <span>Total Students: {students.length}</span>
              <span>Enrolled: {students.filter(s => s.enrollment_count > 0).length}</span>
              <span>Not Enrolled: {students.filter(s => s.enrollment_count === 0).length}</span>
            </div>

            <div className="AdminStudentEnrollment-ScrollContainer">
              <div className="AdminStudentEnrollment-StudentsList">
                {students.map(student => (
                  <div
                    key={student.id}
                    className={`AdminStudentEnrollment-StudentCard ${selectedStudent?.id === student.id ? 'selected' : ''}`}
                    onClick={() => setSelectedStudent(selectedStudent?.id === student.id ? null : student)}
                  >
                    <div className="AdminStudentEnrollment-StudentCardHeader">
                      <div>
                        <h3>{student.name}</h3>
                        <p className="AdminStudentEnrollment-Email">{student.email}</p>
                      </div>
                      <span className="AdminStudentEnrollment-Badge">
                        {student.enrollment_count} class{student.enrollment_count !== 1 ? 'es' : ''}
                      </span>
                    </div>

                    {selectedStudent?.id === student.id && (
                      <div className="AdminStudentEnrollment-StudentDetails">
                        <div className="AdminStudentEnrollment-Section">
                          <h4>Enrolled Classes</h4>
                          {student.enrolled_courses.length > 0 ? (
                            <ul className="AdminStudentEnrollment-CourseList">
                              {student.enrolled_courses.map(course => (
                                <li key={course.id}>
                                  <div className="AdminStudentEnrollment-CourseInfo">
                                    <span className="AdminStudentEnrollment-CourseName">{course.name}</span>
                                    <span className="AdminStudentEnrollment-TeacherName">by {course.teacher_name}</span>
                                  </div>
                                  <button
                                    className="AdminStudentEnrollment-RemoveBtn"
                                    onClick={() => handleUnenroll(student, course.id)}
                                  >
                                    Remove
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="AdminStudentEnrollment-NoClasses">Not enrolled in any classes</p>
                          )}
                        </div>

                        <div className="AdminStudentEnrollment-Section">
                          <h4>Available Classes</h4>
                          {getAvailableClasses(student).length > 0 ? (
                            <ul className="AdminStudentEnrollment-CourseList">
                              {getAvailableClasses(student).map(c => (
                                <li key={c.id}>
                                  <div className="AdminStudentEnrollment-CourseInfo">
                                    <span className="AdminStudentEnrollment-CourseName">{c.name}</span>
                                    <span className="AdminStudentEnrollment-TeacherName">by {c.teacher?.name || 'Unknown'}</span>
                                  </div>
                                  <button
                                    className="AdminStudentEnrollment-EnrollBtn"
                                    onClick={() => handleEnrollClick(student, c)}
                                  >
                                    Enroll
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="AdminStudentEnrollment-NoClasses">All classes already enrolled</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {viewMode === 'classes' && (
          <div className="AdminStudentEnrollment-Content">
            <div className="AdminStudentEnrollment-StatsBar">
              <span>Total Classes: {classes.length}</span>
              <span>Total Enrollments: {classes.reduce((sum, c) => sum + c.student_count, 0)}</span>
            </div>

            <div className="AdminStudentEnrollment-ScrollContainer">
              <div className="AdminStudentEnrollment-ClassesList">
                {classes.map(classData => (
                  <div
                    key={classData.id}
                    className={`AdminStudentEnrollment-ClassCard ${selectedClass?.id === classData.id ? 'selected' : ''}`}
                    onClick={() => setSelectedClass(selectedClass?.id === classData.id ? null : classData)}
                  >
                    <div className="AdminStudentEnrollment-ClassCardHeader">
                      <div>
                        <h3>{classData.name}</h3>
                        <p className="AdminStudentEnrollment-TeacherInfo">Teacher: {classData.teacher_name}</p>
                      </div>
                      <span className="AdminStudentEnrollment-Badge">
                        {classData.student_count} student{classData.student_count !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {selectedClass?.id === classData.id && (
                      <div className="AdminStudentEnrollment-ClassDetails">
                        <div className="AdminStudentEnrollment-Section">
                          <h4>Enrolled Students</h4>
                          {classData.enrolled_students.length > 0 ? (
                            <ul className="AdminStudentEnrollment-StudentList">
                              {classData.enrolled_students.map(student => (
                                <li key={student.id}>
                                  <div className="AdminStudentEnrollment-StudentInfo">
                                    <span className="AdminStudentEnrollment-StudentName">{student.name}</span>
                                    <span className="AdminStudentEnrollment-StudentEmail">{student.email}</span>
                                  </div>
                                  <button
                                    className="AdminStudentEnrollment-RemoveBtn"
                                    onClick={() => handleUnenroll(students.find(s => s.id === student.id)!, classData.id)}
                                  >
                                    Remove
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="AdminStudentEnrollment-NoStudents">No students enrolled</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Enrollment Confirmation Modal */}
      {enrollModalOpen && enrollmentStudent && enrollmentClass && (
        <div className="AdminStudentEnrollment-Modal">
          <div className="AdminStudentEnrollment-ModalContent">
            <h2>Confirm Enrollment</h2>
            <p>
              Enroll <strong>{enrollmentStudent.name}</strong> in <strong>{enrollmentClass.name}</strong>?
            </p>
            <div className="AdminStudentEnrollment-ModalFooter">
              <Button onClick={handleConfirmEnroll}>
                Confirm
              </Button>
              <Button onClick={() => setEnrollModalOpen(false)} type="secondary">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
