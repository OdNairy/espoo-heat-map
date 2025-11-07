// Map Module - Handles map initialization and layer management

const mapModule = {
    map: null,
    currentView: 'year', // 'year' or 'type'
    layers: {
        yearHeatmap: null,
        typeHeatmap: null,
        buildings: null
    },

    /**
     * Initialize the map
     */
    init: async function() {
        // Check browser support
        const support = utils.checkBrowserSupport();
        if (!support.supported) {
            this.showError(support.errors.join(', '));
            return false;
        }

        // Proj4 projection not needed - data is pre-transformed

        // Initialize map
        try {
            this.map = new maplibregl.Map({
                container: 'map',
                style: CONFIG.mapStyle,
                center: CONFIG.map.center,
                zoom: CONFIG.map.zoom,
                minZoom: CONFIG.map.minZoom,
                maxZoom: CONFIG.map.maxZoom,
                pitch: CONFIG.map.pitch,
                bearing: CONFIG.map.bearing,
                attributionControl: false
            });

            // Add attribution control in custom position
            this.map.addControl(new maplibregl.AttributionControl({
                compact: true,
                customAttribution: 'Data: Espoo City | Map: OpenStreetMap'
            }), 'bottom-right');

            // Add navigation controls
            this.map.addControl(new maplibregl.NavigationControl({
                visualizePitch: true
            }), 'top-right');

            // Add geolocation control
            this.map.addControl(new maplibregl.GeolocateControl({
                positionOptions: {
                    enableHighAccuracy: true
                },
                trackUserLocation: false,
                showUserHeading: false
            }), 'top-right');

            // Add scale control
            this.map.addControl(new maplibregl.ScaleControl({
                maxWidth: 200,
                unit: 'metric'
            }), 'bottom-right');

            // Wait for map to load
            await new Promise(resolve => {
                this.map.on('load', resolve);
            });

            console.log('Map loaded successfully');
            return true;

        } catch (error) {
            console.error('Error initializing map:', error);
            this.showError('Failed to initialize map: ' + error.message);
            return false;
        }
    },

    /**
     * Add building data to map
     */
    addBuildingData: function(data) {
        if (!this.map || !data) return;

        console.log(`Adding ${data.features.length} buildings to map`);

        // Remove existing source if any
        if (this.map.getSource('buildings')) {
            this.removeAllLayers();
            this.map.removeSource('buildings');
        }

        // Add data source
        this.map.addSource('buildings', {
            type: 'geojson',
            data: data,
            generateId: true
        });

        // Add layers based on current view
        if (this.currentView === 'year') {
            this.addYearHeatmap();
        } else {
            this.addTypeHeatmap();
        }

        // Add click handlers
        this.addInteractions();
    },

    /**
     * Add year-based heatmap layer
     */
    addYearHeatmap: function() {
        if (!this.map.getSource('buildings')) return;

        // Remove existing heatmap layers
        if (this.map.getLayer('buildings-heat-year')) {
            this.map.removeLayer('buildings-heat-year');
        }

        // Add heatmap layer
        this.map.addLayer({
            id: 'buildings-heat-year',
            type: 'heatmap',
            source: 'buildings',
            paint: {
                // Weight by year (newer buildings = higher weight)
                'heatmap-weight': [
                    'interpolate',
                    ['linear'],
                    ['get', 'year'],
                    1900, 0.1,
                    1950, 0.3,
                    1980, 0.5,
                    2000, 0.7,
                    2024, 1
                ],

                // Increase intensity with zoom
                'heatmap-intensity': {
                    stops: CONFIG.heatmap.intensityStops
                },

                // Color ramp
                'heatmap-color': [
                    'interpolate',
                    ['linear'],
                    ['heatmap-density'],
                    ...CONFIG.colors.yearHeatmap.flat()
                ],

                // Adjust radius with zoom
                'heatmap-radius': {
                    stops: CONFIG.heatmap.radiusStops
                },

                // Fade out at high zoom
                'heatmap-opacity': {
                    stops: CONFIG.heatmap.opacityStops
                }
            }
        });

        // Add point layer for high zoom levels
        this.map.addLayer({
            id: 'buildings-points-year',
            type: 'circle',
            source: 'buildings',
            minzoom: 14,
            paint: {
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    14, 2,
                    18, 8
                ],
                'circle-color': [
                    'interpolate',
                    ['linear'],
                    ['get', 'year'],
                    1900, '#2166ac',
                    1950, '#67a9cf',
                    1980, '#d1e5f0',
                    2000, '#fddbc7',
                    2024, '#b2182b'
                ],
                'circle-opacity': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    14, 0,
                    15, 0.5,
                    16, 0.8
                ],
                'circle-stroke-width': 1,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-opacity': 0.8
            }
        });
    },

    /**
     * Add type-based heatmap layer
     */
    addTypeHeatmap: function() {
        if (!this.map.getSource('buildings')) return;

        // Remove existing layers
        if (this.map.getLayer('buildings-heat-type')) {
            this.map.removeLayer('buildings-heat-type');
        }

        // Add separate heatmap for each building type
        const types = Object.keys(CONFIG.colors.buildingTypeColors);

        types.forEach(type => {
            const layerId = `buildings-heat-${type}`;

            // Remove if exists
            if (this.map.getLayer(layerId)) {
                this.map.removeLayer(layerId);
            }

            // Add heatmap layer for this type
            this.map.addLayer({
                id: layerId,
                type: 'heatmap',
                source: 'buildings',
                filter: ['==', ['get', 'type'], type],
                paint: {
                    'heatmap-weight': 1,
                    'heatmap-intensity': {
                        stops: CONFIG.heatmap.intensityStops
                    },
                    'heatmap-color': [
                        'interpolate',
                        ['linear'],
                        ['heatmap-density'],
                        0, 'rgba(0, 0, 0, 0)',
                        0.5, CONFIG.colors.buildingTypeColors[type] + '80', // Semi-transparent
                        1, CONFIG.colors.buildingTypeColors[type]
                    ],
                    'heatmap-radius': {
                        stops: CONFIG.heatmap.radiusStops
                    },
                    'heatmap-opacity': {
                        stops: CONFIG.heatmap.opacityStops
                    }
                }
            });
        });

        // Add point layer for high zoom
        this.map.addLayer({
            id: 'buildings-points-type',
            type: 'circle',
            source: 'buildings',
            minzoom: 14,
            paint: {
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    14, 2,
                    18, 8
                ],
                'circle-color': [
                    'match',
                    ['get', 'type'],
                    'kerrostalo', CONFIG.colors.buildingTypeColors.kerrostalo,
                    'omakotitalo', CONFIG.colors.buildingTypeColors.omakotitalo,
                    'rivitalo', CONFIG.colors.buildingTypeColors.rivitalo,
                    'paritalo', CONFIG.colors.buildingTypeColors.paritalo,
                    CONFIG.colors.buildingTypeColors.muu
                ],
                'circle-opacity': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    14, 0,
                    15, 0.5,
                    16, 0.8
                ],
                'circle-stroke-width': 1,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-opacity': 0.8
            }
        });
    },

    /**
     * Switch between year and type views
     */
    switchView: function(view) {
        if (view === this.currentView) return;

        this.currentView = view;

        // Remove all existing layers
        this.removeAllLayers();

        // Add new layers
        if (view === 'year') {
            this.addYearHeatmap();
        } else {
            this.addTypeHeatmap();
        }

        console.log(`Switched to ${view} view`);
    },

    /**
     * Remove all building layers
     */
    removeAllLayers: function() {
        const layersToRemove = [
            'buildings-heat-year',
            'buildings-points-year',
            'buildings-heat-type',
            'buildings-points-type',
            // Type-specific heatmap layers
            'buildings-heat-kerrostalo',
            'buildings-heat-omakotitalo',
            'buildings-heat-rivitalo',
            'buildings-heat-paritalo',
            'buildings-heat-muu'
        ];

        layersToRemove.forEach(layerId => {
            if (this.map.getLayer(layerId)) {
                this.map.removeLayer(layerId);
            }
        });
    },

    /**
     * Update data source with filtered data
     */
    updateData: function(data) {
        if (!this.map || !data) return;

        const source = this.map.getSource('buildings');
        if (source) {
            source.setData(data);
        } else {
            this.addBuildingData(data);
        }
    },

    /**
     * Add map interactions (click, hover)
     */
    addInteractions: function() {
        // Cursor change on hover
        const pointLayers = ['buildings-points-year', 'buildings-points-type'];

        pointLayers.forEach(layer => {
            this.map.on('mouseenter', layer, () => {
                if (this.map.getLayer(layer)) {
                    this.map.getCanvas().style.cursor = 'pointer';
                }
            });

            this.map.on('mouseleave', layer, () => {
                this.map.getCanvas().style.cursor = '';
            });

            // Click handler for popup
            this.map.on('click', layer, (e) => {
                if (!this.map.getLayer(layer)) return;

                const properties = e.features[0].properties;
                this.showPopup(e.lngLat, properties);
            });
        });
    },

    /**
     * Show popup with building information
     */
    showPopup: function(lngLat, properties) {
        // Create popup content
        const content = this.createPopupContent(properties);

        // Create and show popup
        new maplibregl.Popup({
            closeButton: true,
            closeOnClick: true,
            maxWidth: '280px'
        })
            .setLngLat(lngLat)
            .setHTML(content)
            .addTo(this.map);
    },

    /**
     * Create popup content HTML
     */
    createPopupContent: function(props) {
        const year = props.year || '-';
        const type = props.typeName || props.type || '-';
        const floors = props.floors || '-';
        const area = props.floorArea ? utils.formatArea(props.floorArea) : '-';
        const address = props.address || '-';

        return `
            <div class="popup-content">
                <h3 class="popup-title">${type}</h3>
                <dl class="popup-details">
                    ${address !== '-' ? `
                        <dt>Osoite:</dt>
                        <dd>${address}</dd>
                    ` : ''}
                    <dt>Valmistunut:</dt>
                    <dd>${year}</dd>
                    <dt>Kerroksia:</dt>
                    <dd>${floors}</dd>
                    ${area !== '-' ? `
                        <dt>Kerrosala:</dt>
                        <dd>${area}</dd>
                    ` : ''}
                </dl>
            </div>
        `;
    },

    /**
     * Fit map to data bounds
     */
    fitBounds: function(data) {
        if (!this.map || !data || !data.features.length) return;

        const bounds = new maplibregl.LngLatBounds();

        data.features.forEach(feature => {
            if (feature.geometry && feature.geometry.coordinates) {
                bounds.extend(feature.geometry.coordinates);
            }
        });

        this.map.fitBounds(bounds, {
            padding: { top: 50, bottom: 50, left: 350, right: 50 },
            maxZoom: 14
        });
    },

    /**
     * Show error message
     */
    showError: function(message) {
        console.error(message);

        // Create error overlay
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <h3>Virhe / Error</h3>
            <p>${message}</p>
            <p>Yritä päivittää sivu / Try refreshing the page</p>
        `;

        document.getElementById('map').appendChild(errorDiv);
    },

    /**
     * Get current map bounds
     */
    getBounds: function() {
        if (!this.map) return null;
        return utils.getViewportBounds(this.map);
    },

    /**
     * Set map filter
     */
    setFilter: function(layerId, filter) {
        if (!this.map || !this.map.getLayer(layerId)) return;
        this.map.setFilter(layerId, filter);
    },

    /**
     * Toggle layer visibility
     */
    toggleLayer: function(layerId, visible) {
        if (!this.map || !this.map.getLayer(layerId)) return;

        this.map.setLayoutProperty(
            layerId,
            'visibility',
            visible ? 'visible' : 'none'
        );
    }
};