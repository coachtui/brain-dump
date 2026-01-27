/**
 * Voice session API routes
 * Uses Deepgram for real-time transcription (mobile connects directly to Deepgram)
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../auth/middleware';
import { parseTranscript, checkMLServiceHealth } from '../services/mlService';
import { createObject } from '../services/objectService';
import { Session } from '../models/Session';

const router = Router();

// All voice routes require authentication
router.use(authenticate);

// Validation schemas
const saveTranscriptSchema = z.object({
  transcript: z.string().min(1, 'Transcript is required'),
  duration: z.number().optional(),
  location: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      accuracy: z.number().optional(),
      altitude: z.number().optional(),
    })
    .optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * GET /api/v1/voice/deepgram-token - Get temporary Deepgram API token
 * Mobile app uses this to connect directly to Deepgram for real-time transcription
 */
router.get('/deepgram-token', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      console.error('DEEPGRAM_API_KEY not configured');
      return res.status(500).json({ error: 'Deepgram not configured' });
    }

    // Request a temporary token from Deepgram (60 seconds to connect)
    const response = await fetch('https://api.deepgram.com/v1/auth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ time_to_live: 60 }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Deepgram token error:', errorText);
      return res.status(500).json({ error: 'Failed to get Deepgram token' });
    }

    const data = await response.json() as { token: string };
    res.json({ token: data.token });
  } catch (error) {
    console.error('Error getting Deepgram token:', error);
    res.status(500).json({
      error: 'Failed to get Deepgram token',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/v1/voice/save-transcript - Save transcript and create atomic objects
 * Called after recording stops with the final transcript from Deepgram
 */
router.post('/save-transcript', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validationResult = saveTranscriptSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
    }

    const { transcript, duration, location, metadata } = validationResult.data;

    // Type-safe location (zod ensures latitude/longitude exist if location is present)
    const geoLocation = location ? {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      altitude: location.altitude,
    } : undefined;

    // Create a session record
    const session = await Session.create({
      userId,
      deviceId: 'mobile-deepgram',
      location: geoLocation,
      metadata: { ...metadata, duration, transcriptionMethod: 'deepgram' },
    });

    // Parse transcript and create atomic objects
    const objectIds: string[] = [];

    if (transcript.trim()) {
      const mlAvailable = await checkMLServiceHealth();

      if (mlAvailable) {
        // Use ML service to parse transcript into atomic objects
        const parseResult = await parseTranscript({
          transcript,
          userId,
          sessionId: session.id,
          location: geoLocation,
          timestamp: new Date(),
        });

        for (const parsedObject of parseResult.atomicObjects) {
          const object = await createObject(userId, {
            content: parsedObject.content,
            category: parsedObject.category,
            source: {
              type: 'voice',
              recordingId: session.id,
              location: geoLocation,
            },
            metadata: {
              tags: parsedObject.tags,
              urgency: parsedObject.urgency,
            },
          });
          objectIds.push(object.id);
        }
      } else {
        // Fallback: create single object with full transcript
        const object = await createObject(userId, {
          content: transcript,
          source: {
            type: 'voice',
            recordingId: session.id,
            location: geoLocation,
          },
        });
        objectIds.push(object.id);
      }
    }

    // Update session as completed
    await session.update({
      status: 'completed',
      metadata: {
        ...session.metadata,
        transcript,
        objectIds,
      },
    });

    res.json({
      sessionId: session.id,
      objectIds,
      objectCount: objectIds.length,
    });
  } catch (error) {
    console.error('Error saving transcript:', error);
    res.status(500).json({
      error: 'Failed to save transcript',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/voice/sessions - List user's voice sessions
 */
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const status = req.query.status as string | undefined;
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = parseInt(req.query.offset as string) || 0;

    const validStatuses = ['recording', 'processing', 'completed', 'failed'];
    const statusFilter = status && validStatuses.includes(status)
      ? (status as 'recording' | 'processing' | 'completed' | 'failed')
      : undefined;

    const result = await Session.findByUserId(userId, {
      status: statusFilter,
      limit,
      offset,
    });

    res.json({
      sessions: result.sessions.map((s) => s.toVoiceSession()),
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({
      error: 'Failed to list sessions',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/voice/sessions/:id - Get session details
 */
router.get('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const session = await Session.findById(id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Verify ownership
    if (session.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json({
      session: session.toVoiceSession(),
    });
  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({
      error: 'Failed to get session',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
