# CrazyGames submission checklist

Checked against the CrazyGames requirements (docs.crazygames.com/requirements) on 2026-10-20.
"Basic" is needed to go live at all; "Full" is needed once CrazyGames picks the game for Full
Launch (ads and revenue only start then).

## Technical

| Requirement | Level | Status |
|---|---|---|
| Initial download ≤ 50 MB (≤ 20 MB for the mobile homepage), measured up to the first gameplay start | Basic | Done: about 5 MB (604 KB of code and styles, plus one song) |
| Total size ≤ 250 MB, ≤ 1,500 files | Basic | Done: 23 MB, 8 files (`npm run build`) |
| Relative paths only | Basic | Done: Vite `base: './'`, songs at `audio/...` (tested from a subfolder) |
| Works on Chrome and Edge; mouse, keyboard and touch | Basic | Done; Safari and a 4 GB Chromebook not tested |
| No page scroll, text selection or right-click menu over the game | Basic | Done: `overflow-hidden select-none` on the body, right-click blocked |
| iOS: resume audio after an interruption, on the next tap | Basic | Done (`App.tsx`), not tested on an iPhone |
| SDK: gameplay start/stop | Basic + Full | Done: start when a song is playing, stop on pause, death, clear, quit and menus |
| SDK: loading start/stop | Full (optional) | Done, around loading a song |
| SDK: `muteAudio` setting overrides the game's volume | Full | Done (`audioEngine.setPlatformMuted`) |
| SDK: data module for progress, so it follows the account | Full | Done: lifetime totals, settings and high scores go through `progressStore()` on CrazyGames. **Pick "Yes, using the Data Module" in the submission form**, or it stays switched off |

## Gameplay

| Requirement | Level | Status |
|---|---|---|
| Readable at 800×450 up to 1920×1080 | Basic | To check in the CrazyGames QA tool |
| Same behaviour at any refresh rate | Basic | Done: timing runs off the audio clock |
| English | Basic | Done |
| No custom fullscreen button, no cross-promotion or external links | Basic | Done |
| PEGI 12 | Basic | Fine: neon stick-figure fighting, enemies shatter into shards, no blood |
| Original names and assets | Basic | Heroes are inspired-by with our own names and no quotes. **Song rights: the five Eargasm tracks must be ours or licensed for this use** |
| New players land in gameplay with at most 1 click | Full | **Not yet**: title → New Game → song list → Play |

## Ads

| Requirement | Level | Status |
|---|---|---|
| Only SDK ads; muted and paused while an ad plays | Full | Done |
| No reward when an ad errors | Full | Done |
| Ad buttons never sit there doing nothing (ad blocker, ads off in Basic Launch) | Basic + Full | Done: an ad blocker hides the buttons with a note; an "ads off" error hides them for the visit |
| Players with an ad blocker can still play normally | Full | Done |
| Rewarded ads offer an alternative way to get the reward | Full | Stances: yes (every 20 minutes of play). **The Bride: no, she is ad-only** |
| No rewarded-ad button during gameplay | Full | Done: only on the title, Stances and Unlocks screens |

## Left to do

1. Decide on The Bride: give her a play goal as well as the ad (the rules ask for an alternative to every rewarded ad), or keep her ad-only and accept the risk.
2. Land new players in gameplay with one click (Full Launch).
3. Confirm the song rights.
4. Run the build through the QA tool on the CrazyGames Developer Portal, and try Safari.
5. Submission form: description, controls, cover images and video, and the Progress Save toggle.
