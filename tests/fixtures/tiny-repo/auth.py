"""Token auth — verifies a username against a static allowlist."""
ALLOWED = {"alice", "bob", "guest"}


def authenticate(username: str) -> str:
    if username not in ALLOWED:
        raise PermissionError(f"unknown user: {username}")
    return username
