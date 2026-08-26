import { beforeEach, describe, expect, it } from "vitest";
import {
    defineLive2dElement,
    defineLive2dWidgetElement,
} from "../src/define.js";
import { LIVE2D_ELEMENT_TAG, Live2dElement } from "../src/live2d-element.js";
import {
    LIVE2D_WIDGET_ELEMENT_TAG,
    Live2dWidgetElement,
} from "../src/live2d-widget-element.js";

describe("<live-2d> custom element", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        defineLive2dElement();
    });

    it("registers the live-2d tag idempotently", () => {
        defineLive2dElement();
        expect(customElements.get(LIVE2D_ELEMENT_TAG)).toBe(Live2dElement);
    });

    it("reflects attributes to properties before connect", () => {
        const el = document.createElement(LIVE2D_ELEMENT_TAG) as Live2dElement;
        el.setAttribute("model", "/models/demo.model3.json");
        el.setAttribute("renderer", "canvas2d");
        el.setAttribute("width", "480");
        el.setAttribute("height", "640");
        expect(el.model).toBe("/models/demo.model3.json");
        expect(el.renderer).toBe("canvas2d");
        expect(el.width).toBe(480);
        expect(el.height).toBe(640);
    });

    it("mounts a canvas when connected", () => {
        const el = document.createElement(LIVE2D_ELEMENT_TAG) as Live2dElement;
        el.setAttribute("width", "200");
        el.setAttribute("height", "200");
        document.body.appendChild(el);
        const canvas = el.querySelector("canvas");
        expect(canvas).toBeTruthy();
        expect(canvas?.getAttribute("part")).toBe("canvas");
    });

    it("exposes command methods on the element prototype", () => {
        const el = document.createElement(LIVE2D_ELEMENT_TAG) as Live2dElement;
        expect(typeof el.loadModel).toBe("function");
        expect(typeof el.playMotion).toBe("function");
        expect(typeof el.setExpression).toBe("function");
        expect(typeof el.lookAt).toBe("function");
        expect(typeof el.pause).toBe("function");
        expect(typeof el.resume).toBe("function");
    });

    it("dispatches live2d-error when model load fails", async () => {
        const el = document.createElement(LIVE2D_ELEMENT_TAG) as Live2dElement;
        el.setAttribute("renderer", "canvas2d");
        el.setAttribute("width", "64");
        el.setAttribute("height", "64");
        document.body.appendChild(el);

        const error = new Promise<CustomEvent>((resolve) => {
            el.addEventListener("live2d-error", ((e: Event) => {
                resolve(e as CustomEvent);
            }) as EventListener);
        });

        el.setAttribute(
            "model",
            "/__live2d_element_missing__/no-such.model3.json",
        );
        const ev = await error;
        expect(String(ev.detail?.error ?? "")).toMatch(/./);
        expect(el.getAttribute("data-phase")).toBe("error");
    });
});

describe("<live-2d-widget> custom element", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        defineLive2dWidgetElement();
    });

    it("registers the live-2d-widget tag idempotently", () => {
        defineLive2dWidgetElement();
        expect(customElements.get(LIVE2D_WIDGET_ELEMENT_TAG)).toBe(
            Live2dWidgetElement,
        );
    });

    it("nests a live-2d actor and forwards model attribute", () => {
        const el = document.createElement(
            LIVE2D_WIDGET_ELEMENT_TAG,
        ) as Live2dWidgetElement;
        el.setAttribute("model", "/models/demo.model3.json");
        el.setAttribute("width", "240");
        el.setAttribute("height", "320");
        document.body.appendChild(el);

        const actor = el.querySelector(
            LIVE2D_ELEMENT_TAG,
        ) as Live2dElement | null;
        expect(actor).toBeTruthy();
        expect(el.actor).toBe(actor);
        expect(actor?.getAttribute("model")).toBe("/models/demo.model3.json");
        expect(actor?.getAttribute("width")).toBe("240");
        expect(actor?.getAttribute("height")).toBe("320");
        expect(el.querySelector('[part="chrome"]')).toBeTruthy();
    });
});
