// Main Application Entry Point

(function() {
    'use strict';

    /**
     * Application state
     */
    const app = {
        initialized: false,
        data: null,
        error: null
    };

    /**
     * Initialize the application
     */
    async function init() {
        try {
            console.log('Initializing Espoo Housing Heatmap...');

            // Show loading overlay
            ui.setLoading(true, 'Alustetaan karttaa... / Initializing map...');

            // Add dynamic styles
            ui.addDynamicStyles();

            // Initialize UI
            ui.init();

            // Initialize map
            const mapInitialized = await mapModule.init();
            if (!mapInitialized) {
                throw new Error('Failed to initialize map');
            }

            // Initialize filters (after map is ready)
            filters.init();

            // Load data
            ui.setLoading(true, 'Ladataan rakennustietoja... / Loading building data...');
            app.data = await dataLoader.init();

            if (!app.data || !app.data.features) {
                throw new Error('No building data available');
            }

            console.log(`Loaded ${app.data.features.length} buildings`);

            // Add data to map
            mapModule.addBuildingData(app.data);

            // Apply initial filters
            filters.applyFilters();

            // Initialize legend
            filters.updateLegend(mapModule.currentView);

            // Load URL parameters if any
            ui.loadFromURL();

            // Initialize share functionality
            ui.initShare();

            // Update statistics
            const stats = dataLoader.calculateStats(app.data.features);
            filters.updateStatistics(app.data.features);

            // Hide loading overlay
            ui.setLoading(false);

            // Show success message
            ui.showNotification(`Ladattu ${utils.formatNumber(app.data.features.length)} rakennusta`, 'success');

            // Mark as initialized
            app.initialized = true;

            console.log('Application initialized successfully');

        } catch (error) {
            console.error('Initialization error:', error);
            handleError(error);
        }
    }

    /**
     * Handle initialization errors
     */
    function handleError(error) {
        app.error = error;

        // Hide loading overlay
        ui.setLoading(false);

        // Show error message
        const message = error.message || 'Unknown error occurred';

        if (message.includes('WebGL')) {
            ui.showError('WebGL ei ole tuettu selaimessasi. Kokeile toista selainta. / WebGL is not supported in your browser. Try a different browser.');
        } else if (message.includes('WFS')) {
            ui.showError('Rakennustietojen lataus epäonnistui. Yritä myöhemmin uudelleen. / Failed to load building data. Please try again later.');
        } else {
            ui.showError(`Virhe: ${message}`);
        }

        // Try to show map anyway with sample data
        if (mapModule.map && !app.data) {
            const fallbackData = dataLoader.loadFallbackData();
            if (fallbackData) {
                mapModule.addBuildingData(fallbackData);
                ui.showNotification('Käytetään esimerkkitietoja / Using sample data', 'info');
            }
        }
    }

    /**
     * Refresh data from server
     */
    async function refreshData() {
        try {
            console.log('Refreshing data...');

            // Clear cache
            dataLoader.clear();

            // Reload data
            const newData = await dataLoader.loadBuildingData();

            if (newData && newData.features) {
                app.data = newData;
                mapModule.updateData(newData);
                filters.applyFilters();
                ui.showNotification('Tiedot päivitetty / Data updated', 'success');
            }
        } catch (error) {
            console.error('Failed to refresh data:', error);
        }
    }

    /**
     * Set up global error handler
     */
    window.addEventListener('error', (event) => {
        console.error('Global error:', event.error);
        if (!app.initialized) {
            handleError(event.error);
        }
    });

    /**
     * Handle unhandled promise rejections
     */
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
        if (!app.initialized) {
            handleError(new Error(event.reason));
        }
    });

    /**
     * Save state before unload
     */
    window.addEventListener('beforeunload', () => {
        // Save current filter state to localStorage
        try {
            const state = filters.getFilterState();
            localStorage.setItem('espoo-heatmap-state', JSON.stringify(state));
        } catch (e) {
            // Ignore errors
        }
    });

    /**
     * Restore state on load
     */
    window.addEventListener('load', () => {
        // Check for saved state
        try {
            const savedState = localStorage.getItem('espoo-heatmap-state');
            if (savedState && !window.location.search) {
                const state = JSON.parse(savedState);
                // State will be applied after initialization
                window.savedFilterState = state;
            }
        } catch (e) {
            // Ignore errors
        }
    });

    /**
     * Handle visibility change (tab switching)
     */
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && app.initialized) {
            // Refresh map when tab becomes visible
            if (mapModule.map) {
                mapModule.map.resize();
            }
        }
    });

    /**
     * Export app object for debugging
     */
    window.espooHeatmapApp = {
        app: app,
        modules: {
            map: mapModule,
            data: dataLoader,
            filters: filters,
            ui: ui,
            utils: utils
        },
        refresh: refreshData,
        exportImage: () => ui.exportImage(),
        showHelp: () => ui.showHelp(),
        resetFilters: () => filters.resetFilters(),
        config: CONFIG
    };

    /**
     * Start the application when DOM is ready
     */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM already loaded
        init();
    }

    /**
     * Log application info
     */
    console.log('%cEspoo Housing Heatmap', 'color: #0066cc; font-size: 20px; font-weight: bold');
    console.log('%cVersion 1.0.0', 'color: #666; font-size: 12px');
    console.log('%cData source: Espoo City Open Data', 'color: #666; font-size: 12px');
    console.log('%cFor debugging, use: window.espooHeatmapApp', 'color: #666; font-size: 12px');

})();