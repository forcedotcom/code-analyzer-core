#!/bin/sh
# Fake "java" probe used by the CWE-427 regression tests. It records the working
# directory the child process was actually spawned with so the test can assert the
# spawn cwd is the trusted module directory rather than the inherited scanned-repo
# cwd. The cwd is written both to the file named by the CWD_REPORT_FILE env var (when
# it propagates) and to a report file alongside this script at a path the test can
# always resolve. It then prints a parseable `java -version` style line to STDERR and
# exits 0 so the version-probe logic under test resolves normally.
if [ -n "$CWD_REPORT_FILE" ]; then
    pwd > "$CWD_REPORT_FILE"
fi
pwd > "$(dirname "$0")/spawn-cwd-report.txt"
echo 'openjdk version "11.0.6" 2020-01-14' 1>&2
exit 0
