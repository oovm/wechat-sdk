import type { Live2dElement } from "@doki-land/live2d-element";
import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react" {
    namespace JSX {
        interface IntrinsicElements {
            "live-2d": DetailedHTMLProps<
                HTMLAttributes<Live2dElement> & {
                    model?: string;
                    renderer?: string;
                    width?: number | string;
                    height?: number | string;
                    autoplay?: boolean;
                    autosway?: boolean;
                    interactive?: boolean;
                    tracking?: "pointer" | "none";
                },
                Live2dElement
            >;
        }
    }
}
