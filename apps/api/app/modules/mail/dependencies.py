from app.core.config import get_settings
from app.modules.mail.mail_service import MailSender, ResendMailSender


def get_mail_sender() -> MailSender:
    return ResendMailSender(get_settings())
