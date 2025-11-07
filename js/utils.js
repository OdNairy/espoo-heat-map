// Utility Functions

const utils = {
    /**
     * Debounce function to limit function calls
     */
    debounce: function(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Format number with thousand separators
     */
    formatNumber: function(num) {
        if (num === null || num === undefined) return '-';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    },

    /**
     * Format area in square meters
     */
    formatArea: function(area) {
        if (!area) return '-';
        return `${this.formatNumber(Math.round(area))} m²`;
    },

    /**
     * Parse year from various date formats
     */
    parseYear: function(dateString) {
        if (!dateString) return null;

        // Handle different date formats
        // Format: YYYYMMDD
        if (/^\d{8}$/.test(dateString)) {
            return parseInt(dateString.substring(0, 4));
        }

        // Format: YYYY-MM-DD or YYYY/MM/DD
        if (/^\d{4}[-\/]\d{2}[-\/]\d{2}$/.test(dateString)) {
            return parseInt(dateString.substring(0, 4));
        }

        // Format: just YYYY
        if (/^\d{4}$/.test(dateString)) {
            return parseInt(dateString);
        }

        // Try to extract any 4-digit year
        const yearMatch = dateString.match(/\d{4}/);
        if (yearMatch) {
            return parseInt(yearMatch[0]);
        }

        return null;
    },

    /**
     * Get building type category from code
     */
    getBuildingCategory: function(typeCode) {
        if (!typeCode) return 'muu';

        // First try numeric code
        const typeStr = typeCode.toString().padStart(3, '0');
        const typeInfo = CONFIG.buildingTypes[typeStr];
        if (typeInfo) return typeInfo.category;

        // Then try text-based matching
        const typeText = typeCode.toString().toLowerCase();

        // Map Finnish building type names to categories
        if (typeText.includes('kerrostalo') || typeText.includes('asuinkerrostalo')) {
            return 'kerrostalo';
        } else if (typeText.includes('omakotitalo') || typeText.includes('yhden asunnon')) {
            return 'omakotitalo';
        } else if (typeText.includes('rivitalo') || typeText.includes('kytketty')) {
            return 'rivitalo';
        } else if (typeText.includes('paritalo') || typeText.includes('kahden asunnon')) {
            return 'paritalo';
        } else if (typeText.includes('asuin') || typeText.includes('talo')) {
            // Generic residential buildings
            return 'kerrostalo';
        }

        return 'muu';
    },

    /**
     * Get building type name (localized)
     */
    getBuildingTypeName: function(typeCode, locale = 'fi') {
        if (!typeCode) return CONFIG.buildingTypes.default[locale];

        const typeStr = typeCode.toString().padStart(3, '0');
        const typeInfo = CONFIG.buildingTypes[typeStr];

        if (typeInfo) {
            return typeInfo[locale];
        }

        return CONFIG.buildingTypes.default[locale];
    },

    /**
     * Calculate age group for color coding
     */
    getAgeGroup: function(year) {
        const currentYear = new Date().getFullYear();
        const age = currentYear - year;

        if (age < 10) return 'new';        // Less than 10 years
        if (age < 30) return 'recent';     // 10-30 years
        if (age < 50) return 'middle';     // 30-50 years
        if (age < 80) return 'old';        // 50-80 years
        return 'historic';                  // More than 80 years
    },

    /**
     * Transform coordinates from EPSG:3879 to WGS84
     */
    transformCoordinates: function(coords) {
        if (!proj4 || !coords) return coords;

        try {
            // Define projection if not already defined
            if (!proj4.defs('EPSG:3879')) {
                proj4.defs('EPSG:3879', CONFIG.projections['EPSG:3879']);
            }

            // Transform coordinates
            return proj4('EPSG:3879', 'WGS84', coords);
        } catch (error) {
            console.error('Coordinate transformation error:', error);
            return coords;
        }
    },

    /**
     * Transform GeoJSON geometry coordinates
     */
    transformGeometry: function(geometry) {
        if (!geometry || !geometry.coordinates) return geometry;

        const transformCoordRecursive = (coords) => {
            if (typeof coords[0] === 'number') {
                // Single coordinate pair
                return this.transformCoordinates(coords);
            } else {
                // Nested coordinates
                return coords.map(c => transformCoordRecursive(c));
            }
        };

        return {
            ...geometry,
            coordinates: transformCoordRecursive(geometry.coordinates)
        };
    },

    /**
     * Calculate center point of polygon
     */
    getPolygonCenter: function(coordinates) {
        if (!coordinates || !coordinates[0]) return null;

        let totalX = 0;
        let totalY = 0;
        let count = 0;

        // Handle polygon (first array is outer ring)
        const ring = coordinates[0];

        for (let i = 0; i < ring.length - 1; i++) { // Skip last point (same as first)
            totalX += ring[i][0];
            totalY += ring[i][1];
            count++;
        }

        if (count === 0) return null;

        return [totalX / count, totalY / count];
    },

    /**
     * Check if browser supports required features
     */
    checkBrowserSupport: function() {
        const errors = [];

        if (!window.maplibregl) {
            errors.push('MapLibre GL JS not loaded');
        }

        // Check WebGL support directly
        if (window.maplibregl) {
            try {
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                if (!gl) {
                    errors.push('WebGL is not supported in your browser');
                }
            } catch (e) {
                errors.push('WebGL is not supported in your browser');
            }
        }

        if (!window.proj4) {
            errors.push('Proj4js not loaded');
        }

        if (!window.fetch) {
            errors.push('Fetch API not supported');
        }

        return {
            supported: errors.length === 0,
            errors: errors
        };
    },

    /**
     * Get viewport bounds
     */
    getViewportBounds: function(map) {
        if (!map) return null;

        const bounds = map.getBounds();
        return {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest()
        };
    },

    /**
     * Filter features by viewport
     */
    filterByViewport: function(features, bounds) {
        if (!bounds || !features) return features;

        return features.filter(feature => {
            if (!feature.geometry || !feature.geometry.coordinates) return false;

            let coords;
            if (feature.geometry.type === 'Point') {
                coords = feature.geometry.coordinates;
            } else if (feature.geometry.type === 'Polygon') {
                coords = this.getPolygonCenter(feature.geometry.coordinates);
            } else {
                return true; // Include other geometry types
            }

            if (!coords) return false;

            return coords[0] >= bounds.west &&
                   coords[0] <= bounds.east &&
                   coords[1] >= bounds.south &&
                   coords[1] <= bounds.north;
        });
    },

    /**
     * Create year range for legend
     */
    createYearRanges: function(minYear = 1900, maxYear = new Date().getFullYear()) {
        const ranges = [];
        const step = 20; // 20-year intervals

        for (let year = minYear; year < maxYear; year += step) {
            ranges.push({
                min: year,
                max: Math.min(year + step - 1, maxYear),
                label: `${year}-${Math.min(year + step - 1, maxYear)}`
            });
        }

        return ranges;
    },

    /**
     * Check if mobile device
     */
    isMobile: function() {
        return window.innerWidth <= CONFIG.ui.mobileBreakpoint;
    },

    /**
     * Store data in localStorage with expiry
     */
    setCache: function(key, data, expiryMs = CONFIG.cache.duration) {
        try {
            const item = {
                data: data,
                expiry: new Date().getTime() + expiryMs
            };
            localStorage.setItem(key, JSON.stringify(item));
            return true;
        } catch (e) {
            console.error('Cache storage error:', e);
            return false;
        }
    },

    /**
     * Get data from localStorage with expiry check
     */
    getCache: function(key) {
        try {
            const itemStr = localStorage.getItem(key);
            if (!itemStr) return null;

            const item = JSON.parse(itemStr);
            const now = new Date().getTime();

            if (now > item.expiry) {
                localStorage.removeItem(key);
                return null;
            }

            return item.data;
        } catch (e) {
            console.error('Cache retrieval error:', e);
            return null;
        }
    },

    /**
     * Clear expired cache items
     */
    clearExpiredCache: function() {
        const keys = Object.keys(localStorage);
        const now = new Date().getTime();

        keys.forEach(key => {
            try {
                const item = JSON.parse(localStorage.getItem(key));
                if (item && item.expiry && now > item.expiry) {
                    localStorage.removeItem(key);
                }
            } catch (e) {
                // Invalid JSON, might be other localStorage data
            }
        });
    },

    /**
     * Generate unique ID
     */
    generateId: function(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
};