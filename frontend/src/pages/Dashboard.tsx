// src/pages/Dashboard.tsx
import { useEffect, useState } from "react";
import { maybeHandleExpire } from "../util/api";
import ClassCard from "../components/ClassCard";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../util/baseUrl";
import "./Dashboard.css";

const BASE_URL = "";

interface AssignmentData {
  id: number;
  name: string;
  due_date?: string | null;
}

interface ClassData {
  id: number;
  name: string;
  image_url?: string;
  assignments: AssignmentData[];
  students_count: number;
}

type DashboardAssignment = {
  assignment_id?: number;
  id?: number;
  name: string;
  due_date?: string | null;
};

type DashboardClass = {
  class_id: number;
  class_name: string;
  students_count?: number;
  assignments?: DashboardAssignment[];
};

type DashboardResponse = {
  dashboard?: DashboardClass[];
};

export default function Dashboard() {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [busy, setBusy] = useState<
    { type: "class" | "assignment"; id: number } | null
  >(null);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const resp = await fetch(apiUrl(`${BASE_URL}/dashboard`), {
          method: "GET",
          credentials: "include",
        });

        maybeHandleExpire(resp);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const json: DashboardResponse = await resp.json();

        const classData: ClassData[] = (json.dashboard ?? []).map((c) => ({
          id: c.class_id,
          name: c.class_name,
          image_url: "/oc_logo.png",
          students_count: Number(c.students_count ?? 0),
          assignments: (c.assignments ?? []).map((a) => ({
            id: a.id ?? a.assignment_id ?? 0,
            name: a.name,
            due_date: a.due_date ?? null,
          })),
        }));

        setClasses(classData);
      } catch (err) {
        console.error("Error fetching dashboard:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const deleteCourse = async (courseId: number) => {
    const ok = window.confirm("Delete this class? This cannot be undone.");
    if (!ok) return;

    setBusy({ type: "class", id: courseId });

    try {
      const resp = await fetch(
        apiUrl(`${BASE_URL}/class/delete_class/${courseId}`),
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      maybeHandleExpire(resp);

      const data: unknown = await resp.json().catch(() => null);
      const msg =
        typeof data === "object" && data && "msg" in data
          ? String((data as { msg: unknown }).msg)
          : null;

      if (!resp.ok) {
        alert(msg ?? `Delete class failed (HTTP ${resp.status})`);
        return;
      }

      setClasses((prev) => prev.filter((c) => c.id !== courseId));
    } catch (e) {
      console.error("Failed to delete class:", e);
      alert("Could not delete class (network/server error).");
    } finally {
      setBusy(null);
    }
  };

  const deleteAssignment = async (courseId: number, assignmentId: number) => {
    const ok = window.confirm("Delete this assignment? This cannot be undone.");
    if (!ok) return;

    setBusy({ type: "assignment", id: assignmentId });

    try {
      const resp = await fetch(
        apiUrl(`${BASE_URL}/assignment/delete_assignment/${assignmentId}`),
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      maybeHandleExpire(resp);

      const data: unknown = await resp.json().catch(() => null);
      const msg =
        typeof data === "object" && data && "msg" in data
          ? String((data as { msg: unknown }).msg)
          : null;

      if (!resp.ok) {
        alert(msg ?? `Delete assignment failed (HTTP ${resp.status})`);
        return;
      }

      setClasses((prev) =>
        prev.map((c) =>
          c.id === courseId
            ? {
                ...c,
                assignments: c.assignments.filter((a) => a.id !== assignmentId),
              }
            : c
        )
      );
    } catch (e) {
      console.error("Failed to delete assignment:", e);
      alert("Could not delete assignment (network/server error).");
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div>Loading dashboard...</div>;

  return (
    <div className="Dashboard">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <h1 style={{ margin: 0 }}>Dashboard</h1>

        <button
          type="button"
          onClick={() => setEditMode((v) => !v)}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid #444",
            background: editMode ? "#222" : "transparent",
            color: "inherit",
            cursor: "pointer",
          }}
        >
          {editMode ? "Done" : "Edit"}
        </button>
      </div>

      <div className="DashboardGrid">
        {classes.map((c) => (
          <div key={c.id}>
            <div
              onClick={() => {
                if (editMode) return;
                navigate(`/classes/${c.id}/home`);
              }}
              style={{ cursor: editMode ? "default" : "pointer" }}
            >
              <ClassCard
                image={c.image_url!}
                name={c.name}
                subtitle={`Assignments: ${c.assignments.length} | Students: ${c.students_count}`}
                onclick={() => {
                  if (editMode) return;
                  navigate(`/classes/${c.id}/home`);
                }}
              />
            </div>

            {editMode && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => deleteCourse(c.id)}
                  disabled={busy?.type === "class" && busy.id === c.id}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "1px solid #a33",
                    background: "#400000",
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  {busy?.type === "class" && busy.id === c.id
                    ? "Deleting..."
                    : "Delete Class"}
                </button>
              </div>
            )}

            {editMode && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #333",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  Assignments
                </div>

                {c.assignments.length === 0 ? (
                  <div style={{ opacity: 0.7 }}>No assignments</div>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {c.assignments.map((a) => (
                      <li
                        key={a.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 0",
                          borderTop: "1px solid #2a2a2a",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 500 }}>{a.name}</div>
                          {a.due_date && (
                            <div style={{ fontSize: 12, opacity: 0.75 }}>
                              Due: {new Date(a.due_date).toLocaleString()}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => deleteAssignment(c.id, a.id)}
                          disabled={
                            busy?.type === "assignment" && busy.id === a.id
                          }
                          style={{
                            padding: "6px 12px",
                            borderRadius: 8,
                            border: "1px solid #a33",
                            background: "#400000",
                            color: "white",
                            cursor: "pointer",
                          }}
                        >
                          {busy?.type === "assignment" && busy.id === a.id
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
