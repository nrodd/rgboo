import { useEffect, useRef } from "react";
import Logo from "../../assets/rgboo-logo.svg?react";
import "./brandLogo.css";

export function BrandLogo() {
  const eyesRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const eyes = eyesRef.current!;
    const pupils = Array.from(eyes.querySelectorAll<SVGEllipseElement>("[data-logo-pupil]"));
    const sockets = Array.from(eyes.querySelectorAll<SVGPathElement>("[data-logo-socket]"));
    const neutral = sockets.map((socket, i) => {
      const bounds = socket.getBBox();
      return { x: bounds.x + bounds.width / 2 - pupils[i].cx.baseVal.value,
        y: bounds.y + bounds.height / 2 - pupils[i].cy.baseVal.value };
    });
    pupils.forEach((pupil, i) => pupil.setAttribute("transform", `translate(${neutral[i].x} ${neutral[i].y})`));
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const preferences = document.querySelector(".scene-player");
    const targets = pupils.map(() => ({ x: 0, y: 0 }));
    const current = pupils.map(() => ({ x: 0, y: 0 }));
    let frame = 0;
    let last = 0;
    const reduced = () => media.matches || preferences?.getAttribute("data-reduced-motion") === "true";
    const animate = (now: number) => {
      if (reduced()) { still(); return; }
      const amount = 1 - Math.exp(-Math.min((now - last) / 1000, .15) * 12);
      last = now;
      let moving = false;
      pupils.forEach((pupil, i) => {
        current[i].x += (targets[i].x - current[i].x) * amount;
        current[i].y += (targets[i].y - current[i].y) * amount;
        pupil.setAttribute("transform", `translate(${neutral[i].x + current[i].x} ${neutral[i].y + current[i].y})`);
        moving ||= Math.abs(targets[i].x - current[i].x) + Math.abs(targets[i].y - current[i].y) > .05;
      });
      frame = moving ? requestAnimationFrame(animate) : 0;
    };
    const start = () => { if (!frame) { last = performance.now(); frame = requestAnimationFrame(animate); } };
    const reset = () => { targets.forEach((target) => { target.x = target.y = 0; }); start(); };
    const still = () => {
      if (!reduced()) return;
      cancelAnimationFrame(frame); frame = 0;
      targets.forEach((target, i) => { target.x = target.y = current[i].x = current[i].y = 0; pupils[i].setAttribute("transform", `translate(${neutral[i].x} ${neutral[i].y})`); });
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch" || reduced() || document.hidden) return;
      sockets.forEach((socket, i) => {
        const bounds = socket.getBoundingClientRect();
        const dx = event.clientX - (bounds.left + bounds.width / 2);
        const dy = event.clientY - (bounds.top + bounds.height / 2);
        // Independent convergence lets the eyes cross when the pointer is nearby.
        const horizontal = dx / 75;
        const vertical = dy / 90;
        const limit = Math.max(1, Math.hypot(horizontal, vertical));
        targets[i].x = horizontal / limit * 19.15;
        targets[i].y = vertical / limit * 13.83;
      });
      start();
    };
    const leave = (event: PointerEvent) => { if (!event.relatedTarget) reset(); };
    const visibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else reset(); };
    const observer = new MutationObserver(still);
    if (preferences) observer.observe(preferences, { attributes: true, attributeFilter: ["data-reduced-motion"] });
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerout", leave);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", visibility);
    media.addEventListener("change", still);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerout", leave);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", visibility);
      media.removeEventListener("change", still);
    };
  }, []);
  return <div className="brand-logo" role="img" aria-label="RGBOO">
    <Logo ref={eyesRef} className="brand-logo-eyes" aria-hidden="true" />
  </div>;
}
