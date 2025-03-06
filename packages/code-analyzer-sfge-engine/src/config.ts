import {
    ConfigDescription,
    ConfigValueExtractor,
} from "@salesforce/code-analyzer-engine-api";
import {getMessage} from "./messages";

// As soon as we start adding config properties, we can stop ignoring this rule.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type SfgeEngineConfig = {
}

export const DEFAULT_SFGE_ENGINE_CONFIG: SfgeEngineConfig = {
};

export const SFGE_ENGINE_CONFIG_DESCRIPTION: ConfigDescription = {
    overview: getMessage('ConfigOverview'),
    fieldDescriptions: {
    }
}

export async function validateAndNormalizeConfig(cve: ConfigValueExtractor): Promise<SfgeEngineConfig> {
    cve.validateContainsOnlySpecifiedKeys([]);
    return {};
}