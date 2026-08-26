import { LIVE2D_ELEMENT_TAG, Live2dElement } from "./live2d-element.js";
import {
    LIVE2D_WIDGET_ELEMENT_TAG,
    Live2dWidgetElement,
} from "./live2d-widget-element.js";

let elementDefined = false;
let widgetDefined = false;

/** Idempotent `customElements.define('live-2d', …)`. */
export function defineLive2dElement(): void {
    if (elementDefined) return;
    if (typeof customElements === "undefined") return;
    if (customElements.get(LIVE2D_ELEMENT_TAG)) {
        elementDefined = true;
        return;
    }
    customElements.define(LIVE2D_ELEMENT_TAG, Live2dElement);
    elementDefined = true;
}

/** Idempotent `customElements.define('live-2d-widget', …)`. */
export function defineLive2dWidgetElement(): void {
    defineLive2dElement();
    if (widgetDefined) return;
    if (typeof customElements === "undefined") return;
    if (customElements.get(LIVE2D_WIDGET_ELEMENT_TAG)) {
        widgetDefined = true;
        return;
    }
    customElements.define(LIVE2D_WIDGET_ELEMENT_TAG, Live2dWidgetElement);
    widgetDefined = true;
}

/** Register both official CE tags. */
export function defineLive2dElements(): void {
    defineLive2dElement();
    defineLive2dWidgetElement();
}
