# Flow Expression Parsing

This directory contains code to parse flows. 

`expression_parser.py` handles expressions (as well as templates)
in order to extract relevant variable names for dataflow analysis.

For example, if an expression named `myExpression` is defined as

```IF(varA, varB, varC)```

Then this should give rise to two dataflows

```myExpression <-- varB, myExpression <-- varC``` 

Which are passed into the formula map, but we should skip varA, which is control influencing but not data influencing.



