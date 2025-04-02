"""Public Enum types

"""
from enum import Enum


class FlowType(Enum):
    Screen = 0
    AutoLaunched = 1
    RecordTrigger = 2
    Scheduled = 3
    ProcessBuilder = 4
    Workflow = 5
    InvocableProcess = 6


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
    Other = 3  # everything else (including noMoreValue connectors)


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

    # A reference to a named Flow Element that is not a subflow or loop or collection ref.
    ElementReference = 5

    # A constant
    Constant = 6

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
