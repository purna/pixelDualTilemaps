// layer-manager.js
// Layer management functionality

const LayerManager = {
    init() {
        this.setupEventListeners();
        this.createDefaultLayer();
        console.log('Layer Manager initialized');
    },
    
    setupEventListeners() {
        // Add layer button
        DOM.elements.addLayerBtn.addEventListener('click', () => {
            this.addLayer();
        });
        
        // Layers panel toggle
        DOM.elements.layersBtn.addEventListener('click', () => {
            State.setShowLayers(!State.showLayers);
        });
        
        // Layer list click handling
        DOM.elements.layersList.addEventListener('click', (e) => {
            this.handleLayerListClick(e);
        });
        
        // Layer list context menu (right-click)
        DOM.elements.layersList.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.handleLayerContextMenu(e);
        });
        
        // Drag and drop for layer reordering
        DOM.elements.layersList.addEventListener('dragstart', (e) => {
            this.handleDragStart(e);
        });
        
        DOM.elements.layersList.addEventListener('dragover', (e) => {
            this.handleDragOver(e);
        });
        
        DOM.elements.layersList.addEventListener('drop', (e) => {
            this.handleDrop(e);
        });
    },
    
    createDefaultLayer() {
        State.addLayer('Layer 1');
        // Transfer any existing content from the editor canvas to the first layer
        const firstLayer = State.layers[0];
        if (firstLayer) {
            const layerCtx = firstLayer.canvas.getContext('2d');
            layerCtx.drawImage(DOM.editorCanvas, 0, 0);
        }
        this.renderLayers();
    },
    
    addLayer(name = null) {
        if (State.layers.length >= Config.MAX_LAYERS) {
            if (typeof Notifications !== 'undefined') {
                const notifications = new Notifications();
                notifications.warning(`Maximum ${Config.MAX_LAYERS} layers allowed`);
            }
            return;
        }

        const layerName = name || `Layer ${State.layers.length + 1}`;
        console.log('LayerManager.addLayer called with name:', layerName);
        State.addLayer(layerName);
        this.renderLayers();
        if (typeof Notifications !== 'undefined') {
            const notifications = new Notifications();
            notifications.success(`Layer "${layerName}" added`);
        }
        State.markUnsaved();
    },
    
    removeLayer(index) {
        if (State.layers.length <= 1) {
            if (typeof Notifications !== 'undefined') {
                const notifications = new Notifications();
                notifications.warning('Cannot delete the last layer');
            }
            return;
        }

        const layerName = State.layers[index].name;
        console.log('LayerManager.removeLayer called with index:', index, 'name:', layerName);
        State.removeLayer(index);
        this.renderLayers();
        if (typeof Notifications !== 'undefined') {
            const notifications = new Notifications();
            notifications.info(`Layer "${layerName}" deleted`);
        }
        State.markUnsaved();
    },
    
    setActiveLayer(index) {
        console.log('Setting active layer to index:', index);
        State.setActiveLayer(index);
        this.renderLayers();
        console.log('Active layer index after setting:', State.activeLayerIndex);

        // Update eye icon color for the newly active layer
        const layerItem = DOM.elements.layersList.querySelector(`[data-index="${index}"]`);
        if (layerItem) {
            const visibilityBtn = layerItem.querySelector('.visibility-btn i');
            if (visibilityBtn) {
                visibilityBtn.style.color = 'var(--accent-primary)';
            }
        }
    },
    
    toggleLayerVisibility(index) {
        console.log('Toggle layer visibility called for index:', index);
        console.log('Current layer visibility before toggle:', State.layers[index].visible);

        State.toggleLayerVisibility(index);

        console.log('Layer visibility after toggle:', State.layers[index].visible);
        this.renderLayers();
        State.markUnsaved();

        // Update the visibility icon immediately
        const layerItem = DOM.elements.layersList.querySelector(`[data-index="${index}"]`);
        if (layerItem) {
            const visibilityBtn = layerItem.querySelector('.visibility-btn i');
            if (visibilityBtn) {
                visibilityBtn.className = `fas ${State.layers[index].visible ? 'fa-eye' : 'fa-eye-slash'}`;
                // Set theme color for active layer's eye icon
                if (index === State.activeLayerIndex) {
                    visibilityBtn.style.color = 'var(--accent-primary)';
                } else {
                    visibilityBtn.style.color = '';
                }
            }
        }
    },
    
    duplicateLayer(index) {
        if (State.layers.length >= Config.MAX_LAYERS) {
            if (typeof Notifications !== 'undefined') {
                const notifications = new Notifications();
                notifications.warning(`Maximum ${Config.MAX_LAYERS} layers allowed`);
            }
            return;
        }

        const sourceLayer = State.layers[index];
        const newLayer = {
            id: Date.now(),
            name: `${sourceLayer.name} Copy`,
            visible: sourceLayer.visible,
            opacity: sourceLayer.opacity,
            canvas: State.createLayerCanvas()
        };

        // Copy canvas content
        const sourceCtx = sourceLayer.canvas.getContext('2d');
        const destCtx = newLayer.canvas.getContext('2d');
        destCtx.drawImage(sourceLayer.canvas, 0, 0);

        State.layers.splice(index + 1, 0, newLayer);
        this.renderLayers();
        if (typeof Notifications !== 'undefined') {
            const notifications = new Notifications();
            notifications.success(`Layer "${sourceLayer.name}" duplicated`);
        }
        State.markUnsaved();
    },
    
    renameLayer(index, newName) {
        if (State.layers[index]) {
            State.layers[index].name = newName;
            // Don't re-render all layers, just update the name display
            const layerItem = DOM.elements.layersList.querySelector(`[data-index="${index}"]`);
            if (layerItem) {
                const layerNameLabel = layerItem.querySelector('.layer-name-label');
                const layerNameInput = layerItem.querySelector('.layer-name-input');
                if (layerNameLabel) {
                    layerNameLabel.textContent = newName;
                }
                if (layerNameInput) {
                    layerNameInput.value = newName;
                }
            }
            State.markUnsaved();
        }
    },
    
    moveLayer(index, direction) {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        
        if (newIndex < 0 || newIndex >= State.layers.length) {
            return; // Can't move further
        }
        
        // Swap layers
        const temp = State.layers[index];
        State.layers[index] = State.layers[newIndex];
        State.layers[newIndex] = temp;
        
        // Update active layer index if necessary
        if (State.activeLayerIndex === index) {
            State.activeLayerIndex = newIndex;
        } else if (State.activeLayerIndex === newIndex) {
            State.activeLayerIndex = index;
        }
        
        this.renderLayers();
        State.markUnsaved();
    },
    
    // Drag and drop functionality for layer reordering
    draggedElement: null,
    
    handleDragStart(e) {
        const layerItem = e.target.closest('.layer-item');
        if (!layerItem) return;
        
        this.draggedElement = layerItem;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', layerItem.outerHTML);
        
        // Add visual feedback
        layerItem.style.opacity = '0.5';
        layerItem.style.border = '2px dashed var(--accent-tertiary)';
    },
    
    handleDragOver(e) {
        if (e.preventDefault) {
            e.preventDefault(); // Allow drop
        }
        e.dataTransfer.dropEffect = 'move';
        
        const layerItem = e.target.closest('.layer-item');
        if (layerItem && layerItem !== this.draggedElement) {
            // Add visual feedback for drop target
            layerItem.classList.add('drag-over');
        }
        
        return false;
    },
    
    handleDrop(e) {
        if (e.stopPropagation) {
            e.stopPropagation(); // Prevent event bubbling
        }
        
        // Remove visual feedback
        document.querySelectorAll('.drag-over').forEach(item => {
            item.classList.remove('drag-over');
        });
        
        if (this.draggedElement) {
            this.draggedElement.style.opacity = '';
            this.draggedElement.style.border = '';
        }
        
        const targetItem = e.target.closest('.layer-item');
        if (!targetItem || targetItem === this.draggedElement) {
            this.draggedElement = null;
            return false;
        }
        
        const sourceIndex = parseInt(this.draggedElement.dataset.index);
        const targetIndex = parseInt(targetItem.dataset.index);
        
        if (!isNaN(sourceIndex) && !isNaN(targetIndex)) {
            this.reorderLayers(sourceIndex, targetIndex);
        }
        
        this.draggedElement = null;
        return false;
    },
    
    reorderLayers(sourceIndex, targetIndex) {
        if (sourceIndex === targetIndex) return;
        
        // Get the layer being moved
        const movingLayer = State.layers[sourceIndex];
        
        // Remove it from the array
        State.layers.splice(sourceIndex, 1);
        
        // Insert it at the new position
        State.layers.splice(targetIndex, 0, movingLayer);
        
        // Update active layer index if necessary
        if (State.activeLayerIndex === sourceIndex) {
            State.activeLayerIndex = targetIndex;
        } else if (sourceIndex < State.activeLayerIndex && targetIndex >= State.activeLayerIndex) {
            State.activeLayerIndex--;
        } else if (sourceIndex > State.activeLayerIndex && targetIndex <= State.activeLayerIndex) {
            State.activeLayerIndex++;
        }
        
        this.renderLayers();
        State.markUnsaved();
        
        // Update canvas to reflect new layer order
        if (typeof TilemapCore !== 'undefined') {
            TilemapCore.updatePreviews();
        }
        
        console.log(`Moved layer from index ${sourceIndex} to ${targetIndex}`);
    },
    
    handleLayerListClick(e) {
        const layerItem = e.target.closest('.layer-item');
        if (!layerItem) return;
        
        const index = parseInt(layerItem.dataset.index);
        
        // Handle visibility toggle
        if (e.target.classList.contains('visibility-btn') || e.target.closest('.visibility-btn')) {
            e.stopPropagation();
            e.preventDefault();
            console.log('Toggling visibility for layer index:', index);
            this.toggleLayerVisibility(index);
            return;
        }
        
        // Handle delete
        if (e.target.classList.contains('delete-btn') || e.target.closest('.delete-btn')) {
            e.stopPropagation();
            e.preventDefault();
            // Check if the layer exists before trying to access its name
            if (State.layers[index] && confirm(`Delete layer "${State.layers[index].name}"?`)) {
                this.removeLayer(index);
            }
            return;
        }
        
        // Set as active layer (only if not clicking on a control button)
        if (!e.target.closest('.layer-controls')) {
            console.log('Setting active layer to index:', index);
            this.setActiveLayer(index);
            // Update eye icon color for the newly active layer
            const layerItem = DOM.elements.layersList.querySelector(`[data-index="${index}"]`);
            if (layerItem) {
                const visibilityBtn = layerItem.querySelector('.visibility-btn i');
                if (visibilityBtn) {
                    visibilityBtn.style.color = 'var(--accent-primary)';
                }
            }
        }
    },
    
    handleLayerContextMenu(e) {
        const layerItem = e.target.closest('.layer-item');
        if (!layerItem) return;
        
        const index = parseInt(layerItem.dataset.index);
        
        // Create context menu
        const contextMenu = this.createContextMenu(index, e.clientX, e.clientY);
        document.body.appendChild(contextMenu);
        
        // Close menu when clicking elsewhere
        const closeMenu = (event) => {
            if (!contextMenu.contains(event.target)) {
                contextMenu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 0);
    },
    
    createContextMenu(index, x, y) {
        const menu = document.createElement('div');
        menu.className = 'layer-context-menu';
        menu.style.cssText = `
            position: fixed;
            top: ${y}px;
            left: ${x}px;
            background: var(--bg-dark);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 8px 0;
            z-index: 10000;
            min-width: 150px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;
        
        const menuItems = [
            { text: 'Duplicate Layer', action: () => this.duplicateLayer(index) },
            { text: 'Move Up', action: () => this.moveLayer(index, 'up'), disabled: index === 0 },
            { text: 'Move Down', action: () => this.moveLayer(index, 'down'), disabled: index === State.layers.length - 1 },
            { text: '---', separator: true },
            { text: 'Delete Layer', action: () => {
                // Check if the layer exists before trying to access its name
                if (State.layers[index] && confirm(`Delete layer "${State.layers[index].name}"?`)) {
                    this.removeLayer(index);
                }
            }, danger: true }
        ];
        
        menuItems.forEach(item => {
            if (item.separator) {
                const separator = document.createElement('div');
                separator.style.cssText = 'height: 1px; background: var(--border-color); margin: 4px 0;';
                menu.appendChild(separator);
                return;
            }
            
            const menuItem = document.createElement('div');
            menuItem.textContent = item.text;
            menuItem.style.cssText = `
                padding: 8px 16px;
                cursor: pointer;
                color: ${item.danger ? 'var(--accent-secondary)' : 'var(--text-primary)'};
                ${item.disabled ? 'opacity: 0.5; cursor: not-allowed;' : ''}
            `;
            
            if (!item.disabled) {
                menuItem.addEventListener('click', () => {
                    item.action();
                    menu.remove();
                });
                
                menuItem.addEventListener('mouseenter', () => {
                    menuItem.style.background = 'var(--bg-medium)';
                });
                
                menuItem.addEventListener('mouseleave', () => {
                    menuItem.style.background = 'transparent';
                });
            }
            
            menu.appendChild(menuItem);
        });
        
        return menu;
    },
    
    renderLayers() {
        const container = DOM.elements.layersList;
        container.innerHTML = '';
        
        // Display layers from top to bottom (reverse order)
        State.layers.slice().reverse().forEach((layer, reverseIndex) => {
            const actualIndex = State.layers.length - 1 - reverseIndex;
            const layerElement = DOM.createLayerElement(layer, actualIndex, actualIndex === State.activeLayerIndex);
            container.appendChild(layerElement);
            
            // Update layer preview
            const previewCanvas = layerElement.querySelector('canvas');
            const previewCtx = previewCanvas.getContext('2d');
            previewCtx.drawImage(layer.canvas, 0, 0, 32, 32);
        });
    },
    
    // Get layer data for saving
    getLayerData() {
        return State.layers.map(layer => ({
            name: layer.name,
            visible: layer.visible,
            opacity: layer.opacity,
            imageData: layer.canvas.toDataURL()
        }));
    },
    
    // Load layer data
    loadLayerData(layerData) {
        State.layers = [];
        State.activeLayerIndex = 0;
        
        layerData.forEach((data, index) => {
            const layer = {
                id: Date.now() + index,
                name: data.name,
                visible: data.visible,
                opacity: data.opacity,
                canvas: State.createLayerCanvas()
            };
            
            // Load image data
            const img = new Image();
            img.onload = () => {
                layer.canvas.getContext('2d').drawImage(img, 0, 0);
            };
            img.src = data.imageData;
            
            State.layers.push(layer);
        });
        
        this.renderLayers();
    }
};