import { LIVE2D_ELEMENT_TAG, Live2dElement } from "./live2d-element.js";

let defined = false;

/** Idempotent `customElements.define('live-2d', …)`. */
export function defineLive2dElement(): void {
    if (defined) return;
    if (typeof customElements === "undefined") return;
    if (customElements.get(LIVE2D_ELEMENT_TAG)) {
        defined = true;
        return;
    }
    customElements.define(LIVE2D_ELEMENT_TAG, Live2dElement);
    defined = true;
}
