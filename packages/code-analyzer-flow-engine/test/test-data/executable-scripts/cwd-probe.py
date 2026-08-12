import json
import os
import sys


# Emit the working directory and the first entry of the module search path so
# that tests can assert where a spawned python process would resolve modules
# from. This is used to prove that a spawned scanner process cannot be tricked
# into resolving modules from an untrusted, scanned workspace directory.
print(json.dumps({'cwd': os.getcwd(), 'syspath0': sys.path[0]}))
