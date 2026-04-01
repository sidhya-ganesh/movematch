// src/pages/student/StudentPortal.jsx
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import StudentDashboard from "./StudentDashboard";
import StudentRoutine   from "./StudentRoutine";
import StudentResults   from "./StudentResults";

export default function StudentPortal() {
  const { updateUser } = useAuth();
  const [page,          setPage]          = useState("dashboard");
  const [activeRoutine, setActiveRoutine] = useState(null);
  const [activeResult,  setActiveResult]  = useState(null);

  function nav(p, extras={}) {
    window.scrollTo(0,0); setPage(p);
    if (extras.routine) setActiveRoutine(extras.routine);
    if (extras.result)  setActiveResult(extras.result);
  }

  return (
    <div style={{ minHeight:"100vh" }}>
      {page==="dashboard" && <StudentDashboard nav={nav} onJoinClass={(name)=>updateUser({teacher_name:name})}/>}
      {page==="routine"   && <StudentRoutine routine={activeRoutine} nav={nav}/>}
      {page==="results"   && <StudentResults result={activeResult} routine={activeRoutine} nav={nav}/>}
    </div>
  );
}
