// src/pages/teacher/TeacherUpload.jsx
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { createRoutine, pollJob } from "../../api/client";
import { Card, Btn, Mono, Bar, DropZone, C, inputStyle } from "../../components";

export default function TeacherUpload({ nav }) {
  const { user } = useAuth();
  const [step,       setStep]      = useState("form");
  const [video,      setVideo]     = useState(null);
  const [form,       setF]         = useState({ name:"", difficulty:"medium", description:"" });
  const [progress,   setProgress]  = useState(0);
  const [progLabel,  setProgLabel] = useState("Uploading…");
  const [errors,     setErrors]    = useState({});
  const [newRoutine, setNewRoutine] = useState(null);
  const [copied,     setCopied]    = useState(false);
  const [apiError,   setApiError]  = useState("");

  function set(k, v) { setF(f => ({...f,[k]:v})); setErrors(e => ({...e,[k]:null})); }

  const LABELS = ["Extracting frames…","Running pose analysis…","Aligning keypoints…","Saving pose data…","Done!"];

  async function submit() {
    const e = {};
    if (!video)            e.video = "Select a video file";
    if (!form.name.trim()) e.name  = "Routine name required";
    setErrors(e);
    if (Object.keys(e).length) return;
    setApiError("");
    setStep("processing");
    try {
      const r = await createRoutine(video, form);
      await new Promise(res => setTimeout(res, 1500));
      await pollJob(r.job_id, (p) => {
        setProgress(p);
        setProgLabel(LABELS[Math.min(Math.floor(p / 25), LABELS.length - 1)]);
      });
      setNewRoutine(r);
      setStep("done");
    } catch(err) {
      setApiError(err.message);
      setStep("form");
    }
  }

  if (step === "processing") return (
    <div style={{maxWidth:460,margin:"0 auto",padding:"100px 24px",textAlign:"center"}}>
      <div style={{position:"relative",width:72,height:72,margin:"0 auto 28px"}}>
        <div style={{width:72,height:72,borderRadius:"50%",border:`2.5px solid ${C.accent}30`,borderTopColor:C.accent,animation:"spin .7s linear infinite"}}/>
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>🎬</div>
      </div>
      <div style={{fontWeight:800,fontSize:22,color:C.text,marginBottom:8}}>Processing video</div>
      <div style={{color:C.sub,fontSize:13,marginBottom:32,lineHeight:1.8}}>Extracting pose data from every frame. Usually 1–3 minutes.</div>
      <Bar value={progress} height={6}/>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}>
        <Mono color={C.muted}>{progLabel}</Mono>
        <Mono color={C.accent} style={{fontWeight:700}}>{progress}%</Mono>
      </div>
    </div>
  );

  if (step === "done" && newRoutine) return (
    <div style={{maxWidth:520,margin:"0 auto",padding:"80px 24px",textAlign:"center"}}>
      <div style={{width:64,height:64,borderRadius:"50%",background:C.greenDim,border:`1px solid ${C.green}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 24px"}}>✅</div>
      <div style={{fontWeight:800,fontSize:26,color:C.text,marginBottom:8}}>Routine is live!</div>
      <div style={{color:C.sub,fontSize:14,marginBottom:36,lineHeight:1.8}}>Pose data extracted. Students in your class can now submit practice videos.</div>
      <Card glow={C.accent} style={{marginBottom:16,textAlign:"left"}}>
        <div style={{fontWeight:600,fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>Students access via your class code</div>
        <p style={{fontSize:13,color:C.sub,lineHeight:1.75,marginBottom:14}}>
          Students sign in at the <strong style={{color:C.text}}>Student Portal</strong> and enter:
        </p>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <code style={{flex:1,padding:"14px",borderRadius:8,background:C.dim,border:`1px solid ${C.accent}35`,fontSize:22,color:C.accent,fontFamily:"'JetBrains Mono',monospace",letterSpacing:5,textAlign:"center",fontWeight:700}}>
            {user?.class_code}
          </code>
          <Btn variant={copied?"success":"ghost"} size="sm" onClick={()=>{navigator.clipboard.writeText(user?.class_code||"");setCopied(true);setTimeout(()=>setCopied(false),2000);}}>
            {copied?"✓ Copied":"Copy"}
          </Btn>
        </div>
      </Card>
      <div style={{display:"flex",gap:12,justifyContent:"center"}}>
        <Btn variant="ghost" onClick={()=>{setStep("form");setVideo(null);setF({name:"",difficulty:"medium",description:""});}}>Upload Another</Btn>
        <Btn onClick={()=>nav("routine",{routine:newRoutine})}>View Submissions →</Btn>
      </div>
    </div>
  );

  return (
    <div style={{maxWidth:580,margin:"0 auto",padding:"48px 24px"}}>
      <button onClick={()=>nav("dashboard")} style={{background:"none",border:"none",cursor:"pointer",color:C.sub,fontSize:13,marginBottom:24,padding:0,display:"flex",alignItems:"center",gap:6,fontFamily:"'Syne',sans-serif"}}>← Dashboard</button>
      <Mono color={C.accent} style={{display:"block",marginBottom:6,letterSpacing:1}}>NEW ROUTINE</Mono>
      <h1 style={{fontWeight:800,fontSize:30,letterSpacing:-1,color:C.text,marginBottom:32}}>Upload Reference Video</h1>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <Card>
          <div style={{fontWeight:600,fontSize:11,color:C.sub,textTransform:"uppercase",letterSpacing:.8,marginBottom:12}}>Reference Video</div>
          <DropZone onFile={setVideo} file={video}/>
          {errors.video && <div style={{color:C.red,fontSize:12,marginTop:8}}>⚠ {errors.video}</div>}
        </Card>
        <Card>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div>
              <div style={{fontWeight:600,fontSize:11,color:C.sub,textTransform:"uppercase",letterSpacing:.8,marginBottom:7}}>Routine Name <span style={{color:C.red}}>*</span></div>
              <input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Aramandi Basics — Week 3" style={inputStyle(errors.name)}/>
              {errors.name && <div style={{color:C.red,fontSize:12,marginTop:4}}>⚠ {errors.name}</div>}
            </div>
            <div>
              <div style={{fontWeight:600,fontSize:11,color:C.sub,textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>Difficulty</div>
              <div style={{display:"flex",gap:8}}>
                {["easy","medium","hard"].map(d => {
                  const sel = form.difficulty === d;
                  const col = {easy:C.green,medium:C.amber,hard:C.red}[d];
                  return <button key={d} onClick={()=>set("difficulty",d)} style={{flex:1,padding:"9px 0",borderRadius:8,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:10,letterSpacing:1.5,background:sel?col+"20":"transparent",color:sel?col:C.muted,border:`1px solid ${sel?col+"55":C.border}`,transition:"all .15s"}}>{d.toUpperCase()}</button>;
                })}
              </div>
            </div>
            <div>
              <div style={{fontWeight:600,fontSize:11,color:C.sub,textTransform:"uppercase",letterSpacing:.8,marginBottom:7}}>Description</div>
              <textarea value={form.description} onChange={e=>set("description",e.target.value)} placeholder="What should students focus on?" rows={3} style={{...inputStyle(false),resize:"vertical"}}/>
            </div>
          </div>
        </Card>
        {apiError && <div style={{padding:"12px 14px",borderRadius:8,background:C.redDim,border:`1px solid ${C.red}35`,color:C.red,fontSize:13}}>⚠ {apiError}</div>}
        <Btn full size="lg" onClick={submit} style={{boxShadow:`0 0 20px ${C.accent}33`}}>Upload & Process →</Btn>
      </div>
    </div>
  );
}
