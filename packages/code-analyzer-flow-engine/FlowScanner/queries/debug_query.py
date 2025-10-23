"""Queries used for debugging only


"""
from __future__ import annotations

import logging
import re
from typing import TypeAlias
import json

import public
from flow_scanner import control_flow
from flow_scanner.control_flow import Crawler
from public import parse_utils
from public.contracts import (AbstractQuery, QueryAction, QueryDescription,
                              QueryResult, State, AbstractCrawler, FlowParser, LexicalQuery, Query)
from public.data_obj import CrawlStep, InfluenceStatement, InfluencePath
from public.enums import Severity, ConnType, TriggerType, FlowType

El: TypeAlias = parse_utils.CP.ET.Element

logger = logging.getLogger(__name__)

DEFAULT_HELP_URL = ("https://developer.salesforce.com/docs/atlas.en-us.secure_coding_guide.meta"
                    "/secure_coding_guide/secure_coding_considerations_flow_design.htm")


ns = parse_utils.ns

RESOURCE_TAGS = parse_utils.RESOURCE_TAGS

# Add query id to class name map. Add here to register
# the query and make it available for use via CLI
# The key is the query id as used in CLI, and the value is the class name
QUERIES = {
    "Detect": "Flow Detected"
}


class Detect(AbstractQuery):

    def __init__(self, msg: str|None = None):
        try:
            conf = json.loads(msg)
            self.conf = msg
        except:
            self.conf = None
            self.query_id = 'Detect'
            self.query_name = QUERIES[self.query_id]


    def get_query_description(self) -> QueryDescription:
        return QueryDescription(
            query_id=self.query_id,
            query_name=self.query_name,
            query_description="Flow detected from one named element to another",
            severity=Severity.Flow_Low_Severity,
            is_security=False
        )


    def when_to_run(self) -> QueryAction:
        return QueryAction.process_elem

    def execute(self) -> list[QueryResult] | None:
        if self.conf is None:
            return None
        pass
