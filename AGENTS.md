# Agent Development Guide

## Setup Commands
```bash
npm install                    # Install dependencies
```

## Build & Development
```bash
npm run build                  # Build project (copies files to www/)
npx cap sync                   # Sync Capacitor for iOS
npx cap open ios               # Open iOS project in Xcode
```

## Tech Stack
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Mobile**: Capacitor 7 for iOS deployment
- **Backend**: Firebase Realtime Database (multiplayer features)
- **Architecture**: Single-page application with modular JS files

## Repository Structure
- `index.html` - Main app entry point
- `script.js` - Core Sudoku game logic (SudokuGame class)
- `battle-manager.js` - Multiplayer battle mode
- `coop-manager.js` - Cooperative mode
- `firebase-monitor.js` - Connection monitoring and error handling
- `style.css`, `battle-styles.css` - Styling
- `www/` - Build output directory (gitignored)
- `ios/` - Capacitor iOS platform files

## Code Conventions
- Use ES6 classes for game components
- French language for UI text
- No TypeScript or build tooling
- Firebase config exposed in HTML (module script)

## Error Handling & User Feedback
The app includes comprehensive error handling for multiplayer features:

### Firebase Connection Monitoring
- Real-time connection status indicator (top-right corner)
- Auto-detection of connection loss
- Graceful reconnection handling

### Loading States
- Visual loading overlays during room operations
- Progress indicators for async operations
- Timeout handling (10s for room operations, 5s for moves)

### Error Messages
- Clear, user-friendly error messages in French
- Specific error messages for common scenarios:
  - Room not found
  - Room full (2/2 players)
  - Game already started
  - Connection timeout
  - Permission errors
  - Network errors

### Retry Mechanisms
- Automatic retry (up to 3 attempts) for failed operations
- Exponential backoff with 2s delay between retries
- User feedback during retry attempts

### Validation
- Input validation for room codes (6 alphanumeric characters)
- Username validation (2-15 characters)
- Pre-flight checks before Firebase operations
