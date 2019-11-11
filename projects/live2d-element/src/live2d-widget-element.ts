import type { RendererKind } from "@doki-land/live2d";
import { defineLive2dElement } from "./define.js";
import {
    LIVE2D_ELEMENT_TAG,
    type Live2dElement,
    type Live2dElementRenderOptions,
    type Live2dElementTracking,
} from "./live2d-element.js";

export const LIVE2D_WIDGET_ELEMENT_TAG = "live-2d-widget" as const;

const OBSERVED = [
    "model",
    "renderer",
    "width",
    "height",
    "autoplay",
    "autosway",
    "interactive",
    "tracking",
] as const;

const BUBBLE_EVENTS = [
    "live2d-ready",
    "live2d-error",
    "live2d-progress",
    "live2d-profile",
    "live2d-hit",
    "live2d-motion-start",
    "live2d-motion-finish",
] as const;

function parseBoolAttr(
    el: HTMLElement,
    name: string,
    fallback: boolean,
): boolean {
    if (!el.hasAttribute(name)) return fallback;
    const v = el.getAttribute(name);
    if (v === null || v === "" || v === name) return true;
    if (v === "false" || v === "0") return false;
    return true;
}

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
    #renderOptions: Live2dElementRenderOptions | null = null;
    #bubbleHandlers: Array<{ type: string; fn: EventListener }> = [];

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
        return parseBoolAttr(this, "autoplay", true);
    }
    set autoplay(value: boolean) {
        if (value) this.setAttribute("autoplay", "");
        else this.removeAttribute("autoplay");
    }

    get autosway(): boolean {
        return parseBoolAttr(this, "autosway", false);
    }
    set autosway(value: boolean) {
        if (value) this.setAttribute("autosway", "");
        else this.removeAttribute("autosway");
    }

    get interactive(): boolean {
        return parseBoolAttr(this, "interactive", false);
    }
    set interactive(value: boolean) {
        if (value) this.setAttribute("interactive", "");
        else this.removeAttribute("interactive");
    }

    get tracking(): Live2dElementTracking {
        return this.getAttribute("tracking") === "pointer" ? "pointer" : "none";
    }
    set tracking(value: Live2dElementTracking) {
        this.setAttribute("tracking", value === "pointer" ? "pointer" : "none");
    }

    /** Renderer prefer order (property-only; not reflected to attributes). */
    get renderOptions(): Live2dElementRenderOptions | null {
        return this.#renderOptions;
    }
    set renderOptions(value: Live2dElementRenderOptions | null) {
        this.#renderOptions = value;
        this.#syncActorFromAttributes();
    }

    /** Inner `<live-2d>` when present. */
    get actor(): Live2dElement | null {
        return this.#actor;
    }

    connectedCallback(): void {
        defineLive2dElement();
        this.#ensureDom();
        this.#syncActorFromAttributes();
        this.#bindBubbleEvents();
    }

    disconnectedCallback(): void {
        this.#unbindBubbleEvents();
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
        if (this.autosway) actor.setAttribute("autosway", "");
        else actor.removeAttribute("autosway");
        if (this.interactive) actor.setAttribute("interactive", "");
        else actor.removeAttribute("interactive");
        actor.setAttribute("tracking", this.tracking);

        const prefer = this.#renderOptions?.prefer;
        if (prefer?.length) {
            actor.renderOptions = { prefer: [...prefer] as RendererKind[] };
        } else {
            actor.renderOptions = null;
        }
    }

    #bindBubbleEvents(): void {
        this.#unbindBubbleEvents();
        const actor = this.#actor;
        if (!actor) return;
        for (const type of BUBBLE_EVENTS) {
            const fn: EventListener = (event) => {
                this.dispatchEvent(
                    new CustomEvent(type, {
                        bubbles: true,
                        composed: true,
                        detail: (event as CustomEvent).detail,
                    }),
                );
            };
            actor.addEventListener(type, fn);
            this.#bubbleHandlers.push({ type, fn });
        }
    }

    #unbindBubbleEvents(): void {
        const actor = this.#actor;
        for (const { type, fn } of this.#bubbleHandlers) {
            actor?.removeEventListener(type, fn);
        }
        this.#bubbleHandlers = [];
    }
}
