# Hackathon Timer

A minimalist speed-dating style hackathon timer for 16 teams × 3 judges.
Theme: `#002D71` navy × `#0B8EFD` blue. Font: Ubuntu.

## File Structure

```
hackathon-timer/
├── index.html          ← Open this in your browser
├── css/
│   └── style.css       ← All styling (Ubuntu font, blue theme)
└── js/
    ├── sounds.js       ← Sound engine (synth + custom file upload)
    ├── timer.js        ← Timer state machine & controls
    ├── ui.js           ← DOM rendering
    └── settings.js     ← Settings panel, team names, sound config
```

## How to Run

**Option A — Direct open (simplest)**
Just open `index.html` in Chrome or Firefox. No server needed.
> Note: Chrome may block local file audio. If no sound plays, use Option B.

**Option B — Local server (recommended)**
```bash
# Python 3
cd hackathon-timer
python3 -m http.server 8080
# then open http://localhost:8080
```
or with Node:
```bash
npx serve hackathon-timer
```

## Sound Events

| Event | When | Default |
|-------|------|---------|
| **Pitch End Alarm** | Timer hits 0:00 | Loud 3-pulse buzzer |
| **1-Minute Warning** | 1:00 remaining | Rising siren × 3 |
| **Transition Music** | During shift period | Kahoot-style looping jingle |

### Adding Your Own Sounds
1. Open **⚙ Settings → Sounds**
2. Switch any slot from "Built-in Synth" → "Custom File"
3. Click **📂 Upload** and select an mp3, wav, or ogg file
4. Hit **▶** to preview — volume slider adjusts level per slot
5. Transition Music will loop automatically if your file is short

## Tips
- Press **F11** for fullscreen during the event
- **⚡ Jump to Round** header button for instant crash recovery
- **⚙ Settings → Recovery** tab for round jump + crash notes
- Click any dot on the round progress strip to jump to that round
- Bulk-paste all team names at once in **Settings → Teams**
