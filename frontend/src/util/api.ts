// src/util/api.ts
// (Your original file, only ADDING onto it + fixing listCourseMembers
//  because right now it's calling a non-existent endpoint and using POST.)
//  Backend route we added: GET /class/<class_id>/members

import { didExpire, removeToken } from "./login";

const BASE_URL = "http://localhost:5000";

// export const getProfile = async (id: string) => {
//   // TODO
// }

export const maybeHandleExpire = (response: Response) => {
  if (didExpire(response)) {
    // Remove the token
    removeToken();
    window.location.href = "/";
  }
};

function getFilenameFromResponse(
  response: Response,
  fallbackName: string,
): string {
  const disposition = response.headers.get("Content-Disposition");

  if (!disposition) return fallbackName;

  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1]);
  }

  const normalMatch = disposition.match(/filename="?([^"]+)"?/i);
  if (normalMatch?.[1]) {
    return normalMatch[1];
  }

  return fallbackName;
}

export const tryLogin = async (email: string, password: string) => {
  try {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: email, password: password }),
      credentials: "include", // Include cookies in request/response
    });

    if (!response.ok) {
      // Throw if login fails for any reason
      throw new Error(`Response status: ${response.status}`);
    }

    const json = await response.json();

    // Store user info (but not token - that's in httponly cookie now)
    localStorage.setItem("user", JSON.stringify(json));
    //console.log("Logged in:", json);

    return json;
  } catch (error) {
    // Login is wrong
    console.error(error);
    // window.location.href = '/';
  }

  return false;
};

export async function tryRegister(
  name: string,
  email: string,
  password: string,
): Promise<{ ok: boolean; msg?: string }> {
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name, email, password }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return { ok: false, msg: data.msg || "Registration failed" };
  }

  return { ok: true };
}

export const createClass = async (name: string) => {
  const response = await fetch(`${BASE_URL}/class/create_class`, {
    method: "POST",
    body: JSON.stringify({
      name,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  maybeHandleExpire(response);

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.msg || `Response status: ${response.status}`);
  }

  return data;
};

export const listClasses = async () => {
  // TODO get session info and whatnot
  const resp = await fetch(`${BASE_URL}/class/classes`, {
    method: "GET",
    credentials: "include", // Include cookies (JWT token)
  });

  maybeHandleExpire(resp);

  if (!resp.ok) {
    throw new Error(`Response status: ${resp.status}`);
  }

  return await resp.json();
};

/**
 * Search courses by name (US-17).
 * Tokens are space-separated, order-independent, case-insensitive.
 */
export const searchCourses = async (
  query: string,
): Promise<CourseSearchResult[]> => {
  const params = new URLSearchParams();
  if (query.trim()) {
    params.set("q", query.trim());
  }

  const resp = await fetch(
    `${BASE_URL}/class/search_course?${params.toString()}`,
    {
      method: "GET",
      credentials: "include",
    },
  );

  maybeHandleExpire(resp);

  if (!resp.ok) {
    throw new Error(`Response status: ${resp.status}`);
  }

  return await resp.json();
};

export const importStudentsForCourse = async (
  courseID: number,
  students: string,
) => {
  const response = await fetch(`${BASE_URL}/class/enroll_students`, {
    method: "POST",
    body: JSON.stringify({
      students,
      class_id: courseID,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  maybeHandleExpire(response);

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }
};

export const listAssignments = async (classId: string) => {
  const resp = await fetch(`${BASE_URL}/assignment/` + classId, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  maybeHandleExpire(resp);

  if (!resp.ok) {
    throw new Error(`Response status: ${resp.status}`);
  }

  return await resp.json();
};

export const getAssignment = async (assignmentId: number) => {
  const resp = await fetch(`${BASE_URL}/assignment/details/` + assignmentId, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  maybeHandleExpire(resp);

  if (!resp.ok) {
    throw new Error(`Response status: ${resp.status}`);
  }

  return await resp.json();
};

export const listStuGroup = async (assignmentId: number, studentId: number) => {
  const resp = await fetch(
    `${BASE_URL}/groups/list_stu_groups/` + assignmentId + "/" + studentId,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    },
  );

  maybeHandleExpire(resp);

  if (!resp.ok) {
    throw new Error(`Response status: ${resp.status}`);
  }

  const data = await resp.json();
  return (data || []).map((student: any) => ({
    userID: student.userID ?? student.id,
    groupID: student.groupID ?? -1,
    assignmentID: student.assignmentID ?? assignmentId,
  }));
};

export const listGroups = async (assignmentId: number) => {
  // new endpoint under /groups prefix
  const resp = await fetch(`${BASE_URL}/groups/` + assignmentId, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });
  maybeHandleExpire(resp);

  if (!resp.ok) {
    throw new Error(`Response status: ${resp.status}`);
  }

  return await resp.json();
};

export const listUnassignedGroups = async (assignmentId: number) => {
  const resp = await fetch(`${BASE_URL}/groups/list_ua_groups/${assignmentId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  maybeHandleExpire(resp);

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.msg || `Response status: ${resp.status}`);
  }

  return await resp.json();
};

export const listCourseMembers = async (classId: string) => {
  const resp = await fetch(`${BASE_URL}/class/${classId}/members`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  maybeHandleExpire(resp);

  if (!resp.ok) {
    throw new Error(`Response status: ${resp.status}`);
  }

  return await resp.json();
};

export const listGroupMembers = async (
  assignmentId: number,
  groupID: number,
) => {
  const resp = await fetch(
    `${BASE_URL}/groups/list_group_members/` + assignmentId + "/" + groupID,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    },
  );

  maybeHandleExpire(resp);

  if (!resp.ok) {
    throw new Error(`Response status: ${resp.status}`);
  }

  return await resp.json();
};

export const getUserId = async (): Promise<number> => {
  // The backend provides current user info at /user/ (requires JWT cookie)
  const resp = await fetch(`${BASE_URL}/user/`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  maybeHandleExpire(resp);

  if (!resp.ok) {
    throw new Error(`Response status: ${resp.status}`);
  }

  const json = await resp.json();
  if (!json || typeof json.id !== "number") {
    throw new Error("Failed to determine current user ID");
  }
  return json.id;
};

export const saveGroups = async (groupID: number, userID: number, assignmentID: number) => {
  const response = await fetch(`${BASE_URL}/groups/save_groups`, {
    method: "POST",
    body: JSON.stringify({
      groupID,
      userID,
      assignmentID,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });
  maybeHandleExpire(response);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const msg = (data && (data.msg || data.message)) || `Response status: ${response.status}`;
    throw new Error(msg);
  }

  return await response.json();
};

export const getCriteria = async (rubricID: number) => {
  const resp = await fetch(`${BASE_URL}/criteria?rubricID=${rubricID}`, {
    credentials: "include",
  });

  maybeHandleExpire(resp);

  if (resp.status === 404) {
    return [];
  }

  if (!resp.ok) {
    throw new Error(`Response status: ${resp.status}`);
  }

  return await resp.json();
};

export const createCriteria = async (
  rubricID: number,
  question: string,
  scoreMax: number,
  hasScore: boolean = true,
) => {
  const response = await fetch(`${BASE_URL}/create_criteria`, {
    method: "POST",
    body: JSON.stringify({
      rubricID,
      question,
      scoreMax,
      hasScore,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  maybeHandleExpire(response);

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }

  return await response.json();
};

export const createRubric = async (
  assignmentID: number,
  canComment: boolean,
): Promise<{ id: number }> => {
  const response = await fetch(`${BASE_URL}/create_rubric`, {
    method: "POST",
    body: JSON.stringify({
      assignmentID,
      canComment,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  maybeHandleExpire(response);

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }

  return await response.json();
};

export const getRubric = async (rubricID: number) => {
  const resp = await fetch(`${BASE_URL}/rubric?rubricID=${rubricID}`, {
    credentials: "include",
  });

  maybeHandleExpire(resp);

  if (resp.status === 404) {
    return null;
  }

  if (!resp.ok) {
    throw new Error(`Response status: ${resp.status}`);
  }

  return await resp.json();
};

export const deleteRubric = async (rubricID: number) => {
  const response = await fetch(`${BASE_URL}/delete_rubric`, {
    method: "POST",
    body: JSON.stringify({ rubricID }),
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  maybeHandleExpire(response);

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }

  return await response.json();
};

export const createAssignment = async (
  courseID: number,
  name: string,
  due_date?: string | null,
  rubric?: string | null,
  file?: File | null,
) => {
  const formData = new FormData();
  formData.append("courseID", String(courseID));
  formData.append("name", name);

  if (due_date) formData.append("due_date", due_date);
  if (rubric) formData.append("rubric", rubric);
  if (file) formData.append("file", file);

  const response = await fetch(`${BASE_URL}/assignment/create_assignment`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  maybeHandleExpire(response);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.msg || `Response status: ${response.status}`);
  }

  return await response.json();
};

export const deleteGroup = async (groupID: number) => {
  const response = await fetch(`${BASE_URL}/groups/${groupID}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });
  maybeHandleExpire(response);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const msg = (data && (data.msg || data.message)) || `Response status: ${response.status}`;
    throw new Error(msg);
  }

  return await response.json();
};

export const createReview = async (
  assignmentID: number,
  reviewerID: number,
  revieweeID: number,
) => {
  const response = await fetch(`${BASE_URL}/create_review`, {
    method: "POST",
    body: JSON.stringify({
      assignmentID,
      reviewerID,
      revieweeID,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  maybeHandleExpire(response);

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }
  return response;
};

export const createCriterion = async (
  reviewID: number,
  criterionRowID: number,
  grade: number | null,
  comments: string,
) => {
  const response = await fetch(`${BASE_URL}/create_criterion`, {
    method: "POST",
    body: JSON.stringify({
      reviewID,
      criterionRowID,
      grade,
      comments,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  maybeHandleExpire(response);

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }
  return response;
};

export const getReview = async (
  assignmentID: number,
  reviewerID: number,
  revieweeID: number,
) => {
  const resp = await fetch(
    `${BASE_URL}/review?assignmentID=${assignmentID}&reviewerID=${reviewerID}&revieweeID=${revieweeID}`,
    {
      credentials: "include",
    },
  );

  maybeHandleExpire(resp);

  if (resp.status === 404) {
    return null;
  }

  if (!resp.ok) {
    throw new Error(`Response status: ${resp.status}`);
  }

  return resp;
};

export const getReceivedReviews = async (
  assignmentID: number,
  revieweeID?: number,
) => {
  const query = new URLSearchParams({
    assignmentID: String(assignmentID),
  });

  if (typeof revieweeID === "number") {
    query.set("revieweeID", String(revieweeID));
  }

  const resp = await fetch(`${BASE_URL}/reviews/received?${query.toString()}`, {
    method: "GET",
    credentials: "include",
  });

  maybeHandleExpire(resp);

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.msg || `Response status: ${resp.status}`);
  }

  return await resp.json();
};

export const getNextGroupID = async (assignmentID: number) => {
  const response = await fetch(`${BASE_URL}/groups/next_groupid?assignmentID=${assignmentID}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  maybeHandleExpire(response);

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }

  return await response.json();
};

export const createGroup = async (assignmentID: number, name: string, id: number) => {
  const response = await fetch(`${BASE_URL}/groups/create`, {
    method: "POST",
    body: JSON.stringify({
      assignmentID,
      name,
      id,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });
  maybeHandleExpire(response);

  // attempt to read JSON payload (could fail if empty)
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = (data && (data.msg || data.message)) || `Response status: ${response.status}`;
    throw new Error(msg);
  }

  return data;
};

// Admin - Create Teacher Account
export const createTeacherAccount = async (
  name: string,
  email: string,
  password: string,
) => {
  const response = await fetch(`${BASE_URL}/admin/users/create`, {
    method: "POST",
    body: JSON.stringify({
      name,
      email,
      password,
      role: "teacher",
      must_change_password: true,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  maybeHandleExpire(response);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.msg || `Response status: ${response.status}`);
  }

  return await response.json();
};

// User - Change Password
export const changePassword = async (
  currentPassword: string,
  newPassword: string,
) => {
  const response = await fetch(`${BASE_URL}/user/password`, {
    method: "PATCH",
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  maybeHandleExpire(response);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.msg || `Response status: ${response.status}`);
  }

  return await response.json();
};

// export const getDashboard = async () => {
//   const resp = await fetch("http://localhost:5000/dashboard/", {
//     method: "GET",
//     credentials: "include", // important to send JWT cookie
//   });

//   if (!resp.ok) {
//     throw new Error(`Dashboard fetch failed: ${resp.status}`);
//   }

//   return await resp.json();
// };

export async function getDashboard(){
  const resp = await fetch(`${BASE_URL}/dashboard`, {
    method:"GET",
    credentials:"include",
    headers:{'Content-type':'application/json'},
  });

  if(!resp.ok){
    throw new Error(`Dashboard fetch failed: ${resp.status}`);
  }

  return await resp.json();
}

// US9 - edit assignment
export const editAssignment = async (
  assignmentId: number,
  updates: {
    name?: string;
    due_date?: string | null;
    rubric?: string | null;
    file?: File | null;
  },
) => {
  const formData = new FormData();

  if (updates.name !== undefined) formData.append("name", updates.name);
  if (updates.due_date) formData.append("due_date", updates.due_date);
  if (updates.rubric) formData.append("rubric", updates.rubric);
  if (updates.file) formData.append("file", updates.file);

  const response = await fetch(
    `${BASE_URL}/assignment/edit_assignment/${assignmentId}`,
    {
      method: "PATCH",
      body: formData,
      credentials: "include",
    },
  );

  maybeHandleExpire(response);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.msg || `Response status: ${response.status}`);
  }

  return await response.json();
};

// US9 - delete assignment
export const deleteAssignment = async (assignmentId: number) => {
  const response = await fetch(
    `${BASE_URL}/assignment/delete_assignment/${assignmentId}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    },
  );

  maybeHandleExpire(response);

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }

  return await response.json();
};

export const downloadAssignmentFile = async (
  assignmentId: number,
): Promise<void> => {
  const response = await fetch(
    `${BASE_URL}/assignment/download_assignment_file/${assignmentId}`,
    {
      method: "GET",
      credentials: "include",
    },
  );

  maybeHandleExpire(response);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.msg || "Failed to download assignment file");
  }

  const filename = getFilenameFromResponse(
    response,
    `assignment-${assignmentId}`,
  );

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};

export const submitAssignmentFile = async (
  assignmentId: number,
  file: File,
): Promise<void> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${BASE_URL}/assignment/submit/${assignmentId}`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  maybeHandleExpire(response);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.msg || "Submission upload failed");
  }
};

export const downloadMySubmissionFile = async (
  assignmentId: number,
): Promise<void> => {
  const response = await fetch(
    `${BASE_URL}/assignment/download_my_submission/${assignmentId}`,
    {
      method: "GET",
      credentials: "include",
    },
  );

  maybeHandleExpire(response);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.msg || "Failed to download submission");
  }

  const filename = getFilenameFromResponse(
    response,
    `submission-${assignmentId}`,
  );

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};

export const getMySubmissionInfo = async (assignmentId: number) => {
  const response = await fetch(
    `${BASE_URL}/assignment/my_submission/${assignmentId}`,
    {
      method: "GET",
      credentials: "include",
    }
  );

  maybeHandleExpire(response);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.msg || "Failed to load submission info");
  }

  return await response.json();
};

export const listAssignmentSubmissions = async (assignmentId: number) => {
  const response = await fetch(`${BASE_URL}/assignment/submissions/${assignmentId}`, {
    method: "GET",
    credentials: "include",
  });

  maybeHandleExpire(response);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.msg || "Failed to list submissions");
  }

  return await response.json();
};

export const downloadStudentSubmissionFile = async (
  assignmentId: number,
  studentId: number,
): Promise<void> => {
  const response = await fetch(
    `${BASE_URL}/assignment/download_submission/${assignmentId}/${studentId}`,
    {
      method: "GET",
      credentials: "include",
    },
  );

  maybeHandleExpire(response);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.msg || "Failed to download student submission");
  }

  const filename = getFilenameFromResponse(
    response,
    `submission-${assignmentId}-${studentId}`,
  );

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};

// US26 - Admin User Management
// List all users
export const listAllUsers = async () => {
  const response = await fetch(`${BASE_URL}/admin/users`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  maybeHandleExpire(response);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.msg || `Response status: ${response.status}`);
  }

  return await response.json();
};

// Create a new user with any role
export const createUser = async (
  name: string,
  email: string,
  password: string,
  role: string,
  must_change_password: boolean = false
) => {
  const response = await fetch(`${BASE_URL}/admin/users/create`, {
    method: "POST",
    body: JSON.stringify({
      name,
      email,
      password,
      role,
      must_change_password,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  maybeHandleExpire(response);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.msg || `Response status: ${response.status}`);
  }

  return await response.json();
};

// Update user details (name and/or email)
export const updateUserDetails = async (
  userId: number,
  updates: { name?: string; email?: string }
) => {
  const response = await fetch(`${BASE_URL}/admin/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(updates),
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  maybeHandleExpire(response);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.msg || `Response status: ${response.status}`);
  }

  return await response.json();
};

// Update user role
export const updateUserRole = async (userId: number, role: string) => {
  const response = await fetch(`${BASE_URL}/admin/users/${userId}/role`, {
    method: "PUT",
    body: JSON.stringify({ role }),
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  maybeHandleExpire(response);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.msg || `Response status: ${response.status}`);
  }

  return await response.json();
};

// Delete a user
export const deleteUser = async (userId: number) => {
  const response = await fetch(`${BASE_URL}/admin/users/${userId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  maybeHandleExpire(response);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.msg || `Response status: ${response.status}`);
  }

  return await response.json();
};

// Reset a user's password
export const resetUserPassword = async (userId: number, newPassword: string) => {
  const response = await fetch(`${BASE_URL}/admin/users/${userId}/password`, {
    method: "PUT",
    body: JSON.stringify({ password: newPassword }),
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  maybeHandleExpire(response);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.msg || `Response status: ${response.status}`);
  }

  return await response.json();
};

export const getMyProfile = async () => {
  const response = await fetch(`${BASE_URL}/user/`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  maybeHandleExpire(response);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.msg || `Response status: ${response.status}`);
  }

  return await response.json();
};

export const updateMyProfile = async (updates: {
  username?: string;
  pronouns?: string;
  profilePicture?: File | null;
}) => {
  const formData = new FormData();

  if (updates.username !== undefined) {
    formData.append("username", updates.username);
  }

  if (updates.pronouns !== undefined) {
    formData.append("pronouns", updates.pronouns);
  }

  if (updates.profilePicture) {
    formData.append("profile_picture", updates.profilePicture);
  }

  const response = await fetch(`${BASE_URL}/user/`, {
    method: "PUT",
    body: formData,
    credentials: "include",
  });

  maybeHandleExpire(response);

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.msg || `Response status: ${response.status}`);
  }

  return data;
};