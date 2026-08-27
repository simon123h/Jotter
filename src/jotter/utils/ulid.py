import os
import time

CROCKFORD_32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"


def encode_base32(value: int, length: int) -> str:
    chars = []
    for _ in range(length):
        chars.append(CROCKFORD_32[value % 32])
        value //= 32
    return "".join(reversed(chars))


def generate_ulid() -> str:
    now_ms = int(time.time() * 1000)
    time_part = encode_base32(now_ms, 10)
    rand_bytes = os.urandom(10)
    rand_val = int.from_bytes(rand_bytes, byteorder="big")
    rand_part = encode_base32(rand_val, 16)
    return time_part + rand_part
