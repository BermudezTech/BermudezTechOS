import base64
import uuid
from datetime import UTC, datetime

import pytest

from app.modules.sync.core.cursor import decode_cursor, encode_cursor


def test_round_trip_keeps_microseconds_and_id() -> None:
    moment = datetime(2026, 10, 18, 14, 0, 1, 123456, tzinfo=UTC)
    record_id = uuid.uuid4()
    assert decode_cursor(encode_cursor(moment, record_id)) == (moment, record_id)


def test_cursor_is_url_safe_without_padding() -> None:
    cursor = encode_cursor(datetime.now(UTC), uuid.uuid4())
    assert "=" not in cursor and "+" not in cursor and "/" not in cursor


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode()


@pytest.mark.parametrize(
    "value",
    [
        "basura",
        "",
        _b64(b"no es json"),
        _b64(b"[1, 2]"),
        _b64(b'{"id": "6f1c2b9e-1d3a-4c55-9a77-0b1f6a2d9e10"}'),
        _b64(b'{"t": "2026-10-18T14:00:00+00:00"}'),
        _b64(b'{"t": "2026-10-18T14:00:00+00:00", "id": "no-uuid"}'),
        _b64(b'{"t": "2026-10-18T14:00:00", "id": "6f1c2b9e-1d3a-4c55-9a77-0b1f6a2d9e10"}'),
    ],
)
def test_malformed_cursors_raise_value_error(value: str) -> None:
    with pytest.raises(ValueError):
        decode_cursor(value)
