<script setup lang="ts">
import { computed } from "vue";
import { Live2D } from "vue-plugin-live2d";
import {
    landingBrand,
    landingGithub,
    landingHero,
    landingStackPackages,
} from "../config/landing";
import { docsHomePath, useI18n } from "../i18n";

const { t, messages } = useI18n();

const ctas = computed(() => [
    {
        label: t("landing.ctaPlayground"),
        to: "/playground",
        primary: true,
    },
    {
        label: t("landing.ctaDocs"),
        to: docsHomePath(),
    },
    {
        label: t("landing.ctaGithub"),
        href: landingGithub,
        external: true,
    },
]);

const stack = computed(() =>
    landingStackPackages.map((pkg) => ({
        name: pkg.name,
        blurb: messages.value.landing.stack[pkg.id],
    })),
);

const proofItems = computed(() => [
    t("landing.proof.native"),
    t("landing.proof.engine"),
    t("landing.proof.miniGame"),
    t("landing.proof.deploy"),
]);

const pipeline = computed(() => [
    {
        title: t("landing.pipeline.sourceTitle"),
        body: t("landing.pipeline.sourceBody"),
    },
    {
        title: t("landing.pipeline.evaluateTitle"),
        body: t("landing.pipeline.evaluateBody"),
    },
    {
        title: t("landing.pipeline.presentTitle"),
        body: t("landing.pipeline.presentBody"),
    },
]);

const capabilities = computed(() => [
    {
        label: "01",
        title: t("landing.capabilities.nativeTitle"),
        body: t("landing.capabilities.nativeBody"),
    },
    {
        label: "02",
        title: t("landing.capabilities.engineTitle"),
        body: t("landing.capabilities.engineBody"),
    },
    {
        label: "03",
        title: t("landing.capabilities.miniGameTitle"),
        body: t("landing.capabilities.miniGameBody"),
    },
    {
        label: "04",
        title: t("landing.capabilities.deployTitle"),
        body: t("landing.capabilities.deployBody"),
    },
]);

const deployment = computed(() => [
    {
        status: t("landing.deployment.statusReady"),
        title: t("landing.deployment.webTitle"),
        body: t("landing.deployment.webBody"),
    },
    {
        status: t("landing.deployment.statusPlanned"),
        title: t("landing.deployment.hostTitle"),
        body: t("landing.deployment.hostBody"),
    },
    {
        status: t("landing.deployment.statusReady"),
        title: t("landing.deployment.staticTitle"),
        body: t("landing.deployment.staticBody"),
    },
]);
</script>

<template>
  <div class="landing">
    <section class="hero" :aria-label="t('landing.heroAria')">
      <div class="hero-confetti" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
      <div class="hero-inner">
        <div class="hero-copy">
          <p class="brand">{{ landingBrand }}</p>
          <p class="hero-kicker">BROWSER CHARACTER RUNTIME <span>01</span></p>
          <h1>{{ t("landing.headline") }}</h1>
          <p class="lede">{{ t("landing.lede") }}</p>
          <div class="cta-row">
            <template v-for="cta in ctas" :key="cta.label">
              <RouterLink v-if="cta.to" class="cta" :class="{ primary: cta.primary }" :to="cta.to">
                {{ cta.label }}
              </RouterLink>
              <a v-else-if="cta.href" class="cta" :class="{ primary: cta.primary }" :href="cta.href" target="_blank"
                 rel="noopener noreferrer">
                {{ cta.label }}
              </a>
            </template>
          </div>
        </div>
        <div class="hero-stage" aria-hidden="true">
          <div class="stage-label">CHARACTER 01 · LIVE RUNTIME</div>
          <div class="stage-backdrop"><span class="stage-waterline"></span></div>
          <Live2D class="hero-live2d" :model="landingHero.model" :width="landingHero.width" :height="landingHero.height"
                  :prefer="['webgpu', 'webgl2', 'canvas2d']" :show-progress="false"/>
          <div class="stage-meta"><span></span> WebGPU · WebGL2 · Canvas2D</div>
        </div>
      </div>
      <ul class="proof-strip" aria-label="Runtime principles">
        <li v-for="item in proofItems" :key="item">{{ item }}</li>
      </ul>
    </section>

    <section class="pipeline section" aria-labelledby="pipeline-title">
      <div class="section-heading">
        <p class="eyebrow">RUNTIME PATH</p>
        <h2 id="pipeline-title">{{ t("landing.pipeline.title") }}</h2>
        <p>{{ t("landing.pipeline.lede") }}</p>
      </div>
      <ol class="pipeline-flow">
        <li v-for="item in pipeline" :key="item.title">
          <h3>{{ item.title }}</h3>
          <p>{{ item.body }}</p>
        </li>
      </ol>
    </section>

    <section class="capabilities section" aria-labelledby="capabilities-title">
      <div class="section-heading wide">
        <p class="eyebrow">GAME RUNTIME</p>
        <h2 id="capabilities-title">{{ t("landing.capabilities.title") }}</h2>
        <p>{{ t("landing.capabilities.lede") }}</p>
      </div>
      <div class="capability-grid">
        <article v-for="item in capabilities" :key="item.label" class="capability">
          <span>{{ item.label }}</span>
          <h3>{{ item.title }}</h3>
          <p>{{ item.body }}</p>
        </article>
      </div>
    </section>

    <section class="deployment section" aria-labelledby="deployment-title">
      <div class="section-heading">
        <p class="eyebrow">DELIVERY</p>
        <h2 id="deployment-title">{{ t("landing.deployment.title") }}</h2>
        <p>{{ t("landing.deployment.lede") }}</p>
      </div>
      <div class="deployment-list">
        <article v-for="item in deployment" :key="item.title">
          <div class="deployment-title"><h3>{{ item.title }}</h3><span>{{ item.status }}</span></div>
          <p>{{ item.body }}</p>
        </article>
      </div>
    </section>

    <section class="integration-demo section" aria-labelledby="integration-demo-title">
      <div class="section-heading">
        <p class="eyebrow">SMALL API · BIG STAGE</p>
        <h2 id="integration-demo-title">{{ t("landing.integrationTitle") }}</h2>
        <p>{{ t("landing.integrationLede") }}</p>
      </div>
      <div class="integration-demo-grid">
        <pre aria-label="Live2D integration example"><code>const actor = createLive2D({ renderer: "auto" });

await actor.mount(canvas);
await actor.loadModel("/models/character.model3.json");
actor.update(deltaTime);</code></pre>
        <div class="integration-note">
          <span class="note-mark">RUN 01</span>
          <h3>{{ t("landing.integrationNoteTitle") }}</h3>
          <p>{{ t("landing.integrationNoteBody") }}</p>
          <RouterLink class="text-link" to="/playground">{{ t("landing.ctaPlayground") }} <span
            aria-hidden="true">↗</span></RouterLink>
        </div>
      </div>
    </section>

    <section class="stack section" aria-labelledby="stack-title">
      <div class="section-heading">
        <p class="eyebrow">INTEGRATION</p>
        <h2 id="stack-title">{{ t("landing.stackTitle") }}</h2>
        <p>{{ t("landing.stackLede") }}</p>
      </div>
      <ul>
        <li v-for="item in stack" :key="item.name">
          <span class="pkg">{{ item.name }}</span>
          <span class="blurb">{{ item.blurb }}</span>
        </li>
      </ul>
    </section>

    <section class="final-cta section">
      <div>
        <p class="eyebrow">START WITH A MODEL</p>
        <h2>{{ t("landing.finalTitle") }}</h2>
        <p>{{ t("landing.finalLede") }}</p>
      </div>
      <RouterLink class="cta primary" to="/playground">{{ t("landing.ctaPlayground") }}</RouterLink>
    </section>
  </div>
</template>

<style scoped>
.landing {
  display: grid;
}

.hero {
  position: relative;
  min-height: min(55rem, calc(100svh - 1.5rem));
  display: grid;
  align-content: space-between;
  overflow: hidden;
  background: #ffffff;
  color: var(--ink);
  padding-top: clamp(5.5rem, 12vh, 7rem);
}

.hero::before {
  content: "";
  position: absolute;
  inset: 0 0 0 54%;
  background: #eef8ff;
  clip-path: polygon(18% 0, 100% 0, 100% 100%, 0 100%);
}

.hero::after {
  content: "";
  position: absolute;
  left: 0;
  top: 8rem;
  width: 8px;
  height: 10rem;
  background: #b8b5f4;
}

.hero-confetti span {
  position: absolute;
  z-index: 1;
  display: block;
  transform: rotate(45deg);
}

.hero-confetti span:nth-child(1) {
  width: 12px;
  height: 12px;
  top: 18%;
  left: 8%;
  background: #55d6be;
}

.hero-confetti span:nth-child(2) {
  width: 8px;
  height: 8px;
  top: 29%;
  right: 4%;
  background: #b8b5f4;
}

.hero-confetti span:nth-child(3) {
  width: 14px;
  height: 14px;
  bottom: 19%;
  left: 47%;
  border: 2px solid #ff7f70;
}

.hero-confetti span:nth-child(4) {
  width: 7px;
  height: 28px;
  top: 14%;
  left: 51%;
  background: #7ea7ff;
}

.hero-inner {
  width: min(100% - 2.5rem, 76rem);
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(17rem, 0.9fr);
  align-items: center;
  gap: clamp(1.5rem, 5vw, 5rem);
}

.hero-copy {
  position: relative;
  z-index: 1;
  max-width: 39rem;
  display: grid;
  gap: 1rem;
  justify-items: start;
}

.brand {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(3rem, 8vw, 5.2rem);
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 0.95;
  color: var(--ink);
}

h1 {
  margin: 0;
  max-width: 22ch;
  font-family: var(--font-body);
  font-size: clamp(1.4rem, 3vw, 2.25rem);
  font-weight: 600;
  line-height: 1.2;
  color: var(--ink);
}

.lede {
  margin: 0;
  max-width: 38ch;
  font-size: 1rem;
  line-height: 1.55;
  color: var(--muted);
}

.cta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.35rem;
}

.cta {
  display: inline-flex;
  align-items: center;
  padding: 0.7rem 1.15rem;
  border: 1px solid #c8b9d7;
  color: var(--ink);
  font: 500 0.95rem/1 var(--font-body);
  transition: transform 180ms ease,
  background 180ms ease,
  border-color 180ms ease;
}

.cta.primary {
  position: relative;
  background: #1677c8;
  border-color: #1677c8;
  color: #ffffff;
  box-shadow: 5px 5px 0 #b8b5f4;
}

.cta:hover {
  transform: translateY(-2px);
}

.cta:not(.primary):hover {
  border-color: var(--accent);
}

.hero-stage {
  position: relative;
  z-index: 1;
  justify-self: end;
  width: min(100%, 30rem);
  min-height: 31rem;
  display: grid;
  align-content: center;
  pointer-events: none;
}

.hero-kicker {
  order: -1;
  margin: 0 0 -0.2rem;
  color: #2174ae;
  font: 650 0.76rem/1 var(--font-display);
}

.hero-kicker span {
  display: inline-grid;
  place-items: center;
  width: 1.55rem;
  height: 1.55rem;
  margin-left: 0.45rem;
  background: #b8b5f4;
  color: #28325f;
}

.stage-backdrop {
  position: absolute;
  inset: 2rem 0 1rem;
  overflow: hidden;
  border: 1px solid #b8daef;
  background: #ffffff;
  box-shadow: 12px 12px 0 #d7efff;
}

.stage-backdrop::after {
  content: "";
  position: absolute;
  left: 0;
  bottom: 0;
  width: 5rem;
  height: 5rem;
  background: #55d6be;
  clip-path: polygon(0 0, 0 100%, 100% 100%);
}

.stage-backdrop::before {
  content: "LIVE CANVAS";
  position: absolute;
  top: 1rem;
  right: 1rem;
  color: #8bb8d8;
  font: 600 0.68rem/1 var(--font-display);
}

.stage-waterline {
  position: absolute;
  right: 0;
  bottom: 12%;
  width: 72%;
  height: 1px;
  background: #86c4eb;
}

.stage-waterline::before, .stage-waterline::after {
  content: "";
  position: absolute;
  right: 0;
  height: 1px;
  background: #c0e2f6;
}

.stage-waterline::before {
  bottom: 0.65rem;
  width: 58%;
}

.stage-waterline::after {
  top: 0.65rem;
  width: 82%;
}

.hero-live2d {
  position: relative;
  z-index: 1;
  display: block;
  margin-inline: auto;
}

.stage-label, .stage-meta {
  position: relative;
  z-index: 2;
  font: 600 0.72rem/1 var(--font-display);
  letter-spacing: 0;
  color: #477ba4;
}

.stage-label {
  justify-self: start;
}

.stage-meta {
  justify-self: end;
  margin-top: -1rem;
}

.stage-meta span {
  display: inline-block;
  width: 0.45rem;
  height: 0.45rem;
  margin-right: 0.35rem;
  border-radius: 50%;
  background: #3fbf91;
}

.proof-strip {
  width: min(100% - 2.5rem, 76rem);
  margin: 2rem auto 1.25rem;
  padding: 1rem 0;
  border-top: 1px solid #ddd2e6;
  border-bottom: 1px solid #ddd2e6;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
  list-style: none;
}

.proof-strip li {
  position: relative;
  padding-left: 1rem;
  color: var(--muted);
  font-size: 0.85rem;
  line-height: 1.4;
}

.proof-strip li::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.35rem;
  width: 0.45rem;
  height: 0.45rem;
  transform: rotate(45deg);
  background: #55d6be;
}

.proof-strip li:nth-child(2)::before {
  background: #b8b5f4;
}

.proof-strip li:nth-child(3)::before {
  background: #ff7f70;
}

.proof-strip li:nth-child(4)::before {
  background: #7ea7ff;
}

.section {
  width: min(100% - 2.5rem, 76rem);
  margin: 0 auto;
  padding: clamp(4rem, 9vw, 7rem) 0;
}

.section-heading {
  max-width: 42rem;
  display: grid;
  gap: 0.8rem;
}

.section-heading.wide {
  max-width: 48rem;
}

.eyebrow {
  margin: 0;
  font: 650 0.75rem/1 var(--font-display);
  letter-spacing: 0;
  color: #347bb1;
}

.section h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(2rem, 4vw, 3.25rem);
  line-height: 1.08;
  color: var(--ink);
}

.section-heading > p:last-child, .final-cta p {
  margin: 0;
  max-width: 44rem;
  color: var(--muted);
  line-height: 1.65;
}

.pipeline {
  border-bottom: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
}

.pipeline-flow {
  margin: 3rem 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-top: 1px solid color-mix(in srgb, var(--ink) 16%, transparent);
}

.pipeline-flow li {
  padding: 1.25rem 1.25rem 1.25rem 0;
  min-height: 11rem;
  border-right: 1px solid color-mix(in srgb, var(--ink) 16%, transparent);
}

.pipeline-flow li::before {
  content: "";
  display: block;
  width: 2.2rem;
  height: 0.3rem;
  margin-bottom: 1rem;
  background: #55d6be;
}

.pipeline-flow li:nth-child(2)::before {
  background: #b8b5f4;
}

.pipeline-flow li:nth-child(3)::before {
  background: #ff7f70;
}

.pipeline-flow li + li {
  padding-left: 1.25rem;
}

.pipeline-flow li:last-child {
  border-right: 0;
}

.pipeline-flow h3, .deployment-list h3, .capability h3 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.2rem;
  color: var(--ink);
}

.pipeline-flow p, .deployment-list p, .capability p {
  margin: 0.65rem 0 0;
  color: var(--muted);
  font-size: 0.95rem;
  line-height: 1.55;
}

.capabilities {
  width: 100%;
  padding-inline: max(1.25rem, calc((100% - 76rem) / 2));
  box-sizing: border-box;
  background: #eef8ff;
  border-block: 1px solid #cfe8f7;
}

.capability-grid {
  margin-top: 3rem;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border-top: 1px solid #bcd9ee;
  border-left: 1px solid #bcd9ee;
}

.capability {
  min-height: 15rem;
  padding: 1.25rem;
  border-right: 1px solid #bcd9ee;
  border-bottom: 1px solid #bcd9ee;
}

.capability > span {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  margin-bottom: 2.5rem;
  background: #ffffff;
  border: 1px solid #8ac4e7;
  color: #347bb1;
  font: 650 0.76rem/1 var(--font-display);
  transform: rotate(-4deg);
}

.capability:nth-child(2) > span {
  border-color: #55d6be;
  color: #168271;
  transform: rotate(3deg);
}

.capability:nth-child(3) > span {
  border-color: #b8b5f4;
  color: #5d5aa2;
  transform: rotate(-2deg);
}

.capability:nth-child(4) > span {
  border-color: #ff9c91;
  color: #b8493c;
  transform: rotate(4deg);
}

.deployment {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(20rem, 1.1fr);
  gap: clamp(2rem, 7vw, 7rem);
  align-items: start;
}

.deployment-list {
  display: grid;
}

.deployment-list article {
  padding: 1.25rem 0;
  border-top: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
}

.deployment-list article:last-child {
  border-bottom: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
}

.deployment-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

.deployment-title > span {
  flex: none;
  padding: 0.25rem 0.45rem;
  border: 1px solid #55d6be;
  background: #effcf9;
  color: #168271;
  font: 600 0.72rem/1 var(--font-display);
}

.stack {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(19rem, 1.2fr);
  gap: clamp(2rem, 7vw, 7rem);
  align-items: start;
  border-top: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
}

.stack ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0;
}

.stack li {
  display: grid;
  gap: 0.4rem;
  padding: 1rem 0;
  border-top: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
}

.pkg {
  font-family: ui-monospace, Consolas, monospace;
  font-size: 0.92rem;
  color: var(--ink);
}

.blurb {
  font-size: 0.95rem;
  color: var(--muted);
  line-height: 1.45;
}

.integration-demo {
  border-top: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
}

.integration-demo-grid {
  margin-top: 3rem;
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(16rem, 0.75fr);
  gap: 1.5rem;
  align-items: stretch;
}

.integration-demo pre {
  margin: 0;
  padding: 1.5rem;
  overflow: auto;
  background: #102a43;
  color: #f2f8fc;
  font: 500 0.92rem/1.7 ui-monospace, Consolas, monospace;
  border-radius: 8px;
}

.integration-note {
  padding: 1.5rem;
  background: #f2f8ff;
  border: 1px solid #c7dff4;
  border-radius: 8px;
}

.note-mark {
  display: inline-block;
  padding: 0.35rem 0.5rem;
  background: #b8b5f4;
  color: #28325f;
  font: 650 0.72rem/1 var(--font-display);
  letter-spacing: 0;
}

.integration-note h3 {
  margin: 2.5rem 0 0;
  font-family: var(--font-display);
  font-size: 1.25rem;
  color: var(--ink);
}

.integration-note p {
  margin: 0.65rem 0 1.25rem;
  color: var(--muted);
  line-height: 1.55;
}

.text-link {
  color: var(--accent);
  font-weight: 600;
}

.final-cta {
  width: 100%;
  box-sizing: border-box;
  padding-inline: max(1.25rem, calc((100% - 76rem) / 2));
  background: #dceeff;
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 2rem;
}

.final-cta .eyebrow {
  color: #4d79a2;
}

.final-cta .cta.primary {
  background: var(--ink);
  border-color: var(--ink);
  color: #ffffff;
  white-space: nowrap;
}

@media (max-width: 820px) {
  .hero {
    min-height: auto;
    padding-bottom: 1.5rem;
  }

  .hero-inner, .deployment, .stack {
    grid-template-columns: 1fr;
  }

  .hero-stage {
    justify-self: center;
    width: min(82vw, 24rem);
    min-height: auto;
  }

  .proof-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .pipeline-flow, .capability-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .pipeline-flow li:nth-child(2) {
    border-right: 0;
  }

  .pipeline-flow li:last-child {
    border-top: 1px solid color-mix(in srgb, var(--ink) 16%, transparent);
    padding-left: 0;
  }

  .final-cta {
    align-items: start;
    flex-direction: column;
  }

  .integration-demo-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .hero-inner, .proof-strip, .section {
    width: min(100% - 2rem, 76rem);
  }

  .hero-inner {
    gap: 1rem;
  }

  .brand {
    font-size: 3rem;
  }

  .proof-strip, .pipeline-flow, .capability-grid {
    grid-template-columns: 1fr;
  }

  .pipeline-flow li, .pipeline-flow li + li {
    border-right: 0;
    border-top: 1px solid color-mix(in srgb, var(--ink) 16%, transparent);
    padding: 1.1rem 0;
    min-height: 0;
  }

  .pipeline-flow li:first-child {
    border-top: 0;
  }

  .capability {
    min-height: 0;
  }

  .capability > span {
    margin-bottom: 1.5rem;
  }

  .final-cta {
    padding-inline: 1rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    transition: none !important;
    animation: none !important;
  }

  .cta:hover {
    transform: none;
  }
}
</style>
