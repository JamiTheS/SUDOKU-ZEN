1→# Agent Development Guide
2→
3→## Setup Commands
4→```bash
5→npm install                    # Install dependencies
6→```
7→
8→## Build & Development
9→```bash
10→npm run build                  # Build project (copies files to www/)
11→npx cap sync                   # Sync Capacitor for iOS
12→npx cap open ios               # Open iOS project in Xcode
13→```
14→
15→## Tech Stack
16→- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
17→- **Mobile**: Capacitor 7 for iOS deployment
18→- **Backend**: Firebase Realtime Database (multiplayer features)
19→- **Architecture**: Single-page application with modular JS files
20→
21→## Repository Structure
22→- `index.html` - Main app entry point
23→- `script.js` - Core Sudoku game logic (SudokuGame class)
24→- `battle-manager.js` - Multiplayer battle mode
25→- `coop-manager.js` - Cooperative mode
26→- `style.css`, `battle-styles.css` - Styling
27→- `www/` - Build output directory (gitignored)
28→- `ios/` - Capacitor iOS platform files
29→
30→## Code Conventions
31→- Use ES6 classes for game components
32→- French language for UI text
33→- No TypeScript or build tooling
34→- Firebase config exposed in HTML (module script)
35→