import {COMMON_TAGS, SeverityLevel} from "@salesforce/code-analyzer-engine-api";

const APP_EXCHANGE_TAG: string = "AppExchange";

/**
 * The following is a list of the base PMD rules that we have reviewed where we have designated the rule tags and
 * severity (most important to determine if the "Recommended" tag is applied or not). This also helps fixed these values
 * just in case PMD decides to change them.
 *
 * Any base PMD rule not listed here will get flagged by one of our unit tests to be reviewed. All other rules must
 * then be custom rules which the user has added themselves, and thus will automatically get "Recommended" and "Custom"
 * tag applied with a severity level defined by our default mapping from PMD's severity levels.
 */
export const RULE_MAPPINGS: Record<string, {severity: SeverityLevel, tags: string[]}> = {

    // =================================================================================================================
    //   PMD-APEX RULES
    // =================================================================================================================
    "AnnotationsNamingConventions": {
        severity: SeverityLevel.Low,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.CODE_STYLE,     COMMON_TAGS.LANGUAGES.APEX]
    },
    "ApexAssertionsShouldIncludeMessage": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.APEX]
    },
    "ApexBadCrypto": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.SECURITY,       COMMON_TAGS.LANGUAGES.APEX]
    },
    "ApexCRUDViolation": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.SECURITY,       COMMON_TAGS.LANGUAGES.APEX]
    },
    "ApexCSRF": {
        severity: SeverityLevel.Critical,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.SECURITY,       COMMON_TAGS.LANGUAGES.APEX]
    },
    "ApexDangerousMethods": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.SECURITY,       COMMON_TAGS.LANGUAGES.APEX]
    },
    "ApexDoc": {
        severity: SeverityLevel.Low,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.DOCUMENTATION,  COMMON_TAGS.LANGUAGES.APEX]
    },
    "ApexInsecureEndpoint": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.SECURITY,       COMMON_TAGS.LANGUAGES.APEX]
    },
    "ApexOpenRedirect": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.SECURITY,       COMMON_TAGS.LANGUAGES.APEX]
    },
    "ApexSharingViolations": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.SECURITY,       COMMON_TAGS.LANGUAGES.APEX]
    },
    "ApexSOQLInjection": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.SECURITY,       COMMON_TAGS.LANGUAGES.APEX]
    },
    "ApexSuggestUsingNamedCred": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.SECURITY,       COMMON_TAGS.LANGUAGES.APEX]
    },
    "ApexUnitTestClassShouldHaveAsserts": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.APEX]
    },
    "ApexUnitTestClassShouldHaveRunAs": {
        severity: SeverityLevel.Low,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.APEX]
    },
    "ApexUnitTestMethodShouldHaveIsTestAnnotation": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.APEX]
    },
    "ApexUnitTestShouldNotUseSeeAllDataTrue": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.APEX]
    },
    "ApexXSSFromEscapeFalse": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.SECURITY,       COMMON_TAGS.LANGUAGES.APEX]
    },
    "ApexXSSFromURLParam": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.SECURITY,       COMMON_TAGS.LANGUAGES.APEX]
    },
    "AvoidBooleanMethodParameters": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.DESIGN,         COMMON_TAGS.LANGUAGES.APEX]
    },
    "AvoidDebugStatements": {
        severity: SeverityLevel.Low,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.PERFORMANCE,    COMMON_TAGS.LANGUAGES.APEX]
    },
    "AvoidFutureAnnotation": {
        severity: SeverityLevel.Low,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.APEX]
    },
    "AvoidDeeplyNestedIfStmts": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.DESIGN,         COMMON_TAGS.LANGUAGES.APEX]
    },
    "AvoidDirectAccessTriggerMap": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.APEX]
    },
    "AvoidGlobalModifier": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.APEX]
    },
    "AvoidHardcodingId": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.APEX]
    },
    "AvoidInterfaceAsMapKey": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.APEX]
    },
    "AvoidLogicInTrigger": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.APEX]
    },
    "AvoidNonExistentAnnotations": {
        severity: SeverityLevel.Low,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.APEX]
    },
    "AvoidNonRestrictiveQueries": {
        severity: SeverityLevel.Low,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.PERFORMANCE,    COMMON_TAGS.LANGUAGES.APEX]
    },
    "AvoidStatefulDatabaseResult": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.APEX]
    },
    "ClassNamingConventions": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.CODE_STYLE,     COMMON_TAGS.LANGUAGES.APEX]
    },
    "CognitiveComplexity": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.DESIGN,         COMMON_TAGS.LANGUAGES.APEX]
    },
    "CyclomaticComplexity": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.DESIGN,         COMMON_TAGS.LANGUAGES.APEX]
    },
    "DebugsShouldUseLoggingLevel": {
        severity: SeverityLevel.Low,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.APEX]
    },
    "EagerlyLoadedDescribeSObjectResult": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.PERFORMANCE,    COMMON_TAGS.LANGUAGES.APEX]
    },
    "EmptyCatchBlock": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.APEX]
    },
    "EmptyIfStmt": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.APEX]
    },
    "EmptyStatementBlock": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.APEX]
    },
    "EmptyTryOrFinallyBlock": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.APEX]
    },
    "EmptyWhileStmt": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.APEX]
    },
    "ExcessiveClassLength": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.DESIGN,         COMMON_TAGS.LANGUAGES.APEX]
    },
    "ExcessiveParameterList": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.DESIGN,         COMMON_TAGS.LANGUAGES.APEX]
    },
    "ExcessivePublicCount": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.DESIGN,         COMMON_TAGS.LANGUAGES.APEX]
    },
    "FieldDeclarationsShouldBeAtStart": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.CODE_STYLE,     COMMON_TAGS.LANGUAGES.APEX]
    },
    "FieldNamingConventions": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.CODE_STYLE,     COMMON_TAGS.LANGUAGES.APEX]
    },
    "ForLoopsMustUseBraces": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.CODE_STYLE,     COMMON_TAGS.LANGUAGES.APEX]
    },
    "FormalParameterNamingConventions": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.CODE_STYLE,     COMMON_TAGS.LANGUAGES.APEX]
    },
    "IfElseStmtsMustUseBraces": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.CODE_STYLE,     COMMON_TAGS.LANGUAGES.APEX]
    },
    "IfStmtsMustUseBraces": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.CODE_STYLE,     COMMON_TAGS.LANGUAGES.APEX]
    },
    "InaccessibleAuraEnabledGetter": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.APEX]
    },
    "InvocableClassNoArgConstructor": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.APEX]
    },
    "LocalVariableNamingConventions": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.CODE_STYLE,     COMMON_TAGS.LANGUAGES.APEX]
    },
    "MethodNamingConventions": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.CODE_STYLE,     COMMON_TAGS.LANGUAGES.APEX]
    },
    "MethodWithSameNameAsEnclosingClass": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.APEX]
    },
    "NcssConstructorCount": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.DESIGN,         COMMON_TAGS.LANGUAGES.APEX]
    },
    "NcssCount": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.LANGUAGES.APEX, COMMON_TAGS.CUSTOM]
    },
    "NcssMethodCount": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ COMMON_TAGS.CATEGORIES.DESIGN,         COMMON_TAGS.LANGUAGES.APEX]
    },
    "NcssTypeCount": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.DESIGN,         COMMON_TAGS.LANGUAGES.APEX]
    },
    "OneDeclarationPerLine": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.CODE_STYLE,     COMMON_TAGS.LANGUAGES.APEX]
    },
    "OperationWithHighCostInLoop": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.PERFORMANCE,    COMMON_TAGS.LANGUAGES.APEX]
    },
    "OperationWithLimitsInLoop": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.PERFORMANCE,    COMMON_TAGS.LANGUAGES.APEX]
    },
    "OverrideBothEqualsAndHashcode": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.APEX]
    },
    "PropertyNamingConventions": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.CODE_STYLE,     COMMON_TAGS.LANGUAGES.APEX]
    },
    "QueueableWithoutFinalizer": {
        severity: SeverityLevel.Low,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.APEX]
    },
    "StdCyclomaticComplexity": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.DESIGN,         COMMON_TAGS.LANGUAGES.APEX]
    },
    "TestMethodsMustBeInTestClasses": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.APEX]
    },
    "TooManyFields": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.DESIGN,         COMMON_TAGS.LANGUAGES.APEX]
    },
    "TypeShadowsBuiltInNamespace": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.APEX]
    },
    "UnusedLocalVariable": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.APEX]
    },
    "UnusedMethod": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.DESIGN,         COMMON_TAGS.LANGUAGES.APEX]
    },
    "WhileLoopsMustUseBraces": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.CODE_STYLE,     COMMON_TAGS.LANGUAGES.APEX]
    },


    // =================================================================================================================
    //   PMD-HTML RULES
    // =================================================================================================================
    "AvoidInlineStyles": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.HTML]
    },
    "UnnecessaryTypeAttribute": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.HTML]
    },
    "UseAltAttributeForImages": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.HTML]
    },


    // =================================================================================================================
    //   PMD-JAVASCRIPT RULES
    // =================================================================================================================
    "AssignmentInOperand": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.CODE_STYLE,     COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "AvoidConsoleStatements": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.PERFORMANCE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "AvoidTrailingComma": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "AvoidWithStatement": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "ConsistentReturn": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "EqualComparison": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "ForLoopsMustUseBraces-javascript": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.CODE_STYLE,     COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "GlobalVariable": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "IfElseStmtsMustUseBraces-javascript": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.CODE_STYLE,     COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "IfStmtsMustUseBraces-javascript": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.CODE_STYLE,     COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "InaccurateNumericLiteral": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "NoElseReturn": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.CODE_STYLE,     COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "ScopeForInVariable": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "UnnecessaryBlock": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.CODE_STYLE,     COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "UnnecessaryParentheses": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.CODE_STYLE,     COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "UnreachableCode": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.CODE_STYLE,     COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "UseBaseWithParseInt": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },
    "WhileLoopsMustUseBraces-javascript": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.CODE_STYLE,     COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },


    // =================================================================================================================
    //   PMD-VISUALFORCE RULES
    // =================================================================================================================
    "VfCsrf": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.SECURITY,       COMMON_TAGS.LANGUAGES.VISUALFORCE]
    },
    "VfHtmlStyleTagXss": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.SECURITY,       COMMON_TAGS.LANGUAGES.VISUALFORCE]
    },
    "VfUnescapeEl": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, COMMON_TAGS.CATEGORIES.SECURITY,       COMMON_TAGS.LANGUAGES.VISUALFORCE]
    },


    // =================================================================================================================
    //   PMD-XML RULES
    // =================================================================================================================
    "MissingEncoding": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.XML]
    },

    "MistypedCDATASection": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */    COMMON_TAGS.CATEGORIES.ERROR_PRONE,    COMMON_TAGS.LANGUAGES.XML]
    },


    // =================================================================================================================
    //   SFCA-PMD-RULES - APPEXCHANGE HTML RULES
    // =================================================================================================================
    "AvoidHardCodedCredentialsInAura": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.HTML]
    },

    "AvoidUnescapedHtmlInAura": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.HTML]
    },

    // Until further notice, the Product Security team feels it is best to remove this rule until they can make it
    // more stable since the PMD HTML parser seems to throw errors on a number of LWC HTML files.
    // "DetectUseLwcDomManual": {
    //     severity: SeverityLevel.Moderate,
    //     tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.HTML]
    // },


    // =================================================================================================================
    //   SFCA-PMD-RULES - APPEXCHANGE XML RULES
    // =================================================================================================================
    "AvoidApiSessionId": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.XML]
    },

    "AvoidAuraWithLockerDisabled": {
        severity: SeverityLevel.Critical,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.XML]
    },

    "AvoidDisableProtocolSecurityRemoteSiteSetting": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.XML]
    },

    "AvoidInsecureHttpRemoteSiteSetting": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.XML]
    },

    "AvoidJavaScriptCustomObject": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.XML]
    },

    "AvoidJavaScriptInUrls": {
        severity: SeverityLevel.Critical,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.XML]
    },

    "AvoidJavaScriptWebLink": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.XML]
    },

    "AvoidJavaScriptHomePageComponent": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.XML]
    },

    "AvoidLmcIsExposedTrue": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.XML]
    },

    "AvoidSControls": {
        severity: SeverityLevel.Critical,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.XML]
    },

    "LimitConnectedAppScope": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.XML]
    },

    "ProtectSensitiveData": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.XML]
    },

    "UseHttpsCallbackUrlConnectedApp": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.XML]
    },

    // =================================================================================================================
    //   SFCA-PMD-RULES - APPEXCHANGE APEX RULES
    // =================================================================================================================
    "AvoidChangeProtectionUnprotected": {
        severity: SeverityLevel.Critical,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.APEX]
    },

    "AvoidGetInstanceWithTaint": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.APEX]
    },

    "AvoidGlobalInstallUninstallHandlers": {
        severity: SeverityLevel.Critical,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.APEX]
    },

    "AvoidHardcodedCredentialsInFieldDecls": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.APEX]
    },

    "AvoidHardcodedCredentialsInHttpHeader": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.APEX]
    },

    "AvoidHardcodedCredentialsInSetPassword": {
        severity: SeverityLevel.Critical,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.APEX]
    },

    "AvoidHardcodedCredentialsInVarAssign": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.APEX]
    },

    "AvoidHardcodedCredentialsInVarDecls": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.APEX]
    },

    "AvoidInvalidCrudContentDistribution": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.APEX]
    },

    "AvoidSecurityEnforcedOldApiVersion": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.APEX]
    },

    "AvoidUnauthorizedApiSessionIdInApex": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.APEX]
    },

    "AvoidUnauthorizedGetSessionIdInApex": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.APEX]
    },

    "AvoidUnsafePasswordManagementUse": {
        severity: SeverityLevel.Critical,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.APEX]
    },

    // =================================================================================================================
    //   SFCA-PMD-RULES - APPEXCHANGE JAVASCRIPT RULES
    // =================================================================================================================
    "AvoidLwcBubblesComposedTrue": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.JAVASCRIPT]
    },

    // =================================================================================================================
    //   SFCA-PMD-RULES - APPEXCHANGE VISUALFORCE RULES
    // =================================================================================================================
    "AvoidCreateElementScriptLinkTag": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.VISUALFORCE]
    },

    "AvoidHardcodedSecretsInVFAttrs": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.VISUALFORCE]
    },

    "AvoidUnauthorizedApiSessionIdInVisualforce": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.VISUALFORCE]
    },

    "AvoidUnauthorizedGetSessionIdInVisualforce": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.VISUALFORCE]
    },

    "LoadCSSApexStylesheet": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.VISUALFORCE]
    },

    "LoadCSSLinkHref": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.VISUALFORCE]
    },

    "LoadJavaScriptHtmlScript": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.VISUALFORCE]
    },

    "LoadJavaScriptIncludeScript": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */  APP_EXCHANGE_TAG, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.VISUALFORCE]
    }
}
