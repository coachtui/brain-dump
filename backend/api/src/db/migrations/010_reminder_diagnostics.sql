-- Migration 010: Reminder Diagnostics
-- Adds structured lifecycle event logging for the reminder pipeline.
-- Events are append-only and allow debugging silent failures in the
-- extraction → geocoding → geofence → notification chain.

CREATE TABLE IF NOT EXISTS hub.reminder_lifecycle_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES hub.users(id) ON DELETE CASCADE,
  object_id   uuid        REFERENCES hub.atomic_objects(id) ON DELETE CASCADE,
  place_id    uuid        REFERENCES hub.places(id) ON DELETE CASCADE,
  geofence_id uuid        REFERENCES hub.geofences(id) ON DELETE CASCADE,
  event_type  varchar(40) NOT NULL,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rle_user_id_idx
  ON hub.reminder_lifecycle_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS rle_object_id_idx
  ON hub.reminder_lifecycle_events(object_id);

COMMENT ON TABLE hub.reminder_lifecycle_events IS
  'Structured lifecycle log for the reminder pipeline. '
  'Tracks events: REMINDER_CANDIDATE_DETECTED, PLACE_RESOLVED, PLACE_DEDUPED, '
  'PLACE_UNRESOLVABLE, GEOFENCE_CREATED, GEOFENCE_SKIPPED_LOW_CONFIDENCE, '
  'GEOFENCE_LIMIT_REACHED, GEOFENCE_ENTERED, NOTIFICATION_SENT.';
