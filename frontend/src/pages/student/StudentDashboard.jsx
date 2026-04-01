// src/pages/student/StudentDashboard.jsx
// fix #4  — history fetched from API not user object
// fix #6  — loading skeletons while data fetches
// fix #9  — class code prominently copyable
import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { listRoutines, mySubmissions, joinClass } from "../../api/client";
import { Card, Btn, Mono, Bar, Tag, C, DIFF_COLOR, sc, grade, ScoreRing } from "../../components";

function JoinClass({ onJoin }) {
  const [open,    setOpen]    = useState(false);
  const [code,    setCode]    = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function submit() {
    if (code.length !== 6) { setError("Enter the full 6-character code"); return; }
    setLoading(true); setError("");
    try {
      const res = await joinClass(code.toUpperCase());
      onJoin(res.teacher_name);
      setOpen(false);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  if (!open) return (
    <button onClick={()=>setOpen(true)} style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"4px 12px", borderRadius:20, background:C.amber+"18", border:`1px solid ${C.amber}40`, cursor:"pointer", fontSize:12, fontWeight:600, color:C.amber, fontFamily:"'Syne',sans-serif" }}>
      + Join a Class
    </button>
  );

  return (
    <div>
      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
        <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} maxLength={6} placeholder="CLASS CODE"
          style={{ padding:"8px 12px", borderRadius:8, border:`1px solid ${error?C.red+"60":C.amber+"50"}`, background:C.dim, color:C.text, fontSize:15, fontFamily:"'JetBrains Mono',monospace", letterSpacing:3, width:140, outline:"none" }}
          onKeyDown={e=>e.key==="Enter"&&submit()}/>
        <Btn size="sm" disabled={loading} onClick={submit} style={{ background:C.amber, borderColor:C.amber, color:C.bg }}>{loading?"…":"Join"}</Btn>
        <button onClick={()=>{setOpen(false);setError("");setCode("");}} style={{ background:"none", border:"none", cursor:"pointer", color:C.muted, fontSize:20, lineHeight:1 }}>×</button>
      </div>
      {error && <div style={{ fontSize:12, color:C.red, marginTop:5 }}>{error}</div>}
    </div>
  );
}

function SkeletonCard() {
  return <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:20, height:200, animation:"pulse 1.5s ease infinite" }}/>;
}

export default function StudentDashboard({ nav, onJoinClass }) {
  const { user } = useAuth();
  const [tab,      setTab]      = useState("assignments");
  const [routines, setRoutines] = useState([]);
  const [history,  setHistory]  = useState([]);
  const [hovId,    setHovId]    = useState(null);
  const [loading,  setLoading]  = useState(true);  // fix #6
  const [copied,   setCopied]   = useState(false);  // fix #9

  useEffect(() => {
    Promise.all([listRoutines(), mySubmissions()])   // fix #4
      .then(([r, s]) => { setRoutines(r); setHistory(s); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Best score per unique routine for chart
  const bestByRoutine = {};
  history.forEach(h => {
    const s = h.overall_score || 0;
    if (!bestByRoutine[h.routine_id] || s > (bestByRoutine[h.routine_id].overall_score||0))
      bestByRoutine[h.routine_id] = h;
  });
  const chartBars = Object.values(bestByRoutine);
  const bestScore   = history.length ? Math.max(...history.map(h => h.overall_score||0)) : null;
  const latestScore = history.length ? history[0].overall_score : null;

  function copyCode() {
    navigator.clipboard.writeText(user?.class_code || "");
    setCopied(true); setTimeout(()=>setCopied(false), 2000);
  }

  return (
    <div style={{ maxWidth:900, margin:"0 auto", padding:"0 24px 80px" }}>
      <div style={{ padding:"44px 0 28px" }}>
        <Mono color={C.green} style={{ display:"block", marginBottom:8, letterSpacing:1 }}>STUDENT DASHBOARD</Mono>
        <h1 style={{ fontWeight:800, fontSize:34, letterSpacing:-1.5, color:C.text, marginBottom:8 }}>
          Hey, {user?.name?.split(" ")[0]} 👋
        </h1>
        {/* fix #9 — class info + copy button, or join prompt */}
        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          {user?.teacher_name ? (
            <>
              <span style={{ fontSize:13, color:C.muted }}>Class:</span>
              <Tag color={C.green}>{user.teacher_name}</Tag>
              <Mono size={11} color={C.muted}>·</Mono>
              <Mono size={11} color={C.muted}>Code:</Mono>
              <code style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, letterSpacing:2, color:C.green, background:C.greenDim, padding:"2px 8px", borderRadius:5, border:`1px solid ${C.green}35` }}>{user.class_code}</code>
              <Btn variant={copied?"success":"ghost"} size="sm" onClick={copyCode}>{copied?"✓":"Copy"}</Btn>
            </>
          ) : (
            <JoinClass onJoin={onJoinClass}/>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:28 }}>
        {[
          { label:"Sessions Done",  value:history.length,                          color:C.accent, icon:"🎬" },
          { label:"Best Score",     value:bestScore   ? `${Math.round(bestScore)}%`   : "—", color:C.green,  icon:"⭐" },
          { label:"Latest Score",   value:latestScore ? `${Math.round(latestScore)}%` : "—", color:C.amber,  icon:"🎯" },
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
        {[["assignments","Assignments"],["history","My History"]].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} style={{ background:"none", border:"none", borderBottom:`2px solid ${tab===t?C.green:"transparent"}`, cursor:"pointer", padding:"10px 20px", fontSize:14, fontWeight:tab===t?700:500, color:tab===t?C.text:C.muted, fontFamily:"'Syne',sans-serif", transition:"all .15s", marginBottom:-1 }}>{l}</button>
        ))}
      </div>

      {/* Assignments */}
      {tab==="assignments" && (
        !user?.teacher_name
          ? <div style={{ textAlign:"center", padding:"52px 24px" }}>
              <div style={{fontSize:36,marginBottom:12}}>🏫</div>
              <div style={{fontSize:15,color:C.sub,marginBottom:8,fontWeight:600}}>You're not in a class yet</div>
              <div style={{fontSize:13,color:C.muted,marginBottom:24}}>Join your teacher's class to see assignments</div>
              <JoinClass onJoin={onJoinClass}/>
            </div>
          : loading
            ? <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))", gap:14 }}>
                {[1,2,3].map(i=><SkeletonCard key={i}/>)}  {/* fix #6 */}
              </div>
            : <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))", gap:14 }}>
                {routines.map((r,i) => {
                  const hov = hovId===r.id;
                  const myAttempts = history.filter(h=>h.routine_id===r.id);
                  const myBest = myAttempts.length ? Math.max(...myAttempts.map(h=>h.overall_score||0)) : null;
                  // fix #5 — show processing/failed state per card
                  const isProcessing = r.status==="processing";
                  const isFailed     = r.status==="failed";
                  return (
                    <div key={r.id}
                      onMouseEnter={()=>setHovId(r.id)} onMouseLeave={()=>setHovId(null)}
                      onClick={()=>!isProcessing&&!isFailed&&nav("routine",{routine:r})}
                      style={{ background:hov&&!isProcessing?C.cardHov:C.card, border:`1px solid ${hov&&!isProcessing?C.green+"55":C.border}`, borderRadius:16, padding:20, cursor:isProcessing||isFailed?"default":"pointer", transition:"all .18s", position:"relative", overflow:"hidden", opacity:isFailed?.6:1 }}>
                      <div style={{ position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${C.green},transparent)`,opacity:hov&&!isProcessing?.8:.15,transition:"opacity .18s" }}/>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                        <div style={{ fontSize:15, fontWeight:700, color:C.text, lineHeight:1.2, flex:1, paddingRight:8 }}>{r.name}</div>
                        <Tag color={DIFF_COLOR[r.difficulty]}>{r.difficulty}</Tag>
                      </div>
                      <div style={{ fontSize:11, color:C.muted, marginBottom:10 }}>by {r.teacher_name}</div>
                      <p style={{ color:C.sub, fontSize:12, lineHeight:1.7, marginBottom:14, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{r.description}</p>
                      {/* fix #5 — inline status */}
                      {isProcessing && <div style={{ textAlign:"center", padding:"10px 0", borderRadius:8, background:C.amber+"14", color:C.amber, fontWeight:600, fontSize:12, border:`1px solid ${C.amber}35` }}>⏳ Being prepared…</div>}
                      {isFailed     && <div style={{ textAlign:"center", padding:"10px 0", borderRadius:8, background:C.redDim, color:C.red, fontWeight:600, fontSize:12, border:`1px solid ${C.red}35` }}>⚠ Upload failed — ask your teacher</div>}
                      {!isProcessing && !isFailed && (
                        <>
                          {myBest!=null && (
                            <div style={{marginBottom:14}}>
                              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                                <span style={{fontSize:11,color:C.muted}}>Your best</span>
                                <Mono style={{fontWeight:700,color:sc(myBest)}}>{Math.round(myBest)}%</Mono>
                              </div>
                              <Bar value={myBest} color={sc(myBest)} height={4}/>
                              <div style={{fontSize:11,color:C.muted,marginTop:4}}>{myAttempts.length} attempt{myAttempts.length!==1?"s":""}</div>
                            </div>
                          )}
                          <div style={{ textAlign:"center", padding:"10px 0", borderRadius:8, background:hov?C.green:C.greenDim, color:hov?C.bg:C.green, fontWeight:700, fontSize:12, border:`1px solid ${C.green}${hov?"":"45"}`, transition:"all .18s" }}>
                            {myBest!=null?"Practice Again →":"Start Practising →"}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
      )}

      {/* History */}
      {tab==="history" && (
        loading
          ? <div style={{display:"flex",flexDirection:"column",gap:10}}>{[1,2,3].map(i=><div key={i} style={{height:64,background:C.card,borderRadius:12,animation:"pulse 1.5s ease infinite"}}/>)}</div>
          : history.length===0
            ? <div style={{textAlign:"center",padding:"52px 24px"}}><div style={{fontSize:36,marginBottom:12}}>🎬</div><div style={{fontSize:14,color:C.sub,marginBottom:4}}>No practice sessions yet</div><div style={{fontSize:12,color:C.muted}}>Submit your first practice video to start tracking progress</div></div>
            : <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {/* Best-per-routine chart */}
                {chartBars.length>0&&<Card style={{marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:16}}>
                    <div style={{fontWeight:700,fontSize:13,color:C.text}}>Best Score by Assignment</div>
                    <Mono color={C.muted} size={10}>{chartBars.length} assignment{chartBars.length!==1?"s":""}</Mono>
                  </div>
                  <div style={{display:"flex",alignItems:"flex-end",gap:10,height:90}}>
                    {chartBars.map(h=>{
                      const s=h.overall_score||0, c=sc(s);
                      const label=h.routine_name.split(" ").slice(0,2).join(" ");
                      return <div key={h.routine_id} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                        <Mono size={10} color={c} style={{fontWeight:700}}>{Math.round(s)}%</Mono>
                        <div style={{width:"100%",background:c,borderRadius:"4px 4px 0 0",height:`${(s/100)*72}px`,minHeight:4,boxShadow:`0 0 8px ${c}44`}}/>
                        <Mono size={9} color={C.muted} style={{textAlign:"center",maxWidth:56,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}</Mono>
                      </div>;
                    })}
                  </div>
                </Card>}

                {history.map((h,i)=>(
                  <div key={h.id}
                    onClick={()=>nav("results",{result:h, routine:routines.find(r=>r.id===h.routine_id)||{name:h.routine_name,teacher_name:user?.teacher_name,difficulty:"medium"}})}
                    style={{display:"grid",gridTemplateColumns:"1fr 80px 1fr 100px",gap:12,padding:"14px 16px",borderRadius:12,background:C.card,border:`1px solid ${C.border}`,cursor:"pointer",transition:"all .15s",alignItems:"center"}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=C.green+"55";e.currentTarget.style.background=C.cardHov;}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background=C.card;}}>
                    <div>
                      <div style={{fontWeight:600,fontSize:14,color:C.text,marginBottom:2}}>{h.routine_name}</div>
                      <div style={{fontSize:11,color:C.muted}}>by {user?.teacher_name}</div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:22,color:sc(h.overall_score||0)}}>{grade(h.overall_score||0)}</span>
                      <Mono size={11} color={C.muted}>{Math.round(h.overall_score||0)}%</Mono>
                    </div>
                    <div><Bar value={h.overall_score||0} color={sc(h.overall_score||0)} height={5}/></div>
                    <Mono size={11} color={C.muted}>{new Date(h.created_at*1000).toLocaleDateString()}</Mono>
                  </div>
                ))}
              </div>
      )}
    </div>
  );
}
