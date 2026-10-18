"""Plantillas de correo (en español)."""

from html import escape


def reset_code_email(code: str, display_name: str | None) -> tuple[str, str, str]:
    """Devuelve `(asunto, html, texto)` del correo con el código de recuperación."""
    subject = "Tu código para restablecer la contraseña"
    greeting = f"Hola, {display_name}:" if display_name else "Hola:"
    text = (
        f"{greeting}\n\n"
        f"Tu código para restablecer la contraseña de BermudezTechOS es: {code}\n\n"
        "Vence en 30 minutos.\n\n"
        "Si no pediste restablecer tu contraseña, puedes ignorar este correo."
    )
    html = (
        f"<p>{escape(greeting)}</p>"
        "<p>Tu código para restablecer la contraseña de BermudezTechOS es:</p>"
        f'<p style="font-size:32px;font-weight:bold;letter-spacing:6px">{escape(code)}</p>'
        "<p>Vence en 30 minutos.</p>"
        "<p>Si no pediste restablecer tu contraseña, puedes ignorar este correo.</p>"
    )
    return subject, html, text
