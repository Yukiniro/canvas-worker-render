import { clamp } from "lodash-es";

const canvasPool: Array<HTMLCanvasElement> = [];
const imagePool: Array<HTMLImageElement> = [];

function createCanvas() {
  return document.createElement("canvas");
}

function createImage() {
  return document.createElement("img");
}

class Graph {
  #canvas: HTMLCanvasElement;
  #mountPromise: Promise<void>;

  render(canvas: HTMLCanvasElement, progress: number) {
    if (!this.isMounted()) {
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

  async mount(url: string) {
    if (this.isMounted()) {
      return;
    }

    if (this.#mountPromise) {
      await this.#mountPromise;
      this.#mountPromise = null;
      return;
    }

    this.#mountPromise = (async () => {
      this.#canvas = canvasPool.pop() || createCanvas();
      const image = imagePool.pop() || createImage();
      const img = await this.loadImage(image, url);
      this.#canvas.width = img.naturalWidth;
      this.#canvas.height = img.naturalHeight;
      this.#canvas.getContext("2d").drawImage(img, 0, 0);
      image.onload = null;
      image.onerror = null;
      imagePool.push(image);
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
    this.#canvas.width = 0;
    this.#canvas.height = 0;
    this.#canvas = null;
  }

  isMounted() {
    return !!this.#canvas;
  }

  isMounting() {
    return !!this.#mountPromise;
  }

  async loadImage(
    image: HTMLImageElement,
    url: string,
  ): Promise<HTMLImageElement> {
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
const preMountCount = 2; // 预加载个数

for (let i = 0; i < count; i++) {
  graphs.push(new Graph());
}

async function play(
  canvas: HTMLCanvasElement,
  url: string,
  { onProgress }: { onProgress: (arg0: number) => void },
) {
  isPlaying = true;
  let curTime = 0;
  const graphDuration = 100; // ms
  const allDuration = graphDuration * count; // ms
  const calcIndex = () => {
    return Math.floor(curTime / graphDuration);
  };

  await graphs[0].mount(url);

  let oldTimestamp = 0;
  let oldGraph = null;
  const _play = async (timestamp: number) => {
    if (!isPlaying || curTime > allDuration) {
      return;
    }

    if (oldTimestamp) {
      curTime += timestamp - oldTimestamp;
    }
    oldTimestamp = timestamp;

    const index = calcIndex();
    const curGraph = graphs[index] || graphs[graphs.length - 1];
    await curGraph.mount(url);

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
        preGraph.mount(url);
      }
    }

    onProgress && onProgress(clamp(curTime / allDuration, 0, 1));
    requestAnimationFrame(_play);
  };

  requestAnimationFrame(_play);
}

async function stop() {
  isPlaying = false;
  await Promise.all(graphs.map(graph => graph.unmount()));
}

export { play, stop };
