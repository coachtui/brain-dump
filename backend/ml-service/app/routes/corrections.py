"""
Correction feedback routes — logs user corrections on parsed atomic objects.
Corrections are stored as JSONL for later review and model improvement.
"""

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, status
from ..models.transcript import CorrectionFeedback

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["corrections"])

CORRECTIONS_LOG_PATH = Path(
    os.getenv("CORRECTIONS_LOG_PATH", "/tmp/offload_corrections.jsonl")
)


def _append_correction(feedback: CorrectionFeedback) -> None:
    CORRECTIONS_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    record = feedback.model_dump()
    record["submitted_at"] = record["submitted_at"].isoformat()
    with CORRECTIONS_LOG_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")


@router.post("/corrections", status_code=status.HTTP_201_CREATED)
async def submit_correction(feedback: CorrectionFeedback):
    """
    Log a user correction for a parsed atomic object.

    Call this when the user edits or thumbs-down a specific field on an
    atomic object. Corrections are appended to a JSONL log file for
    periodic review and vocabulary/prompt improvement.
    """
    try:
        if not feedback.submitted_at:
            feedback.submitted_at = datetime.now(timezone.utc)

        _append_correction(feedback)

        logger.info(
            "[Corrections] session=%s index=%d field=%s",
            feedback.session_id,
            feedback.sequence_index,
            feedback.field,
        )

        return {
            "status": "logged",
            "session_id": feedback.session_id,
            "sequence_index": feedback.sequence_index,
            "field": feedback.field,
        }

    except Exception as e:
        logger.error("[Corrections] failed to log correction: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to log correction",
        )


@router.get("/corrections/summary")
async def corrections_summary():
    """
    Return a count summary of corrections by field — useful for spotting
    which fields the parser gets wrong most often.
    """
    if not CORRECTIONS_LOG_PATH.exists():
        return {"total": 0, "by_field": {}}

    counts: dict[str, int] = {}
    total = 0

    with CORRECTIONS_LOG_PATH.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
                field = record.get("field", "unknown")
                counts[field] = counts.get(field, 0) + 1
                total += 1
            except json.JSONDecodeError:
                continue

    return {"total": total, "by_field": counts}
