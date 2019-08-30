/**
 * `@doki-land/live2d-widget` — browser embed helper.
 */

export {
    createTipMessage,
    DEFAULT_WELCOME,
    ensureChromeStyles,
    mountChrome,
} from "./chrome.js";
export {
    Live2DWidget,
    mountWidget,
    type WidgetChromeOptions,
    type WidgetOptions,
    type WidgetToolId,
} from "./widget.js";

export const LIVE2D_WIDGET_VERSION = "0.0.0" as const;
