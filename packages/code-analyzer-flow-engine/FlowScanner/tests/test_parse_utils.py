"""Tests for public.parse_utils.

Run from the FlowScanner directory with::

    python3 -m unittest tests.test_parse_utils
"""
import builtins
import os
import tempfile
import unittest

import public.parse_utils as pu


class QuickValidateEncodingTest(unittest.TestCase):
    """Regression tests for issue #2074.

    Flow XML is authored/declared UTF-8, but quick_validate historically opened
    files using the platform locale encoding. On Windows (cp1252) any flow
    containing a non-cp1252 UTF-8 byte (e.g. 0x9D from U+201D smart quote)
    raised UnicodeDecodeError, the flow was silently dropped, and the scanner
    ultimately failed to write its results file.
    """

    #: A valid flow whose description contains a right double quotation mark
    #: (U+201D). This encodes to byte 0x9D in UTF-8's continuation, which maps
    #: to <undefined> in cp1252 and would raise UnicodeDecodeError.
    UTF8_FLOW = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<Flow xmlns="http://soap.sforce.com/2006/04/metadata">'
        '<description>smart ”quote</description>'
        '<start></start>'
        '</Flow>'
    )

    def setUp(self):
        fd, self.flow_path = tempfile.mkstemp(suffix='.flow')
        os.close(fd)
        with open(self.flow_path, 'w', encoding='utf-8') as fp:
            fp.write(self.UTF8_FLOW)

    def tearDown(self):
        if os.path.exists(self.flow_path):
            os.unlink(self.flow_path)

    def test_utf8_flow_validates_under_cp1252_locale(self):
        """quick_validate must read UTF-8 flows even when the locale is cp1252."""
        orig_open = builtins.open

        def cp1252_default_open(file, mode='r', *args, **kwargs):
            # Emulate a Windows cp1252 locale: text reads with no explicit
            # encoding fall back to cp1252.
            if 'b' not in mode and 'encoding' not in kwargs:
                kwargs['encoding'] = 'cp1252'
            return orig_open(file, mode, *args, **kwargs)

        builtins.open = cp1252_default_open
        try:
            result = pu.quick_validate(self.flow_path)
        finally:
            builtins.open = orig_open

        self.assertTrue(result)

    def test_utf8_flow_validates_under_utf8_locale(self):
        """quick_validate still works under a normal UTF-8 locale."""
        self.assertTrue(pu.quick_validate(self.flow_path))

    def test_missing_file_returns_none(self):
        """A missing file still returns None (unchanged behavior)."""
        self.assertIsNone(pu.quick_validate(self.flow_path + '.does-not-exist'))


if __name__ == '__main__':
    unittest.main()
