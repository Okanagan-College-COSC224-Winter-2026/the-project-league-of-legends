import { logout, isAdmin, isTeacher } from "../util/login";
import "./Sidebar.css";

export default function Sidebar() {
  // Check which page we are on
  const location = window.location.pathname;

  return (
    <div className="Sidebar">
      <div className="SidebarLogo">
        <img src="/oc_logo.png" alt="OC Logo" />
      </div>

      <div className="SidebarTop">
        <SidebarRow onClick={() => logout()} href="#" selected={false}>
          Logout
        </SidebarRow>

        <SidebarRow selected={location === "/home"} href="/home">
          Home
        </SidebarRow>
        {isTeacher() && (
          <SidebarRow selected={location === "/dashboard"} href="/dashboard">
            Dashboard
          </SidebarRow>
        )}

        {isTeacher() && (
          <SidebarRow
            selected={location === "/assignment-progress"}
            href="/assignment-progress"
          >
            Assignment Progress
          </SidebarRow>
        )}

        {isTeacher() && (
          <SidebarRow
            selected={location === "/classes/create"}
            href="/classes/create"
          >
            Create Class
          </SidebarRow>
        )}

        {isAdmin() && (
          <SidebarRow
            selected={location === "/admin/create-teacher"}
            href="/admin/create-teacher"
          >
            Student Enrollment
          </SidebarRow>
        )}

        <SidebarRow selected={location.includes("/profile")} href="/profile/1">
          My Info
        </SidebarRow>
        <SidebarRow
          selected={location === "/change-password"}
          href="/change-password"
        >
          Change Password
        </SidebarRow>

        {isAdmin() && (
          <SidebarRow
            selected={location === "/admin/users"}
            href="/admin/users"
          >
            Manage Users
          </SidebarRow>
        )}
      </div>
    </div>
  );
}

interface SidebarRowProps {
  selected: boolean;
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
}

function SidebarRow(props: SidebarRowProps) {
  return (
    <div
      className={`SidebarRow ${props.selected ? "selected" : ""}`}
      onClick={props.onClick}
    >
      <a href={props.selected ? "#" : props.href}>{props.children}</a>
    </div>
  );
}
