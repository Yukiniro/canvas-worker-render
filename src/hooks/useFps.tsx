import { useState, useEffect } from "react";

const useFps = (): number => {
  const [fps, setFps] = useState(0);

  useEffect(() => {
    let frameCount = 0;
    let startTime = performance.now();

    const updateFps = () => {
      frameCount++;

      const currentTime = performance.now();
      const elapsedTime = currentTime - startTime;

      if (elapsedTime >= 1000) {
        const newFps = Math.round((frameCount * 1000) / elapsedTime);
        setFps(newFps);

        frameCount = 0;
        startTime = currentTime;
      }

      requestAnimationFrame(updateFps);
    };

    const timer = requestAnimationFrame(updateFps);
    return () => {
      cancelAnimationFrame(timer);
    };
  }, []);

  return fps;
};

export default useFps;
