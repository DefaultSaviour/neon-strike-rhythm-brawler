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
| Same game on every screen size | Basic | Done: enemies start the same distance away and move at the same speed on every screen; every menu and the HUD fit at 667×375, 740×360, 800×450, 821×462, 907×510, 1024×768, 768×1024 and 390×844 (checked in the browser) |
| Phones | Basic | Tap the left or right half to strike (labels say "Tap to strike" on touchscreens), no double-tap zoom. **In the submission, set the orientation to landscape**: portrait works, but the fighters are small |
| No page scroll, text selection or right-click menu over the game | Basic | Done: `overflow-hidden select-none` on the body, right-click blocked |
| iOS: resume audio after an interruption, on the next tap | Basic | Done (`App.tsx`), not tested on an iPhone |
| SDK: gameplay start/stop | Basic + Full | Done: start when a song is playing, stop on pause, death, clear, quit and menus |
| SDK: loading start/stop | Full (optional) | Done, around loading a song |
| SDK: `muteAudio` setting overrides the game's volume | Full | Done (`audioEngine.setPlatformMuted`) |
| SDK: data module for progress, so it follows the account | Full | Done: lifetime totals, settings and high scores go through `progressStore()` on CrazyGames. **Pick "Yes, using the Data Module" in the submission form**, or it stays switched off |
| SDK: leaderboard (invite-only, one per game) | Optional | Ready: ranks the best single-song score; scores are sent encrypted when a song sets a new best. **Once invited: set the board to POINTS, sorted high-to-low, and put its Encryption Key in `.env` as `VITE_CRAZYGAMES_LEADERBOARD_KEY` before building.** The game's own Records screen has three tabs (best song, total score, biggest combo) |

## Gameplay

| Requirement | Level | Status |
|---|---|---|
| Readable at 800×450 up to 1920×1080 | Basic | To check in the CrazyGames QA tool |
| Same behaviour at any refresh rate | Basic | Done: timing runs off the audio clock |
| English | Basic | Done |
| No custom fullscreen button, no cross-promotion or external links | Basic | Done |
| PEGI 12 | Basic | Fine: neon stick-figure fighting, enemies shatter into shards, no blood |
| Original names and assets | Basic | Heroes are inspired-by with our own names and no quotes. **Songs: made with Suno, so they're only usable if made on a paid plan and downloaded from Suno (see below)** |
| New players land in gameplay with at most 1 click | Full | Done: a brand-new player's New Game starts the easiest song (Menace) straight away |

## Ads

| Requirement | Level | Status |
|---|---|---|
| Only SDK ads; muted and paused while an ad plays | Full | Done |
| No reward when an ad errors | Full | Done |
| Ad buttons never sit there doing nothing (ad blocker, ads off in Basic Launch) | Basic + Full | Done: an ad blocker hides the buttons with a note; an "ads off" error hides them for the visit |
| Players with an ad blocker can still play normally | Full | Done |
| Rewarded ads offer an alternative way to get the reward | Full | Done: stances open every 20 minutes of play; The Bride after 3 songs, or straight away with an ad |
| No rewarded-ad button during gameplay | Full | Done: only on the title, Stances and Unlocks screens |
| Midgame ads only at natural breaks, never mid-song or on menu buttons | Full | Done: at the end of a song (death or clear), once there's been 5 minutes of song play since the last ad (`adPacing.ts`); results wait behind the ad. Try it locally with `?adTest` |
| Happy time used sparingly | Full (optional) | Done: only when a song unlocks a hero |

## Left to do

1. Song rights (Suno, terms effective 3 September 2026): songs made on the **free** plan are for personal, non-commercial use only, and an ad-funded game is commercial. Songs made on **Pro or Premier** can be used commercially, but only after being downloaded from Suno. Subscribing later doesn't clearly cover songs made earlier on the free plan. Don't strip Suno's watermark or metadata from the files.
2. Run the build through the QA tool on the CrazyGames Developer Portal, and try Safari. While there, test Import Audio inside their page: does the file picker open, and is an imported song still there after closing and reopening the game? (Imported songs live in the browser's own storage, not the CrazyGames account, so they stay on that one device and browser.)
3. Submission form: description, controls, cover images and video, and the Progress Save toggle.
