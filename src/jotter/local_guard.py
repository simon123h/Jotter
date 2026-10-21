"""Keeps the API to the pages Jotter serves itself.

The server has no login: whoever can reach it can read and write the vault. On the loopback address that is only the
person at this machine, but a web page open in their browser can reach it as well, by cross-origin requests or by
DNS rebinding (a name of the attacker's that points at 127.0.0.1). Two checks close that:

- the Host header must name this machine (only when the server is bound to loopback, so a deliberate --host 0.0.0.0
  keeps working under its own name),
- an Origin header, which browsers add to cross-origin and to data-changing requests, must be a page of this machine or
  the same origin as the request.
"""

import ipaddress
from collections.abc import Awaitable, Callable
from urllib.parse import urlsplit

from fastapi import Request
from fastapi.responses import JSONResponse, Response

LOOPBACK_NAMES = frozenset({"localhost", "127.0.0.1", "::1"})

# Dev servers (Vite) and tests run on other ports of the same machine
LOOPBACK_ORIGIN_REGEX = r"^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$"


def is_loopback_host(host: str) -> bool:
    name = host.strip().lower().strip("[]")
    if name in LOOPBACK_NAMES:
        return True
    try:
        return ipaddress.ip_address(name).is_loopback
    except ValueError:
        return False


def _host_name(host_header: str) -> str:
    # "localhost:58271", "127.0.0.1" or "[::1]:58271"
    return (urlsplit(f"//{host_header.strip()}").hostname or "").lower()


def reject(detail: str) -> Response:
    return JSONResponse(status_code=403, content={"detail": detail})


def make_local_guard(
    bound_host: str,
) -> Callable[[Request, Callable[[Request], Awaitable[Response]]], Awaitable[Response]]:
    check_host = is_loopback_host(bound_host)
    own_names = {bound_host.strip().lower().strip("[]")}

    async def local_guard(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        host_header = request.headers.get("host", "")
        if check_host:
            name = _host_name(host_header)
            if not (is_loopback_host(name) or name in own_names):
                return reject("Host not allowed")
        origin = request.headers.get("origin")
        if origin is not None:
            parts = urlsplit(origin)
            same_origin = parts.netloc.lower() == host_header.strip().lower()
            if not (same_origin or is_loopback_host(parts.hostname or "")):
                return reject("Origin not allowed")
        return await call_next(request)

    return local_guard
