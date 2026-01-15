// input-handler.js
// Handles mouse, touch, and keyboard input for the Seamless Tilemap Editor

const InputHandler = {
    isPanningMap: false,
    isDrawing: false,
    isPanning: false,
    lastDrawTime: 0,

    /**
     * Get canvas coordinates from mouse/touch event
     */
    getCoords(e) {
        const canvas = DOM.editorCanvas;
        const rect = canvas.getBoundingClientRect();
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        
        return {
            x: Math.floor((cx - rect.left) / rect.width * Config.CANVAS_SIZE),
            y: Math.floor((cy - rect.top) / rect.height * Config.CANVAS_SIZE)
        };
    },

    /**
     * Get tile coordinates (0-2 for 3x3 grid)
     */
    getTileCoords(e) {
        const canvas = DOM.editorCanvas;
        const rect = canvas.getBoundingClientRect();
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        
        const localX = (cx - rect.left) / rect.width;
        const localY = (cy - rect.top) / rect.height;
        
        return {
            tileX: Math.floor(localX * 3),
            tileY: Math.floor(localY * 3)
        };
    },

    /**
     * Handle drawing start
     */
    onDrawStart(e) {
        if (e.cancelable) {
            e.preventDefault();
        }
        
        const { x, y } = this.getCoords(e);
        const { tileX, tileY } = this.getTileCoords(e);
        
        console.log('Drawing started at:', x, y, 'Tile:', tileX, tileY, 'Tool:', State.currentTool, 'Color:', State.currentColor);
        
        if (x >= 0 && x < Config.CANVAS_SIZE && y >= 0 && y < Config.CANVAS_SIZE) {
            this.isDrawing = true;
            State.setDrawing(true);
            
            if (typeof ToolManager !== 'undefined') {
                ToolManager.startDrawing(x, y, tileX, tileY);
            }
        } else {
            console.log('Draw coordinates out of bounds:', x, y);
        }
    },

    /**
     * Handle drawing move
     */
    onDrawMove(e) {
        const { x, y } = this.getCoords(e);
        const { tileX, tileY } = this.getTileCoords(e);
        
        if (x >= 0 && x < Config.CANVAS_SIZE && y >= 0 && y < Config.CANVAS_SIZE) {
            // Update coordinates display if element exists
            const coordsElement = document.querySelector('.coords-display');
            if (coordsElement) {
                coordsElement.textContent = `${x}, ${y} (Tile: ${tileX},${tileY})`;
            }
            
            if (this.isDrawing && typeof ToolManager !== 'undefined') {
                // Throttle drawing updates for performance
                const now = Date.now();
                if (now - this.lastDrawTime > 16) { // ~60fps
                    ToolManager.continueDrawing(x, y, tileX, tileY);
                    this.lastDrawTime = now;
                }
            }
        }
    },

    /**
     * Handle drawing end
     */
    onDrawEnd(e) {
        if (!this.isDrawing) return;
        
        this.isDrawing = false;
        State.setDrawing(false);
        
        const { x, y } = this.getCoords(e);
        const { tileX, tileY } = this.getTileCoords(e);
        
        if (typeof ToolManager !== 'undefined') {
            ToolManager.stopDrawing(x, y, tileX, tileY);
        }
        
        // Save state for undo/redo
        State.saveState();
    },

    /**
     * Handle mouse wheel zoom
     */
    onWheel(e) {
        if (e.ctrlKey || e.metaKey || e.altKey) {
            e.preventDefault();
            
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            let newZoom = State.zoom + delta;
            newZoom = Math.min(Math.max(newZoom, 0.1), 10.0);
            
            State.setZoom(newZoom);
            
            if (typeof ZoomManager !== 'undefined') {
                ZoomManager.updateCanvasZoom();
            }
        }
    },

    /**
     * Handle minimap panning (if minimap exists)
     */
    onMinimapPanStart(e) {
        this.isPanningMap = true;
        this.onMinimapPan(e);
    },

    /**
     * Handle minimap pan movement
     */
    onMinimapPan(e) {
        if (!this.isPanningMap) return;
        
        // Implementation for minimap panning would go here
        // This is a placeholder for future minimap functionality
    },

    /**
     * Handle minimap pan end
     */
    onMinimapPanEnd() {
        this.isPanningMap = false;
    },

    /**
     * Handle keyboard shortcuts
     */
    onKeyDown(e) {
        // Don't trigger shortcuts when typing in inputs
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        const key = e.key.toLowerCase();
        const ctrl = e.ctrlKey || e.metaKey;
        
        // Spacebar for panning
        if (key === ' ' || key === 'spacebar') {
            e.preventDefault();
            this.startPanning();
            return;
        }
        
        // Tool shortcuts
        const toolShortcuts = {
            'p': 'pencil',
            'b': 'brush',
            'e': 'eraser',
            'i': 'eyedropper'
        };
        
        if (toolShortcuts[key] && typeof ToolManager !== 'undefined') {
            ToolManager.setTool(toolShortcuts[key]);
            e.preventDefault();
            return;
        }
        
        // Zoom shortcuts: Ctrl/Cmd + + / - / 0
        if (ctrl) {
            let handled = false;
            let newZoom = State.zoom;
            
            if (e.key === '+' || e.key === '=') {
                newZoom = State.zoom + 0.1;
                handled = true;
            } else if (e.key === '-') {
                newZoom = State.zoom - 0.1;
                handled = true;
            } else if (e.key === '0') {
                newZoom = 1;
                handled = true;
            }

            if (handled) {
                e.preventDefault();
                newZoom = Math.min(Math.max(newZoom, 0.1), 10.0);
                State.setZoom(newZoom);
                if (typeof ZoomManager !== 'undefined') {
                    ZoomManager.updateCanvasZoom();
                }
                return;
            }
        }
        
        // Undo/Redo shortcuts
        if (ctrl) {
            if (key === 'z') {
                e.preventDefault();
                State.undo();
                this.showNotification('Action undone', 'info');
            } else if (key === 'y') {
                e.preventDefault();
                State.redo();
                if (typeof Notifications !== 'undefined') {
                    const notifications = new Notifications();
                    notifications.info('Action redone');
                }
            }
        }
        
        // Direct zoom shortcuts
        if (key === '+' || key === '=') {
            e.preventDefault();
            State.zoomIn();
            if (typeof ZoomManager !== 'undefined') {
                ZoomManager.updateZoom();
            }
        } else if (key === '-' || key === '_') {
            e.preventDefault();
            State.zoomOut();
            if (typeof ZoomManager !== 'undefined') {
                ZoomManager.updateCanvasZoom();
            }
        } else if (key === '0') {
            e.preventDefault();
            State.resetZoom();
            if (typeof ZoomManager !== 'undefined') {
                ZoomManager.updateCanvasZoom();
            }
        }
        
        // Save/Load shortcuts
        if (ctrl) {
            if (key === 's') {
                e.preventDefault();
                if (typeof FileManager !== 'undefined') {
                    FileManager.saveProject();
                }
            } else if (key === 'o') {
                e.preventDefault();
                if (typeof FileManager !== 'undefined') {
                    FileManager.loadProject();
                }
            }
        }
        
        // Color history shortcuts (keys 1-4)
        if (key >= '1' && key <= '4') {
            const colorIndex = parseInt(key) - 1;
            if (State.recentColors && State.recentColors[colorIndex] && typeof PaletteManager !== 'undefined') {
                PaletteManager.setCurrentColor(State.recentColors[colorIndex]);
                e.preventDefault();
                return;
            }
        }
        
        // Escape key - cancel current operation
        if (key === 'escape') {
            e.preventDefault();
            this.isDrawing = false;
            State.setDrawing(false);
            if (typeof ToolManager !== 'undefined') {
                ToolManager.cancelOperation();
            }
        }
    },

    /**
     * Handle keyboard key release
     */
    onKeyUp(e) {
        const key = e.key.toLowerCase();
        
        // Stop panning when spacebar is released
        if (key === ' ' || key === 'spacebar') {
            e.preventDefault();
            this.stopPanning();
        }
    },

    /**
     * Start panning mode
     */
    startPanning() {
        this.isPanning = true;
        document.body.style.cursor = 'grab';
        
        // Add mousemove listener for panning
        window.addEventListener('mousemove', this.onPanMove);
    },

    /**
     * Stop panning mode
     */
    stopPanning() {
        this.isPanning = false;
        document.body.style.cursor = '';
        
        // Remove mousemove listener for panning
        window.removeEventListener('mousemove', this.onPanMove);
    },

    /**
     * Handle panning movement
     */
    onPanMove(e) {
        if (!this.isPanning) return;
        
        // Get the workspace element
        const workspace = document.querySelector('.workspace');
        if (!workspace) return;
        
        // Calculate movement
        const movementX = e.movementX || 0;
        const movementY = e.movementY || 0;
        
        // Get current scroll position
        const currentScrollLeft = workspace.scrollLeft;
        const currentScrollTop = workspace.scrollTop;
        
        // Update scroll position based on mouse movement
        workspace.scrollLeft = currentScrollLeft - movementX;
        workspace.scrollTop = currentScrollTop - movementY;
    },

    /**
     * Initialize all event listeners
     */
    init() {
        console.log('Initializing Input Handler...');
        
        // NEW: Palette Import Listeners
        if (DOM.elements.importPaletteUrlBtn) {
            DOM.elements.importPaletteUrlBtn.addEventListener('click', () => {
                const url = prompt("Enter the Coolors URL (e.g., https://coolors.co/daffed-9bf3f0-473198-4a0d67-adfc92):");
                if (url && typeof PaletteManager !== 'undefined') {
                    PaletteManager.importPaletteFromUrl(url.trim());
                }
            });
        }
        
        // Add keyup listener for spacebar release
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
        
        // Bind context for panning methods
        this.onPanMove = this.onPanMove.bind(this);

        if (DOM.elements.saveColorBtn) {
            DOM.elements.saveColorBtn.addEventListener('click', () => {
                if (typeof PaletteManager !== 'undefined') {
                    PaletteManager.saveCurrentColor();
                }
            });
        }

        // Drawing events - handled by TilemapCore to avoid conflicts
        // if (DOM.editorCanvas) {
        //     DOM.editorCanvas.addEventListener('mousedown', (e) => this.onDrawStart(e));
        //     window.addEventListener('mousemove', (e) => this.onDrawMove(e));
        //     window.addEventListener('mouseup', (e) => this.onDrawEnd(e));
        //
        //     DOM.editorCanvas.addEventListener('touchstart', (e) => {
        //         e.preventDefault();
        //         this.onDrawStart(e);
        //     }, { passive: false });
        //
        //     window.addEventListener('touchmove', (e) => {
        //         if (this.isDrawing) {
        //             e.preventDefault();
        //         }
        //         this.onDrawMove(e);
        //     }, { passive: false });
        //     window.addEventListener('touchend', (e) => this.onDrawEnd(e));
        // }

        // Zoom events on the main container
        const workspace = document.querySelector('.workspace');
        if (workspace) {
            workspace.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
        }

        // Keyboard
        window.addEventListener('keydown', (e) => this.onKeyDown(e));

        // Tool buttons
        if (DOM.elements.toolButtons) {
            DOM.elements.toolButtons.forEach(btn => {
                if (btn.dataset.tool && typeof ToolManager !== 'undefined') {
                    btn.addEventListener('click', () => ToolManager.setTool(btn.dataset.tool));
                }
            });
        }

        // Color picker - handled by PaletteManager to avoid duplicate listeners

        // Hex input - handled by PaletteManager to avoid duplicate listeners

        // Brush size controls - handled by ToolManager to avoid duplicate listeners

        // Preset brush size buttons (exclude opacity buttons)
        document.querySelectorAll('.preset-btn:not(.opacity-btn)').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const size = parseInt(e.target.dataset.size);
                if (!isNaN(size)) {
                    State.setBrushSize(size);
                    DOM.elements.brushSizeSlider.value = size;
                    DOM.updateBrushDisplay(size);
                    this.updatePresetBrushButtons(size);
                }
            });
        });

        document.querySelectorAll('.preset-size').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const size = parseInt(e.target.dataset.size);
                State.setBrushSize(size);
                if (DOM.elements.brushSizeSliderPanel) {
                    DOM.elements.brushSizeSliderPanel.value = size;
                }
                if (DOM.elements.brushSizeDisplay) {
                    DOM.elements.brushSizeDisplay.textContent = size;
                }
                this.updatePresetBrushButtons(size);
            });
        });

        // Initialize preset buttons on load
        this.updatePresetBrushButtons(State.brushSize);

        // Opacity preset buttons
        document.querySelectorAll('.opacity-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const opacity = parseFloat(e.target.dataset.opacity);
                State.setOpacity(opacity);
                if (DOM.elements.opacitySlider) {
                    DOM.elements.opacitySlider.value = opacity * 100;
                }
                if (DOM.elements.opacityDisplay) {
                    DOM.elements.opacityDisplay.textContent = Math.round(opacity * 100);
                }
                this.updatePresetOpacityButtons(opacity);
            });
        });

        // Initialize opacity preset buttons on load
        this.updatePresetOpacityButtons(State.opacity);

        // Opacity slider - handled by ToolManager to avoid duplicate listeners

        // Layer controls - handled by LayerManager to avoid duplicate event listeners
        // if (DOM.elements.addLayerBtn && typeof LayerManager !== 'undefined') {
        //     DOM.elements.addLayerBtn.addEventListener('click', () => {
        //         LayerManager.addLayer();
        //         if (typeof Notifications !== 'undefined') {
        //             const notifications = new Notifications();
        //             notifications.success('Layer added!');
        //         }
        //     });
        // }

        // File operations
        if (DOM.elements.saveBtn && typeof FileManager !== 'undefined') {
            DOM.elements.saveBtn.addEventListener('click', () => {
                FileManager.saveProject();
            });
        }
        
        if (DOM.elements.loadBtn && typeof FileManager !== 'undefined') {
            DOM.elements.loadBtn.addEventListener('click', () => {
                FileManager.loadProject();
            });
        }
        
        if (DOM.elements.exportBtn && typeof FileManager !== 'undefined') {
            DOM.elements.exportBtn.addEventListener('click', () => {
                FileManager.exportProject();
            });
        }

        if (DOM.elements.addNewBtn && typeof dualGridManager !== 'undefined') {
            DOM.elements.addNewBtn.addEventListener('click', () => {
                dualGridManager.addNewFrames();
                if (typeof Notifications !== 'undefined') {
                    const notifications = new Notifications();
                    notifications.success('Created new tile instance');
                }
            });
        }

        // Undo/Redo buttons
        if (DOM.elements.undoBtn) {
            DOM.elements.undoBtn.addEventListener('click', () => {
                State.undo();
                if (typeof Notifications !== 'undefined') {
                    const notifications = new Notifications();
                    notifications.info('Action undone');
                }
            });
        }

        if (DOM.elements.redoBtn) {
            DOM.elements.redoBtn.addEventListener('click', () => {
                State.redo();
                if (typeof Notifications !== 'undefined') {
                    const notifications = new Notifications();
                    notifications.info('Action redone');
                }
            });
        }

        // Zoom controls
        if (DOM.elements.zoomInBtn && typeof ZoomManager !== 'undefined') {
            DOM.elements.zoomInBtn.addEventListener('click', () => {
                State.zoomIn();
                ZoomManager.updateCanvasZoom();
            });
        }

        if (DOM.elements.zoomOutBtn && typeof ZoomManager !== 'undefined') {
            DOM.elements.zoomOutBtn.addEventListener('click', () => {
                State.zoomOut();
                ZoomManager.updateCanvasZoom();
            });
        }

        if (DOM.elements.zoomResetBtn && typeof ZoomManager !== 'undefined') {
            DOM.elements.zoomResetBtn.addEventListener('click', () => {
                State.resetZoom();
                ZoomManager.updateCanvasZoom();
            });
        }

        // Layers panel toggle
        if (DOM.elements.layersBtn) {
            DOM.elements.layersBtn.addEventListener('click', () => {
                State.setShowLayers(!State.showLayers);
            });
        }


        console.log('Input Handler initialized successfully');
    },

    /**
     * Update preset brush size buttons visual state
     */
    updatePresetBrushButtons(currentSize) {
        document.querySelectorAll('.preset-btn:not(.opacity-btn), .preset-size').forEach(btn => {
            const size = parseInt(btn.dataset.size);
            if (!isNaN(size)) {
                btn.classList.toggle('active', size === currentSize);
            }
        });
    },

    /**
     * Update preset opacity buttons visual state
     */
    updatePresetOpacityButtons(currentOpacity) {
        document.querySelectorAll('.opacity-btn').forEach(btn => {
            const opacity = parseFloat(btn.dataset.opacity);
            if (!isNaN(opacity)) {
                btn.classList.toggle('active', opacity === currentOpacity);
            }
        });
    },

    /**
     * Show notification to user using the new Notifications system
     */
    showNotification(message, type = 'info') {
        if (typeof Notifications !== 'undefined') {
            const notifications = new Notifications();
            switch (type) {
                case 'success':
                    notifications.success(message);
                    break;
                case 'error':
                    notifications.error(message);
                    break;
                case 'warning':
                    notifications.showNotification(message, 'warning');
                    break;
                default:
                    notifications.info(message);
            }
        } else {
            // Fallback to old system if Notifications is not available
            const existing = document.querySelector('.notification');
            if (existing) existing.remove();

            const notification = document.createElement('div');
            notification.className = 'notification';
            notification.textContent = message;

            notification.style.position = 'fixed';
            notification.style.top = '20px';
            notification.style.right = '20px';
            notification.style.padding = '12px 20px';
            notification.style.borderRadius = '4px';
            notification.style.color = '#fff';
            notification.style.fontSize = '12px';
            notification.style.fontWeight = 'bold';
            notification.style.zIndex = '10000';
            notification.style.border = '1px solid rgba(255,255,255,0.2)';
            notification.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
            notification.style.transition = 'all 0.3s ease';
            notification.style.transform = 'translateY(-20px)';
            notification.style.opacity = '0';

            const colors = { success: '#00ff41', error: '#ff006e', info: '#00d9ff' };
            notification.style.backgroundColor = '#1a1a2e';
            notification.style.borderLeft = `4px solid ${colors[type] || colors.info}`;

            document.body.appendChild(notification);

            requestAnimationFrame(() => {
                notification.style.opacity = '1';
                notification.style.transform = 'translateY(0)';
            });

            // Auto remove after 3 seconds
            setTimeout(() => {
                this.hideNotification();
            }, 3000);
        }
    },

    /**
     * Hide/remove notification manually
     */
    hideNotification() {
        const notification = document.querySelector('.notification');
        if (notification) {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }
    },

    /**
     * Clean up event listeners (for page unload)
     */
    destroy() {
        // Remove all event listeners added by this handler
        window.removeEventListener('mousemove', this.onDrawMove);
        window.removeEventListener('mouseup', this.onDrawEnd);
        window.removeEventListener('touchmove', this.onDrawMove);
        window.removeEventListener('touchend', this.onDrawEnd);
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
    }
};

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { InputHandler };
}