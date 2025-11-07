# Espoo Housing Heatmap / Espoon asuntojen lämpökartta

An interactive web application that visualizes housing in Espoo, Finland using heatmaps. View buildings by construction year or building type.

## Features

- 🗺️ Interactive map with heatmap visualization
- 📅 Filter by construction year (1900-2024)
- 🏘️ Filter by building type (apartments, detached houses, row houses, etc.)
- 📱 Mobile-responsive design
- 🔄 Two visualization modes: by year and by building type
- 📊 Real-time statistics
- 🎨 Color-coded legends
- 💾 Cached data for better performance

## Quick Start

### Option 1: Open directly in browser

Simply open `index.html` in a modern web browser. The application loads all dependencies from CDNs.

### Option 2: Use a local server (recommended)

```bash
# Using Python 3
python3 -m http.server 8000

# Using Node.js
npx http-server

# Using PHP
php -S localhost:8000
```

Then navigate to `http://localhost:8000` in your browser.

## Data Source

The application uses open building data from Espoo City:
- **WFS Endpoint**: `https://kartat.espoo.fi/teklaogcweb/wfs.ashx`
- **Update frequency**: Weekly
- **License**: Creative Commons Attribution 4.0

## Building Types

- **Kerrostalo** - Apartment buildings
- **Omakotitalo** - Detached houses
- **Rivitalo** - Row houses
- **Paritalo** - Semi-detached houses
- **Muu** - Other buildings

## Keyboard Shortcuts

- `1` - Switch to year view
- `2` - Switch to building type view
- `Ctrl+R` - Reset all filters
- `H` - Show help dialog
- `M` - Toggle menu (mobile only)
- `Esc` - Close dialogs/menu

## Browser Support

The application requires a modern browser with WebGL support:
- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## Deployment

### Deploy to Netlify (Recommended)

1. Fork or download this repository
2. Sign up for a free [Netlify account](https://netlify.com)
3. Drag and drop the project folder to Netlify
4. Your site will be live in seconds!

### Deploy to GitHub Pages

1. Push the code to a GitHub repository
2. Go to Settings → Pages
3. Select source branch and folder
4. Your site will be available at `https://[username].github.io/[repository-name]`

### Deploy to Vercel

1. Sign up for [Vercel](https://vercel.com)
2. Import your GitHub repository
3. Click deploy
4. No configuration needed!

## Configuration

Edit `js/config.js` to customize:
- Map center and zoom levels
- Color schemes
- Filter defaults
- Performance settings
- Cache duration

## Performance Optimization

The application includes several optimizations:
- Data caching (7-day duration)
- Progressive loading
- GPU-accelerated rendering
- Viewport-based filtering
- Debounced filter updates

## Development

### Project Structure

```
espoo-heat-map/
├── index.html           # Main HTML file
├── css/
│   └── main.css        # All styles
├── js/
│   ├── config.js       # Configuration
│   ├── utils.js        # Utility functions
│   ├── data-loader.js  # Data fetching
│   ├── map.js          # Map management
│   ├── filters.js      # Filter logic
│   ├── ui.js           # UI interactions
│   └── main.js         # Application entry
└── README.md           # This file
```

### Customization Examples

#### Change map style
```javascript
// In config.js
mapStyle: 'https://tiles.openfreemap.org/styles/bright'
```

#### Adjust heatmap colors
```javascript
// In config.js
colors: {
    yearHeatmap: [
        [0, 'rgba(0, 0, 255, 0)'],
        [1, 'rgba(255, 0, 0, 1)']
    ]
}
```

#### Add new building types
```javascript
// In config.js
buildingTypes: {
    '123': { fi: 'Uusi tyyppi', en: 'New type', category: 'custom' }
}
```

## Troubleshooting

### Data not loading
- Check browser console for errors
- Verify internet connection
- Clear browser cache and localStorage
- Try using sample/fallback data

### Poor performance
- Reduce `maxFeatures` in config.js
- Increase `debounceDelay`
- Use Chrome/Edge for best performance
- Close other browser tabs

### Map not showing
- Ensure WebGL is enabled in browser
- Check for browser extensions blocking scripts
- Try a different browser

## API Reference

The application exposes a global object for debugging:

```javascript
window.espooHeatmapApp

// Available methods:
espooHeatmapApp.refresh()        // Refresh data
espooHeatmapApp.exportImage()    // Save map as image
espooHeatmapApp.showHelp()       // Show help dialog
espooHeatmapApp.resetFilters()   // Reset all filters

// Access modules:
espooHeatmapApp.modules.map      // Map module
espooHeatmapApp.modules.data     // Data loader
espooHeatmapApp.modules.filters  // Filter module
espooHeatmapApp.modules.ui       // UI module
```

## License

This project is open source and available under the MIT License.

## Credits

- **Data**: Espoo City Open Data
- **Maps**: OpenFreeMap / OpenStreetMap contributors
- **Libraries**: MapLibre GL JS, Proj4js

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## Contact

For questions or feedback, please open an issue on GitHub.

---

Built with ❤️ for exploring Espoo's urban development