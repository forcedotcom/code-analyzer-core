import {
    COMMON_TAGS,
    DescribeOptions,
    Engine,
    EngineRunResults,
    EventType,
    LogEvent,
    LogLevel,
    RuleDescription,
    RunOptions,
    SeverityLevel,
    Violation,
    Workspace
} from "@salesforce/code-analyzer-engine-api";
import {
    RetireJsExecutor,
    AdvancedRetireJsExecutor,
    EmitLogEventFcn,
    JS_EXTENSIONS,
    ZIPPED_FILE_MARKER
} from "./executor";
import {Finding, Vulnerability} from "retire/lib/types";
import {getMessage} from "./messages";
import path from "node:path";
import * as fs from 'node:fs/promises';

// To speed up execution, we will only target files with extension among EXTENSIONS_TO_TARGET
// that don't live under one of the FOLDERS_TO_SKIP
const EXTENSIONS_TO_TARGET = [...JS_EXTENSIONS, '.resource', '.zip'];
const FOLDERS_TO_SKIP = ['node_modules', 'bower_components'];

enum RetireJsSeverity {
    Critical = 'critical',
    High = 'high',
    Medium = 'medium',
    Low = 'low'
}

const SeverityMap: Map<RetireJsSeverity, SeverityLevel> = new Map([
    [RetireJsSeverity.Critical, SeverityLevel.Critical],
    [RetireJsSeverity.High, SeverityLevel.High],
    [RetireJsSeverity.Medium, SeverityLevel.Moderate],
    [RetireJsSeverity.Low, SeverityLevel.Low]
]);

export class RetireJsEngine extends Engine {
    static readonly NAME = "retire-js";
    private readonly retireJsExecutor: RetireJsExecutor;
    private relevantFilesCache: Map<string, string[]> = new Map();

    constructor(retireJsExecutor?: RetireJsExecutor) {
        super();
        const emitLogEventFcn: EmitLogEventFcn = (logLevel: LogLevel, msg: string) => this.emitEvent<LogEvent>(
            {type: EventType.LogEvent, logLevel: logLevel, message: msg});
        this.retireJsExecutor = retireJsExecutor ? retireJsExecutor : new AdvancedRetireJsExecutor(emitLogEventFcn);
    }

    getName(): string {
        return RetireJsEngine.NAME;
    }

    public async getEngineVersion(): Promise<string> {
        const pathToPackageJson: string = path.join(__dirname, '..', 'package.json');
        const packageJson: {version: string} = JSON.parse(await fs.readFile(pathToPackageJson, 'utf-8'));
        return packageJson.version;
    }

    async describeRules(describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        if (describeOptions.workspace && (await this.getRelevantFiles(describeOptions.workspace)).length === 0) {
            return [];
        }
        return Object.values(RetireJsSeverity).map(createRuleDescription);
    }

    async runRules(ruleNames: string[], runOptions: RunOptions): Promise<EngineRunResults> {
        const targetFiles: string[] = await this.getRelevantFiles(runOptions.workspace);
        const findings: Finding[] = await this.retireJsExecutor.execute(targetFiles, runOptions.workingDirectory);
        return {
            violations: toViolations(findings).filter(v => ruleNames.includes(v.ruleName))
        };
    }

    private async getRelevantFiles(workspace: Workspace): Promise<string[]> {
        const cacheKey: string = workspace.getWorkspaceId();
        if (!this.relevantFilesCache.has(cacheKey)) {
            const allFiles: string[] = await workspace.getTargetedFiles();
            const relevantFiles: string[] = reduceToRelevantFiles(allFiles);
            this.relevantFilesCache.set(cacheKey, relevantFiles);
        }
        return this.relevantFilesCache.get(cacheKey)!;
    }
}

function createRuleDescription(rjsSeverity: RetireJsSeverity): RuleDescription {
    return {
        name: toRuleName(rjsSeverity),
        severityLevel: toSeverityLevel(rjsSeverity),
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.JAVASCRIPT],
        description: getMessage('RetireJsRuleDescription', `${rjsSeverity}`),
        resourceUrls: ['https://retirejs.github.io/retire.js/']
    }
}

function toSeverityLevel(rjsSeverity: RetireJsSeverity): SeverityLevel {
    const severityLevel: SeverityLevel | undefined = SeverityMap.get(rjsSeverity);
    if (severityLevel) {
        return severityLevel;
    }
    /* istanbul ignore next */
    throw new Error(`Unsupported RetireJs severity: ${rjsSeverity}`);
}

function toRuleName(rjsSeverity: RetireJsSeverity) {
    return `LibraryWithKnown${capitalizeFirstLetter(rjsSeverity)}SeverityVulnerability`;
}

function capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function toViolations(findings: Finding[]): Violation[] {
    const violations: Violation[] = [];
    for (const finding of findings) {
        const fileParts: string[] = finding.file.split(ZIPPED_FILE_MARKER);
        const fileOrZipArchive: string = fileParts[0];
        const fileInsideZipArchive: string | undefined = fileParts.length > 1 ? fileParts[1] : undefined;

        for (const findingResult of finding.results) {
            /* istanbul ignore next */
            if (!findingResult.vulnerabilities) {
                continue;
            }
            const library: string = `${findingResult.component} v${findingResult.version}`;
            for (const vulnerability of findingResult.vulnerabilities) {
                violations.push(toViolation(vulnerability, library, fileOrZipArchive, fileInsideZipArchive));
            }
        }
    }
    return violations;
}

function toViolation(vulnerability: Vulnerability, library: string, fileOrZipArchive: string, fileInsideZipArchive?: string) {
    const vulnerabilityDetails: string = JSON.stringify(vulnerability.identifiers, null, 2);
    let message: string = fileInsideZipArchive ? getMessage('VulnerableLibraryFoundInZipArchive', library, fileInsideZipArchive)
        : getMessage('LibraryContainsKnownVulnerability', library);
    message = `${message} ${getMessage('UpgradeToLatestVersion')}\n${getMessage('VulnerabilityDetails', vulnerabilityDetails)}`

    return {
        ruleName: toRuleName(vulnerability.severity as RetireJsSeverity),
        message: message,
        codeLocations: [{file: fileOrZipArchive, startLine: 1, startColumn: 1}],
        primaryLocationIndex: 0,
        resourceUrls: vulnerability.info
    };
}

function reduceToRelevantFiles(files: string[]): string[] {
    const filesSet: Set<string> = new Set(files);
    return files.filter(file => isRelevantFile(file, filesSet));
}
function isRelevantFile(file: string, filesSet: Set<string>): boolean {
    const fileInfo: path.ParsedPath = path.parse(file);
    if (fileIsInFolderToSkip(file)) {
        return false;
    } else if (EXTENSIONS_TO_TARGET.includes(fileInfo.ext.toLowerCase())) {
        return true;
    }
    return filesSet.has(`${fileInfo.dir}${path.sep}${fileInfo.name}.resource-meta.xml`);
}
function fileIsInFolderToSkip(file: string): boolean {
    return FOLDERS_TO_SKIP.some(folderToSkip => file.includes(path.sep + folderToSkip + path.sep));
}
