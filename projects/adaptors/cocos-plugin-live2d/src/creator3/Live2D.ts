import {
    createLive2D as createLive2DRuntime,
    createRenderer,
    focusParameterUpdates,
    type Live2DRuntime,
    type RendererKind,
} from "@doki-land/live2d";
import {
    _decorator,
    Component,
    EventTouch,
    Node,
    PixelFormat,
    Size,
    Sprite,
    SpriteFrame,
    Texture2D,
    UITransform,
    Vec2,
    Vec3,
} from "cc";
import { readCanvasRgba } from "./canvas-bridge.js";
import { DEFAULT_COCOS_PREFER, normalizePrefer } from "./prefer.js";

const { ccclass, property } = _decorator;

/**
 * Cocos Creator 3.x (Web) Live2D component.
 *
 * Draws via `@doki-land/live2d` into an offscreen canvas, then uploads pixels
 * to a Sprite on the same node each frame. Native Android/iOS is out of scope.
 */
@ccclass("Live2D")
export class Live2D extends Component {
    /** Model settings URL, site path, or `npm:pkg[@ver]/path`. */
    @property
    model = "";

    @property
    width = 320;

    @property
    height = 320;

    /**
     * Renderer try order. Default prefers Canvas2D for Texture2D readback.
     * Editor may leave this empty → {@link DEFAULT_COCOS_PREFER}.
     */
    @property({ type: [String] })
    prefer: string[] = [...DEFAULT_COCOS_PREFER];

    @property
    autoplay = true;

    @property
    autoSway = true;

    /** Optional touch hit callback (drawable id / area). */
    onHit: ((payload: { area: string; x: number; y: number }) => void) | null =
        null;

    #canvas: HTMLCanvasElement | null = null;
    #scratch: HTMLCanvasElement | null = null;
    #runtime: Live2DRuntime | null = null;
    #texture: Texture2D | null = null;
    #spriteFrame: SpriteFrame | null = null;
    #sprite: Sprite | null = null;
    #mountGeneration = 0;
    #elapsed = 0;
    #autoSwayPausedByPointer = false;
    #uiLoc = new Vec2();
    #world = new Vec3();
    #local = new Vec3();

    onLoad(): void {
        this.#sprite = this.getComponent(Sprite) ?? this.addComponent(Sprite);
        const ui =
            this.getComponent(UITransform) ?? this.addComponent(UITransform);
        ui.setContentSize(this.width, this.height);

        this.node.on(Node.EventType.TOUCH_MOVE, this.#onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.#onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.#onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_START, this.#onTouchStart, this);
    }

    start(): void {
        void this.#remount();
    }

    update(dt: number): void {
        const runtime = this.#runtime;
        if (!runtime || !this.autoplay) return;

        this.#elapsed += dt;
        if (this.autoSway && !this.#autoSwayPausedByPointer) {
            runtime.setParameter(
                "PARAM_ANGLE_X",
                this.#parameterFromNormalized(
                    "PARAM_ANGLE_X",
                    Math.sin(this.#elapsed) * 0.25,
                ),
            );
        }
        if (this.#autoSwayPausedByPointer) {
            this.#autoSwayPausedByPointer = false;
        }
        runtime.update(dt);
        this.#syncTexture();
    }

    onDestroy(): void {
        this.#mountGeneration += 1;
        this.node.off(Node.EventType.TOUCH_MOVE, this.#onTouchMove, this);
        this.node.off(Node.EventType.TOUCH_END, this.#onTouchEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.#onTouchEnd, this);
        this.node.off(Node.EventType.TOUCH_START, this.#onTouchStart, this);
        this.#teardownRuntime();
        this.#texture?.destroy();
        this.#texture = null;
        this.#spriteFrame = null;
    }

    getRuntime(): Live2DRuntime | null {
        return this.#runtime;
    }

    setParameter(id: string, value: number): void {
        this.#runtime?.setParameter(id, value);
        if (!this.autoplay) {
            this.#runtime?.update(0);
            this.#syncTexture();
        }
    }

    listParameters() {
        return this.#runtime?.listParameters() ?? [];
    }

    async reload(): Promise<void> {
        if (!this.#runtime || !this.model) {
            await this.#remount();
            return;
        }
        const gen = this.#mountGeneration;
        try {
            await this.#runtime.loadModel(this.model);
            if (gen !== this.#mountGeneration) return;
            if (!this.autoplay) {
                this.#runtime.update(0);
                this.#syncTexture();
            }
        } catch {
            // error emitted via runtime events
        }
    }

    async #remount(): Promise<void> {
        const gen = ++this.#mountGeneration;
        this.#teardownRuntime();

        if (typeof document === "undefined") {
            console.warn(
                "cocos-plugin-live2d: Live2D requires Creator Web (DOM canvas).",
            );
            return;
        }

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(this.width));
        canvas.height = Math.max(1, Math.round(this.height));
        this.#canvas = canvas;
        this.#scratch = document.createElement("canvas");

        const prefer = normalizePrefer(this.prefer);
        const runtime = createLive2DRuntime({
            renderer: createRenderer({ prefer }),
        });
        this.#runtime = runtime;
        runtime.mount(canvas);

        const ui = this.getComponent(UITransform);
        ui?.setContentSize(this.width, this.height);

        if (this.model) {
            try {
                await runtime.loadModel(this.model);
                if (gen !== this.#mountGeneration) return;
                if (!this.autoplay) {
                    runtime.update(0);
                }
                this.#syncTexture();
            } catch {
                // error emitted via runtime events
            }
        }
    }

    #teardownRuntime(): void {
        this.#runtime?.destroy();
        this.#runtime = null;
        this.#canvas = null;
        this.#scratch = null;
        this.#elapsed = 0;
        this.#autoSwayPausedByPointer = false;
    }

    #syncTexture(): void {
        const canvas = this.#canvas;
        const sprite = this.#sprite;
        if (!canvas || !sprite) return;

        const pixels = readCanvasRgba(canvas, this.#scratch);
        if (!pixels) {
            // Last resort: let Cocos ingest the canvas directly when possible.
            this.#ensureSpriteFrame(canvas.width, canvas.height);
            try {
                this.#texture?.uploadData(canvas);
            } catch {
                // ignore upload failure
            }
            return;
        }

        this.#ensureSpriteFrame(pixels.width, pixels.height);
        this.#texture?.uploadData(pixels.data);
    }

    #ensureSpriteFrame(width: number, height: number): void {
        if (!this.#texture) {
            this.#texture = new Texture2D();
        }
        this.#texture.reset({
            width,
            height,
            format: PixelFormat.RGBA8888,
        });
        if (!this.#spriteFrame) {
            this.#spriteFrame = new SpriteFrame();
        }
        this.#spriteFrame.texture = this.#texture;
        if (this.#sprite && this.#sprite.spriteFrame !== this.#spriteFrame) {
            this.#sprite.spriteFrame = this.#spriteFrame;
        }
    }

    #parameterFromNormalized(id: string, normalized: number): number {
        const binding = this.#runtime
            ?.listParameters()
            .find((p) => p.id === id);
        if (!binding) return normalized;
        return normalized >= 0
            ? binding.defaultValue +
                  (binding.max - binding.defaultValue) * normalized
            : binding.defaultValue +
                  (binding.defaultValue - binding.min) * normalized;
    }

    #touchToModel(event: EventTouch): { x: number; y: number } | null {
        const ui = this.getComponent(UITransform);
        if (!ui) return null;
        const loc = event.getUILocation(this.#uiLoc);
        this.#world.set(loc.x, loc.y, 0);
        ui.convertToNodeSpaceAR(this.#world, this.#local);
        const size: Size = ui.contentSize;
        const hw = size.width * 0.5;
        const hh = size.height * 0.5;
        if (hw <= 0 || hh <= 0) return null;
        return {
            x: this.#local.x / hw,
            y: this.#local.y / hh,
        };
    }

    #applyFocus(x: number, y: number): void {
        const runtime = this.#runtime;
        if (!runtime) return;
        this.#autoSwayPausedByPointer = true;
        for (const { id, value } of focusParameterUpdates(
            runtime.listParameters(),
            x,
            y,
        )) {
            runtime.setParameter(id, value);
        }
        if (!this.autoplay) {
            runtime.update(0);
            this.#syncTexture();
        }
    }

    #onTouchMove = (event: EventTouch): void => {
        const p = this.#touchToModel(event);
        if (!p) return;
        this.#applyFocus(p.x, p.y);
    };

    #onTouchStart = (event: EventTouch): void => {
        const p = this.#touchToModel(event);
        if (!p) return;
        this.#applyFocus(p.x, p.y);
    };

    #onTouchEnd = (event: EventTouch): void => {
        const p = this.#touchToModel(event);
        const runtime = this.#runtime;
        if (!p || !runtime) return;
        const area = runtime.hitTest(p.x, p.y);
        if (area) this.onHit?.({ area, x: p.x, y: p.y });
    };
}

export type { RendererKind };
