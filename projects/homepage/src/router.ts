import { createRouter, createWebHistory } from "vue-router";
import Docs from "./pages/Docs.vue";
import Home from "./pages/Home.vue";
import Playground from "./pages/Playground.vue";

export const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: "/", name: "home", component: Home },
        { path: "/playground", name: "playground", component: Playground },
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
