"""Envío de correos con la API REST de Resend. Nunca registra el código ni la clave."""

from typing import Protocol

import httpx

from app.core.config import Settings
from app.modules.mail.templates import reset_code_email

RESEND_URL = "https://api.resend.com/emails"
_TIMEOUT_SECONDS = 10


class MailDeliveryError(Exception):
    """El proveedor no aceptó el correo (error HTTP o de red)."""


class MailSender(Protocol):
    @property
    def is_configured(self) -> bool: ...

    async def send_reset_code(self, to: str, code: str, display_name: str | None) -> None: ...


class ResendMailSender:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    @property
    def is_configured(self) -> bool:
        return self._settings.mail_configured

    async def send_reset_code(self, to: str, code: str, display_name: str | None) -> None:
        api_key = self._settings.resend_api_key
        if api_key is None or not self._settings.mail_from:
            raise MailDeliveryError("Envío de correo no configurado")
        subject, html, text = reset_code_email(code, display_name)
        payload = {
            "from": self._settings.mail_from,
            "to": [to],
            "subject": subject,
            "html": html,
            "text": text,
        }
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
                response = await client.post(
                    RESEND_URL,
                    json=payload,
                    headers={"Authorization": f"Bearer {api_key.get_secret_value()}"},
                )
        except httpx.HTTPError as error:
            raise MailDeliveryError(f"Error de red con Resend: {type(error).__name__}") from None
        if response.is_error:
            raise MailDeliveryError(f"Resend respondió {response.status_code}")
