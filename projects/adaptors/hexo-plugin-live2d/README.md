# hexo-plugin-live2d

A browser-native Live2D character plugin for Hexo, powered by `@doki-land/live2d-widget` and `@doki-land/live2d`.

The plugin integrates the runtime with Hexo's configuration, generator, and injector APIs. It does not implement a
separate model renderer.

## ✨ Features

- Hexo auto-loading through the `hexo-*` package convention.
- Site and theme configuration merging.
- Generated browser bundle emitted into the static site.
- WebGPU, WebGL2, and Canvas2D renderer preference.
- Local, remote, and `npm:` model sources.
- Optional speech bubble and toolbar.
- Pointer tracking and click feedback.
- Site-wide floating character or custom target element.
- No Pixi, Three.js, or official obfuscated runtime dependency.

## 📦 Installation

```bash
pnpm add hexo-plugin-live2d
```

Hexo discovers installed packages named `hexo-*`. No manual `require()` is normally necessary.

## 🚀 Quick Start

Add the following to the site's `_config.yml`:

```yaml
live2d:
  enable: true
  model: /models/character.model3.json
  width: 280
  height: 400
  prefer:
    - webgpu
    - webgl2
    - canvas2d
  autoSway: true
  chrome: true
```

Generate or serve the site using the normal Hexo commands:

```bash
pnpm exec hexo clean
pnpm exec hexo generate
pnpm exec hexo server
```

## ⚙️ Configuration

```yaml
live2d:
  enable: true
  model: npm:live2d-widget-model-hijiki@1.0.5/assets/hijiki.model.json
  target: "#doki-live2d"
  className: doki-live2d
  width: 280
  height: 400
  pluginRootPath: live2dw/
  scriptUrl: /live2dw/doki-live2d-hexo.js
  prefer:
    - webgpu
    - webgl2
    - canvas2d
  autoSway: true
  chrome: true
```

| Option           | Description                                                |
|------------------|------------------------------------------------------------|
| `enable`         | Enables plugin registration and injection.                 |
| `model`          | Model settings URL or supported `npm:` specifier.          |
| `target`         | CSS selector used by the browser widget.                   |
| `className`      | Class applied to the default generated host.               |
| `width`          | Canvas backing width in pixels.                            |
| `height`         | Canvas backing height in pixels.                           |
| `pluginRootPath` | Static output directory for the generated browser bundle.  |
| `scriptUrl`      | Public URL used by the injected script tag.                |
| `prefer`         | Renderer initialization order.                             |
| `autoSway`       | Enables the lightweight idle angle animation.              |
| `chrome`         | Enables or configures the optional tips and toolbar shell. |

Site configuration overrides theme configuration. Keep deployment-specific URLs in the site configuration when a theme
is shared by multiple sites.

## 💬 Widget Chrome

Enable the default speech bubble and toolbar:

```yaml
live2d:
  chrome: true
```

The default toolbar can request Hitokoto content, save a canvas screenshot, and hide the widget. Network-dependent
features may require content-security policy changes and should be disabled on privacy-sensitive sites.

## 🧩 Custom Targets

When `target` is left as `#doki-live2d`, the plugin injects a default fixed-position host. To mount into a theme-owned
element, create the element in the theme and configure its selector:

```html
<aside id="site-character" aria-label="Site character"></aside>
```

```yaml
live2d:
  target: "#site-character"
```

The theme owns positioning and responsive behavior for custom targets.

## 🌐 Model Hosting

Static models can live in the Hexo source tree or another directory copied into the generated site. Verify that the
final output contains:

- the model settings file;
- the referenced MOC binary;
- all referenced textures;
- optional motions, expressions, physics, pose, and audio assets used by the model.

Remote models require correct CORS headers for every referenced resource. Pin versions when using `npm:` sources.

## 🔄 Navigation Lifecycles

Themes using PJAX, Swup, or another partial-navigation system may retain or replace the injected host without a full
page reload. Integrations should ensure that:

- the widget is not mounted twice;
- old pointer and document listeners are removed;
- animation frames stop when the host is destroyed;
- model state is intentionally retained or recreated;
- GPU resources are released when no longer used.

Theme-specific lifecycle hooks are not inferred automatically unless explicitly supported and tested.

## 🔐 Content Security Policy

A restrictive deployment may need to allow:

- the emitted plugin script;
- model and texture origins;
- the optional Hitokoto endpoint;
- image download through a canvas data URL.

Prefer self-hosted assets and explicit origins. Do not weaken a site's policy globally merely to enable an optional
toolbar action.

## 🧯 Troubleshooting

### The widget host is present but the model is blank

- Check the browser console for model, MOC, and texture requests.
- Verify the selected backend and fallback behavior.
- Confirm that all relative paths are resolved from the model settings URL.
- Check CORS and content-security policy errors.
- Test the same model in the project playground.

### The browser bundle is missing

Rebuild the package before publishing or linking it locally:

```bash
pnpm --filter hexo-plugin-live2d build
```

### Screenshot export fails

Remote textures without suitable CORS headers can make the canvas origin-unclean. Self-host the textures or configure
the asset server correctly.

### The widget appears twice

Check theme injectors, custom scripts, and PJAX callbacks for duplicate bootstrap code.

## 🧪 Development

```bash
pnpm --filter hexo-plugin-live2d typecheck
pnpm --filter hexo-plugin-live2d test
pnpm --filter hexo-plugin-live2d build
```

Package verification should include the generated browser bundle and a clean Hexo fixture site, not only unit tests for
configuration merging.

## 🤝 Contributing

Keep this adapter thin. Hexo-specific configuration and asset injection belong here; model runtime and webpage widget
behavior belong in their respective packages.

## 📄 License

See the repository license. Model assets and third-party content retain their own licenses.
