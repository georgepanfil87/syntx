from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.core.exceptions.http_exceptions import (
    AuthenticationException,
    AuthorizationException,
    ConflictException,
    NotFoundException,
    ValidationException,
)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(NotFoundException)
    async def handle_not_found(_: Request, exc: NotFoundException):
        return JSONResponse(
            status_code=404,
            content={"message": exc.message},
        )

    @app.exception_handler(ConflictException)
    async def handle_conflict(_: Request, exc: ConflictException):
        return JSONResponse(
            status_code=409,
            content={"message": exc.message},
        )

    @app.exception_handler(ValidationException)
    async def handle_validation(_: Request, exc: ValidationException):
        return JSONResponse(
            status_code=400,
            content={"message": exc.message},
        )

    @app.exception_handler(AuthenticationException)
    async def handle_authentication(_: Request, exc: AuthenticationException):
        return JSONResponse(
            status_code=401,
            content={"message": exc.message},
        )

    @app.exception_handler(AuthorizationException)
    async def handle_authorization(_: Request, exc: AuthorizationException):
        return JSONResponse(
            status_code=403,
            content={"message": exc.message},
        )