import { defineConfig } from "@vmz/vmz";
import live2d from "@vmz/plugin-live2d";
import markdownIt from "@vmz/plugin-markdown-it";

export default defineConfig({
    plugins: [live2d, markdownIt],
    delivery: {
        default: "web-static",
        profiles: {
            "web-static": { host: "browser", assembly: "local-static" },
        },
    },
});
