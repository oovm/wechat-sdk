# `@doki-land/live2d-element`

Official `<live-2d>` Custom Element — thin host over `@doki-land/live2d` with Stage-owned RAF.

## Status (Developer Preview)

v0.0.22 thin gate: pure TypeScript `customElements.define('live-2d', …)`. Zero VMZ runtime dependency on this package or on `@doki-land/live2d*`.

HTML Custom Elements require a hyphen; the registered tag is **`live-2d`** (not unhyphenated `live2d`). Design `01` still targets eventual `vmz build --target custom-element` when that CLI target ships.

## Install

```bash
pnpm add @doki-land/live2d-element
```

## Usage

```html
<script type="module">
  import "@doki-land/live2d-element";
</script>
<live-2d
  model="/models/Wanko/Wanko.model3.json"
  renderer="auto"
  width="320"
  height="320"
  autoplay
></live-2d>
<script type="module">
  const el = document.querySelector("live-2d");
  el.addEventListener("live2d-ready", () => console.log("ready"));
  el.addEventListener("live2d-error", (e) => console.error(e.detail));
</script>
```

See `fixtures/index.html` for a native HTML dogfood page.
