// src/App.jsx
import { useState } from "react";
import { useAuth } from "./context/AuthContext";
import { LoginPage, RegisterPage, ForgotPasswordPage } from "./pages/auth/AuthPages";
import TeacherPortal from "./pages/teacher/TeacherPortal";
import StudentPortal from "./pages/student/StudentPortal";

const GS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  body { background:#05060c; color:#dde1f5; -webkit-font-smoothing:antialiased; font-family:'Syne',sans-serif; }
  input,textarea,button,select { font-family:'Syne',sans-serif; }
  ::-webkit-scrollbar { width:4px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:#181b2e; border-radius:2px; }
  @keyframes spin    { to{transform:rotate(360deg)} }
  @keyframes fadeUp  { from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)} }
  @keyframes pulse   { 0%,100%{opacity:1}50%{opacity:.3} }
`;

const C = {
  bg:"#05060c", card:"#0d0f1a", border:"#181b2e",
  accent:"#6271ff", green:"#00d48c",
  text:"#dde1f5", sub:"#828aaa", muted:"#404468",
};

export default function App() {
  const { user, loading } = useAuth();
  const [role,     setRole]     = useState("student");
  const [authMode, setAuthMode] = useState("login");

  if (loading) return (
    <>
      <style>{GS}</style>
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.bg }}>
        <div style={{ width:36, height:36, borderRadius:"50%", border:"2.5px solid rgba(98,113,255,0.3)", borderTopColor:"#6271ff", animation:"spin .7s linear infinite" }}/>
      </div>
    </>
  );

  if (user) {
    return (
      <>
        <style>{GS}</style>
        {user.role === "teacher" ? <TeacherPortal /> : <StudentPortal />}
      </>
    );
  }

  // Role toggle rendered above every auth form
  const RoleToggle = () => (
    <div style={{ display:"flex", gap:8, marginBottom:28, padding:4, background:C.card, borderRadius:12, border:`1px solid ${C.border}` }}>
      {["teacher","student"].map(r => {
        const active = role === r;
        const col = r === "teacher" ? C.accent : C.green;
        return (
          <button key={r}
            onClick={() => { setRole(r); setAuthMode("login"); }}
            style={{
              flex:1, padding:"10px 0", borderRadius:9, cursor:"pointer",
              fontWeight:700, fontSize:12, letterSpacing:.5,
              background: active ? col+"18" : "transparent",
              color: active ? col : C.muted,
              border: `1px solid ${active ? col+"45" : "transparent"}`,
              transition:"all .15s", fontFamily:"'Syne',sans-serif",
            }}>
            {r === "teacher" ? "👩‍🏫 Teacher" : "🧑‍🎓 Student"}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      <style>{GS}</style>
      {authMode === "login"    && <LoginPage    role={role} RoleToggle={RoleToggle} onSwitch={()=>setAuthMode("register")} onForgot={()=>setAuthMode("forgot")}/>}
      {authMode === "register" && <RegisterPage role={role} RoleToggle={RoleToggle} onSwitch={()=>setAuthMode("login")}/>}
      {authMode === "forgot"   && <ForgotPasswordPage role={role} onBack={()=>setAuthMode("login")}/>}
    </>
  );
}
