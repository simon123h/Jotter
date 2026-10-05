import threading
from pathlib import Path

from jotter.shared.db import ConnectionPool


def test_connections_are_reused_and_never_shared(temp_dir):
    pool = ConnectionPool(Path(temp_dir) / "tasks.db")
    with pool.connection() as first:
        with pool.connection() as second:
            assert first is not second
    with pool.connection() as again:
        assert again in (first, second)
    pool.close()


def test_idle_connections_are_capped(temp_dir):
    pool = ConnectionPool(Path(temp_dir) / "tasks.db", max_idle=2)
    conns = [pool.acquire() for _ in range(5)]
    for conn in conns:
        pool.release(conn)
    assert len(pool._idle) == 2
    pool.close()


def test_open_transaction_is_rolled_back_on_return(temp_dir):
    pool = ConnectionPool(Path(temp_dir) / "tasks.db")
    with pool.connection() as conn:
        conn.execute("BEGIN")
        conn.execute("INSERT INTO projects (id, title, created_at) VALUES ('leak', 'Leak', 'x')")
    with pool.connection() as conn:
        assert not conn.in_transaction
        assert conn.execute("SELECT COUNT(*) FROM projects WHERE id = 'leak'").fetchone()[0] == 0
    pool.close()


def test_connection_borrowed_while_closing_is_closed_on_return(temp_dir):
    pool = ConnectionPool(Path(temp_dir) / "tasks.db")
    conn = pool.acquire()
    pool.close()
    pool.release(conn)
    assert pool._idle == []
    try:
        conn.execute("SELECT 1")
    except Exception as e:
        assert "closed" in str(e).lower()
    else:
        raise AssertionError("connection should have been closed")


def test_wal_files_stay_while_the_pool_is_open(temp_dir):
    pool = ConnectionPool(Path(temp_dir) / "tasks.db")
    with pool.connection() as conn:
        conn.execute("SELECT 1")
    assert (Path(temp_dir) / "tasks.db-wal").exists()
    pool.close()


def test_pool_is_thread_safe(temp_dir):
    pool = ConnectionPool(Path(temp_dir) / "tasks.db", max_idle=4)
    errors: list[Exception] = []

    def work() -> None:
        try:
            for _ in range(50):
                with pool.connection() as conn:
                    conn.execute("SELECT COUNT(*) FROM tasks").fetchone()
        except Exception as e:  # pragma: no cover - failure path
            errors.append(e)

    threads = [threading.Thread(target=work) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert errors == []
    assert len(pool._idle) <= 4
    pool.close()
