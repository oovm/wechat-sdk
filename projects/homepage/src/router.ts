import { createRouter, createWebHistory } from "vue-router";
import Capture from "./pages/Capture.vue";
import Docs from "./pages/Docs.vue";
import Gallery from "./pages/Gallery.vue";
import Home from "./pages/Home.vue";
import Playground from "./pages/Playground.vue";
import Stage from "./pages/Stage.vue";

export const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: "/", name: "home", component: Home },
        { path: "/gallery", name: "gallery", component: Gallery },
        { path: "/stage", name: "stage", component: Stage },
        { path: "/playground", name: "playground", component: Playground },
        {
            path: "/_capture",
            name: "capture",
            component: Capture,
            meta: { hideChrome: true },
        },
        {
            path: "/d",
            name: "docs-root",
            component: Docs,
        },
        {
            // `/d/文档` → zh index alias; `/d/zh`, `/d/en`, `/d/zh/getting-started`
            path: "/d/:langOrAlias/:slug*",
            name: "docs",
            component: Docs,
        },
    ],
    scrollBehavior() {
        return { top: 0 };
    },
});
