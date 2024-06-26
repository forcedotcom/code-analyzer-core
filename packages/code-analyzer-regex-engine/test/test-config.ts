import path from "node:path";
import { changeWorkingDirectoryToPackageRoot } from "./test-helpers";
import { CodeLocation, Violation} from "@salesforce/code-analyzer-engine-api";

changeWorkingDirectoryToPackageRoot();

export const FILE_LOCATION_1 = path.resolve(__dirname, "test-data", "2_apexClasses", "myOuterClass.cls")
export const FILE_LOCATION_2 = path.resolve(__dirname,  "test-data", "2_apexClasses", "myClass.cls")
export const TRAILING_WHITESPACE_RULE_NAME = "TrailingWhitespaceRule"
export const TRAILING_WHITESPACE_RULE_MESSAGE = "Detects trailing whitespace (tabs or spaces) at the end of lines of code and lines that are only whitespace.";
export const TRAILING_WHITESPACE_RESOURCE_URLS = []

const EXPECTED_CODE_LOCATION_1: CodeLocation = {
    file: FILE_LOCATION_1,
    startLine: 6,
    startColumn: 2,
    endLine: 6,
    endColumn: 4
}

const EXPECTED_CODE_LOCATION_2: CodeLocation = {
    file: FILE_LOCATION_2,
    startLine: 2,
    startColumn: 40,
    endLine: 2,
    endColumn: 41
}

const EXPECTED_CODE_LOCATION_3: CodeLocation = {
    file: FILE_LOCATION_2,
    startLine: 6,
    startColumn: 2,
    endLine: 6,
    endColumn: 4
}

export const EXPECTED_VIOLATION_1: Violation[] = [
    {
        ruleName: TRAILING_WHITESPACE_RULE_NAME,
        message: TRAILING_WHITESPACE_RULE_MESSAGE,
        primaryLocationIndex: 0,
        codeLocations: [EXPECTED_CODE_LOCATION_1]
    }
]

export const EXPECTED_VIOLATION_2: Violation[] = [
    {
        ruleName: TRAILING_WHITESPACE_RULE_NAME,
        message: TRAILING_WHITESPACE_RULE_MESSAGE,
        primaryLocationIndex: 0,
        codeLocations: [EXPECTED_CODE_LOCATION_2]
    },
    {
        ruleName: TRAILING_WHITESPACE_RULE_NAME,
        message: TRAILING_WHITESPACE_RULE_MESSAGE,
        primaryLocationIndex: 0,
        codeLocations: [EXPECTED_CODE_LOCATION_3]

    }  
]

export const EXPECTED_VIOLATION_3: Violation[] = [
    {
        ruleName: TRAILING_WHITESPACE_RULE_NAME,
        message: TRAILING_WHITESPACE_RULE_MESSAGE,
        primaryLocationIndex: 0,
        codeLocations: [EXPECTED_CODE_LOCATION_1]
    },
    {
        ruleName: TRAILING_WHITESPACE_RULE_NAME,
        message: TRAILING_WHITESPACE_RULE_MESSAGE,
        primaryLocationIndex: 0,
        codeLocations: [EXPECTED_CODE_LOCATION_2]
    },
    {
        ruleName: TRAILING_WHITESPACE_RULE_NAME,
        message: TRAILING_WHITESPACE_RULE_MESSAGE,
        primaryLocationIndex: 0,
        codeLocations: [EXPECTED_CODE_LOCATION_3]

    }  
]

