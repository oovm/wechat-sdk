export type Locale = "zh" | "en";

export type MessageTree = {
    readonly nav: {
        readonly home: string;
        readonly docs: string;
        readonly playground: string;
    };
    readonly lang: {
        readonly zh: string;
        readonly en: string;
        readonly switch: string;
    };
    readonly landing: {
        readonly headline: string;
        readonly lede: string;
        readonly ctaPlayground: string;
        readonly ctaDocs: string;
        readonly ctaGithub: string;
        readonly proof: {
            readonly native: string;
            readonly engine: string;
            readonly miniGame: string;
            readonly deploy: string;
        };
        readonly pipeline: {
            readonly title: string;
            readonly lede: string;
            readonly sourceTitle: string;
            readonly sourceBody: string;
            readonly evaluateTitle: string;
            readonly evaluateBody: string;
            readonly presentTitle: string;
            readonly presentBody: string;
        };
        readonly capabilities: {
            readonly title: string;
            readonly lede: string;
            readonly nativeTitle: string;
            readonly nativeBody: string;
            readonly engineTitle: string;
            readonly engineBody: string;
            readonly miniGameTitle: string;
            readonly miniGameBody: string;
            readonly deployTitle: string;
            readonly deployBody: string;
        };
        readonly deployment: {
            readonly title: string;
            readonly lede: string;
            readonly statusReady: string;
            readonly statusPlanned: string;
            readonly webTitle: string;
            readonly webBody: string;
            readonly hostTitle: string;
            readonly hostBody: string;
            readonly staticTitle: string;
            readonly staticBody: string;
        };
        readonly integrationTitle: string;
        readonly integrationLede: string;
        readonly integrationNoteTitle: string;
        readonly integrationNoteBody: string;
        readonly stackTitle: string;
        readonly stackLede: string;
        readonly stack: {
            readonly facade: string;
            readonly renderer: string;
            readonly vue: string;
            readonly hexo: string;
        };
        readonly heroAria: string;
        readonly finalTitle: string;
        readonly finalLede: string;
    };
    readonly footer: {
        readonly tagline: string;
        readonly docs: string;
        readonly playground: string;
        readonly repository: string;
        readonly issues: string;
        readonly copyright: string;
        readonly navAria: string;
    };
    readonly playground: {
        readonly title: string;
        readonly lede: string;
        readonly tabsAria: string;
        readonly tabSource: string;
        readonly tabStatus: string;
        readonly tabProperties: string;
        readonly modePreset: string;
        readonly modeUrl: string;
        readonly modeNpm: string;
        readonly model: string;
        readonly urlLabel: string;
        readonly npmPkg: string;
        readonly npmPath: string;
        readonly resolved: string;
        readonly renderer: string;
        readonly rendererCanvas2d: string;
        readonly rendererWebgl2: string;
        readonly rendererWebgpu: string;
        readonly width: string;
        readonly height: string;
        readonly autoSway: string;
        readonly load: string;
        readonly stuckFailed: string;
        readonly stuckRunning: string;
        readonly stuckComplete: string;
        readonly profileHeading: string;
        readonly profileHint: string;
        readonly profileEmpty: string;
        readonly propsEmpty: string;
        readonly paramsEmpty: string;
        readonly noMotions: string;
        readonly modelHeading: string;
        readonly motionsHeading: string;
        readonly paramsHeading: string;
        readonly presets: Record<string, string>;
    };
    readonly docs: {
        readonly navAria: string;
        readonly notFound: string;
        readonly backHome: string;
    };
};

export const messages: Record<Locale, MessageTree> = {
    zh: {
        nav: {
            home: "首页",
            docs: "文档",
            playground: "Playground",
        },
        lang: {
            zh: "中文",
            en: "English",
            switch: "语言",
        },
        landing: {
            headline: "让角色直接活在浏览器的游戏画面里。",
            lede: "面向游戏运行时的纯 TypeScript 模型链路：浏览器原生 GPU 绘制、资源按需加载，并为 Web、小游戏宿主与静态部署保持同一模型入口。",
            ctaPlayground: "试用运行时",
            ctaDocs: "查看接入方式",
            ctaGithub: "GitHub",
            proof: {
                native: "浏览器原生渲染路径",
                engine: "面向游戏帧循环的会话模型",
                miniGame: "为小游戏宿主保留适配边界",
                deploy: "同一资源入口面向多种部署形态",
            },
            pipeline: {
                title: "从模型资源，到每一帧画面",
                lede: "把模型加载、CPU 求值和显示后端分开，游戏侧只需要控制会话与画面节奏。",
                sourceTitle: "01 · 资源入口",
                sourceBody:
                    "从项目资源、URL 或包内资产解析模型设置与纹理，不把物理路径写进游戏逻辑。",
                evaluateTitle: "02 · 运行时求值",
                evaluateBody:
                    "在 TypeScript 中处理参数、动作与可绘制数据，让角色状态可被游戏循环稳定驱动。",
                presentTitle: "03 · 原生表面呈现",
                presentBody:
                    "按宿主能力选择 WebGPU、WebGL2 或 Canvas2D，让模型进入已有 Canvas 与渲染节奏。",
            },
            capabilities: {
                title: "为游戏运行时设计，而不是只做页面挂件",
                lede: "角色渲染需要和加载、输入、帧调度、资源预算一起工作。首页展示的是运行时方向，不是额外的场景图层。",
                nativeTitle: "浏览器原生 GPU",
                nativeBody:
                    "直接面向浏览器图形接口，保留后端选择与能力检测，让角色画面自然进入游戏的渲染节奏。",
                engineTitle: "适合游戏帧循环",
                engineBody:
                    "会话、参数和绘制操作可由你的 update/render 节奏驱动，便于和相机、输入、音频及资源调度协作。",
                miniGameTitle: "小游戏适配边界",
                miniGameBody:
                    "模型语义与宿主 API 分开。不同小游戏容器只需实现资源、Canvas 和生命周期适配，不复制模型运行时。",
                deployTitle: "按目标组织产物",
                deployBody:
                    "把模型、纹理与运行时代码当作可构建资产，面向 H5、静态站点和宿主包体做按需加载与部署规划。",
            },
            deployment: {
                title: "一个模型入口，多种交付表面",
                lede: "部署方式不应改变模型 API。适配器解决宿主接入，核心运行时保留同一套资源与会话语义。",
                statusReady: "当前可用",
                statusPlanned: "规划中",
                webTitle: "Web 游戏与 H5",
                webBody:
                    "挂载到已有 Canvas，适合游戏页面、互动剧情、角色界面和可静态托管的 Web 产物。",
                hostTitle: "小游戏宿主",
                hostBody:
                    "以 Canvas、资源读取和生命周期作为适配点，为不同小程序或游戏容器准备可替换的 host layer。",
                staticTitle: "Vue 与静态站点",
                staticBody:
                    "通过现有 Vue、Hexo 集成把运行时放进产品站点，同时保持核心 API 与游戏侧一致。",
            },
            integrationTitle: "几行代码，把角色接进游戏循环",
            integrationLede: "模型入口保持简单，复杂度留在运行时和宿主适配层。",
            integrationNoteTitle: "从试玩到正式接入",
            integrationNoteBody:
                "先在 Playground 检查模型、资源和后端，再把同一个会话放进你的游戏或产品页面。",
            stackTitle: "一套栈，职责清晰",
            stackLede:
                "门面、加载、渲染与宿主适配分开；项目按需要选择入口，不把页面框架带进核心运行时。",
            stack: {
                facade: "公共门面 — 会话、加载管线、进度事件。",
                renderer:
                    "CPU 求值，以及 WebGPU / WebGL2 / Canvas2D 绘制路径。",
                vue: "面向 Playground 与产品壳的 Vue 组件。",
                hexo: "Hexo 注入与 bootstrap；对话壳放在 live2d-widget。",
            },
            heroAria: "介绍",
            finalTitle: "把角色放进你的渲染节奏里。",
            finalLede:
                "从 Playground 验证模型与资源路径，再把同一会话接入游戏、站点或目标宿主。",
        },
        footer: {
            tagline: "Doki Land · live2d.ts",
            docs: "文档",
            playground: "Playground",
            repository: "仓库",
            issues: "Issues",
            copyright: `© ${new Date().getFullYear()} Doki Land`,
            navAria: "页脚",
        },
        playground: {
            title: "Playground",
            lede: "加载本地样例、远程 URL 或 npm: 包。Status 展示加载管线与帧耗时，便于对比 Renderer。",
            tabsAria: "Playground 面板",
            tabSource: "Source",
            tabStatus: "Status",
            tabProperties: "Properties",
            modePreset: "预设",
            modeUrl: "远程 URL",
            modeNpm: "npm 包",
            model: "模型",
            urlLabel: "model3.json / model.json URL",
            npmPkg: "包名（可选 @version）",
            npmPath: "资源路径",
            resolved: "解析结果",
            renderer: "Renderer",
            rendererCanvas2d: "可靠预览",
            rendererWebgl2: "GPU 基线",
            rendererWebgpu: "优先目标",
            width: "宽度",
            height: "高度",
            autoSway: "自动摇摆 PARAM_ANGLE_X",
            load: "加载模型",
            stuckFailed: "失败于 {stage}",
            stuckRunning: "进行中：{stage} · {percent}%",
            stuckComplete: "完成",
            profileHeading: "帧 Profile",
            profileHint:
                "切换 Source 里的 Renderer 后重新 Load，对比 fps / frame / evaluate / draw。",
            profileEmpty: "模型就绪并开始播放后显示实时帧数据。",
            propsEmpty: "先加载可绘制模型（例如 CPU program 预设）再查看属性。",
            paramsEmpty: "没有可暴露的参数（非 CPU 路径或尚未加载）。",
            noMotions: "无动作组。",
            modelHeading: "模型",
            motionsHeading: "动作组",
            paramsHeading: "参数",
            presets: {
                "cpu-quad": "本地 CPU program（方块）",
                "local-wanko": "本地 moc3 Wanko",
                "local-hijiki": "本地 moc2 Hijiki",
                "npm-mirrored-hijiki": "npm 包（镜像）Hijiki",
                "npm-cdn-hijiki": "npm: CDN Hijiki",
                "npm-cdn-tororo": "npm: CDN Tororo",
                "remote-wanko": "远程 moc3 Wanko（jsDelivr）",
            },
        },
        docs: {
            navAria: "文档目录",
            notFound: "未找到文档",
            backHome: "返回文档首页",
        },
    },
    en: {
        nav: {
            home: "Home",
            docs: "Docs",
            playground: "Playground",
        },
        lang: {
            zh: "中文",
            en: "English",
            switch: "Language",
        },
        landing: {
            headline: "Bring characters into the browser game frame.",
            lede: "A pure TypeScript model pipeline for game runtimes: browser-native GPU drawing, on-demand assets, and one model entry point for web, mini-game hosts, and static delivery.",
            ctaPlayground: "Try the runtime",
            ctaDocs: "Integration guide",
            ctaGithub: "GitHub",
            proof: {
                native: "Browser-native render paths",
                engine: "A session model for game frame loops",
                miniGame: "A clean boundary for mini-game hosts",
                deploy: "One asset entry for multiple delivery shapes",
            },
            pipeline: {
                title: "From model asset to every frame",
                lede: "Loading, CPU evaluation, and presentation stay separate, so the game controls only the session and frame cadence.",
                sourceTitle: "01 · Asset entry",
                sourceBody:
                    "Resolve settings and textures from project assets, URLs, or packaged resources without leaking physical paths into game code.",
                evaluateTitle: "02 · Runtime evaluation",
                evaluateBody:
                    "Parameters, actions, and drawable data are evaluated in TypeScript so character state follows a predictable game loop.",
                presentTitle: "03 · Native presentation",
                presentBody:
                    "Choose WebGPU, WebGL2, or Canvas2D for the host and keep the model inside the existing canvas and render cadence.",
            },
            capabilities: {
                title: "Designed for a game runtime, not a page ornament",
                lede: "Character rendering has to cooperate with loading, input, frame scheduling, and resource budgets. The homepage describes the runtime direction, not another scene layer.",
                nativeTitle: "Browser-native GPU",
                nativeBody:
                    "Work directly with browser graphics interfaces while preserving backend selection and capability checks, so character frames fit the game render cadence.",
                engineTitle: "Game-loop friendly",
                engineBody:
                    "Sessions, parameters, and draw work follow your update/render cadence and can cooperate with camera, input, audio, and resource scheduling.",
                miniGameTitle: "Mini-game host boundary",
                miniGameBody:
                    "Model semantics stay separate from host APIs. Each container only adapts assets, canvas, and lifecycle instead of duplicating the model runtime.",
                deployTitle: "Build by target",
                deployBody:
                    "Treat models, textures, and runtime code as build assets for on-demand loading and deployment planning across H5, static sites, and host bundles.",
            },
            deployment: {
                title: "One model entry, multiple delivery surfaces",
                lede: "A deployment choice should not change the model API. Adaptors connect to hosts while the core retains one asset and session model.",
                statusReady: "Available",
                statusPlanned: "Planned",
                webTitle: "Web games and H5",
                webBody:
                    "Mount on an existing canvas for game pages, interactive stories, character UI, and statically hosted web outputs.",
                hostTitle: "Mini-game hosts",
                hostBody:
                    "Use canvas, asset reads, and lifecycle as adaptation points for replaceable host layers across game containers.",
                staticTitle: "Vue and static sites",
                staticBody:
                    "Use the existing Vue and Hexo integrations in product sites while keeping the same core API used by games.",
            },
            integrationTitle: "A few lines to join the game loop",
            integrationLede:
                "Keep the model entry simple and let the runtime and host adaptor own the complexity.",
            integrationNoteTitle: "From playground to production",
            integrationNoteBody:
                "Check the model, assets, and backend in the Playground, then place the same session in a game or product page.",
            stackTitle: "One stack, clear packages",
            stackLede:
                "Facade, loader, renderer, and host adaptors stay separate so a page framework never becomes a core runtime dependency.",
            stack: {
                facade: "Public facade — session, load pipeline, progress events.",
                renderer:
                    "CPU evaluate plus WebGPU / WebGL2 / Canvas2D draw paths.",
                vue: "Vue component for playgrounds and product shells.",
                hexo: "Hexo inject + bootstrap; widget chrome lives in live2d-widget.",
            },
            heroAria: "Intro",
            finalTitle: "Put the character in your render cadence.",
            finalLede:
                "Verify the model and asset path in the Playground, then take the same session into a game, site, or target host.",
        },
        footer: {
            tagline: "Doki Land · live2d.ts",
            docs: "Docs",
            playground: "Playground",
            repository: "Repository",
            issues: "Issues",
            copyright: `© ${new Date().getFullYear()} Doki Land`,
            navAria: "Footer",
        },
        playground: {
            title: "Playground",
            lede: "Load local samples, remote URLs, or npm: packages. Status shows the load pipeline and frame timings so renderer gaps are visible.",
            tabsAria: "Playground panels",
            tabSource: "Source",
            tabStatus: "Status",
            tabProperties: "Properties",
            modePreset: "Preset",
            modeUrl: "Remote URL",
            modeNpm: "npm package",
            model: "Model",
            urlLabel: "model3.json / model.json URL",
            npmPkg: "Package (@version optional)",
            npmPath: "Asset path",
            resolved: "Resolved",
            renderer: "Renderer",
            rendererCanvas2d: "Reliable preview",
            rendererWebgl2: "GPU baseline",
            rendererWebgpu: "Preferred target",
            width: "Width",
            height: "Height",
            autoSway: "Auto sway PARAM_ANGLE_X",
            load: "Load model",
            stuckFailed: "failed at {stage}",
            stuckRunning: "stuck/running: {stage} · {percent}%",
            stuckComplete: "complete",
            profileHeading: "Frame profile",
            profileHint:
                "Switch Renderer under Source, Load again, then compare fps / frame / evaluate / draw.",
            profileEmpty:
                "Live frame data appears once the model is ready and playing.",
            propsEmpty:
                "Load a drawable model (e.g. CPU program preset) to inspect properties.",
            paramsEmpty:
                "No parameters exposed (model not on CPU path, or not loaded).",
            noMotions: "No motion groups.",
            modelHeading: "Model",
            motionsHeading: "Motion groups",
            paramsHeading: "Parameters",
            presets: {
                "cpu-quad": "Local CPU program (quad)",
                "local-wanko": "Local moc3 Wanko",
                "local-hijiki": "Local moc2 Hijiki",
                "npm-mirrored-hijiki": "npm package (mirrored) Hijiki",
                "npm-cdn-hijiki": "npm: CDN Hijiki",
                "npm-cdn-tororo": "npm: CDN Tororo",
                "remote-wanko": "Remote moc3 Wanko (jsDelivr gh)",
            },
        },
        docs: {
            navAria: "Documentation",
            notFound: "Not found",
            backHome: "Back to docs home",
        },
    },
};
