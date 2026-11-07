
"""
SHOPORA CLOUDINARY IMAGE SERVICE

Copyright (c) 2026 Computer Software Group 1.
All rights reserved.

Cloudinary Cloud Name: obpyhqy1

Extends the existing Shopora FastAPI application
with seller-owned product photo uploads.

Render Start Command:
uvicorn app_with_images:app --host 0.0.0.0 --port $PORT
"""

import io
import os

import cloudinary
import cloudinary.uploader

from fastapi import (
    Depends,
    File,
    HTTPException,
    UploadFile,
)

from fastapi.responses import RedirectResponse

from PIL import (
    Image,
    UnidentifiedImageError,
)

from sqlalchemy import (
    Column,
    ForeignKey,
    Integer,
    String,
)

from starlette.concurrency import run_in_threadpool

import main as shopora_backend
import models

from database import (
    Base,
    SessionLocal,
    engine,
)


# ====================================================
# EXISTING SHOPORA FASTAPI APP
# ====================================================

# IMPORTANT:
# Uvicorn looks for this exact variable.
# Keep it at module level.

app = shopora_backend.app


# ====================================================
# CLOUDINARY CONFIGURATION
# ====================================================

CLOUDINARY_URL = os.getenv(
    "CLOUDINARY_URL",
    "",
).strip()

CLOUDINARY_CLOUD_NAME = "obpyhqy1"

MAX_IMAGE_BYTES = 5 * 1024 * 1024

ALLOWED_FORMATS = {
    "JPEG",
    "PNG",
    "WEBP",
}

if CLOUDINARY_URL:
    cloudinary.config(secure=True)


# ====================================================
# PRODUCT PHOTOGRAPHS DATABASE TABLE
# ====================================================

class ProductPhoto(Base):
    __tablename__ = "product_photos"

    product_id = Column(
        Integer,
        ForeignKey(
            "products.id",
            ondelete="CASCADE",
        ),
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


# Create only the new image table.
# Existing product and account data is preserved.

Base.metadata.create_all(
    bind=engine,
    tables=[ProductPhoto.__table__],
)


# ====================================================
# VALIDATE PRODUCT PHOTO
# ====================================================

def validate_image(raw: bytes):
    if not raw:
        raise HTTPException(
            status_code=422,
            detail="Image file is empty.",
        )

    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Maximum image size is 5 MB.",
        )

    try:
        with Image.open(io.BytesIO(raw)) as image:
            image.verify()

        with Image.open(io.BytesIO(raw)) as image:
            image_format = image.format
            width, height = image.size

    except (
        UnidentifiedImageError,
        Image.DecompressionBombError,
        OSError,
        ValueError,
    ):
        raise HTTPException(
            status_code=422,
            detail="Invalid image file.",
        )

    if image_format not in ALLOWED_FORMATS:
        raise HTTPException(
            status_code=422,
            detail="Only JPG, PNG and WebP are supported.",
        )

    if width <= 0 or height <= 0:
        raise HTTPException(
            status_code=422,
            detail="Invalid image dimensions.",
        )

    if width * height > 25_000_000:
        raise HTTPException(
            status_code=422,
            detail="Image resolution is too large.",
        )


# ====================================================
# UPLOAD TO CLOUDINARY
# ====================================================

def upload_cloudinary(raw: bytes):
    try:
        result = cloudinary.uploader.upload(
            raw,
            resource_type="image",
            folder="shopora/products",
            overwrite=False,
        )

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Cloudinary upload failed.",
        ) from exc

    image_url = result.get("secure_url")
    public_id = result.get("public_id")

    if (
        not isinstance(image_url, str)
        or not image_url.startswith("https://")
        or not isinstance(public_id, str)
        or not public_id
    ):
        raise HTTPException(
            status_code=502,
            detail="Cloudinary returned an invalid response.",
        )

    return image_url, public_id


# ====================================================
# SELLER IMAGE UPLOAD ROUTE
# ====================================================

@app.post("/seller/products/{product_id}/image")
async def upload_product_image(
    product_id: int,
    image: UploadFile = File(...),
    seller: dict = Depends(
        shopora_backend.get_current_seller
    ),
):
    if not CLOUDINARY_URL:
        raise HTTPException(
            status_code=503,
            detail="Cloudinary is not configured.",
        )

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
                detail=(
                    "Product not found or not owned "
                    "by this seller."
                ),
            )

        raw = await image.read(
            MAX_IMAGE_BYTES + 1
        )

        validate_image(raw)

        image_url, public_id = await run_in_threadpool(
            upload_cloudinary,
            raw,
        )

        photo = db.get(
            ProductPhoto,
            product_id,
        )

        old_public_id = (
            photo.public_id
            if photo is not None
            else None
        )

        if photo is None:
            photo = ProductPhoto(
                product_id=product_id,
                image_url=image_url,
                public_id=public_id,
            )

            db.add(photo)

        else:
            photo.image_url = image_url
            photo.public_id = public_id

        try:
            db.commit()

        except Exception:
            db.rollback()

            try:
                await run_in_threadpool(
                    cloudinary.uploader.destroy,
                    public_id,
                )
            except Exception:
                pass

            raise HTTPException(
                status_code=500,
                detail="Unable to save product image.",
            )

        if (
            old_public_id
            and old_public_id != public_id
        ):
            try:
                await run_in_threadpool(
                    cloudinary.uploader.destroy,
                    old_public_id,
                )
            except Exception:
                pass

        return {
            "success": True,
            "message": "Photo uploaded successfully.",
            "product_id": product_id,
            "image_url": image_url,
        }

    finally:
        await image.close()
        db.close()


# ====================================================
# GET PRODUCT PHOTO
# ====================================================

@app.get("/products/{product_id}/image")
def get_product_image(product_id: int):
    db = SessionLocal()

    try:
        photo = db.get(
            ProductPhoto,
            product_id,
        )

        if photo is None:
            raise HTTPException(
                status_code=404,
                detail="No photo found for this product.",
            )

        return RedirectResponse(
            url=photo.image_url,
            status_code=307,
        )

    finally:
        db.close()


# ====================================================
# IMAGE UPLOAD STATUS
# ====================================================

@app.get("/image-upload/status")
def image_upload_status():
    configured = bool(CLOUDINARY_URL)

    return {
        "service": "Shopora Cloudinary Images",
        "status": (
            "ready"
            if configured
            else "unconfigured"
        ),
        "cloud_name": CLOUDINARY_CLOUD_NAME,
        "cloudinary_configured": configured,
        "max_upload_mb": 5,
    }

