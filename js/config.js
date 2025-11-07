// Application Configuration
const CONFIG = {
    // Map Settings
    map: {
        center: [24.6559, 60.2055], // Espoo center coordinates
        zoom: 11,
        minZoom: 9,
        maxZoom: 18,
        pitch: 0,
        bearing: 0
    },

    // Map Style - Using OpenFreeMap (free vector tiles)
    mapStyle: 'https://tiles.openfreemap.org/styles/liberty',

    // WFS Endpoint for Espoo Buildings
    wfs: {
        endpoint: 'https://kartat.espoo.fi/teklaogcweb/wfs.ashx',
        typename: 'GIS:Rakennukset',
        outputFormat: 'json', // Try simpler format name
        maxFeatures: 50000, // Limit for performance
        // Note: The service uses EPSG:3879 (ETRS-GK25)
        srsName: 'EPSG:3879'
    },

    // Coordinate System Definitions
    projections: {
        // Finnish ETRS-GK25 projection
        'EPSG:3879': '+proj=tmerc +lat_0=0 +lon_0=25 +k=1 +x_0=25500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs'
    },

    // Building Types Mapping (Finnish to English)
    buildingTypes: {
        '011': { fi: 'Omakotitalo', en: 'Detached house', category: 'omakotitalo' },
        '012': { fi: 'Paritalo', en: 'Semi-detached house', category: 'paritalo' },
        '013': { fi: 'Rivitalo', en: 'Row house', category: 'rivitalo' },
        '021': { fi: 'Kerrostalo', en: 'Apartment building', category: 'kerrostalo' },
        '022': { fi: 'Luhtitalo', en: 'Gallery access building', category: 'kerrostalo' },
        '032': { fi: 'Asuntola', en: 'Dormitory', category: 'kerrostalo' },
        '041': { fi: 'Toimistorakennus', en: 'Office building', category: 'muu' },
        '111': { fi: 'Myymälä', en: 'Shop', category: 'muu' },
        '121': { fi: 'Hotelli', en: 'Hotel', category: 'muu' },
        '511': { fi: 'Koulu', en: 'School', category: 'muu' },
        '611': { fi: 'Sairaala', en: 'Hospital', category: 'muu' },
        'default': { fi: 'Muu rakennus', en: 'Other building', category: 'muu' }
    },

    // Color Schemes
    colors: {
        // Heatmap colors for construction year (old to new)
        yearHeatmap: [
            [0, 'rgba(33, 102, 172, 0)'],     // Transparent
            [0.2, 'rgb(103, 169, 207)'],      // Light blue (old buildings)
            [0.4, 'rgb(209, 229, 240)'],      // Very light blue
            [0.6, 'rgb(253, 219, 199)'],      // Light orange
            [0.8, 'rgb(239, 138, 98)'],       // Orange
            [1, 'rgb(178, 24, 43)']           // Red (new buildings)
        ],

        // Colors for building types
        buildingTypeColors: {
            'kerrostalo': '#FF6B6B',    // Red - Apartment buildings
            'omakotitalo': '#4ECDC4',   // Teal - Detached houses
            'rivitalo': '#45B7D1',      // Blue - Row houses
            'paritalo': '#95E1D3',      // Light green - Semi-detached
            'muu': '#FFE66D'            // Yellow - Other buildings
        }
    },

    // Heatmap Configuration
    heatmap: {
        // Weight configuration
        weightProperty: 'year', // or 'type'

        // Radius settings (pixels)
        radiusStops: [
            [9, 2],
            [11, 5],
            [13, 10],
            [15, 20],
            [17, 30]
        ],

        // Intensity settings
        intensityStops: [
            [9, 0.5],
            [11, 1],
            [13, 1.5],
            [15, 2]
        ],

        // Opacity settings
        opacityStops: [
            [14, 1],
            [16, 0.5],
            [18, 0]
        ]
    },

    // Filter Defaults
    filters: {
        yearMin: 1900,
        yearMax: new Date().getFullYear(),
        defaultYearRange: [1920, new Date().getFullYear()],
        buildingTypes: ['kerrostalo', 'omakotitalo', 'rivitalo', 'paritalo', 'muu']
    },

    // UI Configuration
    ui: {
        mobileBreakpoint: 768,
        panelWidth: 320,
        transitionDuration: 300
    },

    // Performance Settings
    performance: {
        maxFeatures: 50000,
        clusterRadius: 50,
        clusterMaxZoom: 14,
        debounceDelay: 300
    },

    // Localization
    locale: 'fi', // 'fi' or 'en'

    // Cache Settings
    cache: {
        enabled: true,
        duration: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
        storageKey: 'espoo-buildings-data'
    }
};

// Export for use in other modules (if using modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}