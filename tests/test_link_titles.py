"""Reading the title of a web page for a link saved as a task."""

import http.server
import threading
import time
import urllib.error
import urllib.request
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from jotter.features.links import router as links_router
from jotter.features.links import service
from jotter.features.links.service import fetch_page_title, is_public_host, page_title


class _Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args: object) -> None:
        pass

    def do_GET(self) -> None:
        path = self.path
        if path == "/redirect":
            self.send_response(302)
            self.send_header("Location", "/page")
            self.end_headers()
        elif path == "/slow":
            time.sleep(1.5)
            self._send(b"<title>Too late</title>")
        elif path == "/image":
            self._send(b"\x89PNG", "image/png")
        elif path == "/latin1":
            self._send("<title>Café</title>".encode("latin-1"), "text/html; charset=iso-8859-1")
        else:
            self._send(b"<html><head><title> A  page\n title </title></head><body>x</body></html>")

    def _send(self, body: bytes, content_type: str = "text/html") -> None:
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.end_headers()
        self.wfile.write(body)


@pytest.fixture
def server() -> Generator[str, None, None]:
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{httpd.server_address[1]}"
    httpd.shutdown()


def test_page_title_prefers_the_open_graph_title_and_tidies_the_text():
    html = b'<head><meta property="og:title" content="The &amp; real title"><title>Site - The real title</title></head>'
    assert page_title(html) == "The & real title"
    assert page_title(b"<title>\n  Just   the\ttitle \n</title>") == "Just the title"
    assert page_title(b"<p>no title here</p>") is None
    assert page_title(b"<title>   </title>") is None
    assert len(page_title(b"<title>" + b"x" * 500 + b"</title>") or "") == 200


def test_page_title_reads_the_declared_charset():
    assert page_title("<title>Café</title>".encode("latin-1"), "text/html; charset=iso-8859-1") == "Café"
    assert page_title(b'<meta charset="iso-8859-1"><title>Caf\xe9</title>') == "Café"
    assert page_title(b"<title>x</title>", "text/html; charset=nonsense") == "x"


def test_fetches_the_title_and_follows_redirects(server: str):
    assert fetch_page_title(f"{server}/page", allow_private=True) == "A page title"
    assert fetch_page_title(f"{server}/redirect", allow_private=True) == "A page title"
    assert fetch_page_title(f"{server}/latin1", allow_private=True) == "Café"


def test_gives_no_title_when_the_page_is_not_html_slow_or_gone(server: str, monkeypatch: pytest.MonkeyPatch):
    assert fetch_page_title(f"{server}/image", allow_private=True) is None
    monkeypatch.setattr(service, "TIMEOUT_SECONDS", 0.3)
    assert fetch_page_title(f"{server}/slow", allow_private=True) is None
    assert fetch_page_title("http://127.0.0.1:1/", allow_private=True) is None


def test_does_not_fetch_what_is_not_public(server: str):
    # The test server is on this machine, which is exactly what must not be reachable
    assert fetch_page_title(f"{server}/page") is None
    assert fetch_page_title("file:///etc/passwd", allow_private=True) is None
    assert fetch_page_title("ftp://example.com/x", allow_private=True) is None
    assert not is_public_host("localhost")
    assert not is_public_host("192.168.1.10")
    assert not is_public_host("169.254.169.254")
    assert not is_public_host("no-such-host.invalid")


def test_a_redirect_to_a_private_host_is_refused():
    handler = service._Redirects(allow_private=False)
    request = urllib.request.Request("https://example.com/")
    with pytest.raises(urllib.error.URLError):
        handler.redirect_request(request, None, 302, "Found", {}, "http://127.0.0.1/admin")  # type: ignore[arg-type]
    with pytest.raises(urllib.error.URLError):
        handler.redirect_request(request, None, 302, "Found", {}, "file:///etc/passwd")  # type: ignore[arg-type]


def test_the_route_fetches_only_with_the_setting_on(test_env: tuple[TestClient, str], monkeypatch: pytest.MonkeyPatch):
    client, _ = test_env
    asked: list[str] = []
    monkeypatch.setattr(links_router, "fetch_page_title", lambda url: asked.append(url) or "A title")

    off = client.post("/api/links/title", json={"url": "https://example.com/a"})
    assert off.json() == {"title": None}
    assert asked == []

    client.patch("/api/settings", json={"lookUpLinkTitles": True})
    on = client.post("/api/links/title", json={"url": "https://example.com/a"})
    assert on.json() == {"title": "A title"}
    assert asked == ["https://example.com/a"]
