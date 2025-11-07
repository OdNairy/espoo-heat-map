// Data Loading and Processing Module

const dataLoader = {
    buildingsData: null,
    processedData: null,

    /**
     * Initialize the data loader
     */
    init: async function() {
        // Check for cached data first
        if (CONFIG.cache.enabled) {
            const cached = utils.getCache(CONFIG.cache.storageKey);
            if (cached) {
                console.log('Using cached building data');
                this.processedData = cached;
                return cached;
            }
        }

        // Load fresh data
        return await this.loadBuildingData();
    },

    /**
     * Load building data from WFS
     */
    loadBuildingData: async function() {
        try {
            console.log('Fetching building data from WFS...');

            // Try different output formats that WFS servers commonly support
            const formats = ['json', 'application/json', 'GeoJSON', 'application/geo+json'];
            let data = null;

            for (const format of formats) {
                try {
                    // Build WFS request URL
                    const params = new URLSearchParams({
                        service: 'WFS',
                        version: '1.1.0', // Changed from 2.0.0 which is not supported
                        request: 'GetFeature',
                        typename: CONFIG.wfs.typename,
                        outputFormat: format,
                        srsName: CONFIG.wfs.srsName,
                        maxFeatures: CONFIG.wfs.maxFeatures
                    });

                    const url = `${CONFIG.wfs.endpoint}?${params.toString()}`;
                    console.log(`Trying format: ${format}`);

                    // Fetch data
                    const response = await fetch(url);

                    if (!response.ok) {
                        console.log(`Format ${format} failed with status: ${response.status}`);
                        continue;
                    }

                    // Check content type
                    const contentType = response.headers.get('content-type');

                    if (contentType && contentType.includes('json')) {
                        data = await response.json();
                        console.log(`Success with format: ${format}`);
                        break;
                    } else {
                        // If it's XML or other format, skip
                        console.log(`Format ${format} returned non-JSON content: ${contentType}`);
                        continue;
                    }
                } catch (err) {
                    console.log(`Format ${format} error:`, err.message);
                    continue;
                }
            }

            // If JSON didn't work, try XML parsing
            if (!data) {
                console.log('JSON formats failed, trying XML parsing...');

                try {
                    // Fetch XML without outputFormat parameter
                    const params = new URLSearchParams({
                        service: 'WFS',
                        version: '1.1.0', // Changed from 2.0.0 which is not supported
                        request: 'GetFeature',
                        typename: CONFIG.wfs.typename,
                        srsName: CONFIG.wfs.srsName,
                        maxFeatures: Math.min(CONFIG.wfs.maxFeatures, 1000) // Start with fewer features for testing
                    });

                    const url = `${CONFIG.wfs.endpoint}?${params.toString()}`;
                    console.log('Fetching XML from:', url);

                    const response = await fetch(url);

                    if (!response.ok) {
                        throw new Error(`WFS XML request failed: ${response.status}`);
                    }

                    const xmlText = await response.text();
                    console.log('Received XML response, parsing...');

                    // Parse XML to GeoJSON
                    if (window.xmlParser) {
                        data = xmlParser.parseWFSResponse(xmlText);
                        console.log(`Parsed ${data.features.length} features from XML`);
                    } else {
                        throw new Error('XML parser not available');
                    }
                } catch (xmlError) {
                    console.error('XML parsing failed:', xmlError);
                    throw new Error('Could not fetch data from WFS service in any format');
                }
            }

            if (!data.features || data.features.length === 0) {
                throw new Error('No building data received from WFS');
            }

            console.log(`Loaded ${data.features.length} buildings`);

            // Process the data
            this.buildingsData = data;
            this.processedData = this.processFeatures(data.features);

            // Cache the processed data
            if (CONFIG.cache.enabled) {
                utils.setCache(CONFIG.cache.storageKey, this.processedData);
            }

            return this.processedData;

        } catch (error) {
            console.error('Error loading building data:', error);

            // Try to load fallback data or show error
            return this.loadFallbackData();
        }
    },

    /**
     * Process raw features from WFS
     */
    processFeatures: function(features) {
        console.log('Processing building features...');

        const processed = {
            type: 'FeatureCollection',
            features: []
        };

        const pointFeatures = [];
        const stats = {
            total: 0,
            byType: {},
            byDecade: {},
            missingYear: 0,
            missingType: 0
        };

        features.forEach(feature => {
            try {
                // Transform geometry coordinates
                const transformedGeometry = utils.transformGeometry(feature.geometry);

                // Get center point for heatmap
                let centerPoint;
                if (transformedGeometry.type === 'Point') {
                    centerPoint = transformedGeometry.coordinates;
                } else if (transformedGeometry.type === 'Polygon') {
                    centerPoint = utils.getPolygonCenter(transformedGeometry.coordinates);
                } else if (transformedGeometry.type === 'MultiPolygon') {
                    // Use first polygon's center
                    centerPoint = utils.getPolygonCenter(transformedGeometry.coordinates[0]);
                }

                if (!centerPoint) return;

                // Extract and parse properties
                const props = feature.properties || {};

                // Parse construction year
                let year = null;
                if (props.VALMISTUNUT) {
                    year = utils.parseYear(props.VALMISTUNUT);
                } else if (props.valmistunut) {
                    year = utils.parseYear(props.valmistunut);
                } else if (props.VALMISTUNUT_VUOSI) {
                    year = parseInt(props.VALMISTUNUT_VUOSI);
                }

                if (!year || year < 1800 || year > new Date().getFullYear() + 1) {
                    year = null;
                    stats.missingYear++;
                }

                // Get building type
                let buildingType = 'muu';
                let typeCode = props.KAYTTOTARKOITUS || props.kayttotarkoitus || props.RAKENNUSTYYPPI;

                if (typeCode) {
                    buildingType = utils.getBuildingCategory(typeCode);
                } else {
                    stats.missingType++;
                }

                // Get other properties
                const floors = parseInt(props.KERROSLUKU || props.kerrosluku) || null;
                const floorArea = parseFloat(props.KERROSALA || props.kerrosala) || null;
                const totalArea = parseFloat(props.KOKONAISALA || props.kokonaisala) || null;
                const volume = parseFloat(props.TILAVUUS || props.tilavuus) || null;
                const address = props.OSOITE || props.osoite || props.KATUOSOITE || '';
                const postalCode = props.POSTINUMERO || props.postinumero || '';

                // Create point feature for heatmap
                const pointFeature = {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: centerPoint
                    },
                    properties: {
                        id: utils.generateId('building'),
                        year: year,
                        type: buildingType,
                        typeCode: typeCode,
                        typeName: utils.getBuildingTypeName(typeCode, CONFIG.locale),
                        floors: floors,
                        floorArea: floorArea,
                        totalArea: totalArea,
                        volume: volume,
                        address: address,
                        postalCode: postalCode,
                        ageGroup: year ? utils.getAgeGroup(year) : null
                    }
                };

                pointFeatures.push(pointFeature);

                // Update statistics
                stats.total++;

                if (buildingType) {
                    stats.byType[buildingType] = (stats.byType[buildingType] || 0) + 1;
                }

                if (year) {
                    const decade = Math.floor(year / 10) * 10;
                    stats.byDecade[decade] = (stats.byDecade[decade] || 0) + 1;
                }

            } catch (error) {
                console.error('Error processing feature:', error);
            }
        });

        processed.features = pointFeatures;
        processed.stats = stats;

        console.log('Processing complete:', stats);

        return processed;
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

        if (CONFIG.cache.enabled) {
            localStorage.removeItem(CONFIG.cache.storageKey);
        }
    }
};