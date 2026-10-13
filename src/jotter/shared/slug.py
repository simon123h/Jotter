"""Slugification utilities."""

import re
import secrets
import unicodedata
from collections.abc import Callable


def slugify(text: str) -> str:
    """Converts title/name to URL-friendly lowercase ASCII slug."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    text = re.sub(r"^-+|-+$", "", text)
    return text


# Letters that do not decompose into a base letter and a mark (spec/FORMAT.md, "File names of new tasks")
_SPELLED_OUT = str.maketrans(
    {"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss", "æ": "ae", "œ": "oe", "ø": "o", "ł": "l", "đ": "d"}
)
_MAX_TASK_SLUG = 60
_SUFFIX_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"

# Not tasks (the manifest and a readme) or not usable as file names on Windows
RESERVED_TASK_NAMES = frozenset(
    {"index", "readme", "con", "prn", "aux", "nul"}
    | {f"com{n}" for n in range(1, 10)}
    | {f"lpt{n}" for n in range(1, 10)}
)


def task_slug(title: str) -> str:
    """The file name (without `.md`) a new task gets from its title, before any suffix for a taken name."""
    text = title.lower().translate(_SPELLED_OUT)
    text = "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c))
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    if len(text) > _MAX_TASK_SLUG:
        cut = text[: _MAX_TASK_SLUG + 1].rfind("-")
        text = text[:cut] if cut > 0 else text[:_MAX_TASK_SLUG]
    return text or "task"


def unique_task_name(slug: str, is_taken: Callable[[str], bool]) -> str:
    """The slug itself when it is free, otherwise the slug with `-` and four random characters, until one is free."""
    name = slug
    while name in RESERVED_TASK_NAMES or is_taken(name):
        name = f"{slug}-{''.join(secrets.choice(_SUFFIX_ALPHABET) for _ in range(4))}"
    return name
