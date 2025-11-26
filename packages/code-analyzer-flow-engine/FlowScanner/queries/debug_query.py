"""Queries used for debugging only


"""
from __future__ import annotations

import logging
from typing import TypeAlias

from public import parse_utils
from public.contracts import (Query, QueryAction, QueryDescription,
                              QueryResult)
from public.enums import Severity

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


class Detect(Query):
    query_id = 'Detect'
    query_name = QUERIES[query_id]

    def __init__(self, arg_obj: str | None = None):
        self.conf = arg_obj


    @classmethod
    def get_query_description(cls) -> QueryDescription:
        return QueryDescription(
            query_id=cls.query_id,
            query_name=cls.query_name,
            query_description="Debug query",
            severity=Severity.Flow_Low_Severity,
            is_security=False
        )


    def when_to_run(self) -> list[QueryAction]:
        return [QueryAction.process_elem]

    def execute(self) -> list[QueryResult] | None:
        if self.conf is None:
            return None
        pass
