import {coerce, SemVer} from "semver";
import cp from "node:child_process";

export interface JavaVersionIdentifier {
    identifyJavaVersion(javaCommand: string): Promise<SemVer|null>;
}

export class RuntimeJavaVersionIdentifier implements JavaVersionIdentifier {
    private readonly cache: Map<string, SemVer|null> = new Map();

    identifyJavaVersion(javaCommand: string): Promise<SemVer|null> {
        if (this.cache.has(javaCommand)) {
            return Promise.resolve(this.cache.get(javaCommand)!);
        }

        return new Promise<SemVer|null>((resolve, reject) => {
            // We are using "java -version" which has output that typically looks like:
            // * (from MacOS): "openjdk version "11.0.6" 2020-01-14 LTS\nOpenJDK Runtime Environment Zulu11.37+17-CA (build 11.0.6+10-LTS)\nOpenJDK 64-Bit Server VM Zulu11.37+17-CA (build 11.0.6+10-LTS, mixed mode)\n"
            // From much research this output typically has the word "version " and then either a number with or without quotes.
            // If instead we used java --version then the output would look something like:
            // * (from Win10): "openjdk 14 2020-03-17\r\nOpenJDK Runtime Environment (build 14+36-1461)\r\nOpenJDK 64-Bit Server VM (build 14+36-1461, mixed mode, sharing)\r\n"
            // Notice it doesn't have the word "version" which is why we don't call "--version" but instead call "-version".
            //
            // Pin cwd to this engine's install dir (__dirname), not the inherited scanned-repo cwd, so a
            // repo-local java.exe can't shadow the real one on Windows (CWE-427). Absolute/PATH commands unaffected.
            // Shared by the PMD and CPD sub-engines, so this single pin covers both.
            const childProcess: cp.ChildProcessWithoutNullStreams = cp.spawn(javaCommand, ['-version'], {cwd: __dirname});

            let stderr: string = '';
            childProcess.stderr.on('data', (data: Buffer) => {
                stderr += data.toString();
            });
            childProcess.on('exit', (code: number) => {
                /* istanbul ignore else */
                if (code === 0) {
                    // Oddly enough the -version command is documented to go to stderr and not stdout
                    const version: SemVer|null = _extractJavaVersionFrom(stderr);
                    this.cache.set(javaCommand, version);
                    resolve(version);
                } else {
                    // A non-0 exit code indicates a failure. So just reject with whatever `stderr` was.
                    reject(stderr);
                }
            });
            childProcess.on('error', (err: Error) => {
                reject(err.message);
            });
        });
    }
}

export function _extractJavaVersionFrom(javaVersionOutput: string): SemVer|null {
    // First we'll see if the word "version" exists with the version number and use that first.
    const matchedParts: RegExpMatchArray | null = javaVersionOutput.match(/version\s+"?(\d+(\.\d+)*)"?/i);
    const versionString: string | undefined = matchedParts?.[1];
    if (versionString) {
        return coerce(versionString);
    }
    // Otherwise we'll try to get the version number the crude way by just looking for the first number (which is what coerce does)
    return coerce(javaVersionOutput);
}