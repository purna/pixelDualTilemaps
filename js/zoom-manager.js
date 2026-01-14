// zoom-manager.js
// Handles zoom functionality for the tilemap editor

const ZoomManager = {
    /**
     * Initialize zoom functionality
     */
    init() {
        this.setupEventListeners();
        this.updateZoomDisplay();
        console.log('Zoom Manager initialized');
    },

    /**
     * Set up event listeners for zoom controls
     */
    setupEventListeners() {
        // Zoom in button
        if (DOM.elements.zoomInBtn) {
            DOM.elements.zoomInBtn.addEventListener('click', () => {
                this.zoomIn();
            });
        }

        // Zoom out button
        if (DOM.elements.zoomOutBtn) {
            DOM.elements.zoomOutBtn.addEventListener('click', () => {
                this.zoomOut();
            });
        }

        // Zoom reset button
        if (DOM.elements.zoomResetBtn) {
            DOM.elements.zoomResetBtn.addEventListener('click', () => {
                this.resetZoom();
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Don't trigger when typing in inputs
            if (e.target.tagName === 'INPUT') return;

            const ctrl = e.ctrlKey || e.metaKey;

            // Zoom in: Ctrl/Cmd + '+' or '='
            if (ctrl && (e.key === '+' || e.key === '=')) {
                e.preventDefault();
                this.zoomIn();
            }
            // Zoom out: Ctrl/Cmd + '-'
            else if (ctrl && e.key === '-') {
                e.preventDefault();
                this.zoomOut();
            }
            // Reset zoom: Ctrl/Cmd + '0'
            else if (ctrl && e.key === '0') {
                e.preventDefault();
                this.resetZoom();
            }
            // Direct zoom keys (no ctrl)
            else if (!ctrl) {
                if (e.key === '+') {
                    e.preventDefault();
                    this.zoomIn();
                } else if (e.key === '-') {
                    e.preventDefault();
                    this.zoomOut();
                } else if (e.key === '0') {
                    e.preventDefault();
                    this.resetZoom();
                }
            }
        });

        // Mouse wheel zoom (when holding Ctrl/Cmd)
        document.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                this.adjustZoom(delta);
            }
        }, { passive: false });
    },

    /**
     * Zoom in
     */
    zoomIn() {
        this.adjustZoom(0.1);
    },

    /**
     * Zoom out
     */
    zoomOut() {
        this.adjustZoom(-0.1);
    },

    /**
     * Adjust zoom by a delta amount
     */
    adjustZoom(delta) {
        const newZoom = Math.max(0.1, Math.min(State.zoom + delta, 50));
        if (newZoom !== State.zoom) {
            State.setZoom(newZoom);
            this.updateCanvasZoom();
            this.updateZoomDisplay();
        }
    },

    /**
     * Reset zoom to default (1x)
     */
    resetZoom() {
        State.setZoom(1);
        this.updateCanvasZoom();
        this.updateZoomDisplay();
    },

    /**
     * Update canvas zoom by applying CSS transform
     */
    updateCanvasZoom() {
        const tileGridContainer = document.querySelector('.tile-grid-container');
        const tileGrid = document.querySelector('.tile-grid');
        
        if (tileGridContainer && tileGrid) {
            // Apply zoom to the entire tile grid container
            tileGridContainer.style.transform = `scale(${State.zoom})`;
            tileGridContainer.style.transformOrigin = 'center center';
            
            // Ensure the container can accommodate the scaled content
            const scaledWidth = 3 * Config.CANVAS_SIZE * State.zoom;
            const scaledHeight = 3 * Config.CANVAS_SIZE * State.zoom;
            tileGridContainer.style.width = `${scaledWidth}px`;
            tileGridContainer.style.height = `${scaledHeight}px`;
        }
    },

    /**
     * Update zoom display in the UI
     */
    updateZoomDisplay() {
        if (DOM.elements.zoomDisplay) {
            DOM.elements.zoomDisplay.textContent = `${State.zoom.toFixed(1)}x`;
        }
    },

    /**
     * Get current zoom level
     */
    getZoom() {
        return State.zoom;
    },

    /**
     * Set specific zoom level
     */
    setZoom(zoom) {
        const clampedZoom = Math.max(0.1, Math.min(zoom, 50));
        State.setZoom(clampedZoom);
        this.updateCanvasZoom();
        this.updateZoomDisplay();
    }
};