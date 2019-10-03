/**
 * Optional page chrome for `@doki-land/live2d-widget`:
 * speech bubble, hitokoto, and a small toolbar.
 *
 * Lives in the widget package so Vue / Hexo / other hosts share one shell.
 * Host adaptors must only pass config — do not reimplement UI there.
 */

export type WidgetToolId = "hitokoto" | "photo" | "quit";

export interface WidgetChromeOptions {
    /** Speech bubble + page event lines. Default true when chrome is enabled. */
    tips?: boolean;
    /** Toolbar buttons. Default `["hitokoto", "photo", "quit"]`. */
    tools?: WidgetToolId[];
    /** Opening line(s). */
    welcome?: string | string[];
    /** Hitokoto API endpoint. Default `https://v1.hitokoto.cn`. */
    hitokotoApi?: string;
    /** Called after the quit tool hides the widget host. */
    onQuit?: () => void;
}

export interface TipMessage {
    show(text: string | string[], timeoutMs?: number, priority?: number): void;
    clear(): void;
    destroy(): void;
}

const DEFAULT_WELCOME = [
    "你好！我是看板娘，今天也要加油哦。",
    "欢迎回来——点我或者用工具栏跟我互动吧。",
];

function pick(text: string | string[]): string {
    if (Array.isArray(text)) {
        if (text.length === 0) return "";
        return text[Math.floor(Math.random() * text.length)] ?? "";
    }
    return text;
}

const CHROME_STYLE_ID = "doki-live2d-widget-chrome-style";

const CHROME_CSS = `
.doki-live2d-chrome {
  position: relative;
  display: inline-block;
  line-height: 0;
  pointer-events: none;
}
.doki-live2d-chrome__tips {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: calc(100% - 12px);
  z-index: 2;
  box-sizing: border-box;
  min-height: 2.5rem;
  padding: 0.45rem 0.65rem;
  border-radius: 0.65rem;
  border: 1px solid color-mix(in srgb, #c4a574 55%, transparent);
  background: color-mix(in srgb, #f3e6d0 82%, transparent);
  color: #3a2a1a;
  font: 0.82rem/1.45 ui-sans-serif, system-ui, sans-serif;
  word-break: break-word;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}
.doki-live2d-chrome__tips.is-active {
  opacity: 1;
}
.doki-live2d-chrome__tools {
  position: absolute;
  right: 0;
  bottom: 12px;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  pointer-events: auto;
}
.doki-live2d-chrome__tool {
  width: 2rem;
  height: 2rem;
  border: 0;
  border-radius: 999px;
  background: color-mix(in srgb, #2a2118 78%, transparent);
  color: #f7efe4;
  font: 0.72rem/1 ui-sans-serif, system-ui, sans-serif;
  cursor: pointer;
}
.doki-live2d-chrome__tool:hover {
  background: #2a2118;
}
.doki-live2d-chrome canvas {
  pointer-events: auto;
  touch-action: none;
  cursor: grab;
}
`;

export function ensureChromeStyles(doc: Document = document): void {
    if (doc.getElementById(CHROME_STYLE_ID)) return;
    const style = doc.createElement("style");
    style.id = CHROME_STYLE_ID;
    style.textContent = CHROME_CSS;
    doc.head.appendChild(style);
}

export function createTipMessage(root: HTMLElement): TipMessage {
    const tips = document.createElement("div");
    tips.className = "doki-live2d-chrome__tips";
    tips.setAttribute("role", "status");
    root.appendChild(tips);

    let timer = 0;
    let priority = 0;

    return {
        show(text, timeoutMs = 4000, nextPriority = 1) {
            const line = pick(text);
            if (!line) return;
            if (
                tips.classList.contains("is-active") &&
                nextPriority < priority
            ) {
                return;
            }
            priority = nextPriority;
            tips.textContent = line;
            tips.classList.add("is-active");
            if (timer) window.clearTimeout(timer);
            timer = window.setTimeout(() => {
                tips.classList.remove("is-active");
                priority = 0;
                timer = 0;
            }, timeoutMs);
        },
        clear() {
            if (timer) window.clearTimeout(timer);
            timer = 0;
            priority = 0;
            tips.classList.remove("is-active");
            tips.textContent = "";
        },
        destroy() {
            this.clear();
            tips.remove();
        },
    };
}

export interface ChromeSession {
    root: HTMLElement;
    tips: TipMessage | null;
    destroy(): void;
}

function bindPageTips(tips: TipMessage): () => void {
    const onCopy = () => {
        tips.show("复制成功——记得注明出处呀。", 4000, 2);
    };
    const onVisibility = () => {
        if (document.visibilityState === "visible") {
            tips.show("你回来啦，想我了吗？", 4000, 2);
        }
    };
    document.addEventListener("copy", onCopy);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
        document.removeEventListener("copy", onCopy);
        document.removeEventListener("visibilitychange", onVisibility);
    };
}

async function fetchHitokoto(api: string): Promise<string> {
    const res = await fetch(api);
    if (!res.ok) throw new Error(`hitokoto HTTP ${res.status}`);
    const data = (await res.json()) as { hitokoto?: string; from?: string };
    if (!data.hitokoto) throw new Error("hitokoto empty");
    return data.from ? `${data.hitokoto} —— ${data.from}` : data.hitokoto;
}

function toolLabel(id: WidgetToolId): string {
    switch (id) {
        case "hitokoto":
            return "言";
        case "photo":
            return "拍";
        case "quit":
            return "×";
    }
}

export function mountChrome(options: {
    host: HTMLElement;
    canvas: HTMLCanvasElement;
    chrome: boolean | WidgetChromeOptions;
    getCanvas: () => HTMLCanvasElement | null;
}): ChromeSession | null {
    if (!options.chrome) return null;
    const cfg: WidgetChromeOptions =
        options.chrome === true ? {} : options.chrome;
    const tipsEnabled = cfg.tips !== false;
    const tools =
        cfg.tools ?? (["hitokoto", "photo", "quit"] as WidgetToolId[]);

    ensureChromeStyles();

    const root = document.createElement("div");
    root.className = "doki-live2d-chrome";
    options.host.replaceChildren(root);
    root.appendChild(options.canvas);

    const tips = tipsEnabled ? createTipMessage(root) : null;
    const unbindTips = tips ? bindPageTips(tips) : () => {};

    if (tips) {
        tips.show(cfg.welcome ?? DEFAULT_WELCOME, 5000, 3);
    }

    let toolsEl: HTMLElement | null = null;
    if (tools.length > 0) {
        toolsEl = document.createElement("div");
        toolsEl.className = "doki-live2d-chrome__tools";
        for (const id of tools) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "doki-live2d-chrome__tool";
            btn.dataset.tool = id;
            btn.title = id;
            btn.textContent = toolLabel(id);
            btn.addEventListener("click", () => {
                void (async () => {
                    if (id === "hitokoto") {
                        try {
                            const line = await fetchHitokoto(
                                cfg.hitokotoApi ?? "https://v1.hitokoto.cn",
                            );
                            tips?.show(line, 6000, 9);
                        } catch {
                            tips?.show("一言获取失败，稍后再试。", 3000, 9);
                        }
                        return;
                    }
                    if (id === "photo") {
                        const canvas = options.getCanvas();
                        if (!canvas) return;
                        tips?.show("咔嚓——照片保存中。", 3000, 8);
                        const url = canvas.toDataURL("image/png");
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "live2d-photo.png";
                        a.click();
                        return;
                    }
                    if (id === "quit") {
                        tips?.show("再见啦，想我的时候再叫我。", 2000, 9);
                        options.host.style.display = "none";
                        cfg.onQuit?.();
                    }
                })();
            });
            toolsEl.appendChild(btn);
        }
        root.appendChild(toolsEl);
    }

    return {
        root,
        tips,
        destroy() {
            unbindTips();
            tips?.destroy();
            toolsEl?.remove();
            root.remove();
        },
    };
}

export { DEFAULT_WELCOME };
