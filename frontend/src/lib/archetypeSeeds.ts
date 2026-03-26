/**
 * Archetype seeds for Lumio's distraction classification system
 * Used in teacher chatbot UI context to describe detected archetypes and suggest interventions
 */

/**
 * ARCHETYPE_SEEDS: Maps each detected archetype to a context description
 * for RAG/LLM integration in the teacher chatbot
 */
export const ARCHETYPE_SEEDS = {
  PERSISTENT_ADHD_RISK:
    'sustained attention difficulties intervention strategies',
  SUSTAINED_FATIGUE_HIGH_RISK:
    'student fatigue high risk sustained attention support',
  SUBJECT_DIFFICULTY_STRUGGLE:
    'learning difficulties subject support strategies',
  SIMPLE_FATIGUE: 'student fatigue classroom management rest strategies',
  ENVIRONMENTAL_DISTRACTION:
    'classroom environment distraction management techniques',
  CONTENT_DIFFICULTY:
    'content difficulty adaptive teaching differentiation strategies',
  GENERAL_DISTRACTION: 'general distraction refocus engagement strategies'
} as const

/**
 * ARCHETYPE_LABELS: Human-readable display labels for each archetype
 * Used in UI to show teachers what type of distraction/challenge is detected
 */
export const ARCHETYPE_LABELS: Record<keyof typeof ARCHETYPE_SEEDS, string> = {
  PERSISTENT_ADHD_RISK: 'ADHD Risk — Persistent Attention Issues',
  SUSTAINED_FATIGUE_HIGH_RISK: 'High Risk — Sustained Fatigue',
  SUBJECT_DIFFICULTY_STRUGGLE: 'Struggle — Subject Difficulty',
  SIMPLE_FATIGUE: 'Fatigue — Rest Needed',
  ENVIRONMENTAL_DISTRACTION: 'Distracted — Environment',
  CONTENT_DIFFICULTY: 'Difficulty — Content too complex',
  GENERAL_DISTRACTION: 'Distracted — General'
} as const

/**
 * Archetype type for type safety
 */
export type ArchetypeKey = keyof typeof ARCHETYPE_SEEDS
