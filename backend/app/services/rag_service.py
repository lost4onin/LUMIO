"""
rag_service.py — FAISS vector store + retrieval + Groq LLM generation.

Day 5: init_rag(), retrieve(), is_index_loaded()
Day 6: get_llm(), query_rag() — FAISS → Groq → grounded JSON response

Why split retrieval (Day 5) from generation (Day 6)?
  FAISS retrieval is deterministic and testable without any API keys.
  Adding LLM generation on top is a separate concern with its own failure modes.
"""
from pathlib import Path
from typing import List, Optional
import json
import re

from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
from langchain.schema import HumanMessage, SystemMessage

from app.config import settings

# ── Global state — initialized once at startup ────────────────────────────────
_vectorstore: Optional[FAISS] = None
_embeddings: Optional[HuggingFaceEmbeddings] = None

# Path resolution:
# __file__ = /app/app/services/rag_service.py (inside Docker)
# .parent.parent.parent = /app (container root = ./backend on host)
# faiss_index/ is at ./backend/../faiss_index = project root/faiss_index
# The docker-compose volume mounts ./faiss_index → /app/faiss_index
FAISS_INDEX_PATH = Path(__file__).parent.parent.parent / "faiss_index"

# all-MiniLM-L6-v2: small (22M params), fast, free, runs on CPU, 384-dim embeddings.
# Pre-downloaded into the container image — no internet needed at runtime.
EMBEDDING_MODEL = "all-MiniLM-L6-v2"


# ── Startup ───────────────────────────────────────────────────────────────────

async def init_rag() -> None:
    """
    Load the FAISS index at FastAPI startup.
    Called from main.py lifespan function after init_db() and init_redis().

    Loading the embedding model takes ~3-5 seconds on first run (downloads
    the model weights if not cached). Subsequent startups use the local cache.

    If the index file doesn't exist (e.g. before running ingest_kb.py),
    logs a warning but does NOT crash — the API still starts normally.
    retrieve() will return empty lists until the index is built.
    """
    global _vectorstore, _embeddings

    # Initialize the embedding model — same model used during ingest_kb.py
    # Must match exactly or similarity scores will be meaningless
    _embeddings = HuggingFaceEmbeddings(
        model_name=EMBEDDING_MODEL,
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )

    index_file = FAISS_INDEX_PATH / "index.faiss"
    if index_file.exists():
        # allow_dangerous_deserialization=True is required for FAISS pickle loading.
        # Safe here because we built the index ourselves from known PDFs.
        _vectorstore = FAISS.load_local(
            str(FAISS_INDEX_PATH),
            _embeddings,
            allow_dangerous_deserialization=True,
        )
        print(f"[rag] FAISS index loaded from {FAISS_INDEX_PATH}")
    else:
        print(f"[rag] WARNING: No FAISS index at {FAISS_INDEX_PATH}")
        print("[rag] Run: python scripts/ingest_kb.py to build the index")
        print("[rag] RAG retrieval will return empty results until then")


# ── Retrieval ─────────────────────────────────────────────────────────────────

def retrieve(query: str, k: int = 4) -> List[dict]:
    """
    Search the FAISS index for the top-k most relevant document chunks.

    How FAISS similarity search works:
      1. The query string is embedded into a 384-dim vector using all-MiniLM-L6-v2
      2. FAISS computes cosine similarity between the query vector and all stored vectors
      3. Returns the k documents with highest similarity scores

    Args:
        query: natural language search string (usually the archetype RAG seed)
        k:     number of chunks to return (default 4)

    Returns:
        List of dicts: [{"content": "...", "source": "filename.pdf"}, ...]
        Returns [] if index is not loaded yet — safe to call before ingest.
    """
    if _vectorstore is None:
        print("[rag] WARNING: FAISS index not loaded — returning empty results")
        return []

    docs = _vectorstore.similarity_search(query, k=k)
    return [
        {
            "content": doc.page_content,
            "source":  doc.metadata.get("source", "unknown"),
        }
        for doc in docs
    ]


# ── Health check ──────────────────────────────────────────────────────────────

def is_index_loaded() -> bool:
    """Return True if the FAISS index is loaded and ready for retrieval."""
    return _vectorstore is not None


# ── Diagnosis safety filter ───────────────────────────────────────────────────
# The LLM must never use clinical labels — these words trigger a regeneration.
DIAGNOSIS_BLACKLIST = re.compile(
    r"\b(ADHD|disorder|diagnosis|condition|autism)\b", re.IGNORECASE
)

# ── Audience-specific system prompts ─────────────────────────────────────────
SYSTEM_PROMPTS = {
    "teacher": (
        "You are a pedagogical assistant supporting teachers of children with learning difficulties. "
        "Use only the provided context to give specific, actionable classroom strategies. "
        "Never use: ADHD, disorder, diagnosis, condition, autism. "
        "Output valid JSON only. No markdown, no explanation outside the JSON."
    ),
    "parent": (
        "You are a warm advisor helping parents support their child at home. "
        "Use only the provided context to give practical home strategies. "
        "Never use: ADHD, disorder, diagnosis, condition, autism. "
        "Output valid JSON only. No markdown, no explanation outside the JSON."
    ),
    "student": (
        "You are an encouraging learning companion for a student aged 10-18. "
        "Use only the provided context to give simple, motivating study tips. "
        "Never use: ADHD, disorder, diagnosis, condition, autism. "
        "Output valid JSON only. No markdown, no explanation outside the JSON."
    ),
}

OUTPUT_SCHEMA = """{
  "summary": "one sentence summary",
  "for_teacher": ["strategy 1", "strategy 2", "strategy 3"],
  "for_student": ["tip 1", "tip 2"],
  "for_parent": ["guidance 1", "guidance 2"],
  "sources": ["source 1", "source 2"],
  "urgency": "low|medium|high",
  "professional_referral": false
}"""

# Served when the LLM fails twice — always safe, never empty.
STATIC_FALLBACK = {
    "summary": "Student needs support — please check in with them.",
    "for_teacher": [
        "Check in with the student privately.",
        "Break the current task into smaller steps.",
        "Consider a short break.",
    ],
    "for_student": [
        "Take a short break and drink some water.",
        "Try focusing on one small task at a time.",
    ],
    "for_parent": [
        "Ask your child how their day went.",
        "Ensure they have a quiet space for homework.",
    ],
    "sources": [],
    "urgency": "low",
    "professional_referral": False,
}


# ── LLM factory ───────────────────────────────────────────────────────────────

def get_llm() -> ChatGroq:
    """
    Return a Groq LLM instance.
    Raises ValueError if the API key is missing so the developer gets a clear message.
    """
    if not settings.GROQ_API_KEY:
        raise ValueError(
            "GROQ_API_KEY is not set. "
            "Get a free key at https://console.groq.com then add it to .env"
        )
    return ChatGroq(
        api_key=settings.GROQ_API_KEY,
        model=settings.GROQ_MODEL,
        temperature=0.3,
    )


def _parse_llm_json(raw: str) -> dict:
    """Strip markdown fences (```json ... ```) then parse JSON."""
    raw = re.sub(r"```json|```", "", raw).strip()
    return json.loads(raw)


# ── RAG query ─────────────────────────────────────────────────────────────────

async def query_rag(
    archetype: str,
    rag_query_seed: str,
    student_context: dict,
    professional_referral_override: bool,
    audience: str = "teacher",
) -> dict:
    """
    Full RAG pipeline: FAISS retrieval → Groq LLM → validated JSON.

    Two-strike loop:
      Strike 1: blacklisted word found → remind the LLM and retry once.
      Strike 2: any failure (parse error, blacklist again) → serve STATIC_FALLBACK.

    The professional_referral_override from the rule engine always wins — the
    LLM value is discarded. This is a hard safety requirement.
    """
    chunks = retrieve(rag_query_seed, k=4)
    context_text = "\n\n".join(
        f"[{c['source']}]\n{c['content']}" for c in chunks
    ) if chunks else "No specific context available."

    student_info = (
        f"Student: {student_context.get('full_name', 'Unknown')}, "
        f"avg focus (7d): {student_context.get('avg_focus_7d', 'N/A')}, "
        f"distraction cause: {student_context.get('distraction_cause', archetype)}"
    )

    user_message = (
        f"Archetype: {archetype}\n"
        f"Student info: {student_info}\n\n"
        f"Context:\n{context_text}\n\n"
        f"Output JSON matching this schema exactly:\n{OUTPUT_SCHEMA}"
    )

    llm = get_llm()
    strikes = 0
    result = None

    while strikes < 2:
        try:
            response = await llm.ainvoke([
                SystemMessage(content=SYSTEM_PROMPTS.get(audience, SYSTEM_PROMPTS["teacher"])),
                HumanMessage(content=user_message),
            ])
            parsed = _parse_llm_json(response.content)

            if DIAGNOSIS_BLACKLIST.search(json.dumps(parsed)):
                strikes += 1
                user_message += "\nReminder: Do NOT use ADHD, disorder, diagnosis, condition, or autism."
                continue

            result = parsed
            break

        except Exception as e:
            print(f"[rag] LLM call failed (strike {strikes + 1}): {e}")
            strikes += 1

    if result is None:
        result = STATIC_FALLBACK.copy()

    # Rule engine value always wins — LLM cannot override this
    result["professional_referral"] = professional_referral_override
    return result
