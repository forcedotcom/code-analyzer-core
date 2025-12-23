"""Lightweight expression parser to extract data influencing variables from flow expressions.

This module provides functions for parsing Salesforce Flow expressions and formulas,
extracting variable references and determining data flow dependencies.

@author: rsussland@salesforce.com
"""

from __future__ import annotations

import re
import traceback
from dataclasses import dataclass
import logging
import flow_scanner.util as util

logger: logging.Logger = logging.getLogger(__name__)

EMERGENCY_BREAK = 1000
double_re = re.compile(r'"[^"]*"')
single_re = re.compile(r'\'[^\']*\'')
#: regular expression to extract variables from formulas and templates
reg = re.compile(r"""\{!([^}]*)""")
func_name = re.compile(r'[A-Z2]*$')  # 'ATAN2' has a number

ALWAYS_SKIP = ["ACOS", "ADDMONTHS", "AND", "ASCII", "ASIN", "ATAN", "ATAN2", "BEGINS", "CHR",
               "CONTAINS", "COS", "CURRENCYRATE", "DATE", "DAY", "DAYOFYEAR", "DISTANCE",
               "EXP", "FIND", "FORMATDURATION", "FROMUNIXTIME", "GEOLOCATION",
               "INCLUDES", "ISBLANK", "ISCHANGED", "ISNULL", "ISNUMBER",
               "ISOWEEK", "ISOYEAR", "ISPICKVAL", "LEN", "LN", "LOG", "MONTH", "NOT",
               "OR", "PICKLISTCOUNT", "SIN", "SQRT", "TAN", "WEEKDAY", "YEAR"]

ALWAYS_PROPAGATE = ["ABS", "CASESAFEID", "CEILING", "DATETIMEVALUE",
                    "DATEVALUE", "FLOOR", "HTMLENCODE", "HYPERLINK", "INITCAP",
                    "JSENCODE", "JSINHTMLENCODE", "LOWER", "MAX",
                    "MCEILING", "MFLOOR", "MIN", "NULLVALUE", "PREDICT", "PRIORVALUE", "REGEX",
                    "REVERSE", "TEXT", "TRIM",
                    "UNIXTIMESTAMP", "UPPER", "URLENCODE", "VALUE"]


def _has_skips(function_name: str) -> bool:
    """Determine whether this is a supported function that may skip propagation.

    Args:
        function_name: Name of the function to check.

    Returns:
        True if the function is supported and may skip propagation.
    """
    msg = function_name.upper()

    if msg in ALWAYS_PROPAGATE:
        return False
    if msg in ALWAYS_SKIP:
        return True
    elif msg in ["BLANKVALUE", "CASE", "IF", "LEFT", "LPAD", "MOD", "RIGHT",
                 "ROUND", "RPAD", "SUBSTITUTE", "TRUNC", "LINKTO", "URLFOR"]:
        return True
    else:
        # don't skip unknown function arguments
        return False


def _should_propagate_by_arg(function_name: str | None, arg_num: int, last_arg: bool = False) -> bool:
    """Determine transfer policy for arguments passed to functions.

    Args:
        function_name: Name of function (must be uppercase).
        arg_num: Position of argument (starting at 1).
        last_arg: True if this is the last argument.

    Returns:
        True if argument is propagated, False otherwise.
        Note that for unrecognized functions we default to True.
    """
    # TODO: should we be stricter and raise an argument error if too many arguments are passed?
    if function_name is None:
        return True

    if function_name in ALWAYS_PROPAGATE:
        return True

    if function_name in ALWAYS_SKIP:
        return False

    if function_name == "BLANKVALUE":
        return arg_num > 1

    if function_name == "CASE":
        # CASE(S,S,P,S,P,....,P)
        # must have at least 1 CASE
        if arg_num == 1:
            return False
        if last_arg:
            return True
        if arg_num % 2 == 0:
            return False
        return True

    if function_name == "IF":
        return arg_num > 1

    if function_name in ["LEFT", "MID", "MOD", "RIGHT", "ROUND", "TRUNC"]:
        return arg_num == 1

    if function_name in ["LPAD", "RPAD", "SUBSTITUTE"]:
        return arg_num == 1 or arg_num == 3

    if function_name == "URLFOR":
        # only id and inputs
        return arg_num == 2 or arg_num == 3

    if function_name == "LINKTO":
        # only the id and inputs are propagated
        return arg_num == 3 or arg_num == 4

    logger.info("unrecognized function: %s  defaulting to propagate" % function_name)
    return True


# parse_utils.parse_expression(txt)
def _strip_quoted(msg: str) -> str:
    """Replace quoted values with empty strings.

    Args:
        msg: String to be processed.

    Returns:
        Message where all quoted strings are replaced with empty strings.
    """
    no_doubles = re.sub(double_re, '""', msg)
    return re.sub(single_re, '\'\'', no_doubles)


def _strip_whitespace(msg: str) -> str:
    """Remove all whitespace from a string.

    Args:
        msg: String to process.

    Returns:
        String with all whitespace removed.
    """
    return re.sub(r'\s+', '', msg)


def extract_expression(txt: str) -> list[str]:
    """Extract variable references from an expression using regex.

    Args:
        txt: Expression in which merge-fields may be present.

    Returns:
        List of elementRef names (empty list if no matches).
    """
    accum = []
    res = re.finditer(reg, txt)
    for x in res:
        accum.append(txt[x.span()[0] + 2:x.span()[1]])

    # dedup
    return list(set(accum))


def parse_expression(expression: str) -> list[str]:
    """Main entry point for parsing expressions.

    Do not use this on templates in which expressions are mixed with text or HTML.

    Args:
        expression: Expression to be evaluated.

    Returns:
        List of variables that data influence the expression.
    """
    # TODO: might as well extract variables directly here and save the grep
    try:
        return process_expression(expression)
    except:
        logger.critical(f"error parsing expression:\n{expression}\n\n{traceback.format_exc()}"
                        f"\n\nfalling back to simple extractor")
        return extract_expression(expression)


def process_expression(expression: str) -> list[str]:
    """Process expression to return list of data influencing variables.

    Args:
        expression: Expression to be processed.

    Returns:
        List of variable names that data influence the expression.
    """
    expr = _strip_whitespace(expression)
    # Handle degenerate cases
    if len(expr) < 4:
        # shortest variable would be "{!a}"
        return []

    if "(" not in expr:
        # no need to parse if there are no functions
        return extract_expression(expr)

    # main processing

    worklist = []
    current_ctx = Context(expression=expr, length=len(expr), current_argument_text_array=[])
    emergency = 0
    while True and emergency < EMERGENCY_BREAK:
        emergency += 1
        new_ctx = _parse_function(current_ctx)
        if new_ctx is None and len(worklist) == 0:
            break
        elif new_ctx is None and len(worklist) > 0:
            # function has completed processing
            current_ctx = _update_parent_context(parent_ctx=worklist.pop(), child_ctx=current_ctx)
        else:
            worklist.append(current_ctx)
            current_ctx = new_ctx
    if emergency == 1000:
        raise RuntimeError("Emergency condition detected in parsing the expression %s" % expression)

    # python has function scoping so current_ctx is the last variable in the while loop
    return _extract_results_from_context(current_ctx)


def _extract_results_from_context(context: Context) -> list[str]:
    """Extract list of variable names from context.

    Args:
        context: Parsing context containing processed arguments.

    Returns:
        List of variable names (de-duplicated).
    """
    res_list = util.safe_list_add(context.prev_arguments_text_array,
                                  context.current_argument_text_array)

    accum = []
    for x in res_list:
        accum = util.safe_list_add(accum, extract_expression(x))

    return list(set(accum))


def _update_parent_context(parent_ctx: Context, child_ctx: Context) -> Context:
    """Update the parent context after child context has finished processing.

    Args:
        parent_ctx: Parent context to update.
        child_ctx: Child context that has finished processing.

    Returns:
        Updated parent context.
    """
    # Add the processed segments to the parent
    parent_ctx.current_argument_text_array = util.safe_list_add(
        parent_ctx.current_argument_text_array,
        child_ctx.prev_arguments_text_array
    )
    if child_ctx.current_position + 1 == len(child_ctx.expression):
        # The child is at the end, so we are done processing
        # update parent position to child's.
        parent_ctx.current_position = child_ctx.current_position
    else:
        # update the parent's current position to that of the segment + 1
        parent_ctx.current_position = child_ctx.current_position + 1

    # update start of parent context processing
    parent_ctx.start_of_current_argument_processing = parent_ctx.current_position

    return parent_ctx


def _parse_function(ctx: Context) -> Context | None:
    """Parse a function call within an expression.

    Enter this function after the first parenthesis
    and call with function name and skip policy in context.

    Args:
        ctx: Function parsing context.

    Returns:
        None if the entire function has completed processing,
        or a new context if processing was interrupted with a function call
        in which case it resumes in current position.
    """
    if ctx.current_position + 1 == len(ctx.expression):
        # we are done processing, so collect arguments
        # TODO: check for boundary conditions
        ctx.prev_arguments_text_array = util.safe_list_add(
            ctx.prev_arguments_text_array,
            ctx.current_argument_text_array
        )
        ctx.current_argument_text_array = None
        return None

    to_process = ctx.expression[ctx.current_position:]
    empty_call = False
    to_process_len = len(to_process)
    is_last = False

    for i, x in enumerate(to_process):

        if to_process_len - 1 == i:
            is_last = True

        if i > 0:
            ctx.current_position += 1

        if empty_call:
            # We're in a FOO() situation and want to skip over it
            empty_call = False
            continue

        if x == "(" or x == "[":
            # First check it's not an empty function FOO()
            if not is_last:
                if to_process[i + 1] == ")":
                    empty_call = True
                    continue
                # enter new function, while pausing argument processing
                return _handle_open_paren(ctx, is_bracket=(x == "["))
            else:
                # This is the last character,
                # so might as well wrap up this argument and the function
                _handle_argument_end(ctx, is_comma=False)
                return None
        elif x == ")" or x == "]":
            # end of argument and function exit
            # first handle the last argument
            _handle_argument_end(ctx, is_comma=False)
            # function return
            return None

        elif x == ",":
            # end of argument
            _handle_argument_end(ctx, is_comma=True)
            # check if we are at the end
            if is_last:
                # do not begin processing another argument
                # as we are done and therefore must not have
                # been in a function
                return None
            else:
                # we have another argument to process
                ctx.current_argument_no += 1
                continue
        else:
            # regular character
            if is_last:
                # we are done processing
                _handle_argument_end(ctx, is_comma=False)
                return None
            else:
                continue
    return None

    # we've finished processing this function


def _handle_argument_end(ctx: Context, is_comma=True) -> Context:
    """Decide whether to flush or add to processed buffers the current argument.

    Args:
        ctx: Current parsing context.
        is_comma: True if comma separator, False if closing parenthesis.

    Returns:
        Updated context.
    """
    # dispose of last argument
    should_propagate = ctx.function_propagate_policy
    if should_propagate is None:
        # no global policy, so look for this specific argument
        should_propagate = _should_propagate_by_arg(ctx.current_function_name,
                                                    ctx.current_argument_no,
                                                    last_arg=(not is_comma))

    if should_propagate:
        # add existing text array to processed buffer
        ctx.prev_arguments_text_array = util.safe_list_add(
            ctx.current_argument_text_array,
            ctx.prev_arguments_text_array)
        ctx.prev_arguments_text_array = util.safe_list_add(
            ctx.prev_arguments_text_array,
            [ctx.expression[ctx.start_of_current_argument_processing:ctx.current_position]]
        )

    # Now flush current processing buffer
    ctx.current_argument_text_array = None

    # update current processing marker
    ctx.start_of_current_argument_processing = ctx.current_position + 1

    return ctx


def _handle_open_paren(ctx: Context, is_bracket=False) -> Context:
    """Handle an open parenthesis in the expression.

    When encountering an open parenthesis, we halt current
    argument processing up to the function name start, if any.

    Args:
        ctx: Context of current function with index at open paren.
        is_bracket: True if this is a bracket pseudo-function so
                    that we don't search for a function identifier to
                    precede it.

    Returns:
        New context to process the nested function.

    .. warning:: Make sure we are not at the end of the expression.
    """
    # current position is a (
    segment = ctx.expression[ctx.start_of_current_argument_processing: ctx.current_position]

    if is_bracket:
        func_name_ = ''
    else:
        func_name_ = _get_function_name(segment)

    policy = None
    if func_name_ == '':
        # it's a parenthesis function
        new_func = None
    else:
        new_func = func_name_.upper()

        if new_func in ALWAYS_SKIP:
            policy = False
        elif new_func in ALWAYS_PROPAGATE:
            policy = True

    # we pause current argument processing
    ctx.current_argument_text_array = util.safe_list_add(ctx.current_argument_text_array, [segment])
    ctx.start_of_current_argument_processing = ctx.current_position

    # now create new context
    ctx2 = Context(expression=ctx.expression,
                   length=ctx.length,
                   current_position=ctx.current_position + 1,
                   start_of_current_argument_processing=ctx.current_position + 1,
                   current_function_name=new_func,
                   function_propagate_policy=policy)
    return ctx2


def _get_function_name(msg: str) -> str:
    """Extract function name from a string.

    Assumes the string terminates with a '(' but the '(' is not
    passed into the msg.

    Args:
        msg: String containing function name (without the opening parenthesis).

    Returns:
        Name of the function.
    """
    res = re.findall(func_name, msg)
    assert len(res) >= 1
    return res[0]


@dataclass(init=True, kw_only=True)
class Context:
    """Context for parsing expressions with nested function calls.

    This dataclass tracks the state of expression parsing, including
    current position, function names, and argument processing.

    Attributes:
        expression: The master expression we are working with.
        length: Total length of this expression.
        current_position: Current position in the expression.
        start_of_current_argument_processing: Where in the expression the first
            character (after previous comma) appears OR where we resumed
            processing for in the current argument.
        current_argument_text_array: Text of current argument (only append string
            when receiving values from function call return).
        current_function_name: Name of current function being parsed (None if
            just in a parenthesis or unknown function context).
        function_propagate_policy: Whether it is known that all arguments do or
            do not propagate. If unknown, set to None.
        current_argument_no: Which argument we are on, starting at 1.
        is_last_argument: Whether this is the last argument (only relevant for
            case statement).
        prev_arguments_text_array: Already pruned text from previous arguments
            (or None).
    """
    # The expression is the master expression we are working with
    expression: str

    # total length of this expression
    length: int

    # position in the expression
    current_position: int = 0

    # Where in the expression the first character (after previous comma)
    # appears OR where we resumed processing for in the current argument
    start_of_current_argument_processing: int = 0

    # text of current argument
    # only append string when receiving values from function call return
    current_argument_text_array: list[str] | None = None

    # If left None, we are just in a parenthesis or unknown function context
    current_function_name: str | None = None

    # whether it is known that all arguments do or do not propagate.
    # If unknown, set to None
    function_propagate_policy: bool | None = None

    # Which argument we are on, starting at 1
    current_argument_no: int = 1

    # only relevant for case statement
    is_last_argument: bool = False

    # Already pruned text from previous arguments (or None)
    prev_arguments_text_array: list[str] | None = None


if __name__ == '__main__':
    print("unit tests in the tests/ directory")
