/**
 * `@doki-land/live2d-widget` — browser embed helper.
 */

export {
    createTipMessage,
    DEFAULT_WELCOME,
    ensureChromeStyles,
    mountChrome,
} from "./chrome/chrome.js";
export {
    type ComposedWidgetOptions,
    createLive2dWidget,
    Live2dWidget,
    type WidgetChromeOptions,
    type WidgetToolId,
} from "./shell/widget.js";

export const LIVE2D_WIDGET_VERSION = "0.0.0" as const;
