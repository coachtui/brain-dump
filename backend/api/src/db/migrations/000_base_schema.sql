-- Base schema: creates extensions, hub schema, and all core tables.
-- Replaces the missing migrations 001–005.
-- Safe to run on an existing DB — all statements use IF NOT EXISTS.
-- Run this BEFORE migrations 006–009.

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Schema
CREATE SCHEMA IF NOT EXISTS hub;

-- -----------------------------------------------------------------------
-- hub.users
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hub.users (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text        NOT NULL UNIQUE,
  password_hash text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  updated_at    timestamptz NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------
-- hub.sessions
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hub.sessions (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid        NOT NULL REFERENCES hub.users(id) ON DELETE CASCADE,
  device_id            text        NOT NULL,
  location_latitude    decimal     NULL,
  location_longitude   decimal     NULL,
  location_accuracy    decimal     NULL,
  location_altitude    decimal     NULL,
  metadata             jsonb       NOT NULL DEFAULT '{}',
  status               text        NOT NULL DEFAULT 'recording'
                         CHECK (status IN ('recording', 'processing', 'completed', 'failed')),
  created_at           timestamptz NOT NULL DEFAULT NOW(),
  updated_at           timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id    ON hub.sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status     ON hub.sessions (status);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON hub.sessions (user_id, created_at DESC);

-- -----------------------------------------------------------------------
-- hub.atomic_objects  (v1 + v2 rich fields)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hub.atomic_objects (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid        NOT NULL REFERENCES hub.users(id) ON DELETE CASCADE,

  -- v1 fields
  content                     text        NOT NULL DEFAULT '',
  category                    text[]      NOT NULL DEFAULT '{}',
  confidence                  decimal(4,3) NOT NULL DEFAULT 0.5,
  source_type                 text        NOT NULL DEFAULT 'voice'
                                CHECK (source_type IN ('voice', 'text', 'import')),
  source_recording_id         text        NULL,
  source_timestamp            timestamptz NOT NULL DEFAULT NOW(),
  source_location_latitude    decimal     NULL,
  source_location_longitude   decimal     NULL,
  source_location_accuracy    decimal     NULL,
  source_location_altitude    decimal     NULL,
  metadata_entities           jsonb       NOT NULL DEFAULT '[]',
  metadata_sentiment          text        NULL CHECK (metadata_sentiment IN ('positive', 'neutral', 'negative')),
  metadata_urgency            text        NULL CHECK (metadata_urgency IN ('low', 'medium', 'high')),
  metadata_tags               text[]      NOT NULL DEFAULT '{}',
  relationships_related_objects uuid[]    NOT NULL DEFAULT '{}',
  relationships_contradictions  uuid[]    NOT NULL DEFAULT '{}',
  relationships_references      uuid[]    NOT NULL DEFAULT '{}',

  -- v2 rich fields
  raw_text                    text        NULL,
  cleaned_text                text        NULL,
  title                       text        NULL,
  object_type                 text        NULL
                                CHECK (object_type IN (
                                  'task', 'reminder', 'idea', 'observation',
                                  'question', 'decision', 'journal', 'reference'
                                )),
  domain                      text        NOT NULL DEFAULT 'unknown'
                                CHECK (domain IN (
                                  'work', 'personal', 'health', 'family',
                                  'finance', 'project', 'misc', 'unknown'
                                )),
  temporal_has_date           boolean     NOT NULL DEFAULT false,
  temporal_date_text          text        NULL,
  temporal_urgency            text        NULL CHECK (temporal_urgency IN ('low', 'medium', 'high')),
  location_places             text[]      NOT NULL DEFAULT '{}',
  location_geofence_candidate boolean     NOT NULL DEFAULT false,
  is_actionable               boolean     NOT NULL DEFAULT false,
  next_action                 text        NULL,
  linked_object_ids           uuid[]      NOT NULL DEFAULT '{}',
  sequence_index              integer     NOT NULL DEFAULT 0,
  embedding_status            text        NOT NULL DEFAULT 'pending'
                                CHECK (embedding_status IN ('pending', 'complete', 'failed')),

  deleted_at                  timestamptz NULL,
  created_at                  timestamptz NOT NULL DEFAULT NOW(),
  updated_at                  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ao_user_id      ON hub.atomic_objects (user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ao_created_at   ON hub.atomic_objects (user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ao_object_type  ON hub.atomic_objects (user_id, object_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ao_domain       ON hub.atomic_objects (user_id, domain) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ao_embedding    ON hub.atomic_objects (embedding_status) WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------
-- hub.geofences
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hub.geofences (
  id                              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                         uuid        NOT NULL REFERENCES hub.users(id) ON DELETE CASCADE,
  name                            text        NOT NULL,
  center_latitude                 decimal     NOT NULL,
  center_longitude                decimal     NOT NULL,
  center_accuracy                 decimal     NULL,
  center_altitude                 decimal     NULL,
  radius                          decimal     NOT NULL DEFAULT 200,
  type                            text        NOT NULL DEFAULT 'custom'
                                    CHECK (type IN ('home', 'work', 'gym', 'custom', 'store')),
  associated_objects              uuid[]      NOT NULL DEFAULT '{}',
  notification_enabled            boolean     NOT NULL DEFAULT true,
  notification_on_enter           boolean     NOT NULL DEFAULT true,
  notification_on_exit            boolean     NOT NULL DEFAULT false,
  notification_quiet_hours_start  text        NULL,
  notification_quiet_hours_end    text        NULL,
  place_id                        uuid        NULL,
  created_by                      text        NOT NULL DEFAULT 'manual'
                                    CHECK (created_by IN ('manual', 'inferred')),
  created_at                      timestamptz NOT NULL DEFAULT NOW(),
  updated_at                      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geofences_user_id ON hub.geofences (user_id);

-- -----------------------------------------------------------------------
-- hub.geofence_objects  (many-to-many: geofence ↔ atomic_object)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hub.geofence_objects (
  geofence_id uuid NOT NULL REFERENCES hub.geofences(id) ON DELETE CASCADE,
  object_id   uuid NOT NULL REFERENCES hub.atomic_objects(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (geofence_id, object_id)
);

CREATE INDEX IF NOT EXISTS idx_geofence_objects_object_id ON hub.geofence_objects (object_id);
