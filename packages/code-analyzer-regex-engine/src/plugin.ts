import {
    ConfigDescription,
    ConfigObject,
    ConfigValueExtractor,
    Engine,
    EnginePluginV1,
    SeverityLevel,
} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from "./messages";
import {RegexEngine} from "./engine";
import {
    REGEX_ENGINE_CONFIG_DESCRIPTION,
    RegexEngineConfig,
    RegexRule,
    RegexRules,
    validateAndNormalizeConfig
} from "./config";
import {Clock, RealClock} from "./utils";

export const RULE_RESOURCE_URLS: Map<string, string[]> = new Map([
    ['AvoidTermsWithImplicitBias',['https://www.salesforce.com/news/stories/salesforce-updates-technical-language-in-ongoing-effort-to-address-implicit-bias/']]
]);
export const TERMS_WITH_IMPLICIT_BIAS: string[] = ['whitelist', 'blacklist', 'brownout', 'blackout', 'slave'];

export class RegexEnginePlugin extends EnginePluginV1 {
    private clock: Clock = new RealClock();

    // For testing purposes only:
    _setClock(clock: Clock): void {
        this.clock = clock;
    }

    getAvailableEngineNames(): string[] {
        return [RegexEngine.NAME];
    }

    describeEngineConfig(engineName: string): ConfigDescription {
        validateEngineName(engineName);
        return REGEX_ENGINE_CONFIG_DESCRIPTION;
    }

    async createEngineConfig(engineName: string, configValueExtractor: ConfigValueExtractor): Promise<ConfigObject> {
        validateEngineName(engineName);
        return validateAndNormalizeConfig(configValueExtractor) as ConfigObject;
    }

    async createEngine(engineName: string, resolvedConfig: ConfigObject): Promise<Engine> {
        validateEngineName(engineName);
        const allRules: RegexRules = {
            ... createBaseRegexRules(this.clock.now()),
            ... (resolvedConfig as RegexEngineConfig).custom_rules
        }
        return new RegexEngine(allRules, RULE_RESOURCE_URLS);
    }
}

function validateEngineName(engineName: string) {
    if (engineName !== RegexEngine.NAME) {
        throw new Error(getMessage('UnsupportedEngineName', engineName));
    }
}

export function createBaseRegexRules(now: Date): RegexRules {
    return {
        NoTrailingWhitespace: {
            regex: (/[ \t]+((?=\r?\n)|(?=$))/g).toString(),
            file_extensions: ['.cls', '.trigger'],
            description: getMessage('TrailingWhitespaceRuleDescription'),
            violation_message: getMessage('TrailingWhitespaceRuleMessage'),
            severity: SeverityLevel.Info,
            tags: ['Recommended', 'CodeStyle']
        },
        AvoidTermsWithImplicitBias: {
            regex: (/\b(((black|white)\s*list\w*)|((black|brown)\s*out\w*)|(slaves?\b))/gi).toString(),
            description: getMessage('AvoidTermsWithImplicitBiasRuleDescription'),
            violation_message: getMessage('AvoidTermsWithImplicitBiasRuleMessage', JSON.stringify(TERMS_WITH_IMPLICIT_BIAS)),
            severity: SeverityLevel.Info,
            tags: ['Recommended']
        },
        AvoidOldSalesforceApiVersions: createAvoidOldSalesforceApiVersionsRule(now),
        AvoidGetHeapSizeInLoop: {
            regex: (/(?<=(for|while)\s*\([^)]*\)\s*\{[^}]*?)\bLimits\.getHeapSize\(\)|(?<=(do)\s*\{[^}]*?)\bLimits\.getHeapSize\(\)/gi).toString(),
            description: getMessage('AvoidGetHeapSizeInLoopRuleDescription'),
            violation_message: getMessage('AvoidGetHeapSizeInLoopRuleMessage'),
            severity: SeverityLevel.High,
            tags: ['Recommended', 'Performance']
        },
        MinVersionForAbstractVirtualClassesWithPrivateMethod: {
            // Part to match (using look behind) that we are in an abstract/virtual class (using look behind):
            //    (^|\s+)(virtual|abstract)[^{]*\s+class\s+.*\n\s*
            // Part to match a private method signature:
            //    private [^{]+\([^)]*\)\s*{
            // Part to match (using look ahead) that the meta data has apiVersion less than 61.0:
            //    .*<apiVersion>\s*([1-9]|[1-5][0-9]|60)(\.[0-9])?\s*<\/apiVersion>
            regex: (/(?<=(^|\s+)(virtual|abstract)[^{]*\s+class\s+.*\n\s*)private [^{]+\([^)]*\)\s*{(?=.*<apiVersion>\s*([1-9]|[1-5][0-9]|60)(\.[0-9])?\s*<\/apiVersion>)/gis).toString(),
            file_extensions: ['.cls', '.trigger'],
            description: getMessage('MinVersionForAbstractVirtualClassesWithPrivateMethodRuleDescription'),
            violation_message: getMessage('MinVersionForAbstractVirtualClassesWithPrivateMethodRuleMessage'),
            severity: SeverityLevel.High,
            tags: ['Recommended'],
            include_metadata: true
        }
    }
}

function createAvoidOldSalesforceApiVersionsRule(now: Date): RegexRule {
    const apiVersionFromThreeYearsAgo: number = getSalesforceApiVersionFor(subtractThreeYears(now));
    return {
        regex: generateRegexForAvoidOldSalesforceApiVersionsRule(apiVersionFromThreeYearsAgo).toString(),
        file_extensions: ['.xml'],
        description: getMessage('AvoidOldSalesforceApiVersionsRuleDescription'),
        violation_message: getMessage('AvoidOldSalesforceApiVersionsRuleMessage', apiVersionFromThreeYearsAgo),
        tags: ["Recommended", "Security"],
        severity: SeverityLevel.High
    };
}

function generateRegexForAvoidOldSalesforceApiVersionsRule(apiVersionFromThreeYearsAgo: number): RegExp {
    if (apiVersionFromThreeYearsAgo < 20 || apiVersionFromThreeYearsAgo >= 100) {
        throw new Error("This method only works for API versions that are >= 20.0 and < 100.0. Please contact Salesforce to fix this method.");
    }
    const tensDigit: number = Math.floor(apiVersionFromThreeYearsAgo / 10);
    const onesDigit: number = apiVersionFromThreeYearsAgo % 10;
    const forbiddenVersionsPattern: string = `([1-9]|[1-${tensDigit-1}][0-9]|${tensDigit}[0-${onesDigit}])(\\.[0-9])?`;
    // Note using (?<= ... ) and (?=< ... ) so that the violation location is just the version number instead of the entire thing
    return new RegExp(`(?<=<apiVersion>)${forbiddenVersionsPattern}(?=<\\/apiVersion>)`, 'g');
}

function subtractThreeYears(date: Date): Date{
    const pastDate = new Date(date);
    pastDate.setFullYear(pastDate.getFullYear() - 3);
    return pastDate;
}

function getSalesforceApiVersionFor(date: Date): number {
    const year: number = date.getUTCFullYear();
    const month: number = date.getUTCMonth();
    if (month >= 1 && month < 5) {        // Feb through May (Spring release)
        return (year - 2004) * 3;
    } else if (month >= 5 && month < 9) { // Jun through Sep (Summer release)
        return (year - 2004) * 3 + 1;
    } else {                              // Oct through Jan (Winter release)
        return (year - 2004) * 3 + 2;
    }
}