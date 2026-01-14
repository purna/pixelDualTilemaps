// palette-manager.js
// Color palette management

const PaletteManager = {
    init() {
        this.renderPalette();
        this.setupEventListeners();
        console.log('Palette Manager initialized');
    },
    
    setupEventListeners() {
        const colorPicker = DOM.elements.colorPicker;
        const colorHex = DOM.elements.colorHex;
        const saveColorBtn = DOM.elements.saveColorBtn;
        
        // Color picker change
        colorPicker.addEventListener('input', (e) => {
            const color = e.target.value;
            this.setCurrentColor(color);
        });
        
        // Hex input change
        colorHex.addEventListener('input', (e) => {
            const color = e.target.value;
            if (this.isValidHex(color)) {
                this.setCurrentColor(color);
            }
        });
        
        // Color picker blur (when user finishes typing)
        colorHex.addEventListener('blur', (e) => {
            let color = e.target.value;
            if (!color.startsWith('#')) {
                color = '#' + color;
            }
            if (this.isValidHex(color)) {
                this.setCurrentColor(color);
            } else {
                // Revert to previous valid color
                e.target.value = State.currentColor;
            }
        });
        
        // Save color to palette
        saveColorBtn.addEventListener('click', () => {
            this.saveCurrentColor();
        });
        
        // Palette swatch clicks
        DOM.elements.paletteContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('swatch')) {
                const color = e.target.dataset.color;
                this.setCurrentColor(color);
            }
        });
    },
    
    setCurrentColor(color) {
        if (this.isValidHex(color)) {
            State.setColor(color);
            DOM.elements.colorPicker.value = color;
            DOM.elements.colorHex.value = color;
            this.updateActiveSwatch(color);
        }
    },
    
    updateActiveSwatch(color) {
        // Remove active class from all swatches
        DOM.elements.paletteContainer.querySelectorAll('.swatch').forEach(swatch => {
            swatch.classList.remove('active');
        });
        
        // Add active class to current color swatch
        const activeSwatch = DOM.elements.paletteContainer.querySelector(`[data-color="${color}"]`);
        if (activeSwatch) {
            activeSwatch.classList.add('active');
        }
    },
    
    renderPalette() {
        const container = DOM.elements.paletteContainer;
        container.innerHTML = '';
        
        State.paletteColors.forEach(color => {
            const swatch = DOM.createSwatch(color, color === State.currentColor);
            container.appendChild(swatch);
        });
    },
    
    saveCurrentColor() {
        State.addColorToPalette(State.currentColor);
        this.renderPalette();
        this.updateActiveSwatch(State.currentColor);
        if (typeof Notifications !== 'undefined') {
            const notifications = new Notifications();
            notifications.success(`Color ${State.currentColor} saved to palette`);
        }
    },
    
    isValidHex(color) {
        return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
    },
    
    // Import palette from array of colors
    importPalette(colors) {
        State.paletteColors = colors.filter(color => this.isValidHex(color)).slice(0, Config.PALETTE_SIZE);
        this.renderPalette();
        this.updateActiveSwatch(State.currentColor);
        if (typeof Notifications !== 'undefined') {
            const notifications = new Notifications();
            notifications.success(`Palette imported with ${State.paletteColors.length} colors`);
        }
    },
    
    // Import palette from Coolors URL
    importPaletteFromUrl(url) {
        if (!url) {
            if (typeof Notifications !== 'undefined') {
                const notifications = new Notifications();
                notifications.error('No URL provided');
            }
            return;
        }

        // Validate Coolors URL format
        const coolorsPattern = /^https:\/\/coolors\.co\/([a-fA-F0-9-]{5,})$/;
        const match = url.match(coolorsPattern);

        if (!match) {
            if (typeof Notifications !== 'undefined') {
                const notifications = new Notifications();
                notifications.error('Invalid Coolors URL format');
            }
            return;
        }

        // Extract color codes from URL
        const colorCodes = match[1].split('-');

        // Convert to full hex colors (add # if missing)
        const colors = colorCodes.map(code => {
            return code.startsWith('#') ? code : '#' + code;
        }).filter(color => this.isValidHex(color));

        if (colors.length === 0) {
            if (typeof Notifications !== 'undefined') {
                const notifications = new Notifications();
                notifications.error('No valid colors found in URL');
            }
            return;
        }

        // Import the colors
        this.importPalette(colors);
        if (typeof Notifications !== 'undefined') {
            const notifications = new Notifications();
            notifications.success(`Imported ${colors.length} colors from Coolors`);
        }
    },
    
    // Export current palette
    exportPalette() {
        return [...State.paletteColors];
    },
    
    // Get specific color from palette
    getColor(index) {
        return State.paletteColors[index];
    },
    
    // Get all palette colors
    getAllColors() {
        return [...State.paletteColors];
    },
    
    // Clear palette
    clearPalette() {
        State.paletteColors = [];
        this.renderPalette();
        if (typeof Notifications !== 'undefined') {
            const notifications = new Notifications();
            notifications.info('Palette cleared');
        }
    },
    
    // Add multiple colors to palette
    addColors(colors) {
        colors.forEach(color => {
            if (this.isValidHex(color) && !State.paletteColors.includes(color)) {
                State.paletteColors.push(color);
            }
        });
        
        // Limit palette size
        if (State.paletteColors.length > Config.PALETTE_SIZE) {
            State.paletteColors = State.paletteColors.slice(-Config.PALETTE_SIZE);
        }
        
        this.renderPalette();
        this.updateActiveSwatch(State.currentColor);
    }
};