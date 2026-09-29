from pathlib import Path
from unittest.mock import patch

from jotter.shared.fs import atomic_replace, atomic_write


def test_atomic_write_creates_file(tmp_path):
    target = tmp_path / "test_file.txt"
    content = "Hello, atomic world!"
    atomic_write(target, content)

    assert target.is_file()
    assert target.read_text(encoding="utf-8") == content


def test_atomic_write_overwrites_existing_file(tmp_path):
    target = tmp_path / "test_file.txt"
    target.write_text("old content", encoding="utf-8")

    new_content = "new replaced content"
    atomic_write(target, new_content)

    assert target.read_text(encoding="utf-8") == new_content


def test_atomic_replace_retries_on_permission_error(tmp_path):
    src = tmp_path / "src.tmp"
    dst = tmp_path / "dst.txt"
    src.write_text("source content", encoding="utf-8")
    dst.write_text("initial content", encoding="utf-8")

    attempts = 0

    def mock_replace(self, target):
        nonlocal attempts
        attempts += 1
        if attempts < 3:
            raise PermissionError("[WinError 5] Access is denied")
        return original_replace(self, target)

    original_replace = Path.replace

    with patch.object(Path, "replace", autospec=True, side_effect=mock_replace):
        atomic_replace(src, dst, max_retries=5, initial_delay=0.001)

    assert attempts == 3
    assert dst.read_text(encoding="utf-8") == "source content"
    assert not src.exists()


def test_atomic_replace_fallback_on_persistent_permission_error(tmp_path):
    src = tmp_path / "src.tmp"
    dst = tmp_path / "dst.txt"
    src.write_text("fallback content", encoding="utf-8")
    dst.write_text("original content", encoding="utf-8")

    with patch.object(Path, "replace", autospec=True, side_effect=PermissionError("[WinError 5] Access is denied")):
        atomic_replace(src, dst, max_retries=3, initial_delay=0.001)

    assert dst.read_text(encoding="utf-8") == "fallback content"
    assert not src.exists()
