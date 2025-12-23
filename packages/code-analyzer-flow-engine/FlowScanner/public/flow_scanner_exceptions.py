"""Exception classes for flow scanner errors."""


class FlowScannerException(Exception):
    """Base class for all exceptions raised by Flow Scanner.

    All custom exceptions in the flow scanner inherit from this class.
    """

    def __init__(self, *args):
        """Initialize the exception.

        Args:
            *args: Exception message arguments.
        """
        super().__init__(*args)


class InvalidFlowException(FlowScannerException):
    """Raised when there is something wrong with a flow file.

    This exception is raised for issues such as invalid XML, invalid filename,
    missing structure, or other flow file problems.

    Attributes:
        flow_path: Path to the flow file that caused the error.
    """

    def __init__(self, *args, **kwargs):
        """Initialize the exception.

        Args:
            *args: Exception message arguments.
            **kwargs: Keyword arguments, may include 'flow_path'.
        """
        super().__init__(*args)
        self.flow_path = kwargs.get('flow_path')

    def __str__(self) -> str:
        """Get string representation of the exception.

        Returns:
            Exception message with flow path appended.
        """
        return f"{super().__str__()} flow path: {self.flow_path}"


