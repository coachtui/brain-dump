/**
 * Diagnostics routes — internal only
 *
 * POST /api/v1/diagnostics/test-notification
 *   Returns a test notification payload so the client can fire a local notification
 *   independently of the reminder pipeline. Used to verify notification permissions
 *   and delivery work before debugging geofence triggers.
 *
 * GET /api/v1/diagnostics/reminders
 *   Returns a debug view of active places, geofences, and recent lifecycle events
 *   for the authenticated user.
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../auth/middleware';
import { PlaceModel } from '../models/Place';
import { GeofenceModel } from '../models/Geofence';
import { query } from '../db/queries';

const router = Router();
router.use(authenticate);

// ─── POST /api/v1/diagnostics/test-notification ───────────────────────────────
// Client calls this, receives a test payload, then schedules a local notification.
// Verifies the notification path works end-to-end independently of geofence triggers.

router.post('/test-notification', async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  console.log(`[Diagnostics] test-notification requested by user ${userId}`);

  res.json({
    ok: true,
    notification: {
      title: '📍 Test notification',
      body: 'Reminder pipeline is working. This confirms notification delivery is functional.',
      data: { screen: 'Objects', test: true },
    },
  });
});

// ─── GET /api/v1/diagnostics/reminders ───────────────────────────────────────

router.get('/reminders', async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const [places, geofences, recentEvents] = await Promise.all([
      PlaceModel.findByUserId(userId),
      GeofenceModel.findByUserId(userId),
      query<{
        id: string;
        event_type: string;
        object_id: string | null;
        place_id: string | null;
        geofence_id: string | null;
        metadata: Record<string, unknown> | null;
        created_at: Date;
      }>(
        `SELECT id, event_type, object_id, place_id, geofence_id, metadata, created_at
         FROM hub.reminder_lifecycle_events
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [userId]
      ),
    ]);

    // Build enriched place list showing linked geofences
    const inferredGeofencesByPlaceId = new Map<string, typeof geofences[number]>();
    for (const gf of geofences) {
      if (gf.placeId) inferredGeofencesByPlaceId.set(gf.placeId, gf);
    }

    const placeDebug = places.map(p => ({
      id: p.id,
      name: p.normalizedName,
      lat: p.lat,
      lng: p.lng,
      radius: p.radiusMeters,
      confidence: p.confidence,
      category: p.category,
      userConfirmed: p.userConfirmed,
      geofence: inferredGeofencesByPlaceId.has(p.id)
        ? {
            id: inferredGeofencesByPlaceId.get(p.id)!.id,
            enabled: inferredGeofencesByPlaceId.get(p.id)!.notificationSettings.enabled,
          }
        : null,
      createdAt: p.createdAt,
    }));

    res.json({
      userId,
      summary: {
        totalPlaces: places.length,
        totalGeofences: geofences.length,
        enabledGeofences: geofences.filter(g => g.notificationSettings.enabled).length,
        inferredGeofences: geofences.filter(g => g.createdBy === 'inferred').length,
      },
      places: placeDebug,
      recentLifecycleEvents: recentEvents,
    });
  } catch (error) {
    console.error('[Diagnostics] reminders error:', error);
    res.status(500).json({ error: 'Failed to load reminder diagnostics' });
  }
});

export default router;
