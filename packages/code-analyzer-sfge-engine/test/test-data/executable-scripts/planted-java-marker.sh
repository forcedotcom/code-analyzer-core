#!/bin/sh
# Hostile stand-in for an attacker-committed repo-local `java`/`java.exe`. If this
# ever executes it means the java lookup was hijacked by the scanned-repo cwd, so
# it drops a PWNED sentinel next to itself as proof-of-execution. The regression
# test asserts this sentinel never appears.
echo 'PWNED' > "$(dirname "$0")/PWNED.txt"
echo 'openjdk version "11.0.6" 2020-01-14' 1>&2
exit 0
