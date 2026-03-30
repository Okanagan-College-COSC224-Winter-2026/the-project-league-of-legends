import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { hasRole } from "../util/login";

const BASE_URL = "http://localhost:5000";

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: string[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
    const navigate = useNavigate();
    const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
    const allowedRolesKey = allowedRoles?.join(",") ?? "";

    useEffect(() => {
        ;(async () => {
            try {
                const response = await fetch(`${BASE_URL}/user`, {
                    method: "GET",
                    credentials: "include",
                });
                if (response.ok) {
                    if (allowedRoles && !hasRole(...allowedRoles)) {
                        setIsAuthed(false);
                        navigate("/home");
                        return;
                    }
                    setIsAuthed(true);
                } else {
                    setIsAuthed(false);
                    navigate("/");
                }
            } catch (error) {
                console.error("Error checking authentication:", error);
                setIsAuthed(false);
                navigate("/");
            }
        })();
    }, [navigate, allowedRoles, allowedRolesKey]);

    return isAuthed ? <>{children}</> : null;
}