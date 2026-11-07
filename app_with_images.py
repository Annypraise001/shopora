
"""Shopora Cloudinary product images.

Copyright (c) 2026 Computer Software Group 1.

Run with:
uvicorn app_with_images:app --host 0.0.0.0 --port $PORT
"""

import io
import logging
import os

import cloudinary
import cloudinary.uploader

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
)
from fastapi.responses import RedirectResponse
from PIL import Image, UnidentifiedImageError
from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.exc import SQLAlchemyError
from starlette.concurrency import run_in_threadpool

import main as shopora_backend
import models
from database import Base, SessionLocal, engine

logger = logging.getLogger(__name__)

# Reuse your original Shopora application.
app = shopora_backend.app

# Register image routes together.
router = APIRouter()

MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_PIXELS = 25_000_000
ACCEPTED_FORMATS = {"JPEG", "PNG", "WEBP"}


# ============================================================
# DATABASE MODEL
# ============================================================

class ProductPhoto(Base):
    __tablename__ = "product_photos"

    product_id = Column(
        Integer,
        ForeignKey("products.id", ondelete="CASCADE"),
        primary_key=True,
    )

    image_url = Column(
        String(2048),
        nullable=False,
    )

    public_id = Column(
        String(512),
        nullable=False,
    )


# ============================================================
# IMAGE VALIDATION
# ============================================================

def validate_image(content: bytes) -> None:
    if not content:
        raise HTTPException(
            status_code=422,
            detail="Image file is empty.",
        )

    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Maximum image size is 5 MB.",
        )

    try:
        with Image.open(io.BytesIO(content)) as picture:
            picture.verify()

        with Image.open(io.BytesIO(content)) as picture:
            image_format = picture.format
            width, height = picture.size

    except (
        UnidentifiedImageError,
        Image.DecompressionBombError,
        OSError,
        ValueError,
    ) as exc:
        raise HTTPException(
            status_code=422,
            detail="Invalid image file.",
        ) from exc

    if image_format not in ACCEPTED_FORMATS:
        raise HTTPException(
            status_code=422,
            detail="Only JPG, PNG and WebP are supported.",
        )

    if (
        width < 1
        or height < 1
        or width * height > MAX_PIXELS
    ):
        raise HTTPException(
            status_code=422,
            detail="Invalid or oversized image dimensions.",
        )


# ============================================================
# CLOUDINARY UPLOAD
# ============================================================

def send_to_cloudinary(content: bytes) -> dict:
    try:
        result = cloudinary.uploader.upload(
            content,
            resource_type="image",
            folder="shopora/products",
            overwrite=False,
        )

    except Exception as exc:
        logger.exception("Cloudinary upload failed")

        raise HTTPException(
            status_code=502,
            detail="Cloudinary upload failed; check Render logs.",
        ) from exc

    url = result.get("secure_url")
    public_id = result.get("public_id")

    if (
        not isinstance(url, str)
        or not url.startswith("https://res.cloudinary.com/")
        or not isinstance(public_id, str)
        or not public_id
    ):
        raise HTTPException(
            status_code=502,
            detail="Cloudinary returned invalid image details.",
        )

    return {
        "image_url": url,
        "public_id": public_id,
    }


# ============================================================
# POST — UPLOAD PRODUCT IMAGE
# ============================================================

@router.post(
    "/seller/products/{product_id}/image",
    tags=["Product Images"],
)
async def upload_product_image(
    product_id: int,
    image: UploadFile = File(...),
    seller: dict = Depends(
        shopora_backend.get_current_seller
    ),
):
    if not os.getenv("CLOUDINARY_URL", "").strip():
        raise HTTPException(
            status_code=503,
            detail="CLOUDINARY_URL is missing on Render.",
        )

    db = SessionLocal()

    try:
        # Only the product's seller can upload its photo.
        product = db.query(models.Product).filter(
            models.Product.id == product_id,
            models.Product.seller_id == seller["id"],
        ).first()

        if product is None:
            raise HTTPException(
                status_code=404,
                detail="Product not found in your seller account.",
            )

        content = await image.read(MAX_IMAGE_BYTES + 1)

        validate_image(content)

        uploaded = await run_in_threadpool(
            send_to_cloudinary,
            content,
        )

        record = db.get(ProductPhoto, product_id)

        old_public_id = (
            record.public_id if record else None
        )

        if record is None:
            record = ProductPhoto(
                product_id=product_id,
                **uploaded,
            )
            db.add(record)

        else:
            record.image_url = uploaded["image_url"]
            record.public_id = uploaded["public_id"]

        try:
            db.commit()

        except SQLAlchemyError as exc:
            db.rollback()

            # Remove the new Cloudinary image if
            # the database could not save it.
            try:
                await run_in_threadpool(
                    cloudinary.uploader.destroy,
                    uploaded["public_id"],
                )

            except Exception:
                logger.exception(
                    "Failed to clean up orphan Cloudinary upload"
                )

            raise HTTPException(
                status_code=500,
                detail="Could not save image to the database.",
            ) from exc

        # Remove the old image after replacement.
        if (
            old_public_id
            and old_public_id != uploaded["public_id"]
        ):
            try:
                await run_in_threadpool(
                    cloudinary.uploader.destroy,
                    old_public_id,
                )

            except Exception:
                logger.exception(
                    "Could not remove replaced image"
                )

        return {
            "success": True,
            "product_id": product_id,
            "image_url": uploaded["image_url"],
        }

    finally:
        await image.close()
        db.close()


# ============================================================
# GET — DISPLAY PRODUCT IMAGE
# ============================================================

@router.get(
    "/products/{product_id}/image",
    tags=["Product Images"],
)
def get_product_image(product_id: int):
    db = SessionLocal()

    try:
        record = db.get(
            ProductPhoto,
            product_id,
        )

        if record is None:
            raise HTTPException(
                status_code=404,
                detail="No image uploaded for this product.",
            )

        return RedirectResponse(
            record.image_url,
            status_code=307,
        )

    finally:
        db.close()


# ============================================================
# GET — CLOUDINARY STATUS
# ============================================================

@router.get(
    "/image-upload/status",
    tags=["Product Images"],
)
def image_upload_status():
    configured = bool(
        os.getenv("CLOUDINARY_URL", "").strip()
    )

    return {
        "status": (
            "ready" if configured else "unconfigured"
        ),
        "cloudinary_configured": configured,
        "upload_endpoint": "/seller/products/{product_id}/image",
        "upload_method": "POST",
        "max_upload_mb": 5,
    }


# ============================================================
# INITIALIZE IMAGE TABLE
# ============================================================

# Creates only the new table if absent.
# Existing Shopora product data is not deleted.
Base.metadata.create_all(
    bind=engine,
    tables=[ProductPhoto.__table__],
)


# ============================================================
# REGISTER IMAGE ROUTES
# ============================================================

app.include_router(router)


# Verify that the POST endpoint was registered.
assert any(
    route.path == "/seller/products/{product_id}/image"
    and "POST" in (getattr(route, "methods", set()) or set())
    for route in app.routes
), "Shopora product image POST route was not registered"
