// settings-manager.js
// Settings modal and configuration management

const SettingsManager = {
    isOpen: false,
    modalListenersSetup: false,
    settings: {
        showGrid: true,
        showAxes: true,
        snapToGrid: false,
        showTooltips: true,
        showHelpers: true,
        cameraSpeed: 1.0,
        autoSave: true,
        theme: 'dark',
        exportQuality: 1.0,
        canvasSize: { width: 32, height: 32 },
        backgroundColor: 'transparent'
    },

    init() {
        console.log('Initializing Settings Manager...');
        
        // Initialize canvas size from config if not set
        if (!this.settings.canvasSize) {
            this.settings.canvasSize = { 
                width: Config.TILE_DIM, 
                height: Config.TILE_DIM 
            };
        }

        // Ensure DOM is ready before setting up event listeners
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupEventListeners();
                this.loadSettings();
                console.log('Settings Manager initialized (DOM ready)');
            });
        } else {
            this.setupEventListeners();
            this.loadSettings();
            console.log('Settings Manager initialized');
        }

        // Fallback: Also try to attach event listener after a short delay
        setTimeout(() => {
            const settingsBtn = document.getElementById('settingsBtn');
            console.log('Fallback check - settingsBtn found:', !!settingsBtn);
            if (settingsBtn && !settingsBtn.hasAttribute('data-settings-listener')) {
                console.log('Attaching fallback settings button listener');
                settingsBtn.addEventListener('click', (e) => {
                    console.log('Settings button clicked (fallback)');
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleSettings();
                });
                settingsBtn.setAttribute('data-settings-listener', 'true');
            }
        }, 1000);
    },

    setupEventListeners() {
        // Settings button click
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            console.log('Settings button found, attaching event listener');
            settingsBtn.addEventListener('click', (e) => {
                console.log('Settings button clicked');
                e.preventDefault();
                e.stopPropagation();
                this.toggleSettings();
            });
        } else {
            console.error('Settings button not found!');
        }
    },

    toggleSettings() {
        if (this.isOpen) {
            this.closeSettings();
        } else {
            this.openSettings();
        }
    },

    openSettings() {
        const modal = document.getElementById('unified-settings-modal');
        if (!modal) {
            console.error('Settings modal not found in HTML');
            return;
        }

        this.isOpen = true;
        modal.classList.add('open');

        // Update form values from current settings
        this.updateFormFromSettings();

        // Setup modal event listeners (only once)
        if (!this.modalListenersSetup) {
            this.setupModalEventListeners();
            this.modalListenersSetup = true;
        }

        // Close on escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeSettings();
            }
        };
        document.addEventListener('keydown', escapeHandler);

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeSettings();
            }
        });
    },

    updateFormFromSettings() {
        // Update HTML form values from current settings
        const gridCheckbox = document.getElementById('setting-grid');
        const axesCheckbox = document.getElementById('setting-axes');
        const snapCheckbox = document.getElementById('setting-snap');
        const tooltipsCheckbox = document.getElementById('setting-tooltips');
        const helpersCheckbox = document.getElementById('setting-helpers');
        const cameraSlider = document.getElementById('setting-camera-speed');
        const cameraDisplay = document.getElementById('camera-speed-value');
        const bgColorPicker = document.getElementById('setting-bg-color');

        // Canvas size inputs
        const widthInput = document.getElementById('canvasWidth');
        const heightInput = document.getElementById('canvasHeight');

        if (gridCheckbox) gridCheckbox.checked = this.settings.showGrid;
        if (axesCheckbox) axesCheckbox.checked = this.settings.showAxes || true;
        if (snapCheckbox) snapCheckbox.checked = this.settings.snapToGrid;
        if (tooltipsCheckbox) tooltipsCheckbox.checked = this.settings.showTooltips || true;
        if (helpersCheckbox) helpersCheckbox.checked = this.settings.showHelpers !== false; // default to true
        if (cameraSlider) {
            cameraSlider.value = this.settings.cameraSpeed || 1.0;
            if (cameraDisplay) cameraDisplay.textContent = (this.settings.cameraSpeed || 1.0).toFixed(1);
        }
        if (bgColorPicker) {
            const bgColor = this.settings.backgroundColor;
            if (bgColor === 'transparent') {
                bgColorPicker.value = '#ffffff';
                this.setBackgroundMode('transparent');
            } else {
                bgColorPicker.value = bgColor;
                this.setBackgroundMode('color');
                this.updateColorPreview(bgColor);
            }
        }

        // Update canvas size inputs with current settings or config defaults
        const canvasWidth = this.settings.canvasSize?.width || Config.TILE_DIM;
        const canvasHeight = this.settings.canvasSize?.height || Config.TILE_DIM;

        if (widthInput) widthInput.value = canvasWidth;
        if (heightInput) heightInput.value = canvasHeight;

        // Update modal canvas size inputs
        const modalWidthInput = document.getElementById('modal-canvas-width');
        const modalHeightInput = document.getElementById('modal-canvas-height');
        if (modalWidthInput) modalWidthInput.value = canvasWidth;
        if (modalHeightInput) modalHeightInput.value = canvasHeight;
    },

    closeSettings() {
        const modal = document.getElementById('unified-settings-modal');
        if (modal) {
            modal.classList.remove('open');
        }
        this.isOpen = false;
    },

    createSettingsModal() {
        const modal = document.createElement('div');
        modal.className = 'settings-modal';

        const panel = document.createElement('div');
        panel.className = 'settings-panel';

        panel.innerHTML = `
            <button class="close-settings" title="Close Settings"><i class="fas fa-times"></i></button>
            <h2>Settings</h2>
            
            <div class="settings-content">
                <div class="settings-group">
                    <h3>Display</h3>
                    <div class="setting-item">
                        <label class="setting-label" for="showGrid">Show Grid</label>
                        <div class="setting-control">
                            <input type="checkbox" id="showGrid" ${this.settings.showGrid ? 'checked' : ''}>
                        </div>
                    </div>
                    <div class="setting-item">
                        <label class="setting-label" for="snapToGrid">Snap to Grid</label>
                        <div class="setting-control">
                            <input type="checkbox" id="snapToGrid" ${this.settings.snapToGrid ? 'checked' : ''}>
                        </div>
                    </div>
                </div>
                
                <div class="settings-group">
                    <h3>Canvas</h3>
                    <div class="setting-item">
                        <label class="setting-label" for="canvasWidth">Tile Resolution (W&times;H)</label>
                        <div class="setting-control setting-control-group">
                            <input type="range" id="canvasWidth" min="4" max="1024" value="${this.settings.canvasSize.width}" title="Tile Width">
                            <span>&times;</span>
                            <input type="number" id="canvasHeight" min="4" max="1024" value="${this.settings.canvasSize.height}" title="Tile Height" readonly>
                        </div>
                    </div>
                    <div class="setting-item">
                        <button class="btn primary" id="apply-canvas-resize"><i class="fas fa-check"></i> Apply Canvas Size</button>
                    </div>
                </div>

                <div class="settings-group">
                    <h3>Background</h3>
                    <div class="setting-item">
                        <label class="setting-label" for="setting-bg-color">Background Color</label>
                        <div class="setting-control setting-control-group">
                            <input type="color" id="setting-bg-color" value="${this.settings.backgroundColor === 'transparent' ? '#ffffff' : this.settings.backgroundColor}">
                            <button class="btn" id="transparent-bg-btn" title="Set Transparent Background"><i class="fas fa-eye-slash"></i></button>
                            <button class="btn" id="remove-bg-btn" title="Remove Background Color"><i class="fas fa-times"></i></button>
                        </div>
                    </div>
                </div>

                <div class="settings-group">
                    <h3>Export</h3>
                    <div class="setting-item">
                        <label class="setting-label" for="exportQuality">Export Quality</label>
                        <div class="setting-control control-range">
                            <input type="range" id="exportQuality" min="0.1" max="1.0" step="0.1" value="${this.settings.exportQuality}">
                            <span class="range-value">${Math.round(this.settings.exportQuality * 100)}%</span>
                        </div>
                    </div>
                </div>

                <div class="settings-group">
                    <h3>General</h3>
                    <div class="setting-item">
                        <label class="setting-label" for="autoSave">Auto Save</label>
                        <div class="setting-control">
                            <input type="checkbox" id="autoSave" ${this.settings.autoSave ? 'checked' : ''}>
                        </div>
                    </div>
                    <div class="setting-item">
                        <label class="setting-label" for="theme">Theme</label>
                        <div class="setting-control">
                            <select id="theme">
                                <option value="dark" ${this.settings.theme === 'dark' ? 'selected' : ''}>Dark</option>
                                <option value="light" ${this.settings.theme === 'light' ? 'selected' : ''}>Light</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="settings-actions">
                <button class="btn" id="resetSettingsBtn"><i class="fas fa-undo"></i> Reset to Defaults</button>
                <button class="btn primary" id="saveSettingsBtn"><i class="fas fa-check"></i> Save & Close</button>
            </div>
        `;

        modal.appendChild(panel);
        return modal;
    },

    setupModalEventListeners() {
        const modal = document.getElementById('unified-settings-modal');
        if (!modal) return;

        // X close button
        const xCloseBtn = document.getElementById('btn-settings-close');
        if (xCloseBtn) {
            xCloseBtn.addEventListener('click', () => {
                this.closeSettings();
            });
        }

        // Close button - already handled above

        // Save button
        const saveBtn = document.getElementById('btn-settings-save');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveSettings();
                this.closeSettings();
            });
        }

        // Reset button
        const resetBtn = document.getElementById('btn-settings-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetSettings();
            });
        }

        // Camera speed display
        const cameraSlider = document.getElementById('setting-camera-speed');
        const cameraDisplay = document.getElementById('camera-speed-value');
        if (cameraSlider && cameraDisplay) {
            cameraSlider.addEventListener('input', (e) => {
                cameraDisplay.textContent = parseFloat(e.target.value).toFixed(1);
            });
        }

        // Canvas resize apply button
        const applyResizeBtn = document.getElementById('apply-canvas-resize');
        if (applyResizeBtn) {
            applyResizeBtn.addEventListener('click', () => {
                this.applyCanvasResize();
            });
        }

        // Modal canvas resize apply button
        const modalApplyResizeBtn = document.getElementById('modal-apply-canvas-resize');
        if (modalApplyResizeBtn) {
            modalApplyResizeBtn.addEventListener('click', () => {
                this.applyModalCanvasResize();
            });
        }

        // Width slider event listener
        const widthSlider = document.getElementById('canvasWidth');
        const heightInput = document.getElementById('canvasHeight');
        if (widthSlider && heightInput) {
            widthSlider.addEventListener('input', (e) => {
                const widthValue = parseInt(e.target.value);
                heightInput.value = widthValue; // Update height to match width
            });
        }

        // Modal width input event listener
        const modalWidthInput = document.getElementById('modal-canvas-width');
        const modalHeightInput = document.getElementById('modal-canvas-height');
        if (modalWidthInput && modalHeightInput) {
            modalWidthInput.addEventListener('input', (e) => {
                const widthValue = parseInt(e.target.value);
                modalHeightInput.value = widthValue; // Update height to match width
            });
        }

        // Grid setting checkbox
        const gridCheckbox = document.getElementById('setting-grid');
        if (gridCheckbox) {
            gridCheckbox.addEventListener('change', (e) => {
                this.settings.showGrid = e.target.checked;
                this.saveSettingsToStorage();
                // Redraw previews to show/hide grid
                if (typeof TilemapCore !== 'undefined') {
                    TilemapCore.updatePreviews();
                }
            });
        }

        // Default size preset buttons
        const presetBtns = document.querySelectorAll('.default-size-presets .preset-btn');
        presetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const width = parseInt(btn.dataset.width);
                const height = parseInt(btn.dataset.height);
                if (modalWidthInput && modalHeightInput) {
                    modalWidthInput.value = width;
                    modalHeightInput.value = height;
                }
            });
        });

        // Background mode toggle buttons
        const bgModeBtns = document.querySelectorAll('.bg-mode-btn');
        bgModeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                this.setBackgroundMode(mode);
            });
        });

        // Color picker
        const bgColorPicker = document.getElementById('setting-bg-color');
        if (bgColorPicker) {
            bgColorPicker.addEventListener('input', (e) => {
                this.updateColorPreview(e.target.value);
                this.settings.backgroundColor = e.target.value;
                this.applyBackgroundColor(e.target.value);
                this.saveSettingsToStorage();
            });
        }

        // Remove background color button
        const removeBgBtn = document.getElementById('remove-bg-btn');
        if (removeBgBtn) {
            removeBgBtn.addEventListener('click', () => {
                this.settings.backgroundColor = 'transparent';
                this.applyBackgroundColor('transparent');
                this.saveSettingsToStorage();
                if (typeof Notifications !== 'undefined') {
                    const notifications = new Notifications();
                    notifications.success('Background color removed (transparent)');
                }
            });
        }

        // Export Defaults button
        const exportSettingsBtn = document.getElementById('exportSettingsBtn');
        if (exportSettingsBtn) {
            exportSettingsBtn.addEventListener('click', () => {
                this.exportSettings();
                if (typeof Notifications !== 'undefined') {
                    const notifications = new Notifications();
                    notifications.success('Settings exported as defaults');
                }
            });
        }

        // Save to Browser button
        const saveToBrowserBtn = document.getElementById('saveToBrowserBtn');
        if (saveToBrowserBtn) {
            saveToBrowserBtn.addEventListener('click', () => {
                this.saveSettingsToStorage();
                if (typeof Notifications !== 'undefined') {
                    const notifications = new Notifications();
                    notifications.success('Settings saved to browser storage');
                }
            });
        }

        // Load from Browser button
        const loadFromBrowserBtn = document.getElementById('loadFromBrowserBtn');
        if (loadFromBrowserBtn) {
            loadFromBrowserBtn.addEventListener('click', () => {
                this.loadSettings();
                if (typeof Notifications !== 'undefined') {
                    const notifications = new Notifications();
                    notifications.success('Settings loaded from browser storage');
                }
            });
        }
    },

    saveSettings() {
        // Read settings from HTML form
        const gridCheckbox = document.getElementById('setting-grid');
        const axesCheckbox = document.getElementById('setting-axes');
        const snapCheckbox = document.getElementById('setting-snap');
        const tooltipsCheckbox = document.getElementById('setting-tooltips');
        const helpersCheckbox = document.getElementById('setting-helpers');
        const cameraSlider = document.getElementById('setting-camera-speed');
        const bgColorPicker = document.getElementById('setting-bg-color');
        
        // Canvas size inputs
        const widthInput = document.getElementById('canvasWidth');
        const heightInput = document.getElementById('canvasHeight');

        this.settings.showGrid = gridCheckbox ? gridCheckbox.checked : true;
        this.settings.showAxes = axesCheckbox ? axesCheckbox.checked : true;
        this.settings.snapToGrid = snapCheckbox ? snapCheckbox.checked : false;
        this.settings.showTooltips = tooltipsCheckbox ? tooltipsCheckbox.checked : true;
        this.settings.showHelpers = helpersCheckbox ? helpersCheckbox.checked : true;
        this.settings.cameraSpeed = cameraSlider ? parseFloat(cameraSlider.value) : 1.0;
        // Handle background color setting from form
        const bgModeBtns = document.querySelectorAll('.bg-mode-btn');
        const activeMode = Array.from(bgModeBtns).find(btn => btn.classList.contains('active'));
        if (activeMode) {
            const mode = activeMode.dataset.mode;
            if (mode === 'transparent') {
                this.settings.backgroundColor = 'transparent';
            } else if (bgColorPicker) {
                this.settings.backgroundColor = bgColorPicker.value;
            }
        } else if (bgColorPicker) {
            this.settings.backgroundColor = bgColorPicker.value;
        }

        // Save canvas size from inputs (use current input values)
        if (widthInput && heightInput) {
            const widthValue = parseInt(widthInput.value) || Config.TILE_DIM;
            this.settings.canvasSize = {
                width: widthValue,
                height: widthValue // Square images - use same value for height
            };
        }

        // Apply settings
        this.applySettings();

        // Save to localStorage
        this.saveSettingsToStorage();

        // Redraw previews to show/hide grid
        if (typeof TilemapCore !== 'undefined') {
            TilemapCore.updatePreviews();
        }

        if (typeof Notifications !== 'undefined') {
            const notifications = new Notifications();
            notifications.success('Settings saved successfully');
        }
    },

    applyCanvasResize() {
        const widthInput = document.getElementById('canvasWidth');
        const heightInput = document.getElementById('canvasHeight');

        if (!widthInput || !heightInput) {
            console.error('Canvas size inputs not found');
            return;
        }

        const newWidth = parseInt(widthInput.value);
        const newHeight = newWidth; // Square images - use same value for height

        // Validate input ranges
        if (newWidth < 4 || newWidth > 1024) {
            if (typeof Notifications !== 'undefined') {
                const notifications = new Notifications();
                notifications.error('Canvas size must be between 4 and 1024 pixels');
            }
            return;
        }

        // Update settings
        this.settings.canvasSize = { width: newWidth, height: newHeight };

        // Apply the resize to the actual canvas
        this.resizeCanvas(newWidth, newHeight);

        // Save to storage
        this.saveSettingsToStorage();

        if (typeof Notifications !== 'undefined') {
            const notifications = new Notifications();
            notifications.success(`Canvas resized to ${newWidth}×${newHeight}`);
        }
    },

    applyModalCanvasResize() {
        const widthInput = document.getElementById('modal-canvas-width');
        const heightInput = document.getElementById('modal-canvas-height');

        if (!widthInput || !heightInput) {
            console.error('Modal canvas size inputs not found');
            return;
        }

        const newWidth = parseInt(widthInput.value);
        const newHeight = parseInt(heightInput.value);

        // Validate input ranges
        if (newWidth < 4 || newWidth > 1024 || newHeight < 4 || newHeight > 1024) {
            if (typeof Notifications !== 'undefined') {
                const notifications = new Notifications();
                notifications.error('Canvas size must be between 4 and 1024 pixels');
            }
            return;
        }

        // Update settings
        this.settings.canvasSize = { width: newWidth, height: newHeight };

        // Apply the resize to the actual canvas
        this.resizeCanvas(newWidth, newHeight);

        // Save to storage
        this.saveSettingsToStorage();

        if (typeof Notifications !== 'undefined') {
            const notifications = new Notifications();
            notifications.success(`Canvas resized to ${newWidth}×${newHeight}`);
        }
    },

    resizeCanvas(width, height) {
        // Update config values
        Config.TILE_DIM = width;
        Config.CANVAS_SIZE = width * Config.PIXEL_SIZE;

        // Resize all canvas elements
        if (DOM && DOM.allCanvases) {
            DOM.allCanvases.forEach(canvas => {
                canvas.width = Config.CANVAS_SIZE;
                canvas.height = Config.CANVAS_SIZE;
            });
        }

        // Redraw the canvases
        if (typeof TilemapCore !== 'undefined') {
            TilemapCore.updatePreviews();
        }

        console.log(`Canvas resized to ${width}×${height} (${Config.CANVAS_SIZE}px)`);
        
        // Redraw previews to show/hide grid
        if (typeof TilemapCore !== 'undefined') {
            TilemapCore.updatePreviews();
        }
    },

    resetSettings() {
        if (confirm('Reset all settings to default values?')) {
            // Reset to defaults using config values for canvas size
            this.settings = {
                showGrid: true,
                showAxes: true,
                snapToGrid: false,
                showTooltips: true,
                showHelpers: true,
                cameraSpeed: 1.0,
                autoSave: true,
                theme: 'dark',
                exportQuality: 1.0,
                canvasSize: { 
                    width: Config.TILE_DIM, 
                    height: Config.TILE_DIM 
                },
                backgroundColor: 'transparent'
            };

            // Update HTML form
            this.updateFormFromSettings();

            // Apply settings
            this.applySettings();

            // Save to localStorage
            this.saveSettingsToStorage();

            if (typeof Notifications !== 'undefined') {
                const notifications = new Notifications();
                notifications.info('Settings reset to defaults');
            }
        }
        
        // Redraw previews to show/hide grid
        if (typeof TilemapCore !== 'undefined') {
            TilemapCore.updatePreviews();
        }
    },

    applySettings() {
        // Apply theme
        if (this.settings.theme === 'light') {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }

        // Apply auto-save setting
        if (this.settings.autoSave) {
            FileManager.startAutoSave();
        } else {
            FileManager.stopAutoSave();
        }

        // Apply helpers setting (show/hide welcome message)
        if (this.settings.showHelpers === false) {
            // Hide any existing welcome notifications
            const existingWelcome = document.querySelector('.welcome-notification');
            if (existingWelcome) {
                existingWelcome.remove();
            }
        }

        // Apply background color to canvas
        if (this.settings.backgroundColor) {
            this.applyBackgroundColor(this.settings.backgroundColor);
        }

        // Apply other settings as needed
        console.log('Settings applied:', this.settings);
        
        // Redraw previews to show/hide grid
        if (typeof TilemapCore !== 'undefined' && typeof DOM !== 'undefined' && DOM.editorCtx) {
            TilemapCore.updatePreviews();
        }
    },

    applyBackgroundColor(color) {
        // Apply background color to the tile grid container
        const tileGrid = document.querySelector('.tile-grid');
        if (tileGrid) {
            if (color === 'transparent') {
                tileGrid.style.backgroundColor = 'transparent';
                tileGrid.style.backgroundImage = 'linear-gradient(45deg, #eee 25%, transparent 25%), linear-gradient(-45deg, #eee 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #eee 75%), linear-gradient(-45deg, transparent 75%, #eee 75%)';
                tileGrid.style.backgroundSize = '20px 20px';
                tileGrid.style.backgroundPosition = '0 0, 0 10px, 10px -10px, -10px 0px';
            } else {
                tileGrid.style.backgroundColor = color;
                tileGrid.style.backgroundImage = 'none';
            }
        }

        // Also update the workspace background
        const workspace = document.querySelector('.workspace');
        if (workspace) {
            workspace.style.setProperty('--canvas-bg-color', color === 'transparent' ? 'transparent' : color);
        }
    },

    loadSettings() {
        try {
            const saved = localStorage.getItem('tilemap-settings');
            if (saved) {
                const loadedSettings = JSON.parse(saved);
                this.settings = { ...this.settings, ...loadedSettings };
                
                // Apply loaded canvas size to config
                if (loadedSettings.canvasSize) {
                    Config.TILE_DIM = loadedSettings.canvasSize.width || Config.TILE_DIM;
                    Config.CANVAS_SIZE = Config.TILE_DIM * Config.PIXEL_SIZE;
                    console.log(`Loaded canvas size: ${Config.TILE_DIM}×${Config.TILE_DIM}`);
                }
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }

        this.applySettings();
        
        // Redraw previews to show/hide grid
        if (typeof TilemapCore !== 'undefined' && typeof DOM !== 'undefined' && DOM.editorCtx) {
            TilemapCore.updatePreviews();
        }
    },

    saveSettingsToStorage() {
        try {
            localStorage.setItem('tilemap-settings', JSON.stringify(this.settings));
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    },

    getSettings() {
        return { ...this.settings };
    },

    updateSetting(key, value) {
        this.settings[key] = value;
        this.applySettings();
        this.saveSettingsToStorage();
        
        // Redraw previews to show/hide grid
        if (typeof TilemapCore !== 'undefined') {
            TilemapCore.updatePreviews();
        }
    },

    exportSettings() {
        const dataStr = JSON.stringify(this.settings, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = 'tilemap-settings.json';
        link.click();

        URL.revokeObjectURL(url);

        if (typeof Notifications !== 'undefined') {
            const notifications = new Notifications();
            notifications.success('Settings exported successfully');
        }
    },

    setBackgroundMode(mode) {
        // Update toggle button states
        const bgModeBtns = document.querySelectorAll('.bg-mode-btn');
        const colorSection = document.getElementById('bg-color-section');
        const transparentSection = document.getElementById('bg-transparent-section');

        bgModeBtns.forEach(btn => {
            const btnMode = btn.dataset.mode;
            if (btnMode === mode) {
                btn.classList.add('active');
                btn.setAttribute('aria-selected', 'true');
            } else {
                btn.classList.remove('active');
                btn.setAttribute('aria-selected', 'false');
            }
        });

        // Show/hide appropriate sections
        if (mode === 'transparent') {
            colorSection?.classList.add('hidden');
            transparentSection?.classList.remove('hidden');
            this.settings.backgroundColor = 'transparent';
            this.applyBackgroundColor('transparent');
        } else {
            colorSection?.classList.remove('hidden');
            transparentSection?.classList.add('hidden');
            // Don't change the color here, just update the UI state
        }

        this.saveSettingsToStorage();
        
        if (typeof InputHandler !== 'undefined') {
            const message = mode === 'transparent' ? 
                'Background set to transparent' : 
                'Background color mode selected';
            if (typeof Notifications !== 'undefined') {
                const notifications = new Notifications();
                notifications.success(message);
            }
        }
    },

    updateColorPreview(color) {
        const previewBox = document.getElementById('preview-box');
        const colorValue = document.getElementById('color-value');
        
        if (previewBox) {
            previewBox.style.backgroundColor = color;
        }
        
        if (colorValue) {
            colorValue.textContent = color.toLowerCase();
        }
    }
};

SettingsManager.init();