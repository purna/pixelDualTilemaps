// dom.js
// DOM utilities and element references

const DOM = {
    // Canvas elements
    editorCanvas: null,
    editorCtx: null,
    allCanvases: [],
    previewContexts: [],

    // UI elements
    elements: {},

    init() {
        // Initialize canvas references
        this.editorCanvas = document.getElementById('editor-canvas');
        if (!this.editorCanvas) {
            console.error('Editor canvas not found!');
            return;
        }
        this.editorCtx = this.editorCanvas.getContext('2d');

        // Collect all canvas elements
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                const canvasId = (r === 1 && c === 1) ? 'editor-canvas' : `preview-${r}-${c}`;
                const canvas = document.getElementById(canvasId);
                
                if (!canvas) {
                    console.warn(`Canvas ${canvasId} not found!`);
                    continue;
                }
                
                const ctx = canvas.getContext('2d');

                // Store grid position on the canvas element
                canvas.gridR = r;
                canvas.gridC = c;

                this.allCanvases.push(canvas);

                if (canvasId !== 'editor-canvas') {
                    this.previewContexts.push(ctx);
                }

                // Clear canvas to transparent
                ctx.clearRect(0, 0, Config.CANVAS_SIZE, Config.CANVAS_SIZE);
            }
        }

        // Initialize UI element references
        this.elements = {
            // Buttons
            undoBtn: document.getElementById('undoBtn'),
            redoBtn: document.getElementById('redoBtn'),
            saveBtn: document.getElementById('saveBtn'),
            loadBtn: document.getElementById('loadBtn'),
            addNewBtn: document.getElementById('addNewBtn'),
            exportBtn: document.getElementById('exportBtn'),
            addLayerBtn: document.getElementById('addLayerBtn'),
            saveColorBtn: document.getElementById('saveColorBtn'),
            importPaletteUrlBtn: document.getElementById('importPaletteUrlBtn'),
            settingsBtn: document.getElementById('settingsBtn'),


            // Zoom controls
            zoomInBtn: document.getElementById('zoomInBtn'),
            zoomOutBtn: document.getElementById('zoomOutBtn'),
            zoomResetBtn: document.getElementById('zoomResetBtn'),
            zoomDisplay: document.getElementById('zoomDisplay'),

            // Controls
            brushSizeSlider: document.getElementById('brush-size'),
            brushSizeValue: document.getElementById('brush-size-value'),
            brushSizeSliderPanel: document.getElementById('brushSizeSlider'),
            brushSizeDisplay: document.getElementById('brushSizeDisplay'),
            brushSizeLabel: document.querySelector('label[for="brush-size"]'),
            brushSizeLabelPanel: document.getElementById('brushSizeLabelPanel'),
            colorPicker: document.getElementById('colorPicker'),
            colorHex: document.getElementById('colorHex'),
            opacitySlider: document.getElementById('opacitySlider'),
            opacityDisplay: document.getElementById('opacityDisplay'),

            // Tool buttons
            toolButtons: document.querySelectorAll('.tool-btn'),
            layersBtn: document.getElementById('layersBtn'),

            // Containers
            paletteContainer: document.getElementById('palette-container'),
            layersList: document.getElementById('layers-list'),
            sidePanel: document.getElementById('side-panel'),

            // File inputs
            fileInput: document.getElementById('fileInput'),
            paletteFileInput: document.getElementById('paletteFileInput')
        };

        // Initialize default values
        if (this.elements.brushSizeValue) {
            this.elements.brushSizeValue.textContent = `1`;
        }

        console.log('DOM initialized successfully');
    },

    updateBrushDisplay(radius) {
        const size = 2 * radius + 1;
        if (this.elements.brushSizeValue) {
            this.elements.brushSizeValue.textContent = `${size}x${size}`;
        }
    },

    createSwatch(color, active = false) {
        const swatch = document.createElement('div');
        swatch.className = 'swatch';
        swatch.style.backgroundColor = color;
        if (active) {
            swatch.classList.add('active');
        }
        swatch.dataset.color = color;
        return swatch;
    },

    createLayerElement(layer, index, isActive = false) {
        const layerItem = document.createElement('div');
        layerItem.className = 'layer-item';
        layerItem.draggable = true; // Enable drag and drop
        if (isActive) {
            layerItem.classList.add('active');
        }
        layerItem.dataset.index = index;

        layerItem.innerHTML = `
            <div class="layer-info">
                <div class="layer-preview">
                    <canvas width="32" height="32"></canvas>
                </div>
                <div class="layer-name-container">
                    <label class="layer-name-label" for="layer-name-${index}">${layer.name}</label>
                    <input type="text" id="layer-name-${index}" class="layer-name-input" value="${layer.name}" style="display: none;">
                </div>
            </div>
            <div class="layer-controls">
                <button class="visibility-btn" title="Toggle Visibility">
                    <i class="fas ${layer.visible ? 'fa-eye' : 'fa-eye-slash'}"></i>
                </button>
                <button class="delete-btn" title="Delete Layer">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        // Add double-click handler for renaming
        const layerNameLabel = layerItem.querySelector('.layer-name-label');
        const layerNameInput = layerItem.querySelector('.layer-name-input');
        if (layerNameLabel && layerNameInput) {
            layerNameLabel.addEventListener('dblclick', (e) => {
                e.preventDefault();
                e.stopPropagation();
                DOM.startLayerRename(layerNameLabel, layerNameInput, index);
            });
        }

        // Add click handler for visibility button
        const visibilityBtn = layerItem.querySelector('.visibility-btn');
        if (visibilityBtn) {
            visibilityBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (typeof LayerManager !== 'undefined') {
                    const layerIndex = parseInt(layerItem.dataset.index);
                    LayerManager.toggleLayerVisibility(layerIndex);
                }
            });
        }

        return layerItem;
    },

    startLayerRename(nameLabel, nameInput, layerIndex) {
        const currentName = nameLabel.textContent;

        // Show the input field and hide the label
        nameLabel.style.display = 'none';
        nameInput.style.display = 'inline-block';

        // Set focus with a small delay to ensure it works
        setTimeout(() => {
            nameInput.focus();
            nameInput.select();

            // Prevent focus loss by preventing mouse events during editing
            const preventFocusLoss = (e) => {
                e.preventDefault();
                e.stopPropagation();
            };

            // Add temporary mouse event prevention
            nameInput.addEventListener('mousedown', preventFocusLoss, true);
            nameInput.addEventListener('mouseup', preventFocusLoss, true);
            nameInput.addEventListener('click', preventFocusLoss, true);

            const finishRename = (commit) => {
                // Remove temporary mouse event prevention
                nameInput.removeEventListener('mousedown', preventFocusLoss, true);
                nameInput.removeEventListener('mouseup', preventFocusLoss, true);
                nameInput.removeEventListener('click', preventFocusLoss, true);

                // Hide the input field and show the label
                nameInput.style.display = 'none';
                nameLabel.style.display = 'inline-block';

                nameInput.removeEventListener('blur', blurHandler);
                nameInput.removeEventListener('keydown', keydownHandler);

                if (commit) {
                    const newName = nameInput.value.trim();
                    if (newName && newName !== currentName) {
                        if (typeof LayerManager !== 'undefined') {
                            LayerManager.renameLayer(layerIndex, newName);
                            nameLabel.textContent = newName;
                        } else {
                            // Added notification for debugging if LayerManager is missing
                            DOM.showNotification('Error: LayerManager not found. Rename failed to save.', 'error');
                            nameLabel.textContent = currentName; // Revert name if manager is missing
                        }
                    } else {
                        nameLabel.textContent = currentName;
                    }
                } else {
                    nameLabel.textContent = currentName;
                }
            };

            const blurHandler = () => finishRename(true);

            const keydownHandler = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    finishRename(true);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    finishRename(false);
                }
            };

            nameInput.addEventListener('blur', blurHandler);
            nameInput.addEventListener('keydown', keydownHandler);
        }, 50);
    },

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '8px',
            color: 'white',
            fontSize: '14px',
            fontWeight: '500',
            zIndex: '10000',
            maxWidth: '300px',
            wordWrap: 'break-word'
        });

        // Set background color based on type
        switch (type) {
            case 'success':
                notification.style.background = 'var(--accent-primary)';
                break;
            case 'error':
                notification.style.background = 'var(--accent-secondary)';
                break;
            case 'warning':
                notification.style.background = '#ff9500';
                break;
            default:
                notification.style.background = 'var(--bg-medium)';
        }

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    },

    // Utility methods
    $(selector) {
        return document.querySelector(selector);
    },

    $all(selector) {
        return document.querySelectorAll(selector);
    },

    on(element, event, handler) {
        element.addEventListener(event, handler);
    },

    off(element, event, handler) {
        element.removeEventListener(event, handler);
    },

    toggle(element) {
        element.classList.toggle('hidden');
    },

    show(element) {
        element.classList.remove('hidden');
    },

    hide(element) {
        element.classList.add('hidden');
    }
};