# Who Talks Next

A marble derby that picks the speaking order for your stand-up.

Every player is a marble. They drop through a peg forest, switchbacks, spinners, a bumper pit and a funnel, and the order they cross the finish line is the order people speak in. After the race the track becomes a stage: the speaker's marble sits under a spotlight next to a sand hourglass that drains over their time-box (the marble overheats and steams if they run over), the next speaker warms up below, and the round ends with a scoreboard of who talked how long.

## Controls

| Key / button | What it does |
| --- | --- |
| `Enter` / **Start race** | Countdown, then the gate opens |
| `1×` `2×` `4×` | Race speed |
| `S` / **Skip to result** | Simulates the rest of the race instantly |
| `Space` or `→` / **Next speaker** | Moves to the next person and restarts the timer |
| `←` / **Back** | Goes back one speaker |
| Click a name in the queue | Jumps to that person |
| `R` / **Race again** | Runs a fresh race |
| **Players** | Untick people who are out today, add or remove names (saved in your browser) |
| **Time-box** | 1, 2, 3 or 5 minutes per speaker; the timer turns red when someone goes over |

## Run locally

It is a static site with no build step. Open `index.html`, or serve the folder:

```sh
npx serve .
```

## Deploy to Vercel

**Dashboard:** go to [vercel.com/new](https://vercel.com/new), import this GitHub repo, keep the defaults (Framework preset: *Other*, no build command, output directory `.`), and click **Deploy**. Every push to the default branch then deploys automatically.

**CLI:**

```sh
npm i -g vercel
vercel        # first run links the project and makes a preview deploy
vercel --prod # production deploy
```

## Files

- `index.html`: page structure
- `style.css`: arcade look
- `app.js`: track, marble physics, race camera, speaker queue
- `vercel.json`: static hosting config
