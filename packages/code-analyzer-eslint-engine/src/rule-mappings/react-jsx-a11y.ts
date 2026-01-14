import {COMMON_TAGS, SeverityLevel} from "@salesforce/code-analyzer-engine-api";
import { REACT, A11Y } from './constants';

// Recommended rules (enabled in the plugin's recommended config)
export const RULE_MAPPINGS_REACT_A11Y_RECOMMENDED: Record<string, {severity: SeverityLevel, tags: string[]}> = {
    "jsx-a11y/alt-text": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/anchor-has-content": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/anchor-is-valid": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/aria-activedescendant-has-tabindex": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/aria-props": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/aria-proptypes": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/aria-role": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/aria-unsupported-elements": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/autocomplete-valid": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/click-events-have-key-events": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/heading-has-content": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/html-has-lang": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/iframe-has-title": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/img-redundant-alt": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/interactive-supports-focus": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/label-has-associated-control": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/media-has-caption": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/mouse-events-have-key-events": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/no-access-key": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/no-autofocus": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/no-distracting-elements": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/no-interactive-element-to-noninteractive-role": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/no-noninteractive-element-interactions": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/no-noninteractive-element-to-interactive-role": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/no-noninteractive-tabindex": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/no-redundant-roles": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/no-static-element-interactions": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/role-has-required-aria-props": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/role-supports-aria-props": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/scope": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/tabindex-no-positive": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
};

// All remaining rules not in the recommended config
export const RULE_MAPPINGS_REACT_A11Y_NOT_RECOMMENDED: Record<string, {severity: SeverityLevel, tags: string[]}> = {
    "jsx-a11y/accessible-emoji": { // DEPRECATED
        severity: SeverityLevel.Low,
        tags: [ REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/anchor-ambiguous-text": {
        severity: SeverityLevel.Moderate,
        tags: [ REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/control-has-associated-label": {
        severity: SeverityLevel.Low,
        tags: [ REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/label-has-for": { // DEPRECATED
        severity: SeverityLevel.Low,
        tags: [ REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/lang": {
        severity: SeverityLevel.Moderate,
        tags: [ REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/no-aria-hidden-on-focusable": {
        severity: SeverityLevel.Moderate,
        tags: [ REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/no-onchange": { // DEPRECATED
        severity: SeverityLevel.Low,
        tags: [ REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    "jsx-a11y/prefer-tag-over-role": {
        severity: SeverityLevel.Low,
        tags: [ REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
};

export const RULE_MAPPINGS_REACT_A11Y: Record<string, {severity: SeverityLevel, tags: string[]}> = {
    ...RULE_MAPPINGS_REACT_A11Y_RECOMMENDED,
    ...RULE_MAPPINGS_REACT_A11Y_NOT_RECOMMENDED
};

