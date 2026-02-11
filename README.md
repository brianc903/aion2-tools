# Aion2 Character Search Tool

A React-based web application for searching and viewing Aion2 character information.

## Features

✨ **Character Search** - Search for characters by name and server
📊 **Character Details** - View PVE score, item level, class, and level
💾 **Saved Searches** - Automatically saves your search history in browser localStorage
🎨 **Beautiful UI** - Modern, responsive design with gradient backgrounds

## How to Use

1. **Enter Character Information**
   - Type the character name in the "Character Name" field
   - Enter the server name (default: 露梅)

2. **Search**
   - Click the "🔍 Search Character" button
   - The app will fetch data from the Aion API

3. **View Results**
   - PVE Score
   - Item Level
   - Character Class
   - Character Level

4. **Saved Searches**
   - Your searches are automatically saved
   - Click on any saved search to quickly reload it
   - Click the × button to remove a saved search
   - Click "Clear All" to remove all saved searches

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
```

### Access the App
Open your browser and navigate to: http://127.0.0.1:5173/

## API Endpoint

The app uses the Aion API:
```
https://aion-api.bnshive.com/character/query?name={NAME}&server={SERVER}
```

## Technologies Used

- **React 18** - UI framework
- **Vite 4** - Build tool and dev server
- **CSS3** - Styling with gradients and animations
- **localStorage** - Client-side data persistence

## Project Structure

```
aion2-tools/
├── src/
│   ├── App.jsx          # Main application component
│   ├── App.css          # Application styles
│   ├── main.jsx         # React entry point
│   └── index.css        # Global styles
├── index.html           # HTML template
├── package.json         # Project dependencies
└── vite.config.js       # Vite configuration
```

## Features in Detail

### Character Details Displayed

1. **PVE Score** - Located at `ratings.PVE.score` in the API response
2. **Item Level** - Found in `queryResult.data.stat.statList[]` where `type='ItemLevel'`
3. **Class** - Located at `queryResult.data.profile.className`
4. **Level** - Character level from profile

### Data Persistence

- Usernames and servers are saved in browser localStorage
- Maximum of 10 recent searches are kept
- Data persists across browser sessions
- Each entry can be individually removed

## Development

To modify the app:

1. Edit `src/App.jsx` for functionality changes
2. Edit `src/App.css` for styling changes
3. The dev server hot-reloads on file changes

## Browser Compatibility

Works on all modern browsers:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## License

This project is open source and available for personal use.
