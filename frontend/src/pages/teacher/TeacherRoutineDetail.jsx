// src/pages/teacher/TeacherRoutineDetail.jsx
// fix #7  — archive/unarchive toggle on routine
// fix #8  — submission 'failed' state shown in table
// fix #12 — shows processing indicator if routine still processing
import { useState, useEffect } from "react";
import { listSubmissions, mediaUrl, archiveRoutine, unarchiveRoutine } from "../../api/client";
import { Card, Btn, Mono, Bar, Tag, C, DIFF_COLOR, Spinner } from "../../components";
import ResultsView from "../../components/ResultsView";

const sc    = v => v >= 80 ? C.green : v >= 62 ? C.amber : C.red;
const grade = v => v >= 93 ? "S" : v >= 83 ? "A" : v >= 72 ? "B" : v >= 58 ? "C" : "D";
const ARM_KEYS = ["left_wrist","right_wrist","left_elbow","right_elbow","left_shoulder","right_shoulder"];
const LEG_KEYS = ["left_knee","right_knee","left_ankle","right_ankle"];

function avg(joints, keys) {
  const v = keys.map(k=>joints?.[k]).filter(x=>x!=null);
  return v.length ? Math.round(v.reduce((a,b)=>a+b)/v.length) : null;
}

export default function TeacherRoutineDetail({ routine: initialRoutine, nav }) {
  const [routine,     setRoutine]     = useState(initialRoutine);
  const [submissions, setSubmissions] = useState([]);
  const [activeSub,   setActiveSub]   = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [archiving,   setArchiving]   = useState(false);

  useEffect(() => {
    if (!routine?.id) return;
    listSubmissions(routine.id)
      .then(setSubmissions)
      .catch(console.error)
      .finally(()=>setLoading(false));
  }, [routine?.id]);

  // fix #7 — archive toggle
  async function toggleArchive() {
    setArchiving(true);
    try {
      if (routine.archived) {
        await unarchiveRoutine(routine.id);
        setRoutine(r=>({...r, archived:false}));
      } else {
        await archiveRoutine(routine.id);
        setRoutine(r=>({...r, archived:true}));
      }
    } catch(e) { console.error(e); }
    finally { setArchiving(false); }
  }

  if (activeSub) return (
    <div style={{ maxWidth:840, margin:"0 auto", padding:"48px 24px 80px" }}>
      <button onClick={()=>setActiveSub(null)} style={{ background:"none",border:"none",cursor:"pointer",color:C.sub,fontSize:13,marginBottom:24,padding:0,display:"flex",alignItems:"center",gap:6,fontFamily:"'Syne',sans-serif" }}>← Back to submissions</button>
      <div style={{marginBottom:24}}>
        <Mono color={C.accent} style={{display:"block",marginBottom:6,letterSpacing:1}}>STUDENT SUBMISSION</Mono>
        <h2 style={{fontWeight:800,fontSize:24,color:C.text,marginBottom:4}}>{activeSub.student_name}</h2>
        <div style={{color:C.muted,fontSize:13}}>{routine.name} · {new Date(activeSub.created_at*1000).toLocaleDateString()}</div>
      </div>
      {/* fix #8 — failed submission view */}
      {activeSub.status==="failed"
        ? <Card style={{textAlign:"center",padding:40}}>
            <div style={{fontSize:36,marginBottom:12}}>⚠️</div>
            <div style={{fontWeight:700,fontSize:16,color:C.text,marginBottom:8}}>This submission failed to process</div>
            <div style={{color:C.sub,fontSize:13,lineHeight:1.75}}>{activeSub.error||"Unknown error during pose extraction."}</div>
          </Card>
        : <ResultsView submission={activeSub} isTeacherView={true}/>
      }
    </div>
  );

  return (
    <div style={{ maxWidth:800, margin:"0 auto", padding:"48px 24px 80px" }}>
      <button onClick={()=>nav("dashboard")} style={{ background:"none",border:"none",cursor:"pointer",color:C.sub,fontSize:13,marginBottom:24,padding:0,display:"flex",alignItems:"center",gap:6,fontFamily:"'Syne',sans-serif" }}>← Dashboard</button>

      <Card glow={C.accent} style={{marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
          <div>
            <Mono color={C.accent} style={{display:"block",marginBottom:6,letterSpacing:1}}>TEACHER VIEW</Mono>
            <h1 style={{fontWeight:800,fontSize:26,letterSpacing:-.8,color:C.text}}>{routine?.name}</h1>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
            <Tag color={DIFF_COLOR[routine?.difficulty]}>{routine?.difficulty}</Tag>
            {/* fix #7 — archive toggle */}
            <Btn variant={routine?.archived?"warn":"ghost"} size="sm" disabled={archiving} onClick={toggleArchive}>
              {archiving ? "…" : routine?.archived ? "Unarchive" : "Archive"}
            </Btn>
          </div>
        </div>
        {routine?.description&&<p style={{color:C.sub,fontSize:13,lineHeight:1.75,marginBottom:14}}>{routine.description}</p>}

        {/* fix #12 — processing state on detail page */}
        {routine?.status==="processing" && (
          <div style={{padding:"10px 14px",borderRadius:8,background:C.amberDim,border:`1px solid ${C.amber}35`,display:"flex",alignItems:"center",gap:10}}>
            <Spinner size={14} color={C.amber}/>
            <div>
              <Mono color={C.amber} size={12} style={{fontWeight:700}}>Pose extraction in progress</Mono>
              <div style={{fontSize:11,color:C.muted,marginTop:2}}>Students can't submit yet — usually takes 1–3 minutes</div>
            </div>
            {routine?.job_progress!=null&&<div style={{marginLeft:"auto",flex:1,maxWidth:120}}><Bar value={routine.job_progress} color={C.amber} height={4}/></div>}
          </div>
        )}
        {routine?.status==="ready" && (
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:C.green,boxShadow:`0 0 8px ${C.green}`}}/>
            <Mono color={C.green}>ACCEPTING SUBMISSIONS</Mono>
            <Mono color={C.muted}>·</Mono>
            <Mono>{submissions.length} submission{submissions.length!==1?"s":""}</Mono>
          </div>
        )}
        {routine?.status==="failed" && (
          <div style={{display:"flex",alignItems:"center",gap:6}}><Mono color={C.red}>⚠ Processing failed — re-upload this routine</Mono></div>
        )}
        {routine?.archived && (
          <div style={{marginTop:10,padding:"8px 12px",borderRadius:8,background:C.amberDim,border:`1px solid ${C.amber}30`,fontSize:12,color:C.amber}}>
            This routine is archived — hidden from students. Unarchive to make it available again.
          </div>
        )}
      </Card>

      {/* Reference video */}
      <Card style={{marginBottom:20}}>
        <div style={{fontWeight:600,fontSize:11,color:C.sub,textTransform:"uppercase",letterSpacing:.8,marginBottom:12}}>Your Reference Video</div>
        {routine?.reference_video_url
          ? <video src={mediaUrl(routine.reference_video_url)} controls style={{width:"100%",borderRadius:10,border:`1px solid ${C.border}`,display:"block"}}/>
          : <div style={{width:"100%",aspectRatio:"16/9",borderRadius:10,background:C.dim,border:`1px solid ${C.border}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10}}>
              <div style={{fontSize:36}}>🎥</div>
              <Mono color={C.muted} style={{display:"block",textAlign:"center"}}>Reference video plays here once uploaded to storage</Mono>
            </div>
        }
      </Card>

      {/* Submissions */}
      <Card>
        <div style={{fontWeight:700,fontSize:15,color:C.text,marginBottom:submissions.length?4:0}}>
          Student Submissions
          {submissions.length>0&&<span style={{fontWeight:400,fontSize:13,color:C.muted,marginLeft:8}}>— click any row to view full results</span>}
        </div>

        {loading
          ? <div style={{textAlign:"center",padding:"32px 0",color:C.muted}}>Loading…</div>
          : submissions.length===0
            ? <div style={{textAlign:"center",padding:"40px 0"}}>
                <div style={{fontSize:36,marginBottom:10}}>📭</div>
                <div style={{fontSize:14,color:C.sub,marginBottom:4}}>No submissions yet</div>
                <div style={{fontSize:12,color:C.muted}}>Students submit from their Assignments tab in the Student Portal</div>
              </div>
            : <div style={{marginTop:16}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 100px 1fr 100px",gap:12,padding:"0 12px 10px",borderBottom:`1px solid ${C.border}`}}>
                  {["Student","Score","Body Analysis","Submitted"].map(h=><Mono key={h} size={10} color={C.muted} style={{textTransform:"uppercase",letterSpacing:.8}}>{h}</Mono>)}
                </div>
                {submissions.map(sub=>{
                  const isFailed = sub.status==="failed";
                  const isPending = sub.status==="processing";
                  const c = sc(sub.overall_score||0);
                  const armA = avg(sub.joint_scores, ARM_KEYS);
                  const legA = avg(sub.joint_scores, LEG_KEYS);
                  return (
                    <div key={sub.id} onClick={()=>setActiveSub(sub)}
                      style={{display:"grid",gridTemplateColumns:"1fr 100px 1fr 100px",gap:12,padding:"14px 12px",borderRadius:10,marginTop:8,background:C.dim,border:`1px solid ${isFailed?C.red+"35":C.border}`,cursor:"pointer",transition:"all .15s",alignItems:"center"}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent+"55";e.currentTarget.style.background=C.cardHov;}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=isFailed?C.red+"35":C.border;e.currentTarget.style.background=C.dim;}}>
                      <div style={{fontWeight:600,fontSize:14,color:C.text}}>{sub.student_name}</div>

                      {/* fix #8 — failed/pending shown in score column */}
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        {isFailed  && <Mono size={11} color={C.red}>Failed</Mono>}
                        {isPending && <><Spinner size={12} color={C.amber}/><Mono size={11} color={C.amber}>Pending</Mono></>}
                        {!isFailed&&!isPending&&<>
                          <span style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:20,color:c}}>{grade(sub.overall_score||0)}</span>
                          <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:C.muted}}>{Math.round(sub.overall_score||0)}%</span>
                        </>}
                      </div>

                      <div style={{display:"flex",flexDirection:"column",gap:4}}>
                        {[["Arms",armA],["Legs",legA]].map(([l,a])=>(
                          <div key={l} style={{display:"flex",gap:6,alignItems:"center"}}>
                            <span style={{fontSize:10,color:C.muted,width:28}}>{l}</span>
                            <div style={{flex:1}}><Bar value={a??0} color={sc(a??0)} height={4}/></div>
                            <Mono size={10} color={sc(a??0)} style={{fontWeight:700,width:26,textAlign:"right"}}>{a??"-"}%</Mono>
                          </div>
                        ))}
                      </div>
                      <Mono size={11} color={C.muted}>{new Date(sub.created_at*1000).toLocaleDateString()}</Mono>
                    </div>
                  );
                })}
              </div>
        }
      </Card>
    </div>
  );
}
