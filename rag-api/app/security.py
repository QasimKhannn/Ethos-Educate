import hashlib
import os
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, Request, status


DEVELOPMENT_USER_ID = "development"
DEVELOPMENT_BYPASS_ENV = "RAG_ALLOW_UNAUTHENTICATED_DEVELOPMENT"


def is_development_bypass_enabled() -> bool:
    environment = os.getenv("NODE_ENV", "").strip().lower()
    bypass_enabled = os.getenv(DEVELOPMENT_BYPASS_ENV, "").strip().lower()
    return environment == "development" and bypass_enabled in {"1", "true", "yes"}


def validate_security_configuration() -> None:
    if os.getenv("JWT_SECRET"):
        return
    if is_development_bypass_enabled():
        return
    raise RuntimeError(
        "JWT_SECRET must be configured. Set RAG_ALLOW_UNAUTHENTICATED_DEVELOPMENT=true only with NODE_ENV=development."
    )


def get_authenticated_user_id(request: Request) -> str:
    user = getattr(request.state, "user", None)
    user_id = user.get("id") if isinstance(user, dict) else None

    if isinstance(user_id, str) and user_id.strip():
        return user_id
    if is_development_bypass_enabled():
        return DEVELOPMENT_USER_ID
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authenticated user identity is required",
    )


def get_document_filter(user_id: str, file_ids: list[str] | None = None) -> dict[str, object]:
    document_filter: dict[str, object] = {"user_id": user_id}
    if file_ids is not None:
        document_filter["file_id"] = {"$in": file_ids}
    return document_filter


def create_upload_path(upload_root: str, user_id: str, filename: str) -> str:
    if not filename or filename in {".", ".."} or "\x00" in filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid upload filename")
    if "/" in filename or "\\" in filename or Path(filename).name != filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid upload filename")

    user_directory = get_user_upload_directory(upload_root, user_id)
    user_directory.mkdir(parents=True, exist_ok=True)

    upload_path = (user_directory / f"{uuid4().hex}{Path(filename).suffix}").resolve()
    if user_directory not in upload_path.parents:
        raise RuntimeError("Upload path escaped the user upload directory")
    return str(upload_path)


def resolve_user_upload_path(upload_root: str, user_id: str, file_path: str) -> str:
    user_directory = get_user_upload_directory(upload_root, user_id)
    resolved_file_path = Path(file_path).resolve()
    if user_directory not in resolved_file_path.parents:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The file is outside the authenticated user's upload directory",
        )
    return str(resolved_file_path)


def get_user_upload_directory(upload_root: str, user_id: str) -> Path:
    root_path = Path(upload_root).resolve()
    user_directory = root_path / hashlib.sha256(user_id.encode("utf-8")).hexdigest()
    if root_path not in user_directory.parents:
        raise RuntimeError("User upload directory escaped the upload root")
    return user_directory
