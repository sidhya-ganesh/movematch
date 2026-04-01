// src/pages/student/StudentResults.jsx
// fix #8  — handles submission.status === 'failed' with retry
// fix #13 — uses overlay_url from server if present, canvas fallback only if null
import { useState, useEffect } from "react";
import { getSubmission } from "../../api/client";
import { Mono, Btn, Tag, C, DIFF_COLOR, Spinner } from "../../components";
import ResultsView from "../../components/ResultsView";

export default function StudentResults({ result, routine, nav }) {
  const [submission, setSubmission] = useState(result?.joint_scores ? result : null);
  const [loading,    setLoading]    = useState(!result?.joint_scores);
  const [failed,     setFailed]     = useState(false);
  const [failMsg,    setFailMsg]    = useState("");
  const [ready,      setReady]      = useState(false);

  useEffect(() => {
    if (result?.joint_scores) { setSubmission(result); setLoading(false); return; }
    if (!result?.id) return;

    let attempts = 0;
    const MAX = 120; // 3 minutes at 1.5s intervals
    const t = setInterval(async () => {
      attempts++;
      try {
        const s = await getSubmission(result.id);
        if (s.status === "ready") {
          setSubmission(s); setLoading(false); clearInterval(t);
        }
        // fix #8 — surface failure clearly
        if (s.status === "failed") {
          setFailed(true);
          setFailMsg(s.error || "Processing failed — please try again.");
          setLoading(false);
          clearInterval(t);
        }
      } catch {}
      if (attempts >= MAX) {
        setFailed(true);
        setFailMsg("Timed out waiting for results. Please try again.");
        setLoading(false);
        clearInterval(t);
      }
    }, 1500);
    return () => clearInterval(t);
  }, [result?.id]);

  useEffect(() => { if (!loading) setTimeout(()=>setReady(true),100); }, [loading]);
  const fd = (d=0) => ready
    ? { opacity:1, transform:"translateY(0)", transition:`opacity .5s ${d}s ease,transform .5s ${d}s ease` }
    : { opacity:0, transform:"translateY(12px)" };

  // fix #8 — dedicated failed state with retry
  if (failed) return (
    <div style={{ maxWidth:500, margin:"80px auto", padding:"0 24px", textAlign:"center" }}>
      <div style={{ fontSize:40, marginBottom:16 }}>⚠️</div>
      <div style={{ fontWeight:700, fontSize:20, color:C.text, marginBottom:8 }}>Analysis failed</div>
      <div style={{ color:C.sub, fontSize:14, lineHeight:1.75, marginBottom:8 }}>{failMsg}</div>
      <div style={{ color:C.muted, fontSize:12, marginBottom:28 }}>
        This is usually caused by video quality, lighting, or the server being busy. Try again with a clearer video.
      </div>
      <div style={{ display:"flex", gap:12, justifyContent:"center" }}>
        <Btn onClick={()=>nav("routine",{routine})}>🔁 Try Again</Btn>
        <Btn variant="ghost" onClick={()=>nav("dashboard")}>Go to Dashboard</Btn>
      </div>
    </div>
  );

  if (loading) return (
    <div style={{ textAlign:"center", padding:"80px 24px" }}>
      <div style={{ position:"relative", width:56, height:56, margin:"0 auto 20px" }}>
        <Spinner size={56} color={C.green}/>
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🤸</div>
      </div>
      <div style={{ fontWeight:700, fontSize:17, color:C.text, marginBottom:6 }}>Analysing your performance…</div>
      <div style={{ color:C.sub, fontSize:13, lineHeight:1.7 }}>This usually takes 1–3 minutes. You can leave and come back.</div>
    </div>
  );

  return (
    <div style={{ maxWidth:840, margin:"0 auto", padding:"48px 24px 80px" }}>
      <div style={{ marginBottom:24, ...fd(0) }}>
        <Mono color={C.green} style={{ display:"block", marginBottom:6, letterSpacing:1 }}>YOUR RESULTS</Mono>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
          <div>
            <h1 style={{ fontWeight:800, fontSize:24, letterSpacing:-.8, color:C.text, marginBottom:4 }}>{routine?.name}</h1>
            <div style={{ display:"flex", alignItems:"center", gap:10, color:C.muted, fontSize:13 }}>
              by {routine?.teacher_name} &nbsp;·&nbsp; <Tag color={DIFF_COLOR[routine?.difficulty]}>{routine?.difficulty}</Tag>
            </div>
          </div>
          <Btn variant="ghosthi" size="sm" onClick={()=>nav("routine",{routine})}>↩ Try Again</Btn>
        </div>
      </div>
      {/* fix #13 — ResultsView checks overlay_url and uses it; canvas only as fallback */}
      <ResultsView submission={submission} onRetry={()=>nav("routine",{routine})} isTeacherView={false}/>
    </div>
  );
}
