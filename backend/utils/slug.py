import re


def slugify(text: str) -> str:
    text = text.lower().strip()
    # Replace spaces with hyphens
    text = text.replace(" ", "-")
    # Remove any non-alphanumeric/hyphen/underscore character
    text = re.sub(r"[^a-z0-9_-]", "", text)
    # Collapse multiple consecutive hyphens into one
    text = re.sub(r"-+", "-", text)
    return text.strip("-")
