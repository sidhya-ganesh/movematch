// src/pages/teacher/TeacherDashboard.jsx
// fix #6  — loading skeleton while routines fetch
// fix #9  — class code large + prominent + copyable at the top
// fix #11 — "My Students" section shows class roster with submission counts
// fix #12 — routines with status 'processing' show progress bar inline

import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { listRoutines, classRoster } from "../../api/client";
import { Card, Btn, Mono, Bar, Tag, C, DIFF_COLOR, Spinner } from "../../components";

export default function TeacherDashboard({ nav }) {
  const { user }    = useAuth();
  const [routines,  setRoutines]  = useState([]);
  const [students,  setStudents]  = useState([]);
  const [hovId,     setHovId]     = useState(null);
  const [loading,   setLoading]   = useState(true);   // fix #6
  const [tab,       setTab]       = useState("routines"); // routines | students
  const [copied,    setCopied]    = useState(false);   // fix #9

  useEffect(() => {
    Promise.all([listRoutines(), classRoster()])   // fix #11
      .then(([r, s]) => { setRoutines(r); setStudents(s); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalSubs = routines.reduce((a,r)=>a+(r.submission_count||0), 0);
  const allScores = routines.flatMap(r=>[]); // would come from submissions in full impl
  const scoreColor = v => v>=80?C.green:v>=62?C.amber:C.red;
  const grade = v => v>=93?"S":v>=83?"A":v>=72?"B":v>=58?"C":"D";

  function copyCode() {
    navigator.clipboard.writeText(user?.class_code || "");
    setCopied(true); setTimeout(()=>setCopied(false), 2000);
  }

  return (
    <div style={{ maxWidth:1040, margin:"0 auto", padding:"0 24px 80px" }}>
      {/* Header */}
      <div style={{ padding:"44px 0 28px" }}>
        <Mono color={C.accent} style={{ display:"block", marginBottom:8, letterSpacing:1 }}>TEACHER DASHBOARD</Mono>
        <h1 style={{ fontWeight:800, fontSize:34, letterSpacing:-1.5, color:C.text, marginBottom:20 }}>
          Welcome back, {user?.name?.split(" ")[0]}
        </h1>

        {/* fix #9 — class code prominent card */}
        <div style={{ display:"flex", alignItems:"center", gap:16, padding:"16px 20px", borderRadius:12, background:C.accentDim, border:`1px solid ${C.accent}35`, flexWrap:"wrap" }}>
          <div>
            <div style={{ fontSize:11, color:C.accent, fontWeight:600, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Your Class Code</div>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:32, fontWeight:700, color:C.accent, letterSpacing:6 }}>
              {user?.class_code}
            </div>
          </div>
          <div style={{ flex:1, minWidth:200 }}>
            <p style={{ color:C.sub, fontSize:13, lineHeight:1.7, marginBottom:10 }}>
              Share this with your students. They enter it when signing up at the Student Portal to join your class.
            </p>
            <Btn variant={copied?"success":"ghosthi"} size="sm" onClick={copyCode}>
              {copied ? "✓ Copied!" : "Copy Code"}
            </Btn>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:28 }}>
        {[
          { label:"Routines",          value:routines.length, color:C.accent, icon:"📚" },
          { label:"Total Submissions", value:totalSubs,       color:C.green,  icon:"🎬" },
          { label:"Students",          value:students.length, color:C.purple, icon:"🧑‍🎓" },
        ].map(({label,value,color,icon})=>(
          <Card key={label} glow={color}>
            <div style={{fontSize:22,marginBottom:8}}>{icon}</div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:28,color,marginBottom:4}}>{value}</div>
            <div style={{fontSize:12,color:C.muted,textTransform:"uppercase",letterSpacing:.8}}>{label}</div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:0, marginBottom:20, borderBottom:`1px solid ${C.border}` }}>
        {[["routines","My Routines"],["students","My Students"]].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} style={{ background:"none", border:"none", borderBottom:`2px solid ${tab===t?C.accent:"transparent"}`, cursor:"pointer", padding:"10px 20px", fontSize:14, fontWeight:tab===t?700:500, color:tab===t?C.text:C.muted, fontFamily:"'Syne',sans-serif", transition:"all .15s", marginBottom:-1 }}>{l}</button>
        ))}
      </div>

      {/* Routines tab */}
      {tab==="routines" && (
        <>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <Mono color={C.muted} size={11} style={{ textTransform:"uppercase", letterSpacing:1 }}>All Routines</Mono>
            <Btn size="sm" onClick={()=>nav("upload")}>+ New Routine</Btn>
          </div>

          {/* fix #6 — loading skeleton */}
          {loading
            ? <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {[1,2,3].map(i=><div key={i} style={{height:72,background:C.card,borderRadius:12,animation:"pulse 1.5s ease infinite"}}/>)}
              </div>
            : <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {routines.map((r,i)=>{
                  const hov=hovId===r.id;
                  // fix #12 — processing state inline
                  const isProcessing = r.status==="processing";
                  const isFailed     = r.status==="failed";
                  return (
                    <div key={r.id}
                      onMouseEnter={()=>setHovId(r.id)} onMouseLeave={()=>setHovId(null)}
                      onClick={()=>!isProcessing&&nav("routine",{routine:r})}
                      style={{ padding:"16px 20px", borderRadius:12, background:hov&&!isProcessing?C.cardHov:C.card, border:`1px solid ${hov&&!isProcessing?C.accent+"50":isFailed?C.red+"40":C.border}`, cursor:isProcessing?"default":"pointer", transition:"all .15s" }}>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 120px 130px 130px 100px", gap:12, alignItems:"center" }}>
                        <div>
                          <div style={{fontWeight:700,fontSize:15,color:C.text,marginBottom:3}}>{r.name}</div>
                          <div style={{fontSize:12,color:C.muted}}>{r.description?.slice(0,55)}…</div>
                        </div>
                        <Tag color={DIFF_COLOR[r.difficulty]}>{r.difficulty}</Tag>

                        {/* fix #12 */}
                        <div>
                          {isProcessing && (
                            <div>
                              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                                <Spinner size={12} color={C.amber}/>
                                <Mono size={11} color={C.amber}>Processing…</Mono>
                              </div>
                              {r.job_progress!=null && <Bar value={r.job_progress} color={C.amber} height={3}/>}
                            </div>
                          )}
                          {isFailed && <Mono size={11} color={C.red}>⚠ Failed</Mono>}
                          {!isProcessing && !isFailed && (
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              <div style={{width:6,height:6,borderRadius:"50%",background:C.green,boxShadow:`0 0 8px ${C.green}`}}/>
                              <Mono color={C.green} size={11}>READY</Mono>
                            </div>
                          )}
                        </div>

                        <div style={{textAlign:"center"}}>
                          <div style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:20,color:(r.submission_count||0)>0?C.text:C.muted}}>{r.submission_count||0}</div>
                          <div style={{fontSize:11,color:C.muted}}>submissions</div>
                        </div>
                        <div style={{textAlign:"right",color:C.accent,fontSize:13,fontWeight:600,opacity:hov&&!isProcessing?1:0,transition:"opacity .15s"}}>View →</div>
                      </div>
                    </div>
                  );
                })}
                {routines.length===0&&<div style={{textAlign:"center",padding:"52px 24px",color:C.muted}}><div style={{fontSize:36,marginBottom:12}}>📭</div><div style={{fontSize:14,color:C.sub,marginBottom:16}}>No routines yet</div><Btn onClick={()=>nav("upload")}>Upload your first routine</Btn></div>}
              </div>
          }
        </>
      )}

      {/* Students tab — fix #11 */}
      {tab==="students" && (
        loading
          ? <div style={{display:"flex",flexDirection:"column",gap:10}}>{[1,2,3].map(i=><div key={i} style={{height:56,background:C.card,borderRadius:12,animation:"pulse 1.5s ease infinite"}}/>)}</div>
          : students.length===0
            ? <div style={{textAlign:"center",padding:"52px 24px"}}>
                <div style={{fontSize:36,marginBottom:12}}>🧑‍🎓</div>
                <div style={{fontSize:14,color:C.sub,marginBottom:8,fontWeight:600}}>No students yet</div>
                <div style={{fontSize:13,color:C.muted,maxWidth:320,margin:"0 auto"}}>Share your class code above with students. They enter it when they sign up.</div>
              </div>
            : <>
                <div style={{display:"grid",gridTemplateColumns:"1fr 160px 120px 120px",gap:12,padding:"0 16px 10px",borderBottom:`1px solid ${C.border}`,marginBottom:8}}>
                  {["Student","Joined","Submissions",""].map(h=><Mono key={h} size={10} color={C.muted} style={{textTransform:"uppercase",letterSpacing:.8}}>{h}</Mono>)}
                </div>
                {students.map(s=>(
                  <div key={s.user_id} style={{display:"grid",gridTemplateColumns:"1fr 160px 120px 120px",gap:12,padding:"14px 16px",borderRadius:10,background:C.card,border:`1px solid ${C.border}`,marginBottom:8,alignItems:"center"}}>
                    <div>
                      <div style={{fontWeight:600,fontSize:14,color:C.text}}>{s.name}</div>
                      <div style={{fontSize:11,color:C.muted}}>{s.email}</div>
                    </div>
                    <Mono size={11} color={C.muted}>{new Date(s.joined*1000).toLocaleDateString()}</Mono>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:16,color:s.submission_count>0?C.text:C.muted}}>{s.submission_count}</span>
                      <Mono size={11} color={C.muted}>submission{s.submission_count!==1?"s":""}</Mono>
                    </div>
                    <div/>
                  </div>
                ))}
              </>
      )}
    </div>
  );
}
