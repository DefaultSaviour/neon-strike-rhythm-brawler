# Hero roster plan

Built so far: **Neon Striker** (original, single-pose moves) and **The Little Dragon**
(combos, `src/game/heroMoves/littleDragon.ts`). This file describes the five heroes still to
build, so each can be made later by copying the Little Dragon's pattern.

## How to build a hero (recap)

1. Create `src/game/heroMoves/<hero>.ts`, modelled on `littleDragon.ts`:
   - an `IDLE` stance built with `buildFighterPose`;
   - 21 moves split over the combo tiers **5 / 5 / 4 / 4 / 3**, each made with `combo(...)`. The first keyframe is the hit (it lands on the button press), then follow-up keyframes with `ms` timings.
   - Angles: 0 = toward the enemy, 90 = down, -90 = up, 180 = back. The floor is at y = 68.
2. Add the hero's id to `HeroId` and an entry to `HEROES` in `src/game/heroes.ts`.
3. Draw the outfit in `src/components/fighterArt.ts`, in the style of `drawLittleDragonOutfit`.
4. Draw the **top-level form** (god tier, `tier.ascended`) in `drawFighter`, in the style of `drawDragonSpirit`.
5. Add any new prop (gun, gourd...) to `SkeletonPose['prop']` and draw it, as with `drawNunchaku`.
6. Copy the Little Dragon tests in `src/game/heroes.test.ts`: 21 moves, 5/5/4/4/3, solid limbs, above the floor, airborne moves leave the ground.
7. Check it with a contact sheet and filmstrip in Chromium, then play a real game as the hero.

Rules from the player:
- **Inspired-by names only**, no real names.
- **No fireballs or magic.** Cool, physical moves, Street Fighter / Mortal Kombat style.
- Performance comes first. Effects are a few cheap shapes, with no new physics.
- The hips can move, but the first hit must land within 50 ms.

---

## 1. Baba Yaga: gun-fu assassin (John Wick style)

- **Look:** black suit with a white shirt collar line, slicked hair, short beard stubble on the jaw.
- **Props:** `pistol`, `pistols` (one in each hand) and `shotgun`. Draw them as small solid neon shapes.
- **Effects:** physical only:
  - a short white muzzle flash (a 3-point star for 1 frame);
  - a thin bullet streak from the muzzle to the enemy (one line, fading in about 80 ms);
  - a spent-casing particle using the existing particles.
- **Top-level form:** a slow-motion "focus" look: two faint afterimages of the body trailing behind, plus a red laser sight from the gun.
- **Idle:** a compact gun stance, both hands on the pistol close to the chest (centre-axis relock).

| Tier | Moves (combos) |
|---|---|
| 1 | Double Tap (2 shots), Pistol Whip, Elbow-Shot (elbow then point-blank shot), Knee and Shoot, Quick Draw |
| 2 | Judo Throw Shot (hip-throw pose, shoot down), Arm Lock Triple Tap, Reload Kick (kick while the mag drops), Headshot Pivot, Dual Pistols |
| 3 | Shotgun Blast (big recoil step back), Slide Shot (knee slide, firing), Pencil Strike (a stab with a pencil prop), Wall Run Shot (airborne, sideways) |
| 4 | Gun-Kata Spin (360 spin, shots at each quarter), Grapple and Execute, Shotgun Pump Combo (3 pumps, 3 blasts), Rolling Fire (roll, then kneel firing) |
| 5 | Excommunicado (6-hit chain: kick, whip, double tap, throw, shot, holster), Baba Yaga (dual pistols fanning in a long spin), Last Bullet (a slow aim, one huge recoil shot, then blowing on the barrel) |

## 2. The One: bullet-time martial artist (Neo style)

- **Look:** a long black coat that flares behind the body (drawn like the scarf, but longer and wider), plus small dark sunglasses instead of the visor.
- **Props:** none.
- **Effects:** physical:
  - a coat-flare trail;
  - 2–3 faint afterimages on the floating moves (reuse the tier `ghost` afterimage);
  - a ripple ring (a thin ellipse) where a strike lands.
- **Top-level form:** a green "code" rain. Thin vertical green dashes fall around him: about 12 short lines, each one stroke. His outline glows faint green.
- **Idle:** a relaxed stance, one hand out with the palm up, beckoning.
- **Floating moves:** moves 15–18 are the floating attacks the player asked for. He hangs in the air for 2–3 keyframes, kicking slowly, then snaps back down.

| Tier | Moves (combos) |
|---|---|
| 1 | Palm Block Counter, Rapid Jab Flurry, Low Sweep, One-Hand Push, Spin Backfist |
| 2 | Bullet Dodge Lean-Back (bends right back, then springs up into a punch), Wall-Run Kick, Corkscrew Kick, Twin Palm Strike, Flying Knee |
| 3 | Air Pirouette Kick, Staff-less Spin (hands-only spinning strikes), Lean-Back Flip Kick, Hundred Punch Blur |
| 4 | **Float Kick** (floats up, 3 slow kicks in the air), **Hover Spin**, **Hang-Time Axe**, **Slow-Mo Flying Side Kick** |
| 5 | Burly Brawl (6 hits, spinning between imagined attackers), Superman Punch (horizontal flying punch), I Know Kung Fu (classic stance, 5 lightning strikes, then he beckons) |

## 3. Drunken Master: drunken boxing (Jackie Chan style)

- **Look:** a loose open shirt with a sash belt, messy hair, cheeks that flush redder at higher tiers.
- **Props:** a `gourd` (a wine gourd on a string) and sometimes a `bench` (a short plank held in two hands).
- **Effects:** physical:
  - a stagger sway (the head bobs off-beat);
  - a hiccup bounce (the whole body hops 2 units);
  - spilled drops of drink (3 tiny particles) on big swings.
- **Top-level form:** two spinning gourds orbiting him, plus wobbly speed lines. Purely physical props.
- **Idle:** tipsy and swaying, leaning back, one hand holding the gourd to his mouth.
- **Style:** moves should look off-balance but land precisely. Lean far over (lean ±35), stumble a step, then the strike snaps out.

| Tier | Moves (combos) |
|---|---|
| 1 | Stumble Jab, Gourd Bonk, Tipsy Elbow, Hiccup Headbutt, Wobble Slap |
| 2 | Drunken Fist Flurry (claw-fist strikes), Falling Kick (falls backward, kicks up), Swaying Sweep, Cup-Hand Strike, Lean-and-Leap |
| 3 | Gourd Swing Combo (gourd on a string, 3 swings), Bench Smash (plank swing), Rolling Kick (rolls on the floor, then kicks up), Drunken Monkey Climb (scrambles up and kicks down) |
| 4 | Eight Immortals: Lu's Stagger, Eight Immortals: Iron Crutch Kick, Spinning Drunk (pirouettes while stumbling, 4 strikes), Bottle-Neck Strike |
| 5 | Drunken Master (6-hit chain of stumbles that all land), Last Call (drinks, spits, and a huge spinning kick), Wake-Up Uppercut (passes out flat, then springs up into an uppercut) |

## 4. Prima Ballerina: ballet as a weapon (Billy Elliot style)

- **Look:** a tutu (a short flared skirt around the pelvis, drawn as a fan of 5 short lines), hair in a bun, ribbon shoes.
- **Props:** none. Use the `ribbon` trail colour for limb trails (pale pink / white).
- **Effects:** physical:
  - ribbon trails from the feet (reuse the trail);
  - a soft dust puff on landings;
  - a spin blur on pirouettes.
- **Top-level form:** falling rose petals (8 small tilted ovals drifting down around her) and a spotlight cone behind her (one translucent triangle).
- **Idle:** first position, arms in a soft rounded *bras bas*, rising onto the toes (relevé) on each beat.

| Tier | Moves (combos) |
|---|---|
| 1 | Battement Kick (straight-leg kick), Pas de Chat Knee, Port de Bras Chop, Relevé Uppercut, Plié Punch |
| 2 | Pirouette Heel (spin, heel strike), Grand Battement (huge high kick), Fouetté Whip (whipping leg turns, 3 hits), Arabesque Thrust, Sissonne Scissor |
| 3 | Grand Jeté (flying split leap kick), Tour en l'Air (double spin in the air, kick), Cabriole Beat (legs beat together mid-air), Pas de Bourrée Flurry |
| 4 | 32 Fouettés (rapid whipping spins, 4 hits), Lift-Off Leap, Arabesque Spin, Développé Axe (leg unfolds high, then chops down) |
| 5 | Swan Lake (a full combo of leaps, spins and a final arabesque pose), Black Swan (a dark 6-hit spinning combo), Curtain Call (a deep bow, then a devastating grand battement) |

## 5. Pro Wrestler: showman grappler (replaces the fitness guy)

- **Look:** a wrestling singlet (a strap line over one shoulder), a championship belt plate at the waist, a headband, wrist tape.
- **Props:** `chair` (a folding chair, for the steel-chair moves).
- **Effects:** physical:
  - a ring-shake landing (a small extra screen shake on slams, using the existing shake);
  - sweat drops (3 tiny particles);
  - the crowd-pop flash is only a brief white edge vignette, so it stays cheap.
- **Top-level form:** a championship spotlight. A golden belt held above his head between strikes, and a bright spotlight cone from above.
- **Idle:** the big-man bounce, flexing and stepping side to side, with a fist pump on each beat.
- **Note:** throws and slams can't move the enemy (it explodes on the hit). Show them as the wrestler's own motion: lifting an imaginary opponent, then slamming down, with the first keyframe still the hit.

| Tier | Moves (combos) |
|---|---|
| 1 | Forearm Smash, Chop (big open-hand chest chop), Clothesline, Headbutt, Big Boot |
| 2 | Spinebuster (lift and slam), Running Shoulder Tackle, Elbow Drop (drops onto the floor), Dropkick (both feet, airborne), Leg Drop |
| 3 | Suplex (arch back, slam), Flying Crossbody, Steel Chair Shot (chair prop), Spear (low running tackle) |
| 4 | Powerbomb (lift high, slam down), Moonsault (backflip off the top, imagined ropes), Lariat Spin (spinning clothesline, 3 rotations), Piledriver Drop |
| 5 | Five Moves of Doom (5-hit chain: shoulder, slam, boot, taunt, leg drop), Flying Elbow from the Top Rope (huge airborne drop), Championship Finisher (belt raise, then a running powerbomb slam) |

---

## Suggested build order

1. **Baba Yaga.** Guns add the most variety. It needs the gun props, the muzzle flash and the bullet streak.
2. **The One.** Floating moves reuse the ghost afterimages.
3. **Drunken Master.** Funny and physical, and needs the gourd prop.
4. **Pro Wrestler.** Needs the chair prop and the extra slam shake.
5. **Prima Ballerina.** Pure animation, no new tech.

The **Neon Striker** can also be upgraded to combos at any point: wrap each of its 24 moves in a short follow-up sequence.
