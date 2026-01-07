import {COMMON_TAGS, SeverityLevel} from "@salesforce/code-analyzer-engine-api";
import { REACT } from './constants';

export const RULE_MAPPINGS_REACT: Record<string, {severity: SeverityLevel, tags: string[]}> = {
    // =================================================================================================================
    "react/boolean-prop-naming": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/button-has-type": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.ERROR_PRONE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/checked-requires-onchange-or-readonly": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/default-props-match-prop-types": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.ERROR_PRONE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/destructuring-assignment": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/display-name": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/forbid-component-props": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.ERROR_PRONE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/forbid-dom-props": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/forbid-elements": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/forbid-foreign-prop-types": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.ERROR_PRONE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/forbid-prop-types": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/forward-ref-uses-ref": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.ERROR_PRONE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/function-component-definition": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/hook-use-state": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.ERROR_PRONE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/iframe-missing-sandbox": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-boolean-value": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-child-element-spacing": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.ERROR_PRONE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-closing-bracket-location": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-closing-tag-location": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-curly-brace-presence": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-curly-newline": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-curly-spacing": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-equals-spacing": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-filename-extension": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-first-prop-new-line": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-fragments": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-handler-names": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-indent": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-indent-props": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-key": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-max-depth": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.DESIGN, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-max-props-per-line": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-newline": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-no-bind": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.PERFORMANCE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-no-comment-textnodes": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, REACT, COMMON_TAGS.CATEGORIES.ERROR_PRONE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-no-constructed-context-values": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.PERFORMANCE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-no-duplicate-props": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, REACT, COMMON_TAGS.CATEGORIES.ERROR_PRONE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-no-leaked-render": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.ERROR_PRONE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-no-literals": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-no-script-url": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-no-target-blank": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, REACT, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-no-undef": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, REACT, COMMON_TAGS.CATEGORIES.ERROR_PRONE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-no-useless-fragment": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.DESIGN, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-one-expression-per-line": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-pascal-case": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-props-no-multi-spaces": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-props-no-spread-multi": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.PERFORMANCE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-props-no-spreading": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-sort-props": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-tag-spacing": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-uses-react": {
        // Marks the React import as "used" when JSX is present - needed for classic JSX transform (pre-React 17)
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, REACT, COMMON_TAGS.CATEGORIES.DESIGN, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-uses-vars": {
        // Marks variables used in JSX as "used" - prevents false positives from no-unused-vars
        severity: SeverityLevel.Low,
        tags: [COMMON_TAGS.RECOMMENDED, REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/jsx-wrap-multilines": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/no-access-state-in-setstate": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.ERROR_PRONE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/no-adjacent-inline-elements": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/no-array-index-key": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.PERFORMANCE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/no-arrow-function-lifecycle": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.DESIGN, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/no-children-prop": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/no-danger": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/no-danger-with-children": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, REACT, COMMON_TAGS.CATEGORIES.SECURITY, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/no-deprecated": {
        severity: SeverityLevel.Low,
        tags: [COMMON_TAGS.RECOMMENDED, REACT, COMMON_TAGS.CATEGORIES.DESIGN, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/no-did-mount-set-state": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.PERFORMANCE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/no-did-update-set-state": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.PERFORMANCE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/no-direct-mutation-state": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, REACT, COMMON_TAGS.CATEGORIES.ERROR_PRONE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/no-find-dom-node": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/no-invalid-html-attribute": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.ERROR_PRONE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/no-is-mounted": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/no-multi-comp": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/no-namespace": {
        severity: SeverityLevel.High,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.ERROR_PRONE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/no-object-type-as-default-prop": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.PERFORMANCE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/no-redundant-should-component-update": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/no-render-return-value": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/no-set-state": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.DESIGN, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/no-string-refs": {
        severity: SeverityLevel.Low,
        tags: [COMMON_TAGS.RECOMMENDED, REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/no-this-in-sfc": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.ERROR_PRONE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/no-typos": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.ERROR_PRONE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/no-unescaped-entities": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, REACT, COMMON_TAGS.CATEGORIES.ERROR_PRONE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/no-unknown-property": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, REACT, COMMON_TAGS.CATEGORIES.ERROR_PRONE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/no-unsafe": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.ERROR_PRONE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/no-unstable-nested-components": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.ERROR_PRONE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/no-unused-class-component-methods": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.DESIGN, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/no-unused-prop-types": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.DESIGN, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/no-unused-state": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.DESIGN, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/no-will-update-set-state": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.DESIGN, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/prefer-es6-class": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/prefer-exact-props": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.ERROR_PRONE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/prefer-read-only-props": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/prefer-stateless-function": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/prop-types": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/react-in-jsx-scope": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED, REACT, COMMON_TAGS.CATEGORIES.DESIGN, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/require-default-props": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.DESIGN, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/require-optimization": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.PERFORMANCE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/require-render-return": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED, REACT, COMMON_TAGS.CATEGORIES.ERROR_PRONE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/self-closing-comp": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/sort-comp": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/sort-default-props": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/sort-prop-types": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/state-in-constructor": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.CODE_STYLE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/static-property-placement": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.DESIGN, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/style-prop-object": {
        severity: SeverityLevel.Low,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "react/void-dom-elements-no-children": {
        severity: SeverityLevel.Moderate,
        tags: [/* NOT RECOMMENDED */ REACT, COMMON_TAGS.CATEGORIES.ERROR_PRONE, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
}

