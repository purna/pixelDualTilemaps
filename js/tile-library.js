// tile-library.js
// Save, reopen and delete named tiles, with browser persistence.

const TileLibrary = {
    STORAGE_KEY: 'pixelDualTilemaps:tile-library:v1',
    WORKING_KEY: 'pixelDualTilemaps:working-tile:v1',
    PREVIEW_SIZE: 96,
    MAX_TILES: 16,

    tiles: [],
    currentId: null,
    initialized: false,
    elements: {},

    init() {
        if (this.initialized) return;
        this.cacheElements();
        if (!this.elements.list) return;

        this.loadLibrary();
        this.bindEvents();
        this.render();
        this.initialized = true;
        console.log('Tile Library initialized');
    },

    cacheElements() {
        this.elements = {
            list: document.getElementById('tile-library-list'),
            nameInput: document.getElementById('tile-name-input'),
            saveNewBtn: document.getElementById('save-new-tile-btn'),
            newBlankBtn: document.getElementById('new-blank-tile-btn'),
            saveWorkingBtn: document.getElementById('save-working-copy-btn'),
            restoreWorkingBtn: document.getElementById('restore-working-copy-btn'),
            tilesBtn: document.getElementById('tilesBtn'),
            settingsModal: document.getElementById('unified-settings-modal')
        };
    },

    bindEvents() {
        this.elements.tilesBtn?.addEventListener('click', () => this.openSettingsTab());
        this.elements.saveNewBtn?.addEventListener('click', () => this.saveAsNewTile());
        this.elements.newBlankBtn?.addEventListener('click', () => this.createNewTile());
        this.elements.saveWorkingBtn?.addEventListener('click', () => this.saveWorkingCopy());
        this.elements.restoreWorkingBtn?.addEventListener('click', () => this.restoreWorkingCopy());
        this.elements.list?.addEventListener('click', event => this.handleListClick(event));

        document.addEventListener('keydown', event => {
            if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (event.key.toLowerCase() === 't') {
                event.preventDefault();
                this.openSettingsTab();
            }
        });
    },

    openSettingsTab() {
        const modal = this.elements.settingsModal;
        if (!modal) return;

        if (!modal.classList.contains('open')) {
            if (typeof SettingsManager !== 'undefined' && SettingsManager.openSettings) {
                SettingsManager.openSettings();
            } else {
                modal.classList.add('open');
            }
        }

        const tab = modal.querySelector('.settings-tab[data-tab="tiles"]');
        if (tab) {
            tab.click();
            tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }

        if (typeof UIManager !== 'undefined' && UIManager.setActiveSidebarButton) {
            UIManager.setActiveSidebarButton('tilesBtn');
        }
        this.render();
    },

    loadLibrary() {
        try {
            const parsed = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
            const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.tiles) ? parsed.tiles : []);
            this.tiles = list
                .filter(tile => tile && tile.id && Array.isArray(tile.layers))
                .map(tile => ({ ...tile, name: tile.name || 'Untitled Tile' }))
                .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
        } catch (error) {
            console.warn('Could not load the tile library:', error);
            this.tiles = [];
        }
    },

    persistLibrary() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.tiles));
            return true;
        } catch (error) {
            console.error('Could not save the tile library:', error);
            this.notify('error', 'Browser storage is full. Delete a saved tile or export a project file.');
            return false;
        }
    },

    persistWorking(snapshot) {
        try {
            localStorage.setItem(this.WORKING_KEY, JSON.stringify(snapshot));
            return true;
        } catch (error) {
            console.error('Could not save the working copy:', error);
            this.notify('error', 'Browser storage is full. Delete a saved tile or export a project file.');
            return false;
        }
    },

    readWorkingCopy() {
        try {
            const saved = localStorage.getItem(this.WORKING_KEY);
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.warn('Could not read the working copy:', error);
            return null;
        }
    },

    getCurrentIndex() {
        if (typeof dualGridManager !== 'undefined' && dualGridManager.selectedTile) {
            const index = parseInt(dualGridManager.selectedTile.dataset.index, 10);
            if (Number.isInteger(index)) return index;
        }
        return 0;
    },

    getCurrentName(fallback = 'Untitled Tile') {
        const inputName = (this.elements.nameInput?.value || '').trim();
        return inputName || fallback;
    },

    setNameInput(name) {
        if (this.elements.nameInput) {
            this.elements.nameInput.value = name || 'Untitled Tile';
        }
    },

    normalizeName(name) {
        return (String(name || '').trim() || 'Untitled Tile').slice(0, 60);
    },

    makeId() {
        return `tile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    },

    captureMaps() {
        const maps = {};
        const positions = typeof dualGridManager !== 'undefined' && dualGridManager.getMapPositionToCanvas
            ? dualGridManager.getMapPositionToCanvas()
            : {
                'top-left': 'preview-0-0', 'top-center': 'preview-0-1', 'top-right': 'preview-0-2',
                'middle-left': 'preview-1-0', 'middle-right': 'preview-1-2',
                'bottom-left': 'preview-2-0', 'bottom-center': 'preview-2-1', 'bottom-right': 'preview-2-2'
            };

        Object.entries(positions).forEach(([position, canvasId]) => {
            const state = typeof tilemapManager !== 'undefined'
                ? tilemapManager.activeTileStates.get(canvasId)
                : undefined;
            maps[position] = state === true;
        });
        return maps;
    },

    emptyMaps() {
        return {
            'top-left': false, 'top-center': false, 'top-right': false,
            'middle-left': false, 'middle-right': false,
            'bottom-left': false, 'bottom-center': false, 'bottom-right': false
        };
    },

    normalizeMaps(maps) {
        return { ...this.emptyMaps(), ...(maps || {}) };
    },

    createPreview() {
        if (typeof State === 'undefined' || !Array.isArray(State.layers) || !State.layers.length) {
            return null;
        }

        const canvas = document.createElement('canvas');
        canvas.width = this.PREVIEW_SIZE;
        canvas.height = this.PREVIEW_SIZE;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        State.layers.forEach(layer => {
            if (layer.visible && layer.canvas) {
                ctx.globalAlpha = typeof layer.opacity === 'number' ? layer.opacity : 1;
                ctx.drawImage(layer.canvas, 0, 0, canvas.width, canvas.height);
            }
        });
        ctx.globalAlpha = 1;

        return canvas.toDataURL('image/png');
    },

    captureSnapshot(name) {
        if (typeof State === 'undefined' || !Array.isArray(State.layers)) return null;

        const now = new Date().toISOString();
        return {
            version: 1,
            id: null,
            name: this.normalizeName(name),
            slot: this.getCurrentIndex(),
            layers: State.layers.map(layer => ({
                id: layer.id,
                name: layer.name,
                visible: layer.visible,
                opacity: layer.opacity,
                canvasData: layer.canvas ? layer.canvas.toDataURL('image/png') : null
            })),
            activeLayerIndex: State.activeLayerIndex,
            maps: this.captureMaps(),
            toolState: {
                currentTool: State.currentTool,
                currentColor: State.currentColor,
                brushSize: State.brushSize,
                opacity: State.opacity
            },
            preview: this.createPreview(),
            tileDim: Config.TILE_DIM,
            canvasSize: { width: Config.CANVAS_SIZE, height: Config.CANVAS_SIZE },
            createdAt: now,
            updatedAt: now
        };
    },

    saveAsNewTile() {
        const name = this.getCurrentName();
        const snapshot = this.captureSnapshot(name);
        if (!snapshot) {
            this.notify('error', 'Could not capture the current tile.');
            return;
        }

        snapshot.id = this.makeId();
        snapshot.name = this.normalizeName(name);
        this.tiles.unshift(snapshot);
        this.currentId = snapshot.id;
        const workingSaved = this.persistWorking({ ...snapshot, savedAt: new Date().toISOString() });
        const librarySaved = this.persistLibrary();

        if (librarySaved) {
            State.markSaved();
            this.notify('success', `Saved “${snapshot.name}” to your browser.`);
        } else if (workingSaved) {
            this.notify('info', 'The working copy was saved, but the tile library could not be updated.');
        }
        this.render();
    },

    saveWorkingCopy() {
        const existing = this.currentId ? this.tiles.find(tile => tile.id === this.currentId) : null;
        const name = this.getCurrentName(existing?.name || 'Untitled Tile');
        const snapshot = this.captureSnapshot(name);
        if (!snapshot) {
            this.notify('error', 'Could not capture the current tile.');
            return;
        }

        const now = new Date().toISOString();
        snapshot.name = this.normalizeName(name);

        if (existing) {
            snapshot.id = existing.id;
            snapshot.createdAt = existing.createdAt || snapshot.createdAt;
            snapshot.updatedAt = now;
            const index = this.tiles.findIndex(tile => tile.id === existing.id);
            if (index >= 0) this.tiles[index] = snapshot;
            this.currentId = existing.id;
            const librarySaved = this.persistLibrary();
            const workingSaved = this.persistWorking({ ...snapshot, savedAt: now });
            if (librarySaved && workingSaved) {
                State.markSaved();
                this.notify('success', `Saved changes to “${snapshot.name}”.`);
            } else if (workingSaved) {
                this.notify('info', 'The working copy was saved, but the tile library could not be updated.');
            }
        } else {
            if (this.persistWorking({ ...snapshot, savedAt: now })) {
                State.markSaved();
                this.notify('info', 'Working copy saved in this browser. Use “Save Current as New Tile” to add it to the library.');
            }
        }

        this.render();
    },

    async restoreWorkingCopy() {
        const snapshot = this.readWorkingCopy();
        if (!snapshot) {
            this.notify('info', 'No browser copy found yet. Use “Save to Browser” first.');
            return;
        }

        await this.applySnapshot(snapshot);
        const matching = snapshot.id ? this.tiles.find(tile => tile.id === snapshot.id) : null;
        this.currentId = matching ? matching.id : null;
        this.setNameInput(snapshot.name || 'Untitled Tile');
        this.render();
        this.notify('success', 'Restored the browser copy.');
    },

    async openTile(id) {
        const tile = this.tiles.find(item => item.id === id);
        if (!tile) return;

        await this.applySnapshot(tile);
        this.currentId = tile.id;
        this.setNameInput(tile.name);
        this.render();
        this.notify('success', `Opened “${tile.name}”.`);
    },

    deleteTile(id) {
        const tile = this.tiles.find(item => item.id === id);
        if (!tile) return;
        if (!confirm(`Delete saved tile “${tile.name}”?`)) return;

        this.tiles = this.tiles.filter(item => item.id !== id);
        if (this.currentId === id) this.currentId = null;
        this.persistLibrary();
        this.render();
        this.notify('info', `Deleted “${tile.name}”.`);
    },

    async createNewTile() {
        if (typeof dualGridManager === 'undefined' || !dualGridManager.tiles?.length) {
            this.notify('error', 'The tile editor is not ready yet.');
            return;
        }

        dualGridManager.saveCurrentTileState();
        const currentIndex = this.getCurrentIndex();
        const currentTile = dualGridManager.dualGridData.tiles.find(tile => tile.index === currentIndex);
        if (currentTile && !currentTile.frame) {
            dualGridManager.loadFrameForTile(currentTile);
        }

        let nextIndex = -1;
        for (let offset = 1; offset <= this.MAX_TILES; offset++) {
            const candidate = (currentIndex + offset) % this.MAX_TILES;
            const tileData = dualGridManager.dualGridData.tiles.find(tile => tile.index === candidate);
            if (tileData && !tileData.frame) {
                nextIndex = candidate;
                break;
            }
        }

        if (nextIndex < 0) {
            this.notify('info', 'All 16 editor slots are in use. Save this canvas as a library tile, or reopen a tile to keep editing.');
            return;
        }

        const blankName = 'Untitled Tile';
        await this.applySnapshot({
            name: blankName,
            slot: nextIndex,
            layers: [{ name: 'Layer 1', visible: true, opacity: 1, canvasData: null }],
            activeLayerIndex: 0,
            maps: this.emptyMaps(),
            toolState: null
        });

        this.currentId = null;
        this.setNameInput(blankName);
        this.render();
        this.notify('success', `Created a new blank tile in slot ${nextIndex + 1}.`);
    },

    async applySnapshot(snapshot) {
        if (typeof dualGridManager === 'undefined' || typeof State === 'undefined') return;

        if (dualGridManager.selectedTile) {
            dualGridManager.saveCurrentTileState();
        }

        const requestedSlot = Number(snapshot.slot);
        const slot = Number.isInteger(requestedSlot) && requestedSlot >= 0 && requestedSlot < this.MAX_TILES
            ? requestedSlot
            : this.getCurrentIndex();
        const tileElement = dualGridManager.tiles[slot] || dualGridManager.tiles[0];
        if (!tileElement) return;

        const tileIndex = parseInt(tileElement.dataset.index, 10);
        if (dualGridManager.selectedTile && dualGridManager.selectedTile !== tileElement) {
            dualGridManager.selectedTile.classList.remove('selected');
        }
        dualGridManager.selectedTile = tileElement;
        tileElement.classList.add('selected');

        const sourceLayers = Array.isArray(snapshot.layers) && snapshot.layers.length
            ? snapshot.layers
            : [{ name: 'Layer 1', visible: true, opacity: 1, canvasData: null }];
        const layers = [];

        for (let index = 0; index < sourceLayers.length; index++) {
            const layerData = sourceLayers[index];
            const canvas = State.createLayerCanvas();
            if (layerData.canvasData) {
                await this.loadImageToCanvas(layerData.canvasData, canvas);
            }
            layers.push({
                id: layerData.id || Date.now() + index,
                name: layerData.name || `Layer ${index + 1}`,
                visible: layerData.visible !== false,
                opacity: typeof layerData.opacity === 'number' ? layerData.opacity : 1,
                canvas
            });
        }

        State.layers = layers;
        State.activeLayerIndex = Math.min(
            Math.max(0, Number(snapshot.activeLayerIndex) || 0),
            layers.length - 1
        );

        if (snapshot.toolState) {
            State.currentTool = snapshot.toolState.currentTool || State.currentTool;
            State.currentColor = snapshot.toolState.currentColor || State.currentColor;
            State.brushSize = typeof snapshot.toolState.brushSize === 'number'
                ? snapshot.toolState.brushSize
                : State.brushSize;
            State.opacity = typeof snapshot.toolState.opacity === 'number'
                ? snapshot.toolState.opacity
                : State.opacity;
        }

        State.updateUI();
        if (typeof LayerManager !== 'undefined' && LayerManager.renderLayers) {
            LayerManager.renderLayers();
        }
        if (typeof TilemapCore !== 'undefined' && TilemapCore.updatePreviews) {
            TilemapCore.updatePreviews();
        }

        const maps = this.normalizeMaps(snapshot.maps);
        const tileData = dualGridManager.dualGridData.tiles.find(tile => tile.index === tileIndex);
        if (tileData) {
            tileData.name = this.normalizeName(snapshot.name || tileData.name);
            tileData.maps = maps;
        }

        const positions = dualGridManager.getMapPositionToCanvas();
        Object.entries(positions).forEach(([position, canvasId]) => {
            if (typeof tilemapManager !== 'undefined') {
                tilemapManager.activeTileStates.set(canvasId, maps[position] === true);
            }
        });
        if (typeof tilemapManager !== 'undefined' && tilemapManager.updateTileDisplays) {
            tilemapManager.updateTileDisplays();
        }

        if (dualGridManager.tileStateManager?.saveTilemapState) {
            dualGridManager.tileStateManager.saveTilemapState(tileIndex, maps);
        }
        if (snapshot.toolState && dualGridManager.tileStateManager?.saveTileToolState) {
            dualGridManager.tileStateManager.saveTileToolState(tileIndex, snapshot.toolState);
        }

        if (tileData) {
            dualGridManager.loadFrameForTile(tileData);
        }
        dualGridManager.saveCurrentTileState();
        State.markSaved();
    },

    loadImageToCanvas(dataUrl, canvas) {
        return new Promise(resolve => {
            const image = new Image();
            image.onload = () => {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
                resolve();
            };
            image.onerror = () => resolve();
            image.src = dataUrl;
        });
    },

    handleListClick(event) {
        const button = event.target.closest('[data-action]');
        const card = button?.closest('[data-tile-id]');
        if (!button || !card) return;

        const id = card.dataset.tileId;
        switch (button.dataset.action) {
            case 'open':
                this.openTile(id);
                break;
            case 'save':
                this.saveWorkingCopy();
                break;
            case 'delete':
                this.deleteTile(id);
                break;
        }
    },

    render() {
        const list = this.elements.list;
        if (!list) return;

        if (!this.tiles.length) {
            list.innerHTML = `
                <div class="tile-library-empty">
                    <i class="fas fa-table-cells-large"></i>
                    <p>No saved tiles yet</p>
                    <span>Name the current canvas and choose “Save Current as New Tile” to start your library.</span>
                </div>
            `;
            return;
        }

        list.innerHTML = this.tiles.map(tile => {
            const isCurrent = tile.id === this.currentId;
            const tileId = this.escapeHtml(tile.id);
            const name = this.escapeHtml(tile.name);
            const preview = tile.preview
                ? `<img src="${tile.preview}" alt="${name} preview">`
                : '<i class="fas fa-image"></i>';
            const slot = Number.isInteger(tile.slot) ? `Slot ${tile.slot + 1}` : 'Tile';
            const updated = this.formatDate(tile.updatedAt);

            return `
                <article class="tile-card${isCurrent ? ' current' : ''}" data-tile-id="${tileId}">
                    <div class="tile-card-preview">${preview}</div>
                    <div class="tile-card-info">
                        <strong title="${name}">${name}</strong>
                        <span>${slot} · ${updated}</span>
                    </div>
                    <div class="tile-card-actions">
                        <button type="button" class="btn compact" data-action="open">
                            <i class="fas fa-pen"></i> Edit
                        </button>
                        ${isCurrent ? `
                            <button type="button" class="btn compact" data-action="save">
                                <i class="fas fa-save"></i> Save Changes
                            </button>
                        ` : ''}
                        <button type="button" class="btn compact danger icon-only" data-action="delete"
                            title="Delete ${name}" aria-label="Delete ${name}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </article>
            `;
        }).join('');
    },

    formatDate(value) {
        if (!value) return 'Never saved';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Never saved';
        return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    },

    escapeHtml(value) {
        const div = document.createElement('div');
        div.textContent = String(value ?? '');
        return div.innerHTML;
    },

    notify(type, message) {
        if (typeof Notifications !== 'undefined') {
            const notifications = new Notifications();
            const method = type === 'success' || type === 'error' ? type : 'info';
            notifications[method](message);
        } else {
            console.log(`[Tile Library] ${message}`);
        }
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TileLibrary };
}
