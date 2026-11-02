import os
import psycopg

with psycopg.connect(os.environ["SHOPORA_PRODUCTION_URL"]) as conn:
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                conname,
                pg_get_constraintdef(oid)
            FROM pg_constraint
            WHERE conrelid = 'public.users'::regclass
        """)

        print("PRODUCTION USER CONSTRAINTS:")
        for row in cur.fetchall():
            print(row)