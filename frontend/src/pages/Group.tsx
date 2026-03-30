// src/pages/Group.tsx

import { useEffect, useState } from "react";
import {
  createGroup,
  getNextGroupID,
  getUserId,
  listAssignmentMembers,
  listGroupMembers,
  listGroups,
  listStuGroup,
  listUnassignedGroups,
  saveGroups,
  deleteGroup,
} from "../util/api";
import { useParams } from "react-router-dom";
import "./Group.css";
import TabNavigation from "../components/TabNavigation";
import StatusMessage from "../components/StatusMessage";
import { isTeacher } from "../util/login";
import Textbox from "../components/Textbox";

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

  const [classMembers, setclassMembers] = useState<User[]>([]);
  const [stuGroup, setStuGroup] = useState<StudentGroups[]>([]);
  const [groups, setGroups] = useState<CourseGroup[]>([]);
  const [groupTable, setGroupTable] = useState<GroupTable>({});
  const [selectedGroup, setSelectedGroup] = useState<number>(-1);
  const [memberTable, setMemberTable] = useState<GroupTable>({});
  const [groupName, setGroupName] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState<"error" | "success">("error");

  const nameFromId = (userId: number) => {
    return classMembers.find((mem) => mem.id === userId)?.name || "N/A";
  };

  const randomize = () => {
    // remove every member from every group, save them
    const members: GroupTableValue[] = [];

    for (const group of Object.values(groupTable)) {
      for (const member of group) {
        const n = { ...member };
        n.groupID = -1;
        members.push(n);
      }
    }

    // Also grab the members from the unassigned table
    if (memberTable[-1]) {
      for (const member of memberTable[-1]) {
        const n = { ...member };
        n.groupID = -1;
        members.push(n);
      }
    }

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
    setMemberTable({});
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!id) return;

      const assignmentId = Number(id);

      if (!isTeacher()) {
        const stuId = await getUserId();
        if (cancelled) return;

        const stus = await listStuGroup(assignmentId, stuId);
        if (cancelled) return;
        setStuGroup(stus);
        return;
      }

      const classMembersResp = await listAssignmentMembers(assignmentId);
      if (cancelled) return;
      setclassMembers(classMembersResp);

      const groupsResp = await listGroups(assignmentId);
      if (cancelled) return;
      setGroups(groupsResp);

      const ua = await listUnassignedGroups(assignmentId);
      if (cancelled) return;

      const groupMembers: { [key: number]: GroupTableValue[] } = {};
      for (const g of groupsResp) {
        const members = await listGroupMembers(assignmentId, g.id);
        if (cancelled) return;
        groupMembers[g.id] = members;
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
      if (cancelled) return;
      setGroupTable(grLocal);

      // build a table for unassigned students
      const memLocal: GroupTable = {};
      memLocal[-1] = [];
      for (const stu of ua) {
        memLocal[-1].push(stu);
      }
      if (cancelled) return;
      setMemberTable(memLocal);
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

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
          }
        ]}
      />

      <StatusMessage message={statusMessage} type={statusType} />

      <div className="AssignmentPage">
        {isTeacher() ? (
          <>
            <div className="assignmentTables">
              <table className="table">
                <tbody>
                  <tr>
                    <th>Unassigned</th>
                  </tr>
                  {memberTable[-1]
                    ? memberTable[-1].map((ua) => (
                        <tr key={`ua-${ua.userID}`}>
                          <td>
                            <span className="StudentName">
                              {nameFromId(ua.userID)}
                            </span>
                          </td>
                          <td>
                            <button
                              onClick={() => {
                                const localMember = { ...memberTable };
                                const localGroup = { ...groupTable };

                                const memObj = localMember[-1].find(
                                  (mem) => ua.userID === mem.userID
                                );

                                if (!memObj || selectedGroup === -1) return;

                                localMember[-1] = localMember[-1].filter(
                                  (g) => memObj.userID !== g.userID
                                );
                                memObj.groupID = selectedGroup;

                                localGroup[selectedGroup] =
                                  localGroup[selectedGroup] || [];
                                localGroup[selectedGroup].push(memObj);

                                setMemberTable(localMember);
                                setGroupTable(localGroup);
                              }}
                            >
                              Move
                            </button>
                          </td>
                        </tr>
                      ))
                    : null}
                </tbody>
              </table>

              <table className="table">
                <tbody>
                  <tr>
                    <th>Groups</th>
                  </tr>

                  {Object.keys(groupTable).map((gId) => (
                    <>
                      <tr
                        key={`g-${gId}`}
                        className={
                          "groupNames " +
                          (Number(gId) === selectedGroup ? "selected" : "")
                        }
                        onClick={() => setSelectedGroup(Number(gId))}
                      >
                        <td>
                          <div className="GroupArrow">
                            <img src="/icons/arrow.svg" alt="arrow" />
                          </div>
                          {groups.find((gr) => gr.id === Number(gId))?.name}
                        </td>
                      </tr>

                      {selectedGroup !== -1 && selectedGroup === Number(gId)
                        ? groupTable[selectedGroup].map((stu) => (
                            <tr key={`m-${stu.userID}-${stu.groupID}`}>
                              <td>
                                <span className="StudentName">
                                  {nameFromId(stu.userID)}
                                </span>
                              </td>
                              <td>
                                <button
                                  onClick={() => {
                                    const localMember = { ...memberTable };
                                    const localGroup = { ...groupTable };

                                    const memObj = localGroup[selectedGroup].find(
                                      (mem) => stu.userID === mem.userID
                                    );
                                    if (!memObj) return;

                                    localGroup[selectedGroup] =
                                      localGroup[selectedGroup].filter(
                                        (g) => memObj.userID !== g.userID
                                      );

                                    memObj.groupID = -1;

                                    localMember[-1] = localMember[-1] || [];
                                    localMember[-1].push(memObj);

                                    setMemberTable(localMember);
                                    setGroupTable(localGroup);
                                  }}
                                >
                                  Move
                                </button>
                              </td>
                            </tr>
                          ))
                        : null}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <button
                onClick={() => {
                  const groupMems = Object.values(groupTable);
                  const uaMems = Object.values(memberTable);

                  for (const group of groupMems) {
                    for (const mem of group) {
                      saveGroups(mem.groupID, mem.userID, mem.assignmentID);
                    }
                  }
                  for (const group of uaMems) {
                    for (const mem of group) {
                      saveGroups(mem.groupID, mem.userID, mem.assignmentID);
                    }
                  }

                  setStatusType("success");
                  setStatusMessage("Changes saved!");
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
                onClick={() => {
                  if (selectedGroup === -1) return;
                  const localGroup = { ...groupTable };
                  delete localGroup[selectedGroup];
                  setGroupTable(localGroup);
                  deleteGroup(selectedGroup);
                  setStatusType("success");
                  setStatusMessage("Group deleted!");
                }}
              >
                Delete Selected Group
              </button>
            </div>

            <div>
              <button
                onClick={async () => {
                  if (!id) return;

                  // ✅ FIX: actually call getNextGroupID()
                  const nextIdResp = await getNextGroupID(Number(id));
                  const nextGid =
                    typeof nextIdResp === "number"
                      ? nextIdResp
                      : Number((nextIdResp as { id?: number })?.id ?? 0);

                  await createGroup(Number(id), groupName, Number(nextGid));
                  setStatusType("success");
                  setStatusMessage("Group created!");
                }}
              >
                Create New Group
              </button>

              <Textbox
                placeholder="group name"
                onInput={setGroupName}
                className="groupNameInput"
              />
            </div>
          </>
        ) : (
          <div className="assignment">
            <table className="studentTable">
              <tbody>
                <tr>
                  <th>My group</th>
                </tr>
                {stuGroup.map((stus) => (
                  <tr key={`sg-${stus.userID}`}>
                    <td>{stus.userID}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}