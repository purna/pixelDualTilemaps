// tilemap-core.js
// Core tilemap functionality - seamless drawing across 3x3 canvas grid

const TilemapCore = {
    init() {
        this.setupEventListeners();
        // Initialize layer system if it exists
        if (typeof LayerManager !== 'undefined') {
            LayerManager.init();
        }
        this.updatePreviews();
        console.log('Tilemap Core initialized');
    },
    
    // Flag to prevent drawing during tile switching
    isSwitchingTiles: false,
    
    setupEventListeners() {
        // Apply local listeners to ALL 9 canvases to handle drawing
        DOM.allCanvases.forEach(canvas => {
            this.setupCanvasListeners(canvas);
        });
        
        // Apply global listeners to stop drawing reliably outside the grid area
        document.body.addEventListener('mouseup', this.stopDrawing.bind(this));
        document.body.addEventListener('touchend', this.stopDrawing.bind(this));
        document.body.addEventListener('touchcancel', this.stopDrawing.bind(this));
    },
    
    setupCanvasListeners(canvas) {
        // Attach mousedown/touchstart to initiate drawing
        canvas.addEventListener('mousedown', this.handleDrawing.bind(this));
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleDrawing(e);
        });
        
        // Attach mousemove/touchmove for continuous drawing
        canvas.addEventListener('mousemove', (e) => {
            if (State.isDrawing && (e.buttons === 1 || e.buttons === 2)) {
                this.handleDrawing(e);
            }
        });
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (State.isDrawing) {
                this.handleDrawing(e);
            }
        });
        
        // Handle context menu to allow right-click erase
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.handleDrawing(e);
            this.stopDrawing(); // Immediately stop after single click erase
        });
    },
    
handleDrawing(e) {
    const targetCanvas = e.target;
    
    // Check if we have a valid canvas with grid position
    if (typeof targetCanvas.gridC !== 'number') {
        return;
    }
    
    // Handle eyedropper tool differently - it should pick colors, not draw
    if (State.currentTool === 'eyedropper') {
        this.handleEyedropper(e, targetCanvas);
        return;
    }
    
    // Determine the brush type based on mouse button or event type
    if (e.type === 'contextmenu') {
        e.preventDefault();
        State.setBrush(Config.ERASE_COLOR);
        State.setDrawing(true);
    } else if (e.buttons === 1 || e.type.startsWith('touch')) {
        State.setBrush(State.currentColor.startsWith('#') ? State.hexToRgb(State.currentColor) : State.currentColor);
        State.setDrawing(true);
    } else if (e.buttons === 2) {
        State.setBrush(Config.ERASE_COLOR);
        State.setDrawing(true);
    }
    
    if (!State.isDrawing) return;
    
    const rect = targetCanvas.getBoundingClientRect();
    const clientX = e.clientX || e.touches?.[0]?.clientX;
    const clientY = e.clientY || e.touches?.[0]?.clientY;
    
    if (!clientX || !clientY) return;
    
    let x = clientX - rect.left;
    let y = clientY - rect.top;
    
    // Account for zoom when calculating coordinates
    // When the grid is scaled, mouse coordinates need to be adjusted
    const scale = State.zoom;
    x = x / scale;
    y = y / scale;
    
    // Calculate the logical tile coordinate (0 to 31) within the clicked canvas
    const tileX = Math.floor(x / Config.PIXEL_SIZE);
    const tileY = Math.floor(y / Config.PIXEL_SIZE);
    
    // Safety check for bounds
    if (tileX < 0 || tileX >= Config.TILE_DIM || tileY < 0 || tileY >= Config.TILE_DIM) return;
    
    // Calculate the offset from the central tile (1, 1)
    const deltaX = (targetCanvas.gridC - 1) * Config.TILE_DIM;
    const deltaY = (targetCanvas.gridR - 1) * Config.TILE_DIM;
    
    // Calculate the absolute tile coordinate in the conceptual infinite grid
    const absTileX = tileX + deltaX;
    const absTileY = tileY + deltaY;
    
    // Use the actual brush size for both pencil and brush tools
    // Pencil tool will still maintain hard edges but respect the size setting
    const drawR = State.brushSize;
    
    // Draw brush stroke with wrapping logic
    for (let dx = -drawR; dx <= drawR; dx++) {
        for (let dy = -drawR; dy <= drawR; dy++) {
            const brushAbsX = absTileX + dx;
            const brushAbsY = absTileY + dy;
            
            // Wrap the final location back to the central tile's data [0, 31]
            let drawX = (brushAbsX % Config.TILE_DIM + Config.TILE_DIM) % Config.TILE_DIM;
            let drawY = (brushAbsY % Config.TILE_DIM + Config.TILE_DIM) % Config.TILE_DIM;
            
            // Calculate distance from center for alpha blending
            const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
            
            // Draw on the active layer's canvas (if layers exist), otherwise use editor context
            const activeLayer = State.layers[State.activeLayerIndex];
            const targetCtx = activeLayer ? activeLayer.canvas.getContext('2d') : DOM.editorCtx;
            this.drawPixel(targetCtx, drawX, drawY, State.currentBrush, State.opacity, distanceFromCenter, drawR);
        }
    }
    
    // Update all 8 surrounding preview canvases to show the seamless result
    this.updatePreviews();
    
    // Mark state as needing save
    State.markUnsaved();
},

// NEW: Handle eyedropper tool specifically
handleEyedropper(e, targetCanvas) {
    // Only pick color on mouse down/touch start, not on move
    if (e.type === 'mousedown' || e.type === 'touchstart') {
        const rect = targetCanvas.getBoundingClientRect();
        const clientX = e.clientX || e.touches?.[0]?.clientX;
        const clientY = e.clientY || e.touches?.[0]?.clientY;
        
        if (!clientX || !clientY) return;
        
        let x = clientX - rect.left;
        let y = clientY - rect.top;
        
        // Account for zoom when calculating coordinates
        const scale = State.zoom;
        x = x / scale;
        y = y / scale;
        
        // Calculate the logical tile coordinate (0 to 31) within the clicked canvas
        const tileX = Math.floor(x / Config.PIXEL_SIZE);
        const tileY = Math.floor(y / Config.PIXEL_SIZE);
        
        // Safety check for bounds
        if (tileX < 0 || tileX >= Config.TILE_DIM || tileY < 0 || tileY >= Config.TILE_DIM) return;
        
        // Calculate the offset from the central tile (1, 1)
        const deltaX = (targetCanvas.gridC - 1) * Config.TILE_DIM;
        const deltaY = (targetCanvas.gridR - 1) * Config.TILE_DIM;
        
        // Calculate the absolute tile coordinate in the conceptual infinite grid
        const absTileX = tileX + deltaX;
        const absTileY = tileY + deltaY;
        
        // Wrap the final location back to the central tile's data [0, 31]
        let drawX = (absTileX % Config.TILE_DIM + Config.TILE_DIM) % Config.TILE_DIM;
        let drawY = (absTileY % Config.TILE_DIM + Config.TILE_DIM) % Config.TILE_DIM;
        
        // Get the pixel color from the active layer
        const activeLayer = State.layers[State.activeLayerIndex];
        const targetCtx = activeLayer ? activeLayer.canvas.getContext('2d') : DOM.editorCtx;
        
        // Get pixel data
        const pixelData = targetCtx.getImageData(drawX * Config.PIXEL_SIZE, drawY * Config.PIXEL_SIZE, 1, 1).data;
        
        // Convert to hex color
        const hexColor = `#${((1 << 24) + (pixelData[0] << 16) + (pixelData[1] << 8) + pixelData[2]).toString(16).slice(1)}`;
        
        // Set the new color
        State.setColor(hexColor);
        
        // Update the color picker UI
        if (typeof PaletteManager !== 'undefined') {
            PaletteManager.updateColorPicker(hexColor);
        }
        
        console.log(`Eyedropper picked color: ${hexColor} at (${drawX}, ${drawY})`);
    }
},
    
    drawPixel(ctx, tileX, tileY, color, opacity = 1.0, distanceFromCenter = 0, brushRadius = 0) {
        // Convert logical tile coordinates (0-31) to screen pixel coordinates (0-511)
        const screenX = tileX * Config.PIXEL_SIZE;
        const screenY = tileY * Config.PIXEL_SIZE;
        
        ctx.save();
        
        // For brush tool, apply alpha gradient based on distance from center
        if (State.currentTool === 'brush' && brushRadius > 0) {
            const maxDistance = brushRadius + 1;
            const normalizedDistance = distanceFromCenter / maxDistance;
            const edgeAlpha = Math.max(0.1, 1.0 - (normalizedDistance * 0.8)); // Fade to 20% at edges
            ctx.globalAlpha = opacity * edgeAlpha;
        } else {
            // For pencil tool and single-pixel brush, use full opacity (harsh edges)
            ctx.globalAlpha = opacity;
        }
        
        if (color === 'transparent') {
            ctx.clearRect(screenX, screenY, Config.PIXEL_SIZE, Config.PIXEL_SIZE);
        } else {
            ctx.fillStyle = color;
            ctx.fillRect(screenX, screenY, Config.PIXEL_SIZE, Config.PIXEL_SIZE);
        }
        ctx.restore();
    },
    
    stopDrawing() {
        State.setDrawing(false);
    },
    
    updatePreviews() {
        console.log(`Updating previews - ${State.layers.length} layers available`);

        // Check if DOM.editorCtx is available
        if (!DOM.editorCtx) {
            console.error('DOM.editorCtx is null or undefined');
            return;
        }

        // Clear the main editor canvas first
        DOM.editorCtx.clearRect(0, 0, Config.CANVAS_SIZE, Config.CANVAS_SIZE);

        // Composite all visible layers onto the main editor canvas
        // Draw in normal order so bottom layers in UI appear on bottom in canvas
        State.layers.forEach((layer, index) => {
            if (layer.visible) {
                console.log(`Compositing layer ${index}: ${layer.name} (opacity: ${layer.opacity})`);
                DOM.editorCtx.globalAlpha = layer.opacity;
                DOM.editorCtx.drawImage(layer.canvas, 0, 0);
            }
        });

        // Reset alpha
        DOM.editorCtx.globalAlpha = 1.0;

        // Copy the composited result to all 8 preview canvases
        const imageData = DOM.editorCtx.getImageData(0, 0, Config.CANVAS_SIZE, Config.CANVAS_SIZE);
        DOM.previewContexts.forEach((ctx, index) => {
            if (ctx) {
                ctx.putImageData(imageData, 0, 0);
            }
        });

        console.log('Preview update completed successfully');
        
        // Draw grid overlay if enabled
        this.drawGridOverlay();
    },
    
    clearCanvas() {
        // Clear all canvases to transparent
        if (DOM.editorCtx) {
            DOM.editorCtx.clearRect(0, 0, Config.CANVAS_SIZE, Config.CANVAS_SIZE);
        }

        DOM.previewContexts.forEach(ctx => {
            if (ctx) {
                ctx.clearRect(0, 0, Config.CANVAS_SIZE, Config.CANVAS_SIZE);
            }
        });
        
        State.markUnsaved();
    },
    
    // Get current canvas data as image data
    getCanvasData() {
        return DOM.editorCtx.getImageData(0, 0, Config.CANVAS_SIZE, Config.CANVAS_SIZE);
    },
    
    // Load canvas data from image data
    setCanvasData(imageData) {
        DOM.editorCtx.putImageData(imageData, 0, 0);
        this.updatePreviews();
    },
    
    // Export current canvas as data URL
    exportCanvas(format = 'image/png', quality = 1.0) {
        return DOM.editorCanvas.toDataURL(format, quality);
    },
    
    // Import canvas from data URL
    importCanvas(dataURL) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                // Clear current canvas
                this.clearCanvas();
                
                // Draw the imported image
                DOM.editorCtx.drawImage(img, 0, 0);
                this.updatePreviews();
                resolve();
            };
            img.onerror = reject;
            img.src = dataURL;
        });
    },
    
    // Draw grid overlay at half canvas dimensions
    drawGridOverlay() {
        // Check if grid overlay is enabled in settings
        const settings = typeof SettingsManager !== 'undefined' ? SettingsManager.getSettings() : { showGrid: true };
        if (!settings.showGrid) return;
        
        // Calculate grid spacing (half of canvas dimension)
        const gridSpacing = Math.floor(Config.TILE_DIM / 2) * Config.PIXEL_SIZE;
        
        // Draw grid lines on all preview canvases
        DOM.previewContexts.forEach(ctx => {
            if (ctx) {
                ctx.save();
                ctx.strokeStyle = 'rgba(0, 217, 255, 0.7)'; // Cyan color with transparency
                ctx.lineWidth = 2;
                ctx.setLineDash([8, 4]); // Dashed line pattern

                // Draw vertical lines
                for (let x = gridSpacing; x < Config.CANVAS_SIZE; x += gridSpacing) {
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, Config.CANVAS_SIZE);
                    ctx.stroke();
                }

                // Draw horizontal lines
                for (let y = gridSpacing; y < Config.CANVAS_SIZE; y += gridSpacing) {
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(Config.CANVAS_SIZE, y);
                    ctx.stroke();
                }

                // Draw center marker
                ctx.beginPath();
                ctx.arc(Config.CANVAS_SIZE / 2, Config.CANVAS_SIZE / 2, 4, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 0, 110, 0.8)'; // Pink color
                ctx.fill();

                ctx.restore();
            }
        });
    },
    
    // Call this method after updating previews to draw the grid overlay
    updatePreviewsWithGrid() {
        this.updatePreviews();
        this.drawGridOverlay();
    }
};