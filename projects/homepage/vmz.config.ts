import { defineConfig } from "@vmz/vmz";
import live2d from "@vmz/plugin-live2d";

export default defineConfig({
    plugins: [live2d],
    delivery: {
        default: "web-static",
        profiles: {
            "web-static": { host: "browser", assembly: "static-cdn" },
        },
    },
});
