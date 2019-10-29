import { beforeEach, describe, expect, it } from "vitest";
import { defineLive2dElement } from "../src/define.js";
import { LIVE2D_ELEMENT_TAG, Live2dElement } from "../src/live2d-element.js";

describe("<live-2d> custom element skeleton", () => {
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
