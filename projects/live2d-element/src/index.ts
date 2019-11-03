/**
 * `@doki-land/live2d-element` — official `<live-2d>` / `<live-2d-widget>` CEs.
 *
 * Pure TypeScript CE wrapping `@doki-land/live2d` (`createLive2d` + Stage-owned
 * RAF). Zero VMZ runtime dependency. Design `01` still targets eventual
 * `vmz build --target custom-element` when that CLI target ships.
 */

export {
    defineLive2dElement,
    defineLive2dElements,
    defineLive2dWidgetElement,
} from "./define.js";
export {
    LIVE2D_ELEMENT_TAG,
    Live2dElement,
    type Live2dElementRenderer,
    type Live2dElementTracking,
} from "./live2d-element.js";
export {
    LIVE2D_WIDGET_ELEMENT_TAG,
    Live2dWidgetElement,
} from "./live2d-widget-element.js";

import { defineLive2dElements } from "./define.js";

/** Side-effect registration for `<script type="module">` consumers. */
defineLive2dElements();
