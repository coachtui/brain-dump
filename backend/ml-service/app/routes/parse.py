"""
Transcript parsing API routes
"""

from fastapi import APIRouter, HTTPException, status
from ..models.transcript import TranscriptParseRequest, TranscriptParseResponse
from ..services.parser import get_parser

router = APIRouter(prefix="/api/v1", tags=["parsing"])


@router.post("/parse-transcript", response_model=TranscriptParseResponse)
async def parse_transcript(request: TranscriptParseRequest):
    """
    Parse a voice transcript into atomic objects

    This endpoint uses LLM to intelligently split transcripts into
    individual atomic pieces of information with categories, entities,
    sentiment, and urgency.
    """
    try:
        parser = get_parser()

        atomic_objects, model_used, processing_time, raw_transcript = await parser.parse_transcript(request)

        needs_review_count = sum(1 for obj in atomic_objects if obj.needs_review)
        summary = f"Parsed {len(atomic_objects)} atomic object(s) from transcript"
        if needs_review_count:
            summary += f" — {needs_review_count} flagged for review"

        return TranscriptParseResponse(
            atomic_objects=atomic_objects,
            summary=summary,
            processing_time=processing_time,
            model_used=model_used,
            raw_transcript=raw_transcript,
            needs_review_count=needs_review_count,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    except Exception as e:
        print(f"Unexpected error in parse_transcript: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to parse transcript"
        )
