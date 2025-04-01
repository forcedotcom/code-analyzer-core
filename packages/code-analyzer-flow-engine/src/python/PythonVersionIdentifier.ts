import {SemVer, coerce} from 'semver';
import * as cp from 'node:child_process';

export interface PythonVersionIdentifier {
    identifyPythonVersion(pythonCommand: string): Promise<SemVer|null>;
}

export class RuntimePythonVersionIdentifier implements PythonVersionIdentifier{
    /**
     * Resolves to a {@link SemVer} representing the version of the Python instance invoked by the provided
     * command
     * @param pythonCommand
     */
    public async identifyPythonVersion(pythonCommand: string): Promise<SemVer|null> {
        return new Promise<SemVer|null>((res, rej) => {
            // Python's version flag is `--version`.
            const child = cp.spawn(pythonCommand, ['--version']);

            let stdout: string = '';
            let stderr: string = '';

            child.stdout.on('data', data => {
                stdout += data;
            });
            /* istanbul ignore next */
            child.stderr.on('data', data => {
                stderr += data;
            });
            child.on('exit', code => {
                /* istanbul ignore else */
                if (code === 0) {
                    // The version will be output in the form of something like "Python 3.12.4", which can be coerced to
                    // a SemVer directly, with the result being null if the coercion fails.
                    res(coerce(stdout));
                } else {
                    // A non-0 exit code indicates a failure. So just reject with whatever `stderr` was.
                    rej(stderr);
                }
            });
            // This handler is for when the process can't be spawned (e.g., if the command doesn't exist on the machine).
            child.on('error', err => {
                // Reject with whatever the error message was.
                // istanbul ignore next: Difficult to create automated test
                rej(err.message);
            });
        });
    }
}