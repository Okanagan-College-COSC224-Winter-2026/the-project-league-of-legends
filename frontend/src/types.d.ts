interface Course {
  id: number;
  teacherID: number;
  name: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: "student" | "teacher" | "admin";
}

interface StudentGroups {
  groupID: number;
  userID: number;
  assignmentID: number;
  id?: number;
  name?: string;
  email?: string;
  role?: "student" | "teacher" | "admin";
}

interface CourseGroup {
  id: number;
  name: string;
  assignmentID: number;
}

interface GroupTable {
  [key: number]: GroupTableValue[];
}

interface GroupTableValue {
  groupID: number;
  userID: number;
  assignmentID: number;
  id?: number;
  name?: string;
  email?: string;
  role?: "student" | "teacher" | "admin";
}

interface Criterion {
  id?: number;
  rubricID: number;
  question: string;
  scoreMax: number;
  hasScore: boolean;
}

interface Assignment {
  id: number;
  name: string;
  courseID: number;
  rubric?: string;
  rubric_id?: number | null;
  course?: Course;
  due_date?: string;
  attachment_filename?: string | null;
  attachment_path?: string | null;
}

interface CourseWithAssignments extends Course {
  assignments?: Assignment[];
  assignmentCount?: number;
  teacher_name?: string | null;
}

interface CourseSearchResult {
  id: number;
  name: string;
  teacherID: number;
  teacher_name: string | null;
}
