/** @vitest-environment happy-dom */

import { createLive2dStage, createRenderer } from "@doki-land/live2d";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLive2dWidget } from "../src/shell/widget.js";

function installMinimalCanvas2d(): () => void {
    const proto = HTMLCanvasElement.prototype;
    const original = proto.getContext;
    proto.getContext = function (
        this: HTMLCanvasElement,
        type: string,
        ...args: unknown[]
    ): RenderingContext | null {
        if (type === "2d") {
            return {
                canvas: this,
                setTransform() {},
                clearRect() {},
                save() {},
                restore() {},
                beginPath() {},
                closePath() {},
                moveTo() {},
                lineTo() {},
                fill() {},
                stroke() {},
                drawImage() {},
                createPattern() {
                    return null;
                },
                globalAlpha: 1,
                globalCompositeOperation: "source-over",
                fillStyle: "#000",
                strokeStyle: "#000",
            } as unknown as CanvasRenderingContext2D;
        }
        return original.call(this, type as "2d", ...(args as []));
    };
    return () => {
        proto.getContext = original;
    };
}

describe("createLive2dWidget", () => {
    let restore: (() => void) | undefined;

    beforeEach(() => {
        restore = installMinimalCanvas2d();
    });

    afterEach(() => {
        restore?.();
        restore = undefined;
    });

    it("composes stage + actor without a private RAF loop", async () => {
        const host = document.createElement("div");
        document.body.appendChild(host);
        const stage = createLive2dStage({
            renderer: createRenderer({ prefer: ["canvas2d"] }),
            updateMode: "auto",
        });
        const actor = stage.createActor({ id: "widget-test" });
        const widget = await createLive2dWidget({
            target: host,
            stage,
            actor,
            autoplay: false,
            chrome: false,
        });
        expect(widget.stage).toBe(stage);
        expect(widget.actor).toBe(actor);
        widget.destroy();
        host.remove();
    });
});
