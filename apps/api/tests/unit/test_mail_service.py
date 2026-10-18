import json

import httpx
import pytest
import respx
from pydantic import SecretStr

from app.core.config import get_settings
from app.modules.mail.mail_service import RESEND_URL, MailDeliveryError, ResendMailSender


def _sender(configured: bool = True) -> ResendMailSender:
    update = (
        {"resend_api_key": SecretStr("re_test_key"), "mail_from": "App <no-reply@test.dev>"}
        if configured
        else {"resend_api_key": None, "mail_from": None}
    )
    return ResendMailSender(get_settings().model_copy(update=update))


@respx.mock
async def test_sends_reset_code_through_resend() -> None:
    route = respx.post(RESEND_URL).mock(return_value=httpx.Response(200, json={"id": "1"}))

    await _sender().send_reset_code("yo@test.dev", "042917", "Juan")

    request = route.calls.last.request
    assert request.headers["Authorization"] == "Bearer re_test_key"
    body = json.loads(request.content)
    assert body["from"] == "App <no-reply@test.dev>"
    assert body["to"] == ["yo@test.dev"]
    assert "contraseña" in body["subject"]
    for part in ("html", "text"):
        assert "042917" in body[part]
        assert "30 minutos" in body[part]


@respx.mock
@pytest.mark.parametrize(
    "side_effect",
    [httpx.Response(500, json={"message": "boom"}), httpx.ConnectTimeout("timeout")],
    ids=["http-500", "timeout"],
)
async def test_delivery_errors_are_wrapped(side_effect: object) -> None:
    respx.post(RESEND_URL).mock(side_effect=[side_effect])
    with pytest.raises(MailDeliveryError):
        await _sender().send_reset_code("yo@test.dev", "042917", None)


def test_not_configured_without_api_key() -> None:
    assert _sender(configured=False).is_configured is False
    assert _sender().is_configured is True
