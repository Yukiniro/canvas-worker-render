import { useRef, useState } from "react";
import { play, stop } from "./store";
import pic from "/image/pic.jpg?url";

function App() {
  const [type, setType] = useState<"main-thread" | "worker-thread">(
    "main-thread",
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handlePlay = () => {
    play(canvasRef.current, pic, {
      onProgress: (value: number) => {
        const nextProgress = value * 100;
        setProgress(nextProgress);
        if (nextProgress >= 100) {
          setProgress(0);
          setIsPlaying(false);
        }
      },
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
      <label className="swap my-6">
        <input
          type="checkbox"
          checked={type === "main-thread"}
          onChange={() => {
            setType(type === "main-thread" ? "worker-thread" : "main-thread");
          }}
        />
        <div className="swap-on text-3xl">main-thread</div>
        <div className="swap-off text-3xl">worker-thread</div>
      </label>
      <div className="p-4 bg-gray-200 mb-6 mockup-window border border-base-300">
        <canvas ref={canvasRef} width={912} height={512} className="bg-white w-{912} h-{512}" />
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
