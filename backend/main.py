"""
MoveMatch Backend — FastAPI v4
Supabase Postgres for persistent storage.
Supabase Storage for video files.
"""

import os, uuid, json, time, asyncio, secrets, string
from pathlib import Path
from typing import Optional
from datetime import datetime, timedelta

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import bcrypt
import jwt
import psycopg2
import psycopg2.extras
from contextlib import contextmanager
from supabase import create_client, Client

from pose_extractor import extract_pose_sequence
from comparison_engine import compare_sequences, generate_skeleton_overlay

# ── Config ─────────────────────────────────────────────────────────────────────
SECRET_KEY         = os.getenv("JWT_SECRET", "dev-secret-CHANGE-in-production")
JWT_ALGO           = "HS256"
JWT_EXPIRY_MINUTES = 60 * 24 * 7
MAX_VIDEO_BYTES    = 500 * 1024 * 1024

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:$Rocketmanuski6@db.pyqckzkzuscfxtzhycnw.supabase.co:5432/postgres"
)

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://pyqckzkzuscfxtzhycnw.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5cWNremt6dXNjZnh0emh5Y253Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDUxNjMsImV4cCI6MjA5MDQ4MTE2M30.POEgbDteSvBnV556Uh209sg6VWY0x-IoVmv-MBkJ4WE")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="MoveMatch API", version="4.0.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

UPLOAD_DIR  = Path("uploads");  UPLOAD_DIR.mkdir(exist_ok=True)
RESULTS_DIR = Path("results");  RESULTS_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/results",  StaticFiles(directory="results"),  name="results")

# ── Storage helpers ────────────────────────────────────────────────────────────

def upload_to_storage(bucket: str, path: str, file_bytes: bytes, content_type: str = "video/mp4") -> str:
    """Upload bytes to Supabase Storage, return public URL."""
    try:
        supabase.storage.from_(bucket).upload(
            path, file_bytes,
            {"content-type": content_type, "upsert": "true"}
        )
        res = supabase.storage.from_(bucket).get_public_url(path)
        return res
    except Exception as e:
        print(f"[storage] Upload failed: {e}")
        return None

def upload_file_to_storage(bucket: str, path: str, local_path: str, content_type: str = "video/mp4") -> str:
    """Upload a local file to Supabase Storage, return public URL."""
    try:
        with open(local_path, "rb") as f:
            file_bytes = f.read()
        return upload_to_storage(bucket, path, file_bytes, content_type)
    except Exception as e:
        print(f"[storage] File upload failed: {e}")
        return None

# ── Database connection ────────────────────────────────────────────────────────

def get_conn():
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)

@contextmanager
def db():
    conn = get_conn()
    try:
        cur = conn.cursor()
        yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

# ── Auth helpers ───────────────────────────────────────────────────────────────

def _hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def _check_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def _make_token(user_id: str, role: str) -> str:
    exp = datetime.utcnow() + timedelta(minutes=JWT_EXPIRY_MINUTES)
    return jwt.encode({"sub": user_id, "role": role, "exp": exp}, SECRET_KEY, algorithm=JWT_ALGO)

def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Session expired — please log in again")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")

security = HTTPBearer()

def _current_user(creds: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    payload = _decode_token(creds.credentials)
    with db() as cur:
        cur.execute("SELECT * FROM users WHERE id = %s", (payload["sub"],))
        user = cur.fetchone()
    if not user:
        raise HTTPException(401, "User account not found")
    return dict(user)

def _require_teacher(user: dict = Depends(_current_user)) -> dict:
    if user["role"] != "teacher":
        raise HTTPException(403, "Teacher account required")
    return user

def _require_student(user: dict = Depends(_current_user)) -> dict:
    if user["role"] != "student":
        raise HTTPException(403, "Student account required")
    return user

def _gen_class_code() -> str:
    chars = string.ascii_uppercase + string.digits
    while True:
        code = "".join(secrets.choice(chars) for _ in range(6))
        with db() as cur:
            cur.execute("SELECT id FROM users WHERE class_code = %s", (code,))
            if not cur.fetchone():
                return code

# ── Pydantic models ────────────────────────────────────────────────────────────

class RegisterIn(BaseModel):
    email: str
    password: str
    name: str
    role: str
    class_code: Optional[str] = None

class LoginIn(BaseModel):
    email: str
    password: str

class JoinClassIn(BaseModel):
    class_code: str

class AuthOut(BaseModel):
    token: str
    user_id: str
    name: str
    email: str
    role: str
    class_code: Optional[str] = None
    teacher_name: Optional[str] = None

class UserOut(BaseModel):
    user_id: str
    name: str
    email: str
    role: str
    class_code: Optional[str] = None
    teacher_name: Optional[str] = None

class RoutineOut(BaseModel):
    id: str
    name: str
    difficulty: str
    description: str
    teacher_id: str
    teacher_name: str
    status: str
    job_id: Optional[str] = None
    job_status: Optional[str] = None
    job_progress: Optional[int] = None
    archived: bool = False
    reference_video_url: Optional[str] = None
    created_at: float
    submission_count: int = 0

class SubmissionOut(BaseModel):
    id: str
    routine_id: str
    routine_name: str
    student_id: str
    student_name: str
    status: str
    error: Optional[str] = None
    overall_score: Optional[float] = None
    joint_scores: Optional[dict] = None
    overlay_url: Optional[str] = None
    overlay_error: Optional[str] = None
    created_at: float
    job_id: Optional[str] = None

# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "version": "4.0.0"}

# ── Auth: register ─────────────────────────────────────────────────────────────

@app.post("/auth/register", response_model=AuthOut)
def register(body: RegisterIn):
    with db() as cur:
        cur.execute("SELECT id FROM users WHERE email = %s", (body.email,))
        if cur.fetchone():
            raise HTTPException(400, "Email already registered")

    if body.role not in ("teacher", "student"):
        raise HTTPException(400, "role must be 'teacher' or 'student'")
    if len(body.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")

    teacher_id   = None
    teacher_name = None
    class_code   = None

    if body.role == "student":
        if not body.class_code:
            raise HTTPException(400, "Students must provide a class code")
        code = body.class_code.upper().strip()
        with db() as cur:
            cur.execute("SELECT id, name FROM users WHERE class_code = %s AND role = 'teacher'", (code,))
            teacher = cur.fetchone()
        if not teacher:
            raise HTTPException(404, "Class code not found — double-check with your teacher")
        teacher_id   = str(teacher["id"])
        teacher_name = teacher["name"]

    if body.role == "teacher":
        class_code = _gen_class_code()

    uid = str(uuid.uuid4())
    with db() as cur:
        cur.execute(
            """INSERT INTO users (id, email, password_hash, name, role, class_code, teacher_id, created_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())""",
            (uid, body.email, _hash_pw(body.password), body.name, body.role, class_code, teacher_id)
        )

    return AuthOut(
        token=_make_token(uid, body.role),
        user_id=uid, name=body.name, email=body.email,
        role=body.role, class_code=class_code, teacher_name=teacher_name,
    )

# ── Auth: login ────────────────────────────────────────────────────────────────

@app.post("/auth/login", response_model=AuthOut)
def login(body: LoginIn):
    with db() as cur:
        cur.execute("SELECT * FROM users WHERE email = %s", (body.email,))
        user = cur.fetchone()
    if not user or not _check_pw(body.password, user["password_hash"]):
        raise HTTPException(401, "Incorrect email or password")

    teacher_name = None
    if user["teacher_id"]:
        with db() as cur:
            cur.execute("SELECT name FROM users WHERE id = %s", (str(user["teacher_id"]),))
            t = cur.fetchone()
            teacher_name = t["name"] if t else None

    return AuthOut(
        token=_make_token(str(user["id"]), user["role"]),
        user_id=str(user["id"]), name=user["name"],
        email=user["email"], role=user["role"],
        class_code=user["class_code"], teacher_name=teacher_name,
    )

# ── Auth: me ───────────────────────────────────────────────────────────────────

@app.get("/auth/me", response_model=UserOut)
def me(user: dict = Depends(_current_user)):
    teacher_name = None
    if user.get("teacher_id"):
        with db() as cur:
            cur.execute("SELECT name FROM users WHERE id = %s", (str(user["teacher_id"]),))
            t = cur.fetchone()
            teacher_name = t["name"] if t else None
    return UserOut(
        user_id=str(user["id"]), name=user["name"],
        email=user["email"], role=user["role"],
        class_code=user.get("class_code"), teacher_name=teacher_name,
    )

# ── Auth: join class ───────────────────────────────────────────────────────────

@app.post("/auth/join-class")
def join_class(body: JoinClassIn, student: dict = Depends(_require_student)):
    code = body.class_code.upper().strip()
    with db() as cur:
        cur.execute("SELECT id, name FROM users WHERE class_code = %s AND role = 'teacher'", (code,))
        teacher = cur.fetchone()
    if not teacher:
        raise HTTPException(404, "Class code not found")
    with db() as cur:
        cur.execute("UPDATE users SET teacher_id = %s WHERE id = %s", (str(teacher["id"]), str(student["id"])))
    return {"teacher_name": teacher["name"], "teacher_id": str(teacher["id"])}

# ── Auth: forgot/reset password ────────────────────────────────────────────────

@app.post("/auth/forgot-password")
def forgot_password(body: dict):
    return {"message": "If that email is registered you'll receive a reset link shortly."}

@app.post("/auth/reset-password")
def reset_password(body: dict):
    raise HTTPException(501, "Password reset not yet implemented.")

# ── Teacher: routines ──────────────────────────────────────────────────────────

@app.post("/routines", response_model=RoutineOut)
async def create_routine(
    background_tasks: BackgroundTasks,
    video: UploadFile = File(...),
    name: str = Form(...),
    difficulty: str = Form(...),
    description: str = Form(""),
    teacher: dict = Depends(_require_teacher),
):
    if difficulty not in ("easy", "medium", "hard"):
        raise HTTPException(400, "difficulty must be easy, medium, or hard")
    ext = Path(video.filename).suffix.lower()
    if ext not in (".mp4", ".mov", ".webm"):
        raise HTTPException(400, "Video must be MP4, MOV, or WebM")

    content = await video.read()
    if len(content) > MAX_VIDEO_BYTES:
        raise HTTPException(413, "Video too large — maximum is 500 MB")

    rid  = str(uuid.uuid4())
    jid  = str(uuid.uuid4())

    # Save locally for MediaPipe processing
    vpath = UPLOAD_DIR / f"{rid}_ref{ext}"
    vpath.write_bytes(content)

    # Upload to Supabase Storage for streaming preview
    storage_path = f"references/{rid}{ext}"
    ref_video_url = upload_to_storage("videos", storage_path, content,
                                       f"video/{ext.lstrip('.')}")

    with db() as cur:
        cur.execute(
            """INSERT INTO jobs (id, status, progress, created_at, updated_at)
               VALUES (%s, 'processing', 0, NOW(), NOW())""", (jid,)
        )
        cur.execute(
            """INSERT INTO routines (id, teacher_id, name, difficulty, description,
            status, video_path, reference_video_url, archived, created_at, job_id)
            VALUES (%s, %s, %s, %s, %s, 'processing', %s, %s, false, NOW(), %s)""",
            (rid, str(teacher["id"]), name, difficulty, description,
            str(vpath), ref_video_url, jid)
        )

    background_tasks.add_task(_process_reference, rid, str(vpath), jid)
    return _get_routine_out(rid)


@app.get("/routines/{rid}", response_model=RoutineOut)
def get_routine(rid: str, user: dict = Depends(_current_user)):
    r = _get_routine_out(rid)
    if not r:
        raise HTTPException(404, "Routine not found")
    if user["role"] == "student":
        with db() as cur:
            cur.execute("SELECT teacher_id FROM users WHERE id = %s", (str(user["id"]),))
            u = cur.fetchone()
        if not u or str(u["teacher_id"]) != r.teacher_id:
            raise HTTPException(403, "This routine is not in your class")
    return r


@app.get("/routines", response_model=list[RoutineOut])
def list_routines(include_archived: bool = False, user: dict = Depends(_current_user)):
    if user["role"] == "teacher":
        query = "SELECT id FROM routines WHERE teacher_id = %s"
        if not include_archived:
            query += " AND archived = false"
        query += " ORDER BY created_at DESC"
        with db() as cur:
            cur.execute(query, (str(user["id"]),))
            rows = cur.fetchall()
    else:
        with db() as cur:
            cur.execute("SELECT teacher_id FROM users WHERE id = %s", (str(user["id"]),))
            u = cur.fetchone()
        if not u or not u["teacher_id"]:
            return []
        with db() as cur:
            cur.execute(
                "SELECT id FROM routines WHERE teacher_id = %s AND archived = false ORDER BY created_at DESC",
                (str(u["teacher_id"]),)
            )
            rows = cur.fetchall()
    return [_get_routine_out(str(r["id"])) for r in rows]


@app.patch("/routines/{rid}/archive")
def archive_routine(rid: str, teacher: dict = Depends(_require_teacher)):
    with db() as cur:
        cur.execute("UPDATE routines SET archived = true WHERE id = %s AND teacher_id = %s",
                    (rid, str(teacher["id"])))
    return {"archived": True}


@app.patch("/routines/{rid}/unarchive")
def unarchive_routine(rid: str, teacher: dict = Depends(_require_teacher)):
    with db() as cur:
        cur.execute("UPDATE routines SET archived = false WHERE id = %s AND teacher_id = %s",
                    (rid, str(teacher["id"])))
    return {"archived": False}


@app.delete("/routines/{rid}")
def delete_routine(rid: str, teacher: dict = Depends(_require_teacher)):
    with db() as cur:
        cur.execute("DELETE FROM routines WHERE id = %s AND teacher_id = %s",
                    (rid, str(teacher["id"])))
    return {"deleted": True}

# ── Jobs ───────────────────────────────────────────────────────────────────────

@app.get("/jobs/{jid}")
def get_job(jid: str, _: dict = Depends(_current_user)):
    with db() as cur:
        cur.execute("SELECT * FROM jobs WHERE id = %s", (jid,))
        j = cur.fetchone()
    if not j:
        raise HTTPException(404, "Job not found")
    return {"status": j["status"], "progress": j["progress"], "error": j["error"]}

# ── Student: submit ────────────────────────────────────────────────────────────

@app.post("/routines/{rid}/submissions", response_model=SubmissionOut)
async def create_submission(
    background_tasks: BackgroundTasks,
    rid: str,
    video: UploadFile = File(...),
    student: dict = Depends(_require_student),
):
    with db() as cur:
        cur.execute("SELECT * FROM routines WHERE id = %s", (rid,))
        routine = cur.fetchone()
    if not routine:
        raise HTTPException(404, "Routine not found")
    if routine["status"] == "processing":
        raise HTTPException(400, "This routine is still being processed — check back in a few minutes")
    if routine["status"] == "failed":
        raise HTTPException(400, "This routine failed to process — ask your teacher to re-upload")

    content = await video.read()
    if len(content) > MAX_VIDEO_BYTES:
        raise HTTPException(413, "Video too large — maximum is 500 MB")

    sid  = str(uuid.uuid4())
    jid  = str(uuid.uuid4())
    ext  = Path(video.filename).suffix.lower()
    vpath = UPLOAD_DIR / f"{sid}_student{ext}"
    vpath.write_bytes(content)

    with db() as cur:
        cur.execute(
            """INSERT INTO jobs (id, status, progress, created_at, updated_at)
               VALUES (%s, 'processing', 0, NOW(), NOW())""", (jid,)
        )
        cur.execute(
            """INSERT INTO submissions (id, routine_id, student_id, status, video_path, job_id, created_at)
               VALUES (%s, %s, %s, 'processing', %s, %s, NOW())""",
            (sid, rid, str(student["id"]), str(vpath), jid)
        )

    background_tasks.add_task(_process_submission, sid, rid, str(vpath), jid)
    return _get_submission_out(sid)


@app.get("/submissions/{sid}", response_model=SubmissionOut)
def get_submission(sid: str, user: dict = Depends(_current_user)):
    s = _get_submission_out(sid)
    if not s:
        raise HTTPException(404, "Not found")
    if user["role"] == "student" and s.student_id != str(user["id"]):
        raise HTTPException(403, "Not your submission")
    return s


@app.get("/routines/{rid}/submissions", response_model=list[SubmissionOut])
def submissions_for_routine(rid: str, teacher: dict = Depends(_require_teacher)):
    with db() as cur:
        cur.execute("SELECT id FROM submissions WHERE routine_id = %s ORDER BY created_at DESC", (rid,))
        rows = cur.fetchall()
    return [_get_submission_out(str(r["id"])) for r in rows]


@app.get("/students/me/submissions", response_model=list[SubmissionOut])
def my_submission_history(student: dict = Depends(_require_student)):
    with db() as cur:
        cur.execute("SELECT id FROM submissions WHERE student_id = %s ORDER BY created_at DESC",
                    (str(student["id"]),))
        rows = cur.fetchall()
    return [_get_submission_out(str(r["id"])) for r in rows]

# ── Teacher: class roster ──────────────────────────────────────────────────────

@app.get("/teacher/students")
def class_roster(teacher: dict = Depends(_require_teacher)):
    with db() as cur:
        cur.execute(
            """SELECT u.id, u.name, u.email, u.created_at,
               COUNT(s.id) as submission_count
               FROM users u
               LEFT JOIN submissions s ON s.student_id = u.id
               WHERE u.teacher_id = %s AND u.role = 'student'
               GROUP BY u.id ORDER BY u.created_at""",
            (str(teacher["id"]),)
        )
        rows = cur.fetchall()
    return [{"user_id": str(r["id"]), "name": r["name"], "email": r["email"],
             "joined": r["created_at"].timestamp(),
             "submission_count": r["submission_count"]} for r in rows]

# ── Background processing ──────────────────────────────────────────────────────

def _update_job(jid: str, progress: int = None, status: str = None, error: str = None):
    parts = []
    vals  = []
    if progress is not None: parts.append("progress = %s"); vals.append(progress)
    if status   is not None: parts.append("status = %s");   vals.append(status)
    if error    is not None: parts.append("error = %s");    vals.append(error)
    parts.append("updated_at = NOW()")
    vals.append(jid)
    with db() as cur:
        cur.execute(f"UPDATE jobs SET {', '.join(parts)} WHERE id = %s", vals)


async def _process_reference(rid: str, vpath: str, jid: str):
    try:
        _update_job(jid, progress=10)
        # out = str(RESULTS_DIR / f"{rid}_pose.json")
        out = str(RESULTS_DIR / f"{rid}_pose.json").replace("\\", "/")
        await asyncio.to_thread(
            extract_pose_sequence, vpath, out,
            lambda p: _update_job(jid, progress=10 + int(p * 85))
        )
        with db() as cur:
            cur.execute("UPDATE routines SET status = 'ready', pose_data_path = %s WHERE id = %s",
                        (out, rid))
        _update_job(jid, progress=100, status="complete")
    except Exception as e:
        with db() as cur:
            cur.execute("UPDATE routines SET status = 'failed' WHERE id = %s", (rid,))
        _update_job(jid, status="failed", error=str(e))


async def _process_submission(sid: str, rid: str, vpath: str, jid: str):
    try:
        _update_job(jid, progress=5)
        # student_pose = str(RESULTS_DIR / f"{sid}_pose.json")
        student_pose = str(RESULTS_DIR / f"{sid}_pose.json").replace("\\", "/")
        await asyncio.to_thread(
            extract_pose_sequence, vpath, student_pose,
            lambda p: _update_job(jid, progress=5 + int(p * 40))
        )
        _update_job(jid, progress=50)

        with db() as cur:
            cur.execute("SELECT pose_data_path, video_path FROM routines WHERE id = %s", (rid,))
            routine = cur.fetchone()

        ref_pose_path  = routine["pose_data_path"].replace("\\", "/")
        ref_video_path = routine["video_path"].replace("\\", "/")

        scores = await asyncio.to_thread(compare_sequences, ref_pose_path, student_pose)
        _update_job(jid, progress=75)

        overlay      = str(RESULTS_DIR / f"{sid}_overlay.mp4")
        overlay_ok, overlay_error = await asyncio.to_thread(
            generate_skeleton_overlay,
            ref_video_path, vpath,
            ref_pose_path, student_pose, overlay
        )

        # Upload overlay to Supabase Storage
        if overlay_ok:
            import subprocess
            converted = overlay.replace(".mp4", "_web.mp4")
            subprocess.run([
                "ffmpeg", "-i", overlay, "-vcodec", "libx264",
                "-acodec", "aac", converted, "-y"
            ], capture_output=True)
            if Path(converted).exists():
                overlay = converted

        overlay_url = None
        if overlay_ok:
            pub_url = upload_file_to_storage("results", f"overlays/{sid}_overlay.mp4", overlay)
            overlay_url = pub_url if pub_url else f"/results/{sid}_overlay.mp4"

        with db() as cur:
            cur.execute(
                """UPDATE submissions SET status = 'ready', overall_score = %s,
                   joint_scores = %s, overlay_url = %s, overlay_error = %s WHERE id = %s""",
                (scores["overall"], json.dumps(scores["joints"]),
                 overlay_url, overlay_error if not overlay_ok else None, sid)
            )
        _update_job(jid, progress=100, status="complete")
    except Exception as e:
        with db() as cur:
            cur.execute("UPDATE submissions SET status = 'failed', error = %s WHERE id = %s",
                        (str(e), sid))
        _update_job(jid, status="failed", error=str(e))

# ── Serialisers ────────────────────────────────────────────────────────────────

def _get_routine_out(rid: str) -> Optional[RoutineOut]:
    with db() as cur:
        cur.execute("SELECT * FROM routines WHERE id = %s", (rid,))
        r = cur.fetchone()
        if not r:
            return None
        cur.execute("SELECT COUNT(*) as cnt FROM submissions WHERE routine_id = %s", (rid,))
        cnt = cur.fetchone()["cnt"]
        cur.execute("SELECT name FROM users WHERE id = %s", (str(r["teacher_id"]),))
        teacher = cur.fetchone()

    job_status = job_progress = None
    if r.get("job_id"):
        try:
            with db() as cur:
                cur.execute("SELECT status, progress FROM jobs WHERE id = %s", (str(r["job_id"]),))
                j = cur.fetchone()
                if j:
                    job_status   = j["status"]
                    job_progress = j["progress"]
        except Exception:
            pass

    return RoutineOut(
        id=str(r["id"]), name=r["name"], difficulty=r["difficulty"],
        description=r["description"] or "",
        teacher_id=str(r["teacher_id"]),
        teacher_name=teacher["name"] if teacher else "",
        status=r["status"],
        job_id=str(r["job_id"]) if r.get("job_id") else None,
        job_status=job_status, job_progress=job_progress,
        archived=r["archived"],
        reference_video_url=r.get("reference_video_url"),
        created_at=r["created_at"].timestamp(),
        submission_count=cnt,
    )


def _get_submission_out(sid: str) -> Optional[SubmissionOut]:
    with db() as cur:
        cur.execute("SELECT * FROM submissions WHERE id = %s", (sid,))
        s = cur.fetchone()
        if not s:
            return None
        cur.execute("SELECT name FROM routines WHERE id = %s", (str(s["routine_id"]),))
        routine = cur.fetchone()
        cur.execute("SELECT name FROM users WHERE id = %s", (str(s["student_id"]),))
        student = cur.fetchone()

    joint_scores = s["joint_scores"]
    if isinstance(joint_scores, str):
        joint_scores = json.loads(joint_scores)

    return SubmissionOut(
        id=str(s["id"]), routine_id=str(s["routine_id"]),
        routine_name=routine["name"] if routine else "",
        student_id=str(s["student_id"]),
        student_name=student["name"] if student else "",
        status=s["status"], error=s.get("error"),
        overall_score=float(s["overall_score"]) if s["overall_score"] else None,
        joint_scores=joint_scores,
        overlay_url=s.get("overlay_url"),
        overlay_error=s.get("overlay_error"),
        created_at=s["created_at"].timestamp(),
        job_id=str(s["job_id"]) if s.get("job_id") else None,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
