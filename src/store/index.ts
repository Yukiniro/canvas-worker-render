/* eslint-disable react/no-is-mounted */
import { clamp } from "lodash-es";
import { nanoid } from "nanoid";
import workerUrl from "../worker/index.worker.ts?url";

const worker = new Worker(new URL(workerUrl, import.meta.url), { type: "module" });
const canvasPool: Array<HTMLCanvasElement | OffscreenCanvas> = [];
const imagePool: Array<HTMLImageElement> = [];
const transferredOffscreenCanvasMap: Map<HTMLCanvasElement, { id: string; offscreenCanvas: OffscreenCanvas }> =
  new Map();

function createCanvas(useOffscreen?: boolean) {
  if (useOffscreen) {
    return new OffscreenCanvas(1, 1);
  }
  return document.createElement("canvas");
}

function createImage() {
  return document.createElement("img");
}

class Graph {
  #canvas: HTMLCanvasElement | OffscreenCanvas;
  #mountPromise: Promise<void>;

  render(canvas: HTMLCanvasElement, progress: number) {
    if (!this.isMounted() || this.#canvas.width === 0 || this.#canvas.height === 0) {
      return;
    }
    const ctx = canvas.getContext("2d");
    const scale = 1 + progress * 0.2;
    const width = canvas.width * scale;
    const height = canvas.height * scale;
    const x = (canvas.width - width) / 2;
    const y = (canvas.height - height) / 2;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(this.#canvas, x, y, width, height);
  }

  async mount(url: string, threadType: string = "main-thread") {
    if (this.isMounted()) {
      return;
    }

    if (this.#mountPromise) {
      await this.#mountPromise;
      this.#mountPromise = null;
      return;
    }

    this.#mountPromise = (async () => {
      if (threadType === "worker-thread") {
        await new Promise(resolve => {
          this.#canvas = (canvasPool.pop() || createCanvas()) as HTMLCanvasElement;
          let offscreenCanvas: OffscreenCanvas = null;
          let decodeId: string = "";

          const hasTransferred = transferredOffscreenCanvasMap.has(this.#canvas);
          if (hasTransferred) {
            const item = transferredOffscreenCanvasMap.get(this.#canvas);
            decodeId = item.id;
            offscreenCanvas = item.offscreenCanvas;
          } else {
            decodeId = nanoid();
            offscreenCanvas = this.#canvas.transferControlToOffscreen();
            transferredOffscreenCanvasMap.set(this.#canvas, { id: decodeId, offscreenCanvas });
          }

          const fn = (msg: { data: { type: string; id: string } }) => {
            const { type, id } = msg.data;
            if (type === "render" && id === decodeId) {
              worker.removeEventListener("message", fn);
              resolve(null);
            }
          };

          worker.addEventListener("message", fn);

          if (hasTransferred) {
            worker.postMessage({
              type: "render",
              imageSource: url,
              options: { id: decodeId },
            });
          } else {
            worker.postMessage(
              {
                type: "render",
                offscreenCanvas,
                imageSource: url,
                options: { id: decodeId },
              },
              [offscreenCanvas],
            );
          }
        });
      } else {
        const source = await decodeImage(url, threadType);
        const width = source.width || (source as HTMLImageElement).naturalWidth;
        const height = source.height || (source as HTMLImageElement).naturalHeight;
        const sourceIsImageBitmap = source instanceof ImageBitmap;

        this.#canvas = canvasPool.pop() || createCanvas(sourceIsImageBitmap);
        this.#canvas.width = width;
        this.#canvas.height = height;

        if (sourceIsImageBitmap) {
          (this.#canvas as unknown as OffscreenCanvas).getContext("bitmaprenderer").transferFromImageBitmap(source);
        } else {
          (this.#canvas as unknown as HTMLCanvasElement).getContext("2d").drawImage(source, 0, 0);
        }

        if (sourceIsImageBitmap) {
          source.close();
        } else {
          source.onload = null;
          source.onerror = null;
          source.src = "";
          imagePool.push(source);
        }
      }
    })();

    await this.#mountPromise;
    this.#mountPromise = null;
  }

  async unmount() {
    if (!this.isMounted()) {
      return;
    }
    if (this.#mountPromise) {
      await this.#mountPromise;
      this.#mountPromise = null;
    }
    canvasPool.push(this.#canvas);

    if (transferredOffscreenCanvasMap.has(this.#canvas as HTMLCanvasElement)) {
      worker.postMessage({
        type: "release",
        id: transferredOffscreenCanvasMap.get(this.#canvas as HTMLCanvasElement).id,
      });
    } else {
      this.#canvas.width = 0;
      this.#canvas.height = 0;
    }

    this.#canvas = null;
  }

  isMounted() {
    return !!this.#canvas && !this.isMounting();
  }

  isMounting() {
    return !!this.#mountPromise;
  }

  async loadImage(image: HTMLImageElement, url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
  }
}

let isPlaying = false;
const graphs: Array<Graph> = [];
const count = 50;
let preMountCount = 2; // 预加载个数

for (let i = 0; i < count; i++) {
  graphs.push(new Graph());
}

async function play(
  canvas: HTMLCanvasElement,
  url: string,
  {
    onProgress,
    preloadCount = 2,
    threadType = "main-thread",
  }: {
    onProgress: (arg0: number) => void;
    preloadCount?: number;
    threadType?: string;
  },
) {
  isPlaying = true;
  let curTime = 0;
  preMountCount = preloadCount;
  const graphDuration = 100; // ms
  const allDuration = graphDuration * count; // ms
  const calcIndex = () => {
    return Math.floor(curTime / graphDuration);
  };

  await graphs[0].mount(url, threadType);

  let oldTimestamp = 0;
  let oldGraph: Graph = null;
  const _play = (timestamp: number) => {
    if (!isPlaying) {
      return;
    }

    if (curTime > allDuration) {
      onProgress && onProgress(1);
      return;
    }

    const index = calcIndex();
    const curGraph = graphs[index] || graphs[graphs.length - 1];

    if (!curGraph.isMounted()) {
      if (!curGraph.isMounting()) {
        curGraph.mount(url, threadType).catch(console.error);
      }
      oldTimestamp = timestamp;
      requestAnimationFrame(_play);
      return;
    }

    if (oldGraph && oldGraph !== curGraph) {
      oldGraph.unmount().catch(console.error);
    }
    oldGraph = curGraph;

    const start = index * graphDuration;
    const curTimeInGraph = curTime - start;
    curGraph.render(canvas, clamp(curTimeInGraph / graphDuration, 0, 1));

    for (let i = 1; i <= preMountCount; i++) {
      const preGraph = graphs[index + i] || graphs[graphs.length - 1];
      if (!preGraph.isMounted() && !preGraph.isMounting()) {
        preGraph.mount(url, threadType).catch(console.error);
      }
    }

    onProgress && onProgress(clamp(curTime / allDuration, 0, 1));
    requestAnimationFrame(_play);

    if (oldTimestamp) {
      curTime += timestamp - oldTimestamp;
    }
    oldTimestamp = timestamp;
  };

  requestAnimationFrame(_play);
}

async function stop() {
  isPlaying = false;
  await Promise.all(graphs.map(graph => graph.unmount()));
}

async function decodeImage(url: string, threadType: string): Promise<ImageBitmap | HTMLImageElement> {
  // 避免图片缓存对测试结果的影响
  const urlTimestamp = `${url}?t=${Date.now()}`;
  if (threadType === "main-thread") {
    const image = imagePool.pop() || createImage();
    await new Promise((resolve, reject) => {
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = urlTimestamp;
    });
    return image;
  } else if (threadType === "worker-thread-decode") {
    const decodeId = nanoid();
    const imageBitmap: ImageBitmap = await new Promise(resolve => {
      const fn = (msg: { data: { type: string; data: { id: string; imageBitmap: ImageBitmap } } }) => {
        const { type, data } = msg.data;
        const { id, imageBitmap } = data;
        if (type === "decodeImage" && id === decodeId) {
          resolve(imageBitmap);
          worker.removeEventListener("message", fn);
        }
      };
      worker.addEventListener("message", fn);
      worker.postMessage({
        type: "decodeImage",
        imageSource: urlTimestamp,
        options: { id: decodeId },
      });
    });
    return imageBitmap;
  }
}

export { play, stop };
