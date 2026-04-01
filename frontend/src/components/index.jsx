// src/components/index.jsx
// Shared design system. fix #1: DropZone validates file size client-side.
import { useState, useRef } from "react";
import { validateVideoFile } from "../api/client";

export const C = {
  bg:"#05060c", card:"#0d0f1a", cardHov:"#12152a",
  border:"#181b2e", borderHi:"#252840",
  accent:"#6271ff", accentDim:"#6271ff18",
  green:"#00d48c", greenDim:"#00d48c14",
  amber:"#f5a623", amberDim:"#f5a62314",
  red:"#f0476a",   redDim:"#f0476a14",
  purple:"#a855f7",
  text:"#dde1f5", sub:"#828aaa", muted:"#404468", dim:"#090b14",
};

export const DIFF_COLOR = { easy: C.green, medium: C.amber, hard: C.red };
export const sc    = v => v >= 80 ? C.green : v >= 62 ? C.amber : C.red;
export const grade = v => v >= 93 ? "S" : v >= 83 ? "A" : v >= 72 ? "B" : v >= 58 ? "C" : "D";

export function Mono({ children, color = C.sub, size = 11, style = {} }) {
  return <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:size, color, ...style }}>{children}</span>;
}

export function Tag({ children, color = C.accent }) {
  return <span style={{ display:"inline-block", padding:"3px 9px", borderRadius:5, fontFamily:"'JetBrains Mono',monospace", fontSize:10, fontWeight:700, letterSpacing:1.2, background:color+"1e", color, border:`1px solid ${color}45` }}>{children}</span>;
}

export function Btn({ children, onClick, variant="primary", disabled, full, size="md", style={} }) {
  const sz = { sm:{p:"7px 14px",fs:12}, md:{p:"11px 22px",fs:13}, lg:{p:"14px 32px",fs:14} }[size];
  const vs = {
    primary: { bg:C.accent,      color:"#fff",   border:C.accent },
    ghost:   { bg:"transparent", color:C.sub,    border:C.border },
    ghosthi: { bg:"transparent", color:C.text,   border:C.borderHi },
    success: { bg:C.green+"1a",  color:C.green,  border:C.green+"55" },
    warn:    { bg:C.amber+"1a",  color:C.amber,  border:C.amber+"55" },
    danger:  { bg:C.red+"1a",    color:C.red,    border:C.red+"55" },
  }[variant] || {};
  return (
    <button onClick={disabled ? undefined : onClick} style={{
      padding:sz.p, borderRadius:10, cursor:disabled?"not-allowed":"pointer",
      fontWeight:700, fontSize:sz.fs, letterSpacing:0.2,
      background:vs.bg, color:vs.color, border:`1px solid ${vs.border}`,
      opacity:disabled?.38:1, width:full?"100%":undefined,
      display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6,
      transition:"all .15s", ...style,
    }}>{children}</button>
  );
}

export function Card({ children, style={}, glow, className="" }) {
  return (
    <div className={className} style={{
      background:C.card, border:`1px solid ${glow ? glow+"40" : C.border}`,
      borderRadius:16, padding:24, position:"relative", overflow:"hidden",
      boxShadow:glow ? `0 0 36px ${glow}10,0 2px 10px #00000044` : "0 2px 10px #00000033",
      ...style,
    }}>
      {glow && <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,${glow},${glow}00)` }}/>}
      {children}
    </div>
  );
}

export function Bar({ value=0, color=C.accent, height=5 }) {
  return (
    <div style={{ height, background:C.dim, borderRadius:height, overflow:"hidden" }}>
      <div style={{ height:"100%", borderRadius:height, background:color, width:`${Math.min(100,Math.max(0,value))}%`, transition:"width .6s cubic-bezier(.4,0,.2,1)" }}/>
    </div>
  );
}

export function Spinner({ size=24, color=C.accent }) {
  return <div style={{ width:size, height:size, borderRadius:"50%", border:`2.5px solid ${color}30`, borderTopColor:color, animation:"spin .7s linear infinite", display:"inline-block", flexShrink:0 }}/>;
}

export function ScoreRing({ score, size=130 }) {
  const sw=8, r=(size-sw)/2, circ=2*Math.PI*r;
  const c=sc(score), g=grade(score);
  return (
    <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)", display:"block" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.dim} strokeWidth={sw}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c} strokeWidth={sw}
          strokeDasharray={circ} strokeDashoffset={circ*(1-score/100)}
          strokeLinecap="round" style={{ transition:"stroke-dashoffset 1.5s cubic-bezier(.4,0,.2,1)" }}/>
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:700, fontSize:size*.25, color:c, lineHeight:1 }}>{g}</div>
        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:size*.125, color:C.sub, marginTop:3 }}>{Math.round(score)}%</div>
      </div>
    </div>
  );
}

// fix #1 — DropZone validates file size & type before accepting
export function DropZone({ onFile, file }) {
  const [drag, setDrag]     = useState(false);
  const [fileErr, setFileErr] = useState("");
  const inp = useRef();

  function handleFile(f) {
    if (!f) { onFile(null); setFileErr(""); return; }
    const err = validateVideoFile(f);
    if (err) { setFileErr(err); return; }
    setFileErr("");
    onFile(f);
  }

  if (file) return (
    <div style={{ padding:"15px 18px", borderRadius:10, background:C.greenDim, border:`1px solid ${C.green}35`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
      <div>
        <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{file.name}</div>
        <Mono size={11} style={{ display:"block", marginTop:3 }}>{(file.size/1024/1024).toFixed(1)} MB</Mono>
      </div>
      <Btn variant="ghost" size="sm" onClick={() => handleFile(null)}>Change</Btn>
    </div>
  );

  return (
    <div>
      <div
        onDragOver={e=>{e.preventDefault();setDrag(true)}}
        onDragLeave={()=>setDrag(false)}
        onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files?.[0]);}}
        onClick={() => inp.current?.click()}
        style={{ padding:"36px 24px", borderRadius:12, cursor:"pointer", textAlign:"center", border:`2px dashed ${fileErr?C.red:drag?C.accent:C.border}`, background:drag?C.accentDim:C.dim, transition:"all .15s" }}
      >
        <input ref={inp} type="file" accept="video/*" style={{display:"none"}} onChange={e=>handleFile(e.target.files?.[0])}/>
        <div style={{fontSize:28,marginBottom:8}}>🎬</div>
        <div style={{fontWeight:700,fontSize:13,color:C.text,marginBottom:3}}>Drop video or click to browse</div>
        <Mono color={C.muted}>MP4 · MOV · WebM · max 500 MB</Mono>
      </div>
      {fileErr && <div style={{ color:C.red, fontSize:12, marginTop:6 }}>⚠ {fileErr}</div>}
    </div>
  );
}

export function EmptyState({ icon="📭", title, body, action }) {
  return (
    <div style={{ textAlign:"center", padding:"52px 24px" }}>
      <div style={{ fontSize:36, marginBottom:14 }}>{icon}</div>
      <div style={{ fontSize:16, fontWeight:600, color:C.text, marginBottom:8 }}>{title}</div>
      {body && <div style={{ fontSize:13, color:C.sub, maxWidth:320, margin:"0 auto 20px", lineHeight:1.75 }}>{body}</div>}
      {action}
    </div>
  );
}

export const inputStyle = (err) => ({
  width:"100%", padding:"12px 14px", borderRadius:9,
  border:`1px solid ${err ? C.red+"60" : C.border}`,
  background:C.dim, color:C.text, fontSize:13,
  outline:"none", boxSizing:"border-box", transition:"border-color .15s",
  fontFamily:"'Syne',sans-serif",
});
