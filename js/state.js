// state.js
// Application state management

const State = {
    // Drawing state
    currentTool: 'pencil',
    currentColor: '#282828',
    brushSize: 0,  // 1x1 brush for pencil tool
    opacity: 1.0,
    
    // Canvas state
    isDrawing: false,
    currentBrush: Config.DRAW_COLOR,
    zoom: 1,
    
    // Layers state
    layers: [],
    activeLayerIndex: 0,
    
    // UI state
    showLayers: false,
    paletteColors: [
        '#282828', '#ffffff', '#ff0000', '#00ff00', 
        '#0000ff', '#ffff00', '#ff00ff', '#00ffff',
        '#ffa500', '#800080', '#ffc0cb', '#a52a2a',
        '#808080', '#c0c0c0', '#90ee90', '#ff6347'
    ],
    
    // File state
    hasUnsavedChanges: false,
    filename: null,
    
    // History for undo/redo
    history: [],
    historyIndex: -1,
    
    // Methods
    setTool(tool) {
        this.currentTool = tool;
        this.updateUI();
    },
    
    setColor(color) {
        // Ensure color is in hex format for storage
        if (color.startsWith('#')) {
            this.currentColor = color;
            this.currentBrush = this.hexToRgb(color);
        } else if (color.startsWith('rgb')) {
            // Convert RGB to hex for storage
            this.currentColor = this.rgbToHex(color);
            this.currentBrush = color;
        } else {
            // Assume it's already in hex format
            this.currentColor = color.startsWith('#') ? color : '#' + color;
            this.currentBrush = this.hexToRgb(this.currentColor);
        }
        this.updateUI();
    },
    
    setBrushSize(size) {
        this.brushSize = size;
        this.updateUI();
    },
    
    setOpacity(opacity) {
        this.opacity = opacity;
        this.updateUI();
    },
    
    setDrawing(drawing) {
        this.isDrawing = drawing;
    },
    
    setBrush(brush) {
        this.currentBrush = brush;
    },
    
    setZoom(zoom) {
        this.zoom = Math.max(0.1, Math.min(zoom, 50));
        this.updateUI();
    },
    
    zoomIn() {
        this.setZoom(this.zoom + 0.1);
    },
    
    zoomOut() {
        this.setZoom(this.zoom - 0.1);
    },
    
    resetZoom() {
        this.setZoom(1);
    },
    
    addLayer(name = 'Layer') {
        const layer = {
            id: Date.now(),
            name: name,
            visible: true,
            opacity: 1.0,
            canvas: this.createLayerCanvas()
        };
        this.layers.push(layer);
        this.activeLayerIndex = this.layers.length - 1;
        this.updateUI();
        // Update previews when layer is added
        if (typeof TilemapCore !== 'undefined' && TilemapCore.updatePreviews) {
            TilemapCore.updatePreviews();
        }
    },
    
    createLayerCanvas() {
        const canvas = document.createElement('canvas');
        canvas.width = Config.CANVAS_SIZE;
        canvas.height = Config.CANVAS_SIZE;
        const ctx = canvas.getContext('2d');
        // Clear to transparent instead of white
        ctx.clearRect(0, 0, Config.CANVAS_SIZE, Config.CANVAS_SIZE);
        return canvas;
    },
    
    removeLayer(index) {
        if (this.layers.length > 1) {
            this.layers.splice(index, 1);
            if (this.activeLayerIndex >= this.layers.length) {
                this.activeLayerIndex = this.layers.length - 1;
            }
            this.updateUI();
            // Update previews when layer is removed
            if (typeof TilemapCore !== 'undefined' && TilemapCore.updatePreviews) {
                TilemapCore.updatePreviews();
            }
        }
    },
    
    setActiveLayer(index) {
        if (index >= 0 && index < this.layers.length) {
            this.activeLayerIndex = index;
            this.updateUI();
            // Update previews when active layer changes
            if (typeof TilemapCore !== 'undefined' && TilemapCore.updatePreviews) {
                TilemapCore.updatePreviews();
            }
        }
    },
    
    toggleLayerVisibility(index) {
        if (index >= 0 && index < this.layers.length) {
            this.layers[index].visible = !this.layers[index].visible;
            this.updateUI();
            // Update previews when visibility changes
            if (typeof TilemapCore !== 'undefined' && TilemapCore.updatePreviews) {
                TilemapCore.updatePreviews();
            }
        }
    },
    
    addColorToPalette(color) {
        if (!this.paletteColors.includes(color)) {
            this.paletteColors.push(color);
            if (this.paletteColors.length > Config.PALETTE_SIZE) {
                this.paletteColors.shift();
            }
            this.updateUI();
        }
    },
    
    setShowLayers(show) {
        this.showLayers = show;
        this.updateUI();
    },
    
    markUnsaved() {
        this.hasUnsavedChanges = true;
    },
    
    markSaved() {
        this.hasUnsavedChanges = false;
    },
    
    saveState() {
        // Implementation for undo/redo functionality
        const state = this.captureCurrentState();
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(state);
        this.historyIndex = this.history.length - 1;
    },
    
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreState(this.history[this.historyIndex]);
            this.updateUI();
        }
    },
    
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreState(this.history[this.historyIndex]);
            this.updateUI();
        }
    },
    
    captureCurrentState() {
        // Capture current drawing state for undo/redo
        return {
            layers: this.layers.map(layer => ({
                ...layer,
                canvas: layer.canvas.toDataURL()
            })),
            activeLayerIndex: this.activeLayerIndex
        };
    },
    
    restoreState(state) {
        // Restore drawing state from undo/redo
        this.layers = state.layers.map(layerData => ({
            ...layerData,
            canvas: this.createLayerCanvas()
        }));
        
        // Restore canvas data
        this.layers.forEach((layer, index) => {
            const img = new Image();
            img.onload = () => {
                layer.canvas.getContext('2d').drawImage(img, 0, 0);
            };
            img.src = layer.canvas;
        });
        
        this.activeLayerIndex = state.activeLayerIndex;
    },
    
    hexToRgb(hex) {
        // Ensure hex starts with #
        hex = hex.startsWith('#') ? hex : '#' + hex;
        const result = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `rgb(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)})` : 'rgb(40, 40, 40)';
    },
    
    rgbToHex(rgb) {
        const result = rgb.match(/\d+/g);
        if (result && result.length >= 3) {
            const r = Math.max(0, Math.min(255, parseInt(result[0], 10)));
            const g = Math.max(0, Math.min(255, parseInt(result[1], 10)));
            const b = Math.max(0, Math.min(255, parseInt(result[2], 10)));
            return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
        }
        return '#282828'; // Default dark gray
    },
    
    updateUI() {
        // Update UI elements based on current state
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === this.currentTool);
        });
        
        // Update color controls - ensure valid hex format
        const colorPicker = document.getElementById('colorPicker');
        const colorHex = document.getElementById('colorHex');
        const validColor = this.currentColor.startsWith('#') ? this.currentColor : '#' + this.currentColor;
        if (colorPicker && /^#[A-Fa-f0-9]{6}$/.test(validColor)) colorPicker.value = validColor;
        if (colorHex && /^#[A-Fa-f0-9]{6}$/.test(validColor)) colorHex.value = validColor;
        
        // Update brush controls
        const brushSize = document.getElementById('brush-size');
        const brushSizeValue = document.getElementById('brush-size-value');
        if (brushSize) brushSize.value = this.brushSize;
        if (brushSizeValue) brushSizeValue.textContent = `${(this.brushSize)}`;
        
        // Update opacity controls
        const opacitySlider = document.getElementById('opacitySlider');
        const opacityDisplay = document.getElementById('opacityDisplay');
        if (opacitySlider) opacitySlider.value = this.opacity * 100;
        if (opacityDisplay) opacityDisplay.textContent = Math.round(this.opacity * 100);
        
        // Update panel visibility
        const layersPanel = document.getElementById('panel-layers');
        if (layersPanel) layersPanel.classList.toggle('hidden', !this.showLayers);
        
        const layersBtn = document.getElementById('layersBtn');
        if (layersBtn) layersBtn.classList.toggle('active', this.showLayers);
        
        // Update zoom display
        const zoomDisplay = document.getElementById('zoomDisplay');
        if (zoomDisplay) {
            zoomDisplay.textContent = `${this.zoom.toFixed(1)}x`;
        }
    }
};