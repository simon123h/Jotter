"""Splits markdown files into YAML frontmatter and body, as defined in spec/FORMAT.md."""

import re

# The frontmatter ends at the first line that is exactly `---`, so horizontal rules in the body stay in the body.
_FRONTMATTER = re.compile(r"\A---[ \t]*\r?\n(.*?)^---[ \t]*(?:\r?\n|\Z)", re.DOTALL | re.MULTILINE)


def split_frontmatter(content: str) -> tuple[str | None, str]:
    """Returns the raw YAML text (None without frontmatter) and the body without its leading blank lines."""
    match = _FRONTMATTER.match(content)
    if not match:
        return None, content
    return match.group(1), content[match.end() :].lstrip("\r\n")
