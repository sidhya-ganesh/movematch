// src/api/client.js
// All backend calls. Fixes: #1 file size, #2 join-class, #4 mySubmissions,
// #13 overlay_url checked, #14 forgot/reset password.

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const MAX_FILE_BYTES = 500 * 1024 * 1024; // 500 MB — fix #1

export function token() { return localStorage.getItem("mm_token"); }

async function req(method, path, body, isForm = false) {
  const headers = {};
  if (token()) headers["Authorization"] = `Bearer ${token()}`;
  const opts = { method, headers };
  if (body) {
    if (isForm) { opts.body = body; }
    else { headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
  }
  const res  = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
  return data;
}

// fix #1 — validate file size before upload to give instant feedback
export function validateVideoFile(file) {
  if (!file) return "Please select a video file.";
  if (file.size > MAX_FILE_BYTES) return `File too large — maximum is 500 MB (yours is ${(file.size / 1024 / 1024).toFixed(0)} MB).`;
  const ok = ["video/mp4","video/quicktime","video/webm"];
  if (!ok.includes(file.type) && !file.name.match(/\.(mp4|mov|webm)$/i))
    return "Unsupported format — please use MP4, MOV, or WebM.";
  return null; // null = valid
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const register       = (body) => req("POST", "/auth/register",       body);
export const login          = (body) => req("POST", "/auth/login",          body);
export const getMe          = ()     => req("GET",  "/auth/me");
// fix #2
export const joinClass      = (code) => req("POST", "/auth/join-class",     { class_code: code });
// fix #14
export const forgotPassword = (email)        => req("POST", "/auth/forgot-password", { email });
export const resetPassword  = (token, password) => req("POST", "/auth/reset-password", { token, password });

// ── Routines ──────────────────────────────────────────────────────────────────
export const listRoutines         = (includeArchived = false) =>
  req("GET", `/routines${includeArchived ? "?include_archived=true" : ""}`);
export const getRoutine           = (id)  => req("GET",    `/routines/${id}`);
export const archiveRoutine       = (id)  => req("PATCH",  `/routines/${id}/archive`);
export const unarchiveRoutine     = (id)  => req("PATCH",  `/routines/${id}/unarchive`);
export const deleteRoutine        = (id)  => req("DELETE", `/routines/${id}`);

export async function createRoutine(videoFile, meta) {
  const err = validateVideoFile(videoFile);   // fix #1
  if (err) throw new Error(err);
  const form = new FormData();
  form.append("video",       videoFile);
  form.append("name",        meta.name);
  form.append("difficulty",  meta.difficulty);
  form.append("description", meta.description || "");
  return req("POST", "/routines", form, true);
}

// ── Jobs ──────────────────────────────────────────────────────────────────────
export const getJob = (id) => req("GET", `/jobs/${id}`);

/** Poll a routine by its id until job_status is "complete" or "failed".
 *  Uses GET /routines/{id} which returns job_status + job_progress directly,
 *  since POST /routines does not expose job_id in its response. */
export function pollRoutine(routineId, onProgress, ms = 2000) {
  return new Promise((resolve, reject) => {
    const t = setInterval(async () => {
      try {
        const routine = await getRoutine(routineId);
        if (onProgress) onProgress(routine.job_progress || 0);
        if (routine.job_status === "complete") { clearInterval(t); resolve(routine); }
        if (routine.job_status === "failed")   { clearInterval(t); reject(new Error("Processing failed")); }
      } catch (e) {
        console.log("Routine not ready yet, retrying...");
      }
    }, ms);
    setTimeout(() => { clearInterval(t); reject(new Error("Processing timed out")); }, 10 * 60 * 1000);
  });
}

/** export function pollJob(jobId, onProgress, ms = 1500) {
  return new Promise((resolve, reject) => {
    const t = setInterval(async () => {
      try {
        const job = await getJob(jobId);
        if (onProgress) onProgress(job.progress || 0);
        if (job.status === "complete") { clearInterval(t); resolve(job); }
        if (job.status === "failed")   { clearInterval(t); reject(new Error(job.error || "Processing failed")); }
      } catch (e) { clearInterval(t); reject(e); }
    }, ms);
  });
} **/
export function pollJob(jobId, onProgress, ms = 2000) {
  return new Promise((resolve, reject) => {
    const t = setInterval(async () => {
      try {
        const job = await getJob(jobId);
        if (onProgress) onProgress(job.progress || 0);
        if (job.status === "complete") { clearInterval(t); resolve(job); }
        if (job.status === "failed")   { clearInterval(t); reject(new Error(job.error || "Processing failed")); }
      } catch (e) {
        console.log("Job not ready yet, retrying...");
      }
    }, ms);
    setTimeout(() => { clearInterval(t); reject(new Error("Processing timed out")); }, 10 * 60 * 1000);
  });
}

// ── Submissions ───────────────────────────────────────────────────────────────
export const getSubmission   = (id)  => req("GET", `/submissions/${id}`);
export const listSubmissions = (rid) => req("GET", `/routines/${rid}/submissions`);
// fix #4 — explicit API call for student history, not reading from user object
export const mySubmissions   = ()    => req("GET", "/students/me/submissions");

export async function createSubmission(routineId, videoFile) {
  const err = validateVideoFile(videoFile);   // fix #1
  if (err) throw new Error(err);
  const form = new FormData();
  form.append("video", videoFile);
  return req("POST", `/routines/${routineId}/submissions`, form, true);
}

// ── Teacher ───────────────────────────────────────────────────────────────────
export const classRoster = () => req("GET", "/teacher/students");   // fix #11

// ── Helpers ───────────────────────────────────────────────────────────────────
// fix #13 — always resolve through BASE so relative paths from server work
//export const mediaUrl = (path) => path ? `${BASE}${path}` : null;
export const mediaUrl = (path) => {
  if (!path) return null;
  if (path.startsWith("http")) return path;  // already a full URL
  return `${BASE}${path}`;
};
