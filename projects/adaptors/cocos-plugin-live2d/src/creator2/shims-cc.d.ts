/**
 * Minimal Creator 2.4 ambient `cc` for typechecking this entry.
 * Real Creator 2 projects use the engine's creator.d.ts.
 */

declare namespace cc {
    type Constructor<T = unknown> = new (...args: never[]) => T;

    class Vec2 {
        x: number;
        y: number;
        constructor(x?: number, y?: number);
    }

    class Node {
        name: string;
        on(type: string, callback: (...args: never[]) => void, target?: unknown): void;
        off(type: string, callback: (...args: never[]) => void, target?: unknown): void;
        getComponent<T>(type: Constructor<T> | string): T | null;
        addComponent<T>(type: Constructor<T> | string): T;
        width: number;
        height: number;
        setContentSize(width: number, height: number): void;
    }

    class Component {
        node: Node;
        enabled: boolean;
        getComponent<T>(type: Constructor<T> | string): T | null;
        addComponent<T>(type: Constructor<T> | string): T;
    }

    class Sprite extends Component {
        spriteFrame: SpriteFrame | null;
    }

    class SpriteFrame {
        constructor();
    }

    class Texture2D {
        initWithElement(element: HTMLCanvasElement | HTMLImageElement): void;
        handleLoadedTexture(): void;
    }

    namespace Node {
        // Creator 2 touch events use Node.EventType.* on some versions;
        // projects also use cc.Node.EventType.
    }

    const Node: {
        EventType: {
            TOUCH_START: string;
            TOUCH_MOVE: string;
            TOUCH_END: string;
            TOUCH_CANCEL: string;
        };
    };

    const _decorator: {
        ccclass: (name?: string) => ClassDecorator;
        property: ((options?: Record<string, unknown>) => PropertyDecorator) &
            PropertyDecorator;
    };
}
