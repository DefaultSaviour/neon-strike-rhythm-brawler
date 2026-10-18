# Heroes plan

Every hero gets their own look, a top-level form, and 21 combo moves split 5/5/4/4/3 across the
combo tiers. Effects stay physical only: no magic.

## 1. Baba Yaga (John Wick style)

- **Look:** black suit, white collar line, slicked hair, stubble.
- **Props:** pistol, dual pistols, shotgun.
- **Effects:** a one-frame muzzle flash, a thin bullet streak to the enemy, and ejected casings.
- **Top-level form:** two slow-motion afterimages and a red laser sight.
- **Idle:** a compact two-handed gun stance held at the chest.

| Tier | Moves |
| --- | --- |
| 1 | Double Tap, Pistol Whip, Elbow-Shot, Knee and Shoot, Quick Draw |
| 2 | Judo Throw Shot, Arm Lock Triple Tap, Reload Kick, Headshot Pivot, Dual Pistols |
| 3 | Shotgun Blast, Slide Shot, Pencil Strike, Wall Run Shot |
| 4 | Gun-Kata Spin, Grapple and Execute, Shotgun Pump Combo, Rolling Fire |
| 5 | Excommunicado (6-hit chain), Baba Yaga (dual pistols fanning in a spin), Last Bullet (one huge shot, then blowing on the barrel) |

## 2. The One (Neo style)

- **Look:** a long black coat that flares out, small dark sunglasses.
- **Effects:** coat trail, afterimages on the floating moves, a ripple ring where each strike lands.
- **Top-level form:** green "code rain" falling around him, plus a faint green glow.
- **Idle:** relaxed, palm up, beckoning.

| Tier | Moves |
| --- | --- |
| 1 | Palm Block Counter, Rapid Jab Flurry, Low Sweep, One-Hand Push, Spin Backfist |
| 2 | Bullet Dodge Lean-Back, Wall-Run Kick, Corkscrew Kick, Twin Palm Strike, Flying Knee |
| 3 | Air Pirouette Kick, Hands-Only Spin, Lean-Back Flip Kick, Hundred Punch Blur |
| 4 (floating moves, 15–18) | Float Kick, Hover Spin, Hang-Time Axe, Slow-Mo Flying Side Kick |
| 5 | Burly Brawl (6 hits), Superman Punch, I Know Kung Fu |

## 3. Drunken Master (Jackie Chan style)

- **Look:** loose open shirt with a sash, messy hair, cheeks that flush redder at higher combos.
- **Props:** a wine gourd on a string, a wooden bench plank.
- **Effects:** an off-beat stagger, a hiccup hop, spilled drops on big swings.
- **Top-level form:** two gourds orbiting him, plus wobbly speed lines.
- **Idle:** swaying and leaning back, drinking from the gourd.

| Tier | Moves |
| --- | --- |
| 1 | Stumble Jab, Gourd Bonk, Tipsy Elbow, Hiccup Headbutt, Wobble Slap |
| 2 | Drunken Fist Flurry, Falling Kick, Swaying Sweep, Cup-Hand Strike, Lean-and-Leap |
| 3 | Gourd Swing Combo, Bench Smash, Rolling Kick, Drunken Monkey Climb |
| 4 | Lu's Stagger, Iron Crutch Kick, Spinning Drunk, Bottle-Neck Strike |
| 5 | Drunken Master (6 stumbles that all land), Last Call (drinks, spits, then a huge spinning kick), Wake-Up Uppercut (passes out flat, then springs up into an uppercut) |

## 4. Prima Ballerina (Billy Elliot style)

- **Look:** tutu, hair in a bun, ribbon shoes.
- **Effects:** pink ribbon trails from the feet, landing puffs, a spin blur on pirouettes.
- **Top-level form:** falling rose petals and a spotlight cone behind her.
- **Idle:** first position, rising onto her toes on each beat.

| Tier | Moves |
| --- | --- |
| 1 | Battement Kick, Pas de Chat Knee, Port de Bras Chop, Relevé Uppercut, Plié Punch |
| 2 | Pirouette Heel, Grand Battement, Fouetté Whip, Arabesque Thrust, Sissonne Scissor |
| 3 | Grand Jeté, Tour en l'Air, Cabriole Beat, Pas de Bourrée Flurry |
| 4 | 32 Fouettés, Lift-Off Leap, Arabesque Spin, Développé Axe |
| 5 | Swan Lake, Black Swan (6 hits), Curtain Call (a deep bow, then a devastating high kick) |

## 5. Pro Wrestler (replaces the fitness guy)

- **Look:** singlet strap, championship belt plate, headband, taped wrists.
- **Props:** a folding steel chair.
- **Effects:** extra screen shake on slams, sweat drops, a brief white flash at the screen edges
  for the crowd pop.
- **Top-level form:** the championship belt held overhead, with a spotlight from above.
- **Idle:** big-man bounce, flexing, a fist pump on each beat.
- **Throws:** the enemy explodes on the hit, so throws and slams are shown as the wrestler lifting
  and slamming an imaginary opponent.

| Tier | Moves |
| --- | --- |
| 1 | Forearm Smash, Chop, Clothesline, Headbutt, Big Boot |
| 2 | Spinebuster, Running Shoulder Tackle, Elbow Drop, Dropkick, Leg Drop |
| 3 | Suplex, Flying Crossbody, Steel Chair Shot, Spear |
| 4 | Powerbomb, Moonsault, Lariat Spin, Piledriver Drop |
| 5 | Five Moves of Doom, Flying Elbow from the Top Rope, Championship Finisher (belt raise, then a running powerbomb) |

## Suggested build order

1. Baba Yaga: guns add the most variety.
2. The One: reuses the existing afterimages.
3. Drunken Master
4. Pro Wrestler
5. Prima Ballerina

The Neon Striker can get combos at any point too.

## How to build one

Copy `src/game/heroMoves/littleDragon.ts`, then:

1. Add the hero to `HEROES` in `src/game/heroes.ts`.
2. Draw the outfit and top-level form in `src/components/fighterArt.ts`.
3. Add any new prop to the prop type.
4. Copy the Little Dragon tests in `src/game/heroes.test.ts`.
