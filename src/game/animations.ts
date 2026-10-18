import { SkeletonPose, Point2D, AttackMove } from '../types/game';

// Standard neutral idle stance: Feet are planted firmly on ground line (y = 68)
export const IDLE_POSE: SkeletonPose = {
  head: { x: 0, y: -50 },
  chest: { x: 0, y: -22 },
  pelvis: { x: 0, y: 8 },
  leftShoulder: { x: -14, y: -22 },
  leftElbow: { x: -24, y: -8 },
  leftHand: { x: -18, y: -26 }, // guard up
  rightShoulder: { x: 14, y: -22 },
  rightElbow: { x: 24, y: -6 },
  rightHand: { x: 18, y: -20 }, // guard up
  leftHip: { x: -10, y: 8 },
  leftKnee: { x: -18, y: 38 },
  leftFoot: { x: -22, y: 68 }, // firmly planted on ground
  rightHip: { x: 10, y: 8 },
  rightKnee: { x: 18, y: 38 },
  rightFoot: { x: 24, y: 68 }, // firmly planted on ground
  scarf: [
    { x: -8, y: -48 },
    { x: -22, y: -44 },
    { x: -38, y: -38 },
    { x: -55, y: -32 },
  ],
};

// 24 distinct martial arts and cyber-combat attack poses
// Ground level is at y = 68
export const ATTACK_MOVES: AttackMove[] = [
  // 1. Quick Lead Jab (Tier 1 Basic)
  {
    id: 1,
    tier: 1,
    name: 'Quick Lead Jab',
    description: 'Crisp, snappy lead jab to test distance and rhythm',
    durationMs: 140,
    impactOffset: { x: 55, y: -24 },
    pose: {
      head: { x: 6, y: -48 },
      chest: { x: 8, y: -22 },
      pelvis: { x: 2, y: 8 },
      leftShoulder: { x: 18, y: -24 },
      leftElbow: { x: 38, y: -24 },
      leftHand: { x: 62, y: -24 }, // snappy lead jab
      rightShoulder: { x: -4, y: -22 },
      rightElbow: { x: -14, y: -10 },
      rightHand: { x: 6, y: -26 }, // guard tucked to chin
      leftHip: { x: 10, y: 8 },
      leftKnee: { x: 16, y: 38 },
      leftFoot: { x: 22, y: 68 }, // firmly planted
      rightHip: { x: -10, y: 8 },
      rightKnee: { x: -18, y: 38 },
      rightFoot: { x: -24, y: 68 }, // firmly planted
      scarf: [{ x: 2, y: -46 }, { x: -14, y: -42 }, { x: -30, y: -36 }, { x: -46, y: -30 }],
      bladeSlash: {
        start: { x: 20, y: -24 },
        end: { x: 66, y: -24 },
        curveOffset: 0,
        color: '#00f3ff',
      },
    },
  },

  // 2. Grounded Straight Cross (Tier 1 Basic)
  {
    id: 2,
    tier: 1,
    name: 'Straight Cross',
    description: 'Solid grounded rear power punch',
    durationMs: 155,
    impactOffset: { x: 68, y: -22 },
    pose: {
      head: { x: 12, y: -48 },
      chest: { x: 16, y: -20 },
      pelvis: { x: 6, y: 8 },
      leftShoulder: { x: -2, y: -22 },
      leftElbow: { x: -12, y: -8 },
      leftHand: { x: -4, y: -24 }, // left guard
      rightShoulder: { x: 28, y: -22 },
      rightElbow: { x: 50, y: -22 },
      rightHand: { x: 74, y: -22 }, // fully extended cross
      leftHip: { x: -6, y: 8 },
      leftKnee: { x: -24, y: 38 },
      leftFoot: { x: -32, y: 68 }, // planted
      rightHip: { x: 14, y: 8 },
      rightKnee: { x: 26, y: 40 },
      rightFoot: { x: 28, y: 68 }, // planted
      scarf: [{ x: 4, y: -46 }, { x: -12, y: -42 }, { x: -30, y: -36 }, { x: -48, y: -30 }],
      bladeSlash: {
        start: { x: 25, y: -22 },
        end: { x: 80, y: -22 },
        curveOffset: 0,
        color: '#00f3ff',
      },
    },
  },

  // 3. Low Shin Snap Kick (Tier 1 Basic)
  {
    id: 3,
    tier: 1,
    name: 'Low Shin Snap Kick',
    description: 'Swift, grounded snap kick targeting enemy stance',
    durationMs: 150,
    impactOffset: { x: 65, y: 48 },
    pose: {
      head: { x: -8, y: -48 },
      chest: { x: -4, y: -22 },
      pelvis: { x: 0, y: 8 },
      leftShoulder: { x: -14, y: -22 },
      leftElbow: { x: -24, y: -8 },
      leftHand: { x: -18, y: -26 },
      rightShoulder: { x: 12, y: -22 },
      rightElbow: { x: 20, y: -6 },
      rightHand: { x: 14, y: -20 },
      leftHip: { x: -8, y: 8 },
      leftKnee: { x: -14, y: 38 },
      leftFoot: { x: -18, y: 68 }, // solid base foot planted
      rightHip: { x: 10, y: 8 },
      rightKnee: { x: 34, y: 34 },
      rightFoot: { x: 68, y: 48 }, // low snap kick
      scarf: [{ x: -10, y: -46 }, { x: -26, y: -40 }, { x: -44, y: -34 }, { x: -60, y: -28 }],
      bladeSlash: {
        start: { x: 24, y: 30 },
        end: { x: 74, y: 50 },
        curveOffset: 4,
        color: '#38bdf8',
      },
    },
  },

  // 4. Lead Elbow Thrust (Tier 1 Basic)
  {
    id: 4,
    tier: 1,
    name: 'Lead Elbow Thrust',
    description: 'Compact, high-impact martial arts elbow strike',
    durationMs: 145,
    impactOffset: { x: 56, y: -20 },
    pose: {
      head: { x: 10, y: -46 },
      chest: { x: 14, y: -20 },
      pelvis: { x: 6, y: 8 },
      leftShoulder: { x: 4, y: -22 },
      leftElbow: { x: -8, y: -6 },
      leftHand: { x: -2, y: -22 },
      rightShoulder: { x: 26, y: -22 },
      rightElbow: { x: 60, y: -20 }, // leading with sharp elbow
      rightHand: { x: 38, y: -30 }, // tucked tightly to chest
      leftHip: { x: -4, y: 8 },
      leftKnee: { x: -22, y: 40 },
      leftFoot: { x: -30, y: 68 },
      rightHip: { x: 16, y: 8 },
      rightKnee: { x: 30, y: 40 },
      rightFoot: { x: 34, y: 68 },
      scarf: [{ x: 4, y: -44 }, { x: -14, y: -40 }, { x: -32, y: -34 }, { x: -50, y: -28 }],
      bladeSlash: {
        start: { x: 28, y: -20 },
        end: { x: 66, y: -20 },
        curveOffset: -6,
        color: '#00f3ff',
      },
    },
  },

  // 5. Palm Heel Strike (Tier 1 Basic)
  {
    id: 5,
    tier: 1,
    name: 'Palm Heel Strike',
    description: 'Direct open-palm kinetic thrust pushing through defense',
    durationMs: 150,
    impactOffset: { x: 66, y: -18 },
    pose: {
      head: { x: 8, y: -48 },
      chest: { x: 12, y: -22 },
      pelvis: { x: 4, y: 8 },
      leftShoulder: { x: -4, y: -24 },
      leftElbow: { x: -16, y: -10 },
      leftHand: { x: -10, y: -26 },
      rightShoulder: { x: 24, y: -22 },
      rightElbow: { x: 46, y: -20 },
      rightHand: { x: 70, y: -18 }, // open palm thrust
      leftHip: { x: -6, y: 8 },
      leftKnee: { x: -20, y: 38 },
      leftFoot: { x: -26, y: 68 },
      rightHip: { x: 14, y: 8 },
      rightKnee: { x: 28, y: 40 },
      rightFoot: { x: 30, y: 68 },
      scarf: [{ x: 2, y: -46 }, { x: -14, y: -42 }, { x: -32, y: -36 }, { x: -50, y: -30 }],
      bladeSlash: {
        start: { x: 26, y: -18 },
        end: { x: 75, y: -18 },
        curveOffset: 0,
        color: '#00f3ff',
      },
    },
  },

  // 6. Backflip Heel Kick
  {
    id: 6,
    tier: 1,
    name: 'Backflip Heel Kick',
    description: 'Acrobatic inverted flip heel strike',
    durationMs: 200,
    impactOffset: { x: 52, y: -52 },
    pose: {
      head: { x: -24, y: -12 },
      chest: { x: -14, y: -25 },
      pelvis: { x: 2, y: -32 },
      leftShoulder: { x: -24, y: -22 },
      leftElbow: { x: -34, y: -12 },
      leftHand: { x: -38, y: 2 },
      rightShoulder: { x: -4, y: -28 },
      rightElbow: { x: -14, y: -42 },
      rightHand: { x: -18, y: -55 },
      leftHip: { x: -6, y: -32 },
      leftKnee: { x: 12, y: -48 },
      leftFoot: { x: 28, y: -60 },
      rightHip: { x: 10, y: -32 },
      rightKnee: { x: 34, y: -45 },
      rightFoot: { x: 65, y: -55 },
      scarf: [{ x: -32, y: -8 }, { x: -45, y: 6 }, { x: -55, y: 22 }, { x: -62, y: 40 }],
      bladeSlash: {
        start: { x: 8, y: 15 },
        end: { x: 72, y: -62 },
        curveOffset: -32,
        color: '#00f3ff',
      },
    },
  },

  // 7. Spinning Hook Kick
  {
    id: 7,
    tier: 2,
    name: 'Spinning Hook Kick',
    description: '360 torso rotation hooking the opponent neck',
    durationMs: 180,
    impactOffset: { x: 72, y: -32 },
    pose: {
      head: { x: 4, y: -44 },
      chest: { x: -4, y: -18 },
      pelvis: { x: 2, y: 4 },
      leftShoulder: { x: -14, y: -18 },
      leftElbow: { x: -24, y: -6 },
      leftHand: { x: -18, y: 10 },
      rightShoulder: { x: 6, y: -20 },
      rightElbow: { x: 20, y: -28 },
      rightHand: { x: 16, y: -40 },
      leftHip: { x: -8, y: 4 },
      leftKnee: { x: -12, y: 38 },
      leftFoot: { x: -14, y: 68 }, // plant foot
      rightHip: { x: 12, y: 4 },
      rightKnee: { x: 42, y: -12 },
      rightFoot: { x: 80, y: -30 }, // hook heel
      scarf: [{ x: -5, y: -42 }, { x: -25, y: -42 }, { x: -48, y: -38 }, { x: -70, y: -30 }],
      bladeSlash: {
        start: { x: 88, y: -8 },
        end: { x: 58, y: -42 },
        curveOffset: 26,
        color: '#ffe600',
      },
    },
  },

  // 8. Flash Blade Dash
  {
    id: 8,
    tier: 2,
    name: 'Flash Blade Dash',
    description: 'Instant forward dash with dual energy blades',
    durationMs: 170,
    impactOffset: { x: 82, y: -12 },
    pose: {
      head: { x: 38, y: -32 },
      chest: { x: 30, y: -12 },
      pelvis: { x: 14, y: 12 },
      leftShoulder: { x: 18, y: -15 },
      leftElbow: { x: -8, y: -20 },
      leftHand: { x: -30, y: -22 },
      rightShoulder: { x: 40, y: -14 },
      rightElbow: { x: 65, y: -16 },
      rightHand: { x: 92, y: -18 },
      leftHip: { x: 4, y: 12 },
      leftKnee: { x: -25, y: 36 },
      leftFoot: { x: -48, y: 62 },
      rightHip: { x: 20, y: 12 },
      rightKnee: { x: 46, y: 38 },
      rightFoot: { x: 60, y: 68 },
      scarf: [{ x: 28, y: -30 }, { x: 5, y: -30 }, { x: -22, y: -30 }, { x: -50, y: -30 }],
      bladeSlash: {
        start: { x: -28, y: -22 },
        end: { x: 98, y: -18 },
        curveOffset: 0,
        color: '#ff007f',
      },
    },
  },

  // 9. Cyber Elbow Smash
  {
    id: 9,
    tier: 2,
    name: 'Cyber Elbow Smash',
    description: 'Close-quarters bone-shattering elbow drive',
    durationMs: 160,
    impactOffset: { x: 58, y: -24 },
    pose: {
      head: { x: 20, y: -46 },
      chest: { x: 24, y: -20 },
      pelvis: { x: 12, y: 8 },
      leftShoulder: { x: 10, y: -20 },
      leftElbow: { x: 0, y: -8 },
      leftHand: { x: 8, y: -22 },
      rightShoulder: { x: 34, y: -20 },
      rightElbow: { x: 62, y: -24 }, // point of elbow
      rightHand: { x: 38, y: -30 },
      leftHip: { x: 2, y: 8 },
      leftKnee: { x: -20, y: 40 },
      leftFoot: { x: -30, y: 68 },
      rightHip: { x: 20, y: 8 },
      rightKnee: { x: 38, y: 40 },
      rightFoot: { x: 42, y: 68 },
      scarf: [{ x: 10, y: -44 }, { x: -10, y: -40 }, { x: -32, y: -34 }, { x: -54, y: -26 }],
      bladeSlash: {
        start: { x: 38, y: -4 },
        end: { x: 68, y: -32 },
        curveOffset: -16,
        color: '#00f3ff',
      },
    },
  },

  // 10. Low Sweeping Shin Cutter
  {
    id: 10,
    tier: 2,
    name: 'Sweeping Shin Cutter',
    description: 'Crouched leg sweep cutting the floor grid',
    durationMs: 180,
    impactOffset: { x: 68, y: 52 },
    pose: {
      head: { x: -4, y: -12 },
      chest: { x: 2, y: 8 },
      pelvis: { x: -4, y: 30 },
      leftShoulder: { x: -14, y: 8 },
      leftElbow: { x: -26, y: 24 },
      leftHand: { x: -28, y: 52 }, // hand on floor
      rightShoulder: { x: 12, y: 8 },
      rightElbow: { x: 18, y: -8 },
      rightHand: { x: 8, y: -20 },
      leftHip: { x: -10, y: 30 },
      leftKnee: { x: -18, y: 50 },
      leftFoot: { x: -12, y: 68 },
      rightHip: { x: 6, y: 30 },
      rightKnee: { x: 40, y: 46 },
      rightFoot: { x: 78, y: 60 }, // low sweep along ground
      scarf: [{ x: -12, y: -10 }, { x: -28, y: -6 }, { x: -46, y: 2 }, { x: -62, y: 12 }],
      bladeSlash: {
        start: { x: 12, y: 64 },
        end: { x: 84, y: 58 },
        curveOffset: -10,
        color: '#00f3ff',
      },
    },
  },

  // 11. 360 Scythe Spin Kick
  {
    id: 11,
    tier: 2,
    name: '360 Scythe Kick',
    description: 'High velocity circular vortex blade kick',
    durationMs: 190,
    impactOffset: { x: 74, y: -28 },
    pose: {
      head: { x: -8, y: -42 },
      chest: { x: 0, y: -18 },
      pelvis: { x: 2, y: 2 },
      leftShoulder: { x: -12, y: -20 },
      leftElbow: { x: -26, y: -28 },
      leftHand: { x: -36, y: -20 },
      rightShoulder: { x: 14, y: -20 },
      rightElbow: { x: 28, y: -10 },
      rightHand: { x: 38, y: 4 },
      leftHip: { x: -8, y: 2 },
      leftKnee: { x: -12, y: 38 },
      leftFoot: { x: -10, y: 68 },
      rightHip: { x: 12, y: 2 },
      rightKnee: { x: 45, y: -8 },
      rightFoot: { x: 82, y: -26 },
      scarf: [{ x: -18, y: -40 }, { x: -38, y: -34 }, { x: -58, y: -26 }, { x: -75, y: -16 }],
      bladeSlash: {
        start: { x: 18, y: -58 },
        end: { x: 88, y: -22 },
        curveOffset: 36,
        color: '#ff007f',
      },
    },
  },

  // 12. Sledgehammer Crash
  {
    id: 12,
    tier: 2,
    name: 'Sledgehammer Crash',
    description: 'Clenched double-fist crushing descent',
    durationMs: 180,
    impactOffset: { x: 52, y: 2 },
    pose: {
      head: { x: 14, y: -44 },
      chest: { x: 20, y: -18 },
      pelvis: { x: 12, y: 8 },
      leftShoulder: { x: 12, y: -24 },
      leftElbow: { x: 32, y: -24 },
      leftHand: { x: 55, y: 0 },
      rightShoulder: { x: 26, y: -18 },
      rightElbow: { x: 40, y: -20 },
      rightHand: { x: 55, y: 0 },
      leftHip: { x: 0, y: 8 },
      leftKnee: { x: -20, y: 40 },
      leftFoot: { x: -28, y: 68 },
      rightHip: { x: 20, y: 8 },
      rightKnee: { x: 34, y: 40 },
      rightFoot: { x: 36, y: 68 },
      scarf: [{ x: 4, y: -42 }, { x: -16, y: -38 }, { x: -38, y: -30 }, { x: -58, y: -20 }],
      bladeSlash: {
        start: { x: 42, y: -58 },
        end: { x: 62, y: 18 },
        curveOffset: 12,
        color: '#ffe600',
      },
    },
  },

  // 13. Crane Needle Strike
  {
    id: 13,
    tier: 3,
    name: 'Crane Needle Strike',
    description: 'One-legged balance with pinpoint throat thrust',
    durationMs: 170,
    impactOffset: { x: 75, y: -38 },
    pose: {
      head: { x: 6, y: -52 },
      chest: { x: 4, y: -28 },
      pelvis: { x: 0, y: 0 },
      leftShoulder: { x: -10, y: -30 },
      leftElbow: { x: -28, y: -38 },
      leftHand: { x: -42, y: -42 },
      rightShoulder: { x: 16, y: -30 },
      rightElbow: { x: 45, y: -34 },
      rightHand: { x: 78, y: -38 }, // beak thrust
      leftHip: { x: -6, y: 0 },
      leftKnee: { x: -8, y: 35 },
      leftFoot: { x: -6, y: 68 }, // solid grounded crane leg
      rightHip: { x: 8, y: 0 },
      rightKnee: { x: 22, y: -12 }, // tucked knee
      rightFoot: { x: 14, y: 14 },
      scarf: [{ x: -4, y: -50 }, { x: -22, y: -48 }, { x: -42, y: -45 }, { x: -62, y: -40 }],
      bladeSlash: {
        start: { x: 32, y: -36 },
        end: { x: 85, y: -38 },
        curveOffset: 0,
        color: '#00f3ff',
      },
    },
  },

  // 14. High Knee Smash
  {
    id: 14,
    tier: 3,
    name: 'High Knee Smash',
    description: 'Explosive vertical knee collision',
    durationMs: 170,
    impactOffset: { x: 50, y: -22 },
    pose: {
      head: { x: 12, y: -48 },
      chest: { x: 10, y: -22 },
      pelvis: { x: 2, y: 6 },
      leftShoulder: { x: -4, y: -24 },
      leftElbow: { x: 14, y: -16 },
      leftHand: { x: 28, y: -32 },
      rightShoulder: { x: 20, y: -20 },
      rightElbow: { x: 30, y: -14 },
      rightHand: { x: 34, y: -30 },
      leftHip: { x: -6, y: 6 },
      leftKnee: { x: -14, y: 38 },
      leftFoot: { x: -12, y: 68 }, // firmly planted
      rightHip: { x: 12, y: 6 },
      rightKnee: { x: 50, y: -20 }, // rising knee
      rightFoot: { x: 32, y: 18 },
      scarf: [{ x: 2, y: -46 }, { x: -16, y: -42 }, { x: -36, y: -36 }, { x: -55, y: -28 }],
      bladeSlash: {
        start: { x: 22, y: 28 },
        end: { x: 58, y: -30 },
        curveOffset: -18,
        color: '#ff007f',
      },
    },
  },

  // 15. Somersault Dropcleave
  {
    id: 15,
    tier: 3,
    name: 'Somersault Dropcleave',
    description: 'Forward rolling aerial hammer kick',
    durationMs: 200,
    impactOffset: { x: 62, y: 12 },
    pose: {
      head: { x: 22, y: 22 },
      chest: { x: 12, y: -4 },
      pelvis: { x: -4, y: -22 },
      leftShoulder: { x: 6, y: 0 },
      leftElbow: { x: -14, y: 14 },
      leftHand: { x: -26, y: 28 },
      rightShoulder: { x: 20, y: -8 },
      rightElbow: { x: 28, y: -26 },
      rightHand: { x: 18, y: -38 },
      leftHip: { x: -10, y: -22 },
      leftKnee: { x: -18, y: -42 },
      leftFoot: { x: -10, y: -62 },
      rightHip: { x: 4, y: -22 },
      rightKnee: { x: 35, y: -10 },
      rightFoot: { x: 68, y: 14 }, // axe strike
      scarf: [{ x: 12, y: 25 }, { x: -6, y: 20 }, { x: -24, y: 10 }, { x: -40, y: -5 }],
      bladeSlash: {
        start: { x: -8, y: -58 },
        end: { x: 72, y: 28 },
        curveOffset: 46,
        color: '#ffe600',
      },
    },
  },

  // 16. Superman Rocket Punch
  {
    id: 16,
    tier: 3,
    name: 'Superman Rocket Punch',
    description: 'Horizontal lunging airborne heavy fist',
    durationMs: 180,
    impactOffset: { x: 82, y: -26 },
    pose: {
      head: { x: 26, y: -36 },
      chest: { x: 16, y: -18 },
      pelvis: { x: -4, y: -4 },
      leftShoulder: { x: 6, y: -20 },
      leftElbow: { x: -14, y: -10 },
      leftHand: { x: -24, y: -2 },
      rightShoulder: { x: 30, y: -18 },
      rightElbow: { x: 58, y: -22 },
      rightHand: { x: 88, y: -26 },
      leftHip: { x: -10, y: -4 },
      leftKnee: { x: -36, y: 12 },
      leftFoot: { x: -62, y: 22 },
      rightHip: { x: 2, y: -4 },
      rightKnee: { x: -12, y: 18 },
      rightFoot: { x: -32, y: 32 },
      scarf: [{ x: 16, y: -34 }, { x: -8, y: -34 }, { x: -35, y: -34 }, { x: -65, y: -34 }],
      bladeSlash: {
        start: { x: 22, y: -22 },
        end: { x: 95, y: -26 },
        curveOffset: 0,
        color: '#00f3ff',
      },
    },
  },

  // 17. Vaulting Dual Dropkick
  {
    id: 17,
    tier: 3,
    name: 'Vaulting Dual Dropkick',
    description: 'Two-legged airborne horizontal rocket kick',
    durationMs: 200,
    impactOffset: { x: 82, y: -12 },
    pose: {
      head: { x: -26, y: -2 },
      chest: { x: -8, y: -8 },
      pelvis: { x: 12, y: -10 },
      leftShoulder: { x: -16, y: -10 },
      leftElbow: { x: -32, y: 4 },
      leftHand: { x: -42, y: 20 },
      rightShoulder: { x: 0, y: -10 },
      rightElbow: { x: -10, y: -26 },
      rightHand: { x: -22, y: -32 },
      leftHip: { x: 6, y: -10 },
      leftKnee: { x: 45, y: -16 },
      leftFoot: { x: 80, y: -18 },
      rightHip: { x: 16, y: -10 },
      rightKnee: { x: 48, y: -8 },
      rightFoot: { x: 85, y: -10 },
      scarf: [{ x: -34, y: 0 }, { x: -52, y: 6 }, { x: -70, y: 12 }, { x: -86, y: 18 }],
      bladeSlash: {
        start: { x: 22, y: -12 },
        end: { x: 92, y: -14 },
        curveOffset: 5,
        color: '#ff007f',
      },
    },
  },

  // 18. Sonic Wave Thrust
  {
    id: 18,
    tier: 3,
    name: 'Sonic Wave Thrust',
    description: 'Vibrating resonance blade decapitation thrust',
    durationMs: 170,
    impactOffset: { x: 76, y: -28 },
    pose: {
      head: { x: 14, y: -48 },
      chest: { x: 16, y: -20 },
      pelvis: { x: 6, y: 6 },
      leftShoulder: { x: 2, y: -22 },
      leftElbow: { x: 20, y: -26 },
      leftHand: { x: 40, y: -28 },
      rightShoulder: { x: 26, y: -20 },
      rightElbow: { x: 54, y: -26 },
      rightHand: { x: 80, y: -28 },
      leftHip: { x: -4, y: 6 },
      leftKnee: { x: -24, y: 38 },
      leftFoot: { x: -34, y: 68 },
      rightHip: { x: 16, y: 6 },
      rightKnee: { x: 34, y: 40 },
      rightFoot: { x: 38, y: 68 },
      scarf: [{ x: 6, y: -46 }, { x: -14, y: -44 }, { x: -35, y: -40 }, { x: -58, y: -34 }],
      bladeSlash: {
        start: { x: 32, y: -28 },
        end: { x: 90, y: -28 },
        curveOffset: -12,
        color: '#00f3ff',
      },
    },
  },

  // 19. Reverse Dragon Whip
  {
    id: 19,
    tier: 4,
    name: 'Reverse Dragon Whip',
    description: 'Reverse spinning hook catching overhead guard',
    durationMs: 180,
    impactOffset: { x: 70, y: -44 },
    pose: {
      head: { x: -12, y: -36 },
      chest: { x: -6, y: -14 },
      pelvis: { x: 2, y: 6 },
      leftShoulder: { x: -14, y: -14 },
      leftElbow: { x: -26, y: 2 },
      leftHand: { x: -30, y: 18 },
      rightShoulder: { x: 6, y: -16 },
      rightElbow: { x: 14, y: -30 },
      rightHand: { x: 2, y: -42 },
      leftHip: { x: -6, y: 6 },
      leftKnee: { x: -10, y: 38 },
      leftFoot: { x: -10, y: 68 },
      rightHip: { x: 10, y: 6 },
      rightKnee: { x: 40, y: -22 },
      rightFoot: { x: 74, y: -46 },
      scarf: [{ x: -20, y: -34 }, { x: -38, y: -28 }, { x: -55, y: -20 }, { x: -70, y: -10 }],
      bladeSlash: {
        start: { x: 82, y: -12 },
        end: { x: 48, y: -52 },
        curveOffset: -30,
        color: '#ffe600',
      },
    },
  },

  // 20. Tornado Whirlwind
  {
    id: 20,
    tier: 4,
    name: 'Tornado Whirlwind',
    description: '360 vertical rise cyclone kick',
    durationMs: 190,
    impactOffset: { x: 64, y: -38 },
    pose: {
      head: { x: 0, y: -60 },
      chest: { x: 2, y: -32 },
      pelvis: { x: 4, y: -6 },
      leftShoulder: { x: -14, y: -32 },
      leftElbow: { x: -28, y: -42 },
      leftHand: { x: -18, y: -55 },
      rightShoulder: { x: 18, y: -32 },
      rightElbow: { x: 32, y: -20 },
      rightHand: { x: 26, y: -2 },
      leftHip: { x: -4, y: -6 },
      leftKnee: { x: -20, y: 14 },
      leftFoot: { x: -16, y: 38 },
      rightHip: { x: 12, y: -6 },
      rightKnee: { x: 40, y: -26 },
      rightFoot: { x: 70, y: -40 },
      scarf: [{ x: -8, y: -58 }, { x: -28, y: -48 }, { x: -46, y: -32 }, { x: -60, y: -14 }],
      bladeSlash: {
        start: { x: -22, y: -8 },
        end: { x: 78, y: -45 },
        curveOffset: 42,
        color: '#ff007f',
      },
    },
  },

  // 21. Aerial Spiral Smash
  {
    id: 21,
    tier: 4,
    name: 'Aerial Spiral Smash',
    description: 'Corkscrew dive smash from the rafters',
    durationMs: 190,
    impactOffset: { x: 58, y: -12 },
    pose: {
      head: { x: 20, y: -32 },
      chest: { x: 10, y: -18 },
      pelvis: { x: -6, y: -6 },
      leftShoulder: { x: 2, y: -20 },
      leftElbow: { x: -12, y: -32 },
      leftHand: { x: -22, y: -42 },
      rightShoulder: { x: 20, y: -16 },
      rightElbow: { x: 45, y: -16 },
      rightHand: { x: 65, y: -12 },
      leftHip: { x: -12, y: -6 },
      leftKnee: { x: -32, y: 0 },
      leftFoot: { x: -52, y: 8 },
      rightHip: { x: 0, y: -6 },
      rightKnee: { x: 20, y: 18 },
      rightFoot: { x: 38, y: 40 },
      scarf: [{ x: 12, y: -30 }, { x: -8, y: -26 }, { x: -28, y: -18 }, { x: -46, y: -8 }],
      bladeSlash: {
        start: { x: -8, y: -52 },
        end: { x: 70, y: -8 },
        curveOffset: -22,
        color: '#00f3ff',
      },
    },
  },

  // 22. Thunder God Palm (Tier 5 God-Tier)
  {
    id: 22,
    tier: 5,
    name: 'Thunder God Palm',
    description: 'Ground-rumbling focused static overload',
    durationMs: 170,
    impactOffset: { x: 64, y: -20 },
    pose: {
      head: { x: 16, y: -46 },
      chest: { x: 18, y: -20 },
      pelvis: { x: 8, y: 8 },
      leftShoulder: { x: 4, y: -22 },
      leftElbow: { x: -10, y: -6 },
      leftHand: { x: -6, y: -22 },
      rightShoulder: { x: 28, y: -20 },
      rightElbow: { x: 48, y: -20 },
      rightHand: { x: 72, y: -20 },
      leftHip: { x: -2, y: 8 },
      leftKnee: { x: -22, y: 40 },
      leftFoot: { x: -36, y: 68 },
      rightHip: { x: 18, y: 8 },
      rightKnee: { x: 34, y: 40 },
      rightFoot: { x: 38, y: 68 },
      scarf: [{ x: 8, y: -44 }, { x: -12, y: -42 }, { x: -32, y: -36 }, { x: -55, y: -28 }],
      bladeSlash: {
        start: { x: 64, y: -42 },
        end: { x: 75, y: 4 },
        curveOffset: 18,
        color: '#ffe600',
      },
    },
  },

  // 23. Flying Scissor Cleave (Tier 5 God-Tier)
  {
    id: 23,
    tier: 5,
    name: 'Flying Scissor Cleave',
    description: 'Mid-air leg clamp snapping enemy stance',
    durationMs: 190,
    impactOffset: { x: 72, y: -22 },
    pose: {
      head: { x: -14, y: -22 },
      chest: { x: -4, y: -18 },
      pelvis: { x: 12, y: -12 },
      leftShoulder: { x: -10, y: -18 },
      leftElbow: { x: -26, y: -8 },
      leftHand: { x: -32, y: 8 },
      rightShoulder: { x: 4, y: -20 },
      rightElbow: { x: 14, y: -32 },
      rightHand: { x: 2, y: -45 },
      leftHip: { x: 8, y: -12 },
      leftKnee: { x: 48, y: -38 },
      leftFoot: { x: 78, y: -42 },
      rightHip: { x: 16, y: -12 },
      rightKnee: { x: 48, y: 8 },
      rightFoot: { x: 75, y: 18 },
      scarf: [{ x: -22, y: -20 }, { x: -42, y: -16 }, { x: -60, y: -10 }, { x: -75, y: -2 }],
      bladeSlash: {
        start: { x: 68, y: -48 },
        end: { x: 68, y: 22 },
        curveOffset: -15,
        color: '#ff007f',
      },
    },
  },

  // 24. Omega Burst Finisher (Tier 5 God-Tier)
  {
    id: 24,
    tier: 5,
    name: 'Omega Burst Finisher',
    description: 'Cataclysmic dual neon energy detonation strike',
    durationMs: 220,
    impactOffset: { x: 78, y: -28 },
    pose: {
      head: { x: 16, y: -50 },
      chest: { x: 22, y: -22 },
      pelvis: { x: 10, y: 6 },
      leftShoulder: { x: 10, y: -26 },
      leftElbow: { x: 48, y: -32 },
      leftHand: { x: 78, y: -32 },
      rightShoulder: { x: 28, y: -20 },
      rightElbow: { x: 54, y: -18 },
      rightHand: { x: 82, y: -12 },
      leftHip: { x: -2, y: 6 },
      leftKnee: { x: -26, y: 38 },
      leftFoot: { x: -40, y: 68 },
      rightHip: { x: 20, y: 6 },
      rightKnee: { x: 40, y: 40 },
      rightFoot: { x: 46, y: 68 },
      scarf: [{ x: 8, y: -48 }, { x: -14, y: -44 }, { x: -36, y: -38 }, { x: -60, y: -30 }],
      bladeSlash: {
        start: { x: 32, y: -52 },
        end: { x: 88, y: 8 },
        curveOffset: 32,
        color: '#00f3ff',
      },
    },
  },
];

export function getOrientedPose(pose: SkeletonPose, direction: 'left' | 'right'): SkeletonPose {
  if (direction === 'right') return pose;

  const mirrorX = (pt: Point2D): Point2D => ({ x: -pt.x, y: pt.y });

  return {
    head: mirrorX(pose.head),
    chest: mirrorX(pose.chest),
    pelvis: mirrorX(pose.pelvis),
    leftShoulder: mirrorX(pose.rightShoulder),
    leftElbow: mirrorX(pose.rightElbow),
    leftHand: mirrorX(pose.rightHand),
    rightShoulder: mirrorX(pose.leftShoulder),
    rightElbow: mirrorX(pose.leftElbow),
    rightHand: mirrorX(pose.leftHand),
    leftHip: mirrorX(pose.rightHip),
    leftKnee: mirrorX(pose.rightKnee),
    leftFoot: mirrorX(pose.rightFoot),
    rightHip: mirrorX(pose.leftHip),
    rightKnee: mirrorX(pose.leftKnee),
    rightFoot: mirrorX(pose.leftFoot),
    scarf: pose.scarf ? pose.scarf.map(mirrorX) : undefined,
    prop: pose.prop,
    shot: pose.shot,
    bladeSlash: pose.bladeSlash
      ? {
          start: mirrorX(pose.bladeSlash.start),
          end: mirrorX(pose.bladeSlash.end),
          curveOffset: -pose.bladeSlash.curveOffset,
          color: pose.bladeSlash.color,
        }
      : undefined,
  };
}

export function lerpPose(a: SkeletonPose, b: SkeletonPose, t: number): SkeletonPose {
  const clampT = Math.max(0, Math.min(1, t));
  const lerpPt = (p1: Point2D, p2: Point2D): Point2D => ({
    x: p1.x + (p2.x - p1.x) * clampT,
    y: p1.y + (p2.y - p1.y) * clampT,
  });

  const lerpPts = (arr1?: Point2D[], arr2?: Point2D[]): Point2D[] | undefined => {
    if (!arr1 || !arr2 || arr1.length !== arr2.length) return arr2 || arr1;
    return arr1.map((pt, idx) => lerpPt(pt, arr2[idx]));
  };

  return {
    head: lerpPt(a.head, b.head),
    chest: lerpPt(a.chest, b.chest),
    pelvis: lerpPt(a.pelvis, b.pelvis),
    leftShoulder: lerpPt(a.leftShoulder, b.leftShoulder),
    leftElbow: lerpPt(a.leftElbow, b.leftElbow),
    leftHand: lerpPt(a.leftHand, b.leftHand),
    rightShoulder: lerpPt(a.rightShoulder, b.rightShoulder),
    rightElbow: lerpPt(a.rightElbow, b.rightElbow),
    rightHand: lerpPt(a.rightHand, b.rightHand),
    leftHip: lerpPt(a.leftHip, b.leftHip),
    leftKnee: lerpPt(a.leftKnee, b.leftKnee),
    leftFoot: lerpPt(a.leftFoot, b.leftFoot),
    rightHip: lerpPt(a.rightHip, b.rightHip),
    rightKnee: lerpPt(a.rightKnee, b.rightKnee),
    rightFoot: lerpPt(a.rightFoot, b.rightFoot),
    scarf: lerpPts(a.scarf, b.scarf),
    prop: b.prop,
    shot: b.shot,
    bladeSlash: b.bladeSlash,
  };
}

/**
 * The move to throw at this combo: moves unlock in tiers as the chain grows
 * (basic -> acrobatic -> superhuman -> overdrive -> god-tier finishers), and
 * successive hits cycle through the current tier's moves. `moves` is the
 * hero's move list (the original striker's by default).
 */
export function getMoveForCombo(combo: number, cycleIndex: number, moves: AttackMove[] = ATTACK_MOVES): AttackMove {
  let targetTier: 1 | 2 | 3 | 4 | 5 = 1;
  if (combo >= 50) targetTier = 5;
  else if (combo >= 30) targetTier = 4;
  else if (combo >= 16) targetTier = 3;
  else if (combo >= 6) targetTier = 2;
  else targetTier = 1;

  // Use the highest tier at or below the target that this hero has moves for.
  for (let tier = targetTier; tier >= 1; tier--) {
    const tierMoves = moves.filter((m) => m.tier === tier);
    if (tierMoves.length > 0) return tierMoves[cycleIndex % tierMoves.length];
  }
  return moves[0] ?? ATTACK_MOVES[0];
}
