import {
    DescribeOptions,
    Engine,
    EngineRunResults,
    LogLevel,
    RuleDescription,
    RuleType,
    RunOptions,
    SeverityLevel
} from "@salesforce/code-analyzer-engine-api";
import {FlowTestCommandWrapper, FlowTestRuleDescriptor} from "./python/FlowTestCommandWrapper";

export class FlowTestEngine extends Engine {
    public static readonly NAME: string = 'flowtest';
    private readonly commandWrapper: FlowTestCommandWrapper;

    public constructor(commandWrapper: FlowTestCommandWrapper) {
        super();
        this.commandWrapper =  commandWrapper;
    }

    public getName(): string {
        return FlowTestEngine.NAME;
    }

    public async describeRules(_describeOptions: DescribeOptions): Promise<RuleDescription[]> {
        this.emitDescribeRulesProgressEvent(0);
        const flowTestRules: FlowTestRuleDescriptor[] = await this.commandWrapper.getFlowTestRuleDescriptions();
        this.emitDescribeRulesProgressEvent(75);
        const convertedRules = this.convertFlowTestRulesToCodeAnalyzerRules(flowTestRules);
        this.emitRunRulesProgressEvent(100);
        return convertedRules;
    }

    public async runRules(_ruleNames: string[], runOptions: RunOptions): Promise<EngineRunResults> {
        this.emitRunRulesProgressEvent(0);
        this.emitLogEvent(LogLevel.Info, `workspace is ${runOptions.workspace.getWorkspaceRoot()}`);
        this.emitRunRulesProgressEvent(10);
        this.emitRunRulesProgressEvent(100);
        return {
            violations: []
        };
    }

    private convertFlowTestRulesToCodeAnalyzerRules(flowTestRules: FlowTestRuleDescriptor[]): RuleDescription[] {
        return flowTestRules.map(flowTestRule => {
            return {
                // The name maps directly over.
                name: flowTestRule.query_name,
                severityLevel: this.convertFlowTestSeverityToCodeAnalyzerSeverity(flowTestRule.severity),
                // All rules in FlowTest are obviously Flow-type.
                type: RuleType.Flow,
                // All rules are Recommended, but not all rules are Security rules.
                tags: flowTestRule.is_security.toLowerCase() === 'true' ? ['Recommended', 'Security'] : ['Recommended'],
                // The description maps directly over.
                description: flowTestRule.query_description,
                resourceUrls: this.convertHelpUrlToResourceUrls(flowTestRule.help_url)
            }
        });
    }

    private convertFlowTestSeverityToCodeAnalyzerSeverity(flowTestSeverity: string): SeverityLevel {
        switch (flowTestSeverity) {
            case 'Flow_High_Severity':
                return SeverityLevel.High;
            case 'Flow_Moderate_Severity':
                return SeverityLevel.Moderate;
            case 'Flow_Low_Severity':
                return SeverityLevel.Low
        }
        throw new Error(`Developer error: invalid severity level ${flowTestSeverity}`);
    }

    private convertHelpUrlToResourceUrls(helpUrl: string): string[] {
        // Treat the hardcoded string "none" as equivalent to an empty string.
        if (helpUrl.toLowerCase() === 'none' || helpUrl === '') {
            return [];
        } else {
            return [helpUrl];
        }
    }
}


