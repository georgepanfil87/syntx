
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE EXTENSION IF NOT EXISTS citext;

CREATE EXTENSION IF NOT EXISTS vector;
DO $$
BEGIN
  RAISE NOTICE 'Syntx init complete: pgcrypto + citext + vector enabled on %', current_database();
END
$$;
