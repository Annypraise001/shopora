import sqlite3

with sqlite3.connect("shopora.db") as conn:
    rows = conn.execute("""
        SELECT
            name,
            email,
            role,
            CASE
                WHEN password_hash IS NOT NULL
                     AND password_hash != ''
                THEN 'Present'
                ELSE 'Missing'
            END AS password_status
        FROM users
        WHERE email IN (
            'hj8032265@gmail.com',
            'oluwadarasimio373@gmail.com',
            'otimi5577@gmail.com'
        )
        ORDER BY email
    """).fetchall()

print("SELLER ACCOUNT CHECK:")
for row in rows:
    print(row)