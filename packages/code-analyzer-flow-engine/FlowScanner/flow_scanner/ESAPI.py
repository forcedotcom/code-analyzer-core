"""Security Encoding library.

Provides functions for HTML encoding, SQL escaping, and related security
utilities for safe output handling.
"""


def html_encode(msg: str) -> str | int | None:
    """Perform HTML encoding on a message.

    Args:
        msg: Unicode message to encode.

    Returns:
        HTML-encoded message, or original value if None or int.
    """
    if msg is None:
        return msg

    if isinstance(msg, int):
        return msg

    msg = msg.replace('&', '&amp;')
    msg = msg.replace('>', '&gt;')
    msg = msg.replace('<', '&lt;')
    msg = msg.replace("'", "&#39;")
    msg = msg.replace('"', '&quot;')
    return msg


def sql_escape(msg: str) -> str:
    """Simple SQL escape for Unicode strings.

    Args:
        msg: String to escape.

    Returns:
        Escaped string with backslashes and single quotes escaped.
    """
    msg = msg.replace("\\", "\\\\")
    msg = msg.replace("'", "\\'")
    return msg


def legal_sql_escape(msg: str) -> str:
    """Escape single quotes with two single quotes.

    This is the SQL standard escaping method.

    Args:
        msg: String to escape.

    Returns:
        Escaped string with single quotes doubled.
    """
    msg = msg.replace("'", "''")
    return msg


def sql_enc_html_dec(msg: str) -> str:
    """Decode HTML-encoded text and apply SQL escaping.

    Args:
        msg: HTML-encoded string to decode.

    Returns:
        Decoded and SQL-escaped string.
    """
    msg = msg.replace('&amp;', '&')
    msg = msg.replace('&gt;', '>')
    msg = msg.replace('&lt;', '<')
    msg = msg.replace('&apos;', "'")
    msg = msg.replace('&quot;', '"')

    msg = legal_sql_escape(msg)
    return msg
