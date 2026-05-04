// Frame-persistence: instead of clearing the display canvas, paint a low-alpha
// black rect over the previous frame. trailLength=0 → fully clear, =1 → never
// clear (blown-out trails). Capped to stay readable.
export function applyTrails(ctx: CanvasRenderingContext2D, w: number, h: number, trailLength: number) {
  const fade = 1 - Math.min(0.97, trailLength * 0.97);
  ctx.fillStyle = `rgba(0, 0, 0, ${fade})`;
  ctx.fillRect(0, 0, w, h);
}
