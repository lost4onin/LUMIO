---
name: lumio-dev
description: Development assistant for the Lumio/Unblur AI-powered ADHD learning platform. Use this skill whenever working on any part of the Lumio codebase — backend (FastAPI, XGBoost, FAISS, LangChain, n8n), frontend (React, MediaPipe, Recharts), database schemas, deployment, or any feature implementation. Triggers on any mention of Lumio, Unblur, focus tracker, CV module, distraction classifier, RAG engine, teacher dashboard, parent interface, or any component described in this skill.
---

# Lumio Development Skill

Lumio is an AI-powered ADHD early detection and learning support platform built for the IEEE CODE2CURE SIGHT Day Congress 4.0 challenge. It connects students, teachers, and parents in a single real-time ecosystem.

## Read first
Before writing any code, check `context/LUMIO_PROJECT_CONTEXT.md` for full architecture, schemas, and design decisions. Do not contradict decisions documented there.

## Stack at a glance
- **Backend:** FastAPI (Python), PostgreSQL (Supabase), Redis (Upstash), XGBoost, scikit-learn, FAISS, LangChain, n8n
- **Frontend:** React + TypeScript + Tailwind CSS (web), React Native + Expo (mobile)
- **CV:** MediaPipe FaceMesh via CDN (browser-only — no video ever transmitted)
- **LLM:** Claude API (claude-sonnet-4-6) via langchain-anthropic
- **Deploy:** Railway (backend + n8n), Vercel (frontend), Expo Go (mobile)

## Core rules — never violate these

1. **No video on server** — MediaPipe discards every frame locally. Only focus_score JSON is transmitted.
2. **No diagnosis language** — All LLM output must pass regex filter: `ADHD|disorder|diagnosis|condition|autism` → regenerate if matched.
3. **Risk score gated** — Parent API endpoints NEVER return risk_score or risk_tier. Return for_parent suggestions only.
4. **Rule engine overrides LLM** — professional_referral is set by rule_engine.py ONLY. LLM value is always discarded.
5. **Backend frozen after Day 10** — No new endpoints after the backend freeze tag. UI uses what exists.
6. **Synthetic data for training** — XGBoost and RF/MLP train on synthetic data. Interface unchanged when real data arrives.

## File structure convention
```
backend/
  app/
    main.py
    config.py          # pydantic settings
    database.py        # async SQLAlchemy
    routers/
      auth.py
      sessions.py
      analytics.py
      rag.py
      homework.py
    services/
      rule_engine.py   # deterministic — no ML
      recommender.py   # rule → FAISS → LLM → DB
      rag_service.py   # FAISS + LangChain
    models/
      distraction_clf.joblib
      risk_profiler.joblib
    faiss_index/       # .faiss + .pkl files
  scripts/
    generate_training_data.py
    train_classifier.py
    train_profiler.py
    ingest_kb.py
    seed_demo.py
  tests/
    test_auth.py
    test_analytics.py
    test_rag.py
    test_rule_engine.py
frontend/
  src/
    pages/
      student/         # Session, Homework, Progress
      teacher/         # Dashboard, Chatbot, Homework
      parent/          # Overview, SessionHistory
    components/
      CVModule.tsx     # MediaPipe wrapper
      FocusBar.tsx     # real-time focus visualization
      ChatInterface.tsx
      FocusTrendChart.tsx
    hooks/
      useAuth.ts
      useFocusStream.ts
    i18n/
      ar.json
      fr.json
      en.json
```

## Key implementation patterns

### WebSocket focus stream (backend)
```python
@router.websocket("/ws/focus/{student_id}")
async def focus_stream(websocket: WebSocket, student_id: str):
    await websocket.accept()
    async for data in websocket.iter_json():
        await redis.set(f"session:live:{student_id}", json.dumps(data), ex=7200)
        await redis.publish(f"pubsub:class:{data['class_id']}", json.dumps(data))
```

### XGBoost classifier endpoint
```python
@router.post("/analytics/classify")
async def classify_distraction(events: List[FocusEvent]):
    features = extract_features(events)  # avg_focus, std, blink, head_pose, time, duration, subject
    cause_id = model.predict([features])[0]
    confidence = model.predict_proba([features])[0].max()
    return {"cause": CAUSE_LABELS[cause_id], "confidence": float(confidence)}
```

### Rule engine (deterministic — no ML)
```python
def classify_archetype(cause, risk_score, session_dur, hw_grade, streak_days):
    if risk_score > 0.75 and streak_days > 7:
        return "PERSISTENT_ADHD_RISK", True
    if cause == "fatigue" and risk_score > 0.5 and session_dur > 5400:
        return "SUSTAINED_FATIGUE_HIGH_RISK", False
    if cause == "difficulty" and hw_grade < 8:
        return "SUBJECT_DIFFICULTY_STRUGGLE", False
    if cause == "fatigue" and risk_score < 0.5:
        return "SIMPLE_FATIGUE", False
    if cause == "environment":
        return "ENVIRONMENTAL_DISTRACTION", False
    if cause == "difficulty":
        return "CONTENT_DIFFICULTY", False
    return "GENERAL_DISTRACTION", False
```

### n8n trigger pattern
```python
async def trigger_n8n(workflow: str, payload: dict):
    async with httpx.AsyncClient() as client:
        await client.post(f"{N8N_BASE_URL}/webhook/{workflow}", json=payload, timeout=5.0)
# Usage:
await trigger_n8n("focus_alert", {"student_id": sid, "teacher_id": tid, "focus_score": score})
```

### Diagnosis language filter
```python
import re
BLACKLIST = re.compile(r"\b(ADHD|disorder|diagnosis|condition|autism)\b", re.IGNORECASE)

def filter_diagnosis_language(text: str) -> bool:
    return bool(BLACKLIST.search(text))  # True = needs regeneration
```

### MediaPipe focus score (frontend)
```typescript
// focus_score composite: 0.0 (distracted) to 1.0 (fully focused)
const computeFocusScore = (landmarks: FaceLandmarks): number => {
  const gazeScore = computeGazeScore(landmarks);      // 0–1: looking at screen
  const blinkNorm = normalizeBlink(blinkRate);         // 0–1: blink rate normalized
  const poseNorm = normalizeHeadPose(headPoseDeg);    // 0–1: head pose normalized
  return 0.4 * gazeScore + 0.3 * (1 - blinkNorm) + 0.3 * (1 - poseNorm);
};
```

## LLM prompt structure
```python
SYSTEM_TEACHER = """You are a pedagogical assistant for children with learning difficulties.
Archetype: {archetype}
Rules:
- Generate suggestions ONLY from provided context chunks
- NEVER use: ADHD, disorder, diagnosis, condition, autism
- Output valid JSON only matching schema. Nothing else."""

# Output schema
class SuggestionOutput(BaseModel):
    summary: str
    for_teacher: List[str]
    for_student: List[str]
    for_parent: List[str]
    sources: List[str]
    urgency: Literal['low', 'medium', 'high']
    professional_referral: bool  # ALWAYS overwritten by rule engine
```

## Validation pipeline (4 safeguards)
1. **Schema** — Pydantic validation → retry once → static fallback
2. **Grounding** — keyword overlap each suggestion vs retrieved chunks (Jaccard threshold)
3. **Diagnosis filter** — regex blacklist → regenerate → 2 strikes → static fallback
4. **Referral override** — rule_engine.professional_referral always overwrites LLM field

## Demo seed data
Run `scripts/seed_demo.py` to create:
- 1 teacher: teacher@demo.com / password
- Student 1 "Yassine": 7 days focus_events, risk_tier=needs_attention, full suggested_actions
- Student 2: risk_tier=moderate
- Student 3: risk_tier=low
- 2 homework assignments, 1 submission with struggle_flag=True

## Common tasks reference

**Add a new API endpoint:**
1. Add route to appropriate router in `app/routers/`
2. Add Pydantic schema if needed
3. Write pytest integration test in `tests/`
4. Update README with endpoint docs

**Retrain XGBoost classifier:**
1. Run `scripts/generate_training_data.py` with updated parameters
2. Run `scripts/train_classifier.py`
3. New `distraction_clf.joblib` auto-loaded on FastAPI restart

**Add to RAG knowledge base:**
1. Add PDFs to `rag-sources/` Supabase bucket
2. Run `scripts/ingest_kb.py`
3. New `faiss_index/` auto-loaded on RAG service restart

**Add new n8n workflow:**
1. Build workflow in n8n UI
2. Add trigger function in `app/services/n8n_service.py`
3. Call `trigger_n8n("workflow_name", payload)` from appropriate service

## Environment variables
```
ANTHROPIC_API_KEY=
DATABASE_URL=postgresql://...      # Supabase connection string
REDIS_URL=redis://...              # Upstash Redis URL
N8N_BASE_URL=http://n8n:5678
SENDGRID_API_KEY=
JWT_SECRET_KEY=                    # 32+ char random string
SUPABASE_URL=
SUPABASE_ANON_KEY=
```
