"""Tiny demo CLI — entry point."""
from .auth import authenticate
from .store import Store


def run(username: str) -> str:
    user = authenticate(username)
    store = Store()
    return store.greet(user)


if __name__ == "__main__":
    import sys
    print(run(sys.argv[1] if len(sys.argv) > 1 else "guest"))
