import { logout } from "../util/login";
import "./Header.css";

export default function Header() {
  const location = window.location.pathname;

  return (
    <div className="Header">
      <div className="HeaderRight">
        <a 
          href="/profile/1" 
          className={`HeaderLink ${location.includes("/profile") ? "active" : ""}`}
        >
          Profile
        </a>
        <button 
          className="HeaderLogout"
          onClick={() => logout()}
          title="Logout"
        >
          <img src="/icons/lo.png" alt="Logout" />
        </button>
      </div>
    </div>
  );
}
