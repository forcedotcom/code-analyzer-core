/**
 * Enum of rule severity levels
 */
export enum SeverityLevel {
    Critical = 1,
    High = 2,
    Moderate = 3,
    Low = 4,
    Info = 5
}

/**
 * Describes a specific rule from an engine
 */
export type RuleDescription = {
    /** The name of the rule */
    name: string,

    /** The {@link SeverityLevel} associated with the rule */
    severityLevel: SeverityLevel,

    /**
     * An array of tags associated with the rule that can be used in rule selection.
     * See {@link COMMON_TAGS} for a list of common tags that you may want to use.
     */
    tags: string[],

    /** A string describing what the rule does */
    description: string,

    /** An array of urls associated with resources to learn more about the rule */
    resourceUrls: string[]
}

/**
 * Object containing a number of common tags that an engine may want to associate with its rules.
 */
export const COMMON_TAGS = {
    /** Rules that should be enabled to run by default using the default rule selection */
    RECOMMENDED: "Recommended",

    /** Rules that do not ship with a particular engine by default but have been added by the user */
    CUSTOM: "Custom",

    CATEGORIES: {
        /** Rules that help enforce coding best practices */
        BEST_PRACTICES: "BestPractices",

        /** Rules that help enforce a specific coding style */
        CODE_STYLE: "CodeStyle",

        /** Rules that help discover issues with code design and implementation */
        DESIGN: "Design",

        /** Rules associated with code documentation */
        DOCUMENTATION: "Documentation",

        /** Rules to help avoid possible runtime errors */
        ERROR_PRONE: "ErrorProne",

        /** Rules to detect possible security vulnerabilities */
        SECURITY: "Security",

        /** Rules to help detect suboptimal performing code */
        PERFORMANCE: "Performance"
    },

    LANGUAGES: {
        /** Rules that analyze files that have APEX code */
        APEX: "Apex",

        /** Rules that analyze files that have CSS code */
        CSS: "CSS",

        /** Rules that analyze files that have HTML code */
        HTML: "HTML",

        /** Rules that analyze files that have JavaScript code */
        JAVASCRIPT: "JavaScript",

        /** Rules that analyze files that have SCSS code */
        SCSS: "SCSS",

        /** Rules that analyze files that have TypeScript code */
        TYPESCRIPT: "TypeScript",

        /** Rules that analyze files that have Visualforce code */
        VISUALFORCE: "Visualforce",

        /** Rules that analyze files that have XML code */
        XML: "XML"
    }
}
