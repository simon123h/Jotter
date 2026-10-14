"""Reads the title of a web page, for a link that is saved as a task (the setting `lookUpLinkTitles`).

The address is fetched by this server, so it is not fetched blindly: only http and https, no host that resolves to this
machine or a private network (a task title can come from anywhere), a size and a time limit, and every redirect is
checked the same way. A page that cannot be read gives no title and no error; the task keeps its address as its title.
"""

import ipaddress
import re
import socket
import time
import urllib.error
import urllib.request
from html import unescape
from html.parser import HTMLParser
from urllib.parse import urlsplit

MAX_BYTES = 512 * 1024
TIMEOUT_SECONDS = 6.0
MAX_REDIRECTS = 5
MAX_TITLE_LENGTH = 200
USER_AGENT = "Mozilla/5.0 (compatible; Jotter link title)"

_CHARSET_IN_HEADER = re.compile(r"charset=([\w.-]+)", re.IGNORECASE)
_CHARSET_IN_HTML = re.compile(rb"""<meta[^>]+charset\s*=\s*["']?([\w.-]+)""", re.IGNORECASE)


class _TitleParser(HTMLParser):
    """Collects the title of a page: the open graph title when there is one, otherwise the title element."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.meta: dict[str, str] = {}
        self.title = ""
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "title":
            self._in_title = True
        elif tag == "meta":
            values = {key.lower(): value or "" for key, value in attrs}
            name = (values.get("property") or values.get("name") or "").lower()
            if name in ("og:title", "twitter:title") and values.get("content", "").strip():
                self.meta.setdefault(name, values["content"])

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data


def page_title(raw: bytes, content_type: str = "") -> str | None:
    """The title of an HTML page, with whitespace collapsed, cut to a sensible length. None when there is none."""
    header = _CHARSET_IN_HEADER.search(content_type)
    sniffed = _CHARSET_IN_HTML.search(raw[:4096])
    charset = header.group(1) if header else sniffed.group(1).decode("ascii", "ignore") if sniffed else "utf-8"
    try:
        text = raw.decode(charset, errors="replace")
    except LookupError:
        text = raw.decode("utf-8", errors="replace")
    parser = _TitleParser()
    try:
        parser.feed(text)
        parser.close()
    except Exception:
        pass  # a page with broken markup may still have given its title
    found = parser.meta.get("og:title") or parser.title or parser.meta.get("twitter:title") or ""
    cleaned = re.sub(r"\s+", " ", unescape(found)).strip()
    return cleaned[:MAX_TITLE_LENGTH].rstrip() or None


def is_public_host(host: str) -> bool:
    """The host resolves only to addresses of the public internet."""
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError:
        return False
    for info in infos:
        address = ipaddress.ip_address(str(info[4][0]).split("%")[0])
        if not address.is_global:
            return False
    return bool(infos)


class _Redirects(urllib.request.HTTPRedirectHandler):
    max_redirections = MAX_REDIRECTS

    def __init__(self, allow_private: bool) -> None:
        self.allow_private = allow_private

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
        if not _is_allowed(newurl, self.allow_private):
            raise urllib.error.URLError("redirect to a host that is not allowed")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def _is_allowed(url: str, allow_private: bool) -> bool:
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https") or not parts.hostname:
        return False
    return allow_private or is_public_host(parts.hostname)


def fetch_page_title(url: str, *, allow_private: bool = False) -> str | None:
    """The title of the page at `url`, or None when it is not allowed, cannot be reached in time, or has no title."""
    if not _is_allowed(url, allow_private):
        return None
    opener = urllib.request.build_opener(_Redirects(allow_private))
    request = urllib.request.Request(
        url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"}
    )
    deadline = time.monotonic() + TIMEOUT_SECONDS
    try:
        with opener.open(request, timeout=TIMEOUT_SECONDS) as response:
            content_type = response.headers.get("Content-Type", "")
            if content_type and "html" not in content_type.lower():
                return None
            chunks: list[bytes] = []
            size = 0
            while size < MAX_BYTES and time.monotonic() < deadline:
                chunk = response.read(16 * 1024)
                if not chunk:
                    break
                chunks.append(chunk)
                size += len(chunk)
                if b"</head>" in chunk.lower() or b"</title>" in chunk.lower():
                    break
            return page_title(b"".join(chunks), content_type)
    except (OSError, ValueError, urllib.error.URLError):
        return None
