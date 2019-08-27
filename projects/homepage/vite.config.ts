import { resolve } from "node:path";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: {
            "@": resolve(__dirname, "src"),
        },
    },
    server: {
        fs: {
            allow: [resolve(__dirname, "../..")],
        },
    },
    build: {
        target: "esnext",
    },
});
