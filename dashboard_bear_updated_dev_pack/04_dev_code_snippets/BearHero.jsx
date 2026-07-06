import React, { useEffect, useState } from "react";
import "./bearHero.css";

// Put inside the hero section. Hero section should be position: relative; overflow: hidden;
export default function BearHero() {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollProgress(Math.min(1, (window.scrollY || 0) / 420));
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="bear-hero-layer"
      style={{
        opacity: 1 - scrollProgress,
        transform: `translateY(${scrollProgress * 32}px) scale(${1 - scrollProgress * 0.04})`
      }}
      aria-hidden="true"
    >
      <img
        className="bear-hero-sprite"
        src="/assets/bear/hero_bear_scene_with_fish_768.png"
        alt=""
        draggable="false"
      />
    </div>
  );
}
