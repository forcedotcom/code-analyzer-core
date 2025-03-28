
class FlowtestException(Exception):
    """base class for all exceptions raised by Flowtest"""
    def __init__(self, *args):
        super().__init__(*args)


class InvalidFlowException(FlowtestException):
    """Raised when there is something wrong with the flow file,
    such as invalid xml, invalid filename, missing structure, etc."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args)
        self.flow_path = kwargs.get('flow_path')

    def __str__(self):
        return f"{super().__str__()} flow path: {self.flow_path}"


