# LUMIO — Complete Project Context
## Paste this at the start of any new Claude conversation to get full context instantly.

---

## PROJECT IDENTITY
| Field | Value |
|---|---|
| Team name | Unblur |
| Product name | Lumio |
| Tagline | Where every student is seen, every struggle is understood, every parent is informed |
| Event | IEEE CODE2CURE SIGHT Day Congress 4.0 |
| Teams | TBS & INSAT IEEE Student Branches (collaborative submission) |
| Clinical advisor | Enrolled medical student — validates all features against DSM-5 and clinical standards |
| Target age group | 10–18 (primary focus 10–15) |
| Platform | Web (React) + Mobile (React Native + Expo) |
| Phase | Phase 2 MVP — Technical Development (due April 16, 2026) |
| Final pitch | April 18, 2026 — 5-min pitch + 2-min demo + 5-min Q&A |

---

## PROBLEM STATEMENT

**Core gap:** Tunisian primary and middle school students with ADHD have no coordinated real-time tool connecting student + teacher + parent.

**Key statistics (use these in pitch):**
- ADHD affects 7.6% of children (3–12) and 5.6% of adolescents (12–18) globally [Frontiers in Psychology 2025]
- Tunisia Monastir (2022): 18.1% of high school students show ADHD symptoms
- Tunisia Sfax (2021): 9.94% of primary school children affected
- 72.54% of affected Tunisian children have ≥1 comorbid condition (anxiety 31.37%, learning disabilities 23.52%)
- 33.2% of affected students fail to graduate on time [Springer 2022, PMC 2024]
- Only 32% of students receive any behavioral classroom support [ADHDAdvisor 2024]
- Only 31% of parents receive any behavioral guidance
- ~1/3 of teachers cannot distinguish ADHD from disengagement

**SDG alignment:**
- SDG 3 — Good Health & Well-being (Target 3.4: early mental health support)
- SDG 4 — Quality Education (Target 4.5: equitable learning)
- SDG 10 — Reduced Inequalities (Target 10.2: inclusion of neurodiverse learners)

---

## FULL SYSTEM ARCHITECTURE

### Layer map
```
LAYER 1 — FRONTEND      React (web) + React Native + Expo (mobile)
                        MediaPipe FaceMesh CDN (CV, browser-only)
                        Native WebSocket, react-i18next (AR/FR/EN)

LAYER 2 — API GATEWAY   FastAPI + JWT (15min tokens) + slowapi rate limiting
                        CORS + native Starlette WebSocket

LAYER 3 — BACKEND       Session Analytics: XGBoost + RF/MLP + Rule Engine + Recommender
                        RAG Engine: FAISS + LangChain
                        n8n: 4 automation workflows (HTTP webhook triggered)

LAYER 4 — DATA          PostgreSQL (relational) + Redis (live state + pub/sub)
                        FAISS (vector index, in-memory) + Supabase Storage (files)

LAYER 5 — DEPLOY        Docker + Railway (backend + n8n) + Vercel (frontend) + Expo Go (mobile)
```

### Critical design rules
- **CV runs browser-side only** — MediaPipe processes and discards every frame locally. Zero video transmitted. Only numerical focus_score JSON (~40 bytes/sec) sent to server.
- **All other AI runs server-side** — XGBoost, RF/MLP, Rule Engine, FAISS, LangChain, LLM API calls — all Python backend.
- **Data layer = storage only** — FAISS loaded into RAG service memory at startup. PostgreSQL/Redis never run inference.

### Data flow (step by step)
```
[01] Student opens session → React loads MediaPipe via CDN script tag
[02] MediaPipe reads webcam → gaze_x, gaze_y, blink_rate, head_pose_deg → frame discarded
[03] focus_score = 0.4*gaze + 0.3*(1-blink_norm) + 0.3*(1-pose_norm) sent via WebSocket ~1/sec
[04] FastAPI: SET Redis session:live:{student_id} = payload (TTL 7200s)
[05] FastAPI: PUBLISH to Redis pubsub:class:{class_id}
[06] Teacher dashboard: SUBSCRIBE pubsub:class:{class_id} → receives update ~1ms
[07] Every 60s: batch INSERT 60 rows into focus_events (PostgreSQL)
[08] XGBoost classifier: labels cause (fatigue/difficulty/environment/unknown)
[09] IF distraction_streak >= 5min → POST to n8n /webhook/focus_alert
[10] n8n: teacher email (SendGrid) → parent email if opted in → log notification
[11] Nightly (n8n cron): RF+MLP batch runs on 30-day aggregates → writes adhd_risk_profiles
[12] Rule engine: (cause + risk_score) → archetype (PERSISTENT_ADHD_RISK, SIMPLE_FATIGUE, etc.)
[13] Recommender: archetype → FAISS top-4 chunks → LangChain prompt → Claude API
[14] LLM returns JSON: {summary, for_teacher[], for_student[], for_parent[], sources[], urgency, professional_referral}
[15] Pydantic validation + grounding check + diagnosis filter → store in adhd_risk_profiles → dispatch to dashboards
```

---

## THREE INTERFACES

### Student Interface
- Study session tracker (start/stop, subject selector)
- CV focus module (MediaPipe WASM via CDN, webcam, sends focus_score/s)
- Focus score visualization (0–100, red/amber/green bar)
- AI companion chatbot (for_student suggestions, age-appropriate tone)
- Homework submission (view assignments, text/file submit, due dates)
- Progress tracking (focus trends, XP points, streak counter)
- Break suggester (triggered when focus drops, 2-min breathing exercise)

### Teacher Interface
- Real-time class dashboard (live focus_score per student via WebSocket, risk tier badges)
- Weekly class heatmap (which students struggled, which subjects, which days)
- DSM-5 behavioral screening form (per student, suspicion score, low/med/high tiers, action plan)
- RAG teaching assistant chatbot (FAISS-grounded, student context injected)
- Auto-generated parent report (one click, plain language, AR/FR/EN)
- Homework space (create/assign/deadline/difficulty 1–5)
- Parent communication channel

### Parent Interface
- Child analytics dashboard (focus trends, session history, homework completion)
- Progress timeline (weekly focus trend chart)
- Home habit suggestions (grounded in clinical notes: screen time, sleep, diet/caffeine)
- RAG parenting assistant chatbot
- Teacher messaging (direct thread)
- Homework follow-up view

**Access control:** At ages 14–15, parental dashboard access is student-controlled. Parent API endpoint returns filtered projection (for_parent suggestions only — risk_score and risk_tier NEVER returned to parent role).

---

## BACKEND SERVICES

### XGBoost Distraction Classifier
- **Input:** avg_focus_60s, focus_std_60s, blink_rate, head_pose_deg, time_of_day_norm, session_duration_sec, subject_id_encoded
- **Output:** cause ∈ {fatigue, difficulty, environment, unknown} + confidence (0–1)
- **Training:** 2000 synthetic samples (500/class), clinically motivated distributions
- **Inference:** ~5ms per batch

### RF/MLP ADHD Risk Profiler
- **Input:** avg_focus_30d, focus_variance_30d, distraction_rate_per_hour, hw_fail_rate, session_duration_trend, parent_form_score
- **Output:** risk_score (0–1), risk_tier ∈ {low, moderate, needs_attention}, top_signals (SHAP), professional_referral (bool)
- **Run schedule:** Nightly batch via n8n cron — NEVER on live request

### Rule Engine (pure Python — deterministic)
Priority-ordered, first match wins:

| Priority | Cause | Risk | Extra | Archetype | Referral |
|---|---|---|---|---|---|
| 1 | any | >0.75 | streak>7d | PERSISTENT_ADHD_RISK | TRUE |
| 2 | fatigue | >0.5 | session>90min | SUSTAINED_FATIGUE_HIGH_RISK | FALSE |
| 3 | difficulty | any | hw_grade<8 | SUBJECT_DIFFICULTY_STRUGGLE | FALSE |
| 4 | fatigue | <0.5 | — | SIMPLE_FATIGUE | FALSE |
| 5 | environment | any | — | ENVIRONMENTAL_DISTRACTION | FALSE |
| 6 | difficulty | any | — | CONTENT_DIFFICULTY | FALSE |
| 7 | unknown | any | — | GENERAL_DISTRACTION | FALSE |

**Rule engine ALWAYS overrides LLM professional_referral value.**

### RAG Engine
- **Stack:** LangChain + FAISS + all-MiniLM-L6-v2 embeddings
- **Index:** ~50MB for 50k chunks, loaded into Python process at startup
- **Retrieval:** top-4 chunks per query (cosine similarity)
- **Three prompts:** teacher (clinical tone), parent (warm practical), student (encouraging, age-appropriate)

### Solution Recommender pipeline
```
archetype → FAISS search (top-4) → LangChain prompt assembly → Claude API → Pydantic validation
→ grounding check (keyword overlap) → diagnosis filter (regex) → rule engine override → DB store
```

**LLM output schema:**
```python
class SuggestionOutput(BaseModel):
    summary: str
    for_teacher: List[str]
    for_student: List[str]
    for_parent: List[str]
    sources: List[str]
    urgency: Literal['low', 'medium', 'high']
    professional_referral: bool  # ALWAYS overwritten by rule engine
```

**Diagnosis language blacklist (regex):** `ADHD|disorder|diagnosis|condition|autism`

---

## n8n WORKFLOWS

| Workflow | Trigger | Actions |
|---|---|---|
| focus_alert | HTTP webhook (distraction_streak ≥ 5min) | Teacher email (SendGrid) + parent email if opted in + log |
| weekly_report_gen | Cron Sunday 20:00 | LLM weekly narrative + styled HTML email to parent |
| professional_referral | HTTP webhook (rule engine referral=True) | Teacher-only email, 14-day dedup, subject never contains "ADHD" |
| homework_reminder | Cron every hour | Non-submitters within 24h → student + parent email |

---

## DATABASE SCHEMAS

### PostgreSQL tables
```sql
users: id, role, full_name, email, hashed_password, school_id, class_id,
       linked_student_id, language_pref, xp_points, streak_days, created_at

sessions: id, student_id, subject_id, started_at, ended_at, duration_sec,
          avg_focus_score, focus_variance, distraction_count, cv_used

focus_events: id (BIGSERIAL), session_id, student_id, ts, gaze_score,
              blink_rate, head_pose_deg, focus_score, predicted_cause, risk_delta
              INDEX: (student_id, ts DESC)

homework: id, teacher_id, class_id, subject_id, title, description,
          due_date, difficulty_level (1-5), attachment_url

homework_submissions: id, homework_id, student_id, file_url, submitted_at,
                      grade (0-20), teacher_feedback, struggle_flag, time_spent_sec

messages: id, sender_id, receiver_id, thread_id, content (encrypted), read_at, attached_report_id

adhd_risk_profiles: id, student_id, computed_at, risk_score (TEACHER-ONLY),
                    risk_tier, top_signals (JSONB), suggested_actions (JSONB),
                    professional_referral, seen_by_teacher
```

### Redis key patterns
```
session:live:{student_id}      → {focus_score, distraction_streak, session_id, subject}  TTL 2h
pubsub:class:{class_id}        → pub/sub channel for teacher WebSocket broadcast
ratelimit:{user_id}:{endpoint} → request count (INCR+EXPIRE 60s)
```

---

## TECH STACK REFERENCE

### Python backend
```
fastapi uvicorn[standard]     — web framework
python-jose[cryptography]     — JWT auth
slowapi                       — rate limiting
xgboost >=2.0                 — distraction classifier
scikit-learn >=1.4            — risk profiler (RF + MLP)
joblib                        — model serialization
shap                          — feature importance
langchain langchain-community — RAG orchestration
langchain-anthropic            — Claude LLM integration
faiss-cpu                     — vector search
sentence-transformers          — embeddings (all-MiniLM-L6-v2)
anthropic                     — Claude API client
httpx                         — async HTTP (n8n triggers)
psycopg2-binary               — PostgreSQL driver
redis[hiredis]                — Redis client
pydantic >=2.0                — validation + settings
```

### JavaScript/TypeScript frontend
```
react react-dom               — web UI
react-native expo             — mobile UI
@tanstack/react-query         — data fetching
recharts                      — charts
react-i18next i18next         — AR/FR/EN i18n
tailwindcss                   — utility CSS
```

### MediaPipe (CDN — no npm needed)
```html
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"></script>
```

---

## PRIVACY & ETHICS — NON-NEGOTIABLE

- **No video stored** — every frame discarded locally in browser
- **No biometric data** — only derived numerical scores transmitted
- **Risk score gated** — parent API never returns risk_score or risk_tier — for_parent suggestions only
- **No diagnosis claim** — output is always "risk score" or "needs attention flag", never a diagnosis
- **Language blacklist** — all LLM output scanned, ADHD/disorder/diagnosis/condition/autism → regenerate
- **Referral = rule engine** — professional_referral set only by deterministic rule engine
- **14-day dedup** — referral workflow checks days_since_last > 14 before sending
- **Teacher-first** — referral email to teacher only, never directly to parent about risk level
- **Fallback safety** — two-strike LLM validation failure → static rule-based suggestions, never empty

---

## DEPLOYMENT

```yaml
# docker-compose.yml (local)
services:
  fastapi:   build ./backend, ports 8000:8000, depends_on postgres+redis
  n8n:       image n8nio/n8n, ports 5678:5678
  postgres:  image postgres:15
  redis:     image redis:7

# Production
FastAPI:    Railway (Docker)
n8n:        Railway (second container)
PostgreSQL: Supabase (free 500MB)
Redis:      Upstash (10k commands/day free)
FAISS:      Volume mount on Railway FastAPI container
Frontend:   Vercel (auto-deploy from GitHub)
Mobile:     Expo Go (scan QR code)
```

---

## FREE API RESOURCES
| Service | Free tier | Used for |
|---|---|---|
| Anthropic Claude | ~$5 credit signup | LLM for recommender + reports |
| SendGrid | 100 emails/day | All email notifications |
| Supabase | 500MB DB + 1GB storage | PostgreSQL + file storage |
| Railway | $5/mo credit | FastAPI + n8n Docker |
| Vercel | Free | Frontend web deployment |
| Upstash Redis | 10k commands/day | Redis in production |
| Expo Go | Free | Mobile demo |

---

## KNOWLEDGE BASE SOURCES (for FAISS RAG)
- pubmed.ncbi.nlm.nih.gov — "ADHD classroom intervention strategies"
- frontiersin.org — "ADHD education children" (open access)
- eric.ed.gov — "pedagogy learning difficulties"
- icd.who.int — ICD-11 ADHD clinical definition
- chadd.org — ADHD fact sheets (free PDF)
- additudemag.com — classroom + parenting guides
- understood.org — parent-facing ADHD guides
- researchgate.net — Monastir 2022 + Sfax 2021 Tunisian studies

---

## MVP DEMO FLOW (10 minutes — what judges see)
1. Student opens session → CV activates → focus bar goes live on screen
2. Teacher opens dashboard → sees student focus score updating ~1/sec
3. Simulate distraction → focus drops → email alert fires to judge's phone within 3 seconds
4. Teacher asks chatbot → grounded answer with source references
5. Show DB row → adhd_risk_profiles: risk_tier = needs_attention, suggested_actions populated
6. Parent opens dashboard → focus trend chart + for_parent suggestions (no raw risk score)
7. Done — every claim in the pitch is live-demonstrated

**Manual trigger button:** Add hidden "simulate distraction" button to teacher UI — do NOT rely on waiting 5 real minutes during a 10-minute demo.

---

## CHALLENGE SUBMISSION REQUIREMENTS

### Phase 1 (already submitted — ideation)
- ✅ Call-to-action video (≤40 seconds)
- ✅ Technical proposal (2–3 pages)
- ✅ Architecture diagram

### Phase 2 (due April 16, 2026)
- [ ] Technical report (methodology, implementation, impact)
- [ ] GitHub repository (public, clear README, instructions to run)
- [ ] Functional prototype / 3D simulation
- [ ] 7-minute presentation
- [ ] 3-minute demonstration video

### Phase 3 — Final Pitch (April 18, 2026)
- 5-min pitch + 2-min demo + 5-min jury Q&A

### Evaluation weights (Phase 2)
| Criterion | Points |
|---|---|
| Technical quality | 20 |
| Mental health principles alignment | 15 |
| Functionality and usability | 20 |
| Measurable educational impact | 20 |
| Scalability and sustainability | 15 |
| Ethical and accessible design | 10 |
| **Total** | **100** |

### Bonus points available
| Bonus | Points |
|---|---|
| Expert involvement (medical student advisor — DESCRIBE THEIR ROLE EXPLICITLY) | +10 |
| IEEE SIGHT membership (≥3 active members) | +5 |
| Local/regional challenges (Tunisia statistics — already in proposal) | +5 |
