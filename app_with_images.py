
"""
SHOPORA CLOUDINARY PRODUCT IMAGE SERVICE

Copyright (c) 2026 Computer Software Group 1.
All rights reserved.

Cloudinary Cloud Name: obpyhqy1

This module extends the existing Shopora FastAPI backend
with authenticated product image uploads and retrieval.

Render Start Command:
uvicorn app_with_images:app --host 0.0.0.0 --port $PORT

Required environment variables:
CLOUDINARY_URL
DATABASE_URL
SHOPORA_SECRET_KEY
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

from sqlalchemy.exc import SQLAlchemyError

from starlette.concurrency import run_in_threadpool

import main as shopora_backend
import models

from database import (
    Base,
    SessionLocal,
    engine,
)


# ============================================================
# LOGGING
# ============================================================

logger = logging.getLogger(__name__)


# ============================================================
# EXISTING SHOPORA APPLICATION
# ============================================================

# Reuse the original Shopora FastAPI app.
# This retains the original marketplace routes.

app = shopora_backend.app

router = APIRouter()


# ============================================================
# CLOUDINARY CONFIGURATION
# ============================================================

CLOUDINARY_CLOUD_NAME = "obpyhqy1"

CLOUDINARY_URL = os.getenv(
    "CLOUDINARY_URL",
    "",
).strip()

MAX_IMAGE_BYTES = 5 * 1024 * 1024

MAX_IMAGE_PIXELS = 25_000_000

ACCEPTED_FORMATS = {
    "JPEG",
    "PNG",
    "WEBP",
}

if CLOUDINARY_URL:
    cloudinary.config(
        secure=True,
    )


# ============================================================
# PRODUCT IMAGE DATABASE TABLE
# ============================================================

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


# ============================================================
# IMAGE VALIDATION
# ============================================================

def validate_image(content: bytes) -> None:
    """
    Validate uploaded product image contents.
    """

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
        with Image.open(
            io.BytesIO(content)
        ) as picture:
            picture.verify()

        with Image.open(
            io.BytesIO(content)
        ) as picture:
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
            detail="Invalid or damaged image file.",
        ) from exc

    if image_format not in ACCEPTED_FORMATS:
        raise HTTPException(
            status_code=422,
            detail=(
                "Unsupported image format. "
                "Only JPG, PNG and WebP are allowed."
            ),
        )

    if width <= 0 or height <= 0:
        raise HTTPException(
            status_code=422,
            detail="Invalid image dimensions.",
        )

    if width * height > MAX_IMAGE_PIXELS:
        raise HTTPException(
            status_code=422,
            detail="Image resolution is too large.",
        )


# ============================================================
# CLOUDINARY UPLOAD HELPER
# ============================================================

def upload_to_cloudinary(content: bytes) -> dict:
    """
    Upload validated image bytes to Cloudinary.
    """

    if not CLOUDINARY_URL:
        raise HTTPException(
            status_code=503,
            detail="Cloudinary is not configured.",
        )

    try:
        result = cloudinary.uploader.upload(
            content,
            resource_type="image",
            folder="shopora/products",
            overwrite=False,
        )

    except Exception as exc:
        logger.exception(
            "Shopora Cloudinary upload failed"
        )

        raise HTTPException(
            status_code=502,
            detail=(
                "Cloudinary rejected the image upload. "
                "Check Render logs."
            ),
        ) from exc

    image_url = result.get(
        "secure_url"
    )

    public_id = result.get(
        "public_id"
    )

    if (
        not isinstance(image_url, str)
        or not image_url.startswith(
            "https://res.cloudinary.com/"
        )
        or not isinstance(public_id, str)
        or not public_id
    ):
        raise HTTPException(
            status_code=502,
            detail=(
                "Cloudinary returned invalid "
                "image information."
            ),
        )

    return {
        "image_url": image_url,
        "public_id": public_id,
    }


# ============================================================
# POST - SELLER PRODUCT IMAGE UPLOAD
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
    """
    Upload or replace a product photograph.

    Requires authenticated seller ownership.

    Request method:
        POST

    Request path:
        /seller/products/{product_id}/image

    Multipart form field:
        image
    """

    if not CLOUDINARY_URL:
        raise HTTPException(
            status_code=503,
            detail=(
                "CLOUDINARY_URL is not configured "
                "on Render."
            ),
        )

    db = SessionLocal()

    try:
        # ----------------------------------------------------
        # VERIFY SELLER OWNERSHIP
        # ----------------------------------------------------

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
                    "Product not found or does "
                    "not belong to this seller."
                ),
            )

        # ----------------------------------------------------
        # READ UPLOADED IMAGE
        # ----------------------------------------------------

        content = await image.read(
            MAX_IMAGE_BYTES + 1
        )

        validate_image(content)

        # ----------------------------------------------------
        # UPLOAD TO CLOUDINARY
        # ----------------------------------------------------

        uploaded = await run_in_threadpool(
            upload_to_cloudinary,
            content,
        )

        # ----------------------------------------------------
        # SAVE IMAGE INFORMATION
        # ----------------------------------------------------

        record = db.get(
            ProductPhoto,
            product_id,
        )

        old_public_id = (
            record.public_id
            if record is not None
            else None
        )

        if record is None:
            record = ProductPhoto(
                product_id=product_id,
                image_url=uploaded["image_url"],
                public_id=uploaded["public_id"],
            )

            db.add(record)

        else:
            record.image_url = uploaded["image_url"]
            record.public_id = uploaded["public_id"]

        # ----------------------------------------------------
        # COMMIT DATABASE TRANSACTION
        # ----------------------------------------------------

        try:
            db.commit()

        except SQLAlchemyError as exc:
            db.rollback()

            # Attempt to remove the new image if the
            # database could not save its information.
            try:
                await run_in_threadpool(
                    cloudinary.uploader.destroy,
                    uploaded["public_id"],
                )

            except Exception:
                logger.exception(
                    "Failed to remove unsaved "
                    "Cloudinary image"
                )

            raise HTTPException(
                status_code=500,
                detail=(
                    "Unable to save product image "
                    "in the database."
                ),
            ) from exc

        # ----------------------------------------------------
        # CLEAN UP REPLACED IMAGE
        # ----------------------------------------------------

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
                    "Could not delete the previous "
                    "Cloudinary photograph"
                )

        # ----------------------------------------------------
        # UPLOAD SUCCESS
        # ----------------------------------------------------

        return {
            "success": True,
            "message": (
                "Product photograph uploaded "
                "successfully."
            ),
            "product_id": product_id,
            "image_url": uploaded["image_url"],
        }

    finally:
        await image.close()
        db.close()


# ============================================================
# GET - PRODUCT IMAGE
# ============================================================

@router.get(
    "/products/{product_id}/image",
    tags=["Product Images"],
)
def get_product_image(
    product_id: int,
):
    """
    Redirect to the product photograph on Cloudinary.
    """

    db = SessionLocal()

    try:
        record = db.get(
            ProductPhoto,
            product_id,
        )

        if record is None:
            raise HTTPException(
                status_code=404,
                detail=(
                    "No photograph has been "
                    "uploaded for this product."
                ),
            )

        return RedirectResponse(
            url=record.image_url,
            status_code=307,
        )

    finally:
        db.close()


# ============================================================
# GET - IMAGE UPLOAD STATUS
# ============================================================

@router.get(
    "/image-upload/status",
    tags=["Product Images"],
)
def image_upload_status():
    """
    Return image service configuration status.

    Does not expose Cloudinary credentials.
    """

    configured = bool(
        CLOUDINARY_URL
    )

    return {
        "service": "Shopora Product Images",
        "status": (
            "ready"
            if configured
            else "unconfigured"
        ),
        "cloud_name": CLOUDINARY_CLOUD_NAME,
        "cloudinary_configured": configured,
        "upload_endpoint": (
            "/seller/products/{product_id}/image"
        ),
        "upload_method": "POST",
        "max_upload_mb": 5,
    }


# ============================================================
# CREATE PRODUCT PHOTO TABLE
# ============================================================

# Create only the image table if it does not exist.
# Do not delete or recreate existing product data.

Base.metadata.create_all(
    bind=engine,
    tables=[ProductPhoto.__table__],
)


# ============================================================
# REGISTER CLOUDINARY ROUTES
# ============================================================

app.include_router(router)


# ============================================================
# SAFE ROUTE VERIFICATION
# ============================================================

# Do not assume every item in app.routes has .path.
# Some application objects may not expose that property.

registered_upload_route = any(
    getattr(route, "path", None)
    == "/seller/products/{product_id}/image"
    and "POST" in (
        getattr(route, "methods", set()) or set()
    )
    for route in router.routes
)

if registered_upload_route:
    logger.info(
        "Shopora Cloudinary POST upload route registered."
    )
else:
    logger.warning(
        "Shopora Cloudinary POST upload route "
        "was not detected in the image router."
    )
