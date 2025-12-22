import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {LogLevel, TelemetryData} from '@salesforce/code-analyzer-engine-api';
import {RuntimeSfgeWrapper, SfgeRuleInfo} from '../src/sfge-wrapper';

class FakeJavaExec {
  public async exec(_args: string[], _cp: string[], onStdOut?: (msg: string) => void): Promise<void> {
    if (onStdOut) {
      // Build a mixed message payload with LOG and PROGRESS entries
      const payload = JSON.stringify([
        { messageKey: 'debug_sfgeInfoLog', args: ['hello'], internalLog: '', messageSeverity: 'DEBUG' },
        { messageKey: 'progress_sfgeFinishedCompilingFiles', args: ['1'], internalLog: '', progressPercent: 50 }
      ]);
      onStdOut(`SFCA-REALTIME-START${payload}SFCA-REALTIME-END`);
    }
    return;
  }
}

describe('sfge-wrapper handleRunStdOut coverage', () => {
  it('processes realtime LOG and PROGRESS messages', async () => {
    const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'sfge-wrapper-'));
    const logDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'sfge-logs-'));
    const resultsFile = path.join(tmp, 'resultsFile.json');
    await fs.promises.writeFile(resultsFile, '[]', 'utf-8');

    const logs: { level: LogLevel; msg: string }[] = [];
    const telemetry: TelemetryData[] = [];
    const wrapper = new RuntimeSfgeWrapper(
      new FakeJavaExec() as any,
      { now: () => new Date(), formatToDateTimeString: () => '' } as any,
      (lvl, msg) => logs.push({ level: lvl, msg }),
      (_name, data) => telemetry.push(data)
    );

    const rules: SfgeRuleInfo[] = [{ name: 'ApexFlsViolation', description: '', category: '', severity: 3, url: '', isPilot: false }];
    const progress: number[] = [];
    const res = await wrapper.invokeRunCommand(rules, [], [], { logFolder: logDir, disableLimitReachedViolations: false, threadCount: 1, threadTimeout: 1000 }, tmp, p => progress.push(p));

    expect(Array.isArray(res)).toBe(true);
    expect(logs.find(l => l.msg.includes('hello'))).toBeTruthy();
    expect(progress.some(p => p > 10)).toBe(true); // progressed via PROGRESS message branch
  });
});


