import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { jwtDecode } from "jwt-decode";
import apiClient from "../api/client";
import { storeAdminSession, clearAdminSession, notifyAdminSessionChanged, getStoredAdmin, isAuthTokenUsable } from "../lib/session";

interface AdminUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  profilePicture?: string;
  avatar?: string;
  [key: string]: unknown;
}

interface AuthContextType {
  admin: AdminUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("authToken"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = () => {
      const storedToken = localStorage.getItem("authToken");
      if (storedToken && isAuthTokenUsable(storedToken)) {
        try {
          const decoded = jwtDecode<Record<string, unknown>>(storedToken);
          const storedAdmin = getStoredAdmin();
          setAdmin(storedAdmin || {
            _id: decoded.sub as string || decoded._id as string || "",
            name: decoded.name as string || decoded.email as string || "Admin",
            email: decoded.email as string || "",
            role: decoded.role as string || "admin",
          });
          setToken(storedToken);
        } catch {
          clearAdminSession();
          setAdmin(null);
          setToken(null);
        }
      } else {
        clearAdminSession();
        setAdmin(null);
        setToken(null);
      }
      setLoading(false);
    };

    init();
    window.addEventListener("admin-auth-changed", init);
    return () => window.removeEventListener("admin-auth-changed", init);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiClient.post("/admin/login", { email, password });
    const newToken = data.token || data.accessToken;
    const adminData = data.admin || data.user || data;

    if (!newToken) throw new Error("No token received from server");

    storeAdminSession(newToken, adminData);
    setToken(newToken);
    setAdmin(adminData);
  }, []);

  const logout = useCallback(() => {
    clearAdminSession();
    notifyAdminSessionChanged();
    setAdmin(null);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ admin, token, loading, login, logout, isAuthenticated: !!token && !!admin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
