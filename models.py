from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="customer")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    price = Column(Float, nullable=False)
    category = Column(String(100), nullable=False)
    stock = Column(Integer, nullable=False)
    seller_id = Column(
        String,
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )


class CartItem(Base):
    __tablename__ = "cart_items"

    __table_args__ = (
        UniqueConstraint(
            "customer_id",
            "product_id",
            name="uq_cart_customer_product",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)

    customer_id = Column(
        String,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    product_id = Column(
        Integer,
        ForeignKey("products.id"),
        nullable=False,
        index=True,
    )

    quantity = Column(Integer, nullable=False, default=1)


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)

    customer_id = Column(
        String,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    total_amount = Column(Float, nullable=False, default=0)

    status = Column(
        String(30),
        nullable=False,
        default="pending",
    )

    payment_status = Column(
        String(30),
        nullable=False,
        default="unpaid",
    )

    created_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)

    order_id = Column(
        Integer,
        ForeignKey("orders.id"),
        nullable=False,
        index=True,
    )

    product_id = Column(
        Integer,
        ForeignKey("products.id"),
        nullable=False,
        index=True,
    )

    seller_id = Column(
        String,
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )

    product_name = Column(String(200), nullable=False)
    unit_price = Column(Float, nullable=False)
    quantity = Column(Integer, nullable=False)
    subtotal = Column(Float, nullable=False)