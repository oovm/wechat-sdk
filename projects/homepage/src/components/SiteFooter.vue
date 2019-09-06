<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { landingGithub, landingIssues } from "../config/landing";
import { docsHomePath, useI18n } from "../i18n";

const { t } = useI18n();

const links = computed(() => [
    { label: t("footer.docs"), href: docsHomePath(), external: false },
    { label: t("footer.gallery"), href: "/gallery", external: false },
    { label: t("footer.stage"), href: "/stage", external: false },
    { label: t("footer.playground"), href: "/playground", external: false },
    { label: t("footer.repository"), href: landingGithub, external: true },
    { label: t("footer.issues"), href: landingIssues, external: true },
]);
</script>

<template>
  <footer class="site-footer">
    <div class="inner">
      <div class="brand-block">
        <p class="footer-kicker">LIVE2D RUNTIME · 2026</p>
        <p class="tagline"><span class="footer-mark">✦</span>{{ t("footer.tagline") }}</p>
        <p class="footer-line">Native canvas for games, stories, and character UI.</p>
        <p class="copy">{{ t("footer.copyright") }}</p>
      </div>
      <div class="footer-status"><span></span><strong>READY TO RENDER</strong><small>WebGPU · WebGL2 · Canvas2D</small>
      </div>
      <div class="footer-columns">
        <div><b>RUNTIME</b><a href="/">Browser Canvas</a><a href="/playground">Game loop</a><a :href="docsHomePath()">Resource
          loading</a></div>
        <div><b>PACKAGES</b><span>@doki-land/live2d</span><span>live2d-loader</span><span>live2d-renderer</span></div>
        <div><b>HOSTS</b><span>Web / H5</span><span>Vue adaptor</span><span>Hexo adaptor</span><span>Cocos adaptor</span></div>
      </div>
      <nav :aria-label="t('footer.navAria')">
        <template v-for="link in links" :key="link.label + link.href">
          <a
            v-if="link.external"
            :href="link.href"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ link.label }}
          </a>
          <RouterLink v-else :to="link.href">{{ link.label }}</RouterLink>
        </template>
      </nav>
    </div>
  </footer>
</template>

<style scoped>
.site-footer {
  margin-top: auto;
  border-bottom: 0;
  border-top: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
  background: #edf8ff;
  position: relative;
  overflow: hidden;
}

.site-footer::before {
  content: "";
  position: absolute;
  right: 0;
  bottom: 0;
  width: 12rem;
  height: 5rem;
  background: #b8b5f4;
  clip-path: polygon(38% 0, 100% 0, 100% 100%, 0 100%);
  opacity: 0.55;
}

.inner {
  max-width: 72rem;
  margin: 0 auto;
  padding: 1.75rem 1.5rem 2.25rem;
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem 2rem;
  align-items: end;
  justify-content: space-between;
}

.tagline {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.05rem;
  letter-spacing: 0.04em;
  color: var(--ink);
}

.footer-kicker {
  margin: 0 0 0.75rem;
  color: #377ba8;
  font: 650 0.72rem/1 var(--font-display);
}

.footer-mark {
  display: inline-grid;
  place-items: center;
  width: 1.4rem;
  height: 1.4rem;
  margin-right: 0.45rem;
  background: #55d6be;
  color: #17304a;
  font-size: 0.8rem;
}

.footer-line {
  margin: 0.5rem 0 0;
  color: var(--ink);
  font-size: 0.88rem;
}

.footer-status {
  display: grid;
  gap: 0.25rem;
  color: #247a69;
  font: 650 0.78rem/1 var(--font-display);
}

.footer-status span {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  background: #55d6be;
}

.footer-status small {
  color: var(--muted);
  font: 500 0.75rem/1 var(--font-display);
}

.footer-columns {
  display: grid;
  grid-template-columns: repeat(3, minmax(8rem, 1fr));
  gap: 2.2rem;
  margin-left: auto;
}

.footer-columns > div {
  display: grid;
  gap: 0.45rem;
  align-content: start;
}

.footer-columns b {
  margin-bottom: 0.2rem;
  color: #377ba8;
  font: 650 0.7rem/1 var(--font-display);
}

.footer-columns a, .footer-columns span {
  color: var(--muted);
  font-size: 0.78rem;
  line-height: 1.35;
}

.footer-columns a:hover {
  color: var(--accent);
}

.copy {
  margin: 0.35rem 0 0;
  font-size: 0.82rem;
  color: var(--muted);
}

nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem 1.35rem;
}

nav a {
  font-size: 0.9rem;
  color: var(--muted);
  transition: color 160ms ease;
}

nav a:hover {
  color: var(--accent);
}

@media (max-width: 760px) {
  .footer-columns {
    width: 100%;
    margin-left: 0;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
  }
}
</style>
