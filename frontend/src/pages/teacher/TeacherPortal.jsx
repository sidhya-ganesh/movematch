// src/pages/teacher/TeacherPortal.jsx
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import TeacherDashboard     from "./TeacherDashboard";
import TeacherUpload        from "./TeacherUpload";
import TeacherRoutineDetail from "./TeacherRoutineDetail";

export default function TeacherPortal() {
  const [page,          setPage]          = useState("dashboard");
  const [activeRoutine, setActiveRoutine] = useState(null);

  function nav(p, extras={}) {
    window.scrollTo(0,0);
    setPage(p);
    if (extras.routine) setActiveRoutine(extras.routine);
  }

  return (
    <div style={{ minHeight:"100vh" }}>
      {page==="dashboard" && <TeacherDashboard nav={nav}/>}
      {page==="upload"    && <TeacherUpload    nav={nav}/>}
      {page==="routine"   && <TeacherRoutineDetail routine={activeRoutine} nav={nav}/>}
    </div>
  );
}
