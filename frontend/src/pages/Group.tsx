// src/pages/Group.tsx

import React, { useEffect, useState, useCallback } from "react";
import {
  createGroup,
  getNextGroupID,
  getUserId,
  listCourseMembers,
  listGroupMembers,
  listGroups,
  listStuGroup,
  saveGroups,
  deleteGroup,
  getAssignment,
  listUnassignedGroups,
} from "../util/api";
import { useParams } from "react-router-dom";
import "./Group.css";
import TabNavigation from "../components/TabNavigation";
import StatusMessage from "../components/StatusMessage";
import { hasRole } from "../util/login";
import Textbox from "../components/Textbox";

type GroupMemberApi = {
  userID?: number;
  id?: number;
  groupID?: number;
  assignmentID?: number;
};

type ApiError = {
  message?: string;
};

function fisherYates<T>(array: T[]): T[] {
  let m = array.length,
    t: T,
    i: number;

  while (m) {
    i = Math.floor(Math.random() * m--);
    t = array[m];
    array[m] = array[i];
    array[i] = t;
  }

  return array;
}

export default function Group() {
  const { id } = useParams();
  const canManageGroups = hasRole("teacher", "admin");

  const [classMembers, setclassMembers] = useState<User[]>([]);
  const [stuGroup, setStuGroup] = useState<StudentGroups[]>([]);
  const [groups, setGroups] = useState<CourseGroup[]>([]);
  const [groupTable, setGroupTable] = useState<GroupTable>({});
  const [selectedGroup, setSelectedGroup] = useState<number>(-1);
  const [memberTable, setMemberTable] = useState<GroupTable>({});
  const [groupName, setGroupName] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState<"error" | "success">("error");
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const nameFromId = (userId: number) => {
    return classMembers.find((mem) => mem.id === userId)?.name || "N/A";
  };

  const displayName = (userId: number) => {
    const name = nameFromId(userId);
    return currentUserId === userId ? `${name} (you)` : name;
  };

  const toggleExpand = (gId: number) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(gId)) {
        newSet.delete(gId);
      } else {
        newSet.add(gId);
      }
      return newSet;
    });
  };

  const randomize = () => {
    if (!id) return;

    const confirmed = window.confirm(
      "Randomizing will clear all current group assignments and reassign students randomly. Continue?"
    );

    if (!confirmed) return;

    // Rebuild from class roster so each student appears only once before assignment.
    const assignmentId = Number(id);
    const members: GroupTableValue[] = classMembers.map((member) => ({
      userID: member.id,
      groupID: -1,
      assignmentID: assignmentId,
    }));

    const groupCount = Object.keys(groupTable).length || 1;
    const membersPerGroup = members.length / groupCount;

    const gIds = Object.keys(groupTable);

    // Shuffle the array, then sequentially add them to groups
    const shuffled = fisherYates([...members]);
    const newTable: GroupTable = {};

    let i = 0;
    for (const group of gIds) {
      for (let j = 0; j < membersPerGroup; j++) {
        const g = Number(group);
        const member = shuffled[i];
        i++;

        // This will make a false entry if the amount of total people is uneven
        if (!member) break;

        const n = { ...member };
        n.groupID = Number(group);

        newTable[g] = newTable[g] || [];
        newTable[g].push(n);
      }
    }

    setGroupTable(newTable);
    // Randomize assigns students directly into groups in local state.
    // Clear the unassigned table so names do not appear in both places.
    setMemberTable({ [-1]: [] });

    setStatusType("success");
    setStatusMessage("Groups cleared and randomized. Click Confirm Changes to save.");
  };

  const loadData = useCallback(async (cancelled: () => boolean) => {
    if (!id) return;

    const assignmentResp = await getAssignment(Number(id));
    if (cancelled()) return;
    const courseId = assignmentResp.course.id;

    const classMembersResp = await listCourseMembers(String(courseId));
    if (cancelled()) return;
    setclassMembers(classMembersResp);

    const groupsResp = await listGroups(Number(id));
    if (cancelled()) return;
    setGroups(groupsResp);

    let unassigned: GroupTableValue[] = [];
    if (canManageGroups) {
      const ua = await listUnassignedGroups(Number(id));
      if (cancelled()) return;

      // Normalize backend user objects to frontend GroupTableValue shape
      unassigned = (ua || []).map((user: GroupMemberApi) => ({
        userID: user.userID ?? user.id,
        groupID: user.groupID ?? -1,
        assignmentID: Number(id),
      }));
    }

    const stuId = await getUserId();
    if (cancelled()) return;
    setCurrentUserId(stuId);

    const stus = await listStuGroup(Number(id), stuId);
    if (cancelled()) return;
    setStuGroup(
      (stus || []).map((stu: GroupMemberApi) => ({
        userID: stu.userID ?? stu.id,
        groupID: stu.groupID ?? -1,
        assignmentID: Number(id),
      }))
    );

    if (canManageGroups) {
      const groupMembers: { [key: number]: GroupTableValue[] } = {};
      for (const g of groupsResp) {
        const members = await listGroupMembers(Number(id), g.id);
        if (cancelled()) return;
        // Convert returned user objects to GroupTableValue format
        groupMembers[g.id] = (members || []).map((user: GroupMemberApi) => ({
          userID: user.userID ?? user.id,
          groupID: g.id,
          assignmentID: Number(id),
        }));
      }

      const grLocal: GroupTable = {};
      // build a table of group names and students
      for (const gr of groupsResp) {
        grLocal[gr.id] = [];
        for (const stu of groupMembers[gr.id]) {
          if (stu.groupID === gr.id) {
            grLocal[gr.id].push(stu);
          }
        }
      }
      if (cancelled()) return;
      setGroupTable(grLocal);
      setExpandedGroups(new Set(Object.keys(grLocal).map(Number)));

      // build a table for unassigned students
      const memLocal: GroupTable = {};
      memLocal[-1] = [];
      for (const stu of unassigned) {
        memLocal[-1].push(stu);
      }
      if (cancelled()) return;
      setMemberTable(memLocal);
    }
  }, [id, canManageGroups]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await loadData(() => cancelled);
    })();

    return () => {
      cancelled = true;
    };
  }, [loadData]);

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
          }
        ]}
      />

      <StatusMessage message={statusMessage} type={statusType} />

      {canManageGroups && classMembers.length === 0 && (
        <div style={{
          backgroundColor: "var(--background-secondary)",
          padding: "1rem",
          margin: "1rem 0",
          borderRadius: "4px",
          textAlign: "center"
        }}>
          <p>No students are enrolled in this course yet.</p>
          <p>
            Go to{" "}
            <a
              href={`/classes/${id}/members`}
              style={{ color: "var(--accent-color)" }}
            >
              Class Members
            </a>{" "}
            to enroll students via CSV upload.
          </p>
        </div>
      )}

      <div className="AssignmentPage">
        {canManageGroups && <div>
          <button
            onClick={async () => {
              // Build a map of user -> final group assignment
              const userToGroup: Record<number, { groupID: number; assignmentID: number }> = {};

              // First, apply group assignments (highest precedence)
              for (const group of Object.values(groupTable)) {
                for (const mem of group) {
                  userToGroup[mem.userID] = {
                    groupID: mem.groupID,
                    assignmentID: mem.assignmentID,
                  };
                }
              }

              // Then fill in any remaining users from memberTable (unassigned)
              for (const group of Object.values(memberTable)) {
                for (const mem of group) {
                  if (!userToGroup[mem.userID]) {
                    userToGroup[mem.userID] = {
                      groupID: mem.groupID,
                      assignmentID: mem.assignmentID,
                    };
                  }
                }
              }

              try {
                setStatusType("success");
                setStatusMessage("Saving...");

                // Send updates for every student exactly once
                for (const [userID, { groupID, assignmentID }] of Object.entries(
                  userToGroup
                )) {
                  await saveGroups(groupID, Number(userID), assignmentID);
                }

                setStatusType("success");
                setStatusMessage("Changes saved!");

                // Reload data to reflect changes
                const cancelled = false;
                await loadData(() => cancelled);
              } catch (err: unknown) {
                const error = err as ApiError;
                setStatusType("error");
                setStatusMessage(error.message || "Failed to save changes");
              }
            }}
          >
            Confirm Changes
          </button>

          <button
            style={{ backgroundColor: "var(--background-tertiary)" }}
            onClick={randomize}
          >
            Randomize
          </button>

          <button
            className="delete-group-btn"
            onClick={async () => {
              if (selectedGroup === -1) return;

              try {
                await deleteGroup(selectedGroup);
                setStatusType("success");
                setStatusMessage("Group deleted!");

                // Reload data to reflect changes
                const cancelled = false;
                await loadData(() => cancelled);
              } catch (err: unknown) {
                const error = err as ApiError;
                setStatusType("error");
                setStatusMessage(error.message || "Failed to delete group");
              }
            }}
          >
            Delete Selected Group
          </button>

          <button
            onClick={async () => {
              if (!id) return;

              // derive a temporary ID for front‑end state
              const nextIdResp = await getNextGroupID(Number(id));
              const nextGid =
                typeof nextIdResp === "number"
                  ? nextIdResp
                  : Number((nextIdResp as { id?: number })?.id ?? 0);

              try {
                const result = await createGroup(Number(id), groupName, Number(nextGid));
                setStatusType("success");
                setStatusMessage(result.msg || "Group created!");

                // Reload all data so names and groups are in sync
                const cancelled = false;
                await loadData(() => cancelled);
              } catch (err: unknown) {
                const error = err as ApiError;
                setStatusType("error");
                setStatusMessage(error.message || "Failed to create group");
              }
            }}
          >
            Create New Group
          </button>

          <Textbox
            placeholder="group name"
            onInput={setGroupName}
            className="groupNameInput"
          />
        </div>}

        <div>

        </div>
        {canManageGroups ? (
          <>
            <div className="assignmentTables">
              <table className="table">
                <tbody>
                  <tr>
                    <th>Students</th>
                  </tr>
                  {memberTable[-1] && memberTable[-1].length > 0
                    ? memberTable[-1].map((ua) => (
                      <tr key={`ua-${ua.userID}`}>
                        <td>
                          <span className="StudentName">
                            {displayName(ua.userID)}
                            <button
                              onClick={() => {
                                const localGroup = { ...groupTable };
                                const newMemberTable = { ...memberTable };

                                const memObj = memberTable[-1].find(
                                  (mem) => ua.userID === mem.userID
                                );

                                if (!memObj || selectedGroup === -1) return;

                                // Check if already in the selected group
                                if (localGroup[selectedGroup]?.some(mem => mem.userID === memObj.userID)) {
                                  return; // Already in this group
                                }

                                // Remove from any other group
                                for (const gId in localGroup) {
                                  localGroup[gId] = localGroup[gId].filter(
                                    (mem) => mem.userID !== memObj.userID
                                  );
                                }

                                // Add to selected group
                                const updatedMember = {
                                  ...memObj,
                                  groupID: selectedGroup,
                                };
                                localGroup[selectedGroup] =
                                  localGroup[selectedGroup] || [];
                                localGroup[selectedGroup].push(updatedMember);

                                // Remove from unassigned students table
                                newMemberTable[-1] = (newMemberTable[-1] || []).filter(
                                  (mem) => mem.userID !== updatedMember.userID
                                );

                                setGroupTable(localGroup);
                                setMemberTable(newMemberTable);
                              }}
                            >
                              Add
                            </button>
                          </span>
                        </td>
                      </tr>
                    ))
                    : classMembers.length > 0 && (
                      <tr>
                        <td style={{ textAlign: "center", padding: "1rem", color: "var(--text-secondary)" }}>
                          All students are assigned to groups
                        </td>
                      </tr>
                    )}
                </tbody>
              </table>

              <table className="table">
                <tbody>
                  <tr>
                    <th>Groups</th>
                  </tr>

                  {Object.keys(groupTable).map((gId) => {
                    const groupIdNum = Number(gId);
                    const isSelected = groupIdNum === selectedGroup;
                    const isExpanded = expandedGroups.has(groupIdNum);

                    return (
                      <React.Fragment key={`group-${gId}`}>
                        <tr
                          className={
                            "groupNames " +
                            (isSelected ? "selected " : "") +
                            (isExpanded ? "expanded" : "")
                          }
                        >
                          <td onClick={() => setSelectedGroup(groupIdNum)}>
                            <div
                              className="GroupArrow"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(groupIdNum);
                              }}
                            >
                              <img src="/icons/arrow.svg" alt="arrow" />
                            </div>
                            <span className="groupLabel">
                              {groups.find((gr) => gr.id === groupIdNum)?.name}
                            </span>
                          </td>
                        </tr>

                        {isExpanded
                          ? groupTable[groupIdNum].map((stu) => (
                            <tr key={`m-${stu.userID}-${stu.groupID}`}>
                              <td>
                                <span className="StudentName">
                                  {displayName(stu.userID)}
                                  <button
                                    className="remove-btn"
                                    title="Remove from group"
                                    onClick={() => {
                                      const localGroup = { ...groupTable };
                                      localGroup[groupIdNum] = localGroup[groupIdNum].filter(
                                        (mem) => mem.userID !== stu.userID
                                      );

                                      const memObj = { ...stu, groupID: -1 };
                                      const newMemberTable = { ...memberTable };
                                      const alreadyUnassigned = (
                                        newMemberTable[-1] || []
                                      ).some((mem) => mem.userID === memObj.userID);

                                      if (!alreadyUnassigned) {
                                        newMemberTable[-1] = [
                                          ...(newMemberTable[-1] || []),
                                          memObj,
                                        ];
                                      }

                                      setGroupTable(localGroup);
                                      setMemberTable(newMemberTable);
                                    }}
                                  >
                                    ×
                                  </button>
                                </span>
                              </td>
                            </tr>
                          ))
                          : null}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>


          </>
        ) : (
          <div className="assignment">
            <div className="assignmentTables">
              {(() => {
                if (stuGroup.length === 0) return <p>You are not assigned to a group yet.</p>;
                const groupID = stuGroup[0].groupID;
                if (groupID === -1) return <p>You are not assigned to a group yet.</p>;
                // Defensive: all groupIDs must match and not be -1
                if (!stuGroup.every(stu => stu.groupID === groupID && groupID !== -1)) {
                  return <p>You are not assigned to a group yet.</p>;
                }
                return (
                  <table className="table">
                    <tbody>
                      <tr>
                        <th>
                          Your Group: {groups.find((g) => g.id === groupID)?.name || "Unknown Group"}
                        </th>
                      </tr>
                      {stuGroup.map((stu) => (
                        <tr key={`stu-${stu.userID}`}>
                          <td>
                            <span className="StudentName">
                              {displayName(stu.userID)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </>
  );
}