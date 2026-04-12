import { useEffect, useState, useCallback } from "react";
import ClassCard from "../components/ClassCard";

import "./Home.css";
import { listAssignments, searchCourses } from "../util/api";

export default function Home() {
  const [allCourses, setAllCourses] = useState<CourseWithAssignments[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<
    CourseWithAssignments[]
  >([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  // Fetch all courses with assignments on mount
  useEffect(() => {
    (async () => {
      try {
        const searchResults = await searchCourses("");

        const coursesWithAssignments = await Promise.all(
          searchResults.map(async (course: CourseSearchResult) => {
            try {
              const assignments = await listAssignments(String(course.id));
              return {
                id: course.id,
                name: course.name,
                teacherID: course.teacherID,
                teacher_name: course.teacher_name,
                assignments: assignments || [],
                assignmentCount: assignments?.length || 0,
              };
            } catch (error) {
              console.error(
                `Error fetching assignments for course ${course.id}:`,
                error,
              );
              return {
                id: course.id,
                name: course.name,
                teacherID: course.teacherID,
                teacher_name: course.teacher_name,
                assignments: [],
                assignmentCount: 0,
              };
            }
          }),
        );

        setAllCourses(coursesWithAssignments);
        setFilteredCourses(coursesWithAssignments);
      } catch (error) {
        console.error("Error fetching courses:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Debounced search — filter via API when query changes
  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setFilteredCourses(allCourses);
        return;
      }
      setSearching(true);
      try {
        const results = await searchCourses(q);
        const matchedIds = new Set(
          results.map((r: CourseSearchResult) => r.id),
        );
        setFilteredCourses(allCourses.filter((c) => matchedIds.has(c.id)));
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setSearching(false);
      }
    },
    [allCourses],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      doSearch(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  if (loading) {
    return (
      <div className="Home">
        <h1>Peer Review Dashboard</h1>
        <p>Loading courses...</p>
      </div>
    );
  }

  return (
    <div className="Home">
      <h1>Peer Review Dashboard</h1>

      <div className="CourseSearchBar">
        <input
          type="text"
          className="CourseSearchInput"
          placeholder="Search courses by name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button
            className="CourseSearchClear"
            onClick={() => setQuery("")}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {searching && <p className="SearchingIndicator">Searching...</p>}

      {!searching && query && filteredCourses.length === 0 && (
        <p className="NoCoursesFound">No courses found for "{query}".</p>
      )}

      <div className="Classes">
        {filteredCourses.map((course) => {
          const assignmentText = `${course.assignmentCount || 0} assignments`;

          return (
            <ClassCard
              key={course.id}
              image="https://crc.losrios.edu//shared/img/social-1200-630/programs/general-science-social.jpg"
              name={course.name}
              subtitle={assignmentText}
              onclick={() => {
                window.location.href = `/classes/${course.id}/home`;
              }}
            />
          );
        })}

      </div>
    </div>
  );
}
