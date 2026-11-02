import os
import sqlite3
import sys
import psycopg


LOCAL_DB = "shopora.db"
DATABASE_URL = os.getenv("SHOPORA_PRODUCTION_URL")

if not DATABASE_URL:
    raise SystemExit("Production database URL is not set.")

# Read only the 13 general products from local SQLite.
with sqlite3.connect(LOCAL_DB) as local:
    local.row_factory = sqlite3.Row
    products = [
        dict(row)
        for row in local.execute("""
            SELECT id, name, price, category, stock, seller_id
            FROM products
            WHERE seller_id IS NULL
            ORDER BY id
        """)
    ]

if len(products) != 13:
    raise SystemExit(
        f"Expected 13 general products, found {len(products)}. Import stopped."
    )

if any(product["seller_id"] is not None for product in products):
    raise SystemExit("Seller-owned product detected. Import stopped.")

print(f"Found {len(products)} general products:")
for product in products:
    print(
        f'{product["id"]}: {product["name"]} | '
        f'₦{product["price"]:,.2f} | Stock: {product["stock"]}'
    )

if "--apply" not in sys.argv:
    print("\nPREVIEW ONLY. Nothing has been imported.")
    print("Review the list before authorizing the import.")
    raise SystemExit(0)

# Import all 13 in one transaction.
with psycopg.connect(DATABASE_URL, connect_timeout=15) as production:
    with production.cursor() as cursor:
        cursor.execute('SELECT COUNT(*) FROM public.products')
        existing_count = cursor.fetchone()[0]

        if existing_count != 0:
            raise SystemExit(
                f"Production already has {existing_count} products. "
                "Import stopped to prevent conflicts."
            )

        cursor.executemany(
            """
            INSERT INTO public.products
                (id, name, price, category, stock, seller_id)
            VALUES (%s, %s, %s, %s, %s, NULL)
            """,
            [
                (
                    p["id"],
                    p["name"],
                    p["price"],
                    p["category"],
                    p["stock"],
                )
                for p in products
            ],
        )

        cursor.execute("""
            SELECT setval(
                'public.products_id_seq',
                (SELECT MAX(id) FROM public.products),
                true
            )
        """)

        cursor.execute('SELECT COUNT(*) FROM public.products')
        imported_count = cursor.fetchone()[0]

        if imported_count != 13:
            raise RuntimeError("Product count verification failed.")

print(f"SUCCESS: {imported_count} products restored.")