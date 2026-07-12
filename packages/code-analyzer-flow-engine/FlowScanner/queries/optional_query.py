"""Queries requested by Engineering

    BETA - Under testing

"""
from __future__ import annotations

import logging
import re
import traceback
from typing import TypeAlias

import public
from public import parse_utils
from public.contracts import (AbstractQuery, QueryAction, QueryDescription,
                              QueryResult, State, AbstractCrawler, FlowParser, LexicalQuery, Query)
from public.data_obj import CrawlStep, InfluenceStatement, InfluencePath
from public.enums import Severity, ConnType, TriggerType, FlowType

El: TypeAlias = parse_utils.CP.ET.Element

logger = logging.getLogger(__name__)

DEFAULT_HELP_URL = ("https://developer.salesforce.com/docs/atlas.en-us.secure_coding_guide.meta"
                    "/secure_coding_guide/secure_coding_considerations_flow_design.htm")

id_pattern = re.compile(r"^(?=.*[0-9][0-9])[a-zA-Z0-9]+[a-zA-Z0-9]{15}(?:[0-5][A-Z0-5]{3})?$")
copy_name_pattern = re.compile(r"^Copy_\d+_of_[a-zA-Z]+")
copy_label_pattern = re.compile(r"^Copy \d+ of [a-zA-Z]+")
# Matches an http(s) URL anywhere inside a string value.
url_pattern = re.compile(r"https?://[^\s\"'<>]+", re.IGNORECASE)
# Minimum Flow API version considered current. Flows below this (or with no
# apiVersion) are flagged by InvalidApiVersion.
MIN_API_VERSION = 50.0

ns = parse_utils.ns

RESOURCE_TAGS = parse_utils.RESOURCE_TAGS

# Add query id to class name map. Add here to register
# the query and make it available for use via CLI
# The key is the query id as used in CLI, and the value is the class name
QUERIES = {
    "DbInLoop": "Database Operation In Loop",
    "HardcodedId": "Hardcoded Id",
    "MissingFaultHandler": "Missing Fault Handler",
    "SameRecordUpdate": "Same Record Update In Trigger",
    "TriggerEntryCriteria": "Record Trigger With No Entry Criteria",
    "DefaultCopy": "Default Copy Label",
    "UnusedResource": "Unused Resource",
    "UnreachableElement": "Element is Unreachable",
    "MissingNextValueConnector": "Loop Element Without nextValueConnector",
    "CyclicSubflow": "Chain of subflow calls forms a cycle",
    "TriggerWaitEvent": "Wait Event in Trigger",
    "TriggerCallout": "Trigger Flow Callout in Synchronous Path",
    "MissingDescription": "Missing Description",
    "HardcodedUrl": "Hardcoded URL",
    "GetRecordAllFields": "Get Records Retrieves All Fields",
    "ProcessBuilder": "Deprecated Process Builder or Workflow",
    "InactiveFlow": "Inactive Flow",
    "InvalidApiVersion": "Invalid or Outdated API Version",
    "MissingTriggerOrder": "Record Trigger Without Trigger Order"
}

"""
            TODO: consider these as well
           "DanglingConnector": "Connector does not point to a traversable flow element",
           "DanglingSubflow": ("Subflow target cannot be reached in code under scan 
           (Applies only for targets without a namespace)."),
           "MissingStart": "The flow has no start element or startElementReference",
           "UninitializedVariable": "Variable Used Prior To Initialization",
           "NullValueError": "Potentially Null Value Used Unsafely"
           }
"""

class DbInLoop(AbstractQuery):

    query_id = "DbInLoop"
    query_name = QUERIES[query_id]

    @classmethod
    def get_query_description(cls) -> QueryDescription:
        return QueryDescription(
            query_id = cls.query_id,
            query_name= cls.query_name,
            query_description=("A Database operation (RecordLookups, RecordCreates, RecordUpdates, RecordDeletes) "
                               "is being performed within a loop. To avoid excessive Database calls, the operation "
                               "should be bulkified by using collection variables and the 'IN' operator."),
            query_version="1.0",
            severity=public.enums.Severity.Flow_Moderate_Severity,
            help_url=DEFAULT_HELP_URL,
            is_security=False
        )

    def when_to_run(self) -> list[QueryAction]:
        return [QueryAction.flow_enter]

    def convert_results(self, results: list[tuple[CrawlStep, str, str, int]], parser: FlowParser) -> list[QueryResult]:
        q_results = []
        for step, flow_path, source_text, line_no in results:
            loop_name = step.visitor.loop_context[-1][0]
            loop_elem = parser.get_by_name(loop_name)
            loop_code = parse_utils.get_elem_string(loop_elem)
            loop_line_no = parse_utils.get_line_no(loop_elem)

            step_elem = parser.get_by_name(step.element_name)
            step_line_no = parse_utils.get_line_no(step_elem)
            step_code = parse_utils.get_elem_string(step_elem)

            stmt_src = InfluenceStatement(
                influenced_var=loop_name,
                influencer_var=loop_name,
                element_name=loop_name,
                comment=f"Loop",
                flow_path=flow_path,
                line_no=loop_line_no,
                source_text=loop_code,
                source_path=flow_path,
            )
            stmt_sink = InfluenceStatement(
                influenced_var=step.element_name,
                influencer_var=loop_name,
                element_name=step.element_name,
                comment=f"Database Operation {step.element_tag} performed within"
                        f" the Loop {loop_name}",
                flow_path=flow_path,
                line_no=step_line_no,
                source_text=step_code,
                source_path=flow_path,
            )
            path = InfluencePath(
                history=(stmt_src,),
                influenced_name=step.element_name,
                influencer_name=loop_name,
                influencer_property=None,
                influenced_property=None,
                influenced_filepath=flow_path,
                influencer_filepath=flow_path,
                influenced_type_info=None
            )
            qr = QueryResult(
                query_id=self.query_id,
                flow_type=parser.get_flow_type(),
                influence_statement=stmt_sink,
                elem_code=loop_code,
                elem_line_no=loop_line_no,
                elem_name=loop_name,
                filename=flow_path,
                paths=frozenset([path])  # only print from source to sink
            )
            q_results.append(qr)
        return q_results

    def execute(self,
                state: State = None,  # the state has the flow_path variable
                crawler: AbstractCrawler = None,
                all_states=None,
                ) -> list[QueryResult] | None:
        crawl_schedule = crawler.get_crawl_schedule()
        parser = state.get_parser()
        flow_path = parser.get_filename()
        results = []
        db_tags = ["recordLookups", "recordCreates", "recordUpdates", "recordDeletes"]
        for step in crawl_schedule:
            if step.element_tag in db_tags and step.visitor is not None:
                visitor = step.visitor
                if (visitor.loop_context is not None and len(visitor.loop_context) > 0
                        and visitor.loop_context[-1][1] is ConnType.Loop):
                    elem = parser.get_by_name(step.element_name)
                    line_no = parse_utils.get_line_no(elem)
                    source_text = parse_utils.get_elem_string(elem)
                    results.append((step, flow_path, source_text, line_no))

        return self.convert_results(results, parser)


class HardcodedId(LexicalQuery):

    query_id = "HardcodedId"
    query_name = QUERIES[query_id]

    @classmethod
    def get_query_description(cls) -> QueryDescription:
        return QueryDescription(
            query_id=cls.query_id,
            query_name=cls.query_name,
            query_description=("The flow has a hardcoded Id. Hardcoded Ids are a bad practice, and flows with "
                               "hardcoded Ids are not appropriate for distribution."),
            query_version="1.0",
            severity=public.enums.Severity.Flow_Low_Severity,
            help_url=DEFAULT_HELP_URL,
            is_security=False
        )

    def when_to_run(self) -> list[QueryAction]:
        return [QueryAction.lexical]

    def execute(self, parser: FlowParser = None, **kwargs) -> list[QueryResult] | None:
        if parser is None:
            return None
        else:
            results = []
            root = parser.get_root()
            top_level = [x for x in root if parse_utils.get_tag(x) != "processMetadataValues"]
            for top in top_level:
                for el in top.iter(tag=f"{ns}stringValue"):
                    msg = el.text
                    if msg is not None:
                        res = is_valid_salesforce_id(msg)
                        if res and (top, el) not in results:
                            results.append((top, el))

            return self.report(results, parser)

    def report(self, results: list[tuple], parser) -> list[QueryResult] | None:
        accum = []
        for top, el in results:
            el_name = parse_utils.get_name(top)
            if el_name is None:
                el_name = parse_utils.get_tag(top)
            accum.append(
                QueryResult(
                    query_id=self.query_id,
                    flow_type=parser.get_flow_type(),
                    influence_statement=None,
                    paths=None,
                    elem_code=parse_utils.get_elem_string(el),
                    elem_line_no=parse_utils.get_line_no(el),
                    elem_name=el_name,
                    filename=parser.get_filename(),
                    field=None
                )
            )
        if len(accum) == 0:
            return None
        else:
            return accum


class MissingFaultHandler(LexicalQuery):

    query_id = "MissingFaultHandler"
    query_name = QUERIES[query_id]
    fault_tags = ['recordCreates', 'recordUpdates', 'recordDeletes',
                       'actionCalls', 'subflows']

    def __init__(self):
        self.root = None

    @classmethod
    def get_query_description(cls) -> QueryDescription:
        return QueryDescription(query_id=cls.query_id,
                                query_name=cls.query_name,
                                severity=public.enums.Severity.Flow_Low_Severity,
                                help_url=DEFAULT_HELP_URL,
                                is_security=False,
                                query_description=("An element that can fire fault events is missing "
                                                   "fault handlers. Add fault handlers to all Create Records, "
                                                   "Update Records, Delete Records, Action Calls, and Subflows.")
                                )

    def when_to_run(self) -> list[QueryAction]:
        return [QueryAction.lexical]

    def execute(self, parser: FlowParser = None, **kwargs) -> list[QueryResult] | None:
        accum = []
        if self.root is None:
            root = parser.get_root()
            self.root = root
        else:
            root = self.root

        for tag_ in self.fault_tags:
            elems = parse_utils.get_by_tag(root, tag_)
            for el in elems:
                fc = parse_utils.get_by_tag(el, 'faultConnector')
                if len(fc) == 0:
                    accum.append(QueryResult(
                        query_id=self.query_id,
                        flow_type=parser.get_flow_type(),
                        influence_statement=None,
                        paths=None,
                        elem_code=parse_utils.get_elem_string(el),
                        elem_line_no=parse_utils.get_line_no(el),
                        elem_name=parse_utils.get_name(el),
                        filename=parser.get_filename(),
                        field=None)
                    )
        if len(accum) == 0:
            return None
        else:
            return accum

class SameRecordUpdate(Query):

    query_id = "SameRecordUpdate"
    query_name = QUERIES[query_id]

    def __init__(self):
        self.should_check: bool = True
        self.should_scan: bool = False
        self.flow_path: str | None = None
        self.source_vars: set[tuple[str, str]] | None = None

        self.trig_object = None

    def populate_trig_object(self, parser: FlowParser) -> None:
        self.trig_object = parser.get_trigger_object()
        if self.trig_object is None:
            self.should_scan = False

    @classmethod
    def get_query_description(cls) -> QueryDescription:
        return QueryDescription(
            query_id=cls.query_id,
            query_name=cls.query_name,
            severity=public.enums.Severity.Flow_Moderate_Severity,
            help_url=DEFAULT_HELP_URL,
            is_security=False,
            query_description=("An AfterSave record trigger is modifying the same record. "
                               "Record modifications should be done in BeforeSave triggers, "
                               "not AfterSave triggers. The trigger definition may be in a parent flow that calls "
                               "the current flow as a subflow, passing in the recordId of the trigger record.")
        )

    def when_to_run(self) -> list[QueryAction]:
        return [QueryAction.process_elem]

    def execute(self,
                state: State = None,
                crawler: AbstractCrawler = None,
                all_states=None) -> list[QueryResult] | None:

        parser = state.get_parser()

        if self.should_check:
            should_scan = parser.get_trigger_type() is TriggerType.RecordAfterSave
            self.should_check = False
            if not should_scan:
                self.should_scan = False
                self.should_check = False
                return None
            else:
                self.flow_path = state.get_parser().get_filename()
                self.source_vars = {(self.flow_path, "$Record")}
                self.should_scan = True
                self.populate_trig_object(parser)

        if not self.should_scan:
            return None

        if not self.should_scan:
            return None

        elem = state.get_current_elem()
        if parse_utils.get_tag(elem) != 'recordUpdates':
            return None

        obj_names = parse_utils.get_by_tag(elem, 'object')
        if len(obj_names) > 0:
            # if this is an input reference, the obj name is not provided
            if obj_names[0].text != self.trig_object:
                # don't bother if we are updating some other object
                return None

        elem_name = parse_utils.get_name(elem)

        # Look for filter selectors (influences *which records* are returned)
        filter_influencers = parse_utils.get_field_op_values_from_elem(elem=elem, tag='filters')
        for (fld, op, id_value) in filter_influencers:
            if fld.lower() == "id" and op.lower() == 'equalto':
                tainted_flows = state.get_flows_from_sources(influenced_var=id_value,
                                                             source_vars=self.source_vars,
                                                             restrict="Id")
                if tainted_flows is not None:
                    return self.filter_flows(tainted_flows, elem=elem, influenced="id", parser=state.get_parser())

        # Look for object selectors
        bulk_ref = parse_utils.get_by_tag(elem, 'inputReference')
        if len(bulk_ref) == 1:
            bulk_el = bulk_ref[0]
            bulk_var = bulk_el.text

            # We only care about what determines the id, not the rest of the fields
            target_var = f"{bulk_var}.Id"
            tainted_flows = state.get_flows_from_sources(influenced_var=target_var,
                                                         source_vars=self.source_vars,
                                                         restrict="Id")
            if tainted_flows is not None:
                return self.filter_flows(tainted_flows, elem=elem, influenced=elem_name, parser=parser)

        return None

    def filter_flows(self, tainted_flows: set[InfluencePath], elem: El,
                     influenced: str, parser: FlowParser) -> list[QueryResult] | None:

        if len(tainted_flows) == 0:
            return None

        else:
            elem_name = parse_utils.get_name(elem)
            elem_line_no = parse_utils.get_line_no(elem)
            qr = QueryResult(
                query_id=self.query_id,
                flow_type=parser.get_flow_type(),
                influence_statement=InfluenceStatement(
                    influenced_var=elem_name,
                    influencer_var=influenced,
                    element_name=elem_name,
                    comment="record value flows into record update",
                    flow_path=self.flow_path,
                    line_no=elem_line_no,
                    source_text=parse_utils.get_elem_string(elem),
                    source_path=self.flow_path
                ),
                paths=frozenset(tainted_flows)
            )
        return [qr]


class TriggerEntryCriteria(LexicalQuery):

    query_id = "TriggerEntryCriteria"
    query_name = QUERIES[query_id]

    @classmethod
    def get_query_description(cls) -> QueryDescription:
        return QueryDescription(
            query_id=cls.query_id,
            query_name=cls.query_name,
            severity=Severity.Flow_Moderate_Severity,
            query_description=("The record trigger flow has no entry criteria. "
                              "All record trigger flows should have entry criteria specified in the flow "
                              "trigger definition rather than solely in the flow's own business logic."),
            is_security=False
        )

    def when_to_run(self) -> list[QueryAction]:
        return [QueryAction.lexical]

    def execute(self, parser: FlowParser = None, **kwargs) -> list[QueryResult] | None:
        root = parser.get_root()
        starts = parse_utils.get_by_tag(root, tag_name='start')
        if len(starts) != 1:
            # The flow could have a startElementReference
            logger.debug(f"could not find start element in flow {parser.get_filename()}")
            return None
        start = starts[0]
        trigger_type_els = parse_utils.get_by_tag(start, tag_name='recordTriggerType')

        if len(trigger_type_els) != 1:
            return None
        else:
            filter_formula = parse_utils.get_by_tag(elem=start, tag_name='filterFormula')
            filters = parse_utils.get_by_tag(elem=start, tag_name='filters')

            if len(filters) == 0 and len(filter_formula) == 0:

                return [QueryResult(
                    query_id=self.query_id,
                    flow_type=parser.get_flow_type(),
                    elem_name='start',
                    elem_line_no=parse_utils.get_line_no(start),
                    elem_code=parse_utils.get_elem_string(start),
                    filename=parser.get_filename()
                )]
            else:
                return None


class DefaultCopy(LexicalQuery):

    query_id = "DefaultCopy"
    query_name = QUERIES[query_id]

    @classmethod
    def get_query_description(cls) -> QueryDescription:
        return QueryDescription(
            query_id=cls.query_id,
            query_name=cls.query_name,
            severity=Severity.Flow_Low_Severity,
            query_description=("An element has the auto-assigned copy name and/or label. "
                               "These names and labels should be changed to make the flow comprehensible "
                               "to maintainers."),
            is_security=False
        )

    def when_to_run(self) -> list[QueryAction]:
        return [QueryAction.lexical]

    def execute(self, parser: FlowParser = None, **kwargs) -> list[QueryResult] | None:
        els = parser.get_all_named_elems()
        if len(els) == 0:
            return None
        else:
            accum = []
            for el in els:
                name = parse_utils.get_name(el)
                if is_copy_name(name):
                    accum.append((name, name, el))
                    continue

                labels = parse_utils.get_by_tag(el, tag_name='label')
                if len(labels) > 0:
                    for label in labels:
                        label_text = label.text
                        if label_text is not None and is_copy_label(label_text):
                            accum.append((name, label_text, el))
                            break

            to_return = []
            flow_type = parser.get_flow_type()
            for (res_name, res_var, res_el) in accum:
                to_return.append(QueryResult(
                    query_id=self.query_id,
                    flow_type=flow_type,
                    elem_code=parse_utils.get_elem_string(res_el),
                    elem_name=res_name,
                    elem_line_no=parse_utils.get_line_no(res_el),
                    field=res_var,
                    filename=parser.get_filename())
                )

            return to_return

class UnusedResource(LexicalQuery):

    query_id = "UnusedResource"
    query_name = QUERIES[query_id]

    @classmethod
    def get_query_description(cls) -> QueryDescription:
        return QueryDescription(
            query_id=cls.query_id,
            query_name=cls.query_name,
            severity=Severity.Flow_Low_Severity,
            query_description=("A resource is not used elsewhere in the flow. Check that you did not "
                               "intend to use the resource and then delete it."),
            is_security=False
        )

    def when_to_run(self) -> list[QueryAction]:
        return [QueryAction.lexical]

    def execute(self, parser: FlowParser = None, **kwargs) -> list[QueryResult] | None:
        root = parser.get_root()
        filename = parser.get_filename()
        flow_type = parser.get_flow_type()

        resource_t = [] # [(name, tag, el)]
        for tag_ in RESOURCE_TAGS:
            resource_elems = root.findall(f".//{ns}{tag_}")
            for elem in resource_elems:
                resource_t.append((parse_utils.get_name(elem), tag_, elem))

        found = []
        to_match = parse_utils.get_all_flow_refs(root)
        for (name, tag, elem) in resource_t:
            for txt in to_match:
                if name in txt.split("."):
                    found.append((name, tag, elem))
                    break
        result = [x for x in resource_t if x not in found]
        if len(result) == 0:
            return None
        else:
            accum = [(x[0], x[1], parse_utils.get_elem_string(x[2]), parse_utils.get_line_no(x[2])) for x in result]
            # noinspection PyTypeChecker
            return self.report(accum=accum, filename=filename, flow_type=flow_type)


    def report(self, accum: list[tuple[str, str, str, str]], filename: str, flow_type: FlowType) -> list[QueryResult] | None:
        if len(accum) == 0:
            return None
        else:
            to_return = []
            for (name, tag, code, line) in accum:
                to_return.append(
                    QueryResult(
                        query_id=self.query_id,
                        flow_type=flow_type,
                        elem_code=code,
                        elem_name=name,
                        elem_line_no=int(line),
                        field=name,
                        filename=filename
                    )
                )

            return to_return


class MissingNextValueConnector(LexicalQuery):

    query_id = "MissingNextValueConnector"
    query_name = QUERIES[query_id]

    @classmethod
    def get_query_description(cls) -> QueryDescription:
        return QueryDescription(
            query_id=cls.query_id,
            query_name=cls.query_name,
            severity=Severity.Flow_Moderate_Severity,
            query_description=("A Loop is missing a nextValue connector. "
                               "Loops should always have nextValue connectors, "
                               "and lack of one usually signifies developer error when "
                               "connecting the loop element to other elements."),
            is_security=False
        )

    def when_to_run(self) -> list[QueryAction]:
        return [QueryAction.lexical]

    def execute(self, parser: FlowParser = None, **kwargs) -> list[QueryResult] | None:
        accum = []
        root = parser.get_root()
        flow_type = parser.get_flow_type()
        loops = parse_utils.get_by_tag(root, tag_name='loops')
        filename = parser.get_filename()

        for loop in loops:
            res = loop.findall(f".//{ns}nextValueConnector")
            if len(res) == 0:
                name = parse_utils.get_name(loop)
                accum.append(QueryResult(
                    query_id=self.query_id,
                    flow_type=flow_type,
                    elem_code=parse_utils.get_elem_string(loop),
                    elem_name=name,
                    elem_line_no=parse_utils.get_line_no(loop),
                    field=name,
                    filename=filename
                    )
                )

        if len(accum) == 0:
            return None
        else:
            return accum


class CyclicSubflow(LexicalQuery):

    query_id = "CyclicSubflow"
    query_name = QUERIES[query_id]

    @classmethod
    def accept(cls, **kwargs) -> list[QueryResult] | None:

        # matching_frame = kwargs["matching_frame"]
        # all_frames = kwargs["all_frames"]
        # flow_path = kwargs["next_flow_path"]
        current_frame = kwargs["current_frame"]

        illegal_subflow = current_frame.state.get_current_elem()
        # illegal_target_path = flow_path
        code = parse_utils.get_elem_string(illegal_subflow)
        line_no = parse_utils.get_line_no(illegal_subflow)
        elem_name = current_frame.state.get_current_elem_name()
        flow_type = current_frame.state.get_parser().get_flow_type()

        return [QueryResult(
            query_id=cls.query_id,
            flow_type=flow_type,
            elem_code=code,
            elem_name=elem_name,
            elem_line_no=line_no,
            field=elem_name,
            filename=current_frame.flow_path
            )
        ]

    @classmethod
    def get_query_description(cls) -> QueryDescription:
        return QueryDescription(
            query_id=cls.query_id,
            query_name=cls.query_name,
            severity=Severity.Flow_Moderate_Severity,
            query_description=("A subflow calls a parent flow, creating a cycle. Ensure that subflows do not call back"
                               "into a parent."),
            is_security=False
            )

    def when_to_run(self) -> list[QueryAction]:
        return [QueryAction.lexical]

    def execute(self, parser: FlowParser = None, **kwargs) -> list[QueryResult] | None:
        pass

class UnreachableElement(LexicalQuery):

    query_id = "UnreachableElement"
    query_name = QUERIES[query_id]

    @classmethod
    def get_query_description(cls) -> QueryDescription:
        return QueryDescription(
            query_id=cls.query_id,
            query_name=cls.query_name,
            severity=Severity.Flow_Moderate_Severity,
            query_description=("An element is not connected to the start element of the flow. "
                               "Unreachable elements are usually due to incomplete flows or developer error. "
                               "Connect this element to the start element or remove it from the flow.")
        )

    def when_to_run(self) -> list[QueryAction]:
        return [QueryAction.lexical]

    def execute(self, parser: FlowParser = None, **kwargs) -> list[QueryResult] | None:
        crawler = kwargs["crawler"]
        cfg = crawler.get_cfg()
        # noinspection PyTypeChecker
        all_elems = parser.get_all_traversable_flow_elements()
        all_elem_tuples = [(parse_utils.get_name(x), parse_utils.get_tag(x)) for x in all_elems]

        crawled_elems = []
        for segment in cfg.segment_map.values():
            crawled_elems = crawled_elems + segment.traversed

        # ..check there are no elements not in the cfg
        missing = [x for x in all_elem_tuples if x not in crawled_elems]

        if len(missing) == 0:
            return None

        else:
            results = []
            filename = parser.get_filename()
            flow_type = parser.get_flow_type()

            for (el_name, el_tag) in missing:
                elem = parser.get_by_name(el_name)

                if elem is None:
                    logger.error(f"Unreachable element '{el_name}' not found in flow {filename}")
                    continue

                code = parse_utils.get_elem_string(elem)
                line_no = parse_utils.get_line_no(elem)
                results.append(QueryResult(
                    query_id=self.query_id,
                    flow_type=flow_type,
                    elem_code=code,
                    elem_name=el_name,
                    elem_line_no=line_no,
                    field=el_name,
                    filename=filename
                    )
                )
            return results

class MissingDescription(LexicalQuery):

    query_id = "MissingDescription"
    query_name = QUERIES[query_id]

    @classmethod
    def get_query_description(cls) -> QueryDescription:
        return QueryDescription(
            query_id=cls.query_id,
            query_name=cls.query_name,
            severity=Severity.Flow_Low_Severity,
            query_description=("An element contains a label that is missing a description. Document all elements "
                               "with labels to make the flow comprehensible to future maintainers."),
            is_security=False
            )

    def when_to_run(self) -> list[QueryAction]:
        return [QueryAction.lexical]

    def execute(self, parser: FlowParser = None, **kwargs) -> list[QueryResult] | None:
        need_description = [el for el in list(parser.get_all_named_elems()) if
                            parse_utils.get_tag(el) != 'rules']


        accum = []
        for el in need_description:
            desc = parse_utils.get_by_tag(el,'description')
            if len(desc) == 0:
                accum.append(el)

        # the root element itself should also have a description
        flow_desc_missing = len(parse_utils.get_by_tag(parser.get_root(), 'description')) == 0

        if len(accum) == 0 and flow_desc_missing is False:
            return None
        else:
            return self.report(parser=parser, results=accum, flow_desc_missing=flow_desc_missing)

    def report(self, parser: FlowParser, results: list[El], flow_desc_missing: bool=False) -> list[QueryResult] | None:
        accum = []
        filename = parser.get_filename()
        # We don't want to print out the whole flow
        FLOW_CODE='<Flow>'
        FLOW_LINE = 2
        flow_type = parser.get_flow_type()

        if flow_desc_missing:
            accum.append(QueryResult(
                query_id=self.query_id,
                flow_type=parser.get_flow_type(),
                elem_code=FLOW_CODE,
                elem_name='Flow',
                elem_line_no=FLOW_LINE,
                field="Flow",
                filename=filename
                )
            )

        for res in results:
            name = parse_utils.get_name(res)
            accum.append(QueryResult(
                query_id=self.query_id,
                flow_type=flow_type,
                elem_code=parse_utils.get_elem_string(res),
                elem_line_no=parse_utils.get_line_no(res),
                elem_name=name,
                field = name,
                filename=filename
                )
            )
        return accum

class TriggerWaitEvent(LexicalQuery):
    """
    This will detect if a trigger flow calls a subflow that has a wait event,
    which the current flow builder does not catch.

    It is simple here because we
    follow all subflows and the life of the query instance is preserved across
    following subflows.

    This is why we need the __init__ semaphores. The same
    approach is used in other queries.
    """
    query_id = "TriggerWaitEvent"
    query_name = QUERIES[query_id]

    def __init__(self):
        self.should_scan: bool = False
        self.should_check: bool = True
        self.start_elems: list[El] | None = None

    @classmethod
    def get_query_description(cls) -> QueryDescription:
        return QueryDescription(
            query_id=cls.query_id,
            query_name=cls.query_name,
            severity=Severity.Flow_High_Severity,
            query_description=("A wait event is reached during trigger execution. The trigger may be in a parent flow "
                               "that calls the current flow as a subflow. Triggers must be performant and cannot "
                               "contain wait events. For async processing, use scheduled paths within your trigger "
                               "and async callouts, not wait events."),
            is_security=False
            )

    def when_to_run(self) -> list[QueryAction]:
        return [QueryAction.lexical]

    def execute(self, parser: FlowParser = None, **kwargs) -> list[QueryResult] | None:
        if self.should_check:
            self.should_check = False

            if parser.get_flow_type() is FlowType.Trigger:
                self.should_scan = True
            else:
                self.should_scan = False
                return None

        elif not self.should_scan:
            return None

        # We are in a new subflow, so add this start elem
        if self.start_elems is None:
            self.start_elems = []

        self.start_elems.append(parser.get_start_elem())
        waits = parse_utils.get_by_tag(parser.get_root(), 'waits')
        if len(waits) == 0:
            return None
        else:
            accum = []
            filename = parser.get_filename()
            flow_type = parser.get_flow_type()

            for wait in waits:
                name = parse_utils.get_name(wait)
                accum.append(QueryResult(
                    query_id=self.query_id,
                    flow_type=flow_type,
                    elem_code=parse_utils.get_elem_string(wait),
                    elem_name=name,
                    elem_line_no=parse_utils.get_line_no(wait),
                    field=name,
                    filename=filename
                    )
                )
            return accum

class TriggerCallout(LexicalQuery):

    query_id = "TriggerCallout"
    query_name = QUERIES[query_id]

    def __init__(self):

        self.should_scan: bool = False
        self.should_check: bool = True
        self.has_scheduled_path: bool = False
        self.top_flow_path: str | None = None
        self.start_el: El | None = None
        #: element name corresponding to direct path from start
        self.conn_target_el: El | None = None
        self.top_parser: FlowParser | None = None

    @classmethod
    def get_query_description(cls) -> QueryDescription:
        return QueryDescription(
            query_id=cls.query_id,
            query_name=cls.query_name,
            severity=Severity.Flow_Moderate_Severity,
            query_description=("A callout is performed on the synchronous path of a trigger. The trigger may be in a "
                               "parent flow. Triggers must be performant and may only contain callouts on async "
                               "scheduled paths. It is recommended that you create an async path and place "
                               "the callout there.")

        )

    def when_to_run(self) -> list[QueryAction]:
        return [QueryAction.lexical]

    def execute(self, parser: FlowParser = None, **kwargs) -> list[QueryResult] | None:
        if self.should_check:
            try:
                if parser.get_flow_type() is not FlowType.Trigger:
                    self.should_check = False
                    self.should_scan = False
                    return None
                else:
                    self.should_check = False
                    self.should_scan = True
                    self.top_flow_path = parser.get_filename()
                    self.start_el = parser.get_start_elem()
                    self.top_parser = parser
                    scheduled_paths = self.start_el.findall(f'.//{ns}scheduledPaths/{ns}connector')
                    if not scheduled_paths:
                        self.has_scheduled_path = False
                        # we look for anything connected to start as everything is on the
                        # synchronous path
                        self.conn_target_el = self.start_el
                    else:
                        self.has_scheduled_path = True
                        conn = parse_utils.get_by_tag(self.start_el, 'connector')[0]
                        conn_target = parse_utils.get_text_of_tag(conn, 'targetReference')
                        if conn is None or conn_target is None or len(conn_target) == 0:
                            self.should_scan = False
                            self.should_check = False
                            return None
                        else:
                            self.conn_target_el = parser.get_by_name(conn_target)
                            if self.conn_target_el is None:
                                logger.error(f"start element pointing to a non-existing connector "
                                             f"in flow {self.top_flow_path}")
                                self.should_scan = False
                                self.should_check = False
                                return None

            except:
                logger.debug(f"exception thrown when searching for start connector target in {self.top_flow_path}"
                             f"\n {traceback.format_exc()}")
                self.should_scan = False
                self.should_check = False
                return None


        elif not self.should_scan:
            return None

        # fall through

        # a map from actionType -> list of tuples (action_element, action_name)
        action_calls = parser.get_action_call_map()
        if not action_calls:
            return None

        callouts = dict.get(action_calls, 'externalService', None)
        if not callouts:
            return None

        accum = []
        crawler = kwargs.get("crawler")

        for callout_el, callout_name in callouts:

            res = crawler.get_call_chain(source_el=self.conn_target_el,
                                         source_path=self.top_flow_path,
                                         sink_el=callout_el,
                                         source_parser=self.top_parser)
            if not res:
                continue
            res.insert(0, (self.start_el, self.top_flow_path))

            qr = generate_query_result_from_call_chain(
                chain=res,
                flow_type=FlowType.Trigger,
                query_id=self.query_id,
            )
            accum.append(qr)

        if accum:
            return accum
        else:
            return None

def generate_query_result_from_call_chain(chain: list[tuple[El, str]],
                                          flow_type: FlowType,
                                          query_id: str,
                                          )-> QueryResult | None:


    influence_path = generate_path_from_call_chain(chain)
    assert influence_path is not None

    qr = QueryResult(
        query_id=query_id,
        flow_type=flow_type,
        paths=frozenset([influence_path])
        )

    return qr


def generate_path_from_call_chain(chain: list[tuple[El, str]]) -> InfluencePath:
    """
    Args:
        chain is the call chain (element, flow_path of element). It must start at the source
        and end at the sink, and it must be non-empty.
    """
    assert chain is not None and len(chain) > 0
    accum = []
    for index, (el, filename) in enumerate(chain):
        comment = None
        if index == 0:
            if el is not chain[1][0]:
                influencer_var = parse_utils.get_name(chain[0][0])
                comment = f"start of call chain"
            else:
                continue
        else:
            influencer_var = parse_utils.get_name(chain[index-1][0])

        influenced_var = parse_utils.get_name(el)
        assert influenced_var is not None

        if influencer_var == '*':
            influencer_var = 'start'
        if influenced_var == '*':
            influenced_var = 'start'

        if not comment:
            comment = f"{influenced_var} is in the call chain of {influencer_var}"

        code = parse_utils.get_elem_string(el)
        line_no = parse_utils.get_line_no(el)
        source_path = flow_path = filename
        element_name = influenced_var

        accum.append(InfluenceStatement(
            influenced_var=influenced_var,
            influencer_var=influencer_var,
            element_name=element_name,
            comment=comment,
            flow_path=flow_path,
            source_path=source_path,
            line_no=line_no,
            source_text=code
            )
        )
    influenced_name = accum[-1].influenced_var
    influencer_name = accum[0].influencer_var
    influenced_filepath = accum[-1].flow_path
    influencer_filepath = accum[0].flow_path

    influence_path = InfluencePath(
        influencer_name=influencer_name,
        influenced_name=influenced_name,
        influenced_filepath=influenced_filepath,
        influencer_filepath=influencer_filepath,
        influenced_type_info=None,
        influenced_property=None,
        influencer_property=None,
        history=tuple(accum)
        )
    return influence_path

def check_in_templates_or_formulas(name_to_check: str,
                                   formula_elems: list[El],
                                   template_elems: list[El]) -> bool:
    for el in formula_elems:
        if check_in_expression(el, payload_tag='expression', name_to_check=name_to_check):
            return True

    for el in template_elems:
        if check_in_expression(el, payload_tag='text', name_to_check=name_to_check):
            return True

    return False


def check_in_expression(expr: El, payload_tag: str, name_to_check: str) -> bool:
    payload_els = expr.find(payload_tag)
    if len(payload_els) != 1:
        logger.critical(f"cannot find expected tag {payload_tag} in expression {parse_utils.get_name(expr)}")
        # fail to passing the test
        return True

    payload_el = payload_els[0]
    expression = payload_el.text

    if expression is None or expression == "":
        logger.critical(f"found empty expression in {payload_tag} in expression {parse_utils.get_name(expr)}")
        return True

    vars_in_expression = parse_utils.parse_expression(expression)
    for var in vars_in_expression:
        if _is_in_splits(var=var, name_to_check=name_to_check):
            return True
    return False


def _is_in_splits(var: str, name_to_check: str) -> bool:
    splits = var.split('.')
    for split in splits:
        if name_to_check == split:
            return True
    return False


# 001cU000009Tt2MQAS
def to18(id_str) -> str | None:
    if len(id_str) == 15:
        # from stackexchange :)
        bitstring = 0
        for i in range(0, 15):
            if 'A' <= id_str[i] <= 'Z':
                bitstring |= 1 << i

        # Take three slices of the bitstring and use them as 5-bit indices into the alphanumeric sequence.
        uppers = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ012345'
        return id_str + uppers[bitstring & 0x1F] + uppers[bitstring >> 5 & 0x1F] + uppers[bitstring >> 10]
    return None


def is_valid_salesforce_id(sf_id: str) -> bool:
    """
    Checks if a string is a valid 15-character or 18-character Salesforce ID.
    """
    if bool(id_pattern.match(sf_id)):
        if len(sf_id) == 18:
            part = sf_id[:15]
            return sf_id == to18(part)
        else:
            return True

    return False


def is_copy_label(label: str) -> bool:
    return bool(copy_label_pattern.match(label))


def is_copy_name(name: str) -> bool:
    return bool(copy_name_pattern.match(name))


def flow_level_result(query_id: str, parser: FlowParser) -> QueryResult:
    """Build a single QueryResult attributed to the flow as a whole.

    Used by rules that report a property of the entire flow (e.g. its status
    or API version) rather than a specific inner element.
    """
    # We don't want to print out the whole flow, so use a placeholder (see MissingDescription).
    return QueryResult(
        query_id=query_id,
        flow_type=parser.get_flow_type(),
        elem_code='<Flow>',
        elem_name='Flow',
        elem_line_no=2,
        field="Flow",
        filename=parser.get_filename()
    )


class HardcodedUrl(LexicalQuery):

    query_id = "HardcodedUrl"
    query_name = QUERIES[query_id]

    @classmethod
    def get_query_description(cls) -> QueryDescription:
        return QueryDescription(
            query_id=cls.query_id,
            query_name=cls.query_name,
            query_description=("The flow has a hardcoded URL. Hardcoded URLs are a bad practice as they break "
                               "when moving between environments. Use a Named Credential, custom setting, or "
                               "custom label instead."),
            query_version="1.0",
            severity=Severity.Flow_Moderate_Severity,
            help_url=DEFAULT_HELP_URL,
            is_security=False
        )

    def when_to_run(self) -> list[QueryAction]:
        return [QueryAction.lexical]

    def execute(self, parser: FlowParser = None, **kwargs) -> list[QueryResult] | None:
        if parser is None:
            return None
        results = []
        root = parser.get_root()
        top_level = [x for x in root if parse_utils.get_tag(x) != "processMetadataValues"]
        for top in top_level:
            for el in top.iter(tag=f"{ns}stringValue"):
                msg = el.text
                if msg is not None and url_pattern.search(msg) is not None and (top, el) not in results:
                    results.append((top, el))
        return self.report(results, parser)

    def report(self, results: list[tuple], parser: FlowParser) -> list[QueryResult] | None:
        accum = []
        for top, el in results:
            el_name = parse_utils.get_name(top)
            if el_name is None:
                el_name = parse_utils.get_tag(top)
            accum.append(QueryResult(
                query_id=self.query_id,
                flow_type=parser.get_flow_type(),
                influence_statement=None,
                paths=None,
                elem_code=parse_utils.get_elem_string(el),
                elem_line_no=parse_utils.get_line_no(el),
                elem_name=el_name,
                filename=parser.get_filename(),
                field=None
            ))
        return accum if len(accum) > 0 else None


class GetRecordAllFields(LexicalQuery):

    query_id = "GetRecordAllFields"
    query_name = QUERIES[query_id]

    @classmethod
    def get_query_description(cls) -> QueryDescription:
        return QueryDescription(
            query_id=cls.query_id,
            query_name=cls.query_name,
            query_description=("A Get Records element retrieves all fields automatically instead of selecting "
                               "only the fields it needs. Storing all fields is inefficient. Set the element to "
                               "manually assign only the fields that are used."),
            query_version="1.0",
            severity=Severity.Flow_Low_Severity,
            help_url=DEFAULT_HELP_URL,
            is_security=False
        )

    def when_to_run(self) -> list[QueryAction]:
        return [QueryAction.lexical]

    def execute(self, parser: FlowParser = None, **kwargs) -> list[QueryResult] | None:
        root = parser.get_root()
        accum = []
        for el in parse_utils.get_by_tag(root, 'recordLookups'):
            stores_all = parse_utils.get_text_of_tag(el, 'storeOutputAutomatically') == 'true'
            has_queried_fields = len(parse_utils.get_by_tag(el, 'queriedFields')) > 0
            if stores_all and not has_queried_fields:
                accum.append(QueryResult(
                    query_id=self.query_id,
                    flow_type=parser.get_flow_type(),
                    elem_code=parse_utils.get_elem_string(el),
                    elem_line_no=parse_utils.get_line_no(el),
                    elem_name=parse_utils.get_name(el),
                    field=parse_utils.get_name(el),
                    filename=parser.get_filename()
                ))
        return accum if len(accum) > 0 else None


class ProcessBuilder(LexicalQuery):

    query_id = "ProcessBuilder"
    query_name = QUERIES[query_id]

    @classmethod
    def get_query_description(cls) -> QueryDescription:
        return QueryDescription(
            query_id=cls.query_id,
            query_name=cls.query_name,
            query_description=("The flow is a Process Builder or Workflow Rule. These automation tools are retired. "
                               "Migrate the automation to a Flow."),
            query_version="1.0",
            severity=Severity.Flow_Moderate_Severity,
            help_url=DEFAULT_HELP_URL,
            is_security=False
        )

    def when_to_run(self) -> list[QueryAction]:
        return [QueryAction.lexical]

    def execute(self, parser: FlowParser = None, **kwargs) -> list[QueryResult] | None:
        if parser.get_flow_type() in (FlowType.ProcessBuilder, FlowType.Workflow, FlowType.InvocableProcess):
            return [flow_level_result(self.query_id, parser)]
        return None


class InactiveFlow(LexicalQuery):

    query_id = "InactiveFlow"
    query_name = QUERIES[query_id]

    @classmethod
    def get_query_description(cls) -> QueryDescription:
        return QueryDescription(
            query_id=cls.query_id,
            query_name=cls.query_name,
            query_description=("The flow is not active. Inactive flows should be activated if they are needed, "
                               "or deleted if they are not, to avoid clutter and confusion."),
            query_version="1.0",
            severity=Severity.Flow_Low_Severity,
            help_url=DEFAULT_HELP_URL,
            is_security=False
        )

    def when_to_run(self) -> list[QueryAction]:
        return [QueryAction.lexical]

    def execute(self, parser: FlowParser = None, **kwargs) -> list[QueryResult] | None:
        status = parse_utils.get_text_of_tag(parser.get_root(), 'status')
        if status is not None and status != 'Active':
            return [flow_level_result(self.query_id, parser)]
        return None


class InvalidApiVersion(LexicalQuery):

    query_id = "InvalidApiVersion"
    query_name = QUERIES[query_id]

    @classmethod
    def get_query_description(cls) -> QueryDescription:
        return QueryDescription(
            query_id=cls.query_id,
            query_name=cls.query_name,
            query_description=(f"The flow has no API version or an API version below {MIN_API_VERSION:g}. "
                               "Outdated API versions can cause compatibility issues. Set the flow to a "
                               "recent API version."),
            query_version="1.0",
            severity=Severity.Flow_Low_Severity,
            help_url=DEFAULT_HELP_URL,
            is_security=False
        )

    def when_to_run(self) -> list[QueryAction]:
        return [QueryAction.lexical]

    def execute(self, parser: FlowParser = None, **kwargs) -> list[QueryResult] | None:
        api_version = parse_utils.get_text_of_tag(parser.get_root(), 'apiVersion')
        is_invalid = api_version is None
        if not is_invalid:
            try:
                is_invalid = float(api_version) < MIN_API_VERSION
            except ValueError:
                is_invalid = True
        if is_invalid:
            return [flow_level_result(self.query_id, parser)]
        return None


class MissingTriggerOrder(LexicalQuery):

    query_id = "MissingTriggerOrder"
    query_name = QUERIES[query_id]

    @classmethod
    def get_query_description(cls) -> QueryDescription:
        return QueryDescription(
            query_id=cls.query_id,
            query_name=cls.query_name,
            query_description=("A record-triggered flow does not specify a trigger order. When multiple "
                               "record-triggered flows run on the same object and event, set a trigger order "
                               "to make the execution sequence deterministic."),
            query_version="1.0",
            severity=Severity.Flow_Low_Severity,
            help_url=DEFAULT_HELP_URL,
            is_security=False
        )

    def when_to_run(self) -> list[QueryAction]:
        return [QueryAction.lexical]

    def execute(self, parser: FlowParser = None, **kwargs) -> list[QueryResult] | None:
        root = parser.get_root()
        starts = parse_utils.get_by_tag(root, tag_name='start')
        if len(starts) != 1:
            return None
        start = starts[0]
        # Only record-triggered flows have a recordTriggerType and support triggerOrder.
        if len(parse_utils.get_by_tag(start, tag_name='recordTriggerType')) != 1:
            return None
        if len(parse_utils.get_by_tag(start, tag_name='triggerOrder')) == 0:
            return [QueryResult(
                query_id=self.query_id,
                flow_type=parser.get_flow_type(),
                elem_name='start',
                elem_line_no=parse_utils.get_line_no(start),
                elem_code=parse_utils.get_elem_string(start),
                filename=parser.get_filename()
            )]
        return None
