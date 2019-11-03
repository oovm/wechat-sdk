# `@doki-land/live2d-element`

Official `<live-2d>` / `<live-2d-widget>` Custom Elements — thin hosts over
`@doki-land/live2d` with Stage-owned RAF.

## Status (Developer Preview)

Pure TypeScript `customElements.define`. Zero VMZ runtime dependency.
Primary TS symbols use the `Live2d*` / `createLive2d*` spelling (see design `00` §4.4).

HTML Custom Elements require a hyphen; tags are **`live-2d`** and **`live-2d-widget`**.

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
  interactive
  tracking="pointer"
></live-2d>
<script type="module">
  const el = document.querySelector("live-2d");
  el.addEventListener("live2d-ready", () => console.log("ready"));
  el.addEventListener("live2d-hit", (e) => console.log(e.detail));
  el.addEventListener("live2d-error", (e) => console.error(e.detail));
  // Methods: loadModel / playMotion / setExpression / lookAt / pause / resume
</script>
```

`<live-2d-widget>` nests an inner `<live-2d>` and forwards model/size attributes
(product-shell chrome POC; no second Stage clock).

See `fixtures/index.html` for a native HTML dogfood page.
