import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import TabNavigation from "../components/TabNavigation";
import { getAssignment, getReceivedReviews, listCourseMembers } from "../util/api";
import { isAdmin, isTeacher } from "../util/login";
import "./Assignment.css";
import "./AssignmentReviews.css";

interface ReceivedCriterion {
  id: number;
  criterionRowID: number;
  question: string | null;
  grade: number | null;
  comments: string | null;
}

interface ReceivedReview {
  id: number;
  reviewerID: number;
  revieweeID: number;
  reviewerName: string;
  criteria: ReceivedCriterion[];
}

interface ReceivedReviewsPayload {
  assignmentID: number;
  revieweeID: number;
  reviews: ReceivedReview[];
}

export default function AssignmentReviews() {
  const { id } = useParams();
  const assignmentId = Number(id);

  const [classMembers, setClassMembers] = useState<User[]>([]);
  const [assignmentName, setAssignmentName] = useState("Assignment");
  const [selectedRevieweeId, setSelectedRevieweeId] = useState<number | null>(null);
  const [payload, setPayload] = useState<ReceivedReviewsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canChooseReviewee = isTeacher() || isAdmin();

  const studentMembers = useMemo(
    () => classMembers.filter((member) => member.role === "student"),
    [classMembers]
  );

  useEffect(() => {
    if (!Number.isFinite(assignmentId)) {
      return;
    }

    (async () => {
      try {
        const assignment = await getAssignment(assignmentId);
        setAssignmentName(
          typeof assignment?.name === "string" && assignment.name.trim().length > 0
            ? assignment.name
            : "Assignment"
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load assignment");
      }
    })();
  }, [assignmentId]);

  useEffect(() => {
    if (!canChooseReviewee || !Number.isFinite(assignmentId)) {
      return;
    }

    (async () => {
      try {
        const assignment = await getAssignment(assignmentId);
        const courseId = assignment?.course?.id;
        if (typeof courseId !== "number") {
          setClassMembers([]);
          setSelectedRevieweeId(null);
          return;
        }

        const members = await listCourseMembers(String(courseId));
        setClassMembers(members);

        const firstStudent = members.find((member: User) => member.role === "student");
        setSelectedRevieweeId(firstStudent?.id ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load class members");
      }
    })();
  }, [assignmentId, canChooseReviewee]);

  useEffect(() => {
    if (!Number.isFinite(assignmentId)) {
      return;
    }

    if (canChooseReviewee && selectedRevieweeId === null) {
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setError("");

        const response = await getReceivedReviews(
          assignmentId,
          canChooseReviewee ? selectedRevieweeId ?? undefined : undefined
        );
        setPayload(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load received reviews");
        setPayload(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [assignmentId, canChooseReviewee, selectedRevieweeId]);

  return (
    <>
      <div className="AssignmentHeader">
        <h2>{assignmentName}</h2>
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
            <h3>Received Reviews</h3>
          </div>

          {canChooseReviewee && (
            <div className="receivedReviewsControls">
              <label htmlFor="reviewee-select" className="receivedReviewsLabel">
                View reviews for student
              </label>
              <select
                id="reviewee-select"
                className="receivedReviewsSelect"
                value={selectedRevieweeId ?? ""}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setSelectedRevieweeId(Number.isNaN(value) ? null : value);
                }}
              >
                {studentMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {loading && <p>Loading reviews...</p>}
          {!loading && error && <p className="assignmentHelperText">{error}</p>}

          {!loading && !error && payload && payload.reviews.length === 0 && (
            <p className="assignmentHelperText">No reviews found yet.</p>
          )}

          {!loading && !error && payload && payload.reviews.length > 0 && (
            <div className="receivedReviewsList">
              {payload.reviews.map((review) => (
                <article key={review.id} className="receivedReviewCard">
                  <header className="receivedReviewHeader">
                    <p className="receivedReviewReviewer">Reviewer: {review.reviewerName}</p>
                  </header>

                  <div className="receivedCriteriaList">
                    {review.criteria.length === 0 ? (
                      <p className="assignmentHelperText">No criteria scored yet.</p>
                    ) : (
                      review.criteria.map((criterion) => (
                        <section
                          key={`${review.id}-${criterion.criterionRowID}`}
                          className="receivedCriterionCard"
                        >
                          <p className="receivedCriterionQuestion">
                            {criterion.question || "Criterion"}
                          </p>

                          <div className="receivedCriterionMeta">
                            <span className="receivedCriterionLabel">Score</span>
                            <span className="receivedCriterionValue receivedCriterionScore">
                              {criterion.grade ?? "No score"}
                            </span>
                          </div>

                          <div className="receivedCriterionMeta">
                            <span className="receivedCriterionLabel">Comment</span>
                            <span className="receivedCriterionValue">
                              {criterion.comments && criterion.comments.trim().length > 0
                                ? criterion.comments
                                : "No comment"}
                            </span>
                          </div>
                        </section>
                      ))
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
