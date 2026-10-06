"""YAML loading with the libyaml C parser when available."""

from typing import Any

import yaml

# PyYAML's pure-Python loader is several times slower than libyaml's, and parsing the frontmatter of
# every task file dominates a full index sync. Fall back to it when PyYAML was built without libyaml.
_SafeLoader: type = getattr(yaml, "CSafeLoader", yaml.SafeLoader)


def safe_load(stream: str) -> Any:
    """Like `yaml.safe_load`, but through the C loader when available."""
    return yaml.load(stream, Loader=_SafeLoader)
