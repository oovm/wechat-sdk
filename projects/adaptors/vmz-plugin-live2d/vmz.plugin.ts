import { definePlugin, loadPluginSource } from "@vmz/plugin";

const hostSource = loadPluginSource(
    import.meta.url,
    "components/Live2dHost.vmz",
);
const stageSource = loadPluginSource(
    import.meta.url,
    "components/Live2dStage.vmz",
);

export default definePlugin({
    name: "@vmz/plugin-live2d",
    version: "0.1.0",
    protocol: "0.1.0",
    stages: ["workspace_resolve", "analyzer"],
    deterministic: true,
    async contribute(ctx) {
        if (ctx.stage === "workspace_resolve") {
            return {
                stage: "workspace_resolve",
                cacheKey: `@vmz/plugin-live2d:${hostSource.contentHash.slice(0, 8)}:${stageSource.contentHash.slice(0, 8)}`,
                items: [
                    {
                        id: "component-live2d-host",
                        kind: "source",
                        path: "src/components/Live2dHost.vmz",
                        content: hostSource.content,
                        contentHash: hostSource.contentHash,
                        materialize: true,
                    },
                    {
                        id: "component-live2d-stage",
                        kind: "source",
                        path: "src/components/Live2dStage.vmz",
                        content: stageSource.content,
                        contentHash: stageSource.contentHash,
                        materialize: true,
                    },
                ],
            };
        }
        if (ctx.stage === "analyzer") {
            return {
                stage: "analyzer",
                cacheKey: "@vmz/plugin-live2d:analyzer",
                items: [
                    {
                        id: "component-live2d-host-online",
                        kind: "analyzer",
                        path: "src/components/Live2dHost.vmz",
                        severity: "advice",
                        message:
                            "Live2dHost component online (@doki-land/live2d)",
                        code: "vmz.plugin.live2d.host",
                    },
                    {
                        id: "component-live2d-stage-online",
                        kind: "analyzer",
                        path: "src/components/Live2dStage.vmz",
                        severity: "advice",
                        message:
                            "Live2dStage component online (@doki-land/live2d)",
                        code: "vmz.plugin.live2d.stage",
                    },
                ],
            };
        }
        return { stage: ctx.stage, items: [] };
    },
});
