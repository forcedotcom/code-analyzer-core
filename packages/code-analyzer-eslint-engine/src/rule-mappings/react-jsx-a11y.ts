import {COMMON_TAGS, SeverityLevel} from "@salesforce/code-analyzer-engine-api";
import { REACT } from './constants';

// Recommended rules (enabled in the plugin's recommended config)
export const RULE_MAPPINGS_REACT_A11Y_RECOMMENDED: Record<string, {severity: SeverityLevel, tags: string[]}> = {
    // Ensures images have helpful alternative text for screen readers.
    //   <img src="/logo.png" />            // violation
    //   <img src="/logo.png" alt="Logo" /> // ok
    "jsx-a11y/alt-text": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    // <a> should contain accessible text (children or aria-label/aria-labelledby).
    //   <a href="/home"></a>                // violation
    //   <a href="/home">Home</a>            // ok
    "jsx-a11y/anchor-has-content": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    // Valid anchors: proper href or role/button alternative.
    //   <a>Click</a>                        // violation
    //   <a href="/settings">Settings</a>    // ok
    "jsx-a11y/anchor-is-valid": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    // If using aria-activedescendant, element must have a tabindex to be focusable.
    //   <div aria-activedescendant="id" />      // violation
    //   <div aria-activedescendant="id" tabIndex={0} /> // ok
    "jsx-a11y/aria-activedescendant-has-tabindex": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    // Only valid ARIA attributes are allowed.
    //   <div aria-lablledby="x" />   // violation (misspelled)
    //   <div aria-labelledby="x" />   // ok
    "jsx-a11y/aria-props": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    // ARIA attributes must have valid value types.
    //   <div aria-hidden="maybe" />  // violation
    //   <div aria-hidden="true" />   // ok
    "jsx-a11y/aria-proptypes": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    // ARIA role must be valid.
    //   <div role="buton" />   // violation
    //   <div role="button" />  // ok
    "jsx-a11y/aria-role": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    // Forbids unsupported ARIA attributes on elements.
    //   <meta aria-hidden="true" />  // violation
    "jsx-a11y/aria-unsupported-elements": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    // Ensures valid autocomplete values.
    //   <input autoComplete="foo" />        // violation
    //   <input autoComplete="email" />      // ok
    "jsx-a11y/autocomplete-valid": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    // Clickable elements must be keyboard accessible.
    //   <div onClick={handler} />                     // violation
    //   <div onClick={handler} onKeyDown={handler} /> // ok
    "jsx-a11y/click-events-have-key-events": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    // Headings must have content (text or aria-label).
    //   <h2 />                       // violation
    //   <h2>Title</h2>               // ok
    "jsx-a11y/heading-has-content": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    // <html> requires a lang attribute for language.
    //   <html>...</html>                 // violation
    //   <html lang="en">...</html>       // ok
    "jsx-a11y/html-has-lang": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    // <iframe> must have a meaningful title.
    //   <iframe src="..." />                            // violation
    //   <iframe src="..." title="Video player" />       // ok
    "jsx-a11y/iframe-has-title": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    // Avoid redundant alt text like "image" or duplicating context.
    //   <img alt="image" />            // violation
    //   <img alt="Company logo" />     // ok
    "jsx-a11y/img-redundant-alt": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    // Interactive elements must be focusable.
    //   <div role="button" onClick={...} />             // violation
    //   <div role="button" tabIndex={0} onClick={...} />// ok
    "jsx-a11y/interactive-supports-focus": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    // Form controls should have associated labels.
    //   <input id="email" />                               // violation
    //   <label htmlFor="email">Email</label><input id="email" /> // ok
    "jsx-a11y/label-has-associated-control": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    // Media (audio/video) should provide captions.
    //   <video src="clip.mp4" controls />          // violation
    //   <video><track kind="captions" .../></video>// ok
    "jsx-a11y/media-has-caption": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    // Mouse events should have keyboard equivalents.
    //   <div onMouseEnter={...} />            // violation
    //   <div onMouseEnter={...} onFocus={...} /> // ok
    "jsx-a11y/mouse-events-have-key-events": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    // Disallow accesskey attribute due to keyboard shortcut conflicts.
    //   <button accessKey="s">Save</button> // violation
    "jsx-a11y/no-access-key": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    // Autofocus can be disruptive for users.
    //   <input autoFocus />    // violation
    "jsx-a11y/no-autofocus": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    // Marquee/blink elements are distracting and inaccessible.
    //   <marquee>News</marquee> // violation
    "jsx-a11y/no-distracting-elements": {
        severity: SeverityLevel.High,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    // Interactive roles on non-interactive elements must be appropriate.
    //   <tr role="button" />   // violation
    "jsx-a11y/no-interactive-element-to-noninteractive-role": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    // Non-interactive elements should not have interaction handlers without roles.
    //   <li onClick={...} />                // violation
    //   <li role="button" tabIndex={0} ...>// ok
    "jsx-a11y/no-noninteractive-element-interactions": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    // Don’t map non-interactive elements to interactive roles.
    //   <div role="menuitem" /> // violation
    "jsx-a11y/no-noninteractive-element-to-interactive-role": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    // Avoid tabindex on non-interactive elements unless necessary.
    //   <div tabIndex={0} /> // violation (usually)
    "jsx-a11y/no-noninteractive-tabindex": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    // Avoid redundant role that duplicates the implicit role.
    //   <button role="button">...</button> // violation
    "jsx-a11y/no-redundant-roles": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    // Non-interactive elements shouldn’t have event handlers implying interaction.
    //   <div onClick={...} /> // violation
    "jsx-a11y/no-static-element-interactions": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    // Required aria-* props must be present for a given role.
    //   <input role="switch" />                    // violation
    //   <input role="switch" aria-checked="true"/> // ok
    "jsx-a11y/role-has-required-aria-props": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    // Only supported aria-* props for a role are allowed.
    //   <div role="button" aria-expanded="true" /> // ok
    //   <div role="button" aria-colspan="2" />     // violation
    "jsx-a11y/role-supports-aria-props": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    // scope attribute should be used correctly within tables.
    //   <th scope="rowgroup">X</th> // violation (invalid)
    //   <th scope="col">Name</th>   // ok
    "jsx-a11y/scope": {
        severity: SeverityLevel.Moderate,
        tags: [COMMON_TAGS.RECOMMENDED,  REACT, COMMON_TAGS.CATEGORIES.BEST_PRACTICES, COMMON_TAGS.LANGUAGES.JAVASCRIPT, COMMON_TAGS.LANGUAGES.TYPESCRIPT]
    },
    // Positive tabindex breaks natural tab order; avoid tabindex > 0.
    //   <div tabIndex={1} />  // violation
    //   <div tabIndex={0} />  // ok (focusable)
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

