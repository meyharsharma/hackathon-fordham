"""In-memory store for greetings — pretends to be persistence."""
from .templates import GREETING


class Store:
    def __init__(self):
        self.cache: dict[str, str] = {}

    def greet(self, user: str) -> str:
        if user not in self.cache:
            self.cache[user] = GREETING.format(user=user)
        return self.cache[user]
