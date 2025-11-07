// Data Loading and Processing Module

const dataLoader = {
    buildingsData: null,
    processedData: null,

    /**
     * Initialize the data loader
     */
    init: async function() {
        // Load data from static file
        return await this.loadBuildingData();
    },

    /**
     * Load building data from static JSON file
     */
    loadBuildingData: async function() {
        try {
            console.log('Loading building data from static file...');

            // Fetch the static JSON file
            const response = await fetch(CONFIG.dataFile);

            if (!response.ok) {
                throw new Error(`Failed to load building data: ${response.status}`);
            }

            const data = await response.json();

            if (!data.features || data.features.length === 0) {
                throw new Error('No building data in file');
            }

            console.log(`Loaded ${data.features.length} buildings`);

            // Display metadata if available
            if (data.metadata) {
                console.log('Data generated at:', data.metadata.generatedAt);
                if (data.metadata.statistics) {
                    const stats = data.metadata.statistics;
                    console.log('Statistics:');
                    console.log(`  Total buildings: ${stats.total}`);
                    console.log(`  By type:`, stats.byType);
                    console.log(`  Total floor area: ${Math.round(stats.totalFloorArea).toLocaleString()} m²`);
                }
            }

            // The data is already processed (from update script), just return it
            this.buildingsData = data;
            this.processedData = data;

            return this.processedData;

        } catch (error) {
            console.error('Error loading building data:', error);

            // Try to load fallback data or show error
            return this.loadFallbackData();
        }
    },


    /**
     * Load fallback data (simplified or cached)
     */
    loadFallbackData: async function() {
        console.log('Loading fallback data...');

        // Create some sample data for testing
        const sampleData = {
            type: 'FeatureCollection',
            features: this.generateSampleData(),
            stats: {
                total: 100,
                byType: {
                    kerrostalo: 30,
                    omakotitalo: 40,
                    rivitalo: 20,
                    paritalo: 5,
                    muu: 5
                },
                byDecade: {
                    1960: 10,
                    1970: 15,
                    1980: 20,
                    1990: 20,
                    2000: 20,
                    2010: 15
                }
            }
        };

        return sampleData;
    },

    /**
     * Generate sample data for testing
     */
    generateSampleData: function() {
        const features = [];
        const center = CONFIG.map.center;
        const types = ['kerrostalo', 'omakotitalo', 'rivitalo', 'paritalo', 'muu'];

        // Generate 100 random points around Espoo
        for (let i = 0; i < 100; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            const year = 1920 + Math.floor(Math.random() * 104); // 1920-2024

            features.push({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [
                        center[0] + (Math.random() - 0.5) * 0.3,
                        center[1] + (Math.random() - 0.5) * 0.2
                    ]
                },
                properties: {
                    id: `sample_${i}`,
                    year: year,
                    type: type,
                    typeName: CONFIG.buildingTypes[type === 'kerrostalo' ? '021' :
                               type === 'omakotitalo' ? '011' :
                               type === 'rivitalo' ? '013' :
                               type === 'paritalo' ? '012' : 'default'][CONFIG.locale],
                    floors: Math.ceil(Math.random() * 5),
                    floorArea: Math.round(Math.random() * 5000),
                    address: `Esimerkkitie ${i + 1}`,
                    postalCode: '02100',
                    ageGroup: utils.getAgeGroup(year)
                }
            });
        }

        return features;
    },

    /**
     * Filter data by year range
     */
    filterByYear: function(minYear, maxYear) {
        if (!this.processedData) return null;

        return {
            ...this.processedData,
            features: this.processedData.features.filter(f => {
                const year = f.properties.year;
                return year && year >= minYear && year <= maxYear;
            })
        };
    },

    /**
     * Filter data by building types
     */
    filterByTypes: function(types) {
        if (!this.processedData) return null;

        return {
            ...this.processedData,
            features: this.processedData.features.filter(f =>
                types.includes(f.properties.type)
            )
        };
    },

    /**
     * Get combined filters
     */
    getFilteredData: function(filters) {
        if (!this.processedData) return null;

        let filtered = this.processedData.features;

        // Apply year filter
        if (filters.yearMin !== undefined && filters.yearMax !== undefined) {
            filtered = filtered.filter(f => {
                const year = f.properties.year;
                return year && year >= filters.yearMin && year <= filters.yearMax;
            });
        }

        // Apply type filter
        if (filters.types && filters.types.length > 0) {
            filtered = filtered.filter(f =>
                filters.types.includes(f.properties.type)
            );
        }

        // Apply viewport filter if provided
        if (filters.bounds) {
            filtered = utils.filterByViewport(filtered, filters.bounds);
        }

        return {
            type: 'FeatureCollection',
            features: filtered
        };
    },

    /**
     * Calculate statistics for filtered data
     */
    calculateStats: function(features) {
        const stats = {
            count: features.length,
            totalFloorArea: 0,
            avgYear: 0,
            byType: {}
        };

        let yearSum = 0;
        let yearCount = 0;

        features.forEach(f => {
            const props = f.properties;

            // Sum floor area
            if (props.floorArea) {
                stats.totalFloorArea += props.floorArea;
            }

            // Calculate average year
            if (props.year) {
                yearSum += props.year;
                yearCount++;
            }

            // Count by type
            if (props.type) {
                stats.byType[props.type] = (stats.byType[props.type] || 0) + 1;
            }
        });

        if (yearCount > 0) {
            stats.avgYear = Math.round(yearSum / yearCount);
        }

        return stats;
    },

    /**
     * Clear all data
     */
    clear: function() {
        this.buildingsData = null;
        this.processedData = null;
    }
};