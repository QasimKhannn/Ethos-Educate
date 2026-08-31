import logging
import os

import jwt
from fastapi import Request
from fastapi.responses import JSONResponse
from jwt import PyJWTError

from app.security import is_development_bypass_enabled, validate_security_configuration


logger = logging.getLogger(__name__)
PUBLIC_PATHS = frozenset({"/docs", "/openapi.json", "/health"})


async def security_middleware(request: Request, call_next):
    if request.url.path in PUBLIC_PATHS:
        return await call_next(request)

    try:
        validate_security_configuration()
    except RuntimeError:
        logger.error("RAG authentication is not configured")
        return JSONResponse(
            status_code=503,
            content={"detail": "RAG authentication is not configured"},
        )

    if is_development_bypass_enabled():
        return await call_next(request)

    authorization = request.headers.get("Authorization")
    if not authorization or not authorization.startswith("Bearer "):
        logger.info("Unauthorized request with invalid Authorization header to: %s", request.url.path)
        return JSONResponse(
            status_code=401,
            content={"detail": "Missing or invalid Authorization header"},
        )

    token = authorization.removeprefix("Bearer ")
    try:
        payload = jwt.decode(token, os.getenv("JWT_SECRET"), algorithms=["HS256"])
        user_id = payload.get("id")
        if not isinstance(user_id, str) or not user_id.strip():
            return JSONResponse(
                status_code=401,
                content={"detail": "Token is missing the user identity"},
            )
        request.state.user = payload
    except PyJWTError as error:
        logger.info(
            "Unauthorized request with invalid token to %s: %s",
            request.url.path,
            type(error).__name__,
        )
        return JSONResponse(status_code=401, content={"detail": "Invalid token"})

    return await call_next(request)
