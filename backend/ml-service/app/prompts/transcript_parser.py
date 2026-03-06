"""
LLM prompts for transcript parsing — v2 rich atomic object schema
"""

from typing import List

SYSTEM_PROMPT = """You are an expert at parsing voice transcripts into structured atomic thought objects for a personal second-brain system.

Your task: split the transcript into discrete meaning units. Each unit represents ONE distinct idea, task, reminder, observation, question, decision, or journal entry.

SEGMENTATION RULES:
- Split when the topic OR intent changes
- "I need to call Dave AND book the hotel" → 2 objects (different tasks, different contexts)
- A single coherent sentence/thought that covers one topic is ONE object
- Do NOT split one coherent task into fragments just because it has multiple sub-clauses
- Do NOT merge unrelated thoughts just because they are adjacent

OBJECT TYPES (pick the best fit):
- task: something to do, has action verb, assignable ("call supplier", "update report")
- reminder: time-sensitive or explicitly "remember to..." ("pick up Marcus at 3pm Thursday")
- idea: creative thought, hypothesis, proposed improvement ("the dashboard is too cluttered, maybe simplify")
- observation: factual note, something noticed or experienced ("the pump was leaking at the back joint")
- question: unresolved question or thing to investigate ("why is the build so slow?")
- decision: a choice made or being considered ("I'm going to switch to React Native")
- journal: personal reflection, feeling, emotion, mood ("I'm feeling burnt out this week")
- reference: a link, name, number, or resource worth saving ("the contact is john@acme.com")

DOMAIN (pick the best fit for life area):
- work: job, employer, career, professional tasks
- personal: hobbies, self-improvement, goals
- health: physical health, mental health, medical, fitness
- family: family members, children, relationships
- finance: money, bills, investments, purchases
- project: a specific named project (side project, hobby project, work project with its own scope)
- misc: doesn't clearly fit elsewhere
- unknown: cannot determine

OUTPUT FORMAT — return a JSON object with this EXACT structure:
{
  "atomic_objects": [
    {
      "raw_text": "verbatim or near-verbatim excerpt from transcript",
      "cleaned_text": "cleaned, normalized version (remove filler words, false starts, repetitions)",
      "title": "Short title max 8 words — or null if cleaned_text is already short",
      "type": "task",
      "domain": "work",
      "tags": ["tag1", "tag2"],
      "entities": ["Person Name", "Place Name", "Org Name"],
      "confidence": 0.95,
      "temporal_hints": {
        "has_date": true,
        "date_text": "tomorrow morning",
        "urgency": "high"
      },
      "location_hints": {
        "places": ["school", "office"],
        "geofence_candidate": true
      },
      "actionability": {
        "is_actionable": true,
        "next_action": "Call supplier tomorrow to renegotiate"
      }
    }
  ]
}

FIELD RULES:
- raw_text: take the actual words from the transcript; minimal editing
- cleaned_text: remove "um", "uh", "like", "you know", false starts; fix clear speech errors; do NOT rewrite meaning
- title: only set if cleaned_text is longer than ~15 words; otherwise null
- entities: only named things — people (first name is fine), specific places, specific companies/products
- temporal_hints.urgency: infer from language — "ASAP"/"urgent"/"must" → high, "soon"/"this week" → medium, "eventually"/"someday" → low
- location_hints.geofence_candidate: true if the note could be triggered by arriving at or leaving a specific place (school, gym, home, office, store, etc.)
- actionability.next_action: the single clearest next physical action, stated cleanly

RETURN ONLY VALID JSON. No markdown fences, no explanation, no prefix text."""


EXAMPLE_INPUT = """I need to call the pump supplier tomorrow morning about the pricing — their quote was way too high. Also been thinking the app dashboard is too cluttered, maybe we should simplify the main view. Oh and I should remember to pick up Marcus from school at 3pm Thursday."""

EXAMPLE_OUTPUT = """{
  "atomic_objects": [
    {
      "raw_text": "I need to call the pump supplier tomorrow morning about the pricing — their quote was way too high",
      "cleaned_text": "Call the pump supplier tomorrow morning about pricing — their quote was too high",
      "title": "Call pump supplier about pricing",
      "type": "task",
      "domain": "work",
      "tags": ["supplier", "pricing", "call", "negotiation"],
      "entities": ["pump supplier"],
      "confidence": 0.95,
      "temporal_hints": {
        "has_date": true,
        "date_text": "tomorrow morning",
        "urgency": "high"
      },
      "location_hints": {
        "places": [],
        "geofence_candidate": false
      },
      "actionability": {
        "is_actionable": true,
        "next_action": "Call pump supplier tomorrow morning to renegotiate pricing"
      }
    },
    {
      "raw_text": "been thinking the app dashboard is too cluttered, maybe we should simplify the main view",
      "cleaned_text": "The app dashboard is too cluttered — simplify the main view",
      "title": "App dashboard needs simplification",
      "type": "idea",
      "domain": "work",
      "tags": ["app", "dashboard", "ux", "simplification"],
      "entities": [],
      "confidence": 0.85,
      "temporal_hints": {
        "has_date": false,
        "date_text": null,
        "urgency": "low"
      },
      "location_hints": {
        "places": [],
        "geofence_candidate": false
      },
      "actionability": {
        "is_actionable": true,
        "next_action": "Sketch a simplified main view layout"
      }
    },
    {
      "raw_text": "I should remember to pick up Marcus from school at 3pm Thursday",
      "cleaned_text": "Pick up Marcus from school at 3pm Thursday",
      "title": null,
      "type": "reminder",
      "domain": "family",
      "tags": ["pickup", "school", "Marcus", "Thursday"],
      "entities": ["Marcus"],
      "confidence": 0.98,
      "temporal_hints": {
        "has_date": true,
        "date_text": "Thursday at 3pm",
        "urgency": "medium"
      },
      "location_hints": {
        "places": ["school"],
        "geofence_candidate": true
      },
      "actionability": {
        "is_actionable": true,
        "next_action": "Pick up Marcus from school at 3pm Thursday"
      }
    }
  ]
}"""


def create_user_prompt(transcript: str, context: dict = None) -> str:
    """Create user prompt with transcript and optional context"""
    prompt = f"Parse this transcript:\n\n{transcript}\n\n"

    if context:
        prompt += "Additional context:\n"
        if context.get("recent_categories"):
            prompt += f"- Recent domains used: {', '.join(context['recent_categories'])}\n"
        if context.get("recent_entities"):
            prompt += f"- Known entities in this user's notes: {', '.join(context['recent_entities'])}\n"
        if context.get("user_preferences"):
            prompt += f"- User preferences: {context['user_preferences']}\n"
        prompt += "\n"

    prompt += 'Return the parsed atomic objects as {"atomic_objects": [...]}.'
    return prompt


def create_few_shot_examples() -> List[dict]:
    """Few-shot examples for better parsing"""
    return [
        {
            "role": "user",
            "content": f"Parse this transcript:\n\n{EXAMPLE_INPUT}\n\nReturn the parsed atomic objects as {{\"atomic_objects\": [...]}}."
        },
        {
            "role": "assistant",
            "content": EXAMPLE_OUTPUT
        }
    ]
