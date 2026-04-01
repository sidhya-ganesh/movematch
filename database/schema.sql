-- MoveMatch v2 — PostgreSQL / Supabase schema
-- Run in the Supabase SQL editor. Includes auth, class codes, student history.

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ── Users ──────────────────────────────────────────────────────────────────────
create table users (
    id               uuid primary key default uuid_generate_v4(),
    email            text not null unique,
    password_hash    text not null,
    name             text not null,
    role             text not null check (role in ('teacher','student')),
    -- Teachers only
    class_code       text unique,
    -- Students only
    teacher_id       uuid references users(id) on delete set null,
    created_at       timestamptz not null default now()
);

create index on users (email);
create index on users (class_code);
create index on users (teacher_id);

-- ── Routines ───────────────────────────────────────────────────────────────────
create table routines (
    id                   uuid primary key default uuid_generate_v4(),
    teacher_id           uuid not null references users(id) on delete cascade,
    name                 text not null,
    difficulty           text not null check (difficulty in ('easy','medium','hard')),
    description          text,
    status               text not null default 'processing'
                            check (status in ('processing','ready','failed')),
    video_path           text,
    reference_video_url  text,      -- public URL once uploaded to Supabase Storage
    pose_data_path       text,
    created_at           timestamptz not null default now(),
    archived             boolean not null default false  -- teacher soft-delete / hide
);

create index on routines (teacher_id);
create index on routines (status);
create index on routines (archived);

-- ── Processing jobs ────────────────────────────────────────────────────────────
create table jobs (
    id          uuid primary key default uuid_generate_v4(),
    status      text not null default 'processing'
                    check (status in ('processing','complete','failed')),
    progress    integer not null default 0 check (progress between 0 and 100),
    error       text,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- ── Submissions ────────────────────────────────────────────────────────────────
create table submissions (
    id             uuid primary key default uuid_generate_v4(),
    routine_id     uuid not null references routines(id) on delete cascade,
    student_id     uuid not null references users(id) on delete cascade,
    status         text not null default 'processing'
                      check (status in ('processing','ready','failed')),
    video_path     text,
    overall_score  numeric(5,2),
    joint_scores   jsonb,
    overlay_url    text,
    overlay_error  text,
    job_id         uuid references jobs(id),
    created_at     timestamptz not null default now()
);

create index on submissions (routine_id);
create index on submissions (student_id);
create index on submissions (status);

-- ── Row-level security ─────────────────────────────────────────────────────────
-- Supabase: enable after wiring JWT claims.
-- Teachers can CRUD their own routines + read all submissions for those routines.
-- Students can read routines belonging to their teacher, and CRUD their own submissions.

-- alter table users       enable row level security;
-- alter table routines    enable row level security;
-- alter table submissions enable row level security;
-- alter table jobs        enable row level security;

-- Example policies (uncomment when ready):
-- create policy "Teachers manage own routines"
--     on routines for all
--     using (teacher_id = auth.uid());

-- create policy "Students read class routines"
--     on routines for select
--     using (teacher_id = (select teacher_id from users where id = auth.uid()));

-- create policy "Students manage own submissions"
--     on submissions for all
--     using (student_id = auth.uid());

-- create policy "Teachers read class submissions"
--     on submissions for select
--     using (routine_id in (select id from routines where teacher_id = auth.uid()));
