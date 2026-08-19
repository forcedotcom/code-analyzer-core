import path from "node:path";
import * as fsp from "node:fs/promises";
import {
    Engine,
    LogLevel,
    type DescribeOptions,
    type EngineRunResults,
    type RuleDescription,
    type RunOptions,
    type Violation,
} from "@salesforce/code-analyzer-engine-api";
import { RULES, RULE_NAMES } from "./rules";
import {
    COVERAGE_ANALYSIS_RULE,
    validateCoverageAnalysis,
} from "./validators/coverage-analysis";
import {
    INVALID_SOURCE_REFERENCES_RULE,
    validateInvalidSourceReferences,
} from "./validators/invalid-source-references";
import {
    MISSING_SOURCEMAP_RULE,
    validateMissingSourcemaps,
} from "./validators/missing-sourcemap";
import { PATH_LEAKAGE_RULE, validatePathLeakage } from "./validators/path-leakage";
import {
    SOURCE_CONTENT_VERIFICATION_RULE,
    validateSourceContent,
} from "./validators/source-content-verification";
import {
    STRUCTURAL_COHERENCE_RULE,
    validateStructuralCoherence,
} from "./validators/structural-coherence";
import {
    TOKEN_CONSISTENCY_RULE,
    validateTokenConsistency,
} from "./validators/token-consistency";
import { buildSourceIndex, type SourceIndex } from "./validators/sourcemap-io";
import type { ValidatorFinding, ValidatorResult } from "./validators/types";
import { VLQ_INTEGRITY_RULE, validateVlqIntegrity } from "./validators/vlq-integrity";
import { getMessage } from "./messages";

interface BundleTarget {
    distPath: string;
    sourcePath: string | null;
}

export class UIBundleEngine extends Engine {
    static readonly NAME = "uibundle";

    getName(): string {
        return UIBundleEngine.NAME;
    }

    async getEngineVersion(): Promise<string> {
        const pathToPackageJson: string = path.join(__dirname, '..', 'package.json');
        const packageJson: {version: string} = JSON.parse(await fsp.readFile(pathToPackageJson, 'utf-8'));
        return packageJson.version;
    }

    async describeRules(_describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        return [...RULES];
    }

    async runRules(ruleNames: string[], runOptions: RunOptions): Promise<EngineRunResults> {
        const selected: string[] = ruleNames.filter((name) => RULE_NAMES.has(name));
        if (selected.length === 0) return { violations: [] };

        const targets: BundleTarget[] = await this.findBundleTargets(runOptions);
        if (targets.length === 0) {
            this.emitLogEvent(LogLevel.Info, getMessage('NoBundleTargetsFound', UIBundleEngine.NAME));
            return { violations: [] };
        }

        const violations: Violation[] = [];
        for (const target of targets) {
            await this.runOnTarget(target, selected, violations);
        }
        return { violations };
    }

    private async runOnTarget(
        target: BundleTarget,
        selected: string[],
        violations: Violation[],
    ): Promise<void> {
        const distOnlyDispatch: [string, () => Promise<ValidatorResult>][] = [
            [MISSING_SOURCEMAP_RULE, () => validateMissingSourcemaps(target.distPath)],
            [PATH_LEAKAGE_RULE, () => validatePathLeakage(target.distPath)],
            [INVALID_SOURCE_REFERENCES_RULE, () => validateInvalidSourceReferences(target.distPath)],
            [VLQ_INTEGRITY_RULE, () => validateVlqIntegrity(target.distPath)],
            [COVERAGE_ANALYSIS_RULE, () => validateCoverageAnalysis(target.distPath)],
        ];

        for (const [ruleName, runValidator] of distOnlyDispatch) {
            if (!selected.includes(ruleName)) continue;
            const result: ValidatorResult = await runValidator();
            this.consumeResult(ruleName, target.distPath, result, violations);
        }

        const sourceDispatch: [
            string,
            (opts: {
                sourcePath: string;
                distPath: string;
                sourceIndex?: SourceIndex;
            }) => Promise<ValidatorResult>,
        ][] = [
            [SOURCE_CONTENT_VERIFICATION_RULE, validateSourceContent],
            [STRUCTURAL_COHERENCE_RULE, validateStructuralCoherence],
            [TOKEN_CONSISTENCY_RULE, validateTokenConsistency],
        ];

        const activeSourceRules = sourceDispatch.filter(([r]) => selected.includes(r));
        if (activeSourceRules.length === 0) return;

        if (!target.sourcePath) {
            for (const [ruleName] of activeSourceRules) {
                this.emitLogEvent(
                    LogLevel.Warn,
                    getMessage('SkippedNoSourceTree', UIBundleEngine.NAME, ruleName, target.distPath),
                );
            }
            return;
        }

        const sourceIndex: SourceIndex = await buildSourceIndex(target.sourcePath);

        for (const [ruleName, runValidator] of activeSourceRules) {
            const result: ValidatorResult = await runValidator({
                sourcePath: target.sourcePath,
                distPath: target.distPath,
                sourceIndex,
            });
            this.consumeResult(ruleName, target.distPath, result, violations);
        }
    }

    private consumeResult(
        ruleName: string,
        distPath: string,
        result: ValidatorResult,
        violations: Violation[],
    ): void {
        if (result.skipped) {
            this.emitLogEvent(
                LogLevel.Warn,
                getMessage('SkippedForTarget', UIBundleEngine.NAME, ruleName, distPath, result.skipped.reason),
            );
            return;
        }
        for (const finding of result.findings) {
            violations.push(toViolation(finding));
        }
    }

    private async findBundleTargets(runOptions: RunOptions): Promise<BundleTarget[]> {
        const targetedFiles: string[] = await runOptions.workspace.getTargetedFiles();

        const bundleRoots: Set<string> = new Set();
        for (const file of targetedFiles) {
            const base = path.basename(file);
            if (base === "ui-bundle.json" || base.endsWith(".uibundle-meta.xml")) {
                bundleRoots.add(path.dirname(file));
            }
        }

        for (const file of targetedFiles) {
            const dist = findAncestorNamed(file, "dist");
            if (dist) bundleRoots.add(path.dirname(dist));
        }

        const targets: BundleTarget[] = [];
        for (const bundleRoot of bundleRoots) {
            const distPath = path.join(bundleRoot, "dist");
            if (!(await isDirectory(distPath))) continue;

            const srcPath = path.join(bundleRoot, "src");
            const sourcePath = (await isDirectory(srcPath)) ? srcPath : null;

            targets.push({ distPath, sourcePath });
        }
        return targets;
    }
}

function toViolation(finding: ValidatorFinding): Violation {
    // SFCA requires 1-based line/column; validators emit 1-based coordinates.
    const startLine: number = Math.max(1, finding.startLine ?? 1);
    const rawCol: number | undefined = finding.startColumn;
    const startColumn: number = rawCol == null ? 1 : Math.max(1, rawCol);
    return {
        ruleName: finding.ruleName,
        message: finding.message,
        primaryLocationIndex: 0,
        codeLocations: [{ file: finding.file, startLine, startColumn }],
    };
}

async function isDirectory(p: string): Promise<boolean> {
    try {
        const stat = await fsp.stat(p);
        return stat.isDirectory();
    } catch {
        return false;
    }
}

function findAncestorNamed(filePath: string, name: string): string | null {
    const parts = filePath.split(path.sep);
    const lastNameSegmentIdx = parts.lastIndexOf(name);
    if (lastNameSegmentIdx <= 0) return null;
    return parts.slice(0, lastNameSegmentIdx + 1).join(path.sep);
}
