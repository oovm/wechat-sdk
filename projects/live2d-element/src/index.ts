/**
 * `@doki-land/live2d-element` — official `<live-2d>` Custom Element.
 *
 * v0.0.22 thin gate: pure TypeScript CE wrapping `@doki-land/live2d`
 * (`createLive2D` + Stage-owned RAF). Zero VMZ runtime dependency.
 * Design `01` still targets eventual `vmz build --target custom-element`
 * when that CLI target ships in published `@vmz/vmz`; until then this
 * package is the cross-ecosystem ABI skeleton.
 */

export { defineLive2dElement } from "./define.js";
export {
    LIVE2D_ELEMENT_TAG,
    Live2dElement,
    type Live2dElementRenderer,
} from "./live2d-element.js";

import { defineLive2dElement } from "./define.js";

/** Side-effect registration for `<script type="module">` consumers. */
defineLive2dElement();
