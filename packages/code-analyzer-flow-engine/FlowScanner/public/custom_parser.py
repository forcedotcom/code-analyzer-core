"""Custom XML parser for flow files.

This module provides custom XML parsing functionality with line number tracking
for flow metadata files.
"""
import sys

sys.modules['_elementtree'] = None
import xml.etree.ElementTree as ET


def get_root(path: str) -> ET.Element:
    """Parse an XML file and return the root element.

    Args:
        path: Path to the XML file to parse.

    Returns:
        Root XML Element with line number tracking.
    """
    return ET.parse(path, parser=LineNumberingParser()).getroot()

def get_parent_map(root: ET.Element) -> dict[ET.Element, ET.Element]:
    """Build a mapping from child elements to their parent elements.

    Args:
        root: Root XML element to build the parent map for.

    Returns:
        Dictionary mapping each child element to its parent element.
    """
    parent = {}
    for elem in root.iter():
        for child in elem:
            parent[child] = elem
    return parent

def get_root_from_string(byte_str: str | bytes) -> ET.Element:
    """Parse XML from a string or bytes and return the root element.

    Args:
        byte_str: XML string or bytes to parse.

    Returns:
        Root XML Element with line number tracking.
    """
    return ET.fromstring(byte_str, parser=LineNumberingParser())


def to_string(elem: ET.Element) -> str:
    """Convert an XML element to a cleaned string representation.

    Args:
        elem: XML Element to convert.

    Returns:
        Cleaned string representation of the element.
    """
    return clean_string(ET.tostring(elem, encoding='unicode').strip())


def clean_string(msg: str) -> str:
    """Remove namespace declarations from XML strings.

    Performs the following transformations:
        1) ``<ns0:recordCreates>`` --> ``<recordCreates>``
        2) ``</ns0:recordCreates>`` --> ``</recordCreates>``
        3) ``<recordCreates xmlns="...">`` --> ``<recordCreates>``
        4) ``<recordCreates xmlns:ns0="...">`` --> ``<recordCreates>``
        5) Replace ``&lt;ns0:`` with ``&lt;`` and ``&lt;/ns0:`` with ``&lt;/``

    Args:
        msg: String to clean.

    Returns:
        Cleaned string with namespaces removed. Returns "start" if input is '*'.
    """
    if not isinstance(msg, str):
        return msg
    elif msg == '*':
        return "start"
    else:
        msg1 = msg.replace("<ns0:", "<").replace("</ns0:", "</")
        msg2 = (msg1.replace(' xmlns="http://soap.sforce.com/2006/04/metadata"', '')
                .replace(' xmlns:ns0="http://soap.sforce.com/2006/04/metadata"', ''))
        msg3 = msg2.replace('&lt;ns0:', '&lt;').replace('&lt;/ns0:', '&lt;')

        return msg3


class LineNumberingParser(ET.XMLParser):
    """XML parser that tracks line numbers and positions for elements.

    Extends the standard XMLParser to add source location information
    (line number, column number, byte index) to each parsed element.
    """

    def _start(self, *args, **kwargs):
        """Handle element start events and add position tracking.

        Args:
            *args: Positional arguments passed to parent parser.
            **kwargs: Keyword arguments passed to parent parser.

        Returns:
            XML Element with source position attributes added.
        """
        # Here we assume the default XML parser which is expat
        # and copy its element position attributes into output Elements
        element = super(self.__class__, self)._start(*args, **kwargs)
        element.sourceline = self.parser.CurrentLineNumber
        element._start_column_number = self.parser.CurrentColumnNumber
        element._start_byte_index = self.parser.CurrentByteIndex
        return element

    def _end(self, *args, **kwargs):
        """Handle element end events and add position tracking.

        Args:
            *args: Positional arguments passed to parent parser.
            **kwargs: Keyword arguments passed to parent parser.

        Returns:
            XML Element with end position attributes added.
        """
        element = super(self.__class__, self)._end(*args, **kwargs)
        element._end_line_number = self.parser.CurrentLineNumber
        element._end_column_number = self.parser.CurrentColumnNumber
        element._end_byte_index = self.parser.CurrentByteIndex
        return element
