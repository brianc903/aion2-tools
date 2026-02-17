# Aion2 Character Search & Planner

A React + Vite + Electron experience for searching Aion2 characters, building weekly dungeon squads, and sharing printable rosters.

## Features

✨ **Character Search** – Paste several character names (one per line) and fetch them in a single click.
📊 **Rich Details** – View PVE score, item level, class, and level; results are auto-sorted by PVE descending.
💾 **Saved Searches** – Up to 100 recent `(name, server)` pairs persist in `localStorage` for quick re-runs.
🧩 **Weekly Dungeon Planner** – Drag & drop characters into multi-team, two-subteam layouts (3 DPS + 1 Support).
🗓️ **Schedule Tracking** – Assign a date (Wed → Tue) and time per team; preview displays the final timestamp.
🖼️ **Printable Preview Overlay** – Show every roster on one page (4 slots per row) for fast Discord sharing or screen captures.
💻 **Desktop Ready** – Packaged with Electron so the same UI runs as a native Windows/macOS/Linux app without CORS issues.

## How to Use

### Search Tab
1. Enter one or more names in the **Character Names** textarea (one per line). The Server input applies to every name.
2. Click **➕ Add Character** to queue the cleaned list.
3. Use **🔍 Search All Characters** to fetch them in parallel. Results appear sorted by PVE score.
4. Saved searches record the last 100 `(name, server)` pairs. Click a pill to rehydrate the inputs or remove/clear as needed.
5. Re-run searches anytime; new results merge into the existing roster so Dungeon Team assignments stay intact until you clear them.

### Dungeon Teams Tab
1. Run a search first so the roster has data.
2. Drag DPS or Support cards into the desired slot (role restriction enforced).
3. Use **Hide/Show PVE Scores**, the ↑/↓ controls to reorder teams, **Add Team**, or **Reset Teams** as needed. Each team always has two subteams (A/B) with 4 slots each.
4. Pick a date (restricted to the upcoming Wed → Tue window) and time for each team using the controls in the card header.
5. Click **👀 Preview Layout** to display every roster on one page for screenshots/exports. The overlay respects the same PVE visibility toggle.

## Installation & Running

### Prerequisites
- Node.js (v16 or higher)
- npm

### Setup
```bash
# Install dependencies
npm install --registry https://registry.npmjs.org/

# Run development server
npm run dev

# Build for production
npm run build

# Optional: build Electron packages (after npm run build)
npm run electron:build
```

### Access the App
- Web: open http://127.0.0.1:5173/ while `npm run dev` is running.
- Desktop: run the generated binary inside `release/` after `npm run electron:build` (or the OS-specific variant).

### Common Scripts
- `npm run dev` – Vite dev server (also powers `electron:dev`).
- `npm run build` – Builds the web bundle plus Electron `main/preload` files (`dist` + `dist-electron`).
- `npm run preview` – Serves the production build locally.
- `npm run electron:build[:win|:mac|:linux]` – Uses `electron-builder` to create installers under `release/`.

## API Endpoint

The app uses the Aion API:
```
https://aion-api.bnshive.com/character/query?name={NAME}&server={SERVER}
```

## Technologies Used

- **React 18** – UI framework
- **Vite 4** – Build tool and dev server
- **Electron 40** – Desktop packaging/runtime
- **CSS3** – Styling with gradients and animations
- **localStorage** – Client-side persistence for saved searches and planner state

## Project Structure

```
aion2-tools/
├── src/
│   ├── App.jsx          # Main application component
│   ├── App.css          # Application styles
│   ├── main.jsx         # React entry point
│   └── index.css        # Global styles
├── electron/
│   ├── main.js          # Electron main process
│   └── preload.js       # Preload bridge
├── index.html           # HTML template
├── package.json         # Project dependencies
├── copilot-instructions.md # Contributor guidance for AI-assisted edits
└── vite.config.js       # Vite configuration
```

## Features in Detail

### Character Details Displayed

1. **PVE Score** - Located at `ratings.PVE.score` in the API response
2. **Item Level** - Found in `queryResult.data.stat.statList[]` where `type='ItemLevel'`
3. **Class** - Located at `queryResult.data.profile.className`
4. **Level** - Character level from profile

### Data Persistence

- Usernames and servers are saved in browser localStorage (`aion2_saved_usernames`)
- Up to 100 recent entries are preserved (duplicates removed when re-added)
- Data persists across browser sessions
- Each entry can be individually removed

### Dungeon Planner & Preview

- Teams are always 8 players (two subteams w/ 3 DPS + 1 Support).
- Drag-and-drop enforces role restrictions and removes previous slot assignments automatically.
- Supports are identified by class `治癒星`; everything else is treated as DPS.
- Planner stats show the average DPS PVE score per subteam when the toggle is enabled.
- Preview overlay renders all teams on one canvas with consistent width slots (4 columns) and includes the scheduled date & time.

## Development

To modify the app:

1. Edit `src/App.jsx` for functionality changes
2. Edit `src/App.css` for styling changes
3. Electron-specific tweaks live in `electron/main.js` and `electron/preload.js`
3. The dev server hot-reloads on file changes

## Browser Compatibility

Works on all modern browsers:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## License

This project is open source and available for personal use.
