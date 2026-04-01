// src/pages/auth/AuthPages.jsx
import { useState } from "react";
import { register as apiRegister, login as apiLogin, forgotPassword } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Card, Btn, C, inputStyle } from "../../components";

const GS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  body { background:${C.bg}; color:${C.text}; -webkit-font-smoothing:antialiased; font-family:'Syne',sans-serif; }
  input::placeholder { color:${C.muted}; }
  @keyframes mm-spin { to { transform:rotate(360deg); } }
  @keyframes fadeUp  { from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)} }
  .au-fade { animation:fadeUp .4s ease both; }
`;

function Logo() {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, justifyContent:"center", marginBottom:32 }}>
      <div style={{ width:32, height:32, borderRadius:9, background:`linear-gradient(135deg,${C.accent},#8b5cf6)`, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="3" r="1.5" fill="white"/>
          <line x1="7" y1="4.5" x2="7" y2="7.5" stroke="white" strokeWidth="1.5"/>
          <line x1="7" y1="7.5" x2="4" y2="10" stroke="white" strokeWidth="1.5"/>
          <line x1="7" y1="7.5" x2="10" y2="10" stroke="white" strokeWidth="1.5"/>
          <line x1="4.5" y1="6" x2="9.5" y2="6" stroke="white" strokeWidth="1.5"/>
        </svg>
      </div>
      <span style={{ fontWeight:800, fontSize:20, letterSpacing:-.5 }}>
        <span style={{ background:`linear-gradient(90deg,${C.accent},#8b5cf6)`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Move</span>
        <span style={{ color:C.text }}>Match</span>
      </span>
    </div>
  );
}

export function LoginPage({ role, RoleToggle, onSwitch, onForgot }) {
  const { login } = useAuth();
  const [form,    setForm]    = useState({ email:"", password:"" });
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const rc = role === "teacher" ? C.accent : C.green;

  function set(k, v) { setForm(f=>({...f,[k]:v})); setError(""); }

  async function submit() {
    if (!form.email || !form.password) return setError("All fields required");
    setLoading(true);
    try {
      const res = await apiLogin({ email:form.email, password:form.password });
      if (res.role !== role) {
        setError(`This is the ${role} portal. Please use the ${res.role} portal instead.`);
        return;
      }
      login(res);
    } catch(err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{GS}</style>
      <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
        <div style={{ width:"100%", maxWidth:400 }} className="au-fade">
          <Logo/>
          {/* Role toggle from App.jsx */}
          {RoleToggle && <RoleToggle/>}
          <Card>
            <h2 style={{ fontWeight:800, fontSize:22, letterSpacing:-.5, color:C.text, marginBottom:4 }}>Welcome back</h2>
            <p style={{ color:C.sub, fontSize:13, marginBottom:24 }}>Sign in to your {role} account</p>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <div style={{ fontWeight:600, fontSize:11, color:C.sub, textTransform:"uppercase", letterSpacing:.8, marginBottom:7 }}>Email</div>
                <input type="email" value={form.email} onChange={e=>set("email",e.target.value)} placeholder="you@example.com" style={inputStyle(false)} onKeyDown={e=>e.key==="Enter"&&submit()}/>
              </div>
              <div>
                <div style={{ fontWeight:600, fontSize:11, color:C.sub, textTransform:"uppercase", letterSpacing:.8, marginBottom:7 }}>Password</div>
                <input type="password" value={form.password} onChange={e=>set("password",e.target.value)} placeholder="••••••••" style={inputStyle(false)} onKeyDown={e=>e.key==="Enter"&&submit()}/>
                <button onClick={onForgot} style={{ background:"none", border:"none", cursor:"pointer", color:C.muted, fontSize:11, marginTop:6, padding:0, fontFamily:"'Syne',sans-serif" }}>Forgot password?</button>
              </div>
              {error && <div style={{ padding:"10px 13px", borderRadius:8, background:C.redDim, border:`1px solid ${C.red}35`, color:C.red, fontSize:13 }}>{error}</div>}
              <Btn full size="lg" disabled={loading} onClick={submit} style={{ background:rc, borderColor:rc }}>
                {loading ? "Signing in…" : "Sign In →"}
              </Btn>
            </div>
          </Card>
          <div style={{ textAlign:"center", marginTop:20, fontSize:13, color:C.muted }}>
            Don't have an account?{" "}
            <button onClick={onSwitch} style={{ background:"none", border:"none", cursor:"pointer", color:rc, fontWeight:600, fontSize:13, fontFamily:"'Syne',sans-serif" }}>Sign up</button>
          </div>
        </div>
      </div>
    </>
  );
}

export function RegisterPage({ role, RoleToggle, onSwitch }) {
  const { login } = useAuth();
  const [form,    setForm]    = useState({ email:"", password:"", name:"", class_code:"" });
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const rc = role === "teacher" ? C.accent : C.green;

  function set(k, v) { setForm(f=>({...f,[k]:v})); setError(""); }

  async function submit() {
    if (!form.email || !form.password || !form.name) return setError("Name, email and password are required");
    if (form.password.length < 8) return setError("Password must be at least 8 characters");
    if (role === "student" && !form.class_code.trim()) return setError("Class code from your teacher is required");
    setLoading(true);
    try {
      const res = await apiRegister({
        email: form.email, password: form.password,
        name: form.name, role,
        class_code: form.class_code.trim().toUpperCase() || undefined,
      });
      login(res);
    } catch(err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{GS}</style>
      <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
        <div style={{ width:"100%", maxWidth:400 }} className="au-fade">
          <Logo/>
          {RoleToggle && <RoleToggle/>}
          <Card>
            <h2 style={{ fontWeight:800, fontSize:22, letterSpacing:-.5, color:C.text, marginBottom:4 }}>Create account</h2>
            <p style={{ color:C.sub, fontSize:13, marginBottom:24 }}>
              {role === "teacher" ? "You'll get a class code to share with students." : "You'll need a class code from your teacher."}
            </p>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <div style={{ fontWeight:600, fontSize:11, color:C.sub, textTransform:"uppercase", letterSpacing:.8, marginBottom:7 }}>Full Name</div>
                <input value={form.name} onChange={e=>set("name",e.target.value)} placeholder={role==="teacher"?"e.g. Priya Sharma":"e.g. Anjali Rajan"} style={inputStyle(false)}/>
              </div>
              <div>
                <div style={{ fontWeight:600, fontSize:11, color:C.sub, textTransform:"uppercase", letterSpacing:.8, marginBottom:7 }}>Email</div>
                <input type="email" value={form.email} onChange={e=>set("email",e.target.value)} placeholder="you@example.com" style={inputStyle(false)}/>
              </div>
              <div>
                <div style={{ fontWeight:600, fontSize:11, color:C.sub, textTransform:"uppercase", letterSpacing:.8, marginBottom:7 }}>Password</div>
                <input type="password" value={form.password} onChange={e=>set("password",e.target.value)} placeholder="Min. 8 characters" style={inputStyle(false)}/>
              </div>
              {role === "student" && (
                <div>
                  <div style={{ fontWeight:600, fontSize:11, color:C.sub, textTransform:"uppercase", letterSpacing:.8, marginBottom:7 }}>Class Code <span style={{color:C.red}}>*</span></div>
                  <input value={form.class_code} onChange={e=>set("class_code",e.target.value.toUpperCase())} placeholder="e.g. BTNT42" style={{ ...inputStyle(false), fontFamily:"'JetBrains Mono',monospace", letterSpacing:3, fontSize:16 }} maxLength={6}/>
                  <div style={{ fontSize:11, color:C.muted, marginTop:5 }}>Get this from your teacher.</div>
                </div>
              )}
              {error && <div style={{ padding:"10px 13px", borderRadius:8, background:C.redDim, border:`1px solid ${C.red}35`, color:C.red, fontSize:13 }}>{error}</div>}
              <Btn full size="lg" disabled={loading} onClick={submit} style={{ background:rc, borderColor:rc }}>
                {loading ? "Creating account…" : "Create Account →"}
              </Btn>
            </div>
          </Card>
          <div style={{ textAlign:"center", marginTop:20, fontSize:13, color:C.muted }}>
            Already have an account?{" "}
            <button onClick={onSwitch} style={{ background:"none", border:"none", cursor:"pointer", color:rc, fontWeight:600, fontSize:13, fontFamily:"'Syne',sans-serif" }}>Sign in</button>
          </div>
        </div>
      </div>
    </>
  );
}

export function ForgotPasswordPage({ role, onBack }) {
  const [email,   setEmail]   = useState("");
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const rc = role === "teacher" ? C.accent : C.green;

  async function submit() {
    if (!email) return setError("Enter your email address");
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch(err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{GS}</style>
      <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
        <div style={{ width:"100%", maxWidth:400 }} className="au-fade">
          <Logo/>
          <Card>
            {sent ? (
              <div style={{ textAlign:"center", padding:"16px 0" }}>
                <div style={{ fontSize:40, marginBottom:16 }}>📧</div>
                <h2 style={{ fontWeight:800, fontSize:20, color:C.text, marginBottom:8 }}>Check your email</h2>
                <p style={{ color:C.sub, fontSize:13, lineHeight:1.75 }}>If that address is registered, you'll receive a reset link shortly.</p>
              </div>
            ) : (
              <>
                <h2 style={{ fontWeight:800, fontSize:22, color:C.text, marginBottom:4 }}>Forgot password?</h2>
                <p style={{ color:C.sub, fontSize:13, marginBottom:24 }}>Enter your email and we'll send a reset link.</p>
                <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                  <div>
                    <div style={{ fontWeight:600, fontSize:11, color:C.sub, textTransform:"uppercase", letterSpacing:.8, marginBottom:7 }}>Email</div>
                    <input type="email" value={email} onChange={e=>{setEmail(e.target.value);setError("");}} placeholder="you@example.com" style={inputStyle(false)} onKeyDown={e=>e.key==="Enter"&&submit()}/>
                  </div>
                  {error && <div style={{ padding:"10px 13px", borderRadius:8, background:C.redDim, border:`1px solid ${C.red}35`, color:C.red, fontSize:13 }}>{error}</div>}
                  <Btn full size="lg" disabled={loading} onClick={submit} style={{ background:rc, borderColor:rc }}>
                    {loading ? "Sending…" : "Send Reset Link"}
                  </Btn>
                </div>
              </>
            )}
          </Card>
          <div style={{ textAlign:"center", marginTop:20, fontSize:13, color:C.muted }}>
            <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", color:rc, fontWeight:600, fontSize:13, fontFamily:"'Syne',sans-serif" }}>← Back to login</button>
          </div>
        </div>
      </div>
    </>
  );
}
