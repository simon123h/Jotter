"""ULID generation using Python's ulid-py or standard implementation."""

import os
import time

CROCKFORD_BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"


def generate_ulid() -> str:
    """Generates a standard 26-character Crockford Base32 ULID."""
    timestamp_ms = int(time.time() * 1000)
    time_chars = []
    for _ in range(10):
        time_chars.append(CROCKFORD_BASE32[timestamp_ms & 0x1F])
        timestamp_ms >>= 5
    time_str = "".join(reversed(time_chars))

    random_bytes = os.urandom(10)
    rand_int = int.from_bytes(random_bytes, byteorder="big")
    rand_chars = []
    for _ in range(16):
        rand_chars.append(CROCKFORD_BASE32[rand_int & 0x1F])
        rand_int >>= 5
    rand_str = "".join(reversed(rand_chars))

    return time_str + rand_str
