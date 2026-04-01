// src/context/AuthContext.jsx
// fix #4 — updateUser patch method so JoinClass can update teacher_name in-place
import { createContext, useContext, useState, useEffect } from "react";
import { getMe } from "../api/client";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem("mm_token");
    if (!t) { setLoading(false); return; }
    getMe()
      .then(setUser)
      .catch(() => localStorage.removeItem("mm_token"))
      .finally(() => setLoading(false));
  }, []);

  function login(authOut) {
    localStorage.setItem("mm_token", authOut.token);
    setUser({
      user_id:      authOut.user_id,
      name:         authOut.name,
      email:        authOut.email,
      role:         authOut.role,
      class_code:   authOut.class_code   ?? null,
      teacher_name: authOut.teacher_name ?? null,
    });
  }

  // Merge partial updates — used after join-class, profile edits, etc.
  function updateUser(patch) {
    setUser(u => u ? { ...u, ...patch } : u);
  }

  function logout() {
    localStorage.removeItem("mm_token");
    setUser(null);
  }

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() { return useContext(AuthCtx); }
