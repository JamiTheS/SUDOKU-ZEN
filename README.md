# SUDOKU ZEN

A modern Sudoku game with multiplayer battle and cooperative modes, built with vanilla JavaScript and Firebase.

## Features

- **Solo Mode**: Classic Sudoku gameplay with multiple difficulty levels
- **Battle Mode**: Compete against another player in real-time
- **Cooperative Mode**: Work together with a partner to solve puzzles
- **Mobile Support**: iOS deployment via Capacitor
- **Real-time Multiplayer**: Firebase-powered online gameplay

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Mobile**: Capacitor 7 for iOS deployment
- **Backend**: Firebase Realtime Database
- **Hosting**: GitHub Pages

## Local Development

### Prerequisites
- Node.js and npm installed
- iOS development: Xcode (for iOS builds)

### Setup
```bash
npm install
```

### Build
```bash
npm run build          # Copies files to www/ directory
npx cap sync          # Sync Capacitor for iOS
npx cap open ios      # Open iOS project in Xcode
```

## Deployment to GitHub Pages

### Initial Setup

1. **Configure GitHub Pages in your repository:**
   - Go to your repository on GitHub
   - Navigate to **Settings** > **Pages**
   - Under "Build and deployment":
     - **Source**: Select "Deploy from a branch"
     - **Branch**: Select `gh-pages` and `/ (root)`
   - Click **Save**

2. **Push your changes to GitHub:**
   ```bash
   npm run deploy
   ```
   
   This command will:
   - Stage all changes (`git add -A`)
   - Commit with the message "Deploy to GitHub Pages" 
   - Push to the `main` branch

3. **GitHub Actions will automatically deploy:**
   - The `.github/workflows/deploy.yml` workflow will trigger
   - It builds the project and deploys to the `gh-pages` branch
   - GitHub Pages will serve the site from the `gh-pages` branch

### Accessing Your Live Site

Once deployed, your site will be available at:

**https://JamiTheS.github.io/SUDOKU-ZEN/**

Note: Initial deployment may take a few minutes to propagate.

### Subsequent Deployments

To deploy updates, simply run:
```bash
npm run deploy
```

The automated workflow handles the rest!

## Project Structure

```
.
├── index.html              # Main app entry point
├── script.js               # Core Sudoku game logic
├── battle-manager.js       # Multiplayer battle mode
├── coop-manager.js         # Cooperative mode
├── firebase-monitor.js     # Connection monitoring
├── style.css               # Main styles
├── battle-styles.css       # Battle mode styles
├── icon.png                # App icon
├── www/                    # Build output (gitignored)
├── ios/                    # Capacitor iOS platform
└── .github/workflows/      # GitHub Actions workflows
```

## Firebase Configuration

The app uses Firebase Realtime Database for multiplayer features. Firebase configuration is included directly in `index.html`.

## Error Handling

The app includes comprehensive error handling:
- Real-time connection status monitoring
- Auto-reconnection on network loss
- User-friendly error messages (in French)
- Automatic retry mechanisms with exponential backoff
- Input validation for room codes and usernames

See `AGENTS.md` for detailed development guidelines.

## License

ISC
