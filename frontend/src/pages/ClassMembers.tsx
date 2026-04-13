// src/pages/ClassMembers.tsx
import { useParams } from "react-router-dom";
import TabNavigation from "../components/TabNavigation";
import { useEffect, useState } from "react";
import { importCSV } from "../util/csv";
import { listCourseMembers, listClasses } from "../util/api";

import "./ClassMembers.css";
import { isTeacher } from "../util/login";

type Member = {
  id: number;
  name: string;
  email?: string | null;
  role?: string | null;
};

type Course = {
  id: number;
  name: string;
};

export default function ClassMembers() {
  const { id } = useParams();

  const [members, setMembers] = useState<Member[]>([]);
  const [className, setClassName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMembers = async (cancelled = false) => {
      setError(null);

      if (!id) {
        setMembers([]);
        setClassName(null);
        return;
      }

      try {
        const [membersResp, classesResp] = await Promise.all([
          listCourseMembers(id),
          listClasses(),
        ]);

        if (cancelled) return;

        const classes = classesResp as Course[];
        const currentClass = classes.find((c) => c.id === Number(id));

        setMembers(membersResp as Member[]);
        setClassName(currentClass?.name || null);
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        setError("Failed to load class members");
        setMembers([]);
        setClassName(null);
      }
    };

  useEffect(() => {
    let cancelled = false;

    loadMembers(cancelled);

    return () => {
      cancelled = true;
    };
  }, [id]);
  
  return (
    <>
      <div className="ClassHeader">
        <div className="ClassHeaderLeft">
          <h2>{className}</h2>
        </div>
      </div>

      <TabNavigation
        tabs={[
          {
            label: "Home",
            path: `/classes/${id}/home`,
          },
          {
            label: "Members",
            path: `/classes/${id}/members`,
          },
        ]}
      />

      {isTeacher() ? (
        <div className="ClassMembersPageActions">
          <button
            className="ClassMembersCsvButton"
            onClick={() =>
              importCSV(id as string, { onSuccess: () => loadMembers(false) })
            }
          >
            Add Students via CSV
          </button>
        </div>
      ) : null}

      <div className="ClassMemberList">
        {error ? <div className="Member">{error}</div> : null}

        {members.map((member) => (
          <div key={member.id} className="Member">
            {member.name} 
          </div>
        ))}
      </div>
    </>
  );
}
