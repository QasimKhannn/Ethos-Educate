import type { Transition, Variants } from 'framer-motion';

export const motionEase: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const marketplaceMotionEase: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const motionSpring: Transition = {
  type: 'spring',
  stiffness: 280,
  damping: 28,
  mass: 0.85,
};

export const pageRevealVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 18,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.42,
      ease: motionEase,
    },
  },
};

export const sectionStaggerVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.04,
    },
  },
};

export const cardRevealVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 14,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.34,
      ease: motionEase,
    },
  },
};

export const softRevealVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 10,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: motionEase,
    },
  },
};

export const marketplaceHeroShellVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 6,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.24,
      ease: marketplaceMotionEase,
      when: 'beforeChildren',
      staggerChildren: 0.035,
      delayChildren: 0.015,
    },
  },
};

export const marketplaceHeroItemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 5,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.18,
      ease: marketplaceMotionEase,
    },
  },
};

export const marketplaceSurfaceRevealVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 6,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.24,
      ease: marketplaceMotionEase,
    },
  },
};

export const marketplaceCardStackVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.028,
      delayChildren: 0.02,
    },
  },
};

export const marketplaceCardRevealVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 8,
    scale: 0.996,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.26,
      ease: marketplaceMotionEase,
    },
  },
};
