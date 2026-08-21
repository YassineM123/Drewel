import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { clearAdminSession, isAuthTokenUsable, notifyAdminSessionChanged } from "../utils/session";
import apiClient from "../api/client";

const AuthContext = createContext(null);

const readStoredAdmin = () => {
  try {
    return JSON.parse(localStorage.getItem("admin") || "null");
  } catch {
    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredAdmin);

  const refresh = useCallback(() => {
    const token = localStorage.getItem("authToken");
    setUser(isAuthTokenUsable(token) ? readStoredAdmin() : null);
  }, []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("admin-auth-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("admin-auth-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, [refresh]);

  const signOut = useCallback(() => {
    // Capture the token explicitly: clearAdminSession() below runs synchronously,
    // but axios reads the token via an interceptor microtask that would otherwise
    // fire after localStorage has already been wiped, sending the request unauthenticated.
    const token = localStorage.getItem("authToken");
    if (token) {
      apiClient.post("/admin/logout", undefined, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    }
    clearAdminSession();
    setUser(null);
    window.location.href = "/login";
  }, []);

  const role = String(user?.role || "").trim().toLowerCase();

  const value = {
    user,
    role,
    isAuthenticated: Boolean(user),
    refresh,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

export { notifyAdminSessionChanged };
