import { useCallback, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { useReducedMotion } from 'framer-motion';

type ChatBackgroundLightsMode = 'chat' | 'marketplace';

const chatLightAnimations = [
  { x: 210, y: 84, scale: 1.2, rotation: 10, duration: 7.5 },
  { x: -184, y: 118, scale: 1.14, rotation: -12, duration: 9 },
  { x: 138, y: -128, scale: 1.24, rotation: 14, duration: 10.5 },
  { x: -96, y: -78, scale: 1.18, rotation: -8, duration: 8.2 },
];

const marketplaceLightAnimations = [
  { x: 86, y: 34, scale: 1.08, rotation: 4, duration: 15.5 },
  { x: -74, y: 46, scale: 1.06, rotation: -5, duration: 17.5 },
  { x: 58, y: -54, scale: 1.1, rotation: 6, duration: 19.2 },
  { x: -42, y: -36, scale: 1.05, rotation: -4, duration: 16.8 },
];

const lightClassNames = [
  'chat-background-light-primary',
  'chat-background-light-secondary',
  'chat-background-light-tertiary',
  'chat-background-light-accent',
];

export default function ChatBackgroundLights({
  mode = 'chat',
}: {
  mode?: ChatBackgroundLightsMode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const lightRefs = useRef<(HTMLDivElement | null)[]>([]);
  const shouldReduceMotion = useReducedMotion();
  const setLightRef = useCallback(
    (index: number) => (node: HTMLDivElement | null) => {
      lightRefs.current[index] = node;
    },
    [],
  );

  useEffect(() => {
    const root = rootRef.current;
    const lights = lightRefs.current.filter((light): light is HTMLDivElement => light != null);
    const lightAnimations =
      mode === 'marketplace' ? marketplaceLightAnimations : chatLightAnimations;

    if (!root || lights.length === 0 || shouldReduceMotion) {
      return;
    }

    const context = gsap.context(() => {
      lights.forEach((light, index) => {
        const animation = lightAnimations[index % lightAnimations.length];
        gsap.set(light, {
          x: 0,
          y: 0,
          scale: 1,
          rotation: 0,
          transformOrigin: '50% 50%',
          force3D: true,
        });

        const timeline = gsap.timeline({
          repeat: -1,
        });

        timeline
          .to(light, {
            x: animation.x,
            y: animation.y,
            scale: animation.scale,
            rotation: animation.rotation,
            duration: animation.duration,
            ease: 'sine.inOut',
            force3D: true,
          })
          .to(light, {
            x: animation.x * -0.38,
            y: animation.y * 0.44,
            scale: mode === 'marketplace' ? 1.01 : 1.02,
            rotation: animation.rotation * -0.55,
            duration: animation.duration * (mode === 'marketplace' ? 0.82 : 0.74),
            ease: 'sine.inOut',
            force3D: true,
          })
          .to(light, {
            x: 0,
            y: 0,
            scale: 1,
            rotation: 0,
            duration: animation.duration * 0.62,
            ease: 'sine.inOut',
            force3D: true,
          });

        timeline.progress((index * 0.21) % 1);
      });
    }, root);

    return () => context.revert();
  }, [mode, shouldReduceMotion]);

  useEffect(() => {
    const root = rootRef.current;
    const finePointerQuery = window.matchMedia('(pointer: fine)');
    let animationFrameId = 0;
    let nextX = 50;
    let nextY = 50;

    if (!root || mode !== 'chat' || shouldReduceMotion || !finePointerQuery.matches) {
      return;
    }

    const updateGlowPosition = () => {
      root.style.setProperty('--chat-mouse-x', `${nextX}%`);
      root.style.setProperty('--chat-mouse-y', `${nextY}%`);
      animationFrameId = 0;
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect();

      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }

      nextX = Math.min(Math.max(((event.clientX - rect.left) / rect.width) * 100, 0), 100);
      nextY = Math.min(Math.max(((event.clientY - rect.top) / rect.height) * 100, 0), 100);

      if (animationFrameId === 0) {
        animationFrameId = window.requestAnimationFrame(updateGlowPosition);
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [mode, shouldReduceMotion]);

  return (
    <div
      ref={rootRef}
      className={`chat-background-lights ${mode === 'marketplace' ? 'chat-background-lights--marketplace' : ''}`}
      aria-hidden="true"
    >
      {mode === 'chat' && (
        <>
          <div className="chat-background-center-wash" />
          <div className="chat-background-mouse-glow" />
        </>
      )}
      {lightClassNames.map((className, index) => (
        <div
          ref={setLightRef(index)}
          className={`chat-background-light ${className}`}
          key={className}
        />
      ))}
    </div>
  );
}
