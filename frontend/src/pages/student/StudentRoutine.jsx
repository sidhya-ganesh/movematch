// src/pages/student/StudentRoutine.jsx
// fix #1  — file validated via validateVideoFile before upload
// fix #5  — handles routine.status processing/failed before showing upload
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { createSubmission, pollJob, getSubmission } from "../../api/client";
import { Card, Btn, Mono, Bar, DropZone, C, DIFF_COLOR, Tag, Spinner } from "../../components";

export default function StudentRoutine({ routine, nav }) {
  const [step,      setStep]      = useState("idle");
  const [video,     setVideo]     = useState(null);
  const [progress,  setProgress]  = useState(0);
  const [progLabel, setProgLabel] = useState("");
  const [err,       setErr]       = useState("");

  async function submit() {
    if (!video) return setErr("Please select your practice video first.");
    setErr(""); setStep("processing");
    try {
      const sub = await createSubmission(routine.id, video);
      const stages = [
        [8,"Uploading video…"],[22,"Extracting pose keypoints…"],
        [45,"Running pose comparison…"],[68,"DTW alignment…"],
        [85,"Scoring your performance…"],[100,"Complete!"],
      ];
      let si = 0;
      const ticker = setInterval(()=>{
        if(si<stages.length-1){ si++; setProgress(stages[si][0]); setProgLabel(stages[si][1]); }
      }, 900);
      await pollJob(sub.job_id, (p)=>setProgress(p));
      clearInterval(ticker);
      const result = await getSubmission(sub.id);
      nav("results", { result, routine });
    } catch(e) {
      setStep("idle");
      setErr(e.message || "Processing failed — please try again.");
    }
  }

  // fix #5 — routine not yet ready
  if (routine?.status==="processing") return (
    <div style={{maxWidth:540,margin:"80px auto",padding:"0 24px",textAlign:"center"}}>
      <div style={{position:"relative",width:56,height:56,margin:"0 auto 20px"}}>
        <Spinner size={56} color={C.amber}/>
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>⏳</div>
      </div>
      <div style={{fontWeight:700,fontSize:20,color:C.text,marginBottom:8}}>Routine is being prepared</div>
      <p style={{color:C.sub,fontSize:14,lineHeight:1.75,marginBottom:24}}>
        Your teacher is still uploading and processing this routine. Check back in a few minutes — usually ready within 3 minutes.
      </p>
      <Btn variant="ghost" onClick={()=>nav("dashboard")}>← Back to Assignments</Btn>
    </div>
  );

  // fix #5 — routine processing failed
  if (routine?.status==="failed") return (
    <div style={{maxWidth:500,margin:"80px auto",padding:"0 24px",textAlign:"center"}}>
      <div style={{fontSize:40,marginBottom:16}}>⚠️</div>
      <div style={{fontWeight:700,fontSize:20,color:C.text,marginBottom:8}}>Routine unavailable</div>
      <p style={{color:C.sub,fontSize:14,lineHeight:1.75,marginBottom:24}}>This routine failed to process. Ask your teacher to re-upload it.</p>
      <Btn variant="ghost" onClick={()=>nav("dashboard")}>← Back to Assignments</Btn>
    </div>
  );

  const refVideoUrl = routine?.reference_video_url;

  return (
    <div style={{maxWidth:680,margin:"0 auto",padding:"48px 24px"}}>
      <button onClick={()=>nav("dashboard")} style={{background:"none",border:"none",cursor:"pointer",color:C.sub,fontSize:13,marginBottom:24,padding:0,display:"flex",alignItems:"center",gap:6,fontFamily:"'Syne',sans-serif"}}>← My Assignments</button>

      <Card glow={C.green} style={{marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
          <div style={{flex:1,paddingRight:12}}>
            <Mono color={C.green} style={{display:"block",marginBottom:6,letterSpacing:1}}>FROM: {routine?.teacher_name?.toUpperCase()}</Mono>
            <h1 style={{fontWeight:800,fontSize:26,letterSpacing:-.8,color:C.text,lineHeight:1.15}}>{routine?.name}</h1>
          </div>
          <Tag color={DIFF_COLOR[routine?.difficulty]}>{routine?.difficulty}</Tag>
        </div>
        {routine?.description&&<p style={{color:C.sub,fontSize:13,lineHeight:1.75,marginBottom:12}}>{routine.description}</p>}
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:C.green,boxShadow:`0 0 8px ${C.green}`}}/>
          <Mono color={C.green}>ACCEPTING SUBMISSIONS</Mono>
        </div>
      </Card>

      {/* Reference video FIRST */}
      <Card style={{marginBottom:20}}>
        <div style={{fontWeight:600,fontSize:11,color:C.sub,textTransform:"uppercase",letterSpacing:.8,marginBottom:12}}>Watch Reference Performance First</div>
        {refVideoUrl
          ? <video src={refVideoUrl} controls style={{width:"100%",borderRadius:10,border:`1px solid ${C.border}`,display:"block"}}/>
          : <div style={{width:"100%",aspectRatio:"16/9",borderRadius:10,background:C.dim,border:`1px solid ${C.border}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10}}>
              <div style={{fontSize:36}}>🎥</div>
              <div style={{fontWeight:700,fontSize:14,color:C.text}}>Reference Performance</div>
              <Mono color={C.muted} style={{display:"block",textAlign:"center",maxWidth:260,lineHeight:1.7}}>The teacher's reference video plays here once live.</Mono>
            </div>
        }
        <div style={{marginTop:12,padding:"11px 14px",borderRadius:8,background:C.greenDim,border:`1px solid ${C.green}25`}}>
          <div style={{fontSize:12,color:C.sub,lineHeight:1.7}}><strong style={{color:C.text}}>Study this carefully before recording.</strong> Pay attention to hand positions, knee alignment, and timing.</div>
        </div>
      </Card>

      {/* Upload — fix #1 validation is inside DropZone via validateVideoFile */}
      <Card>
        <div style={{fontWeight:700,fontSize:15,color:C.text,marginBottom:6}}>Upload Your Practice Video</div>
        <p style={{color:C.sub,fontSize:13,lineHeight:1.75,marginBottom:20}}>Film yourself performing the full routine with your whole body visible.</p>

        {step==="idle"&&(
          <>
            <div style={{marginBottom:16}}><DropZone onFile={setVideo} file={video}/></div>
            {err&&<div style={{color:C.red,fontSize:12,marginBottom:12}}>⚠ {err}</div>}
            <Btn full size="lg" disabled={!video} onClick={submit}
              style={{boxShadow:video?`0 0 20px ${C.green}33`:undefined,background:video?C.green:undefined,borderColor:video?C.green:undefined,color:video?C.bg:undefined}}>
              Analyse My Performance →
            </Btn>
          </>
        )}

        {step==="processing"&&(
          <div style={{padding:"20px 0",textAlign:"center"}}>
            <div style={{position:"relative",width:56,height:56,margin:"0 auto 20px"}}>
              <Spinner size={56} color={C.green}/>
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🤸</div>
            </div>
            <div style={{fontWeight:700,fontSize:17,color:C.text,marginBottom:6}}>Comparing poses…</div>
            <div style={{color:C.sub,fontSize:13,marginBottom:24,lineHeight:1.7}}>Your performance is being compared frame by frame.</div>
            <Bar value={progress} height={6} color={C.green}/>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}>
              <Mono color={C.muted}>{progLabel}</Mono>
              <Mono color={C.green} style={{fontWeight:700}}>{progress}%</Mono>
            </div>
          </div>
        )}
      </Card>

      {step==="idle"&&(
        <div style={{marginTop:14,padding:"16px 20px",borderRadius:12,background:C.dim,border:`1px solid ${C.border}`}}>
          <div style={{fontWeight:600,fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>Tips for best results</div>
          {[["📍","Plain background, no mirrors"],["💡","Well-lit room — avoid windows behind you"],["📱","Full body in frame from head to feet"],["🎬","Normal pace — timing differences handled automatically"]].map(([icon,text],i)=>(
            <div key={i} style={{display:"flex",gap:10,marginBottom:8,alignItems:"flex-start"}}>
              <span style={{fontSize:14,flexShrink:0}}>{icon}</span>
              <span style={{color:C.sub,fontSize:13,lineHeight:1.6}}>{text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
