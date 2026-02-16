# Copilot Instructions

## Project Purpose
- **Aion2 Tools** is a dual web/Electron app for searching Aion2 characters and coordinating weekly dungeon squads.
- The UI is built with React 18 + Vite. Electron (see `electron/main.js` and `electron/preload.js`) packages the same React bundle as a desktop app via `vite-plugin-electron` and `electron-builder`.

## Core Concepts
- `src/App.jsx` owns almost all logic: REST fetching, saved search history, roster memoization, drag/drop squad building, preview overlay, and week scheduling.
- `src/App.css` contains the design system (rounded cards, gradients, overlay styles). Keep new classes consistent with existing naming and gradient-heavy look.
- Character data is fetched from `https://aion-api.bnshive.com/character/query?name=<NAME>&server=<SERVER>` using `fetch`. No proxy is required inside Electron, so keep calls in the renderer.

## Existing Behavior to Preserve
1. **Search Tab**
   - Multiline textarea input. Each non-empty line becomes a username; duplicates (case-sensitive) are skipped.
   - Server input applies to every pasted name.
   - Results and roster members are sorted by PVE score (descending); invalid scores sink to the bottom.
   - History of up to 100 `(username, server)` pairs is stored in `localStorage` under `aion2_saved_usernames`.
2. **Dungeon Planner Tab**
   - Drag/drop requires HTML5 native events. `draggingMemberRef` holds the payload; do not replace with DnD libs unless absolutely necessary.
   - Each team contains two subteams (3 DPS + 1 Support). Supports are class `治癒星` only.
   - `teamAssignments` is a flat map of `slotId -> member` built from templates. Update this map carefully when adding/removing teams.
   - Squad stats show average DPS PVE score and respect the "Show/Hide PVE" toggle.
   - Per-team date/time pickers must stay within the "Wed → Tue" window computed by `getUpcomingRaidWindow()`.
   - Preview overlay must stay printable: it uses `.preview-grid` columns (4 slots wide when teams ≤2, 2-col fallback on smaller viewports).

## Implementation Guidelines
- Prefer React hooks already in use (`useState`, `useMemo`, `useEffect`). Maintain derived state (e.g., `teamStats`, `rosterMembers`) as memos to avoid extra renders.
- When introducing new persistent data, extend the existing storage helpers instead of creating new keys.
- Validate API responses defensively—`extractCharacterDetails` already handles missing nodes; follow the same pattern for new fields.
- For styling, keep everything in `App.css`. Use the existing design tokens (gradients, rounded corners) and mobile fallbacks.
- When editing drag/drop logic, ensure keyboard/mouse interactions still prevent default only when needed. Slots should reject incompatible roles.

## Commands
- `npm run dev`: Vite dev server (also drives Electron via `electron:dev`).
- `npm run build`: Builds web bundle plus Electron `main/preload` files (used before `electron-builder`).
- `npm run electron:build[:win|:mac|:linux]`: Produces desktop installers in `release/`.
- `npm run preview`: Serves the built web bundle locally.

## Testing & Validation
- Primary validation is running `npm run build`. No automated tests exist; rely on manual QA for drag/drop and preview behavior.
- When touching Electron files, launch via `npm run electron:dev` to ensure window wiring still works.

## Common Tasks
- **Adding fields to preview**: extend `preview-team-heading` or `preview-slot-details` and update both planner cards and preview overlay for parity.
- **Adjusting roster filters**: change `SUPPORT_CLASS` or role logic in `rosterMembers` and ensure `availableDps` / `availableSupport` stay mutually exclusive.
- **Persisting new UI toggles**: store in `localStorage` with clear keys and hydrate in `useEffect` similar to the username history.

Follow these notes whenever you extend the project so new behavior aligns with the existing UX and data flow.
