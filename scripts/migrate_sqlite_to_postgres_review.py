#!/usr/bin/env python3
"""
Review-only SQLite -> PostgreSQL migration helper for Shopora.

IMPORTANT:
- This script does NOT run against production by default.
- It defaults to dry-run mode for safety review before approval.
- It never deletes production data.
- It only inserts rows that are missing and explicitly uses ON CONFLICT DO NOTHING.
- It is designed to preserve IDs where possible.

Usage (review only):
    python scripts/migrate_sqlite_to_postgres_review.py --dry-run

After approval and only with explicit human confirmation:
    python scripts/migrate_sqlite_to_postgres_review.py --execute --sqlite-path shopora.db

Notes:
- You must provide a PostgreSQL URL through the DATABASE_URL environment variable
  or the --postgres-url argument.
- Do not print password hashes, JWT tokens, or secret connection details.
- The script masks secrets before printing them.
"""

from __future__ import annotations

import argparse
import os
import re
import sqlite3
import sys
from typing import Iterable

from sqlalchemy import create_engine, text

LOCAL_SQLITE_PATH = "shopora.db"
TARGET_TABLES = [
    "users",
    "products",
    "orders",
    "order_items",
    "cart_items",
]


def mask_database_url(value: str) -> str:
    if not value:
        return "<not set>"
    if "@" in value and "://" in value:
        scheme, rest = value.split("://", 1)
        userinfo, hostinfo = rest.rsplit("@", 1)
        masked_user = "***:***"
        return f"{scheme}://{masked_user}@{hostinfo}"
    return value


def get_sqlite_connection(path: str):
    return sqlite3.connect(f"file:{path}?mode=ro", uri=True)


def fetch_table_rows(conn: sqlite3.Connection, table_name: str):
    query = f'SELECT * FROM "{table_name}" ORDER BY 1'
    columns = [
        row[1]
        for row in conn.execute(
            "PRAGMA table_info(?)",
            (table_name,),
        ).fetchall()
    ]
    if not columns:
        return []
    rows = conn.execute(query).fetchall()
    return [dict(zip(columns, row)) for row in rows]


def get_sqlite_counts(path: str):
    with get_sqlite_connection(path) as conn:
        counts = {}
        for table in TARGET_TABLES:
            try:
                counts[table] = conn.execute(
                    f'SELECT COUNT(*) FROM "{table}"'
                ).fetchone()[0]
            except sqlite3.DatabaseError:
                counts[table] = 0
        return counts


def get_remote_table_counts(postgres_url: str):
    engine = create_engine(postgres_url)
    with engine.begin() as conn:
        tables = conn.execute(
            text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_name IN (:tables)"
            ),
            {"tables": TARGET_TABLES},
        ).fetchall()
        existing = {row[0] for row in tables}
        counts = {}
        for table in TARGET_TABLES:
            if table not in existing:
                counts[table] = 0
                continue
            result = conn.execute(text(f'SELECT COUNT(*) FROM "{table}"')).scalar()
            counts[table] = int(result)
    return counts


def build_insert_sql(table_name: str, columns: Iterable[str]) -> str:
    column_names = [f'"{name}"' for name in columns]
    placeholders = ", ".join(f":{name}" for name in columns)
    sql = (
        f'INSERT INTO "{table_name}" ({", ".join(column_names)}) '
        f'VALUES ({placeholders}) '
        'ON CONFLICT (id) DO NOTHING'
    )
    return sql


def migrate_sqlite_to_postgres(sqlite_path: str, postgres_url: str, execute: bool = False):
    local_counts = get_sqlite_counts(sqlite_path)
    print("LOCAL_DB", sqlite_path)
    print("LOCAL_COUNTS", local_counts)

    pg_url = postgres_url or os.getenv("DATABASE_URL")
    if not pg_url:
        print("No PostgreSQL DATABASE_URL provided. Refusing to continue.")
        return 1

    print("POSTGRES_URL", mask_database_url(pg_url))

    remote_counts = get_remote_table_counts(pg_url)
    print("REMOTE_COUNTS", remote_counts)

    if not execute:
        print("DRY_RUN_ONLY: no data was written to the production database.")
        print("SAFE_REVIEW_MODE: the script is prepared and ready for approval.")
        return 0

    if remote_counts.get("products", 0) > 0:
        print("Stopping migration: production already has product rows. This prevents accidental overwrite or duplication.")
        return 2

    engine = create_engine(postgres_url)
    with get_sqlite_connection(sqlite_path) as sqlite_conn:
        for table in TARGET_TABLES:
            rows = fetch_table_rows(sqlite_conn, table)
            if not rows:
                print(f"SKIP_TABLE {table}: no local rows found")
                continue

            columns = list(rows[0].keys())
            sql = build_insert_sql(table, columns)
            with engine.begin() as pg_conn:
                for row in rows:
                    pg_conn.execute(text(sql), row)
                pg_conn.commit()
                print(f"IMPORTED_TABLE {table}: {len(rows)} rows")

    print("Migration finished. Review the remote counts before calling the production API.")
    return 0


def parse_args():
    parser = argparse.ArgumentParser(
        description="Review-only SQLite to PostgreSQL migration helper for Shopora."
    )
    parser.add_argument(
        "--sqlite-path",
        default=LOCAL_SQLITE_PATH,
        help="Path to the local SQLite database that contains the working Shopora data.",
    )
    parser.add_argument(
        "--postgres-url",
        default=os.getenv("DATABASE_URL"),
        help="Production PostgreSQL URL. This is masked before printing. Do not expose credentials.",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Run the import. This is disabled by default to keep migration review-safe.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Explicitly enable dry-run behavior. This is the default mode.",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    if args.execute and args.dry_run:
        print("Choose either --execute or --dry-run, not both.")
        return 1

    # Default safety behavior is dry-run. This prevents accidental production modifications.
    return migrate_sqlite_to_postgres(
        sqlite_path=args.sqlite_path,
        postgres_url=args.postgres_url,
        execute=bool(args.execute),
    )


if __name__ == "__main__":
    raise SystemExit(main())
