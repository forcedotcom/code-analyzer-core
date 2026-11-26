"""Tests for how the parser handles the flow's runInMode element.

Run from the FlowScanner directory with::

    python3 -m unittest tests.test_run_mode
"""
import os
import tempfile
import unittest

from flow_parser.parse import Parser
from public.enums import RunMode
from flow_scanner import util

FLOW_TEMPLATE = (
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<Flow xmlns="http://soap.sforce.com/2006/04/metadata">'
    '<apiVersion>68.0</apiVersion>'
    '<label>RunModeTest</label>'
    '<processType>AutoLaunchedFlow</processType>'
    '{run_in_mode}'
    '<status>Active</status>'
    '<start><locationX>0</locationX><locationY>0</locationY></start>'
    '</Flow>'
)


def parse_flow_with_run_in_mode(run_in_mode_value):
    """Writes a minimal flow to disk and returns its parser's declared run mode."""
    element = '' if run_in_mode_value is None else f'<runInMode>{run_in_mode_value}</runInMode>'
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, 'RunModeTest.flow-meta.xml')
        with open(path, 'w', encoding='utf-8') as f:
            f.write(FLOW_TEMPLATE.format(run_in_mode=element))
        return Parser.from_file(path).get_declared_run_mode()


class RunInModeTest(unittest.TestCase):
    """Regression tests for API v68's runInMode=UserMode, which used to raise KeyError and crash the scan."""

    def test_user_mode_is_recognized(self):
        self.assertIs(parse_flow_with_run_in_mode('UserMode'), RunMode.UserMode)

    def test_existing_modes_are_unchanged(self):
        self.assertIs(parse_flow_with_run_in_mode('SystemModeWithoutSharing'), RunMode.SystemModeWithoutSharing)
        self.assertIs(parse_flow_with_run_in_mode('SystemModeWithSharing'), RunMode.SystemModeWithSharing)
        self.assertIs(parse_flow_with_run_in_mode('DefaultMode'), RunMode.DefaultMode)

    def test_missing_run_in_mode_is_default_mode(self):
        self.assertIs(parse_flow_with_run_in_mode(None), RunMode.DefaultMode)

    def test_unknown_run_in_mode_falls_back_to_default_mode_instead_of_crashing(self):
        with self.assertLogs('flow_parser.parse', level='WARNING'):
            self.assertIs(parse_flow_with_run_in_mode('SomeFutureMode'), RunMode.DefaultMode)

    def test_user_mode_subflow_inherits_the_parent_mode(self):
        # Like DefaultMode, UserMode must not override a system mode that a parent flow is already running in
        self.assertIs(util.get_effective_run_mode(RunMode.SystemModeWithoutSharing, RunMode.UserMode),
                      RunMode.SystemModeWithoutSharing)
        self.assertIs(util.get_effective_run_mode(None, RunMode.UserMode), RunMode.UserMode)


if __name__ == '__main__':
    unittest.main()
