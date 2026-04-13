import { Link, useLocation } from "react-router-dom";
import { logout, isAdmin, isTeacher } from "../util/login";
import "./Sidebar.css";

export default function Sidebar() {
  const location = useLocation().pathname;

  return (
    <div className="Sidebar">
      <div className="SidebarLogo">
        <img src="/oc_logo.png" alt="OC Logo" />
      </div>

      <div className="SidebarTop">
        <SidebarRow onClick={() => logout()} href="/" selected={false}>
          Logout
        </SidebarRow>
      </div>

      <div className="SidebarMiddle">
        <SidebarRow selected={location === "/home"} href="/home">
          Home
        </SidebarRow>
        {isTeacher() && (
          <SidebarRow selected={location === "/dashboard"} href="/dashboard">
            Dashboard
          </SidebarRow>
        )}

        {isTeacher() && (
        <SidebarRow selected={location === "/classes/create"} href="/classes/create">
          Create Class
        </SidebarRow>
        )}
      
      {isAdmin() && (
        <SidebarRow selected={location === "/create-teacher"} href="/create-teacher">
          Create Teacher
        </SidebarRow>
      )}

        {isAdmin() && (
          <SidebarRow
            selected={location === "/student-enrollment"}
            href="/student-enrollment"
          >
            Student Enrollment
          </SidebarRow>
        )}

        {isAdmin() && (
          <SidebarRow 
            selected={location === '/manage-users'} 
            href="/manage-users"
          >
            Manage Users
          </SidebarRow>
        )}

        <SidebarRow selected={location.includes("/profile")} href="/profile/1">
          My Info
        </SidebarRow>
        <SidebarRow
          selected={location === '/change-password'}
          href="/change-password"
        >
          Change Password
        </SidebarRow>
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
      <Link to={props.href}>{props.children}</Link>
    </div>
  );
}
