// UI Module - Handles user interface interactions

const ui = {
    menuOpen: false,

    /**
     * Initialize UI components
     */
    init: function() {
        this.initMenuToggle();
        this.initResizeHandler();
        this.initKeyboardShortcuts();
        this.updateMobileUI();

        // Clear expired cache on init
        utils.clearExpiredCache();
    },

    /**
     * Initialize mobile menu toggle
     */
    initMenuToggle: function() {
        const menuToggle = document.getElementById('menu-toggle');
        const controlsPanel = document.getElementById('controls-panel');

        if (!menuToggle || !controlsPanel) return;

        menuToggle.addEventListener('click', () => {
            this.toggleMenu();
        });

        // Close menu when clicking outside on mobile
        if (utils.isMobile()) {
            document.addEventListener('click', (e) => {
                if (this.menuOpen &&
                    !controlsPanel.contains(e.target) &&
                    !menuToggle.contains(e.target)) {
                    this.closeMenu();
                }
            });
        }

        // Close menu on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.menuOpen) {
                this.closeMenu();
            }
        });
    },

    /**
     * Toggle menu open/closed
     */
    toggleMenu: function() {
        if (this.menuOpen) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    },

    /**
     * Open menu
     */
    openMenu: function() {
        const controlsPanel = document.getElementById('controls-panel');
        if (!controlsPanel) return;

        controlsPanel.classList.add('open');
        this.menuOpen = true;

        // Update toggle button
        const menuToggle = document.getElementById('menu-toggle');
        if (menuToggle) {
            menuToggle.innerHTML = '✕';
            menuToggle.setAttribute('aria-expanded', 'true');
        }
    },

    /**
     * Close menu
     */
    closeMenu: function() {
        const controlsPanel = document.getElementById('controls-panel');
        if (!controlsPanel) return;

        controlsPanel.classList.remove('open');
        this.menuOpen = false;

        // Update toggle button
        const menuToggle = document.getElementById('menu-toggle');
        if (menuToggle) {
            menuToggle.innerHTML = '☰';
            menuToggle.setAttribute('aria-expanded', 'false');
        }
    },

    /**
     * Initialize window resize handler
     */
    initResizeHandler: function() {
        let resizeTimeout;

        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.handleResize();
            }, 250);
        });
    },

    /**
     * Handle window resize
     */
    handleResize: function() {
        // Update mobile UI
        this.updateMobileUI();

        // Resize map
        if (mapModule.map) {
            mapModule.map.resize();
        }

        // Close menu on desktop
        if (!utils.isMobile() && this.menuOpen) {
            this.closeMenu();
        }
    },

    /**
     * Update UI for mobile/desktop
     */
    updateMobileUI: function() {
        const isMobile = utils.isMobile();
        const controlsPanel = document.getElementById('controls-panel');
        const menuToggle = document.getElementById('menu-toggle');

        if (isMobile) {
            // Mobile mode
            if (menuToggle) {
                menuToggle.style.display = 'block';
            }
            if (controlsPanel && !this.menuOpen) {
                controlsPanel.classList.remove('open');
            }
        } else {
            // Desktop mode
            if (menuToggle) {
                menuToggle.style.display = 'none';
            }
            if (controlsPanel) {
                controlsPanel.classList.remove('open');
            }
            this.menuOpen = false;
        }
    },

    /**
     * Initialize keyboard shortcuts
     */
    initKeyboardShortcuts: function() {
        document.addEventListener('keydown', (e) => {
            // Don't trigger shortcuts when typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            switch (e.key) {
                case '1':
                    // Switch to year view
                    document.getElementById('view-year').checked = true;
                    filters.switchView('year');
                    break;

                case '2':
                    // Switch to type view
                    document.getElementById('view-type').checked = true;
                    filters.switchView('type');
                    break;

                case 'r':
                case 'R':
                    // Reset filters
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        filters.resetFilters();
                    }
                    break;

                case 'm':
                case 'M':
                    // Toggle menu on mobile
                    if (utils.isMobile()) {
                        this.toggleMenu();
                    }
                    break;

                case 'h':
                case 'H':
                    // Show help
                    this.showHelp();
                    break;
            }
        });
    },

    /**
     * Show/hide loading overlay
     */
    setLoading: function(loading, message = 'Ladataan...') {
        const overlay = document.getElementById('loading-overlay');
        if (!overlay) return;

        if (loading) {
            overlay.classList.remove('hidden');
            const text = overlay.querySelector('p');
            if (text) text.textContent = message;
        } else {
            setTimeout(() => {
                overlay.classList.add('hidden');
            }, 300);
        }
    },

    /**
     * Show notification message
     */
    showNotification: function(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    },

    /**
     * Show error message
     */
    showError: function(message) {
        this.showNotification(message, 'error');
        console.error(message);
    },

    /**
     * Show help dialog
     */
    showHelp: function() {
        const helpContent = `
            <div class="help-dialog">
                <h2>Käyttöohjeet / Instructions</h2>
                <h3>Näkymät / Views</h3>
                <ul>
                    <li><strong>Rakennusvuosi:</strong> Näyttää rakennukset värikoodattuna valmistumisvuoden mukaan</li>
                    <li><strong>Rakennustyyppi:</strong> Näyttää rakennukset tyypeittäin eri väreillä</li>
                </ul>
                <h3>Pikanäppäimet / Shortcuts</h3>
                <ul>
                    <li><kbd>1</kbd> - Rakennusvuosinäkymä / Year view</li>
                    <li><kbd>2</kbd> - Rakennustyyppisnäkymä / Type view</li>
                    <li><kbd>Ctrl+R</kbd> - Nollaa suodattimet / Reset filters</li>
                    <li><kbd>H</kbd> - Näytä ohje / Show help</li>
                    <li><kbd>M</kbd> - Avaa valikko (mobiili) / Open menu (mobile)</li>
                </ul>
                <h3>Tietolähde / Data Source</h3>
                <p>Espoon kaupungin avoin data / Espoo City Open Data</p>
                <button onclick="this.parentElement.remove()">Sulje / Close</button>
            </div>
        `;

        const helpDialog = document.createElement('div');
        helpDialog.innerHTML = helpContent;
        helpDialog.className = 'help-overlay';
        document.body.appendChild(helpDialog);

        // Close on escape or click outside
        helpDialog.addEventListener('click', (e) => {
            if (e.target === helpDialog) {
                helpDialog.remove();
            }
        });
    },

    /**
     * Update URL with current filter state
     */
    updateURL: function() {
        const state = filters.getFilterState();
        const params = new URLSearchParams();

        params.set('yearMin', state.yearMin);
        params.set('yearMax', state.yearMax);
        params.set('types', state.types.join(','));
        params.set('view', mapModule.currentView);

        // Update URL without reload
        const newURL = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState(state, '', newURL);
    },

    /**
     * Load state from URL parameters
     */
    loadFromURL: function() {
        const params = new URLSearchParams(window.location.search);

        const state = {
            yearMin: params.has('yearMin') ? parseInt(params.get('yearMin')) : undefined,
            yearMax: params.has('yearMax') ? parseInt(params.get('yearMax')) : undefined,
            types: params.has('types') ? params.get('types').split(',') : undefined
        };

        // Set view mode
        const view = params.get('view');
        if (view === 'year' || view === 'type') {
            document.getElementById(`view-${view}`).checked = true;
            filters.switchView(view);
        }

        // Apply filters
        if (Object.values(state).some(v => v !== undefined)) {
            filters.setFilterState(state);
        }
    },

    /**
     * Export current view as image
     */
    exportImage: function() {
        if (!mapModule.map) return;

        try {
            const canvas = mapModule.map.getCanvas();
            const link = document.createElement('a');
            link.download = `espoo-heatmap-${Date.now()}.png`;
            link.href = canvas.toDataURL();
            link.click();

            this.showNotification('Kartta tallennettu / Map saved');
        } catch (error) {
            this.showError('Vienti epäonnistui / Export failed');
        }
    },

    /**
     * Initialize share functionality
     */
    initShare: function() {
        if (navigator.share) {
            // Native share API available
            const shareButton = document.createElement('button');
            shareButton.textContent = 'Jaa / Share';
            shareButton.className = 'share-button';
            shareButton.addEventListener('click', () => {
                navigator.share({
                    title: 'Espoon asuntojen lämpökartta',
                    text: 'Katso Espoon rakennuksia kartalla',
                    url: window.location.href
                });
            });

            // Add to controls
            const controls = document.querySelector('.controls-content');
            if (controls) {
                controls.appendChild(shareButton);
            }
        }
    },

    /**
     * Add styles for notifications and dialogs
     */
    addDynamicStyles: function() {
        const style = document.createElement('style');
        style.textContent = `
            .notification {
                position: fixed;
                top: 80px;
                right: 20px;
                padding: 12px 20px;
                background: #333;
                color: white;
                border-radius: 4px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                z-index: 10000;
                animation: slideIn 0.3s ease;
            }

            .notification-error {
                background: #d32f2f;
            }

            .notification-success {
                background: #388e3c;
            }

            .notification.fade-out {
                animation: fadeOut 0.3s ease;
            }

            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            @keyframes fadeOut {
                to {
                    opacity: 0;
                }
            }

            .help-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            }

            .help-dialog {
                background: white;
                padding: 30px;
                border-radius: 8px;
                max-width: 600px;
                max-height: 80vh;
                overflow-y: auto;
            }

            .help-dialog h2 {
                margin-top: 0;
                color: var(--primary-color);
            }

            .help-dialog h3 {
                margin-top: 20px;
                color: var(--text-primary);
            }

            .help-dialog kbd {
                background: #f5f5f5;
                padding: 2px 6px;
                border: 1px solid #ccc;
                border-radius: 3px;
                font-family: monospace;
            }

            .help-dialog button {
                margin-top: 20px;
                padding: 10px 20px;
                background: var(--primary-color);
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }

            .help-dialog button:hover {
                background: var(--secondary-color);
            }

            .error-message {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                padding: 30px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                text-align: center;
                z-index: 1000;
            }

            .error-message h3 {
                color: #d32f2f;
                margin-bottom: 10px;
            }
        `;

        document.head.appendChild(style);
    }
};