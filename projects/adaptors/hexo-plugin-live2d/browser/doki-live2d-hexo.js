"use strict";
(() => {
  // ../../live2d-widget/src/chrome.ts
  var DEFAULT_WELCOME = [
    "\u4F60\u597D\uFF01\u6211\u662F\u770B\u677F\u5A18\uFF0C\u4ECA\u5929\u4E5F\u8981\u52A0\u6CB9\u54E6\u3002",
    "\u6B22\u8FCE\u56DE\u6765\u2014\u2014\u70B9\u6211\u6216\u8005\u7528\u5DE5\u5177\u680F\u8DDF\u6211\u4E92\u52A8\u5427\u3002"
  ];
  function pick(text) {
    if (Array.isArray(text)) {
      if (text.length === 0) return "";
      return text[Math.floor(Math.random() * text.length)] ?? "";
    }
    return text;
  }
  var CHROME_STYLE_ID = "doki-live2d-widget-chrome-style";
  var CHROME_CSS = `
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
  function ensureChromeStyles(doc = document) {
    if (doc.getElementById(CHROME_STYLE_ID)) return;
    const style = doc.createElement("style");
    style.id = CHROME_STYLE_ID;
    style.textContent = CHROME_CSS;
    doc.head.appendChild(style);
  }
  function createTipMessage(root) {
    const tips = document.createElement("div");
    tips.className = "doki-live2d-chrome__tips";
    tips.setAttribute("role", "status");
    root.appendChild(tips);
    let timer = 0;
    let priority = 0;
    return {
      show(text, timeoutMs = 4e3, nextPriority = 1) {
        const line = pick(text);
        if (!line) return;
        if (tips.classList.contains("is-active") && nextPriority < priority) {
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
      }
    };
  }
  function bindPageTips(tips) {
    const onCopy = () => {
      tips.show("\u590D\u5236\u6210\u529F\u2014\u2014\u8BB0\u5F97\u6CE8\u660E\u51FA\u5904\u5440\u3002", 4e3, 2);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        tips.show("\u4F60\u56DE\u6765\u5566\uFF0C\u60F3\u6211\u4E86\u5417\uFF1F", 4e3, 2);
      }
    };
    document.addEventListener("copy", onCopy);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }
  async function fetchHitokoto(api) {
    const res = await fetch(api);
    if (!res.ok) throw new Error(`hitokoto HTTP ${res.status}`);
    const data = await res.json();
    if (!data.hitokoto) throw new Error("hitokoto empty");
    return data.from ? `${data.hitokoto} \u2014\u2014 ${data.from}` : data.hitokoto;
  }
  function toolLabel(id) {
    switch (id) {
      case "hitokoto":
        return "\u8A00";
      case "photo":
        return "\u62CD";
      case "quit":
        return "\xD7";
    }
  }
  function mountChrome(options) {
    if (!options.chrome) return null;
    const cfg2 = options.chrome === true ? {} : options.chrome;
    const tipsEnabled = cfg2.tips !== false;
    const tools = cfg2.tools ?? ["hitokoto", "photo", "quit"];
    ensureChromeStyles();
    const root = document.createElement("div");
    root.className = "doki-live2d-chrome";
    options.host.replaceChildren(root);
    root.appendChild(options.canvas);
    const tips = tipsEnabled ? createTipMessage(root) : null;
    const unbindTips = tips ? bindPageTips(tips) : () => {
    };
    if (tips) {
      tips.show(cfg2.welcome ?? DEFAULT_WELCOME, 5e3, 3);
    }
    let toolsEl = null;
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
                  cfg2.hitokotoApi ?? "https://v1.hitokoto.cn"
                );
                tips?.show(line, 6e3, 9);
              } catch {
                tips?.show("\u4E00\u8A00\u83B7\u53D6\u5931\u8D25\uFF0C\u7A0D\u540E\u518D\u8BD5\u3002", 3e3, 9);
              }
              return;
            }
            if (id === "photo") {
              const canvas = options.getCanvas();
              if (!canvas) return;
              tips?.show("\u5494\u5693\u2014\u2014\u7167\u7247\u4FDD\u5B58\u4E2D\u3002", 3e3, 8);
              const url = canvas.toDataURL("image/png");
              const a = document.createElement("a");
              a.href = url;
              a.download = "live2d-photo.png";
              a.click();
              return;
            }
            if (id === "quit") {
              tips?.show("\u518D\u89C1\u5566\uFF0C\u60F3\u6211\u7684\u65F6\u5019\u518D\u53EB\u6211\u3002", 2e3, 9);
              options.host.style.display = "none";
              cfg2.onQuit?.();
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
      }
    };
  }

  // ../../live2d-core/src/contracts.ts
  function modelSourceUrl(source) {
    if (typeof source === "string") return source;
    if (source.kind === "url") return source.url;
    if (source.kind === "npm") {
      const path = source.path.replace(/^\/+/, "");
      return `npm:${source.package}/${path}`;
    }
    return source.baseUrl;
  }

  // ../../live2d-core/src/detect-format.ts
  function detectModelSettingsFormat(json) {
    if (!json || typeof json !== "object") return null;
    const o = json;
    const fileRefs = o.FileReferences;
    if (fileRefs && typeof fileRefs === "object") {
      const moc = fileRefs.Moc;
      if (typeof moc === "string") {
        const lower = moc.toLowerCase();
        if (lower.endsWith(".moc3") || lower.endsWith(".program.json")) {
          return "moc3";
        }
        if (lower.endsWith(".moc")) {
          return "moc2";
        }
        return "moc3";
      }
    }
    if (typeof o.model === "string" && Array.isArray(o.textures)) {
      return "moc2";
    }
    return null;
  }

  // ../../live2d-core/src/events.ts
  var EventEmitter = class {
    #listeners = /* @__PURE__ */ new Map();
    on(event, listener) {
      const set = this.#listeners.get(event) ?? /* @__PURE__ */ new Set();
      set.add(listener);
      this.#listeners.set(event, set);
      return () => this.off(event, listener);
    }
    off(event, listener) {
      this.#listeners.get(event)?.delete(listener);
    }
    emit(event, payload) {
      for (const listener of this.#listeners.get(event) ?? []) {
        listener(payload);
      }
    }
    clear() {
      this.#listeners.clear();
    }
  };

  // ../../live2d-core/src/frame.ts
  var FrameBlendMode = {
    Normal: 0,
    Additive: 1,
    Multiplicative: 2
  };

  // ../../live2d-loader/src/fetch-progress.ts
  function safeProgress(onProgress, update) {
    if (!onProgress) return;
    try {
      onProgress(update);
    } catch {
    }
  }
  async function fetchArrayBufferWithProgress(url, onProgress) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(
        `@doki-land/live2d-loader: failed to fetch bytes (${res.status}): ${url}`
      );
    }
    const totalHeader = res.headers.get("content-length");
    const bytesTotal = totalHeader ? Number(totalHeader) : null;
    const preferBuffer = !res.body || !onProgress || bytesTotal !== null && Number.isFinite(bytesTotal) && bytesTotal >= 0;
    if (preferBuffer) {
      safeProgress(onProgress, { bytesLoaded: 0, bytesTotal });
      const buf = await res.arrayBuffer();
      safeProgress(onProgress, {
        bytesLoaded: buf.byteLength,
        bytesTotal: bytesTotal ?? buf.byteLength
      });
      return buf;
    }
    const reader = res.body.getReader();
    const chunks = [];
    let bytesLoaded = 0;
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        bytesLoaded += value.byteLength;
        safeProgress(onProgress, { bytesLoaded, bytesTotal });
      }
    }
    const out = new Uint8Array(bytesLoaded);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.byteLength;
    }
    safeProgress(onProgress, {
      bytesLoaded,
      bytesTotal: bytesTotal ?? bytesLoaded
    });
    return out.buffer;
  }
  async function fetchJsonWithProgress(url, onProgress) {
    const bytes = await fetchArrayBufferWithProgress(url, onProgress);
    const text = new TextDecoder().decode(bytes);
    return JSON.parse(text);
  }

  // ../../live2d-loader/src/pipeline.ts
  function resolveAssetUrl(baseUrl, relative) {
    if (/^(?:[a-z]+:)?\/\//i.test(relative) || relative.startsWith("data:")) {
      return relative;
    }
    try {
      return new URL(relative, baseUrl).href;
    } catch {
      const slash = baseUrl.lastIndexOf("/");
      const dir = slash >= 0 ? baseUrl.slice(0, slash + 1) : "";
      return `${dir}${relative}`;
    }
  }
  function createUrlAssetResolver(baseUrl, options = {}) {
    return {
      baseUrl,
      resolve(key) {
        return resolveAssetUrl(baseUrl, key);
      },
      async fetchJson(key) {
        const url = resolveAssetUrl(baseUrl, key);
        return fetchJsonWithProgress(url, (update) => {
          options.onBytesProgress?.(key, update);
        });
      },
      async fetchBytes(key) {
        const url = resolveAssetUrl(baseUrl, key);
        return fetchArrayBufferWithProgress(url, (update) => {
          options.onBytesProgress?.(key, update);
        });
      }
    };
  }
  async function fetchModelJson(url, onProgress) {
    return fetchJsonWithProgress(url, onProgress);
  }
  function detectModelFormat(json) {
    if (!json || typeof json !== "object") {
      throw new Error(
        "@doki-land/live2d-loader: model json must be an object"
      );
    }
    const format = detectModelSettingsFormat(json);
    if (!format) {
      throw new Error(
        "@doki-land/live2d-loader: unrecognized Live2D model json"
      );
    }
    return format;
  }
  function asStringArray(value) {
    if (!Array.isArray(value)) return [];
    return value.filter((v) => typeof v === "string");
  }
  function normalizeModelSettings(json, url) {
    const format = detectModelFormat(json);
    const o = json;
    if (format === "moc3") {
      const fileRefs = o.FileReferences;
      const moc = fileRefs.Moc;
      const textures = asStringArray(fileRefs.Textures);
      const motionGroups = {};
      const motions = fileRefs.Motions;
      if (motions && typeof motions === "object") {
        for (const [group, list] of Object.entries(
          motions
        )) {
          if (!Array.isArray(list)) continue;
          motionGroups[group] = list.map((item) => {
            if (!item || typeof item !== "object") return null;
            const file = item.File;
            if (typeof file !== "string") return null;
            const def = { file };
            const sound = item.Sound;
            if (typeof sound === "string") def.sound = sound;
            const fadeIn = item.FadeInTime;
            if (typeof fadeIn === "number") def.fadeInTime = fadeIn;
            const fadeOut = item.FadeOutTime;
            if (typeof fadeOut === "number")
              def.fadeOutTime = fadeOut;
            return def;
          }).filter((x) => x !== null);
        }
      }
      const expressions = [];
      const expr = fileRefs.Expressions;
      if (Array.isArray(expr)) {
        for (const item of expr) {
          if (!item || typeof item !== "object") continue;
          const name = item.Name;
          const file = item.File;
          if (typeof name === "string" && typeof file === "string") {
            expressions.push({ name, file });
          }
        }
      }
      const hitAreas = [];
      if (Array.isArray(o.HitAreas)) {
        for (const item of o.HitAreas) {
          if (!item || typeof item !== "object") continue;
          const name = item.Name;
          const id = item.Id;
          if (typeof name === "string" && typeof id === "string") {
            hitAreas.push({ name, id });
          }
        }
      }
      return {
        format: "moc3",
        url,
        name: typeof o.Name === "string" ? o.Name : void 0,
        moc,
        textures,
        motionGroups,
        expressions,
        physics: typeof fileRefs.Physics === "string" ? fileRefs.Physics : void 0,
        pose: typeof fileRefs.Pose === "string" ? fileRefs.Pose : void 0,
        hitAreas
      };
    }
    return {
      format: "moc2",
      url,
      moc: o.model,
      textures: asStringArray(o.textures),
      motionGroups: {},
      expressions: [],
      hitAreas: []
    };
  }

  // ../../live2d-loader/src/resolve-source.ts
  var DEFAULT_NPM_CDN = "https://cdn.jsdelivr.net/npm";
  function resolveNpmSpecifier(spec, cdnBase = DEFAULT_NPM_CDN) {
    const trimmed = spec.trim().replace(/^\/+/, "");
    if (!trimmed) {
      throw new Error("@doki-land/live2d-loader: empty npm model specifier");
    }
    let pkg = "";
    let version = null;
    let assetPath = "";
    if (trimmed.startsWith("@")) {
      const scopeSlash = trimmed.indexOf("/");
      if (scopeSlash < 0) {
        throw new Error(
          `@doki-land/live2d-loader: scoped npm specifier needs /name: ${spec}`
        );
      }
      const afterScope = trimmed.slice(scopeSlash + 1);
      const at = afterScope.indexOf("@");
      const slash = afterScope.indexOf("/");
      if (at >= 0 && (slash < 0 || at < slash)) {
        pkg = `${trimmed.slice(0, scopeSlash + 1)}${afterScope.slice(0, at)}`;
        const rest = afterScope.slice(at + 1);
        const pathSlash = rest.indexOf("/");
        if (pathSlash < 0) {
          version = rest;
        } else {
          version = rest.slice(0, pathSlash);
          assetPath = rest.slice(pathSlash + 1);
        }
      } else if (slash >= 0) {
        pkg = `${trimmed.slice(0, scopeSlash + 1)}${afterScope.slice(0, slash)}`;
        assetPath = afterScope.slice(slash + 1);
      } else {
        pkg = trimmed;
      }
    } else {
      const at = trimmed.indexOf("@");
      const slash = trimmed.indexOf("/");
      if (at >= 0 && (slash < 0 || at < slash)) {
        pkg = trimmed.slice(0, at);
        const rest = trimmed.slice(at + 1);
        const pathSlash = rest.indexOf("/");
        if (pathSlash < 0) {
          version = rest;
        } else {
          version = rest.slice(0, pathSlash);
          assetPath = rest.slice(pathSlash + 1);
        }
      } else if (slash >= 0) {
        pkg = trimmed.slice(0, slash);
        assetPath = trimmed.slice(slash + 1);
      } else {
        pkg = trimmed;
      }
    }
    if (!pkg) {
      throw new Error(
        `@doki-land/live2d-loader: invalid npm model specifier: ${spec}`
      );
    }
    if (!assetPath) {
      throw new Error(
        `@doki-land/live2d-loader: npm model specifier needs an asset path (got "${spec}")`
      );
    }
    const base = cdnBase.replace(/\/+$/, "");
    const nameWithVersion = version ? `${pkg}@${version}` : pkg;
    return `${base}/${nameWithVersion}/${assetPath.replace(/^\/+/, "")}`;
  }
  function resolveModelSourceUrl(source, options = {}) {
    if (source.startsWith("npm:")) {
      return resolveNpmSpecifier(
        source.slice("npm:".length),
        options.npmCdnBase ?? DEFAULT_NPM_CDN
      );
    }
    return source;
  }

  // ../../live2d-renderer/src/types.ts
  var BlendMode = {
    Normal: 0,
    Additive: 1,
    Multiplicative: 2
  };

  // ../../live2d-renderer/src/blend.ts
  function applyWebGl2BlendMode(gl, mode) {
    gl.enable(gl.BLEND);
    switch (mode) {
      case BlendMode.Additive:
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ZERO, gl.ONE);
        break;
      case BlendMode.Multiplicative:
        gl.blendFuncSeparate(
          gl.DST_COLOR,
          gl.ONE_MINUS_SRC_ALPHA,
          gl.ZERO,
          gl.ONE
        );
        break;
      default:
        gl.blendFuncSeparate(
          gl.SRC_ALPHA,
          gl.ONE_MINUS_SRC_ALPHA,
          gl.ONE,
          gl.ONE_MINUS_SRC_ALPHA
        );
        break;
    }
  }
  function canvasCompositeForBlendMode(mode) {
    switch (mode) {
      case BlendMode.Additive:
        return "lighter";
      case BlendMode.Multiplicative:
        return "multiply";
      default:
        return "source-over";
    }
  }
  function webGpuBlendState(mode) {
    switch (mode) {
      case BlendMode.Additive:
        return {
          color: {
            srcFactor: "src-alpha",
            dstFactor: "one",
            operation: "add"
          },
          alpha: {
            srcFactor: "zero",
            dstFactor: "one",
            operation: "add"
          }
        };
      case BlendMode.Multiplicative:
        return {
          color: {
            srcFactor: "dst",
            dstFactor: "one-minus-src-alpha",
            operation: "add"
          },
          alpha: {
            srcFactor: "zero",
            dstFactor: "one",
            operation: "add"
          }
        };
      default:
        return {
          color: {
            srcFactor: "src-alpha",
            dstFactor: "one-minus-src-alpha",
            operation: "add"
          },
          alpha: {
            srcFactor: "one",
            dstFactor: "one-minus-src-alpha",
            operation: "add"
          }
        };
    }
  }

  // ../../live2d-renderer/src/clipping.ts
  var MASK_CHANNEL_FLAGS = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1]
  ];
  var FULL_NDC_BOUNDS = {
    x: -1,
    y: -1,
    width: 2,
    height: 2
  };
  function maskKey(maskIndices, invertedMask) {
    const sorted = [...maskIndices].sort((a, b) => a - b);
    return `${invertedMask ? "i" : "n"}:${sorted.join(",")}`;
  }
  function buildClippingContexts(drawables) {
    const byKey = /* @__PURE__ */ new Map();
    for (const d of drawables) {
      if (!d.maskIndices.length) continue;
      const key = maskKey(d.maskIndices, d.invertedMask);
      let ctx = byKey.get(key);
      if (!ctx) {
        ctx = {
          maskIndices: [...d.maskIndices].sort((a, b) => a - b),
          clippedIndices: [],
          invertedMask: d.invertedMask
        };
        byKey.set(key, ctx);
      }
      ctx.clippedIndices.push(d.index);
    }
    return [...byKey.entries()].map(([key, ctx]) => ({
      key,
      maskIndices: ctx.maskIndices,
      clippedIndices: ctx.clippedIndices,
      invertedMask: ctx.invertedMask
    }));
  }
  function withAlphaChannel(ctx, layout) {
    return {
      ...ctx,
      layout,
      channelIndex: 3,
      channelFlag: MASK_CHANNEL_FLAGS[3],
      bufferIndex: 0,
      modelBounds: FULL_NDC_BOUNDS
    };
  }
  function layoutMaskAtlasUvGrid(contexts, options = {}) {
    const n = contexts.length;
    if (n === 0) return [];
    const inset = options.inset ?? 0.02;
    if (n === 1) {
      const pad = inset * 0.5;
      return [
        withAlphaChannel(contexts[0], {
          x: pad,
          y: pad,
          width: 1 - inset,
          height: 1 - inset
        })
      ];
    }
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const cellW = 1 / cols;
    const cellH = 1 / rows;
    return contexts.map((ctx, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const padX = cellW * inset * 0.5;
      const padY = cellH * inset * 0.5;
      return withAlphaChannel(ctx, {
        x: col * cellW + padX,
        y: row * cellH + padY,
        width: cellW * (1 - inset),
        height: cellH * (1 - inset)
      });
    });
  }
  var COLOR_CHANNEL_COUNT = 4;
  var CLIPPING_MASK_MAX_DEFAULT = 36;
  var CLIPPING_MASK_MAX_MULTI = 32;
  function cubismCellBounds(layoutCount, i, layoutCountMax) {
    if (layoutCount === 1) {
      return { x: 0, y: 0, width: 1, height: 1 };
    }
    if (layoutCount === 2) {
      const xpos = i % 2;
      return { x: xpos * 0.5, y: 0, width: 0.5, height: 1 };
    }
    if (layoutCount <= 4) {
      const xpos = i % 2;
      const ypos = Math.floor(i / 2);
      return { x: xpos * 0.5, y: ypos * 0.5, width: 0.5, height: 0.5 };
    }
    if (layoutCount <= layoutCountMax) {
      const xpos = i % 3;
      const ypos = Math.floor(i / 3);
      return {
        x: xpos / 3,
        y: ypos / 3,
        width: 1 / 3,
        height: 1 / 3
      };
    }
    return { x: 0, y: 0, width: 1, height: 1 };
  }
  function layoutMaskAtlasRgba(contexts, options = {}) {
    const n = contexts.length;
    if (n === 0) return [];
    const renderTextureCount = Math.max(1, options.renderTextureCount ?? 1);
    const maxCount = renderTextureCount <= 1 ? CLIPPING_MASK_MAX_DEFAULT : CLIPPING_MASK_MAX_MULTI * renderTextureCount;
    const layoutCountMax = renderTextureCount <= 1 ? 9 : 8;
    if (n > maxCount) {
      return contexts.map((ctx) => ({
        ...ctx,
        layout: { x: 0, y: 0, width: 1, height: 1 },
        channelIndex: 0,
        channelFlag: MASK_CHANNEL_FLAGS[0],
        bufferIndex: 0,
        modelBounds: FULL_NDC_BOUNDS
      }));
    }
    const countPerSheetDiv = Math.ceil(n / renderTextureCount);
    const reduceLayoutTextureCount = n % renderTextureCount;
    const divCount = Math.floor(countPerSheetDiv / COLOR_CHANNEL_COUNT);
    const modCount = countPerSheetDiv % COLOR_CHANNEL_COUNT;
    const out = [];
    let cur = 0;
    for (let rt = 0; rt < renderTextureCount; rt++) {
      for (let channelIndex = 0; channelIndex < COLOR_CHANNEL_COUNT; channelIndex++) {
        let layoutCount = divCount + (channelIndex < modCount ? 1 : 0);
        const checkChannelIndex = modCount + (divCount < 1 ? -1 : 0);
        if (channelIndex === checkChannelIndex && reduceLayoutTextureCount > 0) {
          layoutCount -= rt < reduceLayoutTextureCount ? 0 : 1;
        }
        if (layoutCount <= 0) continue;
        for (let i = 0; i < layoutCount; i++) {
          const ctx = contexts[cur++];
          if (!ctx) return out;
          out.push({
            ...ctx,
            layout: cubismCellBounds(layoutCount, i, layoutCountMax),
            channelIndex,
            channelFlag: MASK_CHANNEL_FLAGS[channelIndex],
            bufferIndex: rt,
            modelBounds: FULL_NDC_BOUNDS
          });
        }
      }
    }
    return out;
  }
  function layoutMaskAtlas(contexts, options = {}) {
    const mode = options.mode ?? "rgba";
    if (mode === "uv-grid") {
      return layoutMaskAtlasUvGrid(contexts, { inset: options.inset });
    }
    return layoutMaskAtlasRgba(contexts, {
      renderTextureCount: options.renderTextureCount
    });
  }
  function partitionForClipping(drawables, options = {}) {
    const contexts = layoutMaskAtlas(buildClippingContexts(drawables), options);
    const clipped = /* @__PURE__ */ new Set();
    const maskOnly = /* @__PURE__ */ new Set();
    for (const ctx of contexts) {
      for (const i of ctx.clippedIndices) clipped.add(i);
      for (const m of ctx.maskIndices) maskOnly.add(m);
    }
    return { contexts, clipped, maskOnly };
  }
  function calcVertexBounds(positions) {
    if (positions.length < 2) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i + 1 < positions.length; i += 2) {
      const x = positions[i];
      const y = positions[i + 1];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
    const width = maxX - minX;
    const height = maxY - minY;
    if (width <= 0 || height <= 0) return null;
    return { x: minX, y: minY, width, height };
  }
  function expandBounds(bounds, margin = 0.05) {
    const dx = bounds.width * margin;
    const dy = bounds.height * margin;
    return {
      x: bounds.x - dx,
      y: bounds.y - dy,
      width: bounds.width + dx * 2,
      height: bounds.height + dy * 2
    };
  }
  function calcClippedDrawableBounds(clippedIndices, byIndex, margin = 0.05) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let any = false;
    for (const id of clippedIndices) {
      const mesh = byIndex.get(id);
      if (!mesh) continue;
      const b = calcVertexBounds(mesh.vertexPositions);
      if (!b) continue;
      any = true;
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.x + b.width > maxX) maxX = b.x + b.width;
      if (b.y + b.height > maxY) maxY = b.y + b.height;
    }
    if (!any) return FULL_NDC_BOUNDS;
    return expandBounds(
      { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
      margin
    );
  }
  function fitClippingContexts(contexts, byIndex, margin = 0.05) {
    return contexts.map((ctx) => ({
      ...ctx,
      modelBounds: calcClippedDrawableBounds(
        ctx.clippedIndices,
        byIndex,
        margin
      )
    }));
  }
  function maskLayoutVec4(layout) {
    return new Float32Array([layout.x, layout.y, layout.width, layout.height]);
  }
  function maskChannelVec4(flag) {
    return new Float32Array([flag[0], flag[1], flag[2], flag[3]]);
  }

  // ../../live2d-renderer/src/coords.ts
  function modelYUpToCanvasPixelY(modelY, canvasHeight) {
    return (1 - modelY) * (canvasHeight / 2);
  }
  function modelXToCanvasPixelX(modelX, canvasWidth) {
    return (modelX + 1) * (canvasWidth / 2);
  }

  // ../../live2d-renderer/src/preview-style.ts
  var PREVIEW_FILL = {
    r: 91 / 255,
    g: 141 / 255,
    b: 239 / 255,
    a: 1
  };
  var PREVIEW_STROKE = {
    r: 27 / 255,
    g: 58 / 255,
    b: 107 / 255,
    a: 1
  };
  function triangleEdgesToLineList(indices) {
    const out = new Uint16Array(Math.floor(indices.length / 3) * 6);
    let o = 0;
    for (let i = 0; i + 2 < indices.length; i += 3) {
      const a = indices[i];
      const b = indices[i + 1];
      const c = indices[i + 2];
      out[o++] = a;
      out[o++] = b;
      out[o++] = b;
      out[o++] = c;
      out[o++] = c;
      out[o++] = a;
    }
    return out;
  }

  // ../../live2d-renderer/src/backends/canvas2d.ts
  var DEFAULT_FILL = "#5b8def";
  var DEFAULT_STROKE = "#1b3a6b";
  function ndcBoundsToPixels(b, w, h) {
    const x0 = (b.x + 1) * 0.5 * w;
    const x1 = (b.x + b.width + 1) * 0.5 * w;
    const yTop = (1 - (b.y + b.height)) * 0.5 * h;
    const yBot = (1 - b.y) * 0.5 * h;
    return {
      x: x0,
      y: yTop,
      width: Math.max(1, x1 - x0),
      height: Math.max(1, yBot - yTop)
    };
  }
  function expandTriangle(x0, y0, x1, y1, x2, y2, pixels) {
    const cx = (x0 + x1 + x2) / 3;
    const cy = (y0 + y1 + y2) / 3;
    const push = (x, y) => {
      const dx = x - cx;
      const dy = y - cy;
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) return [x, y];
      const s = (len + pixels) / len;
      return [cx + dx * s, cy + dy * s];
    };
    const [ex0, ey0] = push(x0, y0);
    const [ex1, ey1] = push(x1, y1);
    const [ex2, ey2] = push(x2, y2);
    return [ex0, ey0, ex1, ey1, ex2, ey2];
  }
  function drawTexturedTriangle(ctx, image, imgW, imgH, x0, y0, x1, y1, x2, y2, u0, v0, u1, v1, u2, v2) {
    const sx0 = u0 * imgW;
    const sy0 = v0 * imgH;
    const sx1 = u1 * imgW;
    const sy1 = v1 * imgH;
    const sx2 = u2 * imgW;
    const sy2 = v2 * imgH;
    const [cx0, cy0, cx1, cy1, cx2, cy2] = expandTriangle(
      x0,
      y0,
      x1,
      y1,
      x2,
      y2,
      0.75
    );
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx0, cy0);
    ctx.lineTo(cx1, cy1);
    ctx.lineTo(cx2, cy2);
    ctx.closePath();
    ctx.clip();
    const denom = sx0 * (sy1 - sy2) + sx1 * (sy2 - sy0) + sx2 * (sy0 - sy1);
    if (Math.abs(denom) < 1e-8) {
      ctx.restore();
      return;
    }
    const m11 = (x0 * (sy1 - sy2) + x1 * (sy2 - sy0) + x2 * (sy0 - sy1)) / denom;
    const m12 = (y0 * (sy1 - sy2) + y1 * (sy2 - sy0) + y2 * (sy0 - sy1)) / denom;
    const m21 = (x0 * (sx2 - sx1) + x1 * (sx0 - sx2) + x2 * (sx1 - sx0)) / denom;
    const m22 = (y0 * (sx2 - sx1) + y1 * (sx0 - sx2) + y2 * (sx1 - sx0)) / denom;
    const dx = (x0 * (sx1 * sy2 - sx2 * sy1) + x1 * (sx2 * sy0 - sx0 * sy2) + x2 * (sx0 * sy1 - sx1 * sy0)) / denom;
    const dy = (y0 * (sx1 * sy2 - sx2 * sy1) + y1 * (sx2 * sy0 - sx0 * sy2) + y2 * (sx0 * sy1 - sx1 * sy0)) / denom;
    ctx.setTransform(m11, m12, m21, m22, dx, dy);
    ctx.drawImage(image, -1, -1, imgW + 2, imgH + 2);
    ctx.restore();
  }
  function rgbaCss(c) {
    return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${c.a})`;
  }
  var Canvas2DModelDrawPass = class {
    #ctx;
    #options;
    #textures = [];
    constructor(ctx, options) {
      this.#ctx = ctx;
      this.#options = options;
    }
    setTextures(textures) {
      let maxIndex = -1;
      for (const t of textures) maxIndex = Math.max(maxIndex, t.index);
      this.#textures = new Array(Math.max(0, maxIndex + 1)).fill(null);
      for (const t of textures) this.#textures[t.index] = t;
    }
    draw(drawables, _modelMatrix) {
      const ctx = this.#ctx;
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      const byIndex = /* @__PURE__ */ new Map();
      for (const d of drawables) byIndex.set(d.index, d);
      const partitioned = partitionForClipping(drawables, {
        mode: "uv-grid"
      });
      const contexts = fitClippingContexts(partitioned.contexts, byIndex);
      const { maskOnly } = partitioned;
      if (contexts.length === 0) {
        for (const d of drawables) {
          if (maskOnly.has(d.index)) continue;
          this.#drawOne(ctx, d, w, h);
        }
        return;
      }
      const maskCanvas = document.createElement("canvas");
      maskCanvas.width = w;
      maskCanvas.height = h;
      const maskCtx = maskCanvas.getContext("2d");
      const scratchCanvas = document.createElement("canvas");
      scratchCanvas.width = w;
      scratchCanvas.height = h;
      const scratchCtx = scratchCanvas.getContext("2d");
      const layerCanvas = document.createElement("canvas");
      layerCanvas.width = w;
      layerCanvas.height = h;
      const layerCtx = layerCanvas.getContext("2d");
      const fullMaskCanvas = document.createElement("canvas");
      fullMaskCanvas.width = w;
      fullMaskCanvas.height = h;
      const fullMaskCtx = fullMaskCanvas.getContext("2d");
      if (!maskCtx || !scratchCtx || !layerCtx || !fullMaskCtx) return;
      maskCtx.setTransform(1, 0, 0, 1, 0, 0);
      maskCtx.clearRect(0, 0, w, h);
      for (const c of contexts) {
        scratchCtx.setTransform(1, 0, 0, 1, 0, 0);
        scratchCtx.clearRect(0, 0, w, h);
        for (const mi of c.maskIndices) {
          const maskMesh = byIndex.get(mi);
          if (maskMesh) this.#drawOne(scratchCtx, maskMesh, w, h);
        }
        const src = ndcBoundsToPixels(c.modelBounds, w, h);
        const L = c.layout;
        maskCtx.drawImage(
          scratchCanvas,
          src.x,
          src.y,
          src.width,
          src.height,
          L.x * w,
          L.y * h,
          L.width * w,
          L.height * h
        );
      }
      const layoutByClippedIndex = /* @__PURE__ */ new Map();
      for (const c of contexts) {
        for (const ci of c.clippedIndices) {
          layoutByClippedIndex.set(ci, {
            layout: c.layout,
            modelBounds: c.modelBounds,
            invertedMask: c.invertedMask
          });
        }
      }
      for (const d of drawables) {
        if (maskOnly.has(d.index)) continue;
        const clip = layoutByClippedIndex.get(d.index);
        if (!clip) {
          this.#drawOne(ctx, d, w, h);
          continue;
        }
        layerCtx.setTransform(1, 0, 0, 1, 0, 0);
        layerCtx.globalCompositeOperation = "source-over";
        layerCtx.clearRect(0, 0, w, h);
        this.#drawOne(layerCtx, d, w, h);
        fullMaskCtx.setTransform(1, 0, 0, 1, 0, 0);
        fullMaskCtx.clearRect(0, 0, w, h);
        const L = clip.layout;
        const dst = ndcBoundsToPixels(clip.modelBounds, w, h);
        fullMaskCtx.drawImage(
          maskCanvas,
          L.x * w,
          L.y * h,
          L.width * w,
          L.height * h,
          dst.x,
          dst.y,
          dst.width,
          dst.height
        );
        layerCtx.globalCompositeOperation = clip.invertedMask ? "destination-out" : "destination-in";
        layerCtx.drawImage(fullMaskCanvas, 0, 0);
        layerCtx.globalCompositeOperation = "source-over";
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(layerCanvas, 0, 0);
        ctx.restore();
      }
    }
    #drawOne(ctx, d, w, h) {
      if (!d.visible || d.opacity <= 0) return;
      const sx = w / 2;
      const sy = h / 2;
      const tex = this.#textures[d.textureIndex] ?? null;
      const pos = d.vertexPositions;
      const uvs = d.uvs;
      const idx = d.indices;
      if (tex) {
        ctx.save();
        ctx.globalAlpha = d.opacity;
        ctx.globalCompositeOperation = canvasCompositeForBlendMode(
          d.blendMode
        );
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        for (let i = 0; i + 2 < idx.length; i += 3) {
          const a = idx[i];
          const b = idx[i + 1];
          const c = idx[i + 2];
          const ax = modelXToCanvasPixelX(pos[a * 2], w);
          const ay = modelYUpToCanvasPixelY(pos[a * 2 + 1], h);
          const bx = modelXToCanvasPixelX(pos[b * 2], w);
          const by = modelYUpToCanvasPixelY(pos[b * 2 + 1], h);
          const cx = modelXToCanvasPixelX(pos[c * 2], w);
          const cy = modelYUpToCanvasPixelY(pos[c * 2 + 1], h);
          drawTexturedTriangle(
            ctx,
            tex.image,
            tex.width,
            tex.height,
            ax,
            ay,
            bx,
            by,
            cx,
            cy,
            uvs[a * 2] ?? 0,
            uvs[a * 2 + 1] ?? 0,
            uvs[b * 2] ?? 0,
            uvs[b * 2 + 1] ?? 0,
            uvs[c * 2] ?? 0,
            uvs[c * 2 + 1] ?? 0
          );
        }
        ctx.restore();
        return;
      }
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(sx, -sy);
      ctx.globalAlpha = d.opacity;
      ctx.globalCompositeOperation = canvasCompositeForBlendMode(d.blendMode);
      ctx.fillStyle = this.#options.fill ?? DEFAULT_FILL ?? rgbaCss(PREVIEW_FILL);
      ctx.strokeStyle = this.#options.stroke ?? DEFAULT_STROKE ?? rgbaCss(PREVIEW_STROKE);
      ctx.lineWidth = 2 / sx;
      for (let i = 0; i + 2 < idx.length; i += 3) {
        const i0 = idx[i] * 2;
        const i1 = idx[i + 1] * 2;
        const i2 = idx[i + 2] * 2;
        ctx.beginPath();
        ctx.moveTo(pos[i0], pos[i0 + 1]);
        ctx.lineTo(pos[i1], pos[i1 + 1]);
        ctx.lineTo(pos[i2], pos[i2 + 1]);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
    destroy() {
      this.#textures = [];
    }
  };
  var Canvas2DRendererImpl = class {
    kind = "canvas2d";
    #canvas = null;
    #ctx = null;
    #options;
    constructor(options = {}) {
      this.#options = options;
    }
    async initialize(canvas) {
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error(
          "@doki-land/live2d-renderer: Canvas2D is not available"
        );
      }
      this.#canvas = canvas;
      this.#ctx = ctx;
    }
    createModelDrawPass() {
      if (!this.#ctx) {
        throw new Error(
          "@doki-land/live2d-renderer: Canvas2D renderer not initialized"
        );
      }
      return new Canvas2DModelDrawPass(this.#ctx, this.#options);
    }
    beginFrame() {
      const ctx = this.#ctx;
      const canvas = this.#canvas;
      if (!ctx || !canvas) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    endFrame() {
    }
    resize(width, height) {
      if (!this.#canvas) return;
      this.#canvas.width = width;
      this.#canvas.height = height;
    }
    destroy() {
      this.#ctx = null;
      this.#canvas = null;
    }
  };
  function createCanvas2DRenderer(options) {
    return new Canvas2DRendererImpl(options);
  }

  // ../../live2d-renderer/src/backends/webgl2.ts
  var VS = `#version 300 es
layout(location = 0) in vec2 a_pos;
layout(location = 1) in vec2 a_uv;
out vec2 v_uv;
out vec2 v_pos;
void main() {
  v_uv = a_uv;
  v_pos = a_pos;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;
  var VS_MASK = `#version 300 es
layout(location = 0) in vec2 a_pos;
layout(location = 1) in vec2 a_uv;
uniform vec4 u_mask_layout; // xy offset, zw size in 0..1
uniform vec4 u_mask_bounds; // model-space xy min, zw size
out vec2 v_uv;
void main() {
  v_uv = a_uv;
  vec2 local = (a_pos - u_mask_bounds.xy) / max(u_mask_bounds.zw, vec2(1e-6));
  vec2 atlasUv = u_mask_layout.xy + local * u_mask_layout.zw;
  gl_Position = vec4(atlasUv * 2.0 - 1.0, 0.0, 1.0);
}
`;
  var FS = `#version 300 es
precision mediump float;
in vec2 v_uv;
in vec2 v_pos;
uniform sampler2D u_tex;
uniform sampler2D u_mask;
uniform vec4 u_color;
uniform vec4 u_mask_layout;
uniform vec4 u_mask_bounds;
uniform vec4 u_channel_flag;
uniform float u_use_texture;
uniform float u_opacity;
uniform float u_use_mask;
uniform float u_invert_mask;
out vec4 out_color;
void main() {
  vec4 base;
  if (u_use_texture > 0.5) {
    vec4 tex = texture(u_tex, v_uv);
    base = vec4(tex.rgb, tex.a * u_opacity);
  } else {
    base = u_color;
  }
  if (u_use_mask > 0.5) {
    vec2 local = (v_pos - u_mask_bounds.xy) / max(u_mask_bounds.zw, vec2(1e-6));
    vec2 muv = u_mask_layout.xy + local * u_mask_layout.zw;
    float m = dot(texture(u_mask, muv), u_channel_flag);
    if (u_invert_mask > 0.5) m = 1.0 - m;
    base.a *= m;
    base.rgb *= m;
  }
  out_color = base;
}
`;
  var FS_MASK = `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec4 u_channel_flag;
uniform float u_use_texture;
uniform float u_opacity;
out vec4 out_color;
void main() {
  float a = u_opacity;
  if (u_use_texture > 0.5) {
    a *= texture(u_tex, v_uv).a;
  }
  out_color = u_channel_flag * a;
}
`;
  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    if (!shader) {
      throw new Error("@doki-land/live2d-renderer: failed to create shader");
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader) ?? "compile failed";
      gl.deleteShader(shader);
      throw new Error(`@doki-land/live2d-renderer: ${info}`);
    }
    return shader;
  }
  function linkProgram(gl, vsSource, fsSource) {
    const vs = compile(gl, gl.VERTEX_SHADER, vsSource);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    if (!program) {
      throw new Error("@doki-land/live2d-renderer: failed to create program");
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program) ?? "link failed";
      gl.deleteProgram(program);
      throw new Error(`@doki-land/live2d-renderer: ${info}`);
    }
    return program;
  }
  function interleavePosUv(positions, uvs) {
    const n = Math.floor(positions.length / 2);
    const out = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      const p = i * 2;
      out[o] = positions[p];
      out[o + 1] = positions[p + 1];
      out[o + 2] = uvs[p] ?? 0;
      out[o + 3] = uvs[p + 1] ?? 0;
    }
    return out;
  }
  function requireUniform(gl, program, name) {
    const loc = gl.getUniformLocation(program, name);
    if (!loc) {
      throw new Error(
        `@doki-land/live2d-renderer: required uniform missing: ${name}`
      );
    }
    return loc;
  }
  var WebGl2ModelDrawPass = class {
    #gl;
    #program;
    #maskProgram;
    #colorLoc;
    #opacityLoc;
    #useTexLoc;
    #texLoc;
    #maskLoc;
    #useMaskLoc;
    #invertMaskLoc;
    #maskLayoutLoc;
    #maskBoundsLoc;
    #channelFlagLoc;
    #maskOpacityLoc;
    #maskUseTexLoc;
    #maskTexLoc;
    #maskWriteLayoutLoc;
    #maskWriteBoundsLoc;
    #maskWriteChannelLoc;
    #vao;
    #vbo;
    #ibo;
    #gpuTextures = [];
    #maskFbo = null;
    #maskTex = null;
    #maskW = 0;
    #maskH = 0;
    constructor(gl) {
      this.#gl = gl;
      this.#program = linkProgram(gl, VS, FS);
      this.#maskProgram = linkProgram(gl, VS_MASK, FS_MASK);
      this.#colorLoc = requireUniform(gl, this.#program, "u_color");
      this.#opacityLoc = requireUniform(gl, this.#program, "u_opacity");
      this.#useTexLoc = requireUniform(gl, this.#program, "u_use_texture");
      this.#texLoc = requireUniform(gl, this.#program, "u_tex");
      this.#maskLoc = requireUniform(gl, this.#program, "u_mask");
      this.#useMaskLoc = requireUniform(gl, this.#program, "u_use_mask");
      this.#invertMaskLoc = requireUniform(
        gl,
        this.#program,
        "u_invert_mask"
      );
      this.#maskLayoutLoc = requireUniform(
        gl,
        this.#program,
        "u_mask_layout"
      );
      this.#maskBoundsLoc = requireUniform(
        gl,
        this.#program,
        "u_mask_bounds"
      );
      this.#channelFlagLoc = requireUniform(
        gl,
        this.#program,
        "u_channel_flag"
      );
      this.#maskOpacityLoc = requireUniform(
        gl,
        this.#maskProgram,
        "u_opacity"
      );
      this.#maskUseTexLoc = requireUniform(
        gl,
        this.#maskProgram,
        "u_use_texture"
      );
      this.#maskTexLoc = requireUniform(gl, this.#maskProgram, "u_tex");
      this.#maskWriteLayoutLoc = requireUniform(
        gl,
        this.#maskProgram,
        "u_mask_layout"
      );
      this.#maskWriteBoundsLoc = requireUniform(
        gl,
        this.#maskProgram,
        "u_mask_bounds"
      );
      this.#maskWriteChannelLoc = requireUniform(
        gl,
        this.#maskProgram,
        "u_channel_flag"
      );
      const vao = gl.createVertexArray();
      const vbo = gl.createBuffer();
      const ibo = gl.createBuffer();
      if (!vao || !vbo || !ibo) {
        throw new Error("@doki-land/live2d-renderer: buffer alloc failed");
      }
      this.#vao = vao;
      this.#vbo = vbo;
      this.#ibo = ibo;
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      gl.bindVertexArray(null);
    }
    #ensureMaskTarget(width, height) {
      const gl = this.#gl;
      const w = Math.max(1, width);
      const h = Math.max(1, height);
      if (this.#maskFbo && this.#maskTex && this.#maskW === w && this.#maskH === h) {
        return;
      }
      if (this.#maskTex) gl.deleteTexture(this.#maskTex);
      if (this.#maskFbo) gl.deleteFramebuffer(this.#maskFbo);
      const tex = gl.createTexture();
      const fbo = gl.createFramebuffer();
      if (!tex || !fbo) {
        throw new Error(
          "@doki-land/live2d-renderer: mask framebuffer alloc failed"
        );
      }
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        w,
        h,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        tex,
        0
      );
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        gl.deleteTexture(tex);
        gl.deleteFramebuffer(fbo);
        throw new Error(
          `@doki-land/live2d-renderer: incomplete mask FBO (${status})`
        );
      }
      this.#maskTex = tex;
      this.#maskFbo = fbo;
      this.#maskW = w;
      this.#maskH = h;
    }
    #clearGpuTextures() {
      const gl = this.#gl;
      for (const t of this.#gpuTextures) {
        if (t) gl.deleteTexture(t);
      }
      this.#gpuTextures = [];
    }
    setTextures(textures) {
      const gl = this.#gl;
      this.#clearGpuTextures();
      let maxIndex = -1;
      for (const t of textures) maxIndex = Math.max(maxIndex, t.index);
      this.#gpuTextures = new Array(maxIndex + 1).fill(null);
      for (const t of textures) {
        const tex = gl.createTexture();
        if (!tex) continue;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
        gl.texParameteri(
          gl.TEXTURE_2D,
          gl.TEXTURE_WRAP_S,
          gl.CLAMP_TO_EDGE
        );
        gl.texParameteri(
          gl.TEXTURE_2D,
          gl.TEXTURE_WRAP_T,
          gl.CLAMP_TO_EDGE
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          t.image
        );
        this.#gpuTextures[t.index] = tex;
      }
      gl.bindTexture(gl.TEXTURE_2D, null);
    }
    #uploadMesh(d) {
      const gl = this.#gl;
      const interleaved = interleavePosUv(d.vertexPositions, d.uvs);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.#vbo);
      gl.bufferData(gl.ARRAY_BUFFER, interleaved, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.#ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, d.indices, gl.DYNAMIC_DRAW);
    }
    #drawMeshColor(d, useMask, invertMask, layout, modelBounds, channelFlag) {
      const gl = this.#gl;
      if (!d.visible || d.opacity <= 0) return;
      applyWebGl2BlendMode(gl, d.blendMode);
      this.#uploadMesh(d);
      const gpuTex = this.#gpuTextures[d.textureIndex] ?? null;
      const textured = gpuTex !== null;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, gpuTex);
      gl.uniform1i(this.#texLoc, 0);
      gl.uniform1f(this.#useTexLoc, textured ? 1 : 0);
      gl.uniform1f(this.#opacityLoc, d.opacity);
      gl.uniform4f(
        this.#colorLoc,
        PREVIEW_FILL.r,
        PREVIEW_FILL.g,
        PREVIEW_FILL.b,
        PREVIEW_FILL.a * d.opacity
      );
      gl.uniform1f(this.#useMaskLoc, useMask ? 1 : 0);
      gl.uniform1f(this.#invertMaskLoc, invertMask ? 1 : 0);
      const layoutVec = maskLayoutVec4(
        layout ?? { x: 0, y: 0, width: 1, height: 1 }
      );
      gl.uniform4fv(this.#maskLayoutLoc, layoutVec);
      gl.uniform4fv(
        this.#maskBoundsLoc,
        maskLayoutVec4(
          modelBounds ?? { x: -1, y: -1, width: 2, height: 2 }
        )
      );
      gl.uniform4fv(
        this.#channelFlagLoc,
        channelFlag ?? new Float32Array([0, 0, 0, 1])
      );
      if (useMask && this.#maskTex) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.#maskTex);
        gl.uniform1i(this.#maskLoc, 1);
      }
      gl.drawElements(gl.TRIANGLES, d.indices.length, gl.UNSIGNED_SHORT, 0);
      if (!textured && !useMask) {
        const lines = triangleEdgesToLineList(d.indices);
        gl.uniform1f(this.#useTexLoc, 0);
        gl.uniform4f(
          this.#colorLoc,
          PREVIEW_STROKE.r,
          PREVIEW_STROKE.g,
          PREVIEW_STROKE.b,
          PREVIEW_STROKE.a * d.opacity
        );
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, lines, gl.DYNAMIC_DRAW);
        gl.drawElements(gl.LINES, lines.length, gl.UNSIGNED_SHORT, 0);
      }
    }
    #drawMeshMask(d, layout, modelBounds, channelFlag) {
      const gl = this.#gl;
      if (d.opacity <= 0) return;
      this.#uploadMesh(d);
      const gpuTex = this.#gpuTextures[d.textureIndex] ?? null;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, gpuTex);
      gl.uniform1i(this.#maskTexLoc, 0);
      gl.uniform1f(this.#maskUseTexLoc, gpuTex ? 1 : 0);
      gl.uniform1f(this.#maskOpacityLoc, Math.max(d.opacity, 1));
      gl.uniform4fv(this.#maskWriteLayoutLoc, maskLayoutVec4(layout));
      gl.uniform4fv(this.#maskWriteBoundsLoc, maskLayoutVec4(modelBounds));
      gl.uniform4fv(this.#maskWriteChannelLoc, channelFlag);
      gl.drawElements(gl.TRIANGLES, d.indices.length, gl.UNSIGNED_SHORT, 0);
    }
    draw(drawables, _modelMatrix) {
      const gl = this.#gl;
      const canvas = gl.canvas;
      const width = canvas instanceof HTMLCanvasElement ? canvas.width : canvas.width;
      const height = canvas instanceof HTMLCanvasElement ? canvas.height : canvas.height;
      const byIndex = /* @__PURE__ */ new Map();
      for (const d of drawables) byIndex.set(d.index, d);
      const partitioned = partitionForClipping(drawables);
      const contexts = fitClippingContexts(partitioned.contexts, byIndex);
      const { maskOnly } = partitioned;
      gl.bindVertexArray(this.#vao);
      if (contexts.length > 0) {
        this.#ensureMaskTarget(width, height);
        const fbo = this.#maskFbo;
        if (fbo && this.#maskTex) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
          gl.viewport(0, 0, this.#maskW, this.#maskH);
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.useProgram(this.#maskProgram);
          gl.enable(gl.BLEND);
          gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE);
          for (const ctx of contexts) {
            const flag = maskChannelVec4(ctx.channelFlag);
            for (const mi of ctx.maskIndices) {
              const maskMesh = byIndex.get(mi);
              if (maskMesh) {
                this.#drawMeshMask(
                  maskMesh,
                  ctx.layout,
                  ctx.modelBounds,
                  flag
                );
              }
            }
          }
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.viewport(0, 0, width, height);
        }
      }
      gl.useProgram(this.#program);
      const layoutByClippedIndex = /* @__PURE__ */ new Map();
      for (const ctx of contexts) {
        for (const ci of ctx.clippedIndices) {
          layoutByClippedIndex.set(ci, {
            layout: ctx.layout,
            modelBounds: ctx.modelBounds,
            invertedMask: ctx.invertedMask,
            channelFlag: ctx.channelFlag
          });
        }
      }
      for (const d of drawables) {
        if (maskOnly.has(d.index)) continue;
        const clip = layoutByClippedIndex.get(d.index);
        if (clip) {
          this.#drawMeshColor(
            d,
            true,
            clip.invertedMask,
            clip.layout,
            clip.modelBounds,
            maskChannelVec4(clip.channelFlag)
          );
        } else {
          this.#drawMeshColor(d, false, false, null, null, null);
        }
      }
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.bindVertexArray(null);
    }
    destroy() {
      const gl = this.#gl;
      this.#clearGpuTextures();
      if (this.#maskTex) gl.deleteTexture(this.#maskTex);
      if (this.#maskFbo) gl.deleteFramebuffer(this.#maskFbo);
      gl.deleteBuffer(this.#vbo);
      gl.deleteBuffer(this.#ibo);
      gl.deleteVertexArray(this.#vao);
      gl.deleteProgram(this.#program);
      gl.deleteProgram(this.#maskProgram);
    }
  };
  var WebGl2RendererImpl = class {
    kind = "webgl2";
    #canvas = null;
    #gl = null;
    #options;
    constructor(options = {}) {
      this.#options = options;
    }
    async initialize(canvas) {
      const gl = canvas.getContext("webgl2", {
        antialias: this.#options.antialias ?? true,
        alpha: this.#options.alpha ?? true,
        premultipliedAlpha: true,
        preserveDrawingBuffer: this.#options.preserveDrawingBuffer ?? true,
        powerPreference: "high-performance"
      });
      if (!gl) {
        throw new Error(
          "@doki-land/live2d-renderer: WebGL2 is not available"
        );
      }
      this.#canvas = canvas;
      this.#gl = gl;
    }
    createModelDrawPass() {
      if (!this.#gl) {
        throw new Error(
          "@doki-land/live2d-renderer: WebGL2 renderer not initialized"
        );
      }
      return new WebGl2ModelDrawPass(this.#gl);
    }
    beginFrame() {
      const gl = this.#gl;
      if (!gl || !this.#canvas) return;
      gl.viewport(0, 0, this.#canvas.width, this.#canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    endFrame() {
    }
    resize(width, height) {
      if (!this.#canvas) return;
      this.#canvas.width = width;
      this.#canvas.height = height;
    }
    getGL() {
      return this.#gl;
    }
    destroy() {
      this.#gl = null;
      this.#canvas = null;
    }
  };
  function createWebGl2Renderer(options) {
    return new WebGl2RendererImpl(options);
  }

  // ../../live2d-renderer/src/backends/webgpu.ts
  var SOLID_WGSL = (
    /* wgsl */
    `
struct Uniforms {
  color: vec4f,
}

@group(0) @binding(0) var<uniform> u: Uniforms;

@vertex
fn vs_main(@location(0) pos: vec2f) -> @builtin(position) vec4f {
  return vec4f(pos, 0.0, 1.0);
}

@fragment
fn fs_main() -> @location(0) vec4f {
  return u.color;
}
`
  );
  var TEXTURED_WGSL = (
    /* wgsl */
    `
struct Uniforms {
  opacity: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var tex: texture_2d<f32>;

struct VsOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vs_main(@location(0) pos: vec2f, @location(1) uv: vec2f) -> VsOut {
  var o: VsOut;
  o.pos = vec4f(pos, 0.0, 1.0);
  o.uv = uv;
  return o;
}

@fragment
fn fs_main(input: VsOut) -> @location(0) vec4f {
  let c = textureSample(tex, samp, input.uv);
  return vec4f(c.rgb, c.a * u.opacity);
}
`
  );
  var SOLID_CLIPPED_WGSL = (
    /* wgsl */
    `
struct Uniforms {
  color: vec4f,
  invertMask: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
  layout: vec4f,
  channelFlag: vec4f,
  modelBounds: vec4f,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var maskTex: texture_2d<f32>;

struct VsOut {
  @builtin(position) pos: vec4f,
  @location(0) ndc: vec2f,
}

@vertex
fn vs_main(@location(0) pos: vec2f) -> VsOut {
  var o: VsOut;
  o.pos = vec4f(pos, 0.0, 1.0);
  o.ndc = pos;
  return o;
}

@fragment
fn fs_main(input: VsOut) -> @location(0) vec4f {
  let local = (input.ndc - u.modelBounds.xy) / max(u.modelBounds.zw, vec2f(1e-6));
  let muv = u.layout.xy + local * u.layout.zw;
  var m = dot(textureSample(maskTex, samp, muv), u.channelFlag);
  if (u.invertMask > 0.5) {
    m = 1.0 - m;
  }
  return vec4f(u.color.rgb * m, u.color.a * m);
}
`
  );
  var TEXTURED_CLIPPED_WGSL = (
    /* wgsl */
    `
struct Uniforms {
  opacity: f32,
  invertMask: f32,
  _pad0: f32,
  _pad1: f32,
  layout: vec4f,
  channelFlag: vec4f,
  modelBounds: vec4f,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var tex: texture_2d<f32>;
@group(0) @binding(3) var maskTex: texture_2d<f32>;

struct VsOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
  @location(1) ndc: vec2f,
}

@vertex
fn vs_main(@location(0) pos: vec2f, @location(1) uv: vec2f) -> VsOut {
  var o: VsOut;
  o.pos = vec4f(pos, 0.0, 1.0);
  o.uv = uv;
  o.ndc = pos;
  return o;
}

@fragment
fn fs_main(input: VsOut) -> @location(0) vec4f {
  let c = textureSample(tex, samp, input.uv);
  let local = (input.ndc - u.modelBounds.xy) / max(u.modelBounds.zw, vec2f(1e-6));
  let muv = u.layout.xy + local * u.layout.zw;
  var m = dot(textureSample(maskTex, samp, muv), u.channelFlag);
  if (u.invertMask > 0.5) {
    m = 1.0 - m;
  }
  let a = c.a * u.opacity * m;
  return vec4f(c.rgb * m, a);
}
`
  );
  var MASK_WRITE_WGSL = (
    /* wgsl */
    `
struct Uniforms {
  opacity: f32,
  useTexture: f32,
  _pad0: f32,
  _pad1: f32,
  layout: vec4f, // xy offset, zw size in 0..1
  channelFlag: vec4f,
  modelBounds: vec4f,
}

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var tex: texture_2d<f32>;

struct VsOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vs_main(@location(0) pos: vec2f, @location(1) uv: vec2f) -> VsOut {
  var o: VsOut;
  let local = (pos - u.modelBounds.xy) / max(u.modelBounds.zw, vec2f(1e-6));
  let atlasUv = u.layout.xy + local * u.layout.zw;
  o.pos = vec4f(atlasUv * 2.0 - vec2f(1.0, 1.0), 0.0, 1.0);
  o.uv = uv;
  return o;
}

@fragment
fn fs_main(input: VsOut) -> @location(0) vec4f {
  var a = u.opacity;
  if (u.useTexture > 0.5) {
    a = a * textureSample(tex, samp, input.uv).a;
  }
  return u.channelFlag * a;
}
`
  );
  var BLEND_MODES = [
    BlendMode.Normal,
    BlendMode.Additive,
    BlendMode.Multiplicative
  ];
  function indexBufferSize(byteLength) {
    return byteLength + 3 & ~3;
  }
  function writeIndexBuffer(device, indices) {
    const size = indexBufferSize(indices.byteLength);
    const ibo = device.createBuffer({
      size: Math.max(4, size),
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Uint16Array(ibo.getMappedRange()).set(indices);
    ibo.unmap();
    return ibo;
  }
  function interleavePosUv2(positions, uvs) {
    const n = Math.floor(positions.length / 2);
    const out = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      const p = i * 2;
      out[o] = positions[p];
      out[o + 1] = positions[p + 1];
      out[o + 2] = uvs[p] ?? 0;
      out[o + 3] = uvs[p + 1] ?? 0;
    }
    return out;
  }
  function createWhiteTexture(device) {
    const tex = device.createTexture({
      size: [1, 1],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });
    device.queue.writeTexture(
      { texture: tex },
      new Uint8Array([255, 255, 255, 255]),
      { bytesPerRow: 4 },
      [1, 1]
    );
    return tex;
  }
  var WebGpuModelDrawPass = class {
    #renderer;
    constructor(renderer) {
      this.#renderer = renderer;
    }
    setTextures(textures) {
      this.#renderer.setTextures(textures);
    }
    draw(drawables, _modelMatrix) {
      this.#renderer.drawMeshes(drawables);
    }
    destroy() {
      this.#renderer.setTextures([]);
    }
  };
  var WebGpuRendererImpl = class {
    kind = "webgpu";
    #canvas = null;
    #device = null;
    #context = null;
    #format = null;
    #pipelines = [null, null, null];
    #solidBindGroupLayout = null;
    #texturedBindGroupLayout = null;
    #clippedSolidBindGroupLayout = null;
    #clippedTexturedBindGroupLayout = null;
    #maskWriteBindGroupLayout = null;
    #maskWritePipeline = null;
    #sampler = null;
    #encoder = null;
    #pass = null;
    #swapView = null;
    #pendingClear = false;
    #msaaTexture = null;
    #msaaW = 0;
    #msaaH = 0;
    #sampleCount = 4;
    #maskTexture = null;
    #maskW = 0;
    #maskH = 0;
    #whiteTexture = null;
    #transient = [];
    #gpuTextures = [];
    #options;
    constructor(options = {}) {
      this.#options = options;
    }
    async initialize(canvas) {
      if (!navigator.gpu) {
        throw new Error(
          "@doki-land/live2d-renderer: WebGPU is not available"
        );
      }
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: this.#options.powerPreference ?? "high-performance"
      });
      if (!adapter) {
        throw new Error("@doki-land/live2d-renderer: no WebGPU adapter");
      }
      const device = await adapter.requestDevice();
      const context = canvas.getContext("webgpu");
      if (!context) {
        throw new Error(
          "@doki-land/live2d-renderer: failed to get webgpu context"
        );
      }
      const format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({
        device,
        format,
        alphaMode: "premultiplied"
      });
      const solidModule = device.createShaderModule({ code: SOLID_WGSL });
      const texturedModule = device.createShaderModule({
        code: TEXTURED_WGSL
      });
      const solidClippedModule = device.createShaderModule({
        code: SOLID_CLIPPED_WGSL
      });
      const texturedClippedModule = device.createShaderModule({
        code: TEXTURED_CLIPPED_WGSL
      });
      const maskWriteModule = device.createShaderModule({
        code: MASK_WRITE_WGSL
      });
      const solidBindGroupLayout = device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            buffer: { type: "uniform" }
          }
        ]
      });
      const texturedBindGroupLayout = device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            buffer: { type: "uniform" }
          },
          {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: { type: "filtering" }
          },
          {
            binding: 2,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { sampleType: "float" }
          }
        ]
      });
      const clippedSolidBindGroupLayout = device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            buffer: { type: "uniform" }
          },
          {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: { type: "filtering" }
          },
          {
            binding: 2,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { sampleType: "float" }
          }
        ]
      });
      const clippedTexturedBindGroupLayout = device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            buffer: { type: "uniform" }
          },
          {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: { type: "filtering" }
          },
          {
            binding: 2,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { sampleType: "float" }
          },
          {
            binding: 3,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { sampleType: "float" }
          }
        ]
      });
      const maskWriteBindGroupLayout = device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            buffer: { type: "uniform" }
          },
          {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: { type: "filtering" }
          },
          {
            binding: 2,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { sampleType: "float" }
          }
        ]
      });
      const solidLayout = device.createPipelineLayout({
        bindGroupLayouts: [solidBindGroupLayout]
      });
      const texturedLayout = device.createPipelineLayout({
        bindGroupLayouts: [texturedBindGroupLayout]
      });
      const clippedSolidLayout = device.createPipelineLayout({
        bindGroupLayouts: [clippedSolidBindGroupLayout]
      });
      const clippedTexturedLayout = device.createPipelineLayout({
        bindGroupLayouts: [clippedTexturedBindGroupLayout]
      });
      const maskWriteLayout = device.createPipelineLayout({
        bindGroupLayouts: [maskWriteBindGroupLayout]
      });
      const solidVertex = {
        module: solidModule,
        entryPoint: "vs_main",
        buffers: [
          {
            arrayStride: 8,
            attributes: [
              {
                shaderLocation: 0,
                offset: 0,
                format: "float32x2"
              }
            ]
          }
        ]
      };
      const texturedVertex = {
        module: texturedModule,
        entryPoint: "vs_main",
        buffers: [
          {
            arrayStride: 16,
            attributes: [
              {
                shaderLocation: 0,
                offset: 0,
                format: "float32x2"
              },
              {
                shaderLocation: 1,
                offset: 8,
                format: "float32x2"
              }
            ]
          }
        ]
      };
      const solidClippedVertex = {
        module: solidClippedModule,
        entryPoint: "vs_main",
        buffers: [
          {
            arrayStride: 8,
            attributes: [
              {
                shaderLocation: 0,
                offset: 0,
                format: "float32x2"
              }
            ]
          }
        ]
      };
      const texturedClippedVertex = {
        module: texturedClippedModule,
        entryPoint: "vs_main",
        buffers: [
          {
            arrayStride: 16,
            attributes: [
              {
                shaderLocation: 0,
                offset: 0,
                format: "float32x2"
              },
              {
                shaderLocation: 1,
                offset: 8,
                format: "float32x2"
              }
            ]
          }
        ]
      };
      const maskWriteVertex = {
        module: maskWriteModule,
        entryPoint: "vs_main",
        buffers: [
          {
            arrayStride: 16,
            attributes: [
              {
                shaderLocation: 0,
                offset: 0,
                format: "float32x2"
              },
              {
                shaderLocation: 1,
                offset: 8,
                format: "float32x2"
              }
            ]
          }
        ]
      };
      const maskAccumulateBlend = {
        color: {
          srcFactor: "one",
          dstFactor: "one",
          operation: "add"
        },
        alpha: {
          srcFactor: "one",
          dstFactor: "one",
          operation: "add"
        }
      };
      const makeSet = (sampleCount2, mode) => {
        const blend = webGpuBlendState(mode);
        const multisample = { count: sampleCount2 };
        return {
          fill: device.createRenderPipeline({
            layout: solidLayout,
            vertex: solidVertex,
            fragment: {
              module: solidModule,
              entryPoint: "fs_main",
              targets: [{ format, blend }]
            },
            primitive: { topology: "triangle-list" },
            multisample
          }),
          line: device.createRenderPipeline({
            layout: solidLayout,
            vertex: solidVertex,
            fragment: {
              module: solidModule,
              entryPoint: "fs_main",
              targets: [{ format, blend }]
            },
            primitive: { topology: "line-list" },
            multisample
          }),
          textured: device.createRenderPipeline({
            layout: texturedLayout,
            vertex: texturedVertex,
            fragment: {
              module: texturedModule,
              entryPoint: "fs_main",
              targets: [{ format, blend }]
            },
            primitive: { topology: "triangle-list" },
            multisample
          }),
          clippedFill: device.createRenderPipeline({
            layout: clippedSolidLayout,
            vertex: solidClippedVertex,
            fragment: {
              module: solidClippedModule,
              entryPoint: "fs_main",
              targets: [{ format, blend }]
            },
            primitive: { topology: "triangle-list" },
            multisample
          }),
          clippedTextured: device.createRenderPipeline({
            layout: clippedTexturedLayout,
            vertex: texturedClippedVertex,
            fragment: {
              module: texturedClippedModule,
              entryPoint: "fs_main",
              targets: [{ format, blend }]
            },
            primitive: { topology: "triangle-list" },
            multisample
          })
        };
      };
      let sampleCount = 4;
      let pipelines;
      let maskWritePipeline;
      try {
        pipelines = BLEND_MODES.map((mode) => makeSet(sampleCount, mode));
        maskWritePipeline = device.createRenderPipeline({
          layout: maskWriteLayout,
          vertex: maskWriteVertex,
          fragment: {
            module: maskWriteModule,
            entryPoint: "fs_main",
            targets: [
              { format: "rgba8unorm", blend: maskAccumulateBlend }
            ]
          },
          primitive: { topology: "triangle-list" },
          multisample: { count: 1 }
        });
      } catch {
        sampleCount = 1;
        pipelines = BLEND_MODES.map((mode) => makeSet(sampleCount, mode));
        maskWritePipeline = device.createRenderPipeline({
          layout: maskWriteLayout,
          vertex: maskWriteVertex,
          fragment: {
            module: maskWriteModule,
            entryPoint: "fs_main",
            targets: [
              { format: "rgba8unorm", blend: maskAccumulateBlend }
            ]
          },
          primitive: { topology: "triangle-list" },
          multisample: { count: 1 }
        });
      }
      this.#sampleCount = sampleCount;
      this.#canvas = canvas;
      this.#device = device;
      this.#context = context;
      this.#format = format;
      this.#pipelines = pipelines;
      this.#solidBindGroupLayout = solidBindGroupLayout;
      this.#texturedBindGroupLayout = texturedBindGroupLayout;
      this.#clippedSolidBindGroupLayout = clippedSolidBindGroupLayout;
      this.#clippedTexturedBindGroupLayout = clippedTexturedBindGroupLayout;
      this.#maskWriteBindGroupLayout = maskWriteBindGroupLayout;
      this.#maskWritePipeline = maskWritePipeline;
      this.#sampler = device.createSampler({
        magFilter: "linear",
        minFilter: "linear",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge"
      });
      this.#whiteTexture = createWhiteTexture(device);
      this.#ensureMsaa();
    }
    #ensureMsaa() {
      const device = this.#device;
      const canvas = this.#canvas;
      const format = this.#format;
      if (!device || !canvas || !format) return;
      const w = Math.max(1, canvas.width);
      const h = Math.max(1, canvas.height);
      if (this.#msaaTexture && this.#msaaW === w && this.#msaaH === h) {
        return;
      }
      this.#msaaTexture?.destroy();
      this.#msaaTexture = device.createTexture({
        size: [w, h],
        sampleCount: this.#sampleCount,
        format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT
      });
      this.#msaaW = w;
      this.#msaaH = h;
    }
    #ensureMaskTexture(width, height) {
      const device = this.#device;
      if (!device) return null;
      const w = Math.max(1, width);
      const h = Math.max(1, height);
      if (this.#maskTexture && this.#maskW === w && this.#maskH === h) {
        return this.#maskTexture;
      }
      this.#maskTexture?.destroy();
      this.#maskTexture = device.createTexture({
        size: [w, h],
        format: "rgba8unorm",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
      });
      this.#maskW = w;
      this.#maskH = h;
      return this.#maskTexture;
    }
    #clearGpuTextures() {
      for (const t of this.#gpuTextures) t?.destroy();
      this.#gpuTextures = [];
    }
    setTextures(textures) {
      const device = this.#device;
      this.#clearGpuTextures();
      if (!device) return;
      let maxIndex = -1;
      for (const t of textures) maxIndex = Math.max(maxIndex, t.index);
      this.#gpuTextures = new Array(Math.max(0, maxIndex + 1)).fill(null);
      for (const t of textures) {
        const gpuTex = device.createTexture({
          size: [t.width, t.height],
          format: "rgba8unorm",
          usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
        });
        device.queue.copyExternalImageToTexture(
          { source: t.image },
          { texture: gpuTex },
          [t.width, t.height]
        );
        this.#gpuTextures[t.index] = gpuTex;
      }
    }
    createModelDrawPass() {
      if (!this.#device || !this.#pipelines[BlendMode.Normal]) {
        throw new Error(
          "@doki-land/live2d-renderer: WebGPU renderer not initialized"
        );
      }
      return new WebGpuModelDrawPass(this);
    }
    beginFrame() {
      const device = this.#device;
      const context = this.#context;
      if (!device || !context) return;
      this.#ensureMsaa();
      this.#encoder = device.createCommandEncoder();
      this.#swapView = context.getCurrentTexture().createView();
      this.#pass = null;
      this.#pendingClear = true;
    }
    #endColorPass() {
      if (this.#pass) {
        this.#pass.end();
        this.#pass = null;
      }
    }
    #beginColorPass() {
      const encoder = this.#encoder;
      const msaa = this.#msaaTexture;
      const swapView = this.#swapView;
      if (!encoder || !swapView) return null;
      if (this.#pass) return this.#pass;
      const loadOp = this.#pendingClear ? "clear" : "load";
      this.#pendingClear = false;
      const useMsaa = this.#sampleCount > 1 && msaa !== null;
      this.#pass = encoder.beginRenderPass({
        colorAttachments: [
          useMsaa ? {
            view: msaa?.createView(),
            resolveTarget: swapView,
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp,
            storeOp: "discard"
          } : {
            view: swapView,
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp,
            storeOp: "store"
          }
        ]
      });
      return this.#pass;
    }
    drawMeshes(drawables) {
      const device = this.#device;
      const encoder = this.#encoder;
      const canvas = this.#canvas;
      const sampler = this.#sampler;
      const solidLayout = this.#solidBindGroupLayout;
      const texturedLayout = this.#texturedBindGroupLayout;
      const clippedSolidLayout = this.#clippedSolidBindGroupLayout;
      const clippedTexturedLayout = this.#clippedTexturedBindGroupLayout;
      const maskWriteLayout = this.#maskWriteBindGroupLayout;
      const maskWritePipeline = this.#maskWritePipeline;
      const whiteTex = this.#whiteTexture;
      if (!device || !encoder || !canvas || !sampler || !solidLayout || !texturedLayout || !clippedSolidLayout || !clippedTexturedLayout || !maskWriteLayout || !maskWritePipeline || !whiteTex) {
        return;
      }
      const byIndex = /* @__PURE__ */ new Map();
      for (const d of drawables) byIndex.set(d.index, d);
      const partitioned = partitionForClipping(drawables);
      const contexts = fitClippingContexts(partitioned.contexts, byIndex);
      const { maskOnly } = partitioned;
      let maskTex = null;
      if (contexts.length > 0) {
        maskTex = this.#ensureMaskTexture(canvas.width, canvas.height);
        if (maskTex) {
          const maskPass = encoder.beginRenderPass({
            colorAttachments: [
              {
                view: maskTex.createView(),
                clearValue: { r: 0, g: 0, b: 0, a: 0 },
                loadOp: "clear",
                storeOp: "store"
              }
            ]
          });
          maskPass.setPipeline(maskWritePipeline);
          for (const ctx of contexts) {
            for (const mi of ctx.maskIndices) {
              const maskMesh = byIndex.get(mi);
              if (maskMesh) {
                this.#drawMaskMesh(
                  maskMesh,
                  maskPass,
                  maskWriteLayout,
                  sampler,
                  whiteTex,
                  ctx.layout,
                  ctx.modelBounds,
                  ctx.channelFlag
                );
              }
            }
          }
          maskPass.end();
        }
      }
      const colorPass = this.#beginColorPass();
      if (!colorPass) return;
      const layoutByClippedIndex = /* @__PURE__ */ new Map();
      for (const ctx of contexts) {
        for (const ci of ctx.clippedIndices) {
          layoutByClippedIndex.set(ci, {
            layout: ctx.layout,
            modelBounds: ctx.modelBounds,
            invertedMask: ctx.invertedMask,
            channelFlag: ctx.channelFlag
          });
        }
      }
      for (const d of drawables) {
        if (maskOnly.has(d.index)) continue;
        const clip = layoutByClippedIndex.get(d.index);
        if (clip && maskTex) {
          this.#drawColorMesh(
            d,
            colorPass,
            true,
            clip.invertedMask,
            maskTex,
            clip.layout,
            clip.channelFlag,
            clip.modelBounds
          );
        } else {
          this.#drawColorMesh(d, colorPass, false, false);
        }
      }
    }
    #drawMaskMesh(d, pass, layout, sampler, whiteTex, atlasLayout, modelBounds, channelFlag) {
      const device = this.#device;
      if (!device || d.opacity <= 0) return;
      const interleaved = interleavePosUv2(d.vertexPositions, d.uvs);
      const vbo = device.createBuffer({
        size: interleaved.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
      });
      new Float32Array(vbo.getMappedRange()).set(interleaved);
      vbo.unmap();
      const gpuTex = this.#gpuTextures[d.textureIndex] ?? whiteTex;
      const ubo = device.createBuffer({
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
      });
      const layoutVec = maskLayoutVec4(atlasLayout);
      const ch = maskChannelVec4(channelFlag);
      const boundsVec = maskLayoutVec4(modelBounds);
      new Float32Array(ubo.getMappedRange()).set([
        Math.max(d.opacity, 1),
        this.#gpuTextures[d.textureIndex] ? 1 : 0,
        0,
        0,
        layoutVec[0],
        layoutVec[1],
        layoutVec[2],
        layoutVec[3],
        ch[0],
        ch[1],
        ch[2],
        ch[3],
        boundsVec[0],
        boundsVec[1],
        boundsVec[2],
        boundsVec[3]
      ]);
      ubo.unmap();
      const ibo = writeIndexBuffer(device, d.indices);
      pass.setBindGroup(
        0,
        device.createBindGroup({
          layout,
          entries: [
            { binding: 0, resource: { buffer: ubo } },
            { binding: 1, resource: sampler },
            { binding: 2, resource: gpuTex.createView() }
          ]
        })
      );
      pass.setVertexBuffer(0, vbo);
      pass.setIndexBuffer(ibo, "uint16");
      pass.drawIndexed(d.indices.length);
      this.#transient.push(vbo, ubo, ibo);
    }
    #drawColorMesh(d, pass, useMask, invertMask, maskTex, atlasLayout, channelFlag, modelBounds) {
      const device = this.#device;
      const sampler = this.#sampler;
      const solidLayout = this.#solidBindGroupLayout;
      const texturedLayout = this.#texturedBindGroupLayout;
      const clippedSolidLayout = this.#clippedSolidBindGroupLayout;
      const clippedTexturedLayout = this.#clippedTexturedBindGroupLayout;
      if (!device || !sampler || !solidLayout || !texturedLayout || !clippedSolidLayout || !clippedTexturedLayout) {
        return;
      }
      if (!d.visible || d.opacity <= 0) return;
      const set = this.#pipelines[d.blendMode] ?? this.#pipelines[BlendMode.Normal];
      if (!set) return;
      const layoutVec = maskLayoutVec4(
        atlasLayout ?? { x: 0, y: 0, width: 1, height: 1 }
      );
      const ch = maskChannelVec4(channelFlag ?? [0, 0, 0, 1]);
      const boundsVec = maskLayoutVec4(
        modelBounds ?? { x: -1, y: -1, width: 2, height: 2 }
      );
      const gpuTex = this.#gpuTextures[d.textureIndex] ?? null;
      if (gpuTex) {
        const interleaved = interleavePosUv2(d.vertexPositions, d.uvs);
        const vbo2 = device.createBuffer({
          size: interleaved.byteLength,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
          mappedAtCreation: true
        });
        new Float32Array(vbo2.getMappedRange()).set(interleaved);
        vbo2.unmap();
        const uboSize = useMask && maskTex ? 64 : 16;
        const ubo = device.createBuffer({
          size: uboSize,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
          mappedAtCreation: true
        });
        if (useMask && maskTex) {
          new Float32Array(ubo.getMappedRange()).set([
            d.opacity,
            invertMask ? 1 : 0,
            0,
            0,
            layoutVec[0],
            layoutVec[1],
            layoutVec[2],
            layoutVec[3],
            ch[0],
            ch[1],
            ch[2],
            ch[3],
            boundsVec[0],
            boundsVec[1],
            boundsVec[2],
            boundsVec[3]
          ]);
        } else {
          new Float32Array(ubo.getMappedRange()).set([
            d.opacity,
            0,
            0,
            0
          ]);
        }
        ubo.unmap();
        const ibo = writeIndexBuffer(device, d.indices);
        if (useMask && maskTex) {
          pass.setPipeline(set.clippedTextured);
          pass.setBindGroup(
            0,
            device.createBindGroup({
              layout: clippedTexturedLayout,
              entries: [
                { binding: 0, resource: { buffer: ubo } },
                { binding: 1, resource: sampler },
                { binding: 2, resource: gpuTex.createView() },
                { binding: 3, resource: maskTex.createView() }
              ]
            })
          );
        } else {
          pass.setPipeline(set.textured);
          pass.setBindGroup(
            0,
            device.createBindGroup({
              layout: texturedLayout,
              entries: [
                { binding: 0, resource: { buffer: ubo } },
                { binding: 1, resource: sampler },
                { binding: 2, resource: gpuTex.createView() }
              ]
            })
          );
        }
        pass.setVertexBuffer(0, vbo2);
        pass.setIndexBuffer(ibo, "uint16");
        pass.drawIndexed(d.indices.length);
        this.#transient.push(vbo2, ubo, ibo);
        return;
      }
      const vbo = device.createBuffer({
        size: d.vertexPositions.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
      });
      new Float32Array(vbo.getMappedRange()).set(d.vertexPositions);
      vbo.unmap();
      if (useMask && maskTex) {
        const ubo = device.createBuffer({
          size: 80,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
          mappedAtCreation: true
        });
        new Float32Array(ubo.getMappedRange()).set([
          PREVIEW_FILL.r,
          PREVIEW_FILL.g,
          PREVIEW_FILL.b,
          PREVIEW_FILL.a * d.opacity,
          invertMask ? 1 : 0,
          0,
          0,
          0,
          layoutVec[0],
          layoutVec[1],
          layoutVec[2],
          layoutVec[3],
          ch[0],
          ch[1],
          ch[2],
          ch[3],
          boundsVec[0],
          boundsVec[1],
          boundsVec[2],
          boundsVec[3]
        ]);
        ubo.unmap();
        const ibo = writeIndexBuffer(device, d.indices);
        pass.setPipeline(set.clippedFill);
        pass.setBindGroup(
          0,
          device.createBindGroup({
            layout: clippedSolidLayout,
            entries: [
              { binding: 0, resource: { buffer: ubo } },
              { binding: 1, resource: sampler },
              { binding: 2, resource: maskTex.createView() }
            ]
          })
        );
        pass.setVertexBuffer(0, vbo);
        pass.setIndexBuffer(ibo, "uint16");
        pass.drawIndexed(d.indices.length);
        this.#transient.push(vbo, ubo, ibo);
        return;
      }
      const fillUbo = this.#makeColorUbo(
        device,
        PREVIEW_FILL.r,
        PREVIEW_FILL.g,
        PREVIEW_FILL.b,
        PREVIEW_FILL.a * d.opacity
      );
      const fillIbo = writeIndexBuffer(device, d.indices);
      pass.setPipeline(set.fill);
      pass.setBindGroup(
        0,
        device.createBindGroup({
          layout: solidLayout,
          entries: [{ binding: 0, resource: { buffer: fillUbo } }]
        })
      );
      pass.setVertexBuffer(0, vbo);
      pass.setIndexBuffer(fillIbo, "uint16");
      pass.drawIndexed(d.indices.length);
      const lines = triangleEdgesToLineList(d.indices);
      const lineUbo = this.#makeColorUbo(
        device,
        PREVIEW_STROKE.r,
        PREVIEW_STROKE.g,
        PREVIEW_STROKE.b,
        PREVIEW_STROKE.a * d.opacity
      );
      const lineIbo = writeIndexBuffer(device, lines);
      pass.setPipeline(set.line);
      pass.setBindGroup(
        0,
        device.createBindGroup({
          layout: solidLayout,
          entries: [{ binding: 0, resource: { buffer: lineUbo } }]
        })
      );
      pass.setVertexBuffer(0, vbo);
      pass.setIndexBuffer(lineIbo, "uint16");
      pass.drawIndexed(lines.length);
      this.#transient.push(vbo, fillUbo, fillIbo, lineUbo, lineIbo);
    }
    #makeColorUbo(device, r, g, b, a) {
      const ubo = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
      });
      new Float32Array(ubo.getMappedRange()).set([r, g, b, a]);
      ubo.unmap();
      return ubo;
    }
    endFrame() {
      const device = this.#device;
      const encoder = this.#encoder;
      if (!device || !encoder) return;
      if (this.#pendingClear && !this.#pass) {
        this.#beginColorPass();
      }
      this.#endColorPass();
      const buffers = this.#transient.splice(0);
      device.queue.submit([encoder.finish()]);
      for (const b of buffers) b.destroy();
      this.#encoder = null;
      this.#swapView = null;
      this.#pendingClear = false;
    }
    resize(width, height) {
      if (!this.#canvas) return;
      this.#canvas.width = width;
      this.#canvas.height = height;
      this.#ensureMsaa();
    }
    getDevice() {
      return this.#device;
    }
    destroy() {
      for (const b of this.#transient) b.destroy();
      this.#transient = [];
      this.#clearGpuTextures();
      this.#msaaTexture?.destroy();
      this.#msaaTexture = null;
      this.#maskTexture?.destroy();
      this.#maskTexture = null;
      this.#whiteTexture?.destroy();
      this.#whiteTexture = null;
      this.#device?.destroy();
      this.#device = null;
      this.#context = null;
      this.#format = null;
      this.#pipelines = [null, null, null];
      this.#solidBindGroupLayout = null;
      this.#texturedBindGroupLayout = null;
      this.#clippedSolidBindGroupLayout = null;
      this.#clippedTexturedBindGroupLayout = null;
      this.#maskWriteBindGroupLayout = null;
      this.#maskWritePipeline = null;
      this.#sampler = null;
      this.#encoder = null;
      this.#pass = null;
      this.#swapView = null;
      this.#canvas = null;
    }
  };
  function createWebGpuRenderer(options) {
    return new WebGpuRendererImpl(options);
  }

  // ../../live2d-renderer/src/cpu/cpu-program.ts
  var CPU_PROGRAM_KIND = "cpu-program";
  function assert(cond, message) {
    if (!cond) {
      throw new Error(`@doki-land/live2d-renderer: ${message}`);
    }
  }
  function isCpuProgramBytes(bytes) {
    try {
      const text = new TextDecoder().decode(bytes).trimStart();
      if (!text.startsWith("{")) return false;
      const parsed = JSON.parse(text);
      return parsed.kind === CPU_PROGRAM_KIND;
    } catch {
      return false;
    }
  }
  function parseCpuProgram(bytes) {
    let file;
    try {
      file = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new Error("@doki-land/live2d-renderer: invalid cpu-program JSON");
    }
    assert(file.kind === CPU_PROGRAM_KIND, "not a cpu-program file");
    assert(
      file.version === 1,
      `unsupported cpu-program version ${file.version}`
    );
    assert(file.program, "cpu-program missing program");
    return {
      format: file.program.format,
      codec: "cpu-program",
      parameters: file.program.parameters,
      drawables: file.program.drawables.map((d) => ({
        index: d.index,
        textureIndex: d.textureIndex,
        positions: new Float32Array(d.positions),
        uvs: new Float32Array(d.uvs),
        indices: new Uint16Array(d.indices),
        opacity: d.opacity,
        renderOrder: d.renderOrder,
        blendMode: d.blendMode ?? 0,
        invertedMask: d.invertedMask ?? false,
        maskIndices: d.maskIndices ?? [],
        visible: d.visible ?? true,
        deformParamIndex: d.deformParamIndex,
        deformDeltas: d.deformDeltas === null ? null : new Float32Array(d.deformDeltas)
      }))
    };
  }

  // ../../live2d-renderer/src/cpu/evaluate.ts
  function createModelInstance(program) {
    const parameterValues = new Float32Array(program.parameters.length);
    for (let i = 0; i < program.parameters.length; i++) {
      parameterValues[i] = program.parameters[i]?.defaultValue ?? 0;
    }
    return {
      program,
      parameterValues,
      timeSeconds: 0
    };
  }
  function setParameterValue(instance, parameterId, value) {
    const index = instance.program.parameters.findIndex(
      (p2) => p2.id === parameterId
    );
    if (index < 0) {
      throw new Error(
        `@doki-land/live2d-renderer: unknown parameter "${parameterId}"`
      );
    }
    const p = instance.program.parameters[index];
    instance.parameterValues[index] = Math.min(p.max, Math.max(p.min, value));
  }
  function paramWeight(instance, paramIndex) {
    const p = instance.program.parameters[paramIndex];
    if (!p) return 0;
    const v = instance.parameterValues[paramIndex] ?? p.defaultValue;
    if (v >= p.defaultValue) {
      const span2 = p.max - p.defaultValue;
      return span2 === 0 ? 0 : (v - p.defaultValue) / span2;
    }
    const span = p.defaultValue - p.min;
    return span === 0 ? 0 : (v - p.defaultValue) / span;
  }
  function evaluateFrame(instance) {
    const drawables = [];
    for (const d of instance.program.drawables) {
      const positions = new Float32Array(d.positions);
      if (d.deformParamIndex >= 0 && d.deformDeltas) {
        const w = paramWeight(instance, d.deformParamIndex);
        for (let i = 0; i < positions.length; i++) {
          positions[i] = positions[i] + w * d.deformDeltas[i];
        }
      }
      drawables.push({
        index: d.index,
        textureIndex: d.textureIndex,
        positions,
        uvs: d.uvs,
        indices: d.indices,
        opacity: d.opacity,
        blendMode: d.blendMode,
        renderOrder: d.renderOrder,
        visible: d.visible,
        invertedMask: d.invertedMask,
        maskIndices: d.maskIndices
      });
    }
    drawables.sort((a, b) => a.renderOrder - b.renderOrder);
    return {
      timeSeconds: instance.timeSeconds,
      drawables
    };
  }

  // ../../live2d-renderer/src/create-renderer.ts
  var DEFAULT_PREFER = ["webgpu", "webgl2", "canvas2d"];
  var INIT_TIMEOUT_MS = {
    webgpu: 2500,
    webgl2: 1500,
    canvas2d: 1e3
  };
  function instantiate(kind, options) {
    if (kind === "webgpu") return createWebGpuRenderer(options.webgpu);
    if (kind === "webgl2") return createWebGl2Renderer(options.webgl2);
    return createCanvas2DRenderer(options.canvas2d);
  }
  async function initializeWithTimeout(kind, candidate, canvas) {
    const ms = INIT_TIMEOUT_MS[kind];
    let timer;
    try {
      await Promise.race([
        candidate.initialize(canvas),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            reject(
              new Error(
                `@doki-land/live2d-renderer: ${kind} initialize timed out after ${ms}ms`
              )
            );
          }, ms);
        })
      ]);
    } finally {
      if (timer !== void 0) clearTimeout(timer);
    }
  }
  var FallbackRenderer = class {
    #inner = null;
    #kind = "webgpu";
    #prefer;
    #options;
    constructor(prefer, options) {
      this.#prefer = prefer;
      this.#options = options;
    }
    get kind() {
      return this.#inner?.kind ?? this.#kind;
    }
    async initialize(canvas) {
      const errors = [];
      for (const kind of this.#prefer) {
        const candidate = instantiate(kind, this.#options);
        try {
          await initializeWithTimeout(kind, candidate, canvas);
          this.#inner = candidate;
          this.#kind = candidate.kind;
          return;
        } catch (err) {
          candidate.destroy();
          errors.push(
            `${kind}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
      throw new Error(
        `@doki-land/live2d-renderer: no renderer initialized (${errors.join("; ")})`
      );
    }
    createModelDrawPass() {
      if (!this.#inner) {
        throw new Error(
          "@doki-land/live2d-renderer: renderer not initialized"
        );
      }
      return this.#inner.createModelDrawPass();
    }
    beginFrame() {
      this.#inner?.beginFrame();
    }
    endFrame() {
      this.#inner?.endFrame();
    }
    resize(width, height) {
      this.#inner?.resize(width, height);
    }
    destroy() {
      this.#inner?.destroy();
      this.#inner = null;
    }
  };
  function createRenderer(options = {}) {
    const prefer = options.prefer?.length ? options.prefer : DEFAULT_PREFER;
    return new FallbackRenderer(prefer, options);
  }

  // ../../live2d-renderer/src/moc/moc2-reader.ts
  var MOC2_REF_TYPE = 33;
  var MOC2_EOF_MARKER = -30584;
  var Moc2Reader = class {
    view;
    offset = 0;
    /** Bit cursor within the current bit-pack byte (0 = aligned). */
    bitPos = 0;
    bitByte = 0;
    formatVersion = 0;
    /** Object table for type-33 back-references (push order = identity). */
    objects = [];
    constructor(bytes) {
      this.view = new DataView(bytes);
    }
    get byteLength() {
      return this.view.byteLength;
    }
    getFormatVersion() {
      return this.formatVersion;
    }
    /** Read magic `"moc"` + version; set format version. */
    readHeader() {
      const m = this.readInt8();
      const o = this.readInt8();
      const c = this.readInt8();
      if (m !== 109 || o !== 111 || c !== 99) {
        throw new Error(
          `@doki-land/live2d-renderer: expected moc2 magic "moc", got ${JSON.stringify(
            String.fromCharCode(m & 255, o & 255, c & 255)
          )}`
        );
      }
      const version = this.readInt8() & 255;
      this.formatVersion = version;
      return version;
    }
    /** Version ≥ 8 ends with two int16 EOF markers. */
    readEofGuard() {
      if (this.formatVersion < 8) return;
      const a = this.readInt16();
      const b = this.readInt16();
      if (a !== MOC2_EOF_MARKER || b !== MOC2_EOF_MARKER) {
        throw new Error(
          `@doki-land/live2d-renderer: moc2 EOF marker mismatch (${a}, ${b})`
        );
      }
    }
    alignBits() {
      this.bitPos = 0;
    }
    readVarint() {
      this.alignBits();
      const b0 = this.readInt8();
      if ((b0 & 128) === 0) return b0 & 255;
      const b1 = this.readInt8();
      if ((b1 & 128) === 0) {
        return (b0 & 127) << 7 | b1 & 127;
      }
      const b2 = this.readInt8();
      if ((b2 & 128) === 0) {
        return (b0 & 127) << 14 | (b1 & 127) << 7 | b2 & 255;
      }
      const b3 = this.readInt8();
      if ((b3 & 128) === 0) {
        return (b0 & 127) << 21 | (b1 & 127) << 14 | (b2 & 127) << 7 | b3 & 255;
      }
      throw new Error(
        "@doki-land/live2d-renderer: moc2 varint overflow (>28 bits)"
      );
    }
    readBit() {
      if (this.bitPos === 0 || this.bitPos === 8) {
        this.bitByte = this.readInt8() & 255;
        this.bitPos = 0;
      }
      const bit = (this.bitByte >> 7 - this.bitPos & 1) === 1;
      this.bitPos++;
      return bit;
    }
    readInt8() {
      this.alignBits();
      if (this.offset >= this.view.byteLength) {
        throw new Error(
          "@doki-land/live2d-renderer: moc2 truncated (int8)"
        );
      }
      return this.view.getInt8(this.offset++);
    }
    readInt16() {
      this.alignBits();
      if (this.offset + 2 > this.view.byteLength) {
        throw new Error(
          "@doki-land/live2d-renderer: moc2 truncated (int16)"
        );
      }
      const v = this.view.getInt16(this.offset);
      this.offset += 2;
      return v;
    }
    readInt32() {
      this.alignBits();
      if (this.offset + 4 > this.view.byteLength) {
        throw new Error(
          "@doki-land/live2d-renderer: moc2 truncated (int32)"
        );
      }
      const v = this.view.getInt32(this.offset);
      this.offset += 4;
      return v;
    }
    readFloat32() {
      this.alignBits();
      if (this.offset + 4 > this.view.byteLength) {
        throw new Error(
          "@doki-land/live2d-renderer: moc2 truncated (float32)"
        );
      }
      const v = this.view.getFloat32(this.offset);
      this.offset += 4;
      return v;
    }
    readFloat64() {
      this.alignBits();
      if (this.offset + 8 > this.view.byteLength) {
        throw new Error(
          "@doki-land/live2d-renderer: moc2 truncated (float64)"
        );
      }
      const v = this.view.getFloat64(this.offset);
      this.offset += 8;
      return v;
    }
    readBool() {
      return this.readInt8() !== 0;
    }
    /** Latin-1 / byte string (moc2 IDs are ASCII). */
    readString() {
      const len = this.readVarint();
      if (this.offset + len > this.view.byteLength) {
        throw new Error(
          "@doki-land/live2d-renderer: moc2 truncated (string)"
        );
      }
      const chars = [];
      for (let i = 0; i < len; i++) {
        chars.push(this.view.getUint8(this.offset++));
      }
      return String.fromCharCode(...chars);
    }
    readInt32Array() {
      this.alignBits();
      const len = this.readVarint();
      if (this.offset + len * 4 > this.view.byteLength) {
        throw new Error(
          "@doki-land/live2d-renderer: moc2 truncated (int32[])"
        );
      }
      const out = new Int32Array(len);
      for (let i = 0; i < len; i++) {
        out[i] = this.view.getInt32(this.offset);
        this.offset += 4;
      }
      return out;
    }
    readFloat32Array() {
      this.alignBits();
      const len = this.readVarint();
      if (this.offset + len * 4 > this.view.byteLength) {
        throw new Error(
          "@doki-land/live2d-renderer: moc2 truncated (float32[])"
        );
      }
      const out = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        out[i] = this.view.getFloat32(this.offset);
        this.offset += 4;
      }
      return out;
    }
    readFloat64Array() {
      this.alignBits();
      const len = this.readVarint();
      if (this.offset + len * 8 > this.view.byteLength) {
        throw new Error(
          "@doki-land/live2d-renderer: moc2 truncated (float64[])"
        );
      }
      const out = new Float64Array(len);
      for (let i = 0; i < len; i++) {
        out[i] = this.view.getFloat64(this.offset);
        this.offset += 8;
      }
      return out;
    }
  };

  // ../../live2d-renderer/src/moc/moc2-objects.ts
  var Moc2Type = {
    Null: 0,
    String: 1,
    ObjectArray: 15,
    Int32Array: 16,
    RectInt: 21,
    PointInt: 22,
    Int32ArrayAlt: 25,
    Float64Array: 26,
    Float32Array: 27,
    DrawDataId: 50,
    BaseDataId: 51,
    ParamId: 60,
    MeshDeformer: 65,
    PivotManager: 66,
    Pivot: 67,
    AffineDeformer: 68,
    Affine: 69,
    DrawableMesh: 70,
    ParamDefFloat: 131,
    PartsData: 133,
    ModelImpl: 136,
    ParamDefSet: 137,
    AvatarParts: 142,
    PartsDataId: 134
  };
  function asId(value) {
    if (typeof value === "string") return value;
    if (value == null) return "";
    return String(value);
  }
  function asParamDefs(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (v) => !!v && typeof v === "object" && v.kind === "paramDef"
    );
  }
  function asPivots(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (v) => !!v && typeof v === "object" && v.kind === "pivot"
    );
  }
  function asFloat32Arrays(value) {
    if (!Array.isArray(value)) {
      if (value instanceof Float32Array) return [value];
      return [];
    }
    return value.filter((v) => v instanceof Float32Array);
  }
  function asAffines(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (v) => !!v && typeof v === "object" && v.kind === "affine"
    );
  }
  function asBaseList(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (v) => !!v && typeof v === "object" && (v.kind === "meshDeformer" || v.kind === "affineDeformer")
    );
  }
  function asDrawList(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (v) => !!v && typeof v === "object" && v.kind === "drawableMesh"
    );
  }
  function asPartsList(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (v) => !!v && typeof v === "object" && v.kind === "parts"
    );
  }
  function readPivotManager(r) {
    return {
      kind: "pivotManager",
      pivots: asPivots(r.readObject())
    };
  }
  function readV2Opacity(r) {
    if (r.getFormatVersion() >= 10) {
      return r.readFloat32Array();
    }
    return null;
  }
  function readMoc2ObjectBody(r, type) {
    switch (type) {
      case Moc2Type.Null:
        return null;
      case Moc2Type.String:
        return r.readString();
      case Moc2Type.DrawDataId:
      case Moc2Type.BaseDataId:
      case Moc2Type.ParamId:
      case Moc2Type.PartsDataId:
        return r.readString();
      case Moc2Type.ObjectArray: {
        const n = r.readVarint();
        const arr = new Array(n);
        for (let i = 0; i < n; i++) arr[i] = r.readObject();
        return arr;
      }
      case Moc2Type.Int32Array:
      case Moc2Type.Int32ArrayAlt:
        return r.readInt32Array();
      case Moc2Type.Float32Array:
        return r.readFloat32Array();
      case Moc2Type.Float64Array:
        return r.readFloat64Array();
      case Moc2Type.RectInt:
        return {
          kind: "rectInt",
          a: r.readInt32(),
          b: r.readInt32(),
          c: r.readInt32(),
          d: r.readInt32()
        };
      case Moc2Type.PointInt:
        return { kind: "pointInt", x: r.readInt32(), y: r.readInt32() };
      case Moc2Type.ParamDefFloat: {
        const def = {
          kind: "paramDef",
          min: r.readFloat32(),
          max: r.readFloat32(),
          defaultValue: r.readFloat32(),
          id: asId(r.readObject())
        };
        return def;
      }
      case Moc2Type.ParamDefSet: {
        const set = {
          kind: "paramDefSet",
          params: asParamDefs(r.readObject())
        };
        return set;
      }
      case Moc2Type.ModelImpl: {
        const paramDefSet = r.readObject();
        const parts = asPartsList(r.readObject());
        const model = {
          kind: "model",
          paramDefSet,
          parts,
          canvasWidth: r.readInt32(),
          canvasHeight: r.readInt32()
        };
        return model;
      }
      case Moc2Type.PartsData: {
        const locked = r.readBit();
        const visible = r.readBit();
        const parts = {
          kind: "parts",
          locked,
          visible,
          id: asId(r.readObject()),
          baseData: asBaseList(r.readObject()),
          drawData: asDrawList(r.readObject())
        };
        return parts;
      }
      case Moc2Type.AvatarParts: {
        return {
          kind: "avatarParts",
          id: asId(r.readObject()),
          drawData: r.readObject(),
          baseData: r.readObject()
        };
      }
      case Moc2Type.PivotManager:
        return readPivotManager(r);
      case Moc2Type.Pivot: {
        const pivot = {
          kind: "pivot",
          paramId: asId(r.readObject()),
          pivotCount: r.readInt32(),
          pivotValues: (() => {
            const v = r.readObject();
            return v instanceof Float32Array ? v : new Float32Array();
          })()
        };
        return pivot;
      }
      case Moc2Type.Affine: {
        const affine = {
          kind: "affine",
          originX: r.readFloat32(),
          originY: r.readFloat32(),
          scaleX: r.readFloat32(),
          scaleY: r.readFloat32(),
          rotation: r.readFloat32(),
          reflectX: r.getFormatVersion() >= 10 ? r.readBool() : false,
          reflectY: r.getFormatVersion() >= 10 ? r.readBool() : false
        };
        return affine;
      }
      case Moc2Type.MeshDeformer: {
        const id = asId(r.readObject());
        const targetBaseId = asId(r.readObject()) || null;
        const cols = r.readInt32();
        const rows = r.readInt32();
        const pivotManager = r.readObject();
        const keyforms = asFloat32Arrays(r.readObject());
        const opacities = readV2Opacity(r);
        const def = {
          kind: "meshDeformer",
          id,
          targetBaseId,
          pivotManager,
          cols,
          rows,
          keyforms,
          opacities
        };
        return def;
      }
      case Moc2Type.AffineDeformer: {
        const id = asId(r.readObject());
        const targetBaseId = asId(r.readObject()) || null;
        const pivotManager = r.readObject();
        const affines = asAffines(r.readObject());
        const opacities = readV2Opacity(r);
        const def = {
          kind: "affineDeformer",
          id,
          targetBaseId,
          pivotManager,
          affines,
          opacities
        };
        return def;
      }
      case Moc2Type.DrawableMesh: {
        const id = asId(r.readObject());
        const targetBaseId = asId(r.readObject()) || null;
        const pivotManager = r.readObject();
        const averageDrawOrder = r.readInt32();
        const drawOrders = r.readInt32Array();
        const opacities = r.readFloat32Array();
        let clipId = null;
        if (r.getFormatVersion() >= 11) {
          clipId = asId(r.readObject()) || null;
        }
        const textureIndex = r.readInt32();
        const numPoints = r.readInt32();
        const numPolygons = r.readInt32();
        const indexSrc = r.readObject();
        const indexArr = indexSrc instanceof Int32Array ? indexSrc : new Int32Array(0);
        const indices = new Uint16Array(numPolygons * 3);
        for (let i = 0; i < indices.length; i++) {
          indices[i] = indexArr[i] ?? 0;
        }
        const keyforms = asFloat32Arrays(r.readObject());
        const uvsRaw = r.readObject();
        const uvs = uvsRaw instanceof Float32Array ? uvsRaw : new Float32Array(numPoints * 2);
        let optionFlags = 0;
        let colorComposition = 0;
        if (r.getFormatVersion() >= 8) {
          optionFlags = r.readInt32();
          if (optionFlags !== 0) {
            if ((optionFlags & 1) !== 0) {
              colorComposition = r.readInt32();
            }
          }
        }
        const mesh = {
          kind: "drawableMesh",
          id,
          targetBaseId,
          pivotManager,
          averageDrawOrder,
          drawOrders,
          opacities,
          clipId,
          textureIndex,
          numPoints,
          numPolygons,
          indices,
          keyforms,
          uvs,
          optionFlags,
          colorComposition
        };
        return mesh;
      }
      default:
        throw new Error(
          `@doki-land/live2d-renderer: unsupported moc2 type tag ${type}`
        );
    }
  }
  var Moc2Parser = class extends Moc2Reader {
    readObject(typeHint = -1) {
      this.alignBits();
      const type = typeHint < 0 ? this.readVarint() : typeHint;
      if (type === MOC2_REF_TYPE) {
        const index = this.readInt32();
        if (index < 0 || index >= this.objects.length) {
          throw new Error(
            `@doki-land/live2d-renderer: moc2 bad back-ref ${index}`
          );
        }
        return this.objects[index];
      }
      const value = readMoc2ObjectBody(this, type);
      this.objects.push(value);
      return value;
    }
    parseModel() {
      const version = this.readHeader();
      if (version > 11) {
        throw new Error(
          `@doki-land/live2d-renderer: moc2 version ${version} newer than supported (11)`
        );
      }
      const root = this.readObject();
      this.readEofGuard();
      if (!root || typeof root !== "object" || root.kind !== "model") {
        throw new Error(
          "@doki-land/live2d-renderer: moc2 root is not ModelImpl"
        );
      }
      return root;
    }
  };

  // ../../live2d-renderer/src/moc/drawable-flags.ts
  var Moc3DrawableFlag = {
    BlendAdditive: 1 << 0,
    BlendMultiplicative: 1 << 1,
    IsDoubleSided: 1 << 2,
    IsInvertedMask: 1 << 3
  };
  function decodeMoc3DrawableFlags(flags) {
    let blendMode = FrameBlendMode.Normal;
    if ((flags & Moc3DrawableFlag.BlendAdditive) !== 0) {
      blendMode = FrameBlendMode.Additive;
    } else if ((flags & Moc3DrawableFlag.BlendMultiplicative) !== 0) {
      blendMode = FrameBlendMode.Multiplicative;
    }
    return {
      blendMode,
      invertedMask: (flags & Moc3DrawableFlag.IsInvertedMask) !== 0,
      doubleSided: (flags & Moc3DrawableFlag.IsDoubleSided) !== 0
    };
  }
  function decodeMoc2ColorComposition(composition) {
    if (composition === 1) return FrameBlendMode.Additive;
    if (composition === 2) return FrameBlendMode.Multiplicative;
    return FrameBlendMode.Normal;
  }

  // ../../live2d-renderer/src/moc/moc2-keyforms.ts
  var EPS = 1e-3;
  function samplePivot(pivot, value) {
    const count = pivot.pivotCount;
    const values = pivot.pivotValues;
    if (count < 1) return { index: 0, weight: 0 };
    if (count === 1) return { index: 0, weight: 0 };
    const first = values[0] ?? 0;
    if (value < first + EPS) return { index: 0, weight: 0 };
    for (let i = 1; i < count; i++) {
      const lo = values[i - 1] ?? 0;
      const hi = values[i] ?? 0;
      if (value < hi + EPS) {
        if (value > hi - EPS) return { index: i, weight: 0 };
        const span = hi - lo;
        return {
          index: i - 1,
          weight: span === 0 ? 0 : (value - lo) / span
        };
      }
    }
    return { index: count - 1, weight: 0 };
  }
  function resolveKeyformBlend(manager, getParam) {
    if (!manager || manager.pivots.length === 0) {
      return { indices: [0], weights: [], lerpCount: 0 };
    }
    const samples = manager.pivots.map(
      (p) => samplePivot(p, getParam(p.paramId))
    );
    let lerpCount = 0;
    for (const s of samples) if (s.weight > 0) lerpCount++;
    const n = 1 << lerpCount;
    const indices = new Array(n).fill(0);
    const weights = [];
    let stride = 1;
    let lerpDim = 0;
    for (let p = 0; p < samples.length; p++) {
      const s = samples[p];
      const pivotCount = Math.max(1, manager.pivots[p]?.pivotCount ?? 1);
      if (s.weight === 0) {
        const add = s.index * stride;
        for (let i = 0; i < n; i++) indices[i] += add;
      } else {
        const a = s.index * stride;
        const b = (s.index + 1) * stride;
        const dimMask = 1 << lerpDim;
        for (let i = 0; i < n; i++) {
          indices[i] += (i & dimMask) === 0 ? a : b;
        }
        weights[lerpDim] = s.weight;
        lerpDim++;
      }
      stride *= pivotCount;
    }
    return { indices, weights, lerpCount };
  }
  function interpolateKeyforms(keyforms, manager, getParam, floatCount) {
    const out = new Float32Array(floatCount);
    if (keyforms.length === 0) return out;
    const { indices, weights, lerpCount } = resolveKeyformBlend(
      manager,
      getParam
    );
    if (lerpCount <= 0) {
      const src = keyforms[indices[0] ?? 0] ?? keyforms[0];
      const n = Math.min(floatCount, src.length);
      out.set(src.subarray(0, n));
      return out;
    }
    if (lerpCount === 1) {
      const a = keyforms[indices[0]] ?? keyforms[0];
      const b = keyforms[indices[1]] ?? a;
      const t = weights[0];
      const u = 1 - t;
      for (let i = 0; i < floatCount; i++) {
        out[i] = (a[i] ?? 0) * u + (b[i] ?? 0) * t;
      }
      return out;
    }
    if (lerpCount === 2) {
      const a = keyforms[indices[0]] ?? keyforms[0];
      const b = keyforms[indices[1]] ?? a;
      const c = keyforms[indices[2]] ?? a;
      const d = keyforms[indices[3]] ?? a;
      const t = weights[0];
      const s = weights[1];
      const u = 1 - t;
      const v = 1 - s;
      const w00 = v * u;
      const w10 = v * t;
      const w01 = s * u;
      const w11 = s * t;
      for (let i = 0; i < floatCount; i++) {
        out[i] = w00 * (a[i] ?? 0) + w10 * (b[i] ?? 0) + w01 * (c[i] ?? 0) + w11 * (d[i] ?? 0);
      }
      return out;
    }
    const corners = 1 << lerpCount;
    const cornerW = new Float32Array(corners);
    for (let c = 0; c < corners; c++) {
      let w = 1;
      for (let d = 0; d < lerpCount; d++) {
        const t = weights[d];
        w *= (c & 1 << d) === 0 ? 1 - t : t;
      }
      cornerW[c] = w;
    }
    for (let i = 0; i < floatCount; i++) {
      let sum = 0;
      for (let c = 0; c < corners; c++) {
        const src = keyforms[indices[c]] ?? keyforms[0];
        sum += cornerW[c] * (src[i] ?? 0);
      }
      out[i] = sum;
    }
    return out;
  }
  function interpolateScalarTable(table, manager, getParam, fallback) {
    if (!table || table.length === 0) return fallback;
    const perKey = [];
    for (let i = 0; i < table.length; i++) {
      const f = new Float32Array(1);
      f[0] = table[i];
      perKey.push(f);
    }
    const sampled = interpolateKeyforms(perKey, manager, getParam, 1);
    return sampled[0] ?? fallback;
  }

  // ../../live2d-renderer/src/moc/moc2-deform.ts
  var DEG = Math.PI / 180;
  var DST_BASE = "DST_BASE";
  function isRootBaseId(id) {
    return !id || id === DST_BASE;
  }
  var IDENTITY = {
    kind: "affine",
    originX: 0,
    originY: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    reflectX: false,
    reflectY: false
  };
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function sampleAffine(deformer, getParam) {
    const list = deformer.affines ?? [];
    if (list.length === 0) return { ...IDENTITY };
    if (list.length === 1) return { ...list[0] };
    const { indices, weights, lerpCount } = resolveKeyformBlend(
      deformer.pivotManager,
      getParam
    );
    const pick2 = (i) => list[indices[i] ?? 0] ?? list[0];
    if (lerpCount <= 0) return { ...pick2(0) };
    if (lerpCount === 1) {
      const a = pick2(0);
      const b = pick2(1);
      const t = weights[0];
      return {
        kind: "affine",
        originX: lerp(a.originX, b.originX, t),
        originY: lerp(a.originY, b.originY, t),
        scaleX: lerp(a.scaleX, b.scaleX, t),
        scaleY: lerp(a.scaleY, b.scaleY, t),
        rotation: lerp(a.rotation, b.rotation, t),
        reflectX: a.reflectX,
        reflectY: a.reflectY
      };
    }
    const corners = 1 << lerpCount;
    let ox = 0, oy = 0, sx = 0, sy = 0, rot = 0;
    for (let c = 0; c < corners; c++) {
      let w = 1;
      for (let d = 0; d < lerpCount; d++) {
        const t = weights[d];
        w *= (c & 1 << d) === 0 ? 1 - t : t;
      }
      const a = pick2(c);
      ox += w * a.originX;
      oy += w * a.originY;
      sx += w * a.scaleX;
      sy += w * a.scaleY;
      rot += w * a.rotation;
    }
    const base = pick2(0);
    return {
      kind: "affine",
      originX: ox,
      originY: oy,
      scaleX: sx,
      scaleY: sy,
      rotation: rot,
      reflectX: base.reflectX,
      reflectY: base.reflectY
    };
  }
  function applyAffine(positions, aff, totalScale = aff.scaleX) {
    const out = new Float32Array(positions.length);
    const sn = Math.sin(aff.rotation * DEG);
    const cs = Math.cos(aff.rotation * DEG);
    const rx = aff.reflectX ? -1 : 1;
    const ry = aff.reflectY ? -1 : 1;
    const m00 = cs * totalScale * rx;
    const m01 = -sn * totalScale * ry;
    const m10 = sn * totalScale * rx;
    const m11 = cs * totalScale * ry;
    const tx = aff.originX;
    const ty = aff.originY;
    for (let i = 0; i + 1 < positions.length; i += 2) {
      const x = positions[i];
      const y = positions[i + 1];
      out[i] = m00 * x + m01 * y + tx;
      out[i + 1] = m10 * x + m11 * y + ty;
    }
    return out;
  }
  function warpPointsByMesh(src, grid, rows, cols) {
    const out = new Float32Array(src.length);
    const o = rows;
    const A = cols;
    const stride = o + 1;
    let ready = false;
    let cx = 0, cy = 0, bl = 0, bk = 0, bf = 0, be = 0;
    const g = (ix, iy) => {
      const i = (ix + iy * stride) * 2;
      return [grid[i] ?? 0, grid[i + 1] ?? 0];
    };
    for (let i = 0; i + 1 < src.length; i += 2) {
      const lx = src[i];
      const ly = src[i + 1];
      const bd = lx * o;
      const a7 = ly * A;
      if (bd < 0 || a7 < 0 || o <= bd || A <= a7) {
        if (!ready) {
          ready = true;
          const [x00, y00] = g(0, 0);
          const [x10, y10] = g(o, 0);
          const [x01, y01] = g(0, A);
          const [x11, y11] = g(o, A);
          cx = 0.25 * (x00 + x10 + x01 + x11);
          cy = 0.25 * (y00 + y10 + y01 + y11);
          const aM = x11 - x00;
          const aL = y11 - y00;
          const bh = x10 - x01;
          const bg = y10 - y01;
          bl = (aM + bh) * 0.5;
          bk = (aL + bg) * 0.5;
          bf = (aM - bh) * 0.5;
          be = (aL - bg) * 0.5;
          cx -= 0.5 * (bl + bf);
          cy -= 0.5 * (bk + be);
        }
        if (lx > -2 && lx < 3 && ly > -2 && ly < 3) {
          const u = Math.min(1, Math.max(0, lx));
          const v = Math.min(1, Math.max(0, ly));
          const bd2 = u * o;
          const a72 = v * A;
          const ix = Math.min(o - 1, Math.max(0, bd2 | 0));
          const iy = Math.min(A - 1, Math.max(0, a72 | 0));
          const bn2 = bd2 - ix;
          const bm2 = a72 - iy;
          const base2 = 2 * (ix + iy * stride);
          if (bn2 + bm2 < 1) {
            out[i] = (grid[base2] ?? 0) * (1 - bn2 - bm2) + (grid[base2 + 2] ?? 0) * bn2 + (grid[base2 + 2 * stride] ?? 0) * bm2;
            out[i + 1] = (grid[base2 + 1] ?? 0) * (1 - bn2 - bm2) + (grid[base2 + 3] ?? 0) * bn2 + (grid[base2 + 2 * stride + 1] ?? 0) * bm2;
          } else {
            out[i] = (grid[base2 + 2 * stride + 2] ?? 0) * (bn2 - 1 + bm2) + (grid[base2 + 2 * stride] ?? 0) * (1 - bn2) + (grid[base2 + 2] ?? 0) * (1 - bm2);
            out[i + 1] = (grid[base2 + 2 * stride + 3] ?? 0) * (bn2 - 1 + bm2) + (grid[base2 + 2 * stride + 1] ?? 0) * (1 - bn2) + (grid[base2 + 3] ?? 0) * (1 - bm2);
          }
        } else {
          out[i] = cx + lx * bl + ly * bf;
          out[i + 1] = cy + lx * bk + ly * be;
        }
        continue;
      }
      const bn = bd - (bd | 0);
      const bm = a7 - (a7 | 0);
      const base = 2 * ((bd | 0) + (a7 | 0) * stride);
      if (bn + bm < 1) {
        out[i] = (grid[base] ?? 0) * (1 - bn - bm) + (grid[base + 2] ?? 0) * bn + (grid[base + 2 * stride] ?? 0) * bm;
        out[i + 1] = (grid[base + 1] ?? 0) * (1 - bn - bm) + (grid[base + 3] ?? 0) * bn + (grid[base + 2 * stride + 1] ?? 0) * bm;
      } else {
        out[i] = (grid[base + 2 * stride + 2] ?? 0) * (bn - 1 + bm) + (grid[base + 2 * stride] ?? 0) * (1 - bn) + (grid[base + 2] ?? 0) * (1 - bm);
        out[i + 1] = (grid[base + 2 * stride + 3] ?? 0) * (bn - 1 + bm) + (grid[base + 2 * stride + 1] ?? 0) * (1 - bn) + (grid[base + 3] ?? 0) * (1 - bm);
      }
    }
    return out;
  }
  function applyOp(positions, op) {
    if (op.kind === "affine") {
      return applyAffine(positions, op.aff, op.totalScale);
    }
    return warpPointsByMesh(positions, op.grid, op.rows, op.cols);
  }
  function sampleMeshGrid(deformer, getParam) {
    const rows = deformer.rows ?? 0;
    const cols = deformer.cols ?? 0;
    const floatCount = (rows + 1) * (cols + 1) * 2;
    return interpolateKeyforms(
      deformer.keyforms ?? [],
      deformer.pivotManager,
      getParam,
      floatCount
    );
  }
  function collectDeformers(model) {
    const map = /* @__PURE__ */ new Map();
    for (const part of model.parts) {
      for (const d of part.baseData) {
        if (d.id) map.set(d.id, d);
      }
    }
    return map;
  }
  function topoOrder(defs) {
    const visiting = /* @__PURE__ */ new Set();
    const done = /* @__PURE__ */ new Set();
    const out = [];
    const visit = (id) => {
      if (done.has(id) || !defs.has(id)) return;
      if (visiting.has(id)) return;
      visiting.add(id);
      const def = defs.get(id);
      if (!isRootBaseId(def.targetBaseId)) {
        visit(def.targetBaseId);
      }
      visiting.delete(id);
      done.add(id);
      out.push(id);
    };
    for (const id of defs.keys()) visit(id);
    return out;
  }
  function bakeDeformerOps(model, getParam) {
    const defs = collectDeformers(model);
    const world = /* @__PURE__ */ new Map();
    for (const id of topoOrder(defs)) {
      const def = defs.get(id);
      const parentId = def.targetBaseId;
      const parentOp = !isRootBaseId(parentId) && parentId ? world.get(parentId) : void 0;
      if (def.kind === "affineDeformer") {
        const local = sampleAffine(def, getParam);
        if (!parentOp) {
          world.set(id, {
            kind: "affine",
            aff: local,
            totalScale: local.scaleX
          });
        } else if (parentOp.kind === "affine") {
          const origin = applyOp(
            new Float32Array([local.originX, local.originY]),
            parentOp
          );
          const composed = {
            ...local,
            originX: origin[0],
            originY: origin[1],
            rotation: local.rotation + parentOp.aff.rotation
          };
          world.set(id, {
            kind: "affine",
            aff: composed,
            totalScale: parentOp.totalScale * local.scaleX
          });
        } else {
          const origin = applyOp(
            new Float32Array([local.originX, local.originY]),
            parentOp
          );
          world.set(id, {
            kind: "affine",
            aff: {
              ...local,
              originX: origin[0],
              originY: origin[1]
            },
            totalScale: local.scaleX
          });
        }
        continue;
      }
      let grid = sampleMeshGrid(def, getParam);
      if (parentOp) {
        grid = applyOp(grid, parentOp);
      }
      world.set(id, {
        kind: "mesh",
        grid,
        rows: def.rows ?? 0,
        cols: def.cols ?? 0
      });
    }
    return world;
  }
  function transformDrawablePositions(mesh, local, ops) {
    const parent = mesh.targetBaseId;
    if (isRootBaseId(parent) || !parent) return local;
    const op = ops.get(parent);
    if (!op) return local;
    return applyOp(local, op);
  }

  // ../../live2d-renderer/src/moc/moc2-to-program.ts
  function buildParamGetter(params, overrides) {
    if (typeof overrides === "function") return overrides;
    const defaults = /* @__PURE__ */ new Map();
    for (const p of params) defaults.set(p.id, p.defaultValue);
    if (overrides) {
      for (const [k, v] of overrides) defaults.set(k, v);
    }
    return (id) => defaults.get(id) ?? 0;
  }
  function moc2ParamGetterFromValues(params, values) {
    const byId = /* @__PURE__ */ new Map();
    for (let i = 0; i < params.length; i++) {
      byId.set(params[i].id, values[i] ?? params[i].defaultValue);
    }
    return (id) => byId.get(id) ?? 0;
  }
  function normalizePositions(positions, canvasWidth, canvasHeight) {
    const w = canvasWidth > 0 ? canvasWidth : 1;
    const h = canvasHeight > 0 ? canvasHeight : 1;
    const out = new Float32Array(positions.length);
    for (let i = 0; i + 1 < positions.length; i += 2) {
      out[i] = positions[i] / w * 2 - 1;
      out[i + 1] = 1 - positions[i + 1] / h * 2;
    }
    return out;
  }
  function lowerDrawable(mesh, getParam, ops, canvasWidth, canvasHeight, partVisible) {
    const floatCount = mesh.numPoints * 2;
    const local = interpolateKeyforms(
      mesh.keyforms,
      mesh.pivotManager,
      getParam,
      floatCount
    );
    const world = transformDrawablePositions(mesh, local, ops);
    const positions = normalizePositions(world, canvasWidth, canvasHeight);
    const opacity = interpolateScalarTable(
      mesh.opacities,
      mesh.pivotManager,
      getParam,
      1
    );
    const renderOrder = Math.round(
      interpolateScalarTable(
        mesh.drawOrders,
        mesh.pivotManager,
        getParam,
        mesh.averageDrawOrder
      )
    );
    const blendMode = (mesh.optionFlags & 1) !== 0 ? decodeMoc2ColorComposition(mesh.colorComposition) : FrameBlendMode.Normal;
    return {
      id: mesh.id,
      textureIndex: mesh.textureIndex,
      positions,
      uvs: new Float32Array(mesh.uvs),
      indices: new Uint16Array(mesh.indices),
      opacity,
      renderOrder,
      blendMode,
      clipId: mesh.clipId,
      visible: partVisible
    };
  }
  function moc2ModelToProgram(model, options = {}) {
    const paramDefs = model.paramDefSet?.params ?? [];
    const parameters = paramDefs.map((p) => ({
      id: p.id,
      min: p.min,
      max: p.max,
      defaultValue: p.defaultValue
    }));
    const getParam = options.getParam ?? buildParamGetter(paramDefs);
    const ops = bakeDeformerOps(model, getParam);
    const drafts = [];
    for (const part of model.parts) {
      for (const mesh of part.drawData) {
        drafts.push(
          lowerDrawable(
            mesh,
            getParam,
            ops,
            model.canvasWidth,
            model.canvasHeight,
            part.visible
          )
        );
      }
    }
    drafts.sort((a, b) => a.renderOrder - b.renderOrder);
    const idToIndex = /* @__PURE__ */ new Map();
    for (let i = 0; i < drafts.length; i++) {
      idToIndex.set(drafts[i].id, i);
    }
    const drawables = drafts.map((d, index) => {
      const maskIndices = [];
      if (d.clipId) {
        for (const raw of d.clipId.split(",")) {
          const id = raw.trim();
          if (!id) continue;
          const mapped = idToIndex.get(id);
          if (mapped !== void 0) maskIndices.push(mapped);
        }
      }
      return {
        index,
        textureIndex: d.textureIndex,
        positions: d.positions,
        uvs: d.uvs,
        indices: d.indices,
        opacity: d.opacity,
        renderOrder: d.renderOrder,
        blendMode: d.blendMode,
        invertedMask: false,
        maskIndices,
        visible: d.visible,
        deformParamIndex: -1,
        deformDeltas: null
      };
    });
    return {
      format: "moc2",
      codec: "moc2",
      parameters,
      drawables
    };
  }

  // ../../live2d-renderer/src/moc/moc3-layout.ts
  var MOC3_MAGIC = "MOC3";
  var MOC3_HEADER_SIZE = 64;
  var MOC3_SOT_COUNT = 160;
  var MOC3_COUNT_MAX = 23;
  var CountIdx = {
    PARTS: 0,
    DEFORMERS: 1,
    WARP_DEFORMERS: 2,
    ROTATION_DEFORMERS: 3,
    ART_MESHES: 4,
    PARAMETERS: 5,
    PART_KEYFORMS: 6,
    WARP_DEFORMER_KEYFORMS: 7,
    ROTATION_DEFORMER_KEYFORMS: 8,
    ART_MESH_KEYFORMS: 9,
    KEYFORM_POSITIONS: 10,
    KEYFORM_BINDING_INDICES: 11,
    KEYFORM_BINDING_BANDS: 12,
    KEYFORM_BINDINGS: 13,
    KEYS: 14,
    UVS: 15,
    POSITION_INDICES: 16,
    DRAWABLE_MASKS: 17,
    DRAW_ORDER_GROUPS: 18,
    DRAW_ORDER_GROUP_OBJECTS: 19,
    GLUES: 20,
    GLUE_INFOS: 21,
    GLUE_KEYFORMS: 22
  };
  var MOC3_SECTION_LAYOUT = [
    {
      name: "part.runtime_space",
      elemType: "runtime",
      countIdx: CountIdx.PARTS
    },
    { name: "part.ids", elemType: "str64", countIdx: CountIdx.PARTS },
    {
      name: "part.keyform_binding_band_indices",
      elemType: "i32",
      countIdx: CountIdx.PARTS
    },
    {
      name: "part.keyform_begin_indices",
      elemType: "i32",
      countIdx: CountIdx.PARTS
    },
    { name: "part.keyform_counts", elemType: "i32", countIdx: CountIdx.PARTS },
    { name: "part.visibles", elemType: "bool", countIdx: CountIdx.PARTS },
    { name: "part.enables", elemType: "bool", countIdx: CountIdx.PARTS },
    {
      name: "part.parent_part_indices",
      elemType: "i32",
      countIdx: CountIdx.PARTS
    },
    {
      name: "deformer.runtime_space",
      elemType: "runtime",
      countIdx: CountIdx.DEFORMERS
    },
    { name: "deformer.ids", elemType: "str64", countIdx: CountIdx.DEFORMERS },
    {
      name: "deformer.keyform_binding_band_indices",
      elemType: "i32",
      countIdx: CountIdx.DEFORMERS
    },
    {
      name: "deformer.visibles",
      elemType: "bool",
      countIdx: CountIdx.DEFORMERS
    },
    {
      name: "deformer.enables",
      elemType: "bool",
      countIdx: CountIdx.DEFORMERS
    },
    {
      name: "deformer.parent_part_indices",
      elemType: "i32",
      countIdx: CountIdx.DEFORMERS
    },
    {
      name: "deformer.parent_deformer_indices",
      elemType: "i32",
      countIdx: CountIdx.DEFORMERS
    },
    { name: "deformer.types", elemType: "i32", countIdx: CountIdx.DEFORMERS },
    {
      name: "deformer.specific_indices",
      elemType: "i32",
      countIdx: CountIdx.DEFORMERS
    },
    {
      name: "warp_deformer.keyform_binding_band_indices",
      elemType: "i32",
      countIdx: CountIdx.WARP_DEFORMERS
    },
    {
      name: "warp_deformer.keyform_begin_indices",
      elemType: "i32",
      countIdx: CountIdx.WARP_DEFORMERS
    },
    {
      name: "warp_deformer.keyform_counts",
      elemType: "i32",
      countIdx: CountIdx.WARP_DEFORMERS
    },
    {
      name: "warp_deformer.vertex_counts",
      elemType: "i32",
      countIdx: CountIdx.WARP_DEFORMERS
    },
    {
      name: "warp_deformer.rows",
      elemType: "i32",
      countIdx: CountIdx.WARP_DEFORMERS
    },
    {
      name: "warp_deformer.cols",
      elemType: "i32",
      countIdx: CountIdx.WARP_DEFORMERS
    },
    {
      name: "rotation_deformer.keyform_binding_band_indices",
      elemType: "i32",
      countIdx: CountIdx.ROTATION_DEFORMERS
    },
    {
      name: "rotation_deformer.keyform_begin_indices",
      elemType: "i32",
      countIdx: CountIdx.ROTATION_DEFORMERS
    },
    {
      name: "rotation_deformer.keyform_counts",
      elemType: "i32",
      countIdx: CountIdx.ROTATION_DEFORMERS
    },
    {
      name: "rotation_deformer.base_angles",
      elemType: "f32",
      countIdx: CountIdx.ROTATION_DEFORMERS
    },
    {
      name: "art_mesh.runtime_space_0",
      elemType: "runtime",
      countIdx: CountIdx.ART_MESHES
    },
    {
      name: "art_mesh.runtime_space_1",
      elemType: "runtime",
      countIdx: CountIdx.ART_MESHES
    },
    {
      name: "art_mesh.runtime_space_2",
      elemType: "runtime",
      countIdx: CountIdx.ART_MESHES
    },
    {
      name: "art_mesh.runtime_space_3",
      elemType: "runtime",
      countIdx: CountIdx.ART_MESHES
    },
    { name: "art_mesh.ids", elemType: "str64", countIdx: CountIdx.ART_MESHES },
    {
      name: "art_mesh.keyform_binding_band_indices",
      elemType: "i32",
      countIdx: CountIdx.ART_MESHES
    },
    {
      name: "art_mesh.keyform_begin_indices",
      elemType: "i32",
      countIdx: CountIdx.ART_MESHES
    },
    {
      name: "art_mesh.keyform_counts",
      elemType: "i32",
      countIdx: CountIdx.ART_MESHES
    },
    {
      name: "art_mesh.visibles",
      elemType: "bool",
      countIdx: CountIdx.ART_MESHES
    },
    {
      name: "art_mesh.enables",
      elemType: "bool",
      countIdx: CountIdx.ART_MESHES
    },
    {
      name: "art_mesh.parent_part_indices",
      elemType: "i32",
      countIdx: CountIdx.ART_MESHES
    },
    {
      name: "art_mesh.parent_deformer_indices",
      elemType: "i32",
      countIdx: CountIdx.ART_MESHES
    },
    {
      name: "art_mesh.texture_indices",
      elemType: "i32",
      countIdx: CountIdx.ART_MESHES
    },
    {
      name: "art_mesh.drawable_flags",
      elemType: "i32",
      countIdx: CountIdx.ART_MESHES
    },
    // NOTE: names match observed Wanko SOT payloads (vertex count then UV/index tables).
    {
      name: "art_mesh.vertex_counts",
      elemType: "i32",
      countIdx: CountIdx.ART_MESHES
    },
    {
      name: "art_mesh.uv_begin_indices",
      elemType: "i32",
      countIdx: CountIdx.ART_MESHES
    },
    {
      name: "art_mesh.position_index_begin_indices",
      elemType: "i32",
      countIdx: CountIdx.ART_MESHES
    },
    {
      name: "art_mesh.position_index_counts",
      elemType: "i32",
      countIdx: CountIdx.ART_MESHES
    },
    {
      name: "art_mesh.mask_begin_indices",
      elemType: "i32",
      countIdx: CountIdx.ART_MESHES
    },
    {
      name: "art_mesh.mask_counts",
      elemType: "i32",
      countIdx: CountIdx.ART_MESHES
    },
    {
      name: "parameter.runtime_space",
      elemType: "runtime",
      countIdx: CountIdx.PARAMETERS
    },
    { name: "parameter.ids", elemType: "str64", countIdx: CountIdx.PARAMETERS },
    {
      name: "parameter.max_values",
      elemType: "f32",
      countIdx: CountIdx.PARAMETERS
    },
    {
      name: "parameter.min_values",
      elemType: "f32",
      countIdx: CountIdx.PARAMETERS
    },
    {
      name: "parameter.default_values",
      elemType: "f32",
      countIdx: CountIdx.PARAMETERS
    },
    {
      name: "parameter.repeats",
      elemType: "bool",
      countIdx: CountIdx.PARAMETERS
    },
    {
      name: "parameter.decimal_places",
      elemType: "i32",
      countIdx: CountIdx.PARAMETERS
    },
    {
      name: "parameter.keyform_binding_begin_indices",
      elemType: "i32",
      countIdx: CountIdx.PARAMETERS
    },
    {
      name: "parameter.keyform_binding_counts",
      elemType: "i32",
      countIdx: CountIdx.PARAMETERS
    },
    {
      name: "part_keyform.draw_orders",
      elemType: "f32",
      countIdx: CountIdx.PART_KEYFORMS
    },
    {
      name: "warp_deformer_keyform.opacities",
      elemType: "f32",
      countIdx: CountIdx.WARP_DEFORMER_KEYFORMS
    },
    {
      name: "warp_deformer_keyform.keyform_position_begin_indices",
      elemType: "i32",
      countIdx: CountIdx.WARP_DEFORMER_KEYFORMS
    },
    {
      name: "rotation_deformer_keyform.opacities",
      elemType: "f32",
      countIdx: CountIdx.ROTATION_DEFORMER_KEYFORMS
    },
    {
      name: "rotation_deformer_keyform.angles",
      elemType: "f32",
      countIdx: CountIdx.ROTATION_DEFORMER_KEYFORMS
    },
    {
      name: "rotation_deformer_keyform.origin_xs",
      elemType: "f32",
      countIdx: CountIdx.ROTATION_DEFORMER_KEYFORMS
    },
    {
      name: "rotation_deformer_keyform.origin_ys",
      elemType: "f32",
      countIdx: CountIdx.ROTATION_DEFORMER_KEYFORMS
    },
    {
      name: "rotation_deformer_keyform.scales",
      elemType: "f32",
      countIdx: CountIdx.ROTATION_DEFORMER_KEYFORMS
    },
    {
      name: "rotation_deformer_keyform.reflect_xs",
      elemType: "bool",
      countIdx: CountIdx.ROTATION_DEFORMER_KEYFORMS
    },
    {
      name: "rotation_deformer_keyform.reflect_ys",
      elemType: "bool",
      countIdx: CountIdx.ROTATION_DEFORMER_KEYFORMS
    },
    {
      name: "art_mesh_keyform.opacities",
      elemType: "f32",
      countIdx: CountIdx.ART_MESH_KEYFORMS
    },
    {
      name: "art_mesh_keyform.draw_orders",
      elemType: "f32",
      countIdx: CountIdx.ART_MESH_KEYFORMS
    },
    {
      name: "art_mesh_keyform.keyform_position_begin_indices",
      elemType: "i32",
      countIdx: CountIdx.ART_MESH_KEYFORMS
    },
    {
      name: "keyform_position.xys",
      elemType: "f32",
      countIdx: CountIdx.KEYFORM_POSITIONS
    },
    {
      name: "keyform_binding_index.indices",
      elemType: "i32",
      countIdx: CountIdx.KEYFORM_BINDING_INDICES
    },
    {
      name: "keyform_binding_band.begin_indices",
      elemType: "i32",
      countIdx: CountIdx.KEYFORM_BINDING_BANDS
    },
    {
      name: "keyform_binding_band.counts",
      elemType: "i32",
      countIdx: CountIdx.KEYFORM_BINDING_BANDS
    },
    {
      name: "keyform_binding.keys_begin_indices",
      elemType: "i32",
      countIdx: CountIdx.KEYFORM_BINDINGS
    },
    {
      name: "keyform_binding.keys_counts",
      elemType: "i32",
      countIdx: CountIdx.KEYFORM_BINDINGS
    },
    { name: "keys.values", elemType: "f32", countIdx: CountIdx.KEYS },
    { name: "uv.xys", elemType: "f32", countIdx: CountIdx.UVS },
    {
      name: "position_index.indices",
      elemType: "i16",
      countIdx: CountIdx.POSITION_INDICES
    },
    {
      name: "drawable_mask.art_mesh_indices",
      elemType: "i32",
      countIdx: CountIdx.DRAWABLE_MASKS
    },
    {
      name: "draw_order_group.object_begin_indices",
      elemType: "i32",
      countIdx: CountIdx.DRAW_ORDER_GROUPS
    },
    {
      name: "draw_order_group.object_counts",
      elemType: "i32",
      countIdx: CountIdx.DRAW_ORDER_GROUPS
    },
    {
      name: "draw_order_group.object_total_counts",
      elemType: "i32",
      countIdx: CountIdx.DRAW_ORDER_GROUPS
    },
    {
      name: "draw_order_group.min_draw_orders",
      elemType: "i32",
      countIdx: CountIdx.DRAW_ORDER_GROUPS
    },
    {
      name: "draw_order_group.max_draw_orders",
      elemType: "i32",
      countIdx: CountIdx.DRAW_ORDER_GROUPS
    },
    {
      name: "draw_order_group_object.types",
      elemType: "i32",
      countIdx: CountIdx.DRAW_ORDER_GROUP_OBJECTS
    },
    {
      name: "draw_order_group_object.indices",
      elemType: "i32",
      countIdx: CountIdx.DRAW_ORDER_GROUP_OBJECTS
    },
    {
      name: "draw_order_group_object.group_indices",
      elemType: "i32",
      countIdx: CountIdx.DRAW_ORDER_GROUP_OBJECTS
    },
    {
      name: "glue.runtime_space",
      elemType: "runtime",
      countIdx: CountIdx.GLUES
    },
    { name: "glue.ids", elemType: "str64", countIdx: CountIdx.GLUES },
    {
      name: "glue.keyform_binding_band_indices",
      elemType: "i32",
      countIdx: CountIdx.GLUES
    },
    {
      name: "glue.keyform_begin_indices",
      elemType: "i32",
      countIdx: CountIdx.GLUES
    },
    { name: "glue.keyform_counts", elemType: "i32", countIdx: CountIdx.GLUES },
    {
      name: "glue.art_mesh_index_as",
      elemType: "i32",
      countIdx: CountIdx.GLUES
    },
    {
      name: "glue.art_mesh_index_bs",
      elemType: "i32",
      countIdx: CountIdx.GLUES
    },
    {
      name: "glue.info_begin_indices",
      elemType: "i32",
      countIdx: CountIdx.GLUES
    },
    { name: "glue.info_counts", elemType: "i32", countIdx: CountIdx.GLUES },
    {
      name: "glue_info.weights",
      elemType: "f32",
      countIdx: CountIdx.GLUE_INFOS
    },
    {
      name: "glue_info.position_indices",
      elemType: "i16",
      countIdx: CountIdx.GLUE_INFOS
    },
    {
      name: "glue_keyform.intensities",
      elemType: "f32",
      countIdx: CountIdx.GLUE_KEYFORMS
    }
  ];

  // ../../live2d-renderer/src/moc/moc3-reader.ts
  function readMagic(bytes) {
    if (bytes.byteLength < 4) return "";
    return String.fromCharCode(...new Uint8Array(bytes, 0, 4));
  }
  function sectionCount(counts, entry) {
    if (entry.countIdx < 0 || entry.countIdx >= counts.length) return 0;
    return Math.max(0, counts[entry.countIdx]);
  }
  function readI32Array(view, offset, count, le) {
    const out = new Int32Array(count);
    for (let i = 0; i < count; i++) {
      out[i] = view.getInt32(offset + i * 4, le);
    }
    return out;
  }
  function readF32Array(view, offset, count, le) {
    const out = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      out[i] = view.getFloat32(offset + i * 4, le);
    }
    return out;
  }
  function readI16Array(view, offset, count, le) {
    const out = new Int16Array(count);
    for (let i = 0; i < count; i++) {
      out[i] = view.getInt16(offset + i * 2, le);
    }
    return out;
  }
  function readStr64Array(bytes, offset, count) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const start = offset + i * 64;
      const slice = bytes.subarray(start, start + 64);
      let end = slice.indexOf(0);
      if (end < 0) end = 64;
      out.push(String.fromCharCode(...slice.subarray(0, end)));
    }
    return out;
  }
  function readSection(bytes, view, offset, entry, count, le) {
    if (count <= 0 || offset <= 0 || offset >= bytes.byteLength) {
      return entry.elemType === "str64" ? [] : new Int32Array(0);
    }
    switch (entry.elemType) {
      case "runtime":
        return bytes.subarray(offset, offset + count * 8);
      case "str64":
        return readStr64Array(bytes, offset, count);
      case "i32":
      case "bool":
        return readI32Array(view, offset, count, le);
      case "f32":
        return readF32Array(view, offset, count, le);
      case "i16":
        return readI16Array(view, offset, count, le);
      case "u8":
        return bytes.subarray(offset, offset + count);
      default:
        return new Int32Array(0);
    }
  }
  function parseMoc3Document(buffer) {
    if (buffer.byteLength < MOC3_HEADER_SIZE + MOC3_SOT_COUNT * 4) {
      throw new Error("@doki-land/live2d-renderer: truncated MOC3 header");
    }
    const magic = readMagic(buffer);
    if (magic !== MOC3_MAGIC) {
      throw new Error(
        `@doki-land/live2d-renderer: unrecognized moc3 bytes (magic=${JSON.stringify(magic)})`
      );
    }
    const bytes = new Uint8Array(buffer);
    const version = bytes[4];
    const littleEndian = bytes[5] === 0;
    const view = new DataView(buffer);
    const sot = new Int32Array(MOC3_SOT_COUNT);
    for (let i = 0; i < MOC3_SOT_COUNT; i++) {
      sot[i] = view.getInt32(MOC3_HEADER_SIZE + i * 4, littleEndian);
    }
    const countInfoOff = sot[0];
    if (countInfoOff <= 0 || countInfoOff + MOC3_COUNT_MAX * 4 > buffer.byteLength) {
      throw new Error(
        "@doki-land/live2d-renderer: invalid MOC3 count info offset"
      );
    }
    const counts = readI32Array(
      view,
      countInfoOff,
      MOC3_COUNT_MAX,
      littleEndian
    );
    const canvasOff = sot[1];
    if (canvasOff <= 0 || canvasOff + 24 > buffer.byteLength) {
      throw new Error(
        "@doki-land/live2d-renderer: invalid MOC3 canvas info offset"
      );
    }
    const canvas = {
      pixelsPerUnit: view.getFloat32(canvasOff, littleEndian),
      originX: view.getFloat32(canvasOff + 4, littleEndian),
      originY: view.getFloat32(canvasOff + 8, littleEndian),
      canvasWidth: view.getFloat32(canvasOff + 12, littleEndian),
      canvasHeight: view.getFloat32(canvasOff + 16, littleEndian),
      flags: bytes[canvasOff + 20]
    };
    const sections = /* @__PURE__ */ new Map();
    for (let i = 0; i < MOC3_SECTION_LAYOUT.length; i++) {
      const entry = MOC3_SECTION_LAYOUT[i];
      const sotIdx = i + 2;
      const offset = sotIdx < sot.length ? sot[sotIdx] : 0;
      const count = sectionCount(counts, entry);
      sections.set(
        entry.name,
        readSection(bytes, view, offset, entry, count, littleEndian)
      );
    }
    return { version, littleEndian, counts, canvas, sections };
  }
  function moc3SectionI32(doc, name) {
    const v = doc.sections.get(name);
    return v instanceof Int32Array ? v : new Int32Array(0);
  }
  function moc3SectionF32(doc, name) {
    const v = doc.sections.get(name);
    return v instanceof Float32Array ? v : new Float32Array(0);
  }
  function moc3SectionI16(doc, name) {
    const v = doc.sections.get(name);
    return v instanceof Int16Array ? v : new Int16Array(0);
  }
  function moc3SectionStrings(doc, name) {
    const v = doc.sections.get(name);
    return Array.isArray(v) ? v : [];
  }

  // ../../live2d-renderer/src/moc/moc3-keyforms.ts
  var EPS2 = 1e-3;
  function sampleKeys(keys, begin, count, value) {
    if (count < 1) return { index: 0, weight: 0 };
    if (count === 1) return { index: 0, weight: 0 };
    const first = keys[begin] ?? 0;
    if (value < first + EPS2) return { index: 0, weight: 0 };
    for (let i = 1; i < count; i++) {
      const lo = keys[begin + i - 1] ?? 0;
      const hi = keys[begin + i] ?? 0;
      if (value < hi + EPS2) {
        if (value > hi - EPS2) return { index: i, weight: 0 };
        const span = hi - lo;
        return {
          index: i - 1,
          weight: span === 0 ? 0 : (value - lo) / span
        };
      }
    }
    return { index: count - 1, weight: 0 };
  }
  function bindingToParam(tables, bindingIndex) {
    for (let p = 0; p < tables.paramCount; p++) {
      const begin = tables.paramBindingBegin[p] ?? -1;
      const count = tables.paramBindingCount[p] ?? 0;
      if (count <= 0 || begin < 0) continue;
      if (bindingIndex >= begin && bindingIndex < begin + count) return p;
    }
    return -1;
  }
  function resolveMoc3KeyformBlend(tables, bandIndex, getParamByIndex) {
    if (bandIndex < 0 || bandIndex >= tables.bandCount.length) {
      return { indices: [0], weights: [], lerpCount: 0 };
    }
    const bindCount = tables.bandCount[bandIndex] ?? 0;
    const bindBegin = tables.bandBegin[bandIndex] ?? 0;
    if (bindCount <= 0) {
      return { indices: [0], weights: [], lerpCount: 0 };
    }
    const samples = [];
    const keyCounts = [];
    for (let i = 0; i < bindCount; i++) {
      const binding = tables.bindingIndex[bindBegin + i] ?? -1;
      if (binding < 0) {
        samples.push({ index: 0, weight: 0 });
        keyCounts.push(1);
        continue;
      }
      const paramIndex = bindingToParam(tables, binding);
      const kBegin = tables.keysBegin[binding] ?? 0;
      const kCount = Math.max(1, tables.keysCount[binding] ?? 1);
      const value = paramIndex >= 0 ? getParamByIndex(paramIndex) : 0;
      samples.push(sampleKeys(tables.keys, kBegin, kCount, value));
      keyCounts.push(kCount);
    }
    let lerpCount = 0;
    for (const s of samples) if (s.weight > 0) lerpCount++;
    const n = 1 << lerpCount;
    const indices = new Array(n).fill(0);
    const weights = [];
    let stride = 1;
    let lerpDim = 0;
    for (let p = 0; p < samples.length; p++) {
      const s = samples[p];
      const pivotCount = keyCounts[p];
      if (s.weight === 0) {
        const add = s.index * stride;
        for (let i = 0; i < n; i++) indices[i] += add;
      } else {
        const a = s.index * stride;
        const b = (s.index + 1) * stride;
        const dimMask = 1 << lerpDim;
        for (let i = 0; i < n; i++) {
          indices[i] += (i & dimMask) === 0 ? a : b;
        }
        weights[lerpDim] = s.weight;
        lerpDim++;
      }
      stride *= pivotCount;
    }
    return { indices, weights, lerpCount };
  }
  function blendKeyformFloats(values, begins, keyformBase, keyformCount, floatCount, blend) {
    const out = new Float32Array(floatCount);
    if (keyformCount <= 0 || floatCount <= 0) return out;
    const pick2 = (rel) => {
      const clamped = Math.min(keyformCount - 1, Math.max(0, rel));
      return begins[keyformBase + clamped] ?? 0;
    };
    if (blend.lerpCount <= 0) {
      const srcOff = pick2(blend.indices[0] ?? 0);
      for (let i = 0; i < floatCount; i++) {
        out[i] = values[srcOff + i] ?? 0;
      }
      return out;
    }
    if (blend.lerpCount === 1) {
      const aOff = pick2(blend.indices[0] ?? 0);
      const bOff = pick2(blend.indices[1] ?? 0);
      const t = blend.weights[0];
      const u = 1 - t;
      for (let i = 0; i < floatCount; i++) {
        out[i] = (values[aOff + i] ?? 0) * u + (values[bOff + i] ?? 0) * t;
      }
      return out;
    }
    const corners = 1 << blend.lerpCount;
    const cornerW = new Float32Array(corners);
    for (let c = 0; c < corners; c++) {
      let w = 1;
      for (let d = 0; d < blend.lerpCount; d++) {
        const t = blend.weights[d];
        w *= (c & 1 << d) === 0 ? 1 - t : t;
      }
      cornerW[c] = w;
    }
    for (let i = 0; i < floatCount; i++) {
      let sum = 0;
      for (let c = 0; c < corners; c++) {
        const srcOff = pick2(blend.indices[c] ?? 0);
        sum += cornerW[c] * (values[srcOff + i] ?? 0);
      }
      out[i] = sum;
    }
    return out;
  }
  function blendKeyformScalar(table, keyformBase, keyformCount, blend, fallback) {
    if (keyformCount <= 0) return fallback;
    const pick2 = (rel) => {
      const clamped = Math.min(keyformCount - 1, Math.max(0, rel));
      return table[keyformBase + clamped] ?? fallback;
    };
    if (blend.lerpCount <= 0) {
      return pick2(blend.indices[0] ?? 0);
    }
    if (blend.lerpCount === 1) {
      const a = pick2(blend.indices[0] ?? 0);
      const b = pick2(blend.indices[1] ?? 0);
      const t = blend.weights[0];
      return a * (1 - t) + b * t;
    }
    const corners = 1 << blend.lerpCount;
    let sum = 0;
    for (let c = 0; c < corners; c++) {
      let w = 1;
      for (let d = 0; d < blend.lerpCount; d++) {
        const t = blend.weights[d];
        w *= (c & 1 << d) === 0 ? 1 - t : t;
      }
      sum += w * pick2(blend.indices[c] ?? 0);
    }
    return sum;
  }

  // ../../live2d-renderer/src/moc/moc3-deform.ts
  var DEG2RAD = Math.PI / 180;
  var WARP = 0;
  var ROTATION = 1;
  function mulAffine(parent, local) {
    return {
      originX: parent.originX + parent.m00 * local.originX + parent.m01 * local.originY,
      originY: parent.originY + parent.m10 * local.originX + parent.m11 * local.originY,
      m00: parent.m00 * local.m00 + parent.m01 * local.m10,
      m10: parent.m10 * local.m00 + parent.m11 * local.m10,
      m01: parent.m00 * local.m01 + parent.m01 * local.m11,
      m11: parent.m10 * local.m01 + parent.m11 * local.m11
    };
  }
  function affineFromRotationKeyform(baseAngle, angle, originX, originY, scale, reflectX, reflectY) {
    const rad = (baseAngle + angle) * DEG2RAD;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    const sx = reflectX ? -scale : scale;
    const sy = reflectY ? -scale : scale;
    return {
      originX,
      originY,
      m00: c * sx,
      m10: s * sx,
      m01: -s * sy,
      m11: c * sy
    };
  }
  function applyAffineToPoints(src, a) {
    const out = new Float32Array(src.length);
    for (let i = 0; i + 1 < src.length; i += 2) {
      const x = src[i];
      const y = src[i + 1];
      out[i] = a.originX + a.m00 * x + a.m01 * y;
      out[i + 1] = a.originY + a.m10 * x + a.m11 * y;
    }
    return out;
  }
  function applyParentToPoints(local, parent) {
    if (parent.kind === "warp") {
      return warpPointsByMesh(local, parent.grid, parent.rows, parent.cols);
    }
    return applyAffineToPoints(local, parent.affine);
  }
  function loadDeformerTables(doc, keyTables) {
    return {
      types: moc3SectionI32(doc, "deformer.types"),
      specific: moc3SectionI32(doc, "deformer.specific_indices"),
      parents: moc3SectionI32(doc, "deformer.parent_deformer_indices"),
      bandIndex: moc3SectionI32(doc, "deformer.keyform_binding_band_indices"),
      enables: moc3SectionI32(doc, "deformer.enables"),
      warpBand: moc3SectionI32(
        doc,
        "warp_deformer.keyform_binding_band_indices"
      ),
      warpKfBegin: moc3SectionI32(doc, "warp_deformer.keyform_begin_indices"),
      warpKfCount: moc3SectionI32(doc, "warp_deformer.keyform_counts"),
      warpVertexCounts: moc3SectionI32(doc, "warp_deformer.vertex_counts"),
      warpRows: moc3SectionI32(doc, "warp_deformer.rows"),
      warpCols: moc3SectionI32(doc, "warp_deformer.cols"),
      warpPosBegins: moc3SectionI32(
        doc,
        "warp_deformer_keyform.keyform_position_begin_indices"
      ),
      rotBand: moc3SectionI32(
        doc,
        "rotation_deformer.keyform_binding_band_indices"
      ),
      rotKfBegin: moc3SectionI32(
        doc,
        "rotation_deformer.keyform_begin_indices"
      ),
      rotKfCount: moc3SectionI32(doc, "rotation_deformer.keyform_counts"),
      rotBaseAngles: moc3SectionF32(doc, "rotation_deformer.base_angles"),
      rotAngles: moc3SectionF32(doc, "rotation_deformer_keyform.angles"),
      rotOriginX: moc3SectionF32(doc, "rotation_deformer_keyform.origin_xs"),
      rotOriginY: moc3SectionF32(doc, "rotation_deformer_keyform.origin_ys"),
      rotScales: moc3SectionF32(doc, "rotation_deformer_keyform.scales"),
      rotReflectX: moc3SectionI32(
        doc,
        "rotation_deformer_keyform.reflect_xs"
      ),
      rotReflectY: moc3SectionI32(
        doc,
        "rotation_deformer_keyform.reflect_ys"
      ),
      positions: moc3SectionF32(doc, "keyform_position.xys"),
      keyTables,
      deformerCount: doc.counts[CountIdx.DEFORMERS] ?? 0,
      pixelsPerUnit: doc.canvas.pixelsPerUnit
    };
  }
  function evalDeformer(index, tables, getParamByIndex, cache) {
    if (index < 0 || index >= tables.deformerCount) return null;
    const hit = cache[index];
    if (hit) return hit;
    if ((tables.enables[index] ?? 1) === 0) {
      cache[index] = null;
      return null;
    }
    const type = tables.types[index] ?? WARP;
    const specific = tables.specific[index] ?? 0;
    const parentIndex = tables.parents[index] ?? -1;
    const parentWorld = parentIndex >= 0 ? evalDeformer(parentIndex, tables, getParamByIndex, cache) : null;
    let world = null;
    if (type === ROTATION) {
      const band = tables.rotBand[specific] ?? -1;
      const kfBegin = tables.rotKfBegin[specific] ?? 0;
      const kfCount = tables.rotKfCount[specific] ?? 0;
      const blend = resolveMoc3KeyformBlend(
        tables.keyTables,
        band,
        getParamByIndex
      );
      const angle = blendKeyformScalar(
        tables.rotAngles,
        kfBegin,
        kfCount,
        blend,
        0
      );
      const ox = blendKeyformScalar(
        tables.rotOriginX,
        kfBegin,
        kfCount,
        blend,
        0
      );
      const oy = blendKeyformScalar(
        tables.rotOriginY,
        kfBegin,
        kfCount,
        blend,
        0
      );
      const scale = blendKeyformScalar(
        tables.rotScales,
        kfBegin,
        kfCount,
        blend,
        1
      );
      const reflectX = blendKeyformScalar(
        tables.rotReflectX,
        kfBegin,
        kfCount,
        blend,
        0
      ) >= 0.5;
      const reflectY = blendKeyformScalar(
        tables.rotReflectY,
        kfBegin,
        kfCount,
        blend,
        0
      ) >= 0.5;
      const local = affineFromRotationKeyform(
        tables.rotBaseAngles[specific] ?? 0,
        angle,
        ox,
        oy,
        scale,
        reflectX,
        reflectY
      );
      if (!parentWorld) {
        world = { kind: "rotation", affine: local };
      } else if (parentWorld.kind === "rotation") {
        world = {
          kind: "rotation",
          affine: mulAffine(parentWorld.affine, local)
        };
      } else {
        const ppu = tables.pixelsPerUnit > 0 ? tables.pixelsPerUnit : 1;
        const alreadyPixelScale = Math.hypot(local.m00, local.m11) < 0.05;
        const s = alreadyPixelScale ? 1 : 1 / ppu;
        const localPx = {
          originX: local.originX,
          originY: local.originY,
          m00: local.m00 * s,
          m10: local.m10 * s,
          m01: local.m01 * s,
          m11: local.m11 * s
        };
        const eps = 1 / 64;
        const probe = new Float32Array([
          localPx.originX,
          localPx.originY,
          localPx.originX + eps,
          localPx.originY,
          localPx.originX,
          localPx.originY + eps
        ]);
        const warped = applyParentToPoints(probe, parentWorld);
        const j00 = (warped[2] - warped[0]) / eps;
        const j10 = (warped[3] - warped[1]) / eps;
        const j01 = (warped[4] - warped[0]) / eps;
        const j11 = (warped[5] - warped[1]) / eps;
        world = {
          kind: "rotation",
          affine: {
            originX: warped[0],
            originY: warped[1],
            m00: j00 * localPx.m00 + j01 * localPx.m10,
            m10: j10 * localPx.m00 + j11 * localPx.m10,
            m01: j00 * localPx.m01 + j01 * localPx.m11,
            m11: j10 * localPx.m01 + j11 * localPx.m11
          }
        };
      }
    } else {
      const band = tables.warpBand[specific] ?? -1;
      const kfBegin = tables.warpKfBegin[specific] ?? 0;
      const kfCount = tables.warpKfCount[specific] ?? 0;
      const vertexCount = tables.warpVertexCounts[specific] ?? 0;
      const rows = tables.warpRows[specific] ?? 0;
      const cols = tables.warpCols[specific] ?? 0;
      const blend = resolveMoc3KeyformBlend(
        tables.keyTables,
        band,
        getParamByIndex
      );
      let grid = blendKeyformFloats(
        tables.positions,
        tables.warpPosBegins,
        kfBegin,
        kfCount,
        vertexCount * 2,
        blend
      );
      if (parentWorld) {
        grid = applyParentToPoints(grid, parentWorld);
      }
      world = { kind: "warp", grid, rows, cols };
    }
    cache[index] = world;
    return world;
  }
  function bakeMoc3Deformers(doc, keyTables, getParamByIndex) {
    const tables = loadDeformerTables(doc, keyTables);
    const cache = new Array(
      tables.deformerCount
    ).fill(null);
    for (let i = 0; i < tables.deformerCount; i++) {
      evalDeformer(i, tables, getParamByIndex, cache);
    }
    return cache;
  }
  function loadMoc3KeyTables(doc) {
    return {
      bindingIndex: moc3SectionI32(doc, "keyform_binding_index.indices"),
      bandBegin: moc3SectionI32(doc, "keyform_binding_band.begin_indices"),
      bandCount: moc3SectionI32(doc, "keyform_binding_band.counts"),
      keysBegin: moc3SectionI32(doc, "keyform_binding.keys_begin_indices"),
      keysCount: moc3SectionI32(doc, "keyform_binding.keys_counts"),
      keys: moc3SectionF32(doc, "keys.values"),
      paramBindingBegin: moc3SectionI32(
        doc,
        "parameter.keyform_binding_begin_indices"
      ),
      paramBindingCount: moc3SectionI32(
        doc,
        "parameter.keyform_binding_counts"
      ),
      paramCount: doc.counts[CountIdx.PARAMETERS] ?? 0
    };
  }

  // ../../live2d-renderer/src/moc/moc3-glue.ts
  function loadMoc3Glues(doc) {
    const glueCount = doc.counts[CountIdx.GLUES] ?? 0;
    if (glueCount <= 0) return [];
    const meshAs = moc3SectionI32(doc, "glue.art_mesh_index_as");
    const meshBs = moc3SectionI32(doc, "glue.art_mesh_index_bs");
    const infoBegins = moc3SectionI32(doc, "glue.info_begin_indices");
    const infoCounts = moc3SectionI32(doc, "glue.info_counts");
    const bands = moc3SectionI32(doc, "glue.keyform_binding_band_indices");
    const kfBegins = moc3SectionI32(doc, "glue.keyform_begin_indices");
    const kfCounts = moc3SectionI32(doc, "glue.keyform_counts");
    const weights = moc3SectionF32(doc, "glue_info.weights");
    const posIdx = moc3SectionI16(doc, "glue_info.position_indices");
    const out = [];
    for (let g = 0; g < glueCount; g++) {
      const begin = infoBegins[g] ?? 0;
      const count = infoCounts[g] ?? 0;
      const pairs = [];
      for (let i = 0; i + 1 < count; i += 2) {
        pairs.push({
          indexA: posIdx[begin + i] ?? 0,
          indexB: posIdx[begin + i + 1] ?? 0,
          weightA: weights[begin + i] ?? 0.5,
          weightB: weights[begin + i + 1] ?? 0.5
        });
      }
      out.push({
        meshA: meshAs[g] ?? -1,
        meshB: meshBs[g] ?? -1,
        pairs,
        band: bands[g] ?? -1,
        keyformBegin: kfBegins[g] ?? 0,
        keyformCount: kfCounts[g] ?? 0
      });
    }
    return out;
  }
  function applyMoc3Glues(positionsByMesh, glues, keyTables, getParamByIndex, intensities) {
    for (const glue of glues) {
      const posA = positionsByMesh.get(glue.meshA);
      const posB = positionsByMesh.get(glue.meshB);
      if (!posA || !posB) continue;
      const blend = resolveMoc3KeyformBlend(
        keyTables,
        glue.band,
        getParamByIndex
      );
      const intensity = blendKeyformScalar(
        intensities,
        glue.keyformBegin,
        glue.keyformCount,
        blend,
        1
      );
      if (intensity <= 0) continue;
      for (const p of glue.pairs) {
        const oa = p.indexA * 2;
        const ob = p.indexB * 2;
        if (oa + 1 >= posA.length || ob + 1 >= posB.length) continue;
        const ax = posA[oa];
        const ay = posA[oa + 1];
        const bx = posB[ob];
        const by = posB[ob + 1];
        const tx = p.weightA * ax + p.weightB * bx;
        const ty = p.weightA * ay + p.weightB * by;
        posA[oa] = ax + (tx - ax) * intensity;
        posA[oa + 1] = ay + (ty - ay) * intensity;
        posB[ob] = bx + (tx - bx) * intensity;
        posB[ob + 1] = by + (ty - by) * intensity;
      }
    }
  }

  // ../../live2d-renderer/src/moc/moc3-to-program.ts
  function normalizePositions2(positions, canvasWidth, canvasHeight, pixelsPerUnit) {
    const ppu = pixelsPerUnit > 0 ? pixelsPerUnit : 1;
    const hw = canvasWidth > 0 ? canvasWidth / ppu * 0.5 : 0.5;
    const hh = canvasHeight > 0 ? canvasHeight / ppu * 0.5 : 0.5;
    const out = new Float32Array(positions.length);
    for (let i = 0; i + 1 < positions.length; i += 2) {
      out[i] = positions[i] / hw;
      out[i + 1] = -positions[i + 1] / hh;
    }
    return out;
  }
  function moc3DocumentToProgram(doc, options = {}) {
    const meshCount = doc.counts[CountIdx.ART_MESHES] ?? 0;
    const paramCount = doc.counts[CountIdx.PARAMETERS] ?? 0;
    const paramIds = moc3SectionStrings(doc, "parameter.ids");
    const maxValues = moc3SectionF32(doc, "parameter.max_values");
    const minValues = moc3SectionF32(doc, "parameter.min_values");
    const defaultValues = moc3SectionF32(doc, "parameter.default_values");
    const parameters = [];
    for (let i = 0; i < paramCount; i++) {
      parameters.push({
        id: paramIds[i] || `param_${i}`,
        min: minValues[i] ?? 0,
        max: maxValues[i] ?? 0,
        defaultValue: defaultValues[i] ?? 0
      });
    }
    const getParamByIndex = options.getParamByIndex ?? ((index) => defaultValues[index] ?? 0);
    const keyTables = loadMoc3KeyTables(doc);
    const deformers = bakeMoc3Deformers(doc, keyTables, getParamByIndex);
    const glues = loadMoc3Glues(doc);
    const glueIntensities = moc3SectionF32(doc, "glue_keyform.intensities");
    const visibles = moc3SectionI32(doc, "art_mesh.visibles");
    const enables = moc3SectionI32(doc, "art_mesh.enables");
    const textureIndices = moc3SectionI32(doc, "art_mesh.texture_indices");
    const drawableFlags = moc3SectionI32(doc, "art_mesh.drawable_flags");
    const vertexCounts = moc3SectionI32(doc, "art_mesh.vertex_counts");
    const uvBegins = moc3SectionI32(doc, "art_mesh.uv_begin_indices");
    const indexBegins = moc3SectionI32(
      doc,
      "art_mesh.position_index_begin_indices"
    );
    const indexCounts = moc3SectionI32(doc, "art_mesh.position_index_counts");
    const keyformBegins = moc3SectionI32(doc, "art_mesh.keyform_begin_indices");
    const keyformCounts = moc3SectionI32(doc, "art_mesh.keyform_counts");
    const bandIndices = moc3SectionI32(
      doc,
      "art_mesh.keyform_binding_band_indices"
    );
    const parentDeformers = moc3SectionI32(
      doc,
      "art_mesh.parent_deformer_indices"
    );
    const maskBegins = moc3SectionI32(doc, "art_mesh.mask_begin_indices");
    const maskCounts = moc3SectionI32(doc, "art_mesh.mask_counts");
    const maskArtMeshes = moc3SectionI32(doc, "drawable_mask.art_mesh_indices");
    const keyformOpacities = moc3SectionF32(doc, "art_mesh_keyform.opacities");
    const keyformDrawOrders = moc3SectionF32(
      doc,
      "art_mesh_keyform.draw_orders"
    );
    const keyformPosBegins = moc3SectionI32(
      doc,
      "art_mesh_keyform.keyform_position_begin_indices"
    );
    const keyformPositions = moc3SectionF32(doc, "keyform_position.xys");
    const uvsAll = moc3SectionF32(doc, "uv.xys");
    const indicesAll = moc3SectionI16(doc, "position_index.indices");
    const cw = doc.canvas.canvasWidth;
    const ch = doc.canvas.canvasHeight;
    const ppu = doc.canvas.pixelsPerUnit;
    const worldByMesh = /* @__PURE__ */ new Map();
    const meshMeta = /* @__PURE__ */ new Map();
    for (let i = 0; i < meshCount; i++) {
      if ((enables[i] ?? 1) === 0) continue;
      const vertexCount = vertexCounts[i] ?? 0;
      const indexCount = indexCounts[i] ?? 0;
      if (vertexCount <= 0 || indexCount < 3) continue;
      const kfBegin = keyformBegins[i] ?? 0;
      const kfCount = keyformCounts[i] ?? 0;
      if (kfCount <= 0) continue;
      const band = bandIndices[i] ?? -1;
      const blend = resolveMoc3KeyformBlend(keyTables, band, getParamByIndex);
      const local = blendKeyformFloats(
        keyformPositions,
        keyformPosBegins,
        kfBegin,
        kfCount,
        vertexCount * 2,
        blend
      );
      const parentIndex = parentDeformers[i] ?? -1;
      const parent = parentIndex >= 0 ? deformers[parentIndex] ?? null : null;
      const world = parent ? applyParentToPoints(local, parent) : local;
      worldByMesh.set(i, world);
      const uvBegin = uvBegins[i] ?? 0;
      const uvs = new Float32Array(vertexCount * 2);
      for (let v = 0; v < vertexCount * 2; v++) {
        uvs[v] = uvsAll[uvBegin + v] ?? 0;
      }
      const indexBegin = indexBegins[i] ?? 0;
      const indices = new Uint16Array(indexCount);
      for (let t = 0; t < indexCount; t++) {
        indices[t] = indicesAll[indexBegin + t] ?? 0;
      }
      const opacity = blendKeyformScalar(
        keyformOpacities,
        kfBegin,
        kfCount,
        blend,
        1
      );
      const renderOrder = Math.round(
        blendKeyformScalar(keyformDrawOrders, kfBegin, kfCount, blend, i)
      );
      const flags = decodeMoc3DrawableFlags(drawableFlags[i] ?? 0);
      const maskCount = maskCounts[i] ?? 0;
      const maskBegin = maskBegins[i] ?? 0;
      const rawMasks = [];
      for (let m = 0; m < maskCount; m++) {
        const mi = maskArtMeshes[maskBegin + m];
        if (mi !== void 0 && mi >= 0) rawMasks.push(mi);
      }
      meshMeta.set(i, {
        textureIndex: Math.max(0, textureIndices[i] ?? 0),
        uvs,
        indices,
        opacity,
        renderOrder,
        blendMode: flags.blendMode,
        invertedMask: flags.invertedMask,
        rawMaskArtMeshes: rawMasks,
        visible: (visibles[i] ?? 1) !== 0
      });
    }
    applyMoc3Glues(
      worldByMesh,
      glues,
      keyTables,
      getParamByIndex,
      glueIntensities
    );
    const drafts = [];
    for (const [artMeshIndex, world] of worldByMesh) {
      const meta = meshMeta.get(artMeshIndex);
      if (!meta) continue;
      drafts.push({
        artMeshIndex,
        textureIndex: meta.textureIndex,
        positions: normalizePositions2(world, cw, ch, ppu),
        uvs: meta.uvs,
        indices: meta.indices,
        opacity: meta.opacity,
        renderOrder: meta.renderOrder,
        blendMode: meta.blendMode,
        invertedMask: meta.invertedMask,
        rawMaskArtMeshes: meta.rawMaskArtMeshes,
        visible: meta.visible
      });
    }
    drafts.sort((a, b) => a.renderOrder - b.renderOrder);
    const artToProgram = /* @__PURE__ */ new Map();
    for (let i = 0; i < drafts.length; i++) {
      artToProgram.set(drafts[i].artMeshIndex, i);
    }
    const drawables = drafts.map((d, index) => {
      const maskIndices = [];
      for (const art of d.rawMaskArtMeshes) {
        const mapped = artToProgram.get(art);
        if (mapped !== void 0) maskIndices.push(mapped);
      }
      return {
        index,
        textureIndex: d.textureIndex,
        positions: d.positions,
        uvs: d.uvs,
        indices: d.indices,
        opacity: d.opacity,
        renderOrder: d.renderOrder,
        blendMode: d.blendMode,
        invertedMask: d.invertedMask,
        maskIndices,
        visible: d.visible,
        deformParamIndex: -1,
        deformDeltas: null
      };
    });
    return {
      format: "moc3",
      codec: "moc3",
      parameters,
      drawables
    };
  }

  // ../../live2d-renderer/src/moc/moc2.ts
  function toDrawableMesh(d) {
    return {
      index: d.index,
      textureIndex: d.textureIndex,
      vertexPositions: d.positions,
      uvs: d.uvs,
      indices: d.indices,
      opacity: d.opacity,
      blendMode: d.blendMode,
      invertedMask: d.invertedMask,
      renderOrder: d.renderOrder,
      dynamicFlag: true,
      maskIndices: [...d.maskIndices],
      visible: d.visible
    };
  }
  function paramFingerprint(values) {
    let s = "";
    for (let i = 0; i < values.length; i++) {
      s += `${values[i]?.toFixed(5)},`;
    }
    return s;
  }
  var stateByModel = /* @__PURE__ */ new WeakMap();
  function bakePose(state) {
    const values = Float32Array.from(state.instance.parameterValues);
    const timeSeconds = state.instance.timeSeconds;
    const fp = paramFingerprint(values);
    if (fp === state.bakedFingerprint && state.lastFrame) {
      return;
    }
    const program = moc2ModelToProgram(state.moc, {
      getParam: moc2ParamGetterFromValues(
        state.moc.paramDefSet.params,
        values
      )
    });
    const next = createModelInstance(program);
    next.parameterValues.set(values);
    next.timeSeconds = timeSeconds;
    state.instance = next;
    state.bakedFingerprint = fp;
    state.lastFrame = evaluateFrame(next);
  }
  var Moc2Backend = class {
    format = "moc2";
    canHandle(json) {
      return detectModelSettingsFormat(json) === "moc2";
    }
    async createModel(settings, options) {
      let bytes = options?.mocBytes;
      if (!bytes) {
        if (!options?.resolver) {
          throw new Error(
            "@doki-land/live2d-renderer: Moc2Backend.createModel requires resolver or mocBytes"
          );
        }
        bytes = await options.resolver.fetchBytes(settings.moc);
      }
      const moc = new Moc2Parser(bytes).parseModel();
      const program = moc2ModelToProgram(moc);
      const instance = createModelInstance(program);
      const model = {
        id: settings.name ?? settings.url,
        settings,
        format: "moc2"
      };
      stateByModel.set(model, {
        moc,
        instance,
        lastFrame: null,
        bakedFingerprint: paramFingerprint(instance.parameterValues)
      });
      return model;
    }
    updateModel(model, deltaTimeSeconds) {
      const state = stateByModel.get(model);
      if (!state) return;
      state.instance.timeSeconds += deltaTimeSeconds;
      bakePose(state);
      if (state.lastFrame) {
        state.lastFrame = {
          ...state.lastFrame,
          timeSeconds: state.instance.timeSeconds
        };
      }
    }
    getDrawables(model) {
      const state = stateByModel.get(model);
      if (!state) return [];
      bakePose(state);
      const frame = state.lastFrame ?? evaluateFrame(state.instance);
      state.lastFrame = frame;
      return frame.drawables.map(toDrawableMesh);
    }
    captureFrame(model) {
      const state = stateByModel.get(model);
      if (!state) return null;
      bakePose(state);
      const frame = state.lastFrame ?? evaluateFrame(state.instance);
      state.lastFrame = frame;
      return frame;
    }
    setParameter(model, id, value) {
      const state = stateByModel.get(model);
      if (!state) return;
      setParameterValue(state.instance, id, value);
      state.lastFrame = null;
      state.bakedFingerprint = "";
    }
    listParameters(model) {
      const state = stateByModel.get(model);
      if (!state) return [];
      return state.instance.program.parameters.map((p, i) => ({
        id: p.id,
        min: p.min,
        max: p.max,
        defaultValue: p.defaultValue,
        value: state.instance.parameterValues[i] ?? p.defaultValue
      }));
    }
    hitTest(_model, _x, _y) {
      return null;
    }
    destroyModel(model) {
      stateByModel.delete(model);
    }
  };
  function createMoc2Backend() {
    return new Moc2Backend();
  }

  // ../../live2d-renderer/src/moc/moc3-parts.ts
  function readMoc3PartTables(doc) {
    const ids = doc.sections.get("part.ids");
    const parents = doc.sections.get("part.parent_part_indices");
    const meshParents = doc.sections.get("art_mesh.parent_part_indices");
    if (!Array.isArray(ids) || !(parents instanceof Int32Array)) return null;
    return {
      ids,
      parentPartIndices: parents,
      artMeshParentPartIndices: meshParents instanceof Int32Array ? meshParents : new Int32Array(0)
    };
  }
  function cascadedPartOpacity(tables, artMeshIndex, overrides) {
    const root = tables.artMeshParentPartIndices[artMeshIndex] ?? -1;
    let partIndex = root;
    let opacity = 1;
    let guard = 0;
    while (partIndex >= 0 && guard < 64) {
      const id = tables.ids[partIndex];
      if (id !== void 0) {
        const o = overrides.get(id);
        if (o !== void 0) opacity *= o;
      }
      partIndex = tables.parentPartIndices[partIndex] ?? -1;
      guard += 1;
    }
    return opacity;
  }

  // ../../live2d-renderer/src/moc/moc3.ts
  function toDrawableMesh2(d) {
    return {
      index: d.index,
      textureIndex: d.textureIndex,
      vertexPositions: d.positions,
      uvs: d.uvs,
      indices: d.indices,
      opacity: d.opacity,
      blendMode: d.blendMode,
      invertedMask: d.invertedMask,
      renderOrder: d.renderOrder,
      dynamicFlag: true,
      maskIndices: [...d.maskIndices],
      visible: d.visible
    };
  }
  function paramFingerprint2(values) {
    let s = "";
    for (let i = 0; i < values.length; i++) {
      s += `${values[i]?.toFixed(5)},`;
    }
    return s;
  }
  var stateByModel2 = /* @__PURE__ */ new WeakMap();
  function bakePose2(state) {
    if (!state.doc) {
      state.lastFrame = evaluateFrame(state.instance);
      return;
    }
    const values = Float32Array.from(state.instance.parameterValues);
    const timeSeconds = state.instance.timeSeconds;
    const fp = paramFingerprint2(values);
    if (fp === state.bakedFingerprint && state.lastFrame) return;
    const program = moc3DocumentToProgram(state.doc, {
      getParamByIndex: (i) => values[i] ?? 0
    });
    const next = createModelInstance(program);
    next.parameterValues.set(values);
    next.timeSeconds = timeSeconds;
    state.instance = next;
    state.bakedFingerprint = fp;
    state.lastFrame = evaluateFrame(next);
  }
  var Moc3Backend = class {
    format = "moc3";
    canHandle(json) {
      return detectModelSettingsFormat(json) === "moc3";
    }
    async createModel(settings, options) {
      let bytes = options?.mocBytes;
      if (!bytes) {
        if (!options?.resolver) {
          throw new Error(
            "@doki-land/live2d-renderer: Moc3Backend.createModel requires resolver or mocBytes"
          );
        }
        bytes = await options.resolver.fetchBytes(settings.moc);
      }
      const isCpu = settings.moc.toLowerCase().endsWith(".program.json") || isCpuProgramBytes(bytes);
      let doc = null;
      let program;
      if (isCpu) {
        program = parseCpuProgram(bytes);
      } else {
        doc = parseMoc3Document(bytes);
        program = moc3DocumentToProgram(doc);
      }
      const instance = createModelInstance(program);
      const model = {
        id: settings.name ?? settings.url,
        settings,
        format: "moc3"
      };
      stateByModel2.set(model, {
        doc,
        instance,
        lastFrame: null,
        bakedFingerprint: paramFingerprint2(instance.parameterValues),
        partOpacity: /* @__PURE__ */ new Map()
      });
      return model;
    }
    updateModel(model, deltaTimeSeconds) {
      const state = stateByModel2.get(model);
      if (!state) return;
      state.instance.timeSeconds += deltaTimeSeconds;
      bakePose2(state);
      if (state.lastFrame) {
        state.lastFrame = {
          ...state.lastFrame,
          timeSeconds: state.instance.timeSeconds
        };
      }
    }
    getDrawables(model) {
      const state = stateByModel2.get(model);
      if (!state) return [];
      bakePose2(state);
      const frame = state.lastFrame ?? evaluateFrame(state.instance);
      state.lastFrame = frame;
      const tables = state.doc ? readMoc3PartTables(state.doc) : null;
      return frame.drawables.map((d) => {
        const mesh = toDrawableMesh2(d);
        if (!tables || state.partOpacity.size === 0) return mesh;
        const mul = cascadedPartOpacity(
          tables,
          d.index,
          state.partOpacity
        );
        return { ...mesh, opacity: mesh.opacity * mul };
      });
    }
    captureFrame(model) {
      const state = stateByModel2.get(model);
      if (!state) return null;
      bakePose2(state);
      const frame = state.lastFrame ?? evaluateFrame(state.instance);
      state.lastFrame = frame;
      const tables = state.doc ? readMoc3PartTables(state.doc) : null;
      if (!tables || state.partOpacity.size === 0) return frame;
      return {
        ...frame,
        drawables: frame.drawables.map((d) => ({
          ...d,
          opacity: d.opacity * cascadedPartOpacity(tables, d.index, state.partOpacity)
        }))
      };
    }
    setParameter(model, id, value) {
      const state = stateByModel2.get(model);
      if (!state) return;
      setParameterValue(state.instance, id, value);
      state.lastFrame = null;
      state.bakedFingerprint = "";
    }
    setPartOpacity(model, id, value) {
      const state = stateByModel2.get(model);
      if (!state) return;
      const v = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
      state.partOpacity.set(id, v);
    }
    listParameters(model) {
      const state = stateByModel2.get(model);
      if (!state) return [];
      return state.instance.program.parameters.map((p, i) => ({
        id: p.id,
        min: p.min,
        max: p.max,
        defaultValue: p.defaultValue,
        value: state.instance.parameterValues[i] ?? p.defaultValue
      }));
    }
    hitTest(_model, _x, _y) {
      return null;
    }
    destroyModel(model) {
      stateByModel2.delete(model);
    }
  };
  function createMoc3Backend() {
    return new Moc3Backend();
  }

  // ../../live2d-renderer/src/model-runtime.ts
  function selectModelBackend(backends, json) {
    const hit = backends.find((b) => b.canHandle(json));
    if (!hit) {
      throw new Error(
        "@doki-land/live2d-renderer: no ModelBackend can handle this model JSON"
      );
    }
    return hit;
  }

  // ../../live2d/src/load-textures.ts
  function guessMime(path) {
    const lower = path.toLowerCase();
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
    if (lower.endsWith(".webp")) return "image/webp";
    if (lower.endsWith(".gif")) return "image/gif";
    return "image/png";
  }
  async function bytesToImageBitmap(bytes, path) {
    if (typeof createImageBitmap !== "function") {
      throw new Error(
        "@doki-land/live2d: createImageBitmap is not available in this environment"
      );
    }
    const blob = new Blob([new Uint8Array(bytes)], {
      type: guessMime(path)
    });
    return createImageBitmap(blob);
  }
  async function loadTextureData(resolver, paths, options = {}) {
    const out = [];
    const total = paths.length;
    for (let i = 0; i < paths.length; i++) {
      const key = paths[i];
      options.onProgress?.({
        index: i,
        total,
        key,
        bytesLoaded: 0,
        bytesTotal: null
      });
      const bytes = await resolver.fetchBytes(key);
      options.onProgress?.({
        index: i,
        total,
        key,
        bytesLoaded: bytes.byteLength,
        bytesTotal: bytes.byteLength
      });
      const image = await bytesToImageBitmap(bytes, key);
      out.push({
        index: i,
        image,
        width: image.width,
        height: image.height
      });
    }
    return out;
  }
  function releaseTextureData(textures) {
    for (const t of textures) {
      const img = t.image;
      if (typeof ImageBitmap !== "undefined" && img instanceof ImageBitmap) {
        img.close();
      }
    }
  }

  // ../../live2d/src/motion/types.ts
  var MotionPriority = {
    none: 0,
    idle: 1,
    normal: 2,
    force: 3
  };

  // ../../live2d/src/motion/parse-motion3.ts
  var SEGMENT_KIND = {
    0: "linear",
    1: "bezier",
    2: "stepped",
    3: "inverseStepped"
  };
  function parseMotion3(json) {
    if (!json || typeof json !== "object") {
      throw new Error("@doki-land/live2d: motion3.json root must be an object");
    }
    const root = json;
    const version = Number(root.Version ?? 3);
    const meta = root.Meta;
    if (!meta || typeof meta !== "object") {
      throw new Error("@doki-land/live2d: motion3.json missing Meta");
    }
    const m = meta;
    const duration = num(m.Duration, "Meta.Duration");
    const fps = num(m.Fps, "Meta.Fps");
    const loop = m.Loop === true;
    const areBeziersRestricted = m.AreBeziersRestricted !== false;
    const fadeInTime = optionalNum(m.FadeInTime) ?? 0;
    const fadeOutTime = optionalNum(m.FadeOutTime) ?? 0;
    const curvesRaw = root.Curves;
    if (!Array.isArray(curvesRaw)) {
      throw new Error("@doki-land/live2d: motion3.json missing Curves");
    }
    const curves = curvesRaw.map((c, i) => parseCurve(c, i));
    const userData = [];
    if (Array.isArray(root.UserData)) {
      for (const item of root.UserData) {
        if (!item || typeof item !== "object") continue;
        const u = item;
        if (typeof u.Time === "number" && typeof u.Value === "string") {
          userData.push({ time: u.Time, value: u.Value });
        }
      }
      userData.sort((a, b) => a.time - b.time);
    }
    return {
      version,
      duration,
      fps,
      loop,
      areBeziersRestricted,
      fadeInTime,
      fadeOutTime,
      curves,
      userData
    };
  }
  function parseCurve(raw, index) {
    if (!raw || typeof raw !== "object") {
      throw new Error(`@doki-land/live2d: Curves[${index}] invalid`);
    }
    const c = raw;
    const target = c.Target;
    const id = c.Id;
    if (typeof target !== "string" || typeof id !== "string") {
      throw new Error(`@doki-land/live2d: Curves[${index}] needs Target/Id`);
    }
    if (target !== "Parameter" && target !== "PartOpacity" && target !== "Model") {
      throw new Error(
        `@doki-land/live2d: Curves[${index}] unknown Target ${target}`
      );
    }
    const segmentsFlat = c.Segments;
    if (!Array.isArray(segmentsFlat) || segmentsFlat.length < 2) {
      throw new Error(`@doki-land/live2d: Curves[${index}] empty Segments`);
    }
    const numbers = segmentsFlat.map((n, j) => {
      if (typeof n !== "number" || !Number.isFinite(n)) {
        throw new Error(
          `@doki-land/live2d: Curves[${index}].Segments[${j}] not a number`
        );
      }
      return n;
    });
    return {
      target,
      id,
      fadeInTime: optionalNum(c.FadeInTime),
      fadeOutTime: optionalNum(c.FadeOutTime),
      segments: parseSegments(numbers, index)
    };
  }
  function parseSegments(flat, curveIndex) {
    let i = 0;
    const p0 = { time: flat[i++], value: flat[i++] };
    const out = [];
    let prev = p0;
    while (i < flat.length) {
      const kindId = flat[i++];
      const kind = SEGMENT_KIND[kindId];
      if (!kind) {
        throw new Error(
          `@doki-land/live2d: Curves[${curveIndex}] unknown segment ${kindId}`
        );
      }
      if (kind === "bezier") {
        if (i + 5 >= flat.length) {
          throw new Error(
            `@doki-land/live2d: Curves[${curveIndex}] truncated bezier`
          );
        }
        const p1 = { time: flat[i++], value: flat[i++] };
        const p2 = { time: flat[i++], value: flat[i++] };
        const p3 = { time: flat[i++], value: flat[i++] };
        out.push({ kind, p0: prev, p1, p2, p3 });
        prev = p3;
      } else {
        if (i + 1 >= flat.length) {
          throw new Error(
            `@doki-land/live2d: Curves[${curveIndex}] truncated ${kind}`
          );
        }
        const p3 = { time: flat[i++], value: flat[i++] };
        out.push({ kind, p0: prev, p3 });
        prev = p3;
      }
    }
    return out;
  }
  function num(v, label) {
    if (typeof v !== "number" || !Number.isFinite(v)) {
      throw new Error(`@doki-land/live2d: motion3 ${label} must be a number`);
    }
    return v;
  }
  function optionalNum(v) {
    return typeof v === "number" && Number.isFinite(v) ? v : void 0;
  }

  // ../../live2d/src/motion/evaluate-curve.ts
  function evaluateMotion3(clip, timeSeconds) {
    const t = clamp(timeSeconds, 0, clip.duration);
    const out = [];
    for (const curve of clip.curves) {
      out.push({
        target: curve.target,
        id: curve.id,
        value: evaluateCurve(curve, t, clip.areBeziersRestricted)
      });
    }
    return out;
  }
  function evaluateCurve(curve, timeSeconds, areBeziersRestricted) {
    const segs = curve.segments;
    if (segs.length === 0) return 0;
    if (timeSeconds <= segs[0].p0.time) return segs[0].p0.value;
    const last = segs[segs.length - 1];
    if (timeSeconds >= last.p3.time) return last.p3.value;
    for (let i = 0; i < segs.length; i += 1) {
      const seg = segs[i];
      const isLast = i === segs.length - 1;
      if (timeSeconds < seg.p3.time || isLast && timeSeconds <= seg.p3.time) {
        return evaluateSegment(seg, timeSeconds, areBeziersRestricted);
      }
    }
    return last.p3.value;
  }
  function evaluateSegment(seg, time, areBeziersRestricted) {
    const { p0, p3 } = seg;
    switch (seg.kind) {
      case "linear": {
        const span = p3.time - p0.time;
        if (span <= 0) return p3.value;
        const u = (time - p0.time) / span;
        return p0.value + (p3.value - p0.value) * u;
      }
      case "stepped":
        return p0.value;
      case "inverseStepped":
        return p3.value;
      case "bezier": {
        const p1 = seg.p1;
        const p2 = seg.p2;
        if (areBeziersRestricted) {
          const span = p3.time - p0.time;
          if (span <= 0) return p3.value;
          const u2 = (time - p0.time) / span;
          return cubic(p0.value, p1.value, p2.value, p3.value, u2);
        }
        const u = solveBezierTime(p0.time, p1.time, p2.time, p3.time, time);
        return cubic(p0.value, p1.value, p2.value, p3.value, u);
      }
      default:
        return p3.value;
    }
  }
  function cubic(a, b, c, d, t) {
    const u = 1 - t;
    return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
  }
  function solveBezierTime(t0, t1, t2, t3, target) {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 20; i += 1) {
      const mid = (lo + hi) * 0.5;
      const x = cubic(t0, t1, t2, t3, mid);
      if (x < target) lo = mid;
      else hi = mid;
    }
    return (lo + hi) * 0.5;
  }
  function clamp(n, min, max) {
    if (n < min) return min;
    if (n > max) return max;
    return n;
  }

  // ../../live2d/src/motion/motion-player.ts
  var MotionPlayer = class {
    #slots = /* @__PURE__ */ new Map();
    #queues = /* @__PURE__ */ new Map();
    #handlers;
    constructor(handlers = {}) {
      this.#handlers = handlers;
    }
    get isPlaying() {
      return this.#slots.size > 0;
    }
    listPlaying() {
      return [...this.#slots.values()].map((a) => ({
        slot: a.slot,
        group: a.group,
        index: a.index,
        time: a.time,
        priority: a.priority
      }));
    }
    /** @deprecated Prefer {@link listPlaying}; returns highest-priority slot. */
    get current() {
      const list = [...this.listPlaying()];
      if (!list.length) return null;
      list.sort((a, b) => b.priority - a.priority);
      const top = list[0];
      return {
        group: top.group,
        index: top.index,
        time: top.time,
        priority: top.priority
      };
    }
    /**
     * Start a clip on a slot. Returns false if rejected by priority
     * (and not queued).
     */
    start(group, index, clip, options = {}) {
      const priority = options.priority ?? MotionPriority.normal;
      const slot = options.slot ?? `priority:${priority}`;
      const existing = this.#slots.get(slot);
      if (existing && priority < existing.priority) {
        if (options.queue) {
          this.#enqueue(slot, { group, index, clip, options });
          return true;
        }
        return false;
      }
      if (existing && options.queue && !existing.fadingOut) {
        this.#enqueue(slot, { group, index, clip, options });
        return true;
      }
      if (existing) {
        if (existing.fadeOutTime > 0 && !existing.fadingOut) {
          existing.fadingOut = true;
          existing.fadeOutElapsed = 0;
          this.#enqueueFront(slot, { group, index, clip, options });
          return true;
        }
        this.#finish(existing, false);
      }
      this.#slots.set(slot, this.#createActive(slot, group, index, clip, options));
      return true;
    }
    /** Fade out (default) or hard-stop; `slot` omits → all slots. */
    stop(fade = true, slot) {
      if (slot !== void 0) {
        const a = this.#slots.get(slot);
        if (!a) return;
        this.#stopOne(a, fade);
        return;
      }
      for (const a of [...this.#slots.values()]) {
        this.#stopOne(a, fade);
      }
    }
    clear() {
      this.#slots.clear();
      this.#queues.clear();
    }
    /**
     * Advance all slots and return blended samples (weight baked in; apply as absolute).
     */
    update(deltaTimeSeconds) {
      const dt = Math.max(0, deltaTimeSeconds);
      const layerSamples = [];
      for (const a of [...this.#slots.values()]) {
        const samples = this.#tick(a, dt);
        if (samples) {
          layerSamples.push({ priority: a.priority, samples });
        }
      }
      layerSamples.sort((a, b) => a.priority - b.priority);
      return blendMotionLayers(layerSamples);
    }
    #tick(a, dt) {
      if (!a.started) {
        a.started = true;
        this.#handlers.onStart?.({
          group: a.group,
          index: a.index,
          slot: a.slot
        });
      }
      a.time += dt;
      if (a.fadingOut) {
        a.fadeOutElapsed += dt;
        if (a.fadeOutElapsed >= a.fadeOutTime) {
          this.#finish(a, true);
          return null;
        }
      } else if (!a.loop && a.time >= a.clip.duration) {
        if (a.fadeOutTime > 0) {
          a.fadingOut = true;
          a.fadeOutElapsed = 0;
        } else {
          const samples = this.#sample(a, a.clip.duration, 1);
          this.#finish(a, true);
          return samples;
        }
      }
      let playTime = a.time;
      if (a.loop && a.clip.duration > 0) {
        playTime = a.time % a.clip.duration;
      } else {
        playTime = Math.min(playTime, a.clip.duration);
      }
      this.#emitEvents(a, playTime);
      return this.#sample(a, playTime, this.#fadeWeight(a));
    }
    #createActive(slot, group, index, clip, options) {
      const fadeIn = options.fadeInTime ?? (clip.fadeInTime > 0 ? clip.fadeInTime : 0);
      const fadeOut = options.fadeOutTime ?? (clip.fadeOutTime > 0 ? clip.fadeOutTime : 0);
      return {
        slot,
        group,
        index,
        clip,
        priority: options.priority ?? MotionPriority.normal,
        loop: options.loop ?? clip.loop,
        fadeInTime: Math.max(0, fadeIn),
        fadeOutTime: Math.max(0, fadeOut),
        time: 0,
        fadingOut: false,
        fadeOutElapsed: 0,
        lastEventIndex: -1,
        started: false
      };
    }
    #enqueue(slot, item) {
      const q = this.#queues.get(slot) ?? [];
      q.push(item);
      this.#queues.set(slot, q);
    }
    #enqueueFront(slot, item) {
      const q = this.#queues.get(slot) ?? [];
      q.unshift(item);
      this.#queues.set(slot, q);
    }
    #stopOne(a, fade) {
      if (!fade || a.fadeOutTime <= 0) {
        this.#finish(a, true);
        return;
      }
      a.fadingOut = true;
      a.fadeOutElapsed = 0;
    }
    #finish(a, promoteQueue) {
      if (this.#slots.get(a.slot) !== a) return;
      this.#slots.delete(a.slot);
      this.#handlers.onFinish?.({
        group: a.group,
        index: a.index,
        slot: a.slot
      });
      if (!promoteQueue) return;
      const q = this.#queues.get(a.slot);
      const next = q?.shift();
      if (next) {
        this.#slots.set(
          a.slot,
          this.#createActive(
            a.slot,
            next.group,
            next.index,
            next.clip,
            next.options
          )
        );
      }
    }
    #sample(a, playTime, weight) {
      const values = evaluateMotion3(a.clip, playTime);
      return values.map((v) => ({
        target: v.target,
        id: v.id,
        value: v.value,
        weight
      }));
    }
    #fadeWeight(a) {
      let w = 1;
      if (a.fadeInTime > 0 && a.time < a.fadeInTime) {
        w = sineEase(a.time / a.fadeInTime);
      }
      if (a.fadingOut && a.fadeOutTime > 0) {
        const u = 1 - a.fadeOutElapsed / a.fadeOutTime;
        w *= sineEase(Math.max(0, u));
      }
      return w;
    }
    #emitEvents(a, playTime) {
      const events = a.clip.userData;
      for (let i = a.lastEventIndex + 1; i < events.length; i += 1) {
        const e = events[i];
        if (e.time > playTime) break;
        a.lastEventIndex = i;
        this.#handlers.onEvent?.({
          group: a.group,
          index: a.index,
          slot: a.slot,
          time: e.time,
          value: e.value
        });
      }
      if (a.loop && a.clip.duration > 0) {
        const prevMod = (a.time - 1e-6) % a.clip.duration + (a.time - 1e-6 < 0 ? a.clip.duration : 0);
        if (playTime < prevMod - 1e-4) {
          a.lastEventIndex = -1;
        }
      }
    }
  };
  function blendMotionLayers(layers) {
    const map = /* @__PURE__ */ new Map();
    for (const layer of layers) {
      for (const s of layer.samples) {
        const key = `${s.target}\0${s.id}`;
        const w = Math.min(1, Math.max(0, s.weight));
        const prev = map.get(key);
        if (!prev) {
          map.set(key, {
            target: s.target,
            id: s.id,
            value: s.value,
            weight: w
          });
        } else {
          prev.value = prev.value + (s.value - prev.value) * w;
          prev.weight = Math.min(1, prev.weight + w * (1 - prev.weight));
        }
      }
    }
    return [...map.values()];
  }
  function sineEase(t) {
    const x = Math.min(1, Math.max(0, t));
    return 0.5 - 0.5 * Math.cos(x * Math.PI);
  }

  // ../../live2d/src/create-live2d.ts
  function lerp2(a, b, t) {
    return a + (b - a) * Math.min(1, Math.max(0, t));
  }
  function nowMs() {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
  }
  function createLive2D(options = {}) {
    const backends = options.backends ?? [
      createMoc2Backend(),
      createMoc3Backend()
    ];
    const renderer = options.renderer ?? createRenderer({ prefer: options.prefer });
    const events = new EventEmitter();
    let canvas = null;
    let model = null;
    let activeBackend = null;
    let drawPass = null;
    let loadedTextures = [];
    let initPromise = null;
    let phase = "idle";
    let lastError = null;
    let generation = 0;
    let loadGeneration = 0;
    let fpsSmooth = 0;
    let activeResolver = null;
    const motionCache = /* @__PURE__ */ new Map();
    const motionPlayer = new MotionPlayer({
      onStart: ({ group, index, slot }) => events.emit("motion:start", { group, index, slot }),
      onFinish: ({ group, index, slot }) => events.emit("motion:finish", { group, index, slot })
    });
    const applyMotionSamples = (samples) => {
      if (!model || !activeBackend) return;
      for (const s of samples) {
        if (s.weight <= 0) continue;
        if (s.target === "PartOpacity") {
          if (!activeBackend.setPartOpacity) continue;
          if (s.weight >= 1) {
            activeBackend.setPartOpacity(model, s.id, s.value);
          } else {
            const cur2 = 1;
            activeBackend.setPartOpacity(
              model,
              s.id,
              cur2 + (s.value - cur2) * s.weight
            );
          }
          continue;
        }
        if (s.target !== "Parameter" || !activeBackend.setParameter)
          continue;
        if (s.weight >= 1) {
          activeBackend.setParameter(model, s.id, s.value);
          continue;
        }
        const cur = activeBackend.listParameters?.(model).find((p) => p.id === s.id)?.value ?? s.value;
        activeBackend.setParameter(
          model,
          s.id,
          cur + (s.value - cur) * s.weight
        );
      }
    };
    const clearTextures = () => {
      if (loadedTextures.length > 0) {
        releaseTextureData(loadedTextures);
        loadedTextures = [];
      }
      drawPass?.setTextures([]);
    };
    const setPhase = (next) => {
      phase = next;
      events.emit("phase", { phase, generation });
    };
    const report = (payload) => {
      events.emit("progress", payload);
    };
    const state = () => ({
      phase,
      lastError,
      generation
    });
    const ensureInitialized = async () => {
      if (!canvas) {
        throw new Error(
          "@doki-land/live2d: call mount(canvas) before loadModel"
        );
      }
      if (!initPromise) {
        setPhase("mounting");
        const gen = generation;
        initPromise = renderer.initialize(canvas).then(() => {
          if (gen !== generation) return;
          drawPass = renderer.createModelDrawPass();
          setPhase("ready");
        }).catch((err) => {
          lastError = err;
          setPhase("error");
          events.emit("error", { error: err });
          throw err;
        });
      }
      await initPromise;
    };
    const runtime = {
      events,
      backends,
      renderer,
      get model() {
        return model;
      },
      get state() {
        return state();
      },
      mount(target) {
        generation += 1;
        canvas = target;
        initPromise = null;
        clearTextures();
        drawPass?.destroy();
        drawPass = null;
        setPhase("idle");
        void ensureInitialized();
      },
      async loadModel(source, resolver) {
        const gen = ++loadGeneration;
        setPhase("loading");
        report({
          stage: "mounting",
          progress: 0.01,
          detail: "initialize renderer"
        });
        await ensureInitialized();
        if (gen !== loadGeneration) {
          throw new Error("@doki-land/live2d: load cancelled");
        }
        report({
          stage: "resolve",
          progress: 0.02,
          detail: "resolve source"
        });
        try {
          let json;
          let baseUrl;
          let settingsUrl;
          if (typeof source === "object" && source.kind === "json") {
            json = source.json;
            baseUrl = source.baseUrl;
            settingsUrl = source.baseUrl;
            report({
              stage: "settings",
              progress: 0.2,
              detail: "inline settings"
            });
          } else {
            const raw = typeof source === "string" ? source : source.kind === "npm" ? modelSourceUrl(source) : source.url;
            const cdnBase = typeof source === "object" && source.kind === "npm" ? source.cdnBase : void 0;
            const fetchUrl = resolveModelSourceUrl(raw, {
              npmCdnBase: cdnBase
            });
            report({
              stage: "settings",
              progress: 0.05,
              detail: fetchUrl
            });
            json = await fetchModelJson(fetchUrl, (u) => {
              const ratio = u.bytesTotal && u.bytesTotal > 0 ? u.bytesLoaded / u.bytesTotal : 0;
              report({
                stage: "settings",
                progress: lerp2(0.05, 0.22, ratio),
                detail: fetchUrl,
                bytesLoaded: u.bytesLoaded,
                bytesTotal: u.bytesTotal
              });
            });
            baseUrl = fetchUrl;
            settingsUrl = fetchUrl;
          }
          if (gen !== loadGeneration) {
            throw new Error("@doki-land/live2d: load cancelled");
          }
          const settings = normalizeModelSettings(json, settingsUrl);
          report({
            stage: "moc",
            progress: 0.25,
            detail: settings.moc
          });
          const assetResolver = resolver ?? createUrlAssetResolver(baseUrl, {
            onBytesProgress: (key, u) => {
              const isMoc = key === settings.moc;
              const ratio = u.bytesTotal && u.bytesTotal > 0 ? u.bytesLoaded / u.bytesTotal : 0;
              if (isMoc) {
                report({
                  stage: "moc",
                  progress: lerp2(0.25, 0.8, ratio),
                  detail: key,
                  bytesLoaded: u.bytesLoaded,
                  bytesTotal: u.bytesTotal
                });
              } else {
                report({
                  stage: "textures",
                  progress: lerp2(0.8, 0.9, ratio),
                  detail: key,
                  bytesLoaded: u.bytesLoaded,
                  bytesTotal: u.bytesTotal
                });
              }
            }
          });
          activeResolver = assetResolver;
          motionPlayer.clear();
          motionCache.clear();
          const backend = selectModelBackend(backends, json);
          report({
            stage: "decode",
            progress: 0.85,
            detail: `decode ${settings.format}`
          });
          const next = await backend.createModel(settings, {
            renderer,
            resolver: assetResolver
          });
          if (gen !== loadGeneration) {
            backend.destroyModel(next);
            throw new Error("@doki-land/live2d: load cancelled");
          }
          clearTextures();
          if (settings.textures.length > 0 && drawPass) {
            report({
              stage: "textures",
              progress: 0.88,
              detail: `${settings.textures.length} textures`
            });
            const textures = await loadTextureData(
              assetResolver,
              settings.textures,
              {
                onProgress: (u) => {
                  const ratio = u.total > 0 ? (u.index + 1) / u.total : 1;
                  report({
                    stage: "textures",
                    progress: lerp2(0.88, 0.96, ratio),
                    detail: u.key,
                    bytesLoaded: u.bytesLoaded,
                    bytesTotal: u.bytesTotal
                  });
                }
              }
            );
            if (gen !== loadGeneration) {
              releaseTextureData(textures);
              backend.destroyModel(next);
              throw new Error("@doki-land/live2d: load cancelled");
            }
            loadedTextures = textures;
            drawPass.setTextures(textures);
          }
          if (model && activeBackend) {
            activeBackend.destroyModel(model);
          }
          model = next;
          activeBackend = backend;
          lastError = null;
          setPhase("live");
          report({
            stage: "ready",
            progress: 1,
            detail: model.id
          });
          events.emit("ready", { modelId: model.id });
          return model;
        } catch (err) {
          lastError = err;
          setPhase("error");
          events.emit("error", { error: err });
          throw err;
        }
      },
      captureFrame() {
        if (!model || !activeBackend?.captureFrame) return null;
        return activeBackend.captureFrame(model);
      },
      setParameter(id, value) {
        if (!model || !activeBackend?.setParameter) return;
        activeBackend.setParameter(model, id, value);
      },
      hitTest(x, y) {
        if (!model || !activeBackend) return null;
        const drawables = activeBackend.getDrawables(model);
        for (let n = drawables.length - 1; n >= 0; n -= 1) {
          const d = drawables[n];
          if (!d.visible || d.opacity <= 0) continue;
          const p = d.vertexPositions;
          const idx = d.indices;
          for (let i = 0; i + 2 < idx.length; i += 3) {
            const a = idx[i] * 2, b = idx[i + 1] * 2, c = idx[i + 2] * 2;
            const ax = p[a], ay = p[a + 1];
            const bx = p[b], by = p[b + 1];
            const cx = p[c], cy = p[c + 1];
            const s = (ax - cx) * (y - cy) - (ay - cy) * (x - cx);
            const s1 = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
            const s2 = (cx - bx) * (y - by) - (cy - by) * (x - bx);
            if (s >= 0 && s1 >= 0 && s2 >= 0 || s <= 0 && s1 <= 0 && s2 <= 0) {
              return `drawable:${d.index}`;
            }
          }
        }
        return null;
      },
      listParameters() {
        if (!model || !activeBackend?.listParameters) return [];
        return activeBackend.listParameters(model);
      },
      listMotionGroups() {
        return model?.settings.motionGroups ?? {};
      },
      async playMotion(group, index = 0, options2 = {}) {
        if (!model || !activeResolver) return false;
        const list = model.settings.motionGroups[group];
        const def = list?.[index];
        if (!def) return false;
        let clip = motionCache.get(def.file);
        if (!clip) {
          const json = await activeResolver.fetchJson(def.file);
          clip = parseMotion3(json);
          motionCache.set(def.file, clip);
        }
        const fadeInTime = options2.fadeInTime ?? def.fadeInTime ?? clip.fadeInTime;
        const fadeOutTime = options2.fadeOutTime ?? def.fadeOutTime ?? clip.fadeOutTime;
        return motionPlayer.start(group, index, clip, {
          priority: options2.priority ?? MotionPriority.normal,
          slot: options2.slot,
          queue: options2.queue,
          loop: options2.loop,
          fadeInTime,
          fadeOutTime
        });
      },
      stopMotion(opts) {
        motionPlayer.stop(opts?.fade !== false, opts?.slot);
      },
      listPlayingMotions() {
        return motionPlayer.listPlaying();
      },
      async capturePng(opts = {}) {
        if (!canvas) {
          throw new Error("@doki-land/live2d: mount(canvas) before capturePng");
        }
        if (phase === "live" && model && activeBackend && drawPass) {
          runtime.update(0);
        }
        const mime = opts.mimeType ?? "image/png";
        return await new Promise((resolve, reject) => {
          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else
                reject(
                  new Error(
                    "@doki-land/live2d: canvas.toBlob returned null"
                  )
                );
            },
            mime,
            opts.quality
          );
        });
      },
      update(deltaTimeSeconds) {
        if (!model || !activeBackend || !drawPass) return;
        if (phase !== "live") return;
        const t0 = nowMs();
        applyMotionSamples(motionPlayer.update(deltaTimeSeconds));
        activeBackend.updateModel(model, deltaTimeSeconds);
        const drawables = activeBackend.getDrawables(model);
        const t1 = nowMs();
        renderer.beginFrame();
        drawPass.draw(drawables, new Float32Array(16));
        renderer.endFrame();
        const t2 = nowMs();
        let vertexCount = 0;
        let indexCount = 0;
        for (const d of drawables) {
          vertexCount += d.vertexPositions.length / 2;
          indexCount += d.indices.length;
        }
        const frameMs = t2 - t0;
        const evaluateMs = t1 - t0;
        const drawMs = t2 - t1;
        const fps = deltaTimeSeconds > 0 ? 1 / deltaTimeSeconds : 0;
        fpsSmooth = fpsSmooth <= 0 ? fps : fpsSmooth * 0.85 + fps * 0.15;
        events.emit("profile", {
          fps,
          fpsSmooth,
          frameMs,
          evaluateMs,
          drawMs,
          drawableCount: drawables.length,
          vertexCount,
          indexCount
        });
      },
      destroy() {
        loadGeneration += 1;
        generation += 1;
        motionPlayer.clear();
        motionCache.clear();
        activeResolver = null;
        if (model && activeBackend) {
          activeBackend.destroyModel(model);
        }
        model = null;
        activeBackend = null;
        clearTextures();
        drawPass?.destroy();
        drawPass = null;
        initPromise = null;
        renderer.destroy();
        canvas = null;
        setPhase("destroyed");
        events.clear();
      }
    };
    return runtime;
  }

  // ../../live2d/src/focus.ts
  function focusParameterUpdates(parameters, dragX, dragY) {
    const byId = new Map(parameters.map((p) => [p.id, p]));
    const x = clampUnit(dragX);
    const y = clampUnit(dragY);
    const out = [];
    const set = (id, normalized) => {
      const binding = byId.get(id);
      if (!binding) return;
      out.push({ id, value: valueFromNormalized(binding, normalized) });
    };
    set("PARAM_ANGLE_X", x);
    set("PARAM_ANGLE_Y", y);
    set("PARAM_ANGLE_Z", clampUnit(x * y * -1));
    set("PARAM_BODY_ANGLE_X", x);
    set("PARAM_BODY_ANGLE_Y", y);
    set("PARAM_EYE_BALL_X", x);
    set("PARAM_EYE_BALL_Y", y);
    return out;
  }
  function clampUnit(n) {
    if (n > 1) return 1;
    if (n < -1) return -1;
    return n;
  }
  function valueFromNormalized(binding, normalized) {
    const n = clampUnit(normalized);
    return n >= 0 ? binding.defaultValue + (binding.max - binding.defaultValue) * n : binding.defaultValue + (binding.defaultValue - binding.min) * n;
  }

  // ../../live2d-widget/src/widget.ts
  var Live2DWidget = class {
    #canvas = null;
    #runtime = null;
    #chrome = null;
    #raf = 0;
    #lastTs = 0;
    #autoSway = true;
    #onHit;
    async mount(options) {
      const host = typeof options.target === "string" ? document.querySelector(options.target) : options.target;
      if (!host) {
        throw new Error(
          `@doki-land/live2d-widget: target not found: ${String(options.target)}`
        );
      }
      this.destroy();
      const width = options.width ?? 280;
      const height = options.height ?? 400;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.style.cssText = "display:block;width:100%;height:auto;pointer-events:auto;touch-action:none;background:transparent;cursor:grab;";
      canvas.addEventListener("pointermove", this.#onPointerMove);
      canvas.addEventListener("pointerdown", this.#onPointerDown);
      const prefer = normalizePrefer(options.prefer);
      const runtime = createLive2D({
        backends: options.backends,
        renderer: options.renderer,
        prefer
      });
      runtime.mount(canvas);
      this.#canvas = canvas;
      this.#runtime = runtime;
      this.#autoSway = options.autoSway !== false;
      this.#onHit = options.onHit;
      this.#chrome = mountChrome({
        host,
        canvas,
        chrome: options.chrome ?? false,
        getCanvas: () => this.#canvas
      });
      if (!this.#chrome) {
        host.replaceChildren(canvas);
      }
      if (options.model) {
        await runtime.loadModel(options.model);
      }
      if (options.autoplay !== false) {
        this.#startLoop();
      } else {
        runtime.update(0);
      }
    }
    destroy() {
      this.#stopLoop();
      if (this.#canvas) {
        this.#canvas.removeEventListener(
          "pointermove",
          this.#onPointerMove
        );
        this.#canvas.removeEventListener(
          "pointerdown",
          this.#onPointerDown
        );
      }
      this.#chrome?.destroy();
      this.#chrome = null;
      this.#runtime?.destroy();
      this.#canvas?.remove();
      this.#runtime = null;
      this.#canvas = null;
      this.#onHit = void 0;
    }
    getRuntime() {
      return this.#runtime;
    }
    /** Show a tips bubble when chrome tips are enabled. */
    showMessage(text, timeoutMs, priority) {
      this.#chrome?.tips?.show(text, timeoutMs, priority);
    }
    #parameterFromNormalized(id, normalized) {
      const binding = this.#runtime?.listParameters().find((p) => p.id === id);
      if (!binding) return normalized;
      return normalized >= 0 ? binding.defaultValue + (binding.max - binding.defaultValue) * normalized : binding.defaultValue + (binding.defaultValue - binding.min) * normalized;
    }
    #modelPoint(event) {
      const canvas = this.#canvas;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      return {
        x: (event.clientX - rect.left) / rect.width * 2 - 1,
        y: 1 - (event.clientY - rect.top) / rect.height * 2
      };
    }
    #onPointerMove = (event) => {
      const p = this.#modelPoint(event);
      const runtime = this.#runtime;
      if (!p || !runtime) return;
      this.#autoSwayPausedByPointer = true;
      for (const { id, value } of focusParameterUpdates(
        runtime.listParameters(),
        p.x,
        p.y
      )) {
        runtime.setParameter(id, value);
      }
    };
    #onPointerDown = (event) => {
      const p = this.#modelPoint(event);
      const runtime = this.#runtime;
      if (!p || !runtime) return;
      const area = runtime.hitTest(p.x, p.y);
      if (area) {
        this.#onHit?.({ area, x: p.x, y: p.y });
        this.#chrome?.tips?.show("\u78B0\u5230\u6211\u5566\uFF5E", 2500, 4);
      }
    };
    #autoSwayPausedByPointer = false;
    #startLoop() {
      this.#stopLoop();
      const tick = (ts) => {
        const runtime = this.#runtime;
        if (!runtime) return;
        const dt = this.#lastTs ? (ts - this.#lastTs) / 1e3 : 0;
        this.#lastTs = ts;
        if (this.#autoSway && !this.#autoSwayPausedByPointer) {
          runtime.setParameter(
            "PARAM_ANGLE_X",
            this.#parameterFromNormalized(
              "PARAM_ANGLE_X",
              Math.sin(ts / 1e3) * 0.25
            )
          );
        }
        if (this.#autoSwayPausedByPointer) {
          this.#autoSwayPausedByPointer = false;
        }
        runtime.update(dt);
        this.#raf = requestAnimationFrame(tick);
      };
      this.#raf = requestAnimationFrame(tick);
    }
    #stopLoop() {
      if (this.#raf) cancelAnimationFrame(this.#raf);
      this.#raf = 0;
      this.#lastTs = 0;
    }
  };
  function normalizePrefer(prefer) {
    if (!prefer?.length) return void 0;
    const allowed = /* @__PURE__ */ new Set(["webgpu", "webgl2", "canvas2d"]);
    const out = prefer.filter((k) => allowed.has(k));
    return out.length ? out : void 0;
  }
  async function mountWidget(options) {
    const widget = new Live2DWidget();
    await widget.mount(options);
    return widget;
  }

  // src/browser-entry.ts
  globalThis.DokiLive2D = {
    mountWidget,
    Live2DWidget
  };
  var cfg = globalThis.__DOKI_LIVE2D_HEXO__ ?? {};
  void mountWidget({
    target: cfg.target || "#doki-live2d",
    model: cfg.model || void 0,
    width: cfg.width ?? 280,
    height: cfg.height ?? 400,
    prefer: cfg.prefer,
    autoSway: cfg.autoSway !== false,
    chrome: cfg.chrome === void 0 ? true : cfg.chrome,
    autoplay: true,
    onHit: (payload) => {
      console.debug("[hexo-plugin-live2d] hit", payload.area);
    }
  }).catch((err) => {
    console.error("[hexo-plugin-live2d]", err);
  });
})();
//# sourceMappingURL=doki-live2d-hexo.js.map
