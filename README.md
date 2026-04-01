# MoveMatch — MVP

Upload a reference dance video. Students upload their practice. Get instant pose comparison.

---

## Project Structure

```
movematch/
├── backend/
│   ├── main.py               ← FastAPI app (all routes)
│   ├── pose_extractor.py     ← MediaPipe keypoint extraction
│   ├── comparison_engine.py  ← DTW alignment + scoring + overlay render
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/client.js     ← All backend HTTP calls
│   │   ├── components/       ← Shared UI (Card, Button, ScoreRing, etc.)
│   │   ├── pages/
│   │   │   ├── HomePage.jsx        ← Routine listing
│   │   │   ├── TeacherUpload.jsx   ← Teacher uploads reference video
│   │   │   ├── RoutinePage.jsx     ← Student uploads practice video
│   │   │   └── ResultsPage.jsx     ← Score breakdown + skeleton replay
│   │   ├── App.jsx           ← Client-side router
│   │   └── main.jsx          ← React entry point
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── database/
    └── schema.sql            ← Postgres schema (for production upgrade)
```

---

## Quick Start

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
# → http://localhost:8000
```

**Note:** MediaPipe requires Python 3.9–3.11 and a 64-bit OS.
If MediaPipe is not installed, `pose_extractor.py` automatically falls back
to synthetic stub data so you can develop the UI without it.

### Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

---

## User Flow

### Teacher
1. Click **+ Upload Routine** in the nav
2. Upload your reference video (MP4/MOV/WebM)
3. Fill in name, difficulty, description, your name
4. Wait ~1–3 min for pose extraction to complete
5. Copy the share link and send to students

### Student
1. Open the share link from their teacher
2. Click **Analyse My Performance**
3. Upload their practice video
4. Wait ~1–3 min for comparison
5. See overall score, joint breakdown, and skeleton replay

---

## How the Scoring Works

1. **Pose extraction** — MediaPipe Pose runs at ~5fps on both videos, producing
   17 named keypoints (shoulders, elbows, wrists, hips, knees, ankles, feet, nose)
   per frame.

2. **Normalisation** — Each frame is normalised to shoulder-width scale so a
   tall student isn't penalised against a short reference.

3. **DTW alignment** — Dynamic Time Warping aligns the two sequences in time,
   handling differences in tempo and total video length.

4. **Scoring** — For each aligned frame pair, Euclidean distance per joint is
   converted to a 0–100 score. Joints are weighted (wrists highest for mudras,
   nose lowest). The final score is a weighted average across all frames.

5. **Overlay** — A side-by-side skeleton video is rendered (blue = reference,
   green/amber/red = student) so students can visually identify discrepancies.

---

## Production Checklist

- [ ] Replace in-memory `routines_db` / `submissions_db` with Postgres (schema in `database/schema.sql`)
- [ ] Add file size limit (500MB) and virus scan on upload
- [ ] Move video/result files to S3 or Supabase Storage
- [ ] Add rate limiting on upload endpoints
- [ ] Set `VITE_API_URL` in frontend `.env.local` to your deployed API
- [ ] Tighten CORS `allow_origins` to your frontend domain
- [ ] Add teacher auth (Supabase Auth is the easiest path)

---

## Environment Variables

### Frontend (`frontend/.env.local`)
```
VITE_API_URL=https://your-api.com   # leave blank for local dev
```

### Backend
No env vars needed for MVP. Add these when upgrading to Postgres/Supabase:
```
DATABASE_URL=postgresql://...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=...
```
