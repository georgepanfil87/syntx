class ApplicationException(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class NotFoundException(ApplicationException):
    pass


class ConflictException(ApplicationException):
    pass


class ValidationException(ApplicationException):
    pass


class AuthenticationException(ApplicationException):
    pass


class AuthorizationException(ApplicationException):
    pass