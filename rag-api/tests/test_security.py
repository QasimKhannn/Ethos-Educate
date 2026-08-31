import asyncio
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import jwt
from fastapi import HTTPException
from starlette.requests import Request
from starlette.responses import Response

from app.middleware import security_middleware
from app.security import (
    DEVELOPMENT_BYPASS_ENV,
    create_upload_path,
    get_authenticated_user_id,
    get_document_filter,
    resolve_user_upload_path,
    validate_security_configuration,
)


def build_request(headers: list[tuple[bytes, bytes]] | None = None) -> Request:
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/query",
            "headers": headers or [],
            "scheme": "http",
            "server": ("testserver", 80),
            "client": ("testclient", 50000),
            "query_string": b"",
        }
    )


class SecurityConfigurationTests(unittest.TestCase):
    def test_missing_secret_is_rejected_outside_explicit_development_bypass(self):
        with patch.dict(
            os.environ,
            {"NODE_ENV": "production", "JWT_SECRET": "", DEVELOPMENT_BYPASS_ENV: ""},
            clear=False,
        ):
            with self.assertRaises(RuntimeError):
                validate_security_configuration()

    def test_development_bypass_requires_both_development_and_opt_in(self):
        with patch.dict(
            os.environ,
            {
                "NODE_ENV": "development",
                "JWT_SECRET": "",
                DEVELOPMENT_BYPASS_ENV: "true",
            },
            clear=False,
        ):
            validate_security_configuration()

    def test_subject_is_derived_from_authenticated_request(self):
        request = SimpleNamespace(state=SimpleNamespace(user={"id": "teacher-1"}))
        self.assertEqual(get_authenticated_user_id(request), "teacher-1")

    def test_missing_authenticated_subject_is_rejected(self):
        request = SimpleNamespace(state=SimpleNamespace())
        with patch.dict(
            os.environ,
            {"NODE_ENV": "production", DEVELOPMENT_BYPASS_ENV: ""},
            clear=False,
        ):
            with self.assertRaises(HTTPException) as error:
                get_authenticated_user_id(request)

        self.assertEqual(error.exception.status_code, 401)

    def test_document_filter_always_includes_authenticated_subject(self):
        self.assertEqual(
            get_document_filter("teacher-1", ["file-a", "file-b"]),
            {"user_id": "teacher-1", "file_id": {"$in": ["file-a", "file-b"]}},
        )

    def test_upload_paths_are_user_scoped_and_reject_traversal(self):
        with tempfile.TemporaryDirectory() as upload_root:
            upload_path = Path(create_upload_path(upload_root, "teacher-1", "lesson.pdf"))
            self.assertTrue(upload_path.is_relative_to(Path(upload_root).resolve()))
            self.assertEqual(upload_path.suffix, ".pdf")

            with self.assertRaises(HTTPException):
                create_upload_path(upload_root, "teacher-1", "../lesson.pdf")

            with self.assertRaises(HTTPException):
                resolve_user_upload_path(upload_root, "teacher-1", upload_root)


class SecurityMiddlewareTests(unittest.TestCase):
    def test_missing_secret_returns_service_unavailable(self):
        async def next_handler(_: Request) -> Response:
            return Response(status_code=204)

        with patch.dict(
            os.environ,
            {"NODE_ENV": "production", "JWT_SECRET": "", DEVELOPMENT_BYPASS_ENV: ""},
            clear=False,
        ):
            response = asyncio.run(security_middleware(build_request(), next_handler))

        self.assertEqual(response.status_code, 503)

    def test_valid_token_sets_authenticated_user(self):
        async def next_handler(request: Request) -> Response:
            self.assertEqual(request.state.user["id"], "teacher-1")
            return Response(status_code=204)

        secret = "test-secret"
        token = jwt.encode({"id": "teacher-1"}, secret, algorithm="HS256")
        request = build_request([(b"authorization", f"Bearer {token}".encode())])
        with patch.dict(
            os.environ,
            {"NODE_ENV": "production", "JWT_SECRET": secret, DEVELOPMENT_BYPASS_ENV: ""},
            clear=False,
        ):
            response = asyncio.run(security_middleware(request, next_handler))

        self.assertEqual(response.status_code, 204)

    def test_token_without_user_identity_is_rejected(self):
        async def next_handler(_: Request) -> Response:
            return Response(status_code=204)

        secret = "test-secret"
        token = jwt.encode({}, secret, algorithm="HS256")
        request = build_request([(b"authorization", f"Bearer {token}".encode())])
        with patch.dict(
            os.environ,
            {"NODE_ENV": "production", "JWT_SECRET": secret, DEVELOPMENT_BYPASS_ENV: ""},
            clear=False,
        ):
            response = asyncio.run(security_middleware(request, next_handler))

        self.assertEqual(response.status_code, 401)
