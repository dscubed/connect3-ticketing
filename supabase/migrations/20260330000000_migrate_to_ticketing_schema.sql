-- =============================================================================
-- Migration: connect3 legacy schema → connect3-ticketing schema
-- Generated: 2026-03-30
--
-- SAFE TO RUN: adds columns/tables; does NOT drop anything.
-- Deprecated items are listed at the bottom for manual cleanup later.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. NEW COLUMNS ON events
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS status             text        NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS published_at       timestamptz,
  ADD COLUMN IF NOT EXISTS location_type      text        NOT NULL DEFAULT 'physical',
  ADD COLUMN IF NOT EXISTS online_link        text,
  ADD COLUMN IF NOT EXISTS is_recurring       boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS event_capacity     integer,
  ADD COLUMN IF NOT EXISTS timezone           text,
  ADD COLUMN IF NOT EXISTS theme_mode         text        NOT NULL DEFAULT 'adaptive',
  ADD COLUMN IF NOT EXISTS theme_layout       text        NOT NULL DEFAULT 'card',
  ADD COLUMN IF NOT EXISTS theme_accent       text        NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS theme_accent_custom text,
  ADD COLUMN IF NOT EXISTS theme_bg_color     text,
  ADD COLUMN IF NOT EXISTS url_slug           text,
  ADD COLUMN IF NOT EXISTS ig_post_id         text,
  ADD COLUMN IF NOT EXISTS ticketing_enabled  boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at         timestamptz NOT NULL DEFAULT now();

-- Backfill: all existing events were published
UPDATE events
SET
  status       = 'published',
  published_at = COALESCE(published_at, created_at)
WHERE status = 'published'
  AND published_at IS NULL;

-- Backfill: event_capacity from legacy capacity column (if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'capacity'
  ) THEN
    UPDATE events SET event_capacity = capacity WHERE event_capacity IS NULL AND capacity IS NOT NULL;
  END IF;
END $$;

-- Backfill: location_type for online events
UPDATE events SET location_type = 'online' WHERE is_online = true AND location_type = 'physical';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. event_locations — add missing columns (city/country stay for now)
-- ─────────────────────────────────────────────────────────────────────────────

-- No new columns needed; existing venue/address/latitude/longitude columns are used.
-- city and country are deprecated (see bottom) but NOT dropped here.

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. event_images
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_images (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    text        NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  url         text        NOT NULL,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_images_event_id_idx ON event_images (event_id);

-- Backfill: migrate thumbnail → first carousel image
INSERT INTO event_images (event_id, url, sort_order)
SELECT id, thumbnail, 0
FROM   events
WHERE  thumbnail IS NOT NULL
  AND  id NOT IN (SELECT DISTINCT event_id FROM event_images)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. event_ticket_tiers (replaces event_pricings)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_ticket_tiers (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            text        NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  name                text        NOT NULL DEFAULT 'General Admission',
  price               numeric     NOT NULL DEFAULT 0 CHECK (price >= 0),
  quantity            integer,                          -- NULL = unlimited
  member_verification boolean     NOT NULL DEFAULT false,
  offer_start         timestamptz,
  offer_end           timestamptz,
  sort_order          integer     NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_ticket_tiers_event_id_idx ON event_ticket_tiers (event_id);

-- Backfill: migrate event_pricings → event_ticket_tiers
-- Creates a single tier from the old min price (or 0 for free events).
-- Only migrates events that don't already have tiers.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'event_pricings'
  ) THEN
    INSERT INTO event_ticket_tiers (event_id, name, price, sort_order)
    SELECT
      ep.event_id,
      CASE WHEN ep.min > 0 THEN 'General Admission' ELSE 'Free' END,
      COALESCE(ep.min, 0),
      0
    FROM event_pricings ep
    WHERE ep.event_id NOT IN (SELECT DISTINCT event_id FROM event_ticket_tiers)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. event_occurrences
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_occurrences (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    text        NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  start       timestamptz NOT NULL,
  "end"       timestamptz,
  name        text,
  venue_ids   text[]      NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_occurrences_event_id_idx ON event_occurrences (event_id);
CREATE INDEX IF NOT EXISTS event_occurrences_start_idx    ON event_occurrences (start);

-- Backfill: one occurrence per existing event from start/end columns
INSERT INTO event_occurrences (event_id, start, "end")
SELECT id, start, "end"
FROM   events
WHERE  start IS NOT NULL
  AND  id NOT IN (SELECT DISTINCT event_id FROM event_occurrences)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. event_hosts (collaborators)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_hosts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    text        NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  profile_id  uuid        NOT NULL,
  status      text        NOT NULL DEFAULT 'accepted',  -- accepted | pending | declined
  sort_order  integer     NOT NULL DEFAULT 0,
  inviter_id  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, profile_id)
);

CREATE INDEX IF NOT EXISTS event_hosts_event_id_idx   ON event_hosts (event_id);
CREATE INDEX IF NOT EXISTS event_hosts_profile_id_idx ON event_hosts (profile_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. event_links
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_links (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    text        NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  url         text        NOT NULL,
  title       text,
  sort_order  integer     NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS event_links_event_id_idx ON event_links (event_id);

-- Backfill: migrate legacy booking_url → event_links
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'booking_url'
  ) THEN
    INSERT INTO event_links (event_id, url, title, sort_order)
    SELECT id, booking_url, 'Register / Book', 0
    FROM   events
    WHERE  booking_url IS NOT NULL
      AND  booking_url <> ''
      AND  id NOT IN (SELECT DISTINCT event_id FROM event_links)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. event_sections (rich page content blocks)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_sections (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    text        NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  type        text        NOT NULL,   -- e.g. "faq", "text", "sponsors"
  data        jsonb       NOT NULL DEFAULT '{}',
  sort_order  integer     NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS event_sections_event_id_idx ON event_sections (event_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. event_ticketing_fields (custom checkout questions)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_ticketing_fields (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    text        NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  label       text        NOT NULL,
  input_type  text        NOT NULL DEFAULT 'text',  -- text | select | checkbox | ...
  placeholder text,
  required    boolean     NOT NULL DEFAULT false,
  options     text[],
  sort_order  integer     NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS event_ticketing_fields_event_id_idx ON event_ticketing_fields (event_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. recent_event_edits (editor recency tracking)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recent_event_edits (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL,
  event_id    text        NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  edited_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS recent_event_edits_user_id_idx  ON recent_event_edits (user_id);
CREATE INDEX IF NOT EXISTS recent_event_edits_edited_at_idx ON recent_event_edits (edited_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. updated_at trigger
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS events_updated_at ON events;
CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- DEPRECATED — Safe to DROP in a follow-up migration once verified
-- =============================================================================
--
-- Tables:
--   event_pricings          → replaced by event_ticket_tiers
--
-- Columns on events:
--   events.booking_url      → migrated to event_links; users now use ticketing page
--   events.capacity         → migrated to events.event_capacity
--   events.currency         → no longer used (platform currency is implicit)
--   events.openai_file_id   → AI/vector store integration removed from schema
--
-- Columns on event_locations:
--   event_locations.city    → not used in connect3-ticketing schema
--   event_locations.country → not used in connect3-ticketing schema
--
-- To drop them later (after verifying no app code reads them):
--
--   ALTER TABLE events
--     DROP COLUMN IF EXISTS booking_url,
--     DROP COLUMN IF EXISTS capacity,
--     DROP COLUMN IF EXISTS currency,
--     DROP COLUMN IF EXISTS openai_file_id;
--
--   ALTER TABLE event_locations
--     DROP COLUMN IF EXISTS city,
--     DROP COLUMN IF EXISTS country;
--
--   DROP TABLE IF EXISTS event_pricings;
--
-- =============================================================================
