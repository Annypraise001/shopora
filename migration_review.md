# Shopora production database review

## Backup created locally

Backup file:
- shopora_backup_for_review_20261101_191756.db

Verified counts from the local working database:
- users: 6
- products: 16
- orders: 1
- order_items: 1
- cart_items: 0

This backup was created from the working local SQLite database and was not used to modify production in any way.

## Root cause

The local Shopora database contains the expected product inventory, but the production Render PostgreSQL database is not populated with the same data. The application code does not include a migration step or a seeding step that populates missing products, so the production `/products` endpoint returns an empty list.

## Safe migration approach for review

1. Confirm a valid backup of the production PostgreSQL database exists.
2. Export the working SQLite rows from the local database that contains the 16 products.
3. Compare the production schema against the app schema in `models.py`.
4. Insert only missing rows with `ON CONFLICT DO NOTHING` logic.
5. Preserve IDs, user roles, password hashes, and seller relationships as-is.
6. Never drop or overwrite existing production rows.
7. Verify `/products` returns the expected product list before declaring success.

## Migration script

The review-only migration script is here:
- scripts/migrate_sqlite_to_postgres_review.py

This script is intentionally defaulted to dry-run mode. It will not connect to or modify production unless the operator explicitly invokes `--execute` after approval.

## Exact proposed production action (pending approval)

The production action would be:
- confirm the Render PostgreSQL backup exists
- check the current remote row counts
- compare the local SQLite counts to the production counts
- run the migration helper in review mode first
- run the same import in execute mode only if the review is approved
- verify `/products` returns the expected inventory and no duplicates are created

## Non-goals and safety rules

- Do not expose credentials or tokens in logs.
- Do not overwrite or delete production data.
- Do not promote any user to admin.
- Do not change the approved frontend design.
- Do not deploy automatically.
