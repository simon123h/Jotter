/**
 * Balanced fireworks celebration particle effect for rewarding task completion.
 * Clean, round glowing sparks with natural parabolic ballistic physics.
 * Hardware-accelerated with Web Animations API, zero external dependencies.
 */
export function triggerDoneParticleBurst(x: number, y: number): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = `${x}px`;
  container.style.top = `${y}px`;
  container.style.pointerEvents = 'none';
  container.style.zIndex = '99999';
  container.style.width = '0px';
  container.style.height = '0px';
  document.body.appendChild(container);

  // Palette: Vibrant emeralds, luminous mints, bright lime, and gold sparkle tips
  const greenPalette = ['#10b981', '#34d399', '#059669', '#6ee7b7', '#a7f3d0', '#86efac', '#4ade80', '#fef08a'];
  const sparkCount = 14; // Balanced count: full radial coverage without clutter

  // Physics constants
  const gravity = 105; // px/s^2 balanced downward acceleration

  for (let i = 0; i < sparkCount; i++) {
    const spark = document.createElement('div');
    const color = greenPalette[i % greenPalette.length];
    const size = 2.5 + Math.random() * 1.8; // Balanced size (2.5 - 4.3px)

    spark.style.position = 'absolute';
    spark.style.width = `${size}px`;
    spark.style.height = `${size}px`;
    spark.style.borderRadius = '50%';
    spark.style.backgroundColor = color;
    spark.style.boxShadow = `0 0 4px ${color}, 0 0 7px ${color}60`;
    spark.style.left = `-${size / 2}px`;
    spark.style.top = `-${size / 2}px`;
    spark.style.willChange = 'transform, opacity';

    container.appendChild(spark);

    // Initial velocity vector: 360° spread with natural variation
    const angle = (i / sparkCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
    const speed = 28 + Math.random() * 22; // Balanced velocity (px/s)
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed - 12; // Natural upward burst impulse

    const durationMs = 560 + Math.random() * 120;
    const durationSec = durationMs / 1000;

    // Generate accurate parabolic trajectory keyframes: x(t) = vx*t, y(t) = vy*t + 0.5*g*t^2
    const steps = 8;
    const keyframes: Keyframe[] = [];

    for (let s = 0; s <= steps; s++) {
      const progress = s / steps;
      const t = progress * durationSec;

      // Air resistance damping factor
      const drag = 1 - 0.22 * progress;
      const posX = vx * t * drag;
      const posY = vy * t * drag + 0.5 * gravity * t * t;

      // Scale & opacity curves
      const scale = progress < 0.2 ? 0.7 + progress * 2.2 : Math.max(0.1, 1.1 * (1 - progress * 0.88));
      const opacity = progress < 0.65 ? 1 : Math.max(0, 1 - (progress - 0.65) / 0.35);

      keyframes.push({
        transform: `translate(${posX.toFixed(2)}px, ${posY.toFixed(2)}px) scale(${scale.toFixed(2)})`,
        opacity: Number(opacity.toFixed(2)),
        offset: progress,
      });
    }

    if (typeof spark.animate === 'function') {
      spark.animate(keyframes, {
        duration: durationMs,
        easing: 'linear',
        fill: 'forwards',
      });
    }
  }

  // Automatic DOM cleanup
  setTimeout(() => {
    container.remove();
  }, 750);
}
