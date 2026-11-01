import jwt
from uuid import uuid4
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pwdlib import PasswordHash

from database import engine, Base, SessionLocal
import models

from schemas.user import UserRegister
from schemas.login import UserLogin

from security import create_access_token, verify_access_token


password_hash = PasswordHash.recommended()
bearer_scheme = HTTPBearer()


# -------------------------
# FASTAPI APPLICATION
# -------------------------

app = FastAPI(
    title="Shopora API",
    description="Backend for the Shopora shopping platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "https://shopora-gi8x.onrender.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],

)

# Create missing tables without deleting existing data.
Base.metadata.create_all(bind=engine)


# -------------------------
# PRODUCT AND CART SCHEMAS
# -------------------------

class Product(BaseModel):
    id: int
    name: str
    price: float = Field(ge=0)
    category: str
    stock: int = Field(ge=0)


class ProductCreate(BaseModel):
    name: str = Field(min_length=1)
    price: float = Field(ge=0)
    category: str = Field(min_length=1)
    stock: int = Field(ge=0)


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    price: float | None = Field(default=None, ge=0)
    category: str | None = Field(default=None, min_length=1)
    stock: int | None = Field(default=None, ge=0)


class CartItemCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0)


# -------------------------
# AUTHENTICATION
# -------------------------

def _get_current_user(
    credentials: HTTPAuthorizationCredentials,
    required_role: str,
):
    try:
        payload = verify_access_token(credentials.credentials)
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token.",
        )

    user_id = payload.get("sub")

    if not user_id or payload.get("role") != required_role:
        raise HTTPException(
            status_code=403,
            detail=f"{required_role.capitalize()} access required.",
        )

    db = SessionLocal()

    try:
        user = (
            db.query(models.User)
            .filter(models.User.id == user_id)
            .first()
        )

        if user is None or user.role != required_role:
            raise HTTPException(
                status_code=403,
                detail=f"{required_role.capitalize()} access required.",
            )

        return {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
        }

    finally:
        db.close()


def get_current_seller(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    return _get_current_user(credentials, "seller")


def get_current_customer(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    return _get_current_user(credentials, "customer")


def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    return _get_current_user(credentials, "admin")


# -------------------------
# HOME AND HEALTH
# -------------------------

@app.get("/")
def home():
    return {
        "message": "Welcome to Shopora!",
        "status": "running",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


# -------------------------
# CUSTOMER REGISTRATION
# -------------------------

@app.post("/register", status_code=201)
def register_user(user_data: UserRegister):
    db = SessionLocal()

    try:
        email = str(user_data.email).lower()

        existing_user = (
            db.query(models.User)
            .filter(models.User.email == email)
            .first()
        )

        if existing_user:
            raise HTTPException(
                status_code=409,
                detail="An account with this email already exists.",
            )

        user = models.User(
            id=str(uuid4()),
            name=user_data.name.strip(),
            email=email,
            password_hash=password_hash.hash(user_data.password),
        )

        db.add(user)
        db.commit()
        db.refresh(user)

        return {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "message": "Registration successful.",
        }

    finally:
        db.close()


# -------------------------
# CUSTOMER LOGIN
# -------------------------

@app.post("/login")
def login_user(login_data: UserLogin):
    db = SessionLocal()

    try:
        email = str(login_data.email).lower()

        user = (
            db.query(models.User)
            .filter(models.User.email == email)
            .first()
        )

        if user is None or not password_hash.verify(
            login_data.password,
            user.password_hash,
        ):
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password.",
            )

        token = create_access_token(
            user_id=user.id,
            role=user.role,
        )

        return {
            "message": "Login successful.",
            "access_token": token,
            "token_type": "bearer",
            "user_id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
        }

    finally:
        db.close()


# -------------------------
# SELLER REGISTRATION
# -------------------------

@app.post("/seller/register", status_code=201)
def register_seller(user_data: UserRegister):
    db = SessionLocal()

    try:
        email = str(user_data.email).lower()

        existing_user = (
            db.query(models.User)
            .filter(models.User.email == email)
            .first()
        )

        if existing_user:
            raise HTTPException(
                status_code=409,
                detail="An account with this email already exists.",
            )

        seller = models.User(
            id=str(uuid4()),
            name=user_data.name.strip(),
            email=email,
            password_hash=password_hash.hash(user_data.password),
            role="seller",
        )

        db.add(seller)
        db.commit()
        db.refresh(seller)

        return {
            "message": "Seller registration successful.",
            "seller_id": seller.id,
            "name": seller.name,
            "email": seller.email,
            "role": seller.role,
        }

    finally:
        db.close()


# -------------------------
# SELLER LOGIN
# -------------------------

@app.post("/seller/login")
def login_seller(login_data: UserLogin):
    db = SessionLocal()

    try:
        email = str(login_data.email).lower()

        seller = (
            db.query(models.User)
            .filter(models.User.email == email)
            .first()
        )

        if (
            seller is None
            or seller.role != "seller"
            or not password_hash.verify(
                login_data.password,
                seller.password_hash,
            )
        ):
            raise HTTPException(
                status_code=401,
                detail="Invalid seller email or password.",
            )

        token = create_access_token(
            user_id=seller.id,
            role=seller.role,
        )

        return {
            "message": "Seller login successful.",
            "access_token": token,
            "token_type": "bearer",
            "seller_id": seller.id,
            "name": seller.name,
            "role": seller.role,
        }

    finally:
        db.close()


# -------------------------
# ADMIN LOGIN
# -------------------------

@app.post("/admin/login")
def login_admin(login_data: UserLogin):
    db = SessionLocal()

    try:
        email = str(login_data.email).lower()

        admin = (
            db.query(models.User)
            .filter(models.User.email == email)
            .first()
        )

        if (
            admin is None
            or admin.role != "admin"
            or not password_hash.verify(
                login_data.password,
                admin.password_hash,
            )
        ):
            raise HTTPException(
                status_code=401,
                detail="Invalid administrator email or password.",
            )

        token = create_access_token(
            user_id=admin.id,
            role="admin",
        )

        return {
            "message": "Administrator login successful.",
            "access_token": token,
            "token_type": "bearer",
            "user_id": admin.id,
            "name": admin.name,
            "email": admin.email,
            "role": admin.role,
        }

    finally:
        db.close()


# -------------------------
# PUBLIC MARKETPLACE PRODUCTS
# -------------------------

@app.get("/products", response_model=list[Product])
def get_products(search: str = ""):
    db = SessionLocal()

    try:
        query = db.query(models.Product)
        search_term = search.strip()

        if search_term:
            query = query.filter(
                models.Product.name.ilike(f"%{search_term}%")
                | models.Product.category.ilike(f"%{search_term}%")
            )

        items = query.all()

        return [
            Product(
                id=item.id,
                name=item.name,
                price=item.price,
                category=item.category,
                stock=item.stock,
            )
            for item in items
        ]

    finally:
        db.close()


@app.get("/products/{product_id}", response_model=Product)
def get_product(product_id: int):
    db = SessionLocal()

    try:
        item = (
            db.query(models.Product)
            .filter(models.Product.id == product_id)
            .first()
        )

        if item is None:
            raise HTTPException(
                status_code=404,
                detail="Product not found.",
            )

        return Product(
            id=item.id,
            name=item.name,
            price=item.price,
            category=item.category,
            stock=item.stock,
        )

    finally:
        db.close()


# -------------------------
# ADMIN: CREATE GENERAL PRODUCT
# -------------------------

@app.post("/products", response_model=Product)
def create_product(
    product_data: ProductCreate,
    admin: dict = Depends(get_current_admin),
):
    db = SessionLocal()

    try:
        new_product = models.Product(
            name=product_data.name.strip(),
            price=product_data.price,
            category=product_data.category.strip(),
            stock=product_data.stock,
        )

        db.add(new_product)
        db.commit()
        db.refresh(new_product)

        return Product(
            id=new_product.id,
            name=new_product.name,
            price=new_product.price,
            category=new_product.category,
            stock=new_product.stock,
        )

    finally:
        db.close()


# -------------------------
# ADMIN: BULK PRODUCT CREATION
# -------------------------

@app.post(
    "/products/bulk",
    response_model=list[Product],
    status_code=201,
)
def create_products_bulk(
    product_data: list[ProductCreate],
    admin: dict = Depends(get_current_admin),
):
    if not product_data:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one product.",
        )

    db = SessionLocal()

    try:
        new_products = [
            models.Product(
                name=item.name.strip(),
                price=item.price,
                category=item.category.strip(),
                stock=item.stock,
            )
            for item in product_data
        ]

        db.add_all(new_products)
        db.commit()

        for item in new_products:
            db.refresh(item)

        return [
            Product(
                id=item.id,
                name=item.name,
                price=item.price,
                category=item.category,
                stock=item.stock,
            )
            for item in new_products
        ]

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


# -------------------------
# ADMIN: VIEW ALL USERS
# -------------------------

@app.get("/admin/users")
def get_all_users(
    admin: dict = Depends(get_current_admin),
):
    db = SessionLocal()

    try:
        users = (
            db.query(models.User)
            .order_by(models.User.name)
            .all()
        )

        return {
            "users": [
                {
                    "id": user.id,
                    "name": user.name,
                    "email": user.email,
                    "role": user.role,
                }
                for user in users
            ],
            "count": len(users),
        }

    finally:
        db.close()


# -------------------------
# ADMIN: VIEW ALL PRODUCTS
# -------------------------

@app.get("/admin/products")
def get_all_products(
    admin: dict = Depends(get_current_admin),
):
    db = SessionLocal()

    try:
        products = db.query(models.Product).all()

        return {
            "products": [
                {
                    "id": product.id,
                    "name": product.name,
                    "price": product.price,
                    "category": product.category,
                    "stock": product.stock,
                    "seller_id": product.seller_id,
                }
                for product in products
            ],
            "count": len(products),
        }

    finally:
        db.close()


# -------------------------
# ADMIN: VIEW ALL ORDERS
# -------------------------

@app.get("/admin/orders")
def get_all_orders(
    admin: dict = Depends(get_current_admin),
):
    db = SessionLocal()

    try:
        orders = (
            db.query(models.Order)
            .order_by(models.Order.created_at.desc())
            .all()
        )

        result = []

        for order in orders:
            customer = (
                db.query(models.User)
                .filter(models.User.id == order.customer_id)
                .first()
            )

            items = (
                db.query(models.OrderItem)
                .filter(models.OrderItem.order_id == order.id)
                .all()
            )

            result.append({
                "order_id": order.id,
                "customer_id": order.customer_id,
                "customer_name": customer.name if customer else None,
                "total_amount": order.total_amount,
                "status": order.status,
                "payment_status": order.payment_status,
                "created_at": order.created_at,
                "items": [
                    {
                        "product_id": item.product_id,
                        "product_name": item.product_name,
                        "seller_id": item.seller_id,
                        "quantity": item.quantity,
                        "unit_price": item.unit_price,
                        "subtotal": item.subtotal,
                    }
                    for item in items
                ],
            })

        return {
            "orders": result,
            "count": len(result),
        }

    finally:
        db.close()


# -------------------------
# SELLER: CREATE OWN PRODUCT
# -------------------------

@app.post("/seller/products", status_code=201)
def create_seller_product(
    product_data: ProductCreate,
    seller: dict = Depends(get_current_seller),
):
    db = SessionLocal()

    try:
        product = models.Product(
            name=product_data.name.strip(),
            price=product_data.price,
            category=product_data.category.strip(),
            stock=product_data.stock,
            seller_id=seller["id"],
        )

        db.add(product)
        db.commit()
        db.refresh(product)

        return {
            "message": "Product created successfully.",
            "id": product.id,
            "name": product.name,
            "price": product.price,
            "category": product.category,
            "stock": product.stock,
            "seller_id": product.seller_id,
        }

    finally:
        db.close()


# -------------------------
# SELLER: VIEW OWN PRODUCTS
# -------------------------

@app.get("/seller/products")
def get_seller_products(
    seller: dict = Depends(get_current_seller),
):
    db = SessionLocal()

    try:
        products = (
            db.query(models.Product)
            .filter(models.Product.seller_id == seller["id"])
            .all()
        )

        return [
            {
                "id": product.id,
                "name": product.name,
                "price": product.price,
                "category": product.category,
                "stock": product.stock,
                "seller_id": product.seller_id,
            }
            for product in products
        ]

    finally:
        db.close()


# -------------------------
# SELLER: UPDATE OWN PRODUCT
# -------------------------

@app.patch("/seller/products/{product_id}")
def update_seller_product(
    product_id: int,
    product_data: ProductUpdate,
    seller: dict = Depends(get_current_seller),
):
    db = SessionLocal()

    try:
        product = (
            db.query(models.Product)
            .filter(
                models.Product.id == product_id,
                models.Product.seller_id == seller["id"],
            )
            .first()
        )

        if product is None:
            raise HTTPException(
                status_code=404,
                detail="Product not found in your store.",
            )

        updates = product_data.model_dump(exclude_unset=True)

        if not updates:
            raise HTTPException(
                status_code=400,
                detail="Provide at least one field to update.",
            )

        for field, value in updates.items():
            if isinstance(value, str):
                value = value.strip()

                if not value:
                    raise HTTPException(
                        status_code=422,
                        detail=f"{field} cannot be empty.",
                    )

            setattr(product, field, value)

        db.commit()
        db.refresh(product)

        return {
            "message": "Product updated successfully.",
            "id": product.id,
            "name": product.name,
            "price": product.price,
            "category": product.category,
            "stock": product.stock,
        }

    finally:
        db.close()


# -------------------------
# SELLER: DELETE OWN PRODUCT
# -------------------------

@app.delete("/seller/products/{product_id}")
def delete_seller_product(
    product_id: int,
    seller: dict = Depends(get_current_seller),
):
    db = SessionLocal()

    try:
        product = (
            db.query(models.Product)
            .filter(
                models.Product.id == product_id,
                models.Product.seller_id == seller["id"],
            )
            .first()
        )

        if product is None:
            raise HTTPException(
                status_code=404,
                detail="Product not found in your store.",
            )

        # Preserve historical order records.
        has_order_history = (
            db.query(models.OrderItem)
            .filter(models.OrderItem.product_id == product_id)
            .first()
        )

        if has_order_history:
            raise HTTPException(
                status_code=409,
                detail=(
                    "This product has order history and cannot be deleted. "
                    "Set its stock to zero instead."
                ),
            )

        db.delete(product)
        db.commit()

        return {
            "message": "Product deleted successfully.",
            "product_id": product_id,
        }

    finally:
        db.close()


# -------------------------
# SELLER: VIEW OWN ORDER ITEMS
# -------------------------

@app.get("/seller/orders")
def get_seller_orders(
    seller: dict = Depends(get_current_seller),
):
    db = SessionLocal()

    try:
        order_items = (
            db.query(models.OrderItem)
            .filter(models.OrderItem.seller_id == seller["id"])
            .order_by(models.OrderItem.order_id.desc())
            .all()
        )

        result = []

        for item in order_items:
            order = (
                db.query(models.Order)
                .filter(models.Order.id == item.order_id)
                .first()
            )

            if order is None:
                continue

            result.append({
                "order_id": order.id,
                "created_at": order.created_at,
                "order_status": order.status,
                "payment_status": order.payment_status,
                "product_id": item.product_id,
                "product_name": item.product_name,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "subtotal": item.subtotal,
            })

        return {
            "orders": result,
            "count": len(result),
        }

    finally:
        db.close()


# -------------------------
# CUSTOMER: ADD ITEM TO CART
# -------------------------

@app.post("/cart/items", status_code=201)
def add_to_cart(
    item_data: CartItemCreate,
    customer: dict = Depends(get_current_customer),
):
    db = SessionLocal()

    try:
        product = (
            db.query(models.Product)
            .filter(models.Product.id == item_data.product_id)
            .first()
        )

        if product is None:
            raise HTTPException(
                status_code=404,
                detail="Product not found.",
            )

        if item_data.quantity > product.stock:
            raise HTTPException(
                status_code=400,
                detail="Requested quantity exceeds available stock.",
            )

        cart_item = (
            db.query(models.CartItem)
            .filter(
                models.CartItem.customer_id == customer["id"],
                models.CartItem.product_id == product.id,
            )
            .first()
        )

        if cart_item:
            new_quantity = cart_item.quantity + item_data.quantity

            if new_quantity > product.stock:
                raise HTTPException(
                    status_code=400,
                    detail="Total cart quantity exceeds available stock.",
                )

            cart_item.quantity = new_quantity

        else:
            cart_item = models.CartItem(
                customer_id=customer["id"],
                product_id=product.id,
                quantity=item_data.quantity,
            )

            db.add(cart_item)

        db.commit()
        db.refresh(cart_item)

        return {
            "message": "Item added to cart successfully.",
            "cart_item_id": cart_item.id,
            "product_id": product.id,
            "product_name": product.name,
            "quantity": cart_item.quantity,
            "unit_price": product.price,
            "subtotal": round(product.price * cart_item.quantity, 2),
        }

    finally:
        db.close()


# -------------------------
# CUSTOMER: VIEW CART
# -------------------------

@app.get("/cart")
def view_cart(
    customer: dict = Depends(get_current_customer),
):
    db = SessionLocal()

    try:
        cart_items = (
            db.query(models.CartItem)
            .filter(models.CartItem.customer_id == customer["id"])
            .all()
        )

        items = []
        total = 0.0

        for cart_item in cart_items:
            product = (
                db.query(models.Product)
                .filter(models.Product.id == cart_item.product_id)
                .first()
            )

            if product is None:
                continue

            subtotal = round(
                product.price * cart_item.quantity, 2
            )

            total += subtotal

            items.append({
                "cart_item_id": cart_item.id,
                "product_id": product.id,
                "name": product.name,
                "price": product.price,
                "quantity": cart_item.quantity,
                "stock": product.stock,
                "subtotal": subtotal,
            })

        return {
            "items": items,
            "total": round(total, 2),
            "currency": "NGN",
        }

    finally:
        db.close()


# -------------------------
# CUSTOMER: UPDATE CART QUANTITY
# -------------------------

@app.patch("/cart/items/{item_id}")
def update_cart_item(
    item_id: int,
    quantity: Annotated[int, Query(gt=0)],
    customer: dict = Depends(get_current_customer),
):
    db = SessionLocal()

    try:
        cart_item = (
            db.query(models.CartItem)
            .filter(
                models.CartItem.id == item_id,
                models.CartItem.customer_id == customer["id"],
            )
            .first()
        )

        if cart_item is None:
            raise HTTPException(
                status_code=404,
                detail="Cart item not found.",
            )

        product = (
            db.query(models.Product)
            .filter(models.Product.id == cart_item.product_id)
            .first()
        )

        if product is None:
            raise HTTPException(
                status_code=404,
                detail="Product not found.",
            )

        if quantity > product.stock:
            raise HTTPException(
                status_code=400,
                detail="Requested quantity exceeds available stock.",
            )

        cart_item.quantity = quantity

        db.commit()
        db.refresh(cart_item)

        return {
            "message": "Cart quantity updated.",
            "cart_item_id": cart_item.id,
            "product_id": product.id,
            "product_name": product.name,
            "quantity": cart_item.quantity,
            "subtotal": round(product.price * quantity, 2),
        }

    finally:
        db.close()


# -------------------------
# CUSTOMER: REMOVE CART ITEM
# -------------------------

@app.delete("/cart/items/{item_id}")
def remove_cart_item(
    item_id: int,
    customer: dict = Depends(get_current_customer),
):
    db = SessionLocal()

    try:
        cart_item = (
            db.query(models.CartItem)
            .filter(
                models.CartItem.id == item_id,
                models.CartItem.customer_id == customer["id"],
            )
            .first()
        )

        if cart_item is None:
            raise HTTPException(
                status_code=404,
                detail="Cart item not found.",
            )

        db.delete(cart_item)
        db.commit()

        return {
            "message": "Item removed from cart successfully."
        }

    finally:
        db.close()


# -------------------------
# CUSTOMER: CHECKOUT
# -------------------------

@app.post("/checkout", status_code=201)
def checkout(
    customer: dict = Depends(get_current_customer),
):
    db = SessionLocal()

    try:
        cart_items = (
            db.query(models.CartItem)
            .filter(models.CartItem.customer_id == customer["id"])
            .all()
        )

        if not cart_items:
            raise HTTPException(
                status_code=400,
                detail="Your cart is empty.",
            )

        order_items_data = []
        total_amount = 0.0

        for cart_item in cart_items:
            product = (
                db.query(models.Product)
                .filter(models.Product.id == cart_item.product_id)
                .with_for_update()
                .first()
            )

            if product is None:
                raise HTTPException(
                    status_code=400,
                    detail="A product in your cart no longer exists.",
                )

            if cart_item.quantity <= 0:
                raise HTTPException(
                    status_code=400,
                    detail="A cart item has an invalid quantity.",
                )

            if product.stock < cart_item.quantity:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Insufficient stock for {product.name}. "
                        f"Available: {product.stock}."
                    ),
                )

            subtotal = round(
                product.price * cart_item.quantity, 2
            )

            total_amount += subtotal

            order_items_data.append({
                "product": product,
                "quantity": cart_item.quantity,
                "subtotal": subtotal,
            })

        total_amount = round(total_amount, 2)

        order = models.Order(
            customer_id=customer["id"],
            total_amount=total_amount,
            status="pending",
            payment_status="unpaid",
        )

        db.add(order)
        db.flush()

        for item_data in order_items_data:
            product = item_data["product"]
            quantity = item_data["quantity"]

            order_item = models.OrderItem(
                order_id=order.id,
                product_id=product.id,
                seller_id=product.seller_id,
                product_name=product.name,
                unit_price=product.price,
                quantity=quantity,
                subtotal=item_data["subtotal"],
            )

            db.add(order_item)

            # Existing behavior retained for compatibility.
            # Must be redesigned before live payment integration.
            product.stock -= quantity

        for cart_item in cart_items:
            db.delete(cart_item)

        db.commit()
        db.refresh(order)

        return {
            "message": "Order created successfully.",
            "order_id": order.id,
            "total_amount": order.total_amount,
            "currency": "NGN",
            "status": order.status,
            "payment_status": order.payment_status,
            "message_note": (
                "Payment has not been collected. "
                "Your order is awaiting payment."
            ),
        }

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


# -------------------------
# CUSTOMER: ORDER HISTORY
# -------------------------

@app.get("/orders")
def get_customer_orders(
    customer: dict = Depends(get_current_customer),
):
    db = SessionLocal()

    try:
        orders = (
            db.query(models.Order)
            .filter(models.Order.customer_id == customer["id"])
            .order_by(models.Order.created_at.desc())
            .all()
        )

        result = []

        for order in orders:
            order_items = (
                db.query(models.OrderItem)
                .filter(models.OrderItem.order_id == order.id)
                .all()
            )

            items = []

            for item in order_items:
                items.append({
                    "product_id": item.product_id,
                    "product_name": item.product_name,
                    "seller_id": item.seller_id,
                    "unit_price": item.unit_price,
                    "quantity": item.quantity,
                    "subtotal": item.subtotal,
                })

            result.append({
                "order_id": order.id,
                "total_amount": order.total_amount,
                "currency": "NGN",
                "status": order.status,
                "payment_status": order.payment_status,
                "created_at": order.created_at,
                "items": items,
            })

        return {
            "orders": result,
            "count": len(result),
        }

    finally:
        db.close()