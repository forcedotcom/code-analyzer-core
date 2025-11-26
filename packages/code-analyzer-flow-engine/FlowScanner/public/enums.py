"""Public Enum types

"""
from enum import Enum, EnumMeta

class MetaEnum(EnumMeta):
    def __contains__(cls, item):
        if isinstance(item, str):
            try:
                cls(item.lower())
            except ValueError:
                return False
            return True
        return super.__contains__(cls, item)

class BaseEnum(Enum, metaclass=MetaEnum):
    pass

class TransformType(BaseEnum):
    Map = "map"
    InnerJoin = "innerjoin"
    Sum = "sum"
    Count = "count"

class ComplexValueType(BaseEnum):
    """Class the identifies JSON structure schema of complexValue

    """
    """
        "resourceTemplate": text_template (with merge-fields)
    """
    ResourceDescriptor = "resourcedescriptor"

    """
        "name": "myAccVar.Name",
        "resourceType": "SObjectField",
        "resourceName": "Account",
        "resourceField": "Name",
        "collection": false
    """
    ResourceAnnotationMap = "resourceannotationmap"

    """
        "dataType": "SObject",
        "objectType": "MyObj__c",
        "fieldReferences": ["FieldA__c", "FieldB__c"],
        "elementReference": "Get_Override_Time_Entries"
    """
    FieldReference = "fieldreference"

    """
        "dataType": "SObject",
        "objectType": "MyObj__c",
        "fieldReferences": ["FieldA__c", "FieldB__c"],
        "elementReference": "Get_Override_Time_Entries"
    """
    ComplexObjectFieldDetails = "complexobjectfielddetails"

    """
        "leftElementReference":"ContentVersions",
        "leftJoinKeys":["Id"],
        "leftSelectedFields":["ContentDocumentId"],
        "rightElementReference":"Deserialize_File_Upload.fileUpload.files",
        "rightJoinKeys":["contentVersionId"],
        "rightSelectedFields":["name"]
    """
    JoinDefinition = "joindefinition"

class FlowType(Enum):

    Screen = 0
    AutoLaunched = 1
    Trigger = 2
    ProcessBuilder = 4
    Workflow = 5
    InvocableProcess = 6
    Orchestrator = 8
    Unknown = 10

class TriggerType(Enum):
    RecordAfterSave = 1
    Capability = 2
    Scheduled = 3
    RecordBeforeSave = 4
    RecordBeforeDelete = 5
    PlatformEvent = 6
    Segment = 7
    NotTrigger = 9
    Unknown = 10


class FlowValue(Enum):
    ElementReference = 0
    Literal = 1


class RunMode(Enum):
    SystemModeWithoutSharing = 0
    SystemModeWithSharing = 1
    DefaultMode = 2


class DataType(Enum):
    StringValue = 1
    Object = 2
    Literal = 3


class ConnType(Enum):
    Loop = 1  # only for nextValue connectors (for loop unrolling)
    Goto = 2  # all connectors labelled goto
    Exception = 3 # Fault and Timeout connectors
    TriggeredAction = 4 # event to trigger action
    ScreenLoadAction = 5 # action when screen is loaded
    Other = 10  # everything else (including noMoreValue connectors)

class QueryAction(Enum):

    lexical = 0  # can only access parser
    flow_enter = 20 # can access CFG, crawl schedule
    process_elem = 10 # called on each flow element
    scan_exit = 30 # called when flow crawl complete

class ReferenceType(Enum):
    # this is a variable holding the value
    Direct = 0

    # This is a formula or template field pointing to other fields
    Formula = 1

    # A loop element or collection representative element pointing to a collection
    CollectionReference = 2

    # A reference to a variable passed in from a subflow, so foo.var refers to var in subflow.
    SubflowReference = 3

    # A reference to a variable passed in from an action call, so foo.var refers to var in apex.
    ActionCallReference = 4

    # A reference to a named Flow Element holding a value
    # that is not a subflow or loop or collection ref.
    ElementReference = 5

    # A reference to an element that does not itself hold
    # a value but may be needed for reporting and tracking.
    NodeReference = 6

    # A constant
    Constant = 10

    # Global
    Global = 7


class Severity(Enum):
    """
    All queries must be labelled with a severity field. In the report, they will
    be sorted by severity and the severity will be displayed. The severity is per
    Query, not per result, so if your code contains branching logic in which one
    result is considered more severe, consider defining multiple queries and explaining
    the reason for the difference in severity. An example of explaining
    the reason for severity can be found in the class definition below:

    """

    # Something that might be useful for a developer to know but which is not
    # considered to be a vulnerability, or is highly unlikely to be a vulnerability
    # due to high false positive rates.
    Flow_Informational = 0

    # Issues that are not usually serious but are violations of policy.
    # for example, a system mode with sharing read of data without
    # the data being returned to the user.
    Flow_Low_Severity = 10

    # For example, a system mode without sharing read of data that is returned to the
    # user. Or a system mode with sharing modification of a field without checking FLS
    # permissions.
    Flow_Moderate_Severity = 20

    # For example, a system mode without sharing modification of data
    Flow_High_Severity = 30

    def __str__(self):
        return str(self.name)
