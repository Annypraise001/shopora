import os
import sqlite3
import sys
import psycopg

LOCAL_DB = "shopora.db"
DATABASE_URL = os.getenv("SHOPORA_PRODUCTION_URL")

SELLER_EMAILS = [
    "hj8032265@gmail.com",
    "oluwadarasimio373@gmail.com",
    "otimi5577@gmail.com",
]

if not DATABASE_URL:
    raise SystemExit("Production database URL is not set.")

# Read the three genuine seller accounts and their products.
with sqlite3.connect(LOCAL_DB) as local:
    local.row_factory = sqlite3.Row

    sellers = [
        dict(row)
        for row in local.execute(
            """
            SELECT id, name, email, password_hash, role
            FROM users
            WHERE email IN (?, ?, ?)
            ORDER BY email
            """,
            SELLER_EMAILS,
        )
    ]

    if len(sellers) != 3 or any(s["role"] != "seller" for s in sellers):
        raise SystemExit("Seller account check failed.")

    if any(not s["password_hash"] for s in sellers):
        raise SystemExit("A seller has no password hash.")

    seller_ids = [s["id"] for s in sellers]

    products = [
        dict(row)
        for row in local.execute(
            """
            SELECT id, name, price, category, stock, seller_id
            FROM products
            WHERE seller_id IN (?, ?, ?)
            ORDER BY id
            """,
            seller_ids,
        )
    ]

    if any(p["seller_id"] not in seller_ids for p in products):
        raise SystemExit("Unexpected product owner. Import stopped.")

print("SELLERS TO RESTORE:")
for seller in sellers:
    print(f'{seller["name"]} | {seller["email"]}')

print("\nSELLER PRODUCTS TO RESTORE:")
for product in products:
    print(
        f'{product["id"]}: {product["name"]} | '
        f'₦{product["price"]:,.2f} | Stock: {product["stock"]}'
    )

if "--apply" not in sys.argv:
    print("\nPREVIEW ONLY. Nothing has been imported.")
    raise SystemExit(0)

# Insert accounts and products together in one transaction.
with psycopg.connect(DATABASE_URL, connect_timeout=15) as production:
    with production.cursor() as cursor:

        cursor.execute("SELECT COUNT(*) FROM public.products")
        if cursor.fetchone()[0] != 13:
            raise SystemExit(
                "Production product count changed. Import stopped."
            )

        cursor.execute("SELECT COUNT(*) FROM public.users")
        if cursor.fetchone()[0] != 1:
            raise SystemExit(
                "Production user count changed. Import stopped."
            )

        for seller in sellers:
            cursor.execute(
                """
                SELECT id FROM public.users
                WHERE LOWER(email) = LOWER(%s) OR id = %s
                """,
                (seller["email"], seller["id"]),
            )
            if cursor.fetchone():
                raise SystemExit(
                    f'Account conflict for {seller["email"]}. Import stopped.'
                )

        for product in products:
            cursor.execute(
                "SELECT id FROM public.products WHERE id = %s",
                (product["id"],),
            )
            if cursor.fetchone():
                raise SystemExit(
                    f'Product ID conflict: {product["id"]}. Import stopped.'
                )

        cursor.executemany(
            """
            INSERT INTO public.users
                (id, name, email, password_hash, role)
            VALUES (%s, %s, %s, %s, %s)
            """,
            [
                (
                    s["id"],
                    s["name"],
                    s["email"],
                    s["password_hash"],
                    s["role"],
                )
                for s in sellers
            ],
        )

        cursor.executemany(
            """
            INSERT INTO public.products
                (id, name, price, category, stock, seller_id)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            [
                (
                    p["id"],
                    p["name"],
                    p["price"],
                    p["category"],
                    p["stock"],
                    p["seller_id"],
                )
                for p in products
            ],
        )

        if products:
            cursor.execute("""
                SELECT setval(
                    'public.products_id_seq',
                    (SELECT MAX(id) FROM public.products),
                    true
                )
            """)

        cursor.execute("SELECT COUNT(*) FROM public.users")
        user_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM public.products")
        product_count = cursor.fetchone()[0]

        if user_count != 4 or product_count != 15 + len(products) - 2:
            # Expected: 1 existing user + 3 sellers;
            # 13 existing products + the seller-owned products.
            raise RuntimeError("Final verification failed.")

print(f"SUCCESS: {len(sellers)} seller accounts restored.")
print(f"SUCCESS: {len(products)} seller-owned products restored.")