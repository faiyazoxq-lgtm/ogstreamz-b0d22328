import { useEffect, useRef } from "react";

type Props = {
  kind: string;
  accent: string;
  secondary: string;
  className?: string;
};

/**
 * Demon/TV mascot whose "screen content" adapts to the portal kind:
 *   - music  -> animated frequency bars / oscilloscope
 *   - tool   -> sweeping scanline + counter
 *   - joke   -> static + grinning skull glyph
 */
export function PortalMascot({ kind, accent, secondary, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    let raf = 0;
    let t = 0;

    const drawMusic = () => {
      ctx.clearRect(0, 0, W, H);
      const bars = 14;
      const bw = W / bars;
      for (let i = 0; i < bars; i++) {
        const h = (Math.sin(t * 0.18 + i * 0.6) * 0.4 + 0.5) * H * 0.85;
        const grd = ctx.createLinearGradient(0, H, 0, H - h);
        grd.addColorStop(0, accent);
        grd.addColorStop(1, secondary);
        ctx.fillStyle = grd;
        ctx.fillRect(i * bw + 1, H - h, bw - 2, h);
      }
    };

    const drawTool = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      // sweep
      const y = (t * 1.4) % H;
      const grd = ctx.createLinearGradient(0, y - 8, 0, y + 8);
      grd.addColorStop(0, "transparent");
      grd.addColorStop(0.5, accent);
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.fillRect(0, y - 8, W, 16);
      ctx.fillStyle = secondary;
      ctx.font = "bold 10px monospace";
      ctx.fillText("FN", 4, 12);
    };

    const drawJoke = () => {
      // static
      const img = ctx.createImageData(W, H);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = v * 0.4;
        img.data[i + 1] = v * 0.1;
        img.data[i + 2] = v * 0.5;
        img.data[i + 3] = 90;
      }
      ctx.putImageData(img, 0, 0);
      // overlay
      ctx.fillStyle = `${accent}cc`;
      ctx.font = "bold 28px serif";
      ctx.textAlign = "center";
      const wob = Math.sin(t * 0.2) * 2;
      ctx.fillText("☠", W / 2, H / 2 + 10 + wob);
    };

    const loop = () => {
      t++;
      if (kind === "music") drawMusic();
      else if (kind === "tool") drawTool();
      else drawJoke();
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [kind, accent, secondary]);

  return (
    <div
      className={className}
      style={{
        position: "relative",
        borderRadius: 6,
        overflow: "hidden",
        border: `2px solid ${accent}`,
        boxShadow: `0 0 18px ${accent}99, inset 0 0 8px ${secondary}55`,
        background: "#0a0a0a",
      }}
    >
      <canvas ref={canvasRef} width={56} height={42} style={{ display: "block", width: "100%", height: "100%" }} />
      {/* scanlines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.25) 0 1px, transparent 1px 3px)",
          pointerEvents: "none",
          mixBlendMode: "multiply",
        }}
      />
    </div>
  );
}