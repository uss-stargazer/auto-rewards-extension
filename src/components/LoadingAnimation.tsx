import React from "react";
import { useEffect, useState } from "react";

function LoadingAnimation() {
  const [nDots, setNDots] = useState<number>(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const newNDots = nDots + 1;
      setNDots(newNDots > 3 ? 0 : newNDots);
    }, 500);
    return () => clearInterval(interval);
  });

  return <p>Loading{".".repeat(nDots)}</p>;
}

export default LoadingAnimation;
