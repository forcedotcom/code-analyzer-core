"""Tests for queries.optional_query.is_valid_salesforce_id.

Run from the FlowScanner directory with::

    python3 -m unittest tests.test_salesforce_id
"""
import unittest

from queries.optional_query import is_valid_salesforce_id, to18


class IsValidSalesforceIdTest(unittest.TestCase):
    def test_valid_18_char_id(self):
        self.assertTrue(is_valid_salesforce_id("001cU000009Tt2MQAS"))

    def test_valid_15_char_id(self):
        self.assertTrue(is_valid_salesforce_id("001cU000009Tt2M"))

    def test_valid_18_char_id_without_adjacent_digits(self):
        base = "aBcDe0FgHiJkLmN"
        self.assertTrue(is_valid_salesforce_id(to18(base)))

    def test_invalid_18_char_checksum(self):
        self.assertFalse(is_valid_salesforce_id("001cU000009Tt2MAAA"))

    def test_rejects_other_lengths(self):
        for word in ["abcdefghij11klmn", "abcdefghij11klmno", "abcdefghijk11lmnopq", "short11"]:
            self.assertFalse(is_valid_salesforce_id(word), word)


if __name__ == "__main__":
    unittest.main()
