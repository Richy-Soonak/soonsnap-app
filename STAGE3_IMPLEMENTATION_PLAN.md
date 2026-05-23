# Stage 3: Editor + Timeline — Implementation Plan

## Codebase Summary

### Current State of Each File

**1. `src/app/(app)/editor/page.tsx`** (392 lines)
- Functional "Create Video" page: URL input → style/duration picker → pipeline execution
- Pipeline runs **synchronously in the browser**: `handleGenerate()` calls `/api/capture` then `/api/render` sequentially, blocking the UI
- Can load an existing project via `?project=UUID` and show its latest video
- **No prompt editing**, no re-render, no version awareness, no timeline
- Creates only version 1; no mechanism to produce subsequent versions

**2. `src/app/(app)/project/[id]/page.tsx`** (166 lines)
- Read-only project detail page showing project info, video player, and version history list
- Lists versions in a simple vertical list (vN, prompt text, status badge, timestamp)
- **No edit/re-render actions**, no comparison, no revert, no thumbnails
- Purely informational — essentially a dead end

**3. `src/app/(app)/videos/page.tsx`** (15 lines)
- **Placeholder** — just a "Coming in Stage 3" stub with no functionality

**4. `src/app/api/render/route.ts`** (204 lines)
- Synchronous render pipeline: receives `projectId` + `style` + `duration` + `tokens`
- Calls NVIDIA NIM for AI composition → writes HTML → runs `hyperframes render` via `execSync` → creates version record → returns video URL
- `maxDuration = 300` (5 min) but Next.js dev server kills at ~60s
- Creates version with auto-incrementing `version_num`
- Uses `soonsnap_render_log` for daily render counting
- **No background processing**, no job tracking, no progress events

**5. `src/app/api/enhance/route.ts`** (18 lines)
- **Stub** — accepts `{ jobId, style }` and returns `{ status: "enhancing" }` with a `// TODO` comment
- No actual implementation

**6. `src/app/api/project/route.ts`** (87 lines)
- `GET /api/project?id=UUID` — returns project + versions
- `POST /api/project` — creates a project (used externally or by editor)
- No PATCH/PUT for updates, no version-specific operations

**7. `src/app/api/video/[id]/route.ts`** (61 lines)
- Serves MP4 files from `/tmp/soonsnap-videos/{id}.mp4` with range request support
- No thumbnail serving, no version-specific video serving (always serves `{projectId}.mp4` so **new renders overwrite previous ones**)

**8. `src/types/index.ts`** (51 lines)
- Well-defined types: `Project`, `Version`, `UserProfile`, `CreditBalance`, `Wallet`, `RenderCounts`
- `Version` already includes `enhanced_prompt`, `thumbnail_url`, `duration` — **fields exist in types but are never populated**
- `Version.status` includes `'pending' | 'rendering' | 'complete' | 'failed'` — `pending` is never used

**9. Database Schema** (inferred from code)
- `soonsnap_projects`: id, user_id, url, title, status, created_at, updated_at
- `soonsnap_versions`: id, project_id, version_num, prompt, enhanced_prompt, video_url, thumbnail_url, duration, status, created_at
- `soonsnap_render_log`: user_id (used for daily render counting)

---

## Gap Analysis: What Exists vs What's Needed

| Feature | Exists? | Gap |
|---------|---------|-----|
| **Background job queue** | ❌ | Pipeline is synchronous. Next.js kills API routes at ~60s. Need async job system. |
| **Version timeline UI** | Partial | Project page lists versions as text rows. No visual timeline, no thumbnails, no interactivity. |
| **Video preview player** | ✅ Basic | `<video controls>` works. But no frame scrubbing, no time display, no looping toggle. |
| **Prompt enhancer** | ❌ Stub | `/api/enhance` returns a TODO placeholder. No AI prompt improvement logic. |
| **Edit workflow** (prompt → enhance → render → new version) | ❌ | Editor only creates v1. No way to edit prompt on existing project and re-render. |
| **Version comparison** | ❌ | No side-by-side or A/B player. No diff view. |
| **Revert** | ❌ | No way to set a previous version as "active" or re-promote it. |
| **Project list with thumbnails** | ❌ | Dashboard lists projects as cards with text only. Videos page is empty. |
| **Thumbnail generation** | ❌ | `thumbnail_url` field exists in types/DB but is never populated. |
| **Video per-version storage** | ❌ | Videos stored as `{projectId}.mp4` — re-renders overwrite! Must be `{projectId}_v{N}.mp4`. |
| **Job status polling** | ❌ | No mechanism for frontend to track background render progress. |
| **Real-time updates** | ❌ | No SSE/WebSocket/polling for render status. |

---

## Database Schema Changes

### 1. New Table: `soonsnap_jobs` (Background Job Queue)

```sql
CREATE TABLE soonsnap_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES soonsnap_projects(id) ON DELETE CASCADE,
  version_id UUID REFERENCES soonsnap_versions(id),
  job_type TEXT NOT NULL CHECK (job_type IN ('capture', 'compose', 'render', 'full_pipeline')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'complete', 'failed')),
  progress INTEGER DEFAULT 0,  -- 0-100
  input_payload JSONB DEFAULT '{}',  -- {style, duration, prompt, tokens, etc}
  result_payload JSONB DEFAULT '{}',  -- {videoUrl, error, etc}
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jobs_project ON soonsnap_jobs(project_id);
CREATE INDEX idx_jobs_status ON soonsnap_jobs(status);
```

### 2. Alter `soonsnap_versions` Table

```sql
-- Add fields needed for Stage 3
ALTER TABLE soonsnap_versions ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT false;
ALTER TABLE soonsnap_versions ADD COLUMN IF NOT EXISTS render_params JSONB DEFAULT '{}';
ALTER TABLE soonsnap_versions ADD COLUMN IF NOT EXISTS file_path TEXT;

-- Ensure only one active version per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_versions_active 
  ON soonsnap_versions(project_id) WHERE active = true;
```

### 3. Alter `soonsnap_projects` Table

```sql
ALTER TABLE soonsnap_projects ADD COLUMN IF NOT EXISTS active_version_id UUID REFERENCES soonsnap_versions(id);
ALTER TABLE soonsnap_projects ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
```

---

## Prioritized Implementation Plan

### Phase 1: Background Job System (Critical — unblocks everything else)

**Why first**: The synchronous pipeline is the #1 production blocker. Every Stage 3 feature depends on renders not timing out.

#### Approach: Simple DB-backed queue (NOT BullMQ)

BullMQ requires Redis which adds infrastructure complexity. A **DB-backed queue** using the `soonsnap_jobs` table is simpler and sufficient for current scale. A single long-running worker process polls the table.

#### Files to Create/Modify:

**NEW: `src/lib/job-queue.ts`** (~150 lines)
- `enqueueJob(projectId, jobType, payload)` — inserts into `soonsnap_jobs`
- `claimNextJob()` — atomically claims the next `queued` job (UPDATE ... WHERE status='queued' LIMIT 1 RETURNING *)
- `updateJobProgress(jobId, progress, status)` — updates progress %
- `completeJob(jobId, result)` — marks complete with result payload
- `failJob(jobId, error)` — marks failed with error message

**NEW: `src/workers/render-worker.ts`** (~200 lines)
- Standalone Node.js script (runs via `tsx src/workers/render-worker.ts`)
- Infinite loop: claim job → execute pipeline steps → update progress
- Pipeline: capture → compose (NIM AI) → render (hyperframes) → thumbnail extraction → create version → complete
- Writes version-specific video files: `{projectId}_v{N}.mp4`
- Extracts thumbnail via `ffmpeg -i video.mp4 -ss 00:00:01 -frames:v 1 thumbnail.jpg`
- Retry logic: up to `max_attempts`

**NEW: `src/app/api/jobs/[id]/route.ts`** (~40 lines)
- `GET` — returns job status + progress for polling
- Frontend polls this every 2s during render

**MODIFY: `src/app/api/render/route.ts`**
- Change from synchronous execution to: create version record → enqueue job → return jobId immediately
- Keep the `generateComposition()` function (move to shared lib)
- Return `{ ok: true, jobId, versionId }` instead of `{ ok: true, videoUrl }`

**MODIFY: `src/app/api/capture/route.ts`**
- Extract capture logic into a shared function that the worker can call
- API route becomes a thin wrapper that enqueues

**NEW: `package.json` additions**
```json
{
  "scripts": {
    "worker": "tsx src/workers/render-worker.ts"
  }
}
```

---

### Phase 2: Edit Workflow (prompt → enhance → render → new version)

#### Files to Modify:

**MODIFY: `src/app/(app)/editor/page.tsx`** — Major refactor
- Add a "Prompt Editor" section that appears when a project is loaded
- Textarea for custom prompt (pre-populated with current version's style/prompt)
- "Enhance Prompt" button → calls `/api/enhance`
- "Generate New Version" button → calls `/api/render` with `projectId` + new prompt
- Show progress via polling `/api/jobs/[id]`
- On completion, auto-load the new version's video
- Pipeline step indicators become progress-aware (polling job progress)

**Key UI additions to editor:**
```
┌─────────────────────────────────────┐
│ Prompt Editor                       │
│ ┌─────────────────────────────────┐ │
│ │ [textarea: current prompt]      │ │
│ └─────────────────────────────────┘ │
│ [✨ Enhance Prompt] [🎬 Render v2]  │
│                                     │
│ Pipeline: ●──●──●  Rendering 45%   │
└─────────────────────────────────────┘
```

**REWRITE: `src/app/api/enhance/route.ts`** (~60 lines)
- Accept `{ prompt, style, context (tokens) }`
- Call NVIDIA NIM with a system prompt to enhance the user's prompt for better video composition
- System prompt: "You are a video production prompt engineer. Enhance this prompt for a ${duration}s ${style} promotional video..."
- Return `{ enhancedPrompt }`
- Optionally store `enhanced_prompt` on the version record

---

### Phase 3: Version Timeline UI

#### Files to Create/Modify:

**MODIFY: `src/app/(app)/project/[id]/page.tsx`** — Major expansion
- Replace the flat version list with a **visual timeline component**
- Each version node shows: thumbnail (or placeholder), version number, prompt excerpt, status badge, timestamp
- Click a version → loads that version's video in the player
- "Compare" button on each version → opens side-by-side view
- "Revert" button → marks that version as active
- "Edit & Re-render" button → navigates to `/editor?project={id}&version={vNum}`

**NEW: `src/components/version-timeline.tsx`** (~200 lines)
- Horizontal or vertical timeline component
- Props: `versions: Version[]`, `activeVersionId: string`, `onSelectVersion`, `onCompare`, `onRevert`
- Visual design: dots on a line, with thumbnail cards branching off

**NEW: `src/components/version-card.tsx`** (~80 lines)
- Individual version display card
- Shows thumbnail, version number, prompt preview, status, actions
- Used in both timeline and comparison views

**NEW: `src/app/api/project/[id]/versions/route.ts`** (~50 lines)
- `POST` — Create a new version (re-render) from an existing project
- Accept `{ prompt, style, duration, enhancedPrompt }`
- Creates version record → enqueues render job

**NEW: `src/app/api/project/[id]/revert/route.ts`** (~30 lines)
- `POST` — Set a specific version as active
- Updates `soonsnap_projects.active_version_id`
- Updates `soonsnap_versions.active` flags

---

### Phase 4: Video Per-Version Storage & Thumbnail Generation

#### Files to Modify:

**MODIFY: Video storage in render worker**
- Change from `/tmp/soonsnap-videos/{projectId}.mp4` → `/tmp/soonsnap-videos/{projectId}_v{N}.mp4`
- Store thumbnails at `/tmp/soonsnap-thumbnails/{projectId}_v{N}.jpg`

**MODIFY: `src/app/api/video/[id]/route.ts`**
- Change to `src/app/api/video/[id]/[version]/route.ts` OR add `?version=N` query param
- Serve the version-specific MP4 file
- For backward compatibility: no version param → serve latest active version

**NEW: `src/app/api/thumbnail/[id]/[version]/route.ts`** (~40 lines)
- Serve thumbnail JPEG for a specific project version
- Similar to video serving but for images

**In render worker:**
- After render completes, extract thumbnail:
  ```bash
  ffmpeg -i "{videoPath}" -ss 00:00:01 -frames:v 1 -q:v 2 "{thumbnailPath}"
  ```
- Update version record with `thumbnail_url` and `file_path`

---

### Phase 5: Version Comparison

#### Files to Create:

**NEW: `src/components/version-compare.tsx`** (~150 lines)
- Side-by-side video players
- Synchronized playback (play/pause both simultaneously)
- Version info overlay (prompt, style, duration)
- "Keep This" button to select a winner

**MODIFY: `src/app/(app)/project/[id]/page.tsx`**
- Add comparison mode state
- When two versions are selected for comparison, render `<VersionCompare>` component
- URL-driven: `/project/{id}?compare=v1&compare=v2`

---

### Phase 6: Project List with Thumbnails (Videos Page)

**REWRITE: `src/app/(app)/videos/page.tsx`** (~120 lines)
- Grid of all user's projects with video thumbnails
- Each card: thumbnail image, project title, version count, latest version status, date
- Click → navigate to project detail
- Filter/sort: by status, by date, by title search
- Pagination or infinite scroll

**MODIFY: `src/app/(app)/dashboard/page.tsx`**
- Add thumbnail images to project cards
- Show version count on each card
- Link to `/project/{id}` instead of `/editor?project={id}` (keep editor for new creates)

---

## Implementation Priority Order

| Priority | Phase | Effort | Impact |
|----------|-------|--------|--------|
| **P0** | Phase 1: Background Job System | 2-3 days | Unblocks production renders |
| **P0** | Phase 2: Edit Workflow | 1-2 days | Core Stage 3 flow |
| **P1** | Phase 3: Version Timeline UI | 1-2 days | Primary UX deliverable |
| **P1** | Phase 4: Per-Version Storage + Thumbnails | 1 day | Required for comparison |
| **P2** | Phase 5: Version Comparison | 1 day | Nice-to-have feature |
| **P2** | Phase 6: Videos Page | 0.5 day | Polish item |

**Total estimate: 6-9 days**

---

## Verification Checklist (from the issue)

Stage 3 verification: `render → edit → see new version → compare → revert`

1. **Render**: Create new project → generates v1 → video appears ✅ (exists)
2. **Edit**: On project page, edit prompt → enhance → re-render → creates v2 ✅ (Phase 2)
3. **See new version**: v2 appears in timeline, auto-loads in player ✅ (Phase 3)
4. **Compare**: Select v1 and v2 → side-by-side playback ✅ (Phase 5)
5. **Revert**: Click "Revert to v1" → v1 becomes active version ✅ (Phase 3)

---

## Key Architecture Decisions

1. **DB-backed queue over BullMQ/Redis**: Simpler, fewer dependencies, adequate for current scale. Can migrate to BullMQ later if needed.

2. **Worker as separate process**: Runs via `npm run worker` alongside `npm run dev`. In production, use PM2 or systemd.

3. **Version-specific file paths**: Critical change — prevents new renders from overwriting old versions. The current `{projectId}.mp4` naming is a bug for multi-version support.

4. **Polling over WebSockets**: Frontend polls `/api/jobs/[id]` every 2s. Simpler than WebSocket setup. Can upgrade to Supabase Realtime later (it's already self-hosted).

5. **ffmpeg for thumbnails**: Already likely available on the server (hyperframes may depend on it). One-command extraction, no extra dependencies.

6. **`active` version flag**: Instead of deleting versions, we flag one as `active`. This supports the revert workflow naturally.
