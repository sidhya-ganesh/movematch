// src/components/ResultsView.jsx
// fix #13 — real overlay video used when available; canvas only as fallback
import { useState, useEffect, useRef } from "react";
import { Card, Btn, Mono, Bar, ScoreRing, C, sc } from "./index";
import { mediaUrl } from "../api/client";

const JOINT_LABELS = { left_wrist:"Left Wrist",right_wrist:"Right Wrist",left_elbow:"Left Elbow",right_elbow:"Right Elbow",left_shoulder:"Left Shoulder",right_shoulder:"Right Shoulder",left_hip:"Left Hip",right_hip:"Right Hip",left_knee:"Left Knee",right_knee:"Right Knee",left_ankle:"Left Ankle",right_ankle:"Right Ankle",nose:"Head Position" };
const FOCUS_TIPS = { right_wrist:"Slow your right mudra — precision beats pace. Watch the wrist extension angle in the reference.",left_wrist:"Left hand drifts on transitions. Pause at each position before moving to the next.",right_knee:"Right knee collapses inward. Drive it out over your toes.",left_knee:"Left knee tracking is inconsistent. Check weight distribution on each count.",right_elbow:"Right elbow angle too shallow — extend fully before the next transition.",left_elbow:"Left elbow slightly over-extending. Match the bend angle from the reference.",left_shoulder:"Left shoulder drops — keep both shoulders level.",right_shoulder:"Right shoulder rises — consciously relax and level it.",left_ankle:"Left foot placement is inconsistent. Place deliberately on each beat.",right_ankle:"Right foot placement needs work. Focus on where your foot lands." };

const BODY_GROUPS = [
  { label:"Arms & Hands", icon:"🤲", keys:["left_wrist","right_wrist","left_elbow","right_elbow","left_shoulder","right_shoulder"] },
  { label:"Core & Hips",  icon:"⚡", keys:["left_hip","right_hip"] },
  { label:"Legs & Feet",  icon:"🦶", keys:["left_knee","right_knee","left_ankle","right_ankle"] },
];

function avg(joints, keys) {
  const v = keys.map(k=>joints?.[k]).filter(x=>x!=null);
  return v.length ? Math.round(v.reduce((a,b)=>a+b)/v.length) : null;
}

// Canvas skeleton animation — only shown when no real overlay_url
function SkeletonCanvas({ playing, setPlaying }) {
  const ref=useRef(), anim=useRef(), fn=useRef(0);
  useEffect(()=>{
    if(!playing){if(anim.current)cancelAnimationFrame(anim.current);return;}
    const cv=ref.current; if(!cv) return;
    const ctx=cv.getContext("2d"), W=cv.width, H=cv.height;
    const BONES=[["ls","rs"],["ls","le"],["le","lw"],["rs","re"],["re","rw"],["ls","lh"],["rs","rh"],["lh","rh"],["lh","lk"],["lk","la"],["rh","rk"],["rk","ra"]];
    function mkP(t,j=0){const a=Math.sin(t*.9)*.13,b=Math.sin(t*1.7)*5,l=Math.abs(Math.sin(t*.5))*.08,cx=W*.5,cy=H*.24;return{nose:[cx,cy-68+b],ls:[cx-68,cy+b],rs:[cx+68,cy+b],le:[cx-112-a*W*.2+j,cy+68+b],re:[cx+112+a*W*.2+j,cy+68+b],lw:[cx-130-a*W*.32+j*1.4,cy+148+b],rw:[cx+130+a*W*.32+j*1.4,cy+148+b],lh:[cx-48,cy+148+b],rh:[cx+48,cy+148+b],lk:[cx-58-l*W*.13+j*.3,cy+256],rk:[cx+58+l*W*.13+j*.3,cy+256],la:[cx-54,cy+358],ra:[cx+54,cy+358]};}
    function drawP(ps,color,alpha=1){ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=3;BONES.forEach(([a,b])=>{if(!ps[a]||!ps[b])return;ctx.beginPath();ctx.moveTo(...ps[a]);ctx.lineTo(...ps[b]);ctx.stroke();});Object.values(ps).forEach(pt=>{ctx.beginPath();ctx.arc(pt[0],pt[1],4,0,Math.PI*2);ctx.fill();});ctx.globalAlpha=1;}
    function loop(){fn.current++;const t=fn.current*.038;ctx.fillStyle="#060810";ctx.fillRect(0,0,W,H);ctx.strokeStyle="rgba(255,255,255,0.018)";ctx.lineWidth=1;for(let x=0;x<W;x+=36){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}for(let y=0;y<H;y+=36){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}ctx.strokeStyle="rgba(255,255,255,.06)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(W/2,0);ctx.lineTo(W/2,H);ctx.stroke();const ref=mkP(t,0),stu=mkP(t,(Math.random()-.5)*18);const fs=76+Math.sin(t*.3)*13;drawP(ref,C.accent,.45);drawP(stu,sc(fs),.95);ctx.font="bold 10px 'JetBrains Mono',monospace";ctx.fillStyle=C.accent+"99";ctx.fillText("● REFERENCE",12,H-14);ctx.fillStyle=C.green+"99";ctx.fillText("● STUDENT",W/2+12,H-14);ctx.fillStyle="rgba(255,255,255,.22)";ctx.fillText(`${Math.round(fs)}%`,W-46,H-14);anim.current=requestAnimationFrame(loop);}
    anim.current=requestAnimationFrame(loop);
    return()=>{if(anim.current)cancelAnimationFrame(anim.current);};
  },[playing]);
  return <canvas ref={ref} width={760} height={420} onClick={()=>setPlaying(p=>!p)} style={{width:"100%",borderRadius:10,border:`1px solid ${C.border}`,display:"block",background:"#060810",cursor:"pointer"}}/>;
}

export default function ResultsView({ submission, onRetry, isTeacherView=false }) {
  const [ready,   setReady]   = useState(false);
  const [playing, setPlaying] = useState(false);
  useEffect(()=>{ setTimeout(()=>setReady(true),100); },[]);

  const fd = (d=0) => ready
    ? {opacity:1,transform:"translateY(0)",transition:`opacity .5s ${d}s ease,transform .5s ${d}s ease`}
    : {opacity:0,transform:"translateY(12px)"};

  const score  = submission?.overall_score ?? 0;
  const joints = submission?.joint_scores  ?? {};
  const gc     = sc(score);

  // fix #13 — use real overlay_url when available, canvas only as fallback
  const overlayUrl = mediaUrl(submission?.overlay_url);

  const gl = score>=80?"Great performance!":score>=62?"Good effort":"Keep practising";
  const gm = score>=80?"Strong alignment throughout. Focus on arms to push toward the top rank."
           : score>=62?"Solid foundation. Arms and knee tracking need the most work."
           :            "Consistent repetition builds the muscle memory. Keep going.";

  const weak = Object.entries(joints).filter(([,v])=>v<80).sort((a,b)=>a[1]-b[1]).slice(0,3);

  return (
    <div>
      {/* Score hero */}
      <Card glow={gc} style={{marginBottom:14,...fd(0)}}>
        <div style={{display:"flex",alignItems:"center",gap:24,flexWrap:"wrap"}}>
          <ScoreRing score={Math.round(score)}/>
          <div style={{flex:1,minWidth:200}}>
            <div style={{fontWeight:800,fontSize:24,letterSpacing:-.5,color:gc,marginBottom:8}}>{gl}</div>
            <p style={{color:C.sub,fontSize:13,lineHeight:1.8,maxWidth:400}}>{gm}</p>
          </div>
        </div>
      </Card>

      {/* Body groups */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:14,...fd(.08)}}>
        {BODY_GROUPS.map(({label,icon,keys})=>{
          const a=avg(joints,keys), c=a==null?C.muted:sc(a);
          return <Card key={label} glow={a!=null&&a>=80?C.green:a!=null&&a>=62?C.amber:undefined}>
            <div style={{fontSize:22,marginBottom:8}}>{icon}</div>
            <div style={{fontWeight:600,fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>{label}</div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:32,color:c,marginBottom:10}}>{a??"-"}%</div>
            <Bar value={a??0} color={c}/>
          </Card>;
        })}
      </div>

      {/* Skeleton replay — fix #13 */}
      <Card style={{marginBottom:14,...fd(.14)}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div>
            <div style={{fontWeight:700,fontSize:14,color:C.text,marginBottom:2}}>Skeleton Replay</div>
            <div style={{fontSize:12,color:C.muted}}>
              {overlayUrl ? "Side-by-side skeleton comparison video" : "Demo animation — real video generated by server"}
            </div>
          </div>
          {!overlayUrl && (
            <Btn variant={playing?"warn":"ghosthi"} size="sm" onClick={()=>setPlaying(p=>!p)}>
              {playing?"⏸ Pause":"▶ Play"}
            </Btn>
          )}
        </div>

        {overlayUrl
          ? <>
              <video src={overlayUrl} controls style={{width:"100%",borderRadius:10,border:`1px solid ${C.border}`,display:"block"}}/>
              <div style={{display:"flex",gap:16,marginTop:10,flexWrap:"wrap"}}>
                <Mono style={{color:C.accent}}>● Reference</Mono>
                <Mono style={{color:C.green}}>● You (on)</Mono>
                <Mono style={{color:C.amber}}>● You (close)</Mono>
                <Mono style={{color:C.red}}>● You (off)</Mono>
              </div>
            </>
          : <>
              <SkeletonCanvas playing={playing} setPlaying={setPlaying}/>
              <div style={{display:"flex",gap:16,marginTop:10,flexWrap:"wrap"}}>
                <Mono style={{color:C.accent}}>● Reference</Mono>
                <Mono style={{color:C.green}}>● You (on)</Mono>
                <Mono style={{color:C.amber}}>● You (close)</Mono>
                <Mono style={{color:C.red}}>● You (off)</Mono>
              </div>
              {submission?.overlay_error && (
                <div style={{marginTop:10,padding:"8px 12px",borderRadius:8,background:C.amberDim,border:`1px solid ${C.amber}30`,fontSize:12,color:C.amber}}>
                  Note: Skeleton replay unavailable ({submission.overlay_error}). Your scores above are accurate.
                </div>
              )}
            </>
        }
      </Card>

      {/* Full breakdown */}
      <Card style={{marginBottom:14,...fd(.20)}}>
        <div style={{fontWeight:700,fontSize:14,color:C.text,marginBottom:4}}>Full Body Breakdown</div>
        <div style={{fontSize:12,color:C.muted,marginBottom:18}}>Sorted lowest to highest accuracy</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 28px"}}>
          {Object.entries(joints).sort((a,b)=>a[1]-b[1]).map(([j,v])=>{
            const c=sc(v);
            return <div key={j}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <span style={{fontSize:13,color:C.sub}}>{JOINT_LABELS[j]||j}</span>
                <Mono style={{fontWeight:700,color:c}}>{Math.round(v)}%</Mono>
              </div>
              <Bar value={v} color={c}/>
            </div>;
          })}
        </div>
      </Card>

      {/* What to work on */}
      {weak.length>0 && (
        <Card style={{marginBottom:24,...fd(.26)}}>
          <div style={{fontWeight:700,fontSize:14,color:C.text,marginBottom:16}}>What to Work On</div>
          {weak.map(([j,v])=>(
            <div key={j} style={{padding:"12px 14px",borderRadius:10,marginBottom:8,background:C.redDim,border:`1px solid ${C.red}22`}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontWeight:600,fontSize:13,color:C.text}}>{JOINT_LABELS[j]||j}</span>
                <Mono style={{fontWeight:700,color:C.red}}>{Math.round(v)}%</Mono>
              </div>
              <p style={{fontSize:12,color:C.sub,lineHeight:1.7,margin:0}}>
                {FOCUS_TIPS[j]||"Compare against the reference skeleton frame by frame."}
              </p>
            </div>
          ))}
        </Card>
      )}

      {!isTeacherView && onRetry && (
        <div style={{display:"flex",gap:12,justifyContent:"center",...fd(.32)}}>
          <Btn size="lg" onClick={onRetry} style={{boxShadow:`0 0 20px ${C.accent}33`}}>🔁 Try Again</Btn>
        </div>
      )}
    </div>
  );
}
