import {COMMON_TAGS, SeverityLevel} from "@salesforce/code-analyzer-engine-api";
import { LWC } from './constants';

export const RULE_MAPPINGS_LWC: Record<string, {severity: SeverityLevel, tags: string[]}> = {
    // =================================================================================================================
    "@lwc/lwc-platform/no-aura": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-aura-libs": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-community-import": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-create-context-provider": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-deprecated-module-import": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-dynamic-import-identifier": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-inline-disable": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-interop": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-interop-create": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-interop-dispatch": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-interop-execute": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-interop-execute-controller-with-client-def": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-interop-execute-with-callback": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-interop-execute-privileged": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-interop-execute-raw-response": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-interop-get-event": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-interop-get-module": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-interop-is-external-definition": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-interop-load-definitions": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-interop-module-instrumentation": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-interop-module-storage": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-interop-register": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-interop-render": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-interop-sanitize": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-lds-aura-controller-method": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-process-env": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-restricted-namespaces": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-site-import": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/no-wire-service": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc-platform/valid-dynamic-import-hint": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },

    // This one rule is broken and thus we need to turn it off for now.
    // See https://git.soma.salesforce.com/lwc/eslint-plugin-lwc-platform/issues/152
    // TODO: Turn it back on when the rule has been fixed:
    // "@lwc/lwc-platform/valid-offline-wire": {
    //     severity: SeverityLevel.Moderate,
    //     tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    // },

    "@lwc/lwc/no-api-reassignments": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc/newer-version-available": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc/no-async-operation": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc/no-attributes-during-construction": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc/no-deprecated": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc/no-document-query": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc/no-disallowed-lwc-imports": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc/no-inner-html": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.SECURITY,       COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc/no-leading-uppercase-api-name": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc/no-template-children": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc/no-unexpected-wire-adapter-usages": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc/no-unknown-wire-adapters": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc/prefer-custom-event": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc/valid-api": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc/valid-graphql-wire-adapter-callback-parameters": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc/valid-track": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@lwc/lwc/valid-wire": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "@salesforce/lightning/valid-apex-method-invocation": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "import/default": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "import/export": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "import/named": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "import/namespace": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "jest/expect-expect": {
        severity: SeverityLevel.Info,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "jest/no-alias-methods": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "jest/no-commented-out-tests": {
        severity: SeverityLevel.Info,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "jest/no-conditional-expect": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },

    // This one rule makes eslint throw an exception if the user doesn't have jest installed (which should be
    // optional), so we turn it off for now. See https://github.com/salesforce/eslint-config-lwc/issues/161
    // "jest/no-deprecated-functions": {
    //     severity: SeverityLevel.Moderate,
    //     tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    // },
    "jest/no-disabled-tests": {
        severity: SeverityLevel.Info,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "jest/no-done-callback": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "jest/no-export": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "jest/no-focused-tests": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "jest/no-identical-title": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "jest/no-interpolation-in-snapshots": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "jest/no-jasmine-globals": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "jest/no-mocks-import": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "jest/no-standalone-expect": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "jest/no-test-prefixes": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "jest/valid-describe-callback": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "jest/valid-expect": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "jest/valid-expect-in-promise": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "jest/valid-title": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, LWC, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },


    // =================================================================================================================
};
