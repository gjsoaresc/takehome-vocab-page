-- PL/pgSQL core: the scheduler and the single write path live in Postgres.
-- Applied after schema.sql by src/migrate.ts.

-- ---------------------------------------------------------------------------
-- apply_review: SM-2 over the progress row for (user, word).
--   ease' = max(1.3, ease + (0.1 - (5-q) * (0.08 + (5-q) * 0.02)))
--   q>=3: reps++, interval = 1, 6, round(prev_interval * ease')
--   q<3:  reps=0, interval=0, due again in 10 minutes
-- Mastery: interval_days >= 21 sets mastered_at; a later lapse clears it and
-- decrements user_daily_stats.mastered on the ORIGINAL mastery day so the
-- mastery-over-time series stays consistent.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION apply_review(
  p_user uuid,
  p_word integer,
  p_quality integer,
  p_now timestamptz DEFAULT now()
) RETURNS progress
LANGUAGE plpgsql AS $$
DECLARE
  v_row progress;
  v_ease numeric(4, 2);
  v_reps integer;
  v_interval integer;
  v_due timestamptz;
  v_mastered_at timestamptz;
BEGIN
  IF p_quality IS NULL OR p_quality < 0 OR p_quality > 5 THEN
    RAISE EXCEPTION 'quality must be between 0 and 5, got %', p_quality;
  END IF;

  INSERT INTO progress (user_id, word_id)
  VALUES (p_user, p_word)
  ON CONFLICT (user_id, word_id) DO NOTHING;

  SELECT * INTO v_row
  FROM progress
  WHERE user_id = p_user AND word_id = p_word
  FOR UPDATE;

  v_ease := GREATEST(
    1.30,
    v_row.ease + (0.1 - (5 - p_quality) * (0.08 + (5 - p_quality) * 0.02))
  );

  IF p_quality < 3 THEN
    v_reps := 0;
    v_interval := 0;
    v_due := p_now + interval '10 minutes';
  ELSE
    v_reps := v_row.repetitions + 1;
    v_interval := CASE v_reps
      WHEN 1 THEN 1
      WHEN 2 THEN 6
      ELSE round(v_row.interval_days * v_ease)::integer
    END;
    v_due := p_now + make_interval(days => v_interval);
  END IF;

  v_mastered_at := v_row.mastered_at;
  IF v_interval >= 21 AND v_row.mastered_at IS NULL THEN
    v_mastered_at := p_now;
    INSERT INTO user_daily_stats (user_id, day, mastered)
    VALUES (p_user, (p_now AT TIME ZONE 'utc')::date, 1)
    ON CONFLICT (user_id, day) DO UPDATE
      SET mastered = user_daily_stats.mastered + 1;
  ELSIF p_quality < 3 AND v_row.mastered_at IS NOT NULL THEN
    INSERT INTO user_daily_stats (user_id, day, mastered)
    VALUES (p_user, (v_row.mastered_at AT TIME ZONE 'utc')::date, -1)
    ON CONFLICT (user_id, day) DO UPDATE
      SET mastered = user_daily_stats.mastered - 1;
    v_mastered_at := NULL;
  END IF;

  UPDATE progress SET
    ease = v_ease,
    interval_days = v_interval,
    repetitions = v_reps,
    due_at = v_due,
    mastered_at = v_mastered_at,
    correct_count = correct_count + (p_quality >= 3)::integer,
    miss_count = miss_count + (p_quality < 3)::integer,
    last_reviewed_at = p_now,
    updated_at = now()
  WHERE user_id = p_user AND word_id = p_word
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- record_event: THE write path. Inserts the event (idempotent on event_id),
-- applies SM-2 for scoring events, and maintains the analytics rollups --
-- all inside the caller's transaction.
-- Quality mapping (the only place it exists):
--   rated            -> the user's own 0-5 rating (Learn: Again/Hard/Good/Easy = 1/3/4/5)
--   graded, matched  -> correct ? 4 : 1
--   revealed, game_finished -> no scoring, event only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_event(
  p_event_id uuid,
  p_user uuid,
  p_mode text,
  p_type text,
  p_word integer DEFAULT NULL,
  p_sense integer DEFAULT NULL,
  p_correct boolean DEFAULT NULL,
  p_rating integer DEFAULT NULL,
  p_payload jsonb DEFAULT '{}',
  p_now timestamptz DEFAULT now()
) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  v_quality integer;
  v_progress progress;
  v_existing jsonb;
BEGIN
  INSERT INTO events (event_id, user_id, mode, type, word_id, sense_id, correct, rating, payload, created_at)
  VALUES (p_event_id, p_user, p_mode, p_type, p_word, p_sense, p_correct, p_rating, p_payload, p_now)
  ON CONFLICT (event_id) DO NOTHING;

  IF NOT FOUND THEN
    SELECT to_jsonb(p) INTO v_existing
    FROM progress p
    WHERE p.user_id = p_user AND p.word_id = p_word;
    RETURN jsonb_build_object('duplicate', true, 'progress', coalesce(v_existing, 'null'::jsonb));
  END IF;

  v_quality := CASE
    WHEN p_type = 'rated' THEN p_rating
    WHEN p_type IN ('graded', 'matched') THEN CASE WHEN p_correct THEN 4 ELSE 1 END
    ELSE NULL
  END;

  IF v_quality IS NULL OR p_word IS NULL THEN
    RETURN jsonb_build_object('duplicate', false, 'progress', 'null'::jsonb);
  END IF;

  v_progress := apply_review(p_user, p_word, v_quality, p_now);

  INSERT INTO user_daily_stats (user_id, day, reviews, correct)
  VALUES (p_user, (p_now AT TIME ZONE 'utc')::date, 1, (v_quality >= 3)::integer)
  ON CONFLICT (user_id, day) DO UPDATE SET
    reviews = user_daily_stats.reviews + 1,
    correct = user_daily_stats.correct + excluded.correct;

  INSERT INTO user_mode_stats (user_id, mode, attempts, correct)
  VALUES (p_user, p_mode, 1, (v_quality >= 3)::integer)
  ON CONFLICT (user_id, mode) DO UPDATE SET
    attempts = user_mode_stats.attempts + 1,
    correct = user_mode_stats.correct + excluded.correct;

  RETURN jsonb_build_object('duplicate', false, 'progress', to_jsonb(v_progress));
END;
$$;
