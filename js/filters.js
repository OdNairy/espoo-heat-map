// Filters Module - Handles data filtering

const filters = {
    currentFilters: {
        yearMin: CONFIG.filters.defaultYearRange[0],
        yearMax: CONFIG.filters.defaultYearRange[1],
        types: [...CONFIG.filters.buildingTypes],
        bounds: null
    },

    yearSlider: null,

    /**
     * Initialize filters
     */
    init: function() {
        this.initYearSlider();
        this.initTypeCheckboxes();
        this.initViewToggle();

        // Update filters when map moves
        if (mapModule.map) {
            mapModule.map.on('moveend', utils.debounce(() => {
                this.updateBounds();
                this.applyFilters();
            }, CONFIG.performance.debounceDelay));
        }
    },

    /**
     * Initialize year range slider
     */
    initYearSlider: function() {
        const sliderContainer = document.getElementById('year-slider');
        if (!sliderContainer) return;

        // Create simple range slider using native HTML5 inputs
        const minInput = document.createElement('input');
        minInput.type = 'range';
        minInput.id = 'year-min-slider';
        minInput.min = CONFIG.filters.yearMin;
        minInput.max = CONFIG.filters.yearMax;
        minInput.value = this.currentFilters.yearMin;
        minInput.style.width = '100%';

        const maxInput = document.createElement('input');
        maxInput.type = 'range';
        maxInput.id = 'year-max-slider';
        maxInput.min = CONFIG.filters.yearMin;
        maxInput.max = CONFIG.filters.yearMax;
        maxInput.value = this.currentFilters.yearMax;
        maxInput.style.width = '100%';
        maxInput.style.marginTop = '10px';

        sliderContainer.appendChild(minInput);
        sliderContainer.appendChild(maxInput);

        // Update display and filters when sliders change
        const updateYearRange = utils.debounce(() => {
            const minVal = parseInt(minInput.value);
            const maxVal = parseInt(maxInput.value);

            // Ensure min doesn't exceed max
            if (minVal > maxVal) {
                if (event.target === minInput) {
                    maxInput.value = minVal;
                } else {
                    minInput.value = maxVal;
                }
            }

            this.currentFilters.yearMin = Math.min(minVal, maxVal);
            this.currentFilters.yearMax = Math.max(minVal, maxVal);

            // Update display
            document.getElementById('year-min').textContent = this.currentFilters.yearMin;
            document.getElementById('year-max').textContent = this.currentFilters.yearMax;

            // Apply filters
            this.applyFilters();
        }, CONFIG.performance.debounceDelay);

        minInput.addEventListener('input', updateYearRange);
        maxInput.addEventListener('input', updateYearRange);

        // Store reference
        this.yearSlider = { min: minInput, max: maxInput };
    },

    /**
     * Initialize building type checkboxes
     */
    initTypeCheckboxes: function() {
        const checkboxes = document.querySelectorAll('input[name="building-type"]');

        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateTypeFilter();
                this.applyFilters();
            });
        });
    },

    /**
     * Initialize view mode toggle
     */
    initViewToggle: function() {
        const viewRadios = document.querySelectorAll('input[name="view-mode"]');

        viewRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const view = e.target.value;
                this.switchView(view);
            });
        });
    },

    /**
     * Switch between year and type views
     */
    switchView: function(view) {
        // Update map view
        mapModule.switchView(view);

        // Show/hide relevant controls
        const yearControls = document.getElementById('year-controls');
        const typeControls = document.getElementById('type-controls');

        if (view === 'year') {
            yearControls.style.display = 'block';
            typeControls.style.display = 'none';
        } else {
            yearControls.style.display = 'none';
            typeControls.style.display = 'block';
        }

        // Update legend
        this.updateLegend(view);
    },

    /**
     * Update type filter from checkboxes
     */
    updateTypeFilter: function() {
        const checkboxes = document.querySelectorAll('input[name="building-type"]:checked');
        this.currentFilters.types = Array.from(checkboxes).map(cb => cb.value);
    },

    /**
     * Update viewport bounds
     */
    updateBounds: function() {
        this.currentFilters.bounds = mapModule.getBounds();
    },

    /**
     * Apply all filters to data
     */
    applyFilters: function() {
        if (!dataLoader.processedData) return;

        // Get filtered data
        const filtered = dataLoader.getFilteredData(this.currentFilters);

        // Update map
        mapModule.updateData(filtered);

        // Update statistics
        this.updateStatistics(filtered.features);

        // Update UI
        this.updateFilterDisplay();
    },

    /**
     * Update statistics display
     */
    updateStatistics: function(features) {
        const stats = dataLoader.calculateStats(features);

        // Update building count
        const countElement = document.getElementById('building-count');
        if (countElement) {
            countElement.textContent = utils.formatNumber(stats.count);
        }

        // Update total area
        const areaElement = document.getElementById('total-area');
        if (areaElement) {
            areaElement.textContent = utils.formatArea(stats.totalFloorArea);
        }
    },

    /**
     * Update filter display
     */
    updateFilterDisplay: function() {
        // Year range is already updated by slider events

        // Update type checkboxes if needed
        const checkboxes = document.querySelectorAll('input[name="building-type"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = this.currentFilters.types.includes(checkbox.value);
        });
    },

    /**
     * Update legend based on current view
     */
    updateLegend: function(view) {
        const legendContainer = document.getElementById('legend');
        if (!legendContainer) return;

        legendContainer.innerHTML = '';

        if (view === 'year') {
            // Year-based legend
            const yearRanges = [
                { label: '< 1990', color: 'rgb(215, 48, 39)' },     // Red (old)
                { label: '1990-1995', color: 'rgb(196, 65, 80)' },  // Red-pink transition
                { label: '1995-2000', color: 'rgb(124, 91, 130)' }, // Purple transition
                { label: '2000-2005', color: 'rgb(69, 117, 180)' }, // Blue (middle)
                { label: '2005-2010', color: 'rgb(71, 131, 152)' }, // Blue-green transition
                { label: '2010-2015', color: 'rgb(74, 153, 113)' }, // Green transition
                { label: '> 2015', color: 'rgb(77, 175, 74)' }      // Green (new)
            ];

            yearRanges.forEach(range => {
                const item = document.createElement('div');
                item.className = 'legend-item';
                item.innerHTML = `
                    <div class="legend-color" style="background-color: ${range.color}"></div>
                    <span class="legend-label">${range.label}</span>
                `;
                legendContainer.appendChild(item);
            });
        } else {
            // Type-based legend
            Object.entries(CONFIG.colors.buildingTypeColors).forEach(([type, color]) => {
                const typeName = type === 'kerrostalo' ? 'Kerrostalot' :
                               type === 'omakotitalo' ? 'Omakotitalot' :
                               type === 'rivitalo' ? 'Rivitalot' :
                               type === 'paritalo' ? 'Paritalot' : 'Muut';

                const item = document.createElement('div');
                item.className = 'legend-item';
                item.innerHTML = `
                    <div class="legend-color" style="background-color: ${color}"></div>
                    <span class="legend-label">${typeName}</span>
                `;
                legendContainer.appendChild(item);
            });
        }
    },

    /**
     * Reset all filters to defaults
     */
    resetFilters: function() {
        // Reset year range
        this.currentFilters.yearMin = CONFIG.filters.defaultYearRange[0];
        this.currentFilters.yearMax = CONFIG.filters.defaultYearRange[1];

        if (this.yearSlider) {
            this.yearSlider.min.value = this.currentFilters.yearMin;
            this.yearSlider.max.value = this.currentFilters.yearMax;
        }

        document.getElementById('year-min').textContent = this.currentFilters.yearMin;
        document.getElementById('year-max').textContent = this.currentFilters.yearMax;

        // Reset type filters
        this.currentFilters.types = [...CONFIG.filters.buildingTypes];
        const checkboxes = document.querySelectorAll('input[name="building-type"]');
        checkboxes.forEach(cb => cb.checked = true);

        // Apply filters
        this.applyFilters();
    },

    /**
     * Get current filter state
     */
    getFilterState: function() {
        return { ...this.currentFilters };
    },

    /**
     * Set filter state (for URL parameters or saved states)
     */
    setFilterState: function(state) {
        if (state.yearMin !== undefined) {
            this.currentFilters.yearMin = state.yearMin;
            if (this.yearSlider) this.yearSlider.min.value = state.yearMin;
        }

        if (state.yearMax !== undefined) {
            this.currentFilters.yearMax = state.yearMax;
            if (this.yearSlider) this.yearSlider.max.value = state.yearMax;
        }

        if (state.types) {
            this.currentFilters.types = state.types;
            this.updateFilterDisplay();
        }

        this.applyFilters();
    },

    /**
     * Filter by specific building type (quick filter)
     */
    filterByType: function(type) {
        // Set only this type
        this.currentFilters.types = [type];
        this.updateFilterDisplay();
        this.applyFilters();
    },

    /**
     * Show all building types
     */
    showAllTypes: function() {
        this.currentFilters.types = [...CONFIG.filters.buildingTypes];
        this.updateFilterDisplay();
        this.applyFilters();
    }
};