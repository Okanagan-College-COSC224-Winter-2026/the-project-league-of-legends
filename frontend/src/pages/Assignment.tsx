import { useEffect, useState, ChangeEvent, useCallback } from "react";
import { useParams } from "react-router-dom";
import "./Assignment.css";
import RubricCreator from "../components/RubricCreator";
import RubricDisplay from "../components/RubricDisplay";
import TabNavigation from "../components/TabNavigation";
import { isTeacher } from "../util/login";

import {
  listStuGroup,
  getUserId,
  createReview,
  createCriterion,
  getReview,
  downloadAssignmentFile,
  submitAssignmentFile,
  downloadMySubmissionFile,
  getMySubmissionInfo,
  listAssignmentSubmissions,
  downloadStudentSubmissionFile,
  getAssignment,
  listCourseMembers,
  listGroups,
  listGroupMembers,
  getCriteria,
} from "../util/api";

interface SelectedCriterion {
  row: number;
  column: number;
}

interface Submission {
  id: number;
  studentID: number;
  assignmentID: number;
  file_name: string;
  file_path: string;
  submitted_at?: string;
  student_name?: string;
}

export default function Assignment() {
  const { id } = useParams();
  const assignmentId = Number(id);

  const [stuGroup, setStuGroup] = useState<StudentGroups[]>([]);
  const [classMembers, setClassMembers] = useState<User[]>([]);
  const [revieweeID, setRevieweeID] = useState<number>(0);
  const [stuID, setStuID] = useState<number>(0);
  const [selectedCriteria, setSelectedCriteria] = useState<
    SelectedCriterion[]
  >([]);
  const [review, setReview] = useState<(number | null)[]>([]);
  const [rubricCriteria, setRubricCriteria] = useState<Criterion[]>([]);
  const [criterionComments, setCriterionComments] = useState<
    Record<number, string>
  >({});
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [submissionMessage, setSubmissionMessage] = useState<string>("");
  const [existingSubmission, setExistingSubmission] =
    useState<Submission | null>(null);
  const [loadingSubmissionInfo, setLoadingSubmissionInfo] =
    useState(false);
  const [teacherSubmissions, setTeacherSubmissions] = useState<Submission[]>(
    [],
  );
  const [loadingTeacherSubmissions, setLoadingTeacherSubmissions] =
    useState(false);
  const [studentGroupNames, setStudentGroupNames] = useState<
    Record<number, string>
  >({});
  const [assignmentAttachmentName, setAssignmentAttachmentName] = useState<
    string | null
  >(null);

  const isTeacherView = isTeacher();
  const hasGroup = stuGroup.length > 0;

  const loadClassMembers = async (currentAssignmentId: number) => {
    try {
      const assignment = await getAssignment(currentAssignmentId);
      const courseId = assignment?.course?.id;
      setAssignmentAttachmentName(
        typeof assignment?.attachment_filename === "string"
          ? assignment.attachment_filename
          : null,
      );

      if (typeof courseId === "number") {
        const members = await listCourseMembers(String(courseId));
        setClassMembers(members);
      } else {
        setClassMembers([]);
      }
    } catch (error) {
      console.error("Error fetching class members:", error);
      setClassMembers([]);
      setAssignmentAttachmentName(null);
    }
  };

    const loadTeacherSubmissions = useCallback(async () => {
    try {
      setLoadingTeacherSubmissions(true);
      const submissions = await listAssignmentSubmissions(assignmentId);
      setTeacherSubmissions(submissions);
    } catch (error) {
      console.error("Error fetching submissions:", error);
      setSubmissionMessage(
        error instanceof Error
          ? error.message
          : "Failed to load submissions",
      );
    } finally {
      setLoadingTeacherSubmissions(false);
    }
    }, [assignmentId]);

  const loadTeacherSubmissionGroups = async () => {
    try {
      const groups: CourseGroup[] = await listGroups(assignmentId);
      const groupMembers = await Promise.all(
        groups.map(async (group) => ({
          groupName: group.name,
          members: await listGroupMembers(assignmentId, group.id),
        })),
      );

      const nextGroupNames: Record<number, string> = {};
      for (const groupEntry of groupMembers) {
        for (const member of groupEntry.members || []) {
          const userId = member.userID ?? member.id;
          if (typeof userId === "number") {
            nextGroupNames[userId] = groupEntry.groupName;
          }
        }
      }

      setStudentGroupNames(nextGroupNames);
    } catch (error) {
      console.error("Error loading submission groups:", error);
      setStudentGroupNames({});
    }
  };

    const refreshTeacherSubmissionData = useCallback(async () => {
    await Promise.all([
      loadTeacherSubmissions(),
      loadTeacherSubmissionGroups(),
    ]);
  }, [loadTeacherSubmissions, loadTeacherSubmissionGroups]);

  const loadMySubmissionInfo = async (currentAssignmentId: number) => {
    try {
      setLoadingSubmissionInfo(true);
      const submission = await getMySubmissionInfo(currentAssignmentId);
      setExistingSubmission(submission);
    } catch (error) {
      console.error("Error loading submission info:", error);
      setExistingSubmission(null);
    } finally {
      setLoadingSubmissionInfo(false);
    }
  };

  const nameFromId = (userId: number) => {
    return (
      classMembers.find((member) => member.id === userId)?.name ||
      `User ${userId}`
    );
  };

  const revieweeLabel = (userId: number) => {
    const name = nameFromId(userId);
    return userId === stuID ? `${name} (you)` : name;
  };

  const groupFromStudentId = (userId: number) => {
    return studentGroupNames[userId] || "No group";
  };

  useEffect(() => {
    (async () => {
      try {
        if (isTeacherView) {
          await loadClassMembers(assignmentId);
          await refreshTeacherSubmissionData();
          return;
        }

        const currentStuID = await getUserId();
        setStuID(currentStuID);
        await loadClassMembers(assignmentId);

        const groupMembers = await listStuGroup(assignmentId, currentStuID);
        setStuGroup(groupMembers);
        await loadMySubmissionInfo(assignmentId);

        const criteria = await getCriteria(assignmentId);
        setRubricCriteria(Array.isArray(criteria) ? criteria : []);
      } catch (error) {
        console.error("Error loading assignment page:", error);
        setSubmissionMessage(
          error instanceof Error
            ? error.message
            : "Failed to load assignment page",
        );
      }
    })();
  }, [assignmentId, isTeacherView]);

  useEffect(() => {
    if (isTeacherView || revieweeID <= 0) {
      setReview([]);
      setCriterionComments({});
      setSelectedCriteria([]);
      return;
    }

    (async () => {
      try {
        setSelectedCriteria([]);
        const reviewResponse = await getReview(assignmentId, stuID, revieweeID);
        if (!reviewResponse || !reviewResponse.ok) {
          setReview([]);
          setCriterionComments({});
          return;
        }

        const reviewData = await reviewResponse.json();
        const loadedGrades = Array.isArray(reviewData.grades)
          ? reviewData.grades
          : [];
        setReview(loadedGrades);

        const loadedComments = Array.isArray(reviewData.comments)
          ? reviewData.comments
          : [];
        const commentsByRow: Record<number, string> = {};
        loadedComments.forEach((value: unknown, index: number) => {
          if (typeof value === "string" && value.trim().length > 0) {
            commentsByRow[index] = value;
          }
        });
        setCriterionComments(commentsByRow);
      } catch (error) {
        console.error("Error fetching review:", error);
        setReview([]);
        setCriterionComments({});
      }
    })();
  }, [assignmentId, stuID, revieweeID, isTeacherView]);

  const handleCriterionSelect = (row: number, column: number) => {
    const existingIndex = selectedCriteria.findIndex(
      (criterion) => criterion.row === row && criterion.column === column,
    );

    if (existingIndex >= 0) {
      setSelectedCriteria((prev) =>
        prev.filter((_, index) => index !== existingIndex),
      );
    } else {
      setSelectedCriteria((prev) => {
        const filteredCriteria = prev.filter(
          (criterion) => criterion.row !== row,
        );
        return [...filteredCriteria, { row, column }];
      });
    }
  };

  function handleRadioChange(
    event: ChangeEvent<HTMLInputElement>,
  ): void {
    const selectedID = Number(event.target.value);
    setRevieweeID(selectedID);
  }

  const handleDownloadAssignmentFile = async () => {
    try {
      setSubmissionMessage("");
      await downloadAssignmentFile(assignmentId);
    } catch (error) {
      console.error("Error downloading assignment file:", error);
      setSubmissionMessage(
        error instanceof Error
          ? error.message
          : "Failed to download assignment file",
      );
    }
  };

  const handleSubmissionFileChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0] || null;
    setSubmissionFile(file);
  };

  const handleUploadSubmission = async () => {
    if (!submissionFile) {
      setSubmissionMessage("Please choose a file first.");
      return;
    }

    if (!hasGroup) {
      setSubmissionMessage(
        "You must be assigned to a group before submitting a group file.",
      );
      return;
    }

    try {
      setSubmissionMessage("");
      await submitAssignmentFile(assignmentId, submissionFile);
      setSubmissionMessage(
        "Group submission uploaded successfully for your team.",
      );
      await loadMySubmissionInfo(assignmentId);
    } catch (error) {
      console.error("Error uploading submission:", error);
      setSubmissionMessage(
        error instanceof Error
          ? error.message
          : "Failed to upload submission",
      );
    }
  };

  const handleDownloadMySubmission = async () => {
    try {
      setSubmissionMessage("");
      await downloadMySubmissionFile(assignmentId);
    } catch (error) {
      console.error("Error downloading submission:", error);
      setSubmissionMessage(
        error instanceof Error
          ? error.message
          : "Failed to download your submission",
      );
    }
  };

  const handleDownloadStudentSubmission = async (studentId: number) => {
    try {
      setSubmissionMessage("");
      await downloadStudentSubmissionFile(assignmentId, studentId);
    } catch (error) {
      console.error("Error downloading student submission:", error);
      setSubmissionMessage(
        error instanceof Error
          ? error.message
          : "Failed to download student submission",
      );
    }
  };

  return (
    <>
      <div className="AssignmentHeader">
        <h2>Assignment {id}</h2>
      </div>

      <TabNavigation
        tabs={[
          {
            label: "Home",
            path: `/assignments/${id}`,
          },
          {
            label: "Group",
            path: `/assignments/${id}/group`,
          },
          {
            label: "Reviews",
            path: `/assignments/${id}/reviews`,
          },
        ]}
      />

      <div className="assignmentPage">
        <div className="assignmentMainCard">
          <div className="assignmentSectionHeader">
            <h3>Rubric</h3>
          </div>

          <div className="assignmentRubricDisplay">
            <RubricDisplay
              rubricId={assignmentId}
              onCriterionSelect={handleCriterionSelect}
              grades={review}
              criterionComments={criterionComments}
              onCriterionCommentChange={(row, comment) => {
                setCriterionComments((prev) => ({
                  ...prev,
                  [row]: comment,
                }));
              }}
            />
          </div>
        </div>

        {isTeacherView && (
          <>
            <div className="assignmentMainCard">
              <div className="assignmentSectionHeader">
                <h3>Edit Rubric</h3>
              </div>
              <div className="assignmentRubric">
                <RubricCreator id={assignmentId} />
              </div>
            </div>

            <div className="assignmentMainCard">
              <div className="assignmentSectionHeader">
                <h3>Student Submissions</h3>
              </div>

              <div className="assignmentButtonRow">
                <button
                  className="assignmentActionButton"
                  onClick={refreshTeacherSubmissionData}
                >
                  Refresh Submissions
                </button>
              </div>

              {loadingTeacherSubmissions ? (
                <p>Loading submissions...</p>
              ) : teacherSubmissions.length === 0 ? (
                <p>No submissions yet.</p>
              ) : (
                <div className="teacherSubmissionsList">
                  {teacherSubmissions.map((submission) => (
                    <div
                      key={submission.id}
                      className="teacherSubmissionRow"
                    >
                      <div className="teacherSubmissionInfo">
                        <p className="teacherSubmissionStudent">
                          {submission.student_name ||
                            nameFromId(submission.studentID)}
                          {` (${groupFromStudentId(submission.studentID)})`}
                        </p>
                        <p className="teacherSubmissionFile">
                          {submission.file_name}
                        </p>
                        {submission.submitted_at && (
                          <p className="teacherSubmissionDate">
                            Submitted:{" "}
                            {new Date(
                              submission.submitted_at,
                            ).toLocaleString()}
                          </p>
                        )}
                      </div>

                      <button
                        className="assignmentActionButton"
                        onClick={() =>
                          handleDownloadStudentSubmission(
                            submission.studentID,
                          )
                        }
                      >
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {!isTeacherView && (
          <div className="studentAssignmentGrid">
            <div className="studentCard">
              <div className="assignmentSectionHeader">
                <h3>Assignment File</h3>
              </div>
              <p className="assignmentHelperText">
                Download the file your teacher uploaded for this assignment.
              </p>

              {assignmentAttachmentName ? (
                <p className="selectedFileName">
                  Available file: {assignmentAttachmentName}
                </p>
              ) : (
                <p className="assignmentHelperText">
                  No assignment file uploaded yet.
                </p>
              )}

              <button
                className="assignmentActionButton"
                onClick={handleDownloadAssignmentFile}
                disabled={!assignmentAttachmentName}
              >
                Download Assignment File
              </button>
            </div>

            <div className="studentCard">
              <div className="assignmentSectionHeader">
                <h3>Group Submission</h3>
              </div>
              <p className="assignmentHelperText">
                One upload is shared for your group. Any group member can
                upload a new version.
              </p>

              {loadingSubmissionInfo ? (
                <p className="assignmentHelperText">
                  Checking current group submission...
                </p>
              ) : existingSubmission ? (
                <>
                  <p className="selectedFileName">
                    Current submitted file: {existingSubmission.file_name}
                  </p>
                  {existingSubmission.submitted_at && (
                    <p className="assignmentHelperText">
                      Submitted: {new Date(existingSubmission.submitted_at).toLocaleString()}
                    </p>
                  )}
                </>
              ) : (
                <p className="assignmentHelperText">
                  No group submission uploaded yet.
                </p>
              )}

              {!hasGroup && (
                <p className="assignmentHelperText">
                  You are not in a group yet. Join a group to enable
                  submission.
                </p>
              )}

              <input
                className="assignmentFileInput"
                type="file"
                onChange={handleSubmissionFileChange}
              />

              {submissionFile && (
                <p className="selectedFileName">
                  Selected file: {submissionFile.name}
                </p>
              )}

              <div className="assignmentButtonRow">
                <button
                  className="assignmentActionButton"
                  onClick={handleUploadSubmission}
                  disabled={!submissionFile || !hasGroup}
                >
                  Upload Group Submission
                </button>

                <button
                  className="assignmentSecondaryButton"
                  onClick={handleDownloadMySubmission}
                >
                  Download Group Submission
                </button>
              </div>
            </div>

            <div className="studentCard">
              <div className="assignmentSectionHeader">
                <h3>Peer Review</h3>
              </div>
              <p className="assignmentHelperText">
                Select one group member, choose rubric scores, then
                submit.
              </p>

              <div className="groupMembersList">
                {stuGroup
                  .filter(
                    (member) =>
                      typeof member.userID === "number" && member.userID > 0,
                  )
                  .map((member) => {
                    const isCurrentUser = member.userID === stuID;

                    return (
                      <label
                        key={member.userID}
                        className={`groupMemberOption ${
                          revieweeID === member.userID ? "selected" : ""
                        }`}
                      >
                        <input
                          type="radio"
                          value={member.userID}
                          name="groupMembers"
                          onChange={handleRadioChange}
                          disabled={isCurrentUser}
                        />
                        <span>{revieweeLabel(member.userID)}</span>
                      </label>
                    );
                  })}
              </div>

              <button
                className="assignmentActionButton"
                onClick={async () => {
                  if (revieweeID <= 0 || revieweeID === stuID) {
                    setSubmissionMessage(
                      "Please select a group member to review.",
                    );
                    return;
                  }

                  try {
                    setSubmissionMessage("");
                    const reviewResponse = await createReview(
                      assignmentId,
                      stuID,
                      revieweeID,
                    );
                    const reviewData = await reviewResponse.json();

                    const selectedByRow = new Map<number, number>();
                    for (const criterion of selectedCriteria) {
                      selectedByRow.set(criterion.row, criterion.column);
                    }

                    for (let rowIndex = 0; rowIndex < rubricCriteria.length; rowIndex++) {
                      const rubricCriterion = rubricCriteria[rowIndex];
                      const existingGrade =
                        typeof review[rowIndex] === "number"
                          ? review[rowIndex]
                          : null;
                      const grade = selectedByRow.get(rowIndex) ?? existingGrade;
                      const comments = (criterionComments[rowIndex] || "").trim();

                      if (grade === null && comments.length === 0) {
                        continue;
                      }

                      const criterionRowId =
                        typeof rubricCriterion.id === "number"
                          ? rubricCriterion.id
                          : rowIndex;

                      await createCriterion(
                        reviewData.id,
                        criterionRowId,
                        grade,
                        comments,
                      );
                    }

                    setSubmissionMessage(
                      "Review submitted successfully.",
                    );
                    setSelectedCriteria([]);
                    setCriterionComments({});
                  } catch (error) {
                    console.error("Error submitting review:", error);
                    setSubmissionMessage(
                      error instanceof Error
                        ? error.message
                        : "Failed to submit review",
                    );
                  }
                }}
              >
                Submit Review
              </button>
            </div>
          </div>
        )}

        {submissionMessage && (
          <div className="assignmentStatusMessage">
            {submissionMessage}
          </div>
        )}
      </div>
    </>
  );
}

