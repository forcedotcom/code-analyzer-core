"""Security Encoding library
"""


def html_encode(msg: str) -> str:
    """Performs html encoding
    Args:
        msg: unicode message to encode

    Returns:
        html encoded message
    """
    if isinstance(msg, int):
        return msg

    msg = msg.replace('&', '&amp;')
    msg = msg.replace('>', '&gt;')
    msg = msg.replace('<', '&lt;')
    msg = msg.replace("'", "&#39;")
    msg = msg.replace('"', '&quot;')
    return msg


def sql_escape(msg: str) -> str:
    """simple sql escape (unicode)

    Args:
        msg: string to escape

    Returns:
        escapes \\ and '
    """
    msg = msg.replace("\\", "\\\\")
    msg = msg.replace("'", "\\'")
    return msg


def legal_sql_escape(msg: str) -> str:
    """Escape single quotes with two single quotes.

    This is the SQL standard escaping.

    Args:
        msg: string to escape

    Returns: escaped string

    """
    msg = msg.replace("'", "''")
    return msg


def sql_enc_html_dec(msg: str) -> str:
    """Decodes html-encoded text

    Args:
        msg: string to decode

    Returns: decoded string

    """
    msg = msg.replace('&amp;', '&')
    msg = msg.replace('&gt;', '>')
    msg = msg.replace('&lt;', '<')
    msg = msg.replace('&apos;', "'")
    msg = msg.replace('&quot;', '"')

    msg = legal_sql_escape(msg)
    return msg
