import { useRef, useState } from "react";
import { play, stop } from "./store";
import pic from "/image/pic.jpg?url";
import picSmall from "/image/pic-small.jpg?url";

function App() {
  const [image, setImage] = useState<string>("small-image");
  const [type, setType] = useState<string>("main-thread");
  const [preload, setPreload] = useState<number>(2);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handlePlay = () => {
    play(canvasRef.current, image === "big-image" ? pic : picSmall, {
      onProgress: (value: number) => {
        const nextProgress = value * 100;
        setProgress(nextProgress);
        if (nextProgress >= 100) {
          setProgress(0);
          setIsPlaying(false);
        }
      },
      preloadCount: preload,
    }).then(() => {
      setIsPlaying(true);
    });
  };
  const handleStop = () => {
    stop().then(() => {
      setIsPlaying(false);
      setProgress(0);
    });
  };

  return (
    <div className="w-screen h-screen bg-base-100 text-center flex flex-col items-center justify-center">
      <div className="indicator">
        {isPlaying && (
          <span className="indicator-item badge badge-primary">playing</span>
        )}
        <h1 className="text-6xl font-bold font-mono">Canvas Render</h1>
      </div>
      <div className="my-6 flex">
        <select
          value={image}
          className="select max-w-xs mx-4"
          onChange={event => setImage(event.target.value as unknown as string)}
        >
          <option value="big-image">Big Image(8.8MB)</option>
          <option value="small-image">Small Image(17.9KB)</option>
        </select>
        <select
          value={type}
          className="select max-w-xs mx-4"
          onChange={event => setType(event.target.value as unknown as string)}
        >
          <option value="main-thread">Main Thread</option>
          <option value="worker-thread">Worker Thread</option>
        </select>
        <select
          value={preload}
          className="select max-w-xs mx-4"
          onChange={event =>
            setPreload(event.target.value as unknown as number)
          }
        >
          <option value={0}>Preload: 0</option>
          <option value={2}>Preload: 2</option>
          <option value={4}>Preload: 4</option>
        </select>
      </div>
      <div className="p-4 bg-gray-200 mb-6 mockup-window border border-base-300">
        <canvas
          ref={canvasRef}
          width={912}
          height={512}
          className="bg-white w-{912} h-{512}"
        />
      </div>
      <div className="flex items-center content-center">
        {isPlaying ? (
          <button onClick={handleStop} className="btn btn-neutral">
            Stop
          </button>
        ) : (
          <button onClick={handlePlay} className="btn btn-neutral">
            Play
          </button>
        )}
        <progress
          className="progress w-96 ml-8"
          value={progress}
          max="100"
        ></progress>
      </div>
    </div>
  );
}

export default App;
