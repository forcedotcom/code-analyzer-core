import {
    DescribeOptions,
    Engine,
    EngineRunResults,
    LogLevel,
    RuleDescription,
    RunOptions,
    Violation,
} from "@salesforce/code-analyzer-engine-api";
import * as fsp from "node:fs/promises";
import path from "node:path";
import { buildRuleCatalog } from "./rules";
import { isLwcBundleFile, bundleIdentity } from "./bundle";
import { compileAndCollect } from "./compile";
import { toViolation } from "./translate";
import { getMessage } from "./messages";

export class LwcEngine extends Engine {
    static readonly NAME = "lwc";

    getName(): string {
        return LwcEngine.NAME;
    }

    async getEngineVersion(): Promise<string> {
        const pathToPackageJson = path.join(__dirname, "..", "package.json");
        const packageJson: { version: string } = JSON.parse(await fsp.readFile(pathToPackageJson, "utf-8"));
        return packageJson.version;
    }

    async describeRules(opts: DescribeOptions): Promise<RuleDescription[]> {
        this.emitDescribeRulesProgressEvent(0);

        if (opts.workspace) {
            const targetedFiles = await opts.workspace.getTargetedFiles();
            const hasLwcFiles = targetedFiles.some(isLwcBundleFile);
            if (!hasLwcFiles) {
                this.emitDescribeRulesProgressEvent(100);
                return [];
            }
        }

        const rules = await buildRuleCatalog(
            (msg: string) => this.emitLogEvent(LogLevel.Debug, msg));
        this.emitDescribeRulesProgressEvent(100);
        return rules;
    }

    async runRules(ruleNames: string[], opts: RunOptions): Promise<EngineRunResults> {
        this.emitRunRulesProgressEvent(0);

        const selected = new Set(ruleNames);
        const violations: Violation[] = [];
        const targetedFiles = await opts.workspace.getTargetedFiles();
        const lwcFiles = targetedFiles.filter(isLwcBundleFile);

        if (lwcFiles.length === 0) {
            this.emitRunRulesProgressEvent(100);
            return { violations: [] };
        }

        const step = 100 / lwcFiles.length;
        let progress = 0;

        for (const file of lwcFiles) {
            try {
                const diagnostics = await compileAndCollect(file, bundleIdentity(file),
                    (msg: string) => this.emitLogEvent(LogLevel.Debug, msg));
                for (const d of diagnostics) {
                    const ruleName = `LWC${d.code}`;
                    if (selected.size > 0 && !selected.has(ruleName)) continue;
                    violations.push(toViolation(d, file));
                }
            } catch (e) {
                this.emitLogEvent(
                    LogLevel.Warn,
                    getMessage("UnexpectedThrowDuringCompile", file, (e as Error).message)
                );
            }
            progress += step;
            this.emitRunRulesProgressEvent(progress);
        }

        this.emitRunRulesProgressEvent(100);
        return { violations };
    }
}
