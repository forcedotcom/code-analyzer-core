import {ConfigDescription, ConfigValueExtractor} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from './messages';
import {FlowScannerEngine} from "./engine";
import {PythonVersionIdentifier} from "./python/PythonVersionIdentifier";
import {SemVer} from "semver";

const MINIMUM_PYTHON_VERSION = '3.10.0';
export const PYTHON_COMMAND = 'python_command';

export type FlowConfig = {
    // Indicates the specific Python command to use for the 'flow' engine.
    // May be provided as the name of a command that exists on the path, or an absolute file path location.
    //   Example: '/Library/Frameworks/Python.framework/Versions/3.12/bin/python3'
    // If not defined, or equal to null, then an attempt will be made to automatically discover a Python command from your environment.
    python_command: string;
}

export const FLOW_ENGINE_CONFIG_DESCRIPTION: ConfigDescription = {
    overview: getMessage('ConfigOverview'),
    fieldDescriptions: {
        python_command: {
            descriptionText: getMessage('ConfigFieldDescription_python_command'),
            valueType: "string",
            defaultValue: null // Using null for doc and since it indicates that the value is calculated based on the environment
        }
    }
}

export async function validateAndNormalizeConfig(configValueExtractor: ConfigValueExtractor,
                                                 pythonVersionIdentifier: PythonVersionIdentifier): Promise<FlowConfig> {
    configValueExtractor.validateContainsOnlySpecifiedKeys(['python_command']);
    const valueExtractor: FlowEngineConfigValueExtractor = new FlowEngineConfigValueExtractor(
        configValueExtractor, pythonVersionIdentifier);
    return {
        python_command: await valueExtractor.extractPythonCommandPath()
    }
}

class FlowEngineConfigValueExtractor {
    private readonly pythonVersionIdentifier: PythonVersionIdentifier;
    private readonly delegateExtractor: ConfigValueExtractor;

    constructor(delegateExtractor: ConfigValueExtractor, pythonVersionIdentifier: PythonVersionIdentifier) {
        this.delegateExtractor = delegateExtractor;
        this.pythonVersionIdentifier = pythonVersionIdentifier;
    }

    async extractPythonCommandPath(): Promise<string> {
        const configSpecifiedPython: string|undefined = this.delegateExtractor.extractString(PYTHON_COMMAND);
        return configSpecifiedPython ? await this.validatePythonCommandPath(configSpecifiedPython) :
            await this.findPythonCommandPathFromEnvironment();
    }

    private async validatePythonCommandPath(configSpecifiedPython: string): Promise<string> {
        let version: SemVer|null;
        try {
            version = await this.pythonVersionIdentifier.identifyPythonVersion(configSpecifiedPython);
        } catch (err) {
            /* istanbul ignore next */
            const errMsg: string = err instanceof Error ? err.message : String(err);
            throw new Error(getMessage('UserSpecifiedPythonCommandProducedError',
                this.delegateExtractor.getFieldPath(PYTHON_COMMAND), configSpecifiedPython, errMsg));
        }
        if (!version) {
            throw new Error(getMessage('UserSpecifiedPythonCommandProducedUnrecognizableVersion',
                this.delegateExtractor.getFieldPath(PYTHON_COMMAND), configSpecifiedPython));
        } else if (version.compare(MINIMUM_PYTHON_VERSION) < 0) {
            throw new Error(getMessage('UserSpecifiedPythonBelowMinimumVersion',
                this.delegateExtractor.getFieldPath(PYTHON_COMMAND), configSpecifiedPython, version.format(), MINIMUM_PYTHON_VERSION));
        }
        return configSpecifiedPython;
    }

    private async findPythonCommandPathFromEnvironment(): Promise<string> {
        const possiblePythonCommands: string[] = ['python3', 'python'];
        for (const pythonCommand of possiblePythonCommands) {
            try {
                const version: SemVer|null = await this.pythonVersionIdentifier.identifyPythonVersion(pythonCommand);
                if (version !== null && version.compare(MINIMUM_PYTHON_VERSION) >= 0) {
                    return pythonCommand;
                }
            } catch (_err) {
                // continue
            }
        }
        throw new Error(getMessage('CouldNotLocatePython', MINIMUM_PYTHON_VERSION,
            JSON.stringify(possiblePythonCommands), this.delegateExtractor.getFieldPath(PYTHON_COMMAND),
            FlowScannerEngine.NAME, FlowScannerEngine.NAME));
    }
}