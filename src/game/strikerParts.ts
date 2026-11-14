/**
 * The Neon Striker's parts, cut from Gemini's arms-out drawing (scripts/striker-parts/gemini-spread.jpg)
 * by a script: each is a picture in public/fighters/striker/, hung between two joints.
 * `a` and `b` are where those joints sit in the picture (pixels); `gem` is the core gem on the torso.
 * Generated: edit the cutting script, not this file.
 */
export interface StrikerPart {
  w: number;
  h: number;
  a: [number, number];
  b: [number, number];
  gem?: [number, number];
}

export const STRIKER_PARTS = {
  "head": {
    "w": 155,
    "h": 157,
    "a": [
      75.0,
      219.5
    ],
    "b": [
      73.5,
      81.0
    ]
  },
  "torso": {
    "w": 172,
    "h": 277,
    "a": [
      95.0,
      243.5
    ],
    "b": [
      95.0,
      64.5
    ],
    "gem": [
      106.0,
      68.5
    ]
  },
  "nearUpperArm": {
    "w": 150,
    "h": 105,
    "a": [
      116.0,
      72.5
    ],
    "b": [
      -6.5,
      76.0
    ]
  },
  "farUpperArm": {
    "w": 144,
    "h": 109,
    "a": [
      33.5,
      71.0
    ],
    "b": [
      146.0,
      74.0
    ]
  },
  "nearForearm": {
    "w": 184,
    "h": 82,
    "a": [
      159.5,
      33.0
    ],
    "b": [
      32.0,
      42.0
    ]
  },
  "farForearm": {
    "w": 186,
    "h": 88,
    "a": [
      17.5,
      36.0
    ],
    "b": [
      150.0,
      49.5
    ]
  },
  "nearThigh": {
    "w": 144,
    "h": 185,
    "a": [
      96.0,
      35.0
    ],
    "b": [
      36.0,
      209.0
    ]
  },
  "farThigh": {
    "w": 137,
    "h": 196,
    "a": [
      49.5,
      40.0
    ],
    "b": [
      113.0,
      206.0
    ]
  },
  "nearShin": {
    "w": 147,
    "h": 250,
    "a": [
      111.0,
      40.0
    ],
    "b": [
      56.0,
      235.0
    ]
  },
  "farShin": {
    "w": 169,
    "h": 250,
    "a": [
      46.0,
      37.0
    ],
    "b": [
      85.0,
      235.0
    ]
  },
  "scarf": {
    "w": 307,
    "h": 157,
    "a": [
      293.5,
      66.0
    ],
    "b": [
      23.5,
      123.5
    ]
  }
} as const satisfies Record<string, StrikerPart>;
