import { defineLive2dElement } from "./define.js";
import { LIVE2D_ELEMENT_TAG, type Live2dElement } from "./live2d-element.js";

export const LIVE2D_WIDGET_ELEMENT_TAG = "live-2d-widget" as const;

const OBSERVED = ["model", "renderer", "width", "height", "autoplay"] as const;

/**
 * Thin `<live-2d-widget>` product-shell CE (v0.0.24 POC).
 *
 * Owns chrome layout only; delegates model/RAF/hit to an inner `<live-2d>`.
 * Does not create a second Stage clock.
 */
export class Live2dWidgetElement extends HTMLElement {
    static get observedAttributes(): string[] {
        return [...OBSERVED];
    }

    #host: HTMLElement | null = null;
    #actor: Live2dElement | null = null;

    get model(): string {
        return this.getAttribute("model") ?? "";
    }
    set model(value: string) {
        const next = String(value ?? "");
        if (next) this.setAttribute("model", next);
        else this.removeAttribute("model");
    }

    get renderer(): string {
        return this.getAttribute("renderer") ?? "auto";
    }
    set renderer(value: string) {
        this.setAttribute("renderer", value || "auto");
    }

    get width(): number {
        return Math.max(1, Number(this.getAttribute("width")) || 320);
    }
    set width(value: number) {
        this.setAttribute("width", String(Math.max(1, Number(value) || 320)));
    }

    get height(): number {
        return Math.max(1, Number(this.getAttribute("height")) || 320);
    }
    set height(value: number) {
        this.setAttribute("height", String(Math.max(1, Number(value) || 320)));
    }

    get autoplay(): boolean {
        if (!this.hasAttribute("autoplay")) return true;
        const v = this.getAttribute("autoplay");
        if (v === null || v === "" || v === "autoplay") return true;
        return v !== "false" && v !== "0";
    }
    set autoplay(value: boolean) {
        if (value) this.setAttribute("autoplay", "");
        else this.removeAttribute("autoplay");
    }

    /** Inner `<live-2d>` when present. */
    get actor(): Live2dElement | null {
        return this.#actor;
    }

    connectedCallback(): void {
        defineLive2dElement();
        this.#ensureDom();
        this.#syncActorFromAttributes();
    }

    attributeChangedCallback(): void {
        if (!this.isConnected) return;
        this.#syncActorFromAttributes();
    }

    #ensureDom(): void {
        if (this.#host?.isConnected) return;

        let actor = this.querySelector(
            LIVE2D_ELEMENT_TAG,
        ) as Live2dElement | null;
        if (!actor) {
            actor = document.createElement(LIVE2D_ELEMENT_TAG) as Live2dElement;
        } else {
            actor.remove();
        }

        this.replaceChildren();
        const host = document.createElement("div");
        host.setAttribute("part", "chrome");
        host.className = "live2d-widget-chrome";
        host.appendChild(actor);
        this.appendChild(host);
        this.#host = host;
        this.#actor = actor;
    }

    #syncActorFromAttributes(): void {
        this.#ensureDom();
        const actor = this.#actor;
        if (!actor) return;

        if (this.hasAttribute("model")) {
            actor.setAttribute("model", this.model);
        }
        if (this.hasAttribute("renderer")) {
            actor.setAttribute("renderer", this.renderer);
        }
        actor.setAttribute("width", String(this.width));
        actor.setAttribute("height", String(this.height));
        if (this.autoplay) actor.setAttribute("autoplay", "");
        else actor.removeAttribute("autoplay");
    }
}
