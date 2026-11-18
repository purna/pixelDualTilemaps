/* ============================================================
   Dual Grid Studio — focused dual tilemap editor UI
   ============================================================ */

(function () {
    'use strict';

    const Core = window.DualCore;
    const Notifications = window.Notifications;
    const PALETTE_KEY = 'pixelDualTilemaps:dual-studio:palette:v2';
    const RECENT_KEY = 'pixelDualTilemaps:dual-studio:recent:v2';
    const SPLIT_KEY = 'pixelDualTilemaps:dual-studio:center-split:v1';
    const SPLITTER_WIDTH = 14;
    const BAYER_4 = [
        [0, 8, 2, 10],
        [12, 4, 14, 6],
        [3, 11, 1, 9],
        [15, 7, 13, 5]
    ];

    const NEIGHBOURS = [
        { key: 'tl', label: 'Top-left', col: -1, row: -1, pairs: [[1, 8]] },
        { key: 'top', label: 'Top', col: 0, row: -1, pairs: [[1, 4], [2, 8]] },
        { key: 'tr', label: 'Top-right', col: 1, row: -1, pairs: [[2, 4]] },
        { key: 'left', label: 'Left', col: -1, row: 0, pairs: [[1, 2], [4, 8]] },
        { key: 'right', label: 'Right', col: 1, row: 0, pairs: [[2, 1], [8, 4]] },
        { key: 'bl', label: 'Bottom-left', col: -1, row: 1, pairs: [[4, 2]] },
        { key: 'bottom', label: 'Bottom', col: 0, row: 1, pairs: [[4, 1], [8, 2]] },
        { key: 'br', label: 'Bottom-right', col: 1, row: 1, pairs: [[8, 1]] }
    ];

    const DEFAULT_PALETTE = [
        '#6fb63a', '#3f7a1f', '#9ade58', '#c99a63',
        '#a57645', '#e2bd88', '#ffd15c', '#ff90b3',
        '#d7a1ff', '#43d9ff', '#3060ff', '#ff5d73',
        '#f4f7ff', '#8c93a8', '#343a52', '#0b0d17'
    ];

    const App = {
        project: null,
        selectedMask: 15,
        tool: 'pencil',
        color: '#6fb63a',
        previousColor: '#6fb63a',
        brushSize: 1,
        opacity: 1,
        wrap: true,
        syncEdges: true,
        editorZoom: 1,
        showCenterBorder: true,
        strokeTouched: new Map(),
        mirrorX: false,
        mirrorY: false,
        showPixelGrid: true,
        showAllGrids: true,
        panelSplitRatio: 0.43,
        splitDrag: null,
        splitFrame: null,
        sprayTick: 0,
        neighbourChoices: {},
        neighbourPicker: null,
        palette: DEFAULT_PALETTE.slice(),
        recentColors: [],
        clipboardTile: null,
        clipboardLabel: '',
        undoStack: [],
        redoStack: [],
        pendingHistory: null,
        drawing: false,
        strokeErase: false,
        lastPoint: null,
        activePointerId: null,
        previewPainting: false,
        previewValue: 1,
        hoverCell: null,
        previewFrame: null,
        saveTimer: null,
        notifications: null,
        els: {},
        initialized: false,

        /* --------------------------------------------------------
           Init
           -------------------------------------------------------- */

        async init() {
            if (this.initialized) return;
            this.initialized = true;
            this.cacheElements();
            this.notifications = Notifications ? new Notifications() : null;

            this.loadPalette();
            this.loadRecent();
            this.loadPanelSplit();
            this.bindEvents();

            const loaded = await this.loadAutosave();
            if (!loaded) {
                this.project = Core.createSampleProject();
            }

            this.selectedMask = this.project.selectedMask != null ? this.project.selectedMask : 15;
            this.ensureSelectedMask();
            this.renderAll();
            this.setEditorZoom(this.editorZoom);
            this.updateCenterOutline();
            requestAnimationFrame(() => this.applyCenterSplit());
            this.updateHistoryButtons();
            this.updateFooter();
            if (!loaded) {
                this.notify('success', 'Sample tileset loaded. Draw a tile and watch the live preview.');
            }

            console.log('Dual Grid Studio ready');
        },

        cacheElements() {
            const ids = [
                'dsProjectName', 'dsSaveState', 'dsUndoBtn', 'dsRedoBtn', 'dsNewBtn', 'dsOpenBtn',
                'dsSaveBtn', 'dsExportBtn', 'dsHelpBtn', 'dsToolGrid', 'dsBrushSize',
                'dsBrushSizeLabel', 'dsBrushPresets', 'dsOpacity', 'dsOpacityLabel', 'dsWrap',
                'dsMirrorX', 'dsMirrorY', 'dsShowPixelGrid', 'dsCenterBorder', 'dsSyncEdges', 'dsColorPicker', 'dsColorHex',
                'dsZoomInBtn', 'dsZoomOutBtn', 'dsZoomFitBtn', 'dsZoomLabel',
                'dsVariationCount', 'dsVariationChips', 'dsAddVariationBtn', 'dsDeleteVariationBtn',
                'dsSaveColorBtn', 'dsPalette', 'dsRecentColors', 'dsAddLayerBtn', 'dsDuplicateLayerBtn',
                'dsDeleteLayerBtn', 'dsLayerOpacityWrap', 'dsLayerOpacity', 'dsLayerOpacityLabel', 'dsLayers',
                'dsAtlasGrid', 'dsAtlasSubtitle', 'dsAtlasBadges', 'dsEditorCanvas', 'dsEditorStage',
                'dsCanvasWrap', 'dsCenterOutline', 'dsNeighbourLabels',
                'dsCenterScroll', 'dsCenterSplitter',
                'dsEditorTitle', 'dsEditorSubtitle', 'dsCopyTileBtn', 'dsPasteTileBtn', 'dsFlipHBtn',
                'dsFlipVBtn', 'dsClearTileBtn', 'dsMaskDiagram', 'dsMaskTitle', 'dsMaskBits',
                'dsCoords', 'dsTileInfo', 'dsPreviewCanvas', 'dsMiniPreviewCanvas', 'dsPreviewStage', 'dsPreviewHint',
                'dsAtlasList', 'dsAtlasListCount',
                'dsRandomMapBtn', 'dsClearMapBtn', 'dsFillMapBtn', 'dsShowAllGrids', 'dsGridList',
                'dsAddGridBtn', 'dsGridName', 'dsGridRole', 'dsGridMode', 'dsTileSize',
                'dsDuplicateGridBtn', 'dsDeleteGridBtn', 'dsExportLayout', 'dsExportVariations', 'dsExportScale',
                'dsExportGap', 'dsExportMargin', 'dsExportBg', 'dsExportTransparent',
                'dsExportActiveBtn', 'dsExportAllBtn', 'dsExportSheetBtn', 'dsExportJsonBtn',
                'dsExportHint', 'dsFooterStatus', 'dsNewModal', 'dsNewName', 'dsNewStarter',
                'dsCreateNewBtn', 'dsHelpModal', 'dsFileInput'
            ];

            ids.forEach(id => {
                this.els[id] = document.getElementById(id);
            });

            this.els.editorCtx = this.els.dsEditorCanvas.getContext('2d');
            this.els.previewCtx = this.els.dsPreviewCanvas.getContext('2d');
            this.els.miniPreviewCtx = this.els.dsMiniPreviewCanvas.getContext('2d');
        },

        /* --------------------------------------------------------
           Event wiring
           -------------------------------------------------------- */

        bindEvents() {
            const els = this.els;

            // Header
            els.dsUndoBtn.addEventListener('click', () => this.undo());
            els.dsRedoBtn.addEventListener('click', () => this.redo());
            els.dsNewBtn.addEventListener('click', () => this.openNewModal());
            els.dsOpenBtn.addEventListener('click', () => els.dsFileInput.click());
            els.dsSaveBtn.addEventListener('click', () => this.saveProjectFile());
            els.dsExportBtn.addEventListener('click', () => this.scrollToExport());
            els.dsHelpBtn.addEventListener('click', () => this.openModal('dsHelpModal'));

            els.dsProjectName.addEventListener('input', (e) => {
                this.project.name = e.target.value.trim() || 'Untitled Design';
                document.title = `${this.project.name} — Dual Grid Studio`;
                this.markDirty();
            });

            // Tools
            els.dsToolGrid.addEventListener('click', (e) => {
                const button = e.target.closest('.ds-tool');
                if (!button) return;
                this.setTool(button.dataset.tool);
            });

            // Resizable center panels
            const splitter = els.dsCenterSplitter;
            splitter.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                this.splitDrag = e.pointerId;
                splitter.classList.add('dragging');
                document.body.classList.add('ds-resizing');
                try { splitter.setPointerCapture(e.pointerId); } catch (error) { /* ignore */ }
                this.resizeCenterSplit(e.clientX);
            });
            splitter.addEventListener('pointermove', (e) => {
                if (this.splitDrag !== e.pointerId) return;
                this.resizeCenterSplit(e.clientX);
            });
            const endSplit = (e) => {
                if (this.splitDrag !== e.pointerId) return;
                this.splitDrag = null;
                splitter.classList.remove('dragging');
                document.body.classList.remove('ds-resizing');
                this.savePanelSplit();
                try { splitter.releasePointerCapture(e.pointerId); } catch (error) { /* ignore */ }
            };
            splitter.addEventListener('pointerup', endSplit);
            splitter.addEventListener('pointercancel', endSplit);
            splitter.addEventListener('lostpointercapture', () => {
                this.splitDrag = null;
                splitter.classList.remove('dragging');
                document.body.classList.remove('ds-resizing');
            });
            splitter.addEventListener('dblclick', () => {
                this.panelSplitRatio = 0.43;
                this.savePanelSplit();
                this.applyCenterSplit();
            });
            splitter.addEventListener('keydown', (e) => {
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                e.preventDefault();
                this.panelSplitRatio = Core.clamp(this.panelSplitRatio + (e.key === 'ArrowLeft' ? -0.03 : 0.03), 0.2, 0.8);
                this.savePanelSplit();
                this.applyCenterSplit();
            });
            window.addEventListener('resize', () => {
                if (this.splitFrame) return;
                this.splitFrame = requestAnimationFrame(() => {
                    this.splitFrame = null;
                    this.applyCenterSplit();
                });
            });

            // Brush
            els.dsBrushSize.addEventListener('input', (e) => this.setBrushSize(parseInt(e.target.value, 10)));
            els.dsBrushPresets.addEventListener('click', (e) => {
                const button = e.target.closest('button[data-size]');
                if (!button) return;
                this.setBrushSize(parseInt(button.dataset.size, 10));
            });
            els.dsOpacity.addEventListener('input', (e) => {
                this.opacity = parseInt(e.target.value, 10) / 100;
                els.dsOpacityLabel.textContent = `${e.target.value}%`;
            });
            els.dsWrap.addEventListener('change', (e) => this.wrap = e.target.checked);
            els.dsSyncEdges.addEventListener('change', (e) => {
                this.syncEdges = e.target.checked;
                this.notify('info', this.syncEdges
                    ? 'Edge sync on: matching edge pixels are copied into neighbouring tile variants.'
                    : 'Edge sync off: only the selected tile changes.');
            });
            els.dsMirrorX.addEventListener('change', (e) => this.mirrorX = e.target.checked);
            els.dsMirrorY.addEventListener('change', (e) => this.mirrorY = e.target.checked);
            els.dsShowPixelGrid.addEventListener('change', (e) => {
                this.showPixelGrid = e.target.checked;
                this.renderEditor();
            });
            els.dsCenterBorder.addEventListener('change', (e) => {
                this.showCenterBorder = e.target.checked;
                this.updateCenterOutline();
                this.renderEditor();
            });
            els.dsZoomInBtn.addEventListener('click', () => this.setEditorZoom(this.editorZoom * 1.5));
            els.dsZoomOutBtn.addEventListener('click', () => this.setEditorZoom(this.editorZoom / 1.5));
            els.dsZoomFitBtn.addEventListener('click', () => this.setEditorZoom(1));
            els.dsVariationChips.addEventListener('click', (e) => {
                const chip = e.target.closest('.ds-variation-chip');
                if (!chip) return;
                this.selectVariation(parseInt(chip.dataset.index, 10));
            });
            els.dsAddVariationBtn.addEventListener('click', () => this.addVariation());
            els.dsDeleteVariationBtn.addEventListener('click', () => this.deleteVariation());
            this.els.dsEditorStage.addEventListener('wheel', (e) => {
                if (!(e.ctrlKey || e.metaKey)) return;
                e.preventDefault();
                this.setEditorZoom(this.editorZoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2));
            }, { passive: false });

            // Colour
            els.dsColorPicker.addEventListener('input', (e) => this.setColor(e.target.value, true));
            els.dsColorHex.addEventListener('change', (e) => {
                let value = e.target.value.trim();
                if (!value.startsWith('#')) value = '#' + value;
                if (/^#[0-9a-f]{6}$/i.test(value)) {
                    this.setColor(value, true);
                } else {
                    e.target.value = this.color;
                }
            });
            els.dsColorHex.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    els.dsColorHex.blur();
                }
            });
            els.dsSaveColorBtn.addEventListener('click', () => this.saveColorToPalette());
            els.dsPalette.addEventListener('click', (e) => {
                const swatch = e.target.closest('[data-color]');
                if (swatch) this.setColor(swatch.dataset.color, true);
            });
            els.dsRecentColors.addEventListener('click', (e) => {
                const swatch = e.target.closest('[data-color]');
                if (swatch) this.setColor(swatch.dataset.color, true);
            });

            // Layers
            els.dsAddLayerBtn.addEventListener('click', () => this.addLayer());
            els.dsDuplicateLayerBtn.addEventListener('click', () => this.duplicateLayer());
            els.dsDeleteLayerBtn.addEventListener('click', () => this.deleteLayer());
            els.dsLayers.addEventListener('click', (e) => this.onLayerClick(e));
            els.dsLayers.addEventListener('dblclick', (e) => this.onLayerDoubleClick(e));
            els.dsLayerOpacity.addEventListener('input', (e) => this.setLayerOpacity(parseInt(e.target.value, 10)));

            // Atlas
            els.dsAtlasGrid.addEventListener('click', (e) => {
                const cell = e.target.closest('.ds-atlas-cell');
                if (!cell) return;
                const mask = parseInt(cell.dataset.mask, 10);
                if (Number.isInteger(mask)) this.selectMask(mask);
            });

            els.dsAtlasList.addEventListener('click', (e) => {
                const row = e.target.closest('.ds-atlas-list-item');
                if (!row) return;
                const mask = parseInt(row.dataset.mask, 10);
                if (Number.isInteger(mask)) this.selectMask(mask);
            });

            // Editor canvas
            const editor = els.dsEditorCanvas;
            editor.addEventListener('pointerdown', (e) => this.onEditorPointerDown(e));
            editor.addEventListener('pointermove', (e) => this.onEditorPointerMove(e));
            editor.addEventListener('pointerup', (e) => this.onEditorPointerUp(e));
            editor.addEventListener('pointercancel', (e) => this.onEditorPointerUp(e));
            editor.addEventListener('pointerleave', (e) => this.onEditorPointerLeave(e));
            editor.addEventListener('contextmenu', (e) => e.preventDefault());
            els.dsNeighbourLabels.addEventListener('click', (e) => {
                const chip = e.target.closest('.ds-neighbour-chip');
                if (!chip) return;
                e.preventDefault();
                e.stopPropagation();
                this.openNeighbourPicker(chip.dataset.key, chip);
            });
            document.addEventListener('pointerdown', (e) => {
                if (!this.neighbourPicker) return;
                if (this.neighbourPicker.contains(e.target)) return;
                if (e.target.closest && e.target.closest('.ds-neighbour-chip')) return;
                this.closeNeighbourPicker();
            });

            // Tile actions
            els.dsCopyTileBtn.addEventListener('click', () => this.copyTile());
            els.dsPasteTileBtn.addEventListener('click', () => this.pasteTile());
            els.dsFlipHBtn.addEventListener('click', () => this.flipTile('h'));
            els.dsFlipVBtn.addEventListener('click', () => this.flipTile('v'));
            els.dsClearTileBtn.addEventListener('click', () => this.clearTile());

            // Preview
            const preview = els.dsPreviewCanvas;
            preview.addEventListener('pointerdown', (e) => this.onPreviewPointerDown(e));
            preview.addEventListener('pointermove', (e) => this.onPreviewPointerMove(e));
            preview.addEventListener('pointerup', (e) => this.onPreviewPointerUp(e));
            preview.addEventListener('pointercancel', (e) => this.onPreviewPointerUp(e));
            preview.addEventListener('pointerleave', () => {
                this.hoverCell = null;
                this.schedulePreview();
            });
            preview.addEventListener('contextmenu', (e) => e.preventDefault());
            els.dsRandomMapBtn.addEventListener('click', () => this.randomiseMap());
            els.dsClearMapBtn.addEventListener('click', () => this.clearPreviewMap());
            els.dsFillMapBtn.addEventListener('click', () => this.fillPreviewMap());
            els.dsShowAllGrids.addEventListener('change', (e) => {
                this.showAllGrids = e.target.checked;
                this.renderPreview();
            });

            // Grids
            els.dsGridList.addEventListener('click', (e) => this.onGridListClick(e));
            els.dsAddGridBtn.addEventListener('click', () => this.addGrid());
            els.dsDuplicateGridBtn.addEventListener('click', () => this.duplicateGrid());
            els.dsDeleteGridBtn.addEventListener('click', () => this.deleteGrid());
            els.dsGridName.addEventListener('input', (e) => {
                const grid = this.activeGrid();
                if (!grid) return;
                grid.name = e.target.value || 'Grid';
                this.renderGridList();
                this.renderAtlasMeta();
                this.updateFooter();
                this.markDirty();
            });
            els.dsGridRole.addEventListener('change', (e) => {
                const grid = this.activeGrid();
                if (!grid) return;
                grid.role = e.target.value;
                this.renderGridList();
                this.renderAtlasMeta();
                this.renderPreview();
                this.updateFooter();
                this.markDirty();
            });
            els.dsGridMode.addEventListener('change', (e) => {
                const grid = this.activeGrid();
                if (!grid) return;
                grid.mode = e.target.value === '9' ? 9 : 15;
                this.ensureSelectedMask();
                this.renderAtlas();
                this.renderEditor();
                this.renderVariations();
                this.renderLayers();
                this.renderGridList();
                this.renderPreview();
                this.renderExportHint();
                this.updateFooter();
                this.markDirty();
            });
            els.dsTileSize.addEventListener('change', (e) => this.changeTileSize(parseInt(e.target.value, 10)));

            // Export
            els.dsExportActiveBtn.addEventListener('click', () => this.exportActiveGrid());
            els.dsExportAllBtn.addEventListener('click', () => this.exportAllGrids());
            els.dsExportSheetBtn.addEventListener('click', () => this.exportCombinedSheet());
            els.dsExportJsonBtn.addEventListener('click', () => this.exportProjectJson());
            els.dsExportLayout.addEventListener('change', () => this.renderExportHint());
            els.dsExportVariations.addEventListener('change', () => this.renderExportHint());

            // Modals
            document.querySelectorAll('[data-close-modal]').forEach(button => {
                button.addEventListener('click', () => this.closeModal(button.dataset.closeModal));
            });
            document.querySelectorAll('.ds-modal-overlay').forEach(overlay => {
                overlay.addEventListener('mousedown', (e) => {
                    if (e.target === overlay) this.closeModal(overlay.id);
                });
            });
            els.dsCreateNewBtn.addEventListener('click', () => this.createNewDesign());

            // File input
            els.dsFileInput.addEventListener('change', (e) => this.onFileSelected(e));

            // Keyboard
            document.addEventListener('keydown', (e) => this.onKeyDown(e));

            // Save when leaving
            window.addEventListener('beforeunload', () => {
                this.saveAutosave(true);
            });
        },

        /* --------------------------------------------------------
           Helpers
           -------------------------------------------------------- */

        activeGrid() {
            return this.project ? Core.getActiveGrid(this.project) : null;
        },

        activeTile() {
            const grid = this.activeGrid();
            return grid ? grid.tiles[this.selectedMask] : null;
        },

        tileSize() {
            const grid = this.activeGrid();
            return grid ? Core.tileSizeOf(grid) : (this.project ? this.project.tileSize : 32);
        },

        ensureSelectedMask() {
            const grid = this.activeGrid();
            if (!grid) return;
            if (grid.mode === 9 && !Core.SET_9.has(this.selectedMask)) {
                this.selectedMask = 15;
            }
            if (!grid.tiles[this.selectedMask]) this.selectedMask = 15;
            this.project.selectedMask = this.selectedMask;
        },

        maskHasArt(grid, mask) {
            const tile = grid && grid.tiles[mask];
            if (!tile || !Array.isArray(tile.layers)) return false;
            return tile.layers.some(layer => {
                if (!layer.canvas || layer.system || layer.name === 'Edge sync') return false;
                const data = layer.canvas.getContext('2d')
                    .getImageData(0, 0, layer.canvas.width, layer.canvas.height).data;
                for (let i = 3; i < data.length; i += 4) {
                    if (data[i]) return true;
                }
                return false;
            });
        },

        compatibleNeighbours(direction, sourceMask) {
            const info = NEIGHBOURS.find(item => item.key === direction);
            if (!info) return [];
            let required = 0;
            let keyMask = 0;
            info.pairs.forEach(([sourceBit, targetBit]) => {
                keyMask |= targetBit;
                if (sourceMask & sourceBit) required |= targetBit;
            });

            const options = [];
            for (let mask = 0; mask <= 15; mask++) {
                if ((mask & keyMask) !== required) continue;
                if (this.activeGrid() && this.activeGrid().mode === 9 && mask !== 0 && !Core.SET_9.has(mask)) continue;
                options.push(mask);
            }
            return options;
        },

        defaultNeighbourMask(direction, sourceMask) {
            const tl = sourceMask & 1;
            const tr = sourceMask & 2;
            const bl = sourceMask & 4;
            const br = sourceMask & 8;
            if (direction === 'top') return tl | tr | (tl ? 4 : 0) | (tr ? 8 : 0);
            if (direction === 'bottom') return bl | br | (bl ? 1 : 0) | (br ? 2 : 0);
            if (direction === 'left') return tl | bl | (tl ? 2 : 0) | (bl ? 8 : 0);
            if (direction === 'right') return tr | br | (tr ? 1 : 0) | (br ? 4 : 0);
            if (direction === 'tl') return tl ? 15 : 0;
            if (direction === 'tr') return tr ? 15 : 0;
            if (direction === 'bl') return bl ? 15 : 0;
            if (direction === 'br') return br ? 15 : 0;
            return 0;
        },

        neighbourMaskFor(direction) {
            const grid = this.activeGrid();
            if (!grid) return 0;
            const options = this.compatibleNeighbours(direction, this.selectedMask);
            const key = `${grid.id}:${this.selectedMask}:${direction}`;
            const stored = this.neighbourChoices[key];
            if (stored != null && options.includes(stored)) return stored;
            const fallback = this.defaultNeighbourMask(direction, this.selectedMask);
            return options.includes(fallback) ? fallback : (options[0] == null ? 0 : options[0]);
        },

        setNeighbourMask(direction, mask) {
            const grid = this.activeGrid();
            if (!grid) return;
            const options = this.compatibleNeighbours(direction, this.selectedMask);
            if (!options.includes(mask)) return;
            this.neighbourChoices[`${grid.id}:${this.selectedMask}:${direction}`] = mask;
            this.closeNeighbourPicker();
            this.renderEditor();
            this.notify('info', `${NEIGHBOURS.find(item => item.key === direction).label} neighbour set to tile #${mask}`);
        },

        setFooter(text) {
            if (this.els.dsFooterStatus) this.els.dsFooterStatus.textContent = text;
        },

        updateFooter() {
            const grid = this.activeGrid();
            if (!grid) return;
            this.setFooter(`${grid.name} · ${grid.mode === 9 ? '9-tile' : '16-tile'} set · ${this.tileSize()} px tiles · preview ${this.project.mapW}×${this.project.mapH}`);
        },

        escapeHtml(value) {
            return String(value == null ? '' : value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        },

        notify(type, message) {
            if (this.notifications && typeof this.notifications[type] === 'function') {
                this.notifications[type](message);
            } else {
                console.log(`[${type}] ${message}`);
            }
        },

        /* --------------------------------------------------------
           Palette / colour
           -------------------------------------------------------- */

        loadPalette() {
            try {
                const stored = JSON.parse(localStorage.getItem(PALETTE_KEY) || 'null');
                if (Array.isArray(stored) && stored.length) {
                    this.palette = stored.filter(color => /^#[0-9a-f]{6}$/i.test(color)).slice(0, 40);
                }
            } catch (error) {
                this.palette = DEFAULT_PALETTE.slice();
            }
            if (!this.palette.length) this.palette = DEFAULT_PALETTE.slice();
        },

        loadRecent() {
            try {
                const stored = JSON.parse(localStorage.getItem(RECENT_KEY) || 'null');
                if (Array.isArray(stored)) {
                    this.recentColors = stored.filter(color => /^#[0-9a-f]{6}$/i.test(color)).slice(0, 8);
                }
            } catch (error) {
                this.recentColors = [];
            }
        },

        persistPalette() {
            try {
                localStorage.setItem(PALETTE_KEY, JSON.stringify(this.palette));
                localStorage.setItem(RECENT_KEY, JSON.stringify(this.recentColors));
            } catch (error) {
                // Palette persistence is optional.
            }
        },

        setColor(hex, fromUser) {
            if (!/^#[0-9a-f]{6}$/i.test(hex)) return;
            if (hex.toLowerCase() !== this.color.toLowerCase()) {
                this.previousColor = this.color;
            }
            this.color = hex.toLowerCase();
            this.els.dsColorPicker.value = this.color;
            this.els.dsColorHex.value = this.color;
            this.renderPalette();

            if (fromUser !== false) {
                this.addRecent(this.color);
            }
        },

        addRecent(hex) {
            const value = hex.toLowerCase();
            this.recentColors = [value].concat(this.recentColors.filter(color => color !== value)).slice(0, 8);
            this.renderRecent();
            this.persistPalette();
        },

        saveColorToPalette() {
            const value = this.color.toLowerCase();
            if (!this.palette.includes(value)) {
                this.palette.push(value);
                if (this.palette.length > 40) this.palette.shift();
                this.persistPalette();
                this.renderPalette();
                this.notify('success', `Colour ${value} added to the palette`);
            } else {
                this.notify('info', 'That colour is already in the palette');
            }
        },

        renderPalette() {
            const container = this.els.dsPalette;
            container.innerHTML = '';
            this.palette.forEach(color => {
                const swatch = document.createElement('button');
                swatch.type = 'button';
                swatch.className = 'ds-swatch' + (color.toLowerCase() === this.color.toLowerCase() ? ' active' : '');
                swatch.style.background = color;
                swatch.dataset.color = color;
                swatch.title = color;
                container.appendChild(swatch);
            });
        },

        renderRecent() {
            const container = this.els.dsRecentColors;
            container.innerHTML = '';
            if (!this.recentColors.length) {
                const empty = document.createElement('span');
                empty.className = 'ds-label';
                empty.textContent = '—';
                container.appendChild(empty);
                return;
            }
            this.recentColors.forEach(color => {
                const swatch = document.createElement('button');
                swatch.type = 'button';
                swatch.className = 'ds-swatch' + (color.toLowerCase() === this.color.toLowerCase() ? ' active' : '');
                swatch.style.background = color;
                swatch.dataset.color = color;
                swatch.title = color;
                container.appendChild(swatch);
            });
        },

        /* --------------------------------------------------------
           Tools / brush
           -------------------------------------------------------- */

        updateCenterOutline() {
            if (!this.els.dsCenterOutline) return;
            this.els.dsCenterOutline.style.display = this.showCenterBorder ? 'block' : 'none';
        },

        loadPanelSplit() {
            try {
                const stored = parseFloat(localStorage.getItem(SPLIT_KEY));
                if (Number.isFinite(stored)) this.panelSplitRatio = Core.clamp(stored, 0.2, 0.8);
            } catch (error) {
                this.panelSplitRatio = 0.43;
            }
        },

        savePanelSplit() {
            try {
                localStorage.setItem(SPLIT_KEY, String(this.panelSplitRatio));
            } catch (error) {
                // A full storage quota should not break resizing.
            }
        },

        centerSplitLimits() {
            const scroll = this.els.dsCenterScroll;
            if (!scroll) return null;
            const style = window.getComputedStyle(scroll);
            const paddingLeft = parseFloat(style.paddingLeft) || 0;
            const paddingRight = parseFloat(style.paddingRight) || 0;
            const contentWidth = Math.max(1, scroll.clientWidth - paddingLeft - paddingRight);
            const available = Math.max(1, contentWidth - SPLITTER_WIDTH);
            const atlasMin = Math.min(280, available * 0.4);
            const editorMin = Math.min(340, available * 0.42);
            let min = atlasMin / available;
            let max = 1 - editorMin / available;
            if (min >= max) {
                min = 0.24;
                max = 0.76;
            }
            return { available, min, max };
        },

        applyCenterSplit() {
            const scroll = this.els.dsCenterScroll;
            if (!scroll) return;
            if (!window.matchMedia('(min-width: 1100px)').matches) {
                scroll.style.gridTemplateColumns = '';
                return;
            }
            const limits = this.centerSplitLimits();
            if (!limits) return;
            const ratio = Core.clamp(this.panelSplitRatio, limits.min, limits.max);
            const atlasWidth = Math.max(1, Math.round(limits.available * ratio));
            scroll.style.gridTemplateColumns = `${atlasWidth}px ${SPLITTER_WIDTH}px minmax(0, 1fr)`;
        },

        resizeCenterSplit(clientX) {
            const scroll = this.els.dsCenterScroll;
            if (!scroll) return;
            const limits = this.centerSplitLimits();
            if (!limits) return;
            const rect = scroll.getBoundingClientRect();
            const style = window.getComputedStyle(scroll);
            const paddingLeft = parseFloat(style.paddingLeft) || 0;
            const relative = clientX - rect.left - paddingLeft - SPLITTER_WIDTH / 2;
            this.panelSplitRatio = Core.clamp(relative / limits.available, limits.min, limits.max);
            this.applyCenterSplit();
        },

        setEditorZoom(value) {
            this.editorZoom = Core.clamp(Number(value) || 1, 1, 8);
            const percent = Math.round(this.editorZoom * 100);
            const target = this.els.dsCanvasWrap || this.els.dsEditorCanvas;
            if (target) {
                target.style.width = `${percent}%`;
                target.style.height = `${percent}%`;
            }
            if (this.els.dsZoomLabel) this.els.dsZoomLabel.textContent = `${percent}%`;

            const stage = this.els.dsEditorStage;
            if (stage) {
                requestAnimationFrame(() => {
                    stage.scrollLeft = (stage.scrollWidth - stage.clientWidth) / 2;
                    stage.scrollTop = (stage.scrollHeight - stage.clientHeight) / 2;
                });
            }
        },

        setTool(tool) {
            this.tool = tool;
            this.els.dsToolGrid.querySelectorAll('.ds-tool').forEach(button => {
                button.classList.toggle('active', button.dataset.tool === tool);
            });
            this.els.dsEditorCanvas.style.cursor = tool === 'picker' ? 'copy' : 'crosshair';
        },

        setBrushSize(size) {
            this.brushSize = Core.clamp(size, 1, 15);
            this.els.dsBrushSize.value = this.brushSize;
            this.els.dsBrushSizeLabel.textContent = `${this.brushSize} px`;
            this.els.dsBrushPresets.querySelectorAll('button').forEach(button => {
                button.classList.toggle('active', parseInt(button.dataset.size, 10) === this.brushSize);
            });
        },

        /* --------------------------------------------------------
           Editor drawing
           -------------------------------------------------------- */

        pointFromGlobal(gx, gy) {
            const size = this.tileSize();
            const half = Math.floor(size / 2);
            const internal = size * 2;
            if (gx < 0 || gy < 0 || gx >= internal || gy >= internal) return null;

            const col = gx < half ? -1 : (gx >= half + size ? 1 : 0);
            const row = gy < half ? -1 : (gy >= half + size ? 1 : 0);

            if (col === 0 && row === 0) {
                return {
                    x: gx - half,
                    y: gy - half,
                    gx,
                    gy,
                    mask: this.selectedMask,
                    direction: null
                };
            }

            const direction = NEIGHBOURS.find(item => item.col === col && item.row === row);
            if (!direction) return null;

            const mask = this.neighbourMaskFor(direction.key);
            // The margin shows the visible half/quarter of the neighbour tile,
            // so map the cursor into that tile's local coordinate space.
            const x = col === -1 ? gx + size - half
                : col === 1 ? gx - half - size
                : gx - half;
            const y = row === -1 ? gy + size - half
                : row === 1 ? gy - half - size
                : gy - half;

            return { x, y, gx, gy, mask, direction: direction.key };
        },


        editorPoint(e) {
            const canvas = this.els.dsEditorCanvas;
            const rect = canvas.getBoundingClientRect();
            const size = this.tileSize();
            const internal = size * 2;
            let gx = Math.floor((e.clientX - rect.left) / rect.width * internal);
            let gy = Math.floor((e.clientY - rect.top) / rect.height * internal);
            gx = Core.clamp(gx, 0, internal - 1);
            gy = Core.clamp(gy, 0, internal - 1);
            return this.pointFromGlobal(gx, gy);
        },

        onEditorPointerDown(e) {
            if (e.button !== 0 && e.button !== 2) return;
            e.preventDefault();

            const grid = this.activeGrid();
            if (!grid) return;

            const point = this.editorPoint(e);
            if (!point) return;
            this.updateCoords(point);
            this.strokeTouched.clear();

            if (this.tool === 'picker') {
                this.pickColor(point);
                return;
            }

            const tile = grid.tiles[point.mask];
            if (!tile) return;

            const erase = e.button === 2 || this.tool === 'eraser';

            if (this.tool === 'fill') {
                this.beginHistory(point.mask);
                this.floodFill(tile, point, erase);
                this.markAllEdges(point.mask);
                this.syncTileEdges();
                this.commitHistory();
                this.afterMasksChanged(new Set([point.mask]));
                this.renderLayers();
                return;
            }

            this.beginHistory();
            this.drawing = true;
            this.strokeErase = erase;
            this.lastPoint = point;
            this.activePointerId = e.pointerId;

            try {
                this.els.dsEditorCanvas.setPointerCapture(e.pointerId);
            } catch (error) {
                // Pointer capture is a convenience only.
            }

            const changed = new Set();
            this.paintAt(point, erase, changed);
            this.afterMasksChanged(changed);
        },

        onEditorPointerMove(e) {
            const point = this.editorPoint(e);
            if (point) this.updateCoords(point);

            if (!this.drawing || e.pointerId !== this.activePointerId) return;
            if (e.buttons === 0 && e.pointerType === 'mouse') return;
            if (!point) return;

            if (!this.lastPoint) {
                this.lastPoint = point;
            }

            const changed = new Set();
            this.strokeLine(this.lastPoint, point, this.strokeErase, changed);
            this.lastPoint = point;
            this.afterMasksChanged(changed);
        },

        onEditorPointerUp(e) {
            if (!this.drawing) return;
            this.drawing = false;
            this.lastPoint = null;
            this.activePointerId = null;
            this.syncTileEdges();
            this.commitHistory();
            this.afterMasksChanged(new Set([this.selectedMask]));
            this.renderLayers();
            try {
                this.els.dsEditorCanvas.releasePointerCapture(e.pointerId);
            } catch (error) {
                // ignore
            }
        },

        onEditorPointerLeave(e) {
            if (this.drawing && e.pointerType !== 'mouse') {
                this.onEditorPointerUp(e);
            }
        },

        updateCoords(point) {
            if (!point) {
                this.els.dsCoords.textContent = '—';
                return;
            }
            const suffix = point.direction ? ` · neighbour ${point.direction}` : '';
            this.els.dsCoords.textContent = `${point.x}, ${point.y} · tile #${point.mask}${suffix}`;
        },

        strokeLine(from, to, erase, changed) {
            const dx = to.gx - from.gx;
            const dy = to.gy - from.gy;
            const steps = Math.max(Math.abs(dx), Math.abs(dy));
            if (steps === 0) {
                this.paintAt(to, erase, changed);
                return;
            }
            for (let i = 1; i <= steps; i++) {
                const point = this.pointFromGlobal(
                    Math.round(from.gx + dx * (i / steps)),
                    Math.round(from.gy + dy * (i / steps))
                );
                if (point) this.paintAt(point, erase, changed);
            }
        },

        paintAt(point, erase, changed) {
            if (!point) return;
            const grid = this.activeGrid();
            const mask = point.mask;
            const tile = grid && grid.tiles[mask];
            if (!tile) return;
            const layer = tile.layers[tile.activeLayer] || tile.layers[0];
            if (!layer) return;

            const size = this.tileSize();
            const brush = Core.clamp(this.brushSize, 1, 15);
            const start = -Math.floor((brush - 1) / 2);
            const positions = new Map();

            const add = (x, y) => {
                let px = x;
                let py = y;
                if (this.wrap) {
                    px = ((px % size) + size) % size;
                    py = ((py % size) + size) % size;
                } else if (px < 0 || py < 0 || px >= size || py >= size) {
                    return;
                }
                positions.set(`${px},${py}`, { x: px, y: py });
                this.trackTouchedEdge(mask, px, py, size);
            };

            if (this.tool === 'spray') {
                // Airbrush/dither spray: throw candidate pixels inside a circular
                // radius and keep them with an ordered-dither + hash threshold.
                const radius = Math.max(2.2, brush * 0.85);
                const density = Core.clamp(this.opacity, 0.05, 1);
                const count = Math.min(320, Math.max(18, Math.round(Math.PI * radius * radius * 1.8)));
                const tick = this.sprayTick++;
                for (let i = 0; i < count; i++) {
                    const angle = Core.hash(i + 1, tick, 17) * Math.PI * 2;
                    const distance = Math.sqrt(Core.hash(i + 41, tick, 71)) * radius;
                    const px = point.x + Math.round(Math.cos(angle) * distance);
                    const py = point.y + Math.round(Math.sin(angle) * distance);
                    const bayer = (BAYER_4[py & 3][px & 3] + 0.5) / 16;
                    const threshold = bayer * 0.55 + Core.hash(px, py, tick + 131) * 0.45;
                    if (threshold > density) continue;
                    add(px, py);
                    if (this.mirrorX) add(size - 1 - px, py);
                    if (this.mirrorY) add(px, size - 1 - py);
                    if (this.mirrorX && this.mirrorY) add(size - 1 - px, size - 1 - py);
                }
            } else {
                for (let oy = start; oy < start + brush; oy++) {
                    for (let ox = start; ox < start + brush; ox++) {
                        if (this.tool === 'brush' && brush > 1) {
                            const radius = brush / 2;
                            if (Math.hypot(ox, oy) > radius) continue;
                        }

                        const px = point.x + ox;
                        const py = point.y + oy;
                        add(px, py);
                        if (this.mirrorX) add(size - 1 - px, py);
                        if (this.mirrorY) add(px, size - 1 - py);
                        if (this.mirrorX && this.mirrorY) add(size - 1 - px, size - 1 - py);
                    }
                }
            }

            if (!positions.size) return;
            this.rememberHistoryTile(mask);
            if (!erase && !layer.visible) layer.visible = true;
            const ctx = layer.canvas.getContext('2d');

            if (erase) {
                ctx.save();
                ctx.globalAlpha = 1;
                positions.forEach(pos => ctx.clearRect(pos.x, pos.y, 1, 1));
                ctx.restore();
            } else {
                ctx.save();
                ctx.globalAlpha = Core.clamp(this.opacity, 0.01, 1);
                ctx.fillStyle = this.color;
                positions.forEach(pos => ctx.fillRect(pos.x, pos.y, 1, 1));
                ctx.restore();
            }

            changed.add(mask);
        },

        trackTouchedEdge(mask, x, y, size) {
            if (!mask) return;
            let entry = this.strokeTouched.get(mask);
            if (!entry) {
                entry = { edges: new Set(), corners: new Set() };
                this.strokeTouched.set(mask, entry);
            }

            const left = x === 0;
            const right = x === size - 1;
            const top = y === 0;
            const bottom = y === size - 1;

            if (left) entry.edges.add('left');
            if (right) entry.edges.add('right');
            if (top) entry.edges.add('top');
            if (bottom) entry.edges.add('bottom');

            if (left && top) entry.corners.add('tl');
            if (right && top) entry.corners.add('tr');
            if (left && bottom) entry.corners.add('bl');
            if (right && bottom) entry.corners.add('br');
        },

        markAllEdges(mask) {
            if (!mask) return;
            let entry = this.strokeTouched.get(mask);
            if (!entry) {
                entry = { edges: new Set(), corners: new Set() };
                this.strokeTouched.set(mask, entry);
            }
            ['left', 'right', 'top', 'bottom'].forEach(edge => entry.edges.add(edge));
            ['tl', 'tr', 'bl', 'br'].forEach(corner => entry.corners.add(corner));
        },

        syncTileEdges() {
            if (!this.syncEdges) return;
            if (!this.pendingHistory) return;
            if (!this.strokeTouched.size) return;

            const grid = this.activeGrid();
            if (!grid) return;

            const entries = Array.from(this.strokeTouched.entries());
            entries.forEach(([sourceMask, info]) => {
                if (sourceMask && (info.edges.size || info.corners.size)) {
                    this.syncMaskEdges(grid, sourceMask, info.edges, info.corners);
                }
            });
            this.strokeTouched.clear();
        },

        syncMaskEdges(grid, sourceMask, edges, corners) {
            if (!edges.size && !corners.size) return;
            const size = this.tileSize();
            const sourceVariation = Core.getActiveVariationIndex(grid, sourceMask);
            const source = Core.getVariations(grid, sourceMask)[sourceVariation];
            if (!source) return;

            const changed = new Set();

            const getSyncLayer = (tile) => {
                let layer = tile.layers.find(item => item.name === 'Edge sync');
                if (!layer) {
                    layer = Core.createLayer(size, 'Edge sync');
                    layer.system = true;
                    tile.layers.unshift(layer);
                    tile.activeLayer = (tile.activeLayer || 0) + 1;
                } else {
                    const index = tile.layers.indexOf(layer);
                    if (index > 0) {
                        tile.layers.splice(index, 1);
                        tile.layers.unshift(layer);
                        if (tile.activeLayer === index) tile.activeLayer = 0;
                        else if (tile.activeLayer < index) tile.activeLayer += 1;
                    }
                }
                layer.system = true;
                layer.visible = true;
                layer.opacity = 1;
                tile.activeLayer = Core.clamp(tile.activeLayer || 0, 0, tile.layers.length - 1);
                return layer;
            };

            // The sync layer is a cache of the canonical edge. Composite the
            // tile without it so a stroke on the active layer is what wins.
            const sourceSync = source.layers.some(item => item.name === 'Edge sync')
                ? getSyncLayer(source)
                : null;
            let sourceComposite;
            if (sourceSync) {
                const wasVisible = sourceSync.visible;
                sourceSync.visible = false;
                sourceComposite = Core.compositeTile(source, size);
                sourceSync.visible = wasVisible;
            } else {
                sourceComposite = Core.compositeTile(source, size);
            }
            const sourceData = sourceComposite.getContext('2d').getImageData(0, 0, size, size).data;

            const candidatesForEdge = (mask, edge) => {
                let required = 0;
                let keyMask = 0;
                if (edge === 'right') {
                    required = (mask & 2 ? 1 : 0) | (mask & 8 ? 4 : 0);
                    keyMask = 1 | 4;
                } else if (edge === 'left') {
                    required = (mask & 1 ? 2 : 0) | (mask & 4 ? 8 : 0);
                    keyMask = 2 | 8;
                } else if (edge === 'top') {
                    required = (mask & 1 ? 4 : 0) | (mask & 2 ? 8 : 0);
                    keyMask = 4 | 8;
                } else if (edge === 'bottom') {
                    required = (mask & 4 ? 1 : 0) | (mask & 8 ? 2 : 0);
                    keyMask = 1 | 2;
                }
                const result = [];
                for (let candidate = 0; candidate <= 15; candidate++) {
                    if (candidate === sourceMask) continue;
                    if (candidate === 0 && !this.maskHasArt(grid, 0)) continue;
                    if ((candidate & keyMask) === required) result.push(candidate);
                }
                return result;
            };

            const clearStrip = (tile, edge) => {
                tile.layers.forEach(layer => {
                    const ctx = layer.canvas.getContext('2d');
                    if (edge === 'left') ctx.clearRect(0, 0, 1, size);
                    else if (edge === 'right') ctx.clearRect(size - 1, 0, 1, size);
                    else if (edge === 'top') ctx.clearRect(0, 0, size, 1);
                    else if (edge === 'bottom') ctx.clearRect(0, size - 1, size, 1);
                });
            };

            const clearSyncStrip = (edge) => {
                if (!sourceSync) return;
                const ctx = sourceSync.canvas.getContext('2d');
                if (edge === 'left') ctx.clearRect(0, 0, 1, size);
                else if (edge === 'right') ctx.clearRect(size - 1, 0, 1, size);
                else if (edge === 'top') ctx.clearRect(0, 0, size, 1);
                else if (edge === 'bottom') ctx.clearRect(0, size - 1, size, 1);
            };

            const clearSyncCorner = (x, y) => {
                if (!sourceSync) return;
                sourceSync.canvas.getContext('2d').clearRect(x, y, 1, 1);
            };

            const copyEdge = (targetMask, targetVariation, edge) => {
                if (targetMask === sourceMask && targetVariation === sourceVariation) return;
                const list = Core.getVariations(grid, targetMask);
                const tile = list[targetVariation];
                if (!tile) return;
                this.rememberHistoryTile(targetMask, targetVariation);
                // The source edge is copied to the opposite edge of the
                // neighbouring variant, so clear that destination edge.
                const destinationEdge = edge === 'left' ? 'right'
                    : edge === 'right' ? 'left'
                    : edge === 'top' ? 'bottom'
                    : 'top';
                clearStrip(tile, destinationEdge);
                const layer = getSyncLayer(tile);
                const ctx = layer.canvas.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                if (edge === 'right') {
                    ctx.drawImage(sourceComposite, size - 1, 0, 1, size, 0, 0, 1, size);
                } else if (edge === 'left') {
                    ctx.drawImage(sourceComposite, 0, 0, 1, size, size - 1, 0, 1, size);
                } else if (edge === 'top') {
                    ctx.drawImage(sourceComposite, 0, 0, size, 1, 0, size - 1, size, 1);
                } else if (edge === 'bottom') {
                    ctx.drawImage(sourceComposite, 0, size - 1, size, 1, 0, 0, size, 1);
                }
                changed.add(targetMask);
            };

            const copyEdgeToSameMaskVariation = (targetVariation, edge) => {
                if (targetVariation === sourceVariation) return;
                const list = Core.getVariations(grid, sourceMask);
                const tile = list[targetVariation];
                if (!tile) return;
                this.rememberHistoryTile(sourceMask, targetVariation);
                clearStrip(tile, edge);
                const layer = getSyncLayer(tile);
                const ctx = layer.canvas.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                if (edge === 'right') {
                    ctx.drawImage(sourceComposite, size - 1, 0, 1, size, size - 1, 0, 1, size);
                } else if (edge === 'left') {
                    ctx.drawImage(sourceComposite, 0, 0, 1, size, 0, 0, 1, size);
                } else if (edge === 'top') {
                    ctx.drawImage(sourceComposite, 0, 0, size, 1, 0, 0, size, 1);
                } else if (edge === 'bottom') {
                    ctx.drawImage(sourceComposite, 0, size - 1, size, 1, 0, size - 1, size, 1);
                }
                changed.add(sourceMask);
            };

            edges.forEach(edge => {
                // Drop the stale cached edge on the source tile. The active
                // layers above it now hold the authoritative pixels.
                clearSyncStrip(edge);
                // Variations of the same tile share the same edge art.
                Core.getVariations(grid, sourceMask).forEach((_, variation) => {
                    copyEdgeToSameMaskVariation(variation, edge);
                });
                candidatesForEdge(sourceMask, edge).forEach(mask => {
                    Core.getVariations(grid, mask).forEach((_, variation) => {
                        copyEdge(mask, variation, edge);
                    });
                });
            });

            const cornerMap = {
                br: { bit: 8, targetBit: 1, sx: size - 1, sy: size - 1, tx: 0, ty: 0 },
                bl: { bit: 4, targetBit: 2, sx: 0, sy: size - 1, tx: size - 1, ty: 0 },
                tr: { bit: 2, targetBit: 4, sx: size - 1, sy: 0, tx: 0, ty: size - 1 },
                tl: { bit: 1, targetBit: 8, sx: 0, sy: 0, tx: size - 1, ty: size - 1 }
            };

            corners.forEach(corner => {
                const info = cornerMap[corner];
                if (!info) return;
                const sourcePixel = [
                    sourceData[(info.sy * size + info.sx) * 4],
                    sourceData[(info.sy * size + info.sx) * 4 + 1],
                    sourceData[(info.sy * size + info.sx) * 4 + 2],
                    sourceData[(info.sy * size + info.sx) * 4 + 3]
                ];
                // Drop the stale cached corner on the source tile.
                clearSyncCorner(info.sx, info.sy);

                // Same tile, different variations: copy the same corner.
                Core.getVariations(grid, sourceMask).forEach((tile, variation) => {
                    if (variation === sourceVariation || !tile) return;
                    this.rememberHistoryTile(sourceMask, variation);
                    tile.layers.forEach(layer => {
                        layer.canvas.getContext('2d').clearRect(info.sx, info.sy, 1, 1);
                    });
                    const layer = getSyncLayer(tile);
                    const ctx = layer.canvas.getContext('2d');
                    ctx.fillStyle = `rgba(${sourcePixel[0]}, ${sourcePixel[1]}, ${sourcePixel[2]}, ${sourcePixel[3] / 255})`;
                    ctx.fillRect(info.sx, info.sy, 1, 1);
                    changed.add(sourceMask);
                });

                for (let candidate = 0; candidate <= 15; candidate++) {
                    if (candidate === sourceMask) continue;
                    if (candidate === 0 && !this.maskHasArt(grid, 0)) continue;
                    if ((candidate & info.targetBit) !== (sourceMask & info.bit ? info.targetBit : 0)) continue;
                    Core.getVariations(grid, candidate).forEach((tile, variation) => {
                        if (!tile) return;
                        this.rememberHistoryTile(candidate, variation);

                        tile.layers.forEach(layer => {
                            layer.canvas.getContext('2d').clearRect(info.tx, info.ty, 1, 1);
                        });

                        const layer = getSyncLayer(tile);
                        const ctx = layer.canvas.getContext('2d');
                        ctx.fillStyle = `rgba(${sourcePixel[0]}, ${sourcePixel[1]}, ${sourcePixel[2]}, ${sourcePixel[3] / 255})`;
                        ctx.fillRect(info.tx, info.ty, 1, 1);
                        changed.add(candidate);
                    });
                }
            });

            if (!changed.size) return;
            changed.forEach(mask => {
                Core.invalidateTile(grid, mask);
                this.refreshAtlasThumb(mask);
            });
            this.schedulePreview();
            this.markDirty();
        },

        floodFill(tile, point, erase) {
            const layer = tile.layers[tile.activeLayer] || tile.layers[0];
            if (!layer) return;

            const size = this.tileSize();
            const ctx = layer.canvas.getContext('2d');
            const image = ctx.getImageData(0, 0, size, size);
            const data = image.data;
            const startIndex = (point.y * size + point.x) * 4;
            const target = [data[startIndex], data[startIndex + 1], data[startIndex + 2], data[startIndex + 3]];

            const rgb = Core.hexToRgb(this.color);
            const fillColor = erase
                ? [0, 0, 0, 0]
                : [rgb.r, rgb.g, rgb.b, Math.round(Core.clamp(this.opacity, 0, 1) * 255)];

            if (target[0] === fillColor[0] && target[1] === fillColor[1] &&
                target[2] === fillColor[2] && target[3] === fillColor[3]) {
                return;
            }

            const matches = (x, y) => {
                const index = (y * size + x) * 4;
                return data[index] === target[0] && data[index + 1] === target[1] &&
                    data[index + 2] === target[2] && data[index + 3] === target[3];
            };

            const stack = [[point.x, point.y]];
            const seen = new Uint8Array(size * size);

            while (stack.length) {
                const [x, y] = stack.pop();
                if (x < 0 || y < 0 || x >= size || y >= size) continue;
                const flat = y * size + x;
                if (seen[flat]) continue;
                if (!matches(x, y)) continue;
                seen[flat] = 1;
                const index = flat * 4;
                data[index] = fillColor[0];
                data[index + 1] = fillColor[1];
                data[index + 2] = fillColor[2];
                data[index + 3] = fillColor[3];

                const neighbours = [
                    [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]
                ];

                if (this.wrap) {
                    neighbours.push(
                        [x === 0 ? size - 1 : x - 1, y],
                        [x === size - 1 ? 0 : x + 1, y],
                        [x, y === 0 ? size - 1 : y - 1],
                        [x, y === size - 1 ? 0 : y + 1]
                    );
                }

                neighbours.forEach(([nx, ny]) => stack.push([nx, ny]));
            }

            ctx.putImageData(image, 0, 0);
            if (!layer.visible) layer.visible = true;
        },

        pickColor(point) {
            const grid = this.activeGrid();
            if (!grid || !point || point.mask == null) {
                this.notify('info', 'That cell is empty — there is no tile colour to pick.');
                return;
            }
            const tile = grid.tiles[point.mask];
            if (!tile) return;
            const size = this.tileSize();
            const composite = Core.compositeTile(tile, size);
            const ctx = composite.getContext('2d');
            const pixel = ctx.getImageData(point.x, point.y, 1, 1).data;
            if (pixel[3] === 0) {
                this.notify('info', 'That pixel is transparent');
                return;
            }
            const hex = Core.rgbToHex(pixel[0], pixel[1], pixel[2]);
            this.setColor(hex, true);
            this.notify('info', `Picked ${hex}`);
        },

        afterMasksChanged(masks) {
            const grid = this.activeGrid();
            if (!grid || !masks || !masks.size) return;
            masks.forEach(mask => {
                if (!mask) return;
                Core.invalidateTile(grid, mask);
                this.refreshAtlasThumb(mask);
            });
            this.renderEditor();
            this.schedulePreview();
            this.renderTileInfo();
            this.markDirty();
        },

        afterTileChange() {
            this.afterMasksChanged(new Set([this.selectedMask]));
        },

        /* --------------------------------------------------------
           History
           -------------------------------------------------------- */

        snapshotTile(tile) {
            return {
                activeLayer: tile.activeLayer,
                layers: tile.layers.map(layer => {
                    const width = layer.canvas.width;
                    const height = layer.canvas.height;
                    const ctx = layer.canvas.getContext('2d');
                    return {
                        id: layer.id,
                        name: layer.name,
                        visible: layer.visible,
                        opacity: layer.opacity,
                        width,
                        height,
                        data: ctx.getImageData(0, 0, width, height)
                    };
                })
            };
        },

        applyTileSnapshot(tile, snapshot) {
            tile.layers = snapshot.layers.map(layerData => {
                const canvas = Core.makeCanvas(layerData.width, layerData.height);
                canvas.getContext('2d').putImageData(layerData.data, 0, 0);
                return {
                    id: layerData.id || Core.uid(),
                    name: layerData.name || 'Layer',
                    visible: layerData.visible !== false,
                    opacity: layerData.opacity == null ? 1 : layerData.opacity,
                    canvas
                };
            });
            tile.activeLayer = Core.clamp(snapshot.activeLayer || 0, 0, tile.layers.length - 1);
        },

        beginHistory(primaryMask) {
            const grid = this.activeGrid();
            if (!grid) return;
            this.pendingHistory = {
                gridId: grid.id,
                firstMask: null,
                firstVariation: 0,
                firstVariationId: null,
                before: new Map()
            };
            if (primaryMask != null) this.rememberHistoryTile(primaryMask);
        },

        rememberHistoryTile(mask, variation) {
            if (!this.pendingHistory) return;
            if (!mask) return;
            const grid = Core.getGrid(this.project, this.pendingHistory.gridId);
            if (!grid) return;
            const list = Core.getVariations(grid, mask);
            const index = variation == null
                ? Core.getActiveVariationIndex(grid, mask)
                : Core.clamp(Number(variation) || 0, 0, list.length - 1);
            const key = `${mask}:${index}`;
            if (this.pendingHistory.before.has(key)) return;
            const tile = list[index];
            if (!tile) return;
            this.pendingHistory.before.set(key, {
                mask,
                variation: index,
                variationId: tile.id,
                before: this.snapshotTile(tile)
            });
            if (this.pendingHistory.firstMask == null) {
                this.pendingHistory.firstMask = mask;
                this.pendingHistory.firstVariation = index;
                this.pendingHistory.firstVariationId = tile.id;
            }
        },

        commitHistory() {
            if (!this.pendingHistory) return;
            const entry = this.pendingHistory;
            this.pendingHistory = null;
            const grid = Core.getGrid(this.project, entry.gridId);
            if (!grid) return;

            const changes = [];
            entry.before.forEach(item => {
                const list = Core.getVariations(grid, item.mask);
                const tile = list[item.variation];
                if (!tile) return;
                changes.push({
                    mask: item.mask,
                    variation: item.variation,
                    variationId: item.variationId,
                    before: item.before,
                    after: this.snapshotTile(tile)
                });
            });
            if (!changes.length) return;

            this.undoStack.push({
                gridId: entry.gridId,
                mask: entry.firstMask != null ? entry.firstMask : this.selectedMask,
                variation: entry.firstVariation || 0,
                variationId: entry.firstVariationId || null,
                changes
            });
            if (this.undoStack.length > 60) this.undoStack.shift();
            this.redoStack = [];
            this.updateHistoryButtons();
        },

        applyHistoryEntry(entry, side) {
            const grid = Core.getGrid(this.project, entry.gridId);
            if (!grid) return null;
            const changes = Array.isArray(entry.changes)
                ? entry.changes
                : [{ mask: entry.mask, variation: 0, before: entry.before, after: entry.after }];

            let primaryVariation = null;
            const primaryMask = entry.mask != null ? entry.mask : changes[0].mask;

            changes.forEach(change => {
                const list = Core.getVariations(grid, change.mask);
                let variation;
                if (change.variationId) {
                    variation = list.findIndex(tile => tile.id === change.variationId);
                    if (variation < 0) return; // This variation was deleted.
                } else {
                    variation = Core.clamp(Number(change.variation) || 0, 0, list.length - 1);
                }
                const tile = list[variation];
                if (!tile || !change[side]) return;
                this.applyTileSnapshot(tile, change[side]);
                if (Core.getActiveVariationIndex(grid, change.mask) === variation) {
                    grid.tiles[change.mask] = tile;
                }
                Core.invalidateTile(grid, change.mask);
                if (change.mask === primaryMask && primaryVariation == null) {
                    primaryVariation = variation;
                }
            });

            return {
                grid,
                mask: primaryMask,
                variation: primaryVariation != null
                    ? primaryVariation
                    : (entry.variation != null ? entry.variation : (changes[0].variation || 0))
            };
        },

        undo() {
            const entry = this.undoStack.pop();
            if (!entry) return;
            const restored = this.applyHistoryEntry(entry, 'before');
            if (!restored) return;
            this.redoStack.push(entry);

            this.project.activeGridId = restored.grid.id;
            this.selectedMask = restored.mask;
            Core.setActiveVariation(restored.grid, restored.mask, restored.variation || 0);
            this.ensureSelectedMask();
            this.updateHistoryButtons();
            this.renderAll();
            this.markDirty();
            this.notify('info', 'Undone');
        },

        redo() {
            const entry = this.redoStack.pop();
            if (!entry) return;
            const restored = this.applyHistoryEntry(entry, 'after');
            if (!restored) return;
            this.undoStack.push(entry);

            this.project.activeGridId = restored.grid.id;
            this.selectedMask = restored.mask;
            Core.setActiveVariation(restored.grid, restored.mask, restored.variation || 0);
            this.ensureSelectedMask();
            this.updateHistoryButtons();
            this.renderAll();
            this.markDirty();
            this.notify('info', 'Redone');
        },

        updateHistoryButtons() {
            this.els.dsUndoBtn.disabled = this.undoStack.length === 0;
            this.els.dsRedoBtn.disabled = this.redoStack.length === 0;
        },

        resetHistory() {
            this.undoStack = [];
            this.redoStack = [];
            this.pendingHistory = null;
            this.updateHistoryButtons();
        },

        /* --------------------------------------------------------
           Tile actions
           -------------------------------------------------------- */

        copyTile() {
            const grid = this.activeGrid();
            const tile = this.activeTile();
            if (!grid || !tile) return;
            this.clipboardTile = this.snapshotTile(tile);
            this.clipboardTile.size = this.tileSize();
            this.clipboardLabel = `${grid.name} · #${this.selectedMask}`;
            this.els.dsPasteTileBtn.disabled = false;
            this.notify('success', `Copied tile #${this.selectedMask} (${this.clipboardLabel})`);
        },

        pasteTile() {
            if (!this.clipboardTile) {
                this.notify('info', 'Copy a tile first');
                return;
            }
            const grid = this.activeGrid();
            const tile = this.activeTile();
            if (!grid || !tile) return;

            this.beginHistory(this.selectedMask);
            const targetSize = this.tileSize();
            const sourceSize = this.clipboardTile.size || targetSize;

            tile.layers = this.clipboardTile.layers.map(layerData => {
                const canvas = Core.makeCanvas(targetSize, targetSize);
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                if (sourceSize === targetSize) {
                    ctx.putImageData(layerData.data, 0, 0);
                } else {
                    const temp = Core.makeCanvas(layerData.width, layerData.height);
                    temp.getContext('2d').putImageData(layerData.data, 0, 0);
                    ctx.drawImage(temp, 0, 0, layerData.width, layerData.height, 0, 0, targetSize, targetSize);
                }
                return {
                    id: Core.uid(),
                    name: layerData.name,
                    visible: layerData.visible,
                    opacity: layerData.opacity,
                    canvas
                };
            });
            tile.activeLayer = Math.min(this.clipboardTile.activeLayer || 0, tile.layers.length - 1);

            this.commitHistory();
            this.afterTileChange();
            this.renderLayers();
            this.notify('success', `Pasted ${this.clipboardLabel} into tile #${this.selectedMask}`);
        },

        flipTile(direction) {
            const tile = this.activeTile();
            if (!tile) return;

            this.beginHistory(this.selectedMask);
            const size = this.tileSize();
            tile.layers.forEach(layer => {
                const canvas = Core.makeCanvas(size, size);
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                ctx.save();
                if (direction === 'h') {
                    ctx.translate(size, 0);
                    ctx.scale(-1, 1);
                } else {
                    ctx.translate(0, size);
                    ctx.scale(1, -1);
                }
                ctx.drawImage(layer.canvas, 0, 0, size, size);
                ctx.restore();
                layer.canvas = canvas;
            });

            this.commitHistory();
            this.afterTileChange();
            this.renderLayers();
        },

        clearTile() {
            const tile = this.activeTile();
            if (!tile) return;
            this.beginHistory(this.selectedMask);
            tile.layers.forEach(layer => {
                layer.canvas.getContext('2d').clearRect(0, 0, layer.canvas.width, layer.canvas.height);
            });
            this.commitHistory();
            this.afterTileChange();
            this.renderLayers();
            this.notify('info', 'Tile cleared');
        },

        /* --------------------------------------------------------
           Layers
           -------------------------------------------------------- */

        addLayer() {
            const tile = this.activeTile();
            if (!tile) return;
            this.beginHistory(this.selectedMask);
            const userLayerCount = tile.layers.filter(item => !(item.system || item.name === 'Edge sync')).length;
            const layer = Core.createLayer(this.tileSize(), `Layer ${userLayerCount + 1}`);
            tile.layers.push(layer);
            tile.activeLayer = tile.layers.length - 1;
            this.commitHistory();
            this.afterTileChange();
            this.renderLayers();
        },

        duplicateLayer() {
            const tile = this.activeTile();
            if (!tile) return;
            const source = tile.layers[tile.activeLayer];
            if (!source) return;

            this.beginHistory(this.selectedMask);
            const canvas = Core.makeCanvas(source.canvas.width, source.canvas.height);
            canvas.getContext('2d').drawImage(source.canvas, 0, 0);
            const layer = {
                id: Core.uid(),
                name: `${source.name} copy`,
                visible: source.visible,
                opacity: source.opacity,
                canvas
            };
            tile.layers.splice(tile.activeLayer + 1, 0, layer);
            tile.activeLayer += 1;
            this.commitHistory();
            this.afterTileChange();
            this.renderLayers();
        },

        deleteLayer() {
            const tile = this.activeTile();
            if (!tile) return;
            const userLayers = tile.layers.filter(layer => !(layer.system || layer.name === 'Edge sync'));
            if (userLayers.length <= 1) {
                this.notify('info', 'A tile needs at least one drawable layer');
                return;
            }
            this.beginHistory(this.selectedMask);
            tile.layers.splice(tile.activeLayer, 1);
            tile.activeLayer = Core.clamp(tile.activeLayer, 0, tile.layers.length - 1);
            this.commitHistory();
            this.afterTileChange();
            this.renderLayers();
        },

        onLayerClick(e) {
            const eye = e.target.closest('[data-layer-eye]');
            const row = e.target.closest('.ds-layer');
            const tile = this.activeTile();
            if (!row || !tile) return;
            const index = parseInt(row.dataset.index, 10);
            if (!Number.isInteger(index)) return;

            if (eye) {
                e.preventDefault();
                tile.layers[index].visible = !tile.layers[index].visible;
                this.afterTileChange();
                this.renderLayers();
                return;
            }

            tile.activeLayer = index;
            this.renderLayers();
            this.renderEditor();
        },

        onLayerDoubleClick(e) {
            const name = e.target.closest('.ds-layer-name');
            const row = e.target.closest('.ds-layer');
            const tile = this.activeTile();
            if (!name || !row || !tile) return;
            const index = parseInt(row.dataset.index, 10);
            if (!Number.isInteger(index)) return;
            const layer = tile.layers[index];
            if (!layer) return;

            const value = window.prompt('Layer name', layer.name);
            if (value == null) return;
            const trimmed = value.trim();
            if (!trimmed) return;
            this.beginHistory(this.selectedMask);
            layer.name = trimmed.slice(0, 40);
            this.commitHistory();
            this.renderLayers();
        },

        setLayerOpacity(value) {
            const tile = this.activeTile();
            if (!tile) return;
            const layer = tile.layers[tile.activeLayer];
            if (!layer) return;
            layer.opacity = Core.clamp(value / 100, 0, 1);
            this.els.dsLayerOpacityLabel.textContent = `${value}%`;
            this.afterTileChange();
            this.renderLayers();
        },

        /* --------------------------------------------------------
           Rendering
           -------------------------------------------------------- */

        renderAll() {
            this.ensureSelectedMask();
            this.renderProjectName();
            this.renderAtlas();
            this.renderAtlasList();
            this.renderEditor();
            this.renderVariations();
            this.renderLayers();
            this.renderGridList();
            this.renderGridSettings();
            this.renderPreview();
            this.renderPalette();
            this.renderRecent();
            this.renderExportHint();
            this.updateFooter();
            this.updateHistoryButtons();
            this.els.dsPasteTileBtn.disabled = !this.clipboardTile;
        },

        renderProjectName() {
            if (document.activeElement !== this.els.dsProjectName) {
                this.els.dsProjectName.value = this.project.name;
            }
            document.title = `${this.project.name} — Dual Grid Studio`;
        },

        renderAtlas() {
            const grid = this.activeGrid();
            if (!grid) return;

            const size = this.tileSize();
            const masks = grid.mode === 9 ? Core.MASKS_9 : Core.MASKS_15;
            const gridEl = this.els.dsAtlasGrid;
            gridEl.innerHTML = '';
            gridEl.style.gridTemplateColumns = `repeat(${grid.mode === 9 ? 3 : 4}, minmax(0, 1fr))`;

            masks.forEach(mask => {
                const cell = document.createElement('div');
                cell.className = 'ds-atlas-cell';
                cell.dataset.mask = mask;
                if (mask === this.selectedMask) cell.classList.add('active');

                const wrap = document.createElement('div');
                wrap.className = 'ds-atlas-canvas-wrap';

                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                wrap.appendChild(canvas);

                const indexBadge = document.createElement('span');
                indexBadge.className = 'ds-atlas-index';
                indexBadge.textContent = `#${mask}`;
                wrap.appendChild(indexBadge);

                const variationCount = Core.getVariations(grid, mask).length;
                if (variationCount > 1) {
                    const varBadge = document.createElement('span');
                    varBadge.className = 'ds-atlas-var-count';
                    varBadge.textContent = `×${variationCount}`;
                    wrap.appendChild(varBadge);
                }

                const bitDots = document.createElement('span');
                bitDots.className = 'ds-atlas-bit-dots';
                [1, 2, 4, 8].forEach(bit => {
                    const dot = document.createElement('i');
                    dot.className = mask & bit ? 'on' : '';
                    bitDots.appendChild(dot);
                });
                wrap.appendChild(bitDots);

                const meta = document.createElement('div');
                meta.className = 'ds-atlas-meta';

                const name = document.createElement('span');
                name.className = 'ds-atlas-name';
                name.textContent = Core.MASK_SHORT[mask];
                name.title = Core.MASK_NAMES[mask];

                meta.appendChild(name);

                cell.appendChild(wrap);
                cell.appendChild(meta);
                gridEl.appendChild(cell);

                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                ctx.clearRect(0, 0, size, size);

                const tileCanvas = Core.getTileCanvas(grid, mask);
                if (tileCanvas) ctx.drawImage(tileCanvas, 0, 0);
            });

            this.renderAtlasMeta();
            this.renderAtlasList();
        },

        renderAtlasMeta() {
            const grid = this.activeGrid();
            if (!grid) return;
            const count = grid.mode === 9 ? 9 : 16;
            const masks = grid.mode === 9 ? Core.MASKS_9 : Core.MASKS_15;
            const variationTotal = masks.reduce((sum, mask) => {
                return sum + Core.getVariations(grid, mask).length;
            }, 0);
            this.els.dsAtlasSubtitle.textContent =
                `${grid.name} · ${variationTotal} tile${variationTotal === 1 ? '' : 's'} · ${this.tileSize()} px` +
                (grid.mode === 9 ? ' · 9-tile set' : ' · 16-tile set') +
                (variationTotal > count ? ' · variations' : '');

            this.els.dsAtlasBadges.innerHTML = '';
            const roleBadge = document.createElement('span');
            roleBadge.className = `ds-badge role-${grid.role}`;
            roleBadge.textContent = grid.role;
            const modeBadge = document.createElement('span');
            modeBadge.className = 'ds-badge';
            modeBadge.textContent = grid.mode === 9 ? '3×3 / 9' : '4×4 / 16';
            const visBadge = document.createElement('span');
            visBadge.className = 'ds-badge';
            visBadge.textContent = grid.visible ? 'preview on' : 'preview off';
            this.els.dsAtlasBadges.append(roleBadge, modeBadge, visBadge);
        },

        renderAtlasList() {
            const grid = this.activeGrid();
            const list = this.els.dsAtlasList;
            if (!grid || !list) return;

            const size = this.tileSize();
            const masks = grid.mode === 9 ? Core.MASKS_9 : Core.MASKS_15;
            list.innerHTML = '';
            this.els.dsAtlasListCount.textContent = String(masks.length);

            masks.forEach(mask => {
                const row = document.createElement('button');
                row.type = 'button';
                row.className = 'ds-atlas-list-item';
                row.dataset.mask = mask;
                if (mask === this.selectedMask) row.classList.add('active');

                const thumbWrap = document.createElement('span');
                thumbWrap.className = 'ds-atlas-list-thumb';
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                thumbWrap.appendChild(canvas);

                const text = document.createElement('span');
                text.className = 'ds-atlas-list-text';
                const name = document.createElement('strong');
                name.textContent = Core.MASK_SHORT[mask];
                const sub = document.createElement('small');
                const varCount = Core.getVariations(grid, mask).length;
                const varActive = Core.getActiveVariationIndex(grid, mask);
                sub.textContent = mask === 0
                    ? `#0 · ${Core.MASK_NAMES[0]} / empty cell${varCount > 1 ? ` · ${varCount} variations` : ''}`
                    : `#${mask} · ${Core.MASK_NAMES[mask]}${varCount > 1 ? ` · ${varCount} variations` : ''}`;
                text.append(name, sub);

                const state = document.createElement('span');
                state.className = 'ds-atlas-list-state';
                const stateLabel = document.createElement('span');
                stateLabel.className = 'ds-atlas-list-label';
                stateLabel.textContent = mask === this.selectedMask
                    ? (varCount > 1 ? `Editing · V${varActive + 1}` : 'Editing')
                    : '';
                state.appendChild(stateLabel);
                const bits = document.createElement('span');
                bits.className = 'ds-atlas-list-bits';
                [1, 2, 4, 8].forEach(bit => {
                    const dot = document.createElement('i');
                    dot.className = mask & bit ? 'on' : '';
                    bits.appendChild(dot);
                });
                state.appendChild(bits);

                row.append(thumbWrap, text, state);
                list.appendChild(row);

                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                ctx.clearRect(0, 0, size, size);
                const tileCanvas = Core.getTileCanvas(grid, mask);
                if (tileCanvas) ctx.drawImage(tileCanvas, 0, 0);
            });
        },

        refreshAtlasThumb(mask) {
            const grid = this.activeGrid();
            if (!grid) return;
            const size = this.tileSize();

            const paint = (canvas) => {
                if (!canvas) return;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                ctx.clearRect(0, 0, size, size);
                const tileCanvas = Core.getTileCanvas(grid, mask);
                if (tileCanvas) ctx.drawImage(tileCanvas, 0, 0);
            };

            const cell = this.els.dsAtlasGrid.querySelector(`.ds-atlas-cell[data-mask="${mask}"]`);
            if (cell) paint(cell.querySelector('canvas'));

            const listRow = this.els.dsAtlasList.querySelector(`.ds-atlas-list-item[data-mask="${mask}"]`);
            if (listRow) paint(listRow.querySelector('canvas'));
        },

        renderEditor() {
            const tile = this.activeTile();
            const grid = this.activeGrid();
            const size = this.tileSize();
            const internal = size * 2;
            const half = Math.floor(size / 2);
            const canvas = this.els.dsEditorCanvas;
            const ctx = this.els.editorCtx;

            if (canvas.width !== internal || canvas.height !== internal) {
                canvas.width = internal;
                canvas.height = internal;
            }

            ctx.clearRect(0, 0, internal, internal);
            ctx.imageSmoothingEnabled = false;

            // Centre tile at full size, plus the visible half/quarter of a
            // compatible neighbour in each margin. The neighbour can be
            // switched by clicking its # label over the canvas.
            if (tile) {
                const composite = Core.compositeTile(tile, size);
                ctx.save();
                ctx.globalAlpha = 0.5;
                NEIGHBOURS.forEach(direction => {
                    const mask = this.neighbourMaskFor(direction.key);
                    const neighbour = Core.getTileCanvas(grid, mask);
                    if (!neighbour) return;
                    ctx.drawImage(neighbour, half + direction.col * size, half + direction.row * size);
                });
                ctx.restore();
                ctx.drawImage(composite, half, half);
            }

            if (this.showPixelGrid && size <= 64) {
                ctx.save();
                ctx.strokeStyle = 'rgba(235, 244, 255, 0.09)';
                ctx.lineWidth = 1;
                for (let i = 1; i < internal; i++) {
                    ctx.beginPath();
                    ctx.moveTo(i + 0.5, 0);
                    ctx.lineTo(i + 0.5, internal);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(0, i + 0.5);
                    ctx.lineTo(internal, i + 0.5);
                    ctx.stroke();
                }
                ctx.restore();
            }

            this.renderTileInfo();
            this.renderNeighbourLabels();
        },

        renderNeighbourLabels() {
            const container = this.els.dsNeighbourLabels;
            if (!container) return;

            if (container.childElementCount !== NEIGHBOURS.length) {
                container.innerHTML = '';
                NEIGHBOURS.forEach(direction => {
                    const chip = document.createElement('button');
                    chip.type = 'button';
                    chip.className = 'ds-neighbour-chip';
                    chip.dataset.key = direction.key;
                    container.appendChild(chip);
                });
            }

            NEIGHBOURS.forEach(direction => {
                const chip = container.querySelector(`.ds-neighbour-chip[data-key="${direction.key}"]`);
                if (!chip) return;
                const mask = this.neighbourMaskFor(direction.key);
                const options = this.compatibleNeighbours(direction.key, this.selectedMask);
                chip.textContent = `#${mask}`;
                chip.title = `${direction.label} neighbour: #${mask}. Click to load another compatible tile (${options.map(value => `#${value}`).join(', ')}).`;
                chip.style.left = `${direction.col === 0 ? 50 : (direction.col < 0 ? 12.5 : 87.5)}%`;
                chip.style.top = `${direction.row === 0 ? 50 : (direction.row < 0 ? 12.5 : 87.5)}%`;
                chip.dataset.mask = String(mask);
            });
        },

        openNeighbourPicker(directionKey, anchor) {
            const direction = NEIGHBOURS.find(item => item.key === directionKey);
            if (!direction) return;
            this.closeNeighbourPicker();

            const grid = this.activeGrid();
            if (!grid) return;
            const options = this.compatibleNeighbours(directionKey, this.selectedMask);
            const current = this.neighbourMaskFor(directionKey);
            const size = this.tileSize();

            const popover = document.createElement('div');
            popover.className = 'ds-neighbour-popover';

            const head = document.createElement('div');
            head.className = 'ds-neighbour-popover-head';
            head.innerHTML = `<strong>${direction.label} neighbour</strong><span>Tile #${this.selectedMask} connects to these</span>`;
            popover.appendChild(head);

            const list = document.createElement('div');
            list.className = 'ds-neighbour-options';
            options.forEach(mask => {
                const option = document.createElement('button');
                option.type = 'button';
                option.className = 'ds-neighbour-option' + (mask === current ? ' active' : '');
                option.title = `Load #${mask} · ${Core.MASK_NAMES[mask]}`;

                const thumb = document.createElement('canvas');
                thumb.width = size;
                thumb.height = size;
                const tileCanvas = Core.getTileCanvas(grid, mask);
                if (tileCanvas) {
                    const thumbCtx = thumb.getContext('2d');
                    thumbCtx.imageSmoothingEnabled = false;
                    thumbCtx.drawImage(tileCanvas, 0, 0);
                }

                const label = document.createElement('span');
                label.className = 'ds-neighbour-option-label';
                label.textContent = `#${mask}`;

                option.append(thumb, label);
                option.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    this.setNeighbourMask(directionKey, mask);
                });
                list.appendChild(option);
            });
            popover.appendChild(list);
            document.body.appendChild(popover);
            this.neighbourPicker = popover;

            const rect = anchor.getBoundingClientRect();
            const popRect = popover.getBoundingClientRect();
            let left = rect.left + rect.width / 2 - popRect.width / 2;
            let top = rect.bottom + 8;
            left = Core.clamp(left, 8, window.innerWidth - popRect.width - 8);
            if (top + popRect.height > window.innerHeight - 8) {
                top = rect.top - popRect.height - 8;
            }
            top = Core.clamp(top, 8, window.innerHeight - popRect.height - 8);
            popover.style.left = `${left}px`;
            popover.style.top = `${top}px`;
        },

        closeNeighbourPicker() {
            if (!this.neighbourPicker) return;
            this.neighbourPicker.remove();
            this.neighbourPicker = null;
        },

        renderTileInfo() {
            const tile = this.activeTile();
            const mask = this.selectedMask;

            const grid = this.activeGrid();
            const variations = grid ? Core.getVariations(grid, mask) : [];
            const variationIndex = grid ? Core.getActiveVariationIndex(grid, mask) : 0;
            this.els.dsEditorTitle.textContent = `Tile #${mask} — ${Core.MASK_SHORT[mask]}` +
                (variations.length > 1 ? ` · Var ${variationIndex + 1}/${variations.length}` : '');
            this.els.dsEditorSubtitle.textContent = mask === 15
                ? 'Fully filled tile — used in the middle of a terrain chunk. Click a margin # label to load any compatible neighbour.'
                : mask === 0
                    ? 'Base fill — used where all four map corners are empty. Click a margin # label to load any compatible neighbour.'
                    : `${Core.MASK_NAMES[mask]}. Click a margin # label to load a compatible neighbour and keep the seam continuous.`;

            this.els.dsMaskTitle.textContent = Core.MASK_NAMES[mask];
            const bits = [];
            if (mask & 1) bits.push('TL');
            if (mask & 2) bits.push('TR');
            if (mask & 4) bits.push('BL');
            if (mask & 8) bits.push('BR');
            this.els.dsMaskBits.textContent = bits.length ? bits.join(' · ') : 'no filled corners';

            this.els.dsMaskDiagram.innerHTML = '';
            [1, 2, 4, 8].forEach(bit => {
                const cell = document.createElement('span');
                cell.className = 'ds-mask-cell' + (mask & bit ? ' on' : '');
                this.els.dsMaskDiagram.appendChild(cell);
            });

            if (tile) {
                const userLayers = tile.layers.filter(layer => !(layer.system || layer.name === 'Edge sync'));
                const visible = userLayers.filter(layer => layer.visible).length;
                this.els.dsTileInfo.innerHTML =
                    `<strong>${this.tileSize()}×${this.tileSize()} px</strong> · ` +
                    `${userLayers.length} layer${userLayers.length === 1 ? '' : 's'} · ` +
                    `${visible} visible`;
            } else {
                this.els.dsTileInfo.textContent = '';
            }
        },

        renderVariations() {
            const grid = this.activeGrid();
            const mask = this.selectedMask;
            const container = this.els.dsVariationChips;
            if (!grid || !container) return;

            const list = Core.getVariations(grid, mask);
            const active = Core.getActiveVariationIndex(grid, mask);
            container.innerHTML = '';

            list.forEach((tile, index) => {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'ds-variation-chip' + (index === active ? ' active' : '');
                chip.dataset.index = index;
                chip.textContent = String(index + 1);
                chip.title = `Variation ${index + 1} of ${list.length}`;
                container.appendChild(chip);
            });

            this.els.dsVariationCount.textContent = String(list.length);
            this.els.dsDeleteVariationBtn.disabled = list.length <= 1;
        },

        selectVariation(index) {
            const grid = this.activeGrid();
            if (!grid) return;
            const list = Core.getVariations(grid, this.selectedMask);
            if (!list.length) return;
            const next = Core.clamp(Number(index) || 0, 0, list.length - 1);
            Core.setActiveVariation(grid, this.selectedMask, next);
            this.renderEditor();
            this.renderVariations();
            this.renderLayers();
            this.refreshAtlasThumb(this.selectedMask);
            this.renderAtlasList();
            this.renderTileInfo();
            this.schedulePreview();
            this.markDirty();
        },

        addVariation() {
            const grid = this.activeGrid();
            if (!grid) return;
            const mask = this.selectedMask;
            Core.addVariation(grid, mask, true);
            this.renderAtlas();
            this.renderEditor();
            this.renderVariations();
            this.renderLayers();
            this.renderTileInfo();
            this.schedulePreview();
            this.markDirty();
            this.notify('success', `Added variation ${Core.getVariations(grid, mask).length} to tile #${mask}`);
        },

        deleteVariation() {
            const grid = this.activeGrid();
            if (!grid) return;
            const mask = this.selectedMask;
            const list = Core.getVariations(grid, mask);
            if (list.length <= 1) {
                this.notify('info', 'A tile needs at least one variation');
                return;
            }
            const active = Core.getActiveVariationIndex(grid, mask);
            Core.deleteVariation(grid, mask, active);
            this.renderAtlas();
            this.renderEditor();
            this.renderVariations();
            this.renderLayers();
            this.renderTileInfo();
            this.schedulePreview();
            this.markDirty();
            this.notify('info', `Removed variation from tile #${mask}`);
        },

        renderLayers() {
            const tile = this.activeTile();
            const container = this.els.dsLayers;
            container.innerHTML = '';

            if (!tile) {
                this.els.dsLayerOpacityWrap.classList.add('hidden');
                return;
            }

            this.els.dsLayerOpacityWrap.classList.remove('hidden');

            const userLayers = tile.layers
                .map((layer, index) => ({ layer, index }))
                .filter(({ layer }) => !(layer.system || layer.name === 'Edge sync'));
            if (userLayers.length && !userLayers.some(item => item.index === tile.activeLayer)) {
                tile.activeLayer = userLayers[0].index;
            }

            const activeLayer = tile.layers[tile.activeLayer] || (userLayers[0] && userLayers[0].layer) || tile.layers[0];
            const opacityValue = Math.round((activeLayer ? activeLayer.opacity : 1) * 100);
            this.els.dsLayerOpacity.value = opacityValue;
            this.els.dsLayerOpacityLabel.textContent = `${opacityValue}%`;

            userLayers
                .slice()
                .reverse()
                .forEach(({ layer, index }) => {
                    const row = document.createElement('div');
                    row.className = 'ds-layer' + (index === tile.activeLayer ? ' active' : '') +
                        (layer.visible ? '' : ' hidden-layer');
                    row.dataset.index = index;

                    const eye = document.createElement('button');
                    eye.type = 'button';
                    eye.className = 'ds-layer-eye';
                    eye.dataset.layerEye = '1';
                    eye.title = layer.visible ? 'Hide layer' : 'Show layer';
                    eye.innerHTML = `<i class="fas ${layer.visible ? 'fa-eye' : 'fa-eye-slash'}"></i>`;

                    const thumb = document.createElement('canvas');
                    thumb.className = 'ds-layer-thumb';
                    thumb.width = 26;
                    thumb.height = 26;

                    const name = document.createElement('span');
                    name.className = 'ds-layer-name';
                    name.textContent = layer.name;
                    name.title = 'Double-click to rename';

                    const op = document.createElement('span');
                    op.className = 'ds-layer-op';
                    op.textContent = `${Math.round(layer.opacity * 100)}%`;

                    row.append(eye, thumb, name, op);
                    container.appendChild(row);

                    const ctx = thumb.getContext('2d');
                    ctx.imageSmoothingEnabled = false;
                    ctx.clearRect(0, 0, 26, 26);
                    ctx.drawImage(layer.canvas, 0, 0, layer.canvas.width, layer.canvas.height, 0, 0, 26, 26);
                });
        },

        renderGridList() {
            const container = this.els.dsGridList;
            container.innerHTML = '';

            this.project.grids.forEach(grid => {
                const item = document.createElement('div');
                item.className = 'ds-grid-item' +
                    (grid.id === this.project.activeGridId ? ' active' : '') +
                    (grid.visible ? '' : ' is-hidden');
                item.dataset.gridId = grid.id;

                const thumb = document.createElement('canvas');
                thumb.className = 'ds-grid-item-thumb';
                thumb.width = 34;
                thumb.height = 34;

                const text = document.createElement('div');
                text.className = 'ds-grid-item-text';

                const name = document.createElement('div');
                name.className = 'ds-grid-item-name';
                name.textContent = grid.name;

                const sub = document.createElement('div');
                sub.className = 'ds-grid-item-sub';
                const dot = document.createElement('span');
                dot.className = `ds-role-dot ${grid.role}`;
                const subText = document.createElement('span');
                subText.textContent = `${grid.role} · ${grid.mode === 9 ? '9' : '15'} tiles`;
                sub.append(dot, subText);

                text.append(name, sub);

                const eye = document.createElement('button');
                eye.type = 'button';
                eye.className = 'ds-grid-eye';
                eye.dataset.gridEye = '1';
                eye.title = grid.visible ? 'Hide from preview' : 'Show in preview';
                eye.innerHTML = `<i class="fas ${grid.visible ? 'fa-eye' : 'fa-eye-slash'}"></i>`;

                item.append(thumb, text, eye);
                container.appendChild(item);

                // A 2×2 collage makes the grid thumbnail readable even when it is mostly empty.
                const masks = grid.mode === 9
                    ? [1, 3, 10, 15]
                    : [1, 3, 10, 15];
                const ctx = thumb.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                ctx.clearRect(0, 0, 34, 34);
                if (grid.role === 'outer') {
                    ctx.fillStyle = this.project.background || '#c99a63';
                    ctx.fillRect(0, 0, 34, 34);
                }

                masks.forEach((mask, index) => {
                    const tileCanvas = Core.getTileCanvas(grid, mask);
                    if (!tileCanvas) return;
                    const x = (index % 2) * 17;
                    const y = Math.floor(index / 2) * 17;
                    ctx.drawImage(tileCanvas, x, y, 17, 17);
                });
            });
        },

        renderGridSettings() {
            const grid = this.activeGrid();
            if (!grid) return;

            if (document.activeElement !== this.els.dsGridName) {
                this.els.dsGridName.value = grid.name;
            }
            this.els.dsGridRole.value = grid.role;
            this.els.dsGridMode.value = String(grid.mode);
            this.els.dsTileSize.value = String(this.tileSize());
            this.els.dsDeleteGridBtn.disabled = this.project.grids.length <= 1;
        },

        /* --------------------------------------------------------
           Preview
           -------------------------------------------------------- */

        schedulePreview() {
            if (this.previewFrame) return;
            this.previewFrame = requestAnimationFrame(() => {
                this.previewFrame = null;
                this.renderPreview();
            });
        },

        getCell(grid, x, y) {
            if (x < 0 || y < 0 || x >= this.project.mapW || y >= this.project.mapH) return 0;
            return grid.cells[y * this.project.mapW + x] ? 1 : 0;
        },

        renderPreview() {
            if (!this.project) return;
            const canvas = this.els.dsPreviewCanvas;
            const ctx = this.els.previewCtx;
            const tileSize = this.tileSize();
            const mapW = this.project.mapW;
            const mapH = this.project.mapH;

            const width = (mapW + 1) * tileSize;
            const height = (mapH + 1) * tileSize;
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
            }

            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = this.project.background || '#c99a63';
            ctx.fillRect(0, 0, width, height);

            // Faint logical cell grid, offset by half a tile.
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.075)';
            ctx.lineWidth = 1;
            for (let x = 0; x <= mapW; x++) {
                const px = Math.round(tileSize / 2 + x * tileSize) + 0.5;
                ctx.beginPath();
                ctx.moveTo(px, tileSize / 2);
                ctx.lineTo(px, tileSize / 2 + mapH * tileSize);
                ctx.stroke();
            }
            for (let y = 0; y <= mapH; y++) {
                const py = Math.round(tileSize / 2 + y * tileSize) + 0.5;
                ctx.beginPath();
                ctx.moveTo(tileSize / 2, py);
                ctx.lineTo(tileSize / 2 + mapW * tileSize, py);
                ctx.stroke();
            }
            ctx.restore();

            let grids = this.project.grids.filter(grid => grid.visible);
            if (!this.showAllGrids) {
                grids = grids.filter(grid => grid.id === this.project.activeGridId);
            }

            const order = { outer: 0, custom: 1, inner: 2 };
            grids = grids.slice().sort((a, b) => (order[a.role] || 0) - (order[b.role] || 0));

            grids.forEach(grid => {
                for (let gy = 0; gy <= mapH; gy++) {
                    for (let gx = 0; gx <= mapW; gx++) {
                        const mask =
                            (this.getCell(grid, gx - 1, gy - 1) ? 1 : 0) |
                            (this.getCell(grid, gx, gy - 1) ? 2 : 0) |
                            (this.getCell(grid, gx - 1, gy) ? 4 : 0) |
                            (this.getCell(grid, gx, gy) ? 8 : 0);

                        const renderMask = Core.resolveMask(grid, mask);
                        const variations = Core.getVariations(grid, renderMask);
                        let variation = 0;
                        if (variations.length > 1) {
                            const seed = (grid.id || 'grid').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
                            variation = Math.floor(Core.hash(gx, gy, seed) * variations.length) % variations.length;
                        }
                        const tileCanvas = Core.getVariationCanvas(grid, renderMask, variation);
                        if (!tileCanvas) continue;

                        ctx.drawImage(tileCanvas, gx * tileSize, gy * tileSize, tileSize, tileSize);
                    }
                }
            });

            if (this.hoverCell) {
                const { x, y } = this.hoverCell;
                if (x >= 0 && y >= 0 && x < mapW && y < mapH) {
                    ctx.save();
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
                    ctx.lineWidth = Math.max(1, Math.floor(tileSize / 16));
                    ctx.strokeRect(
                        tileSize / 2 + x * tileSize + 1,
                        tileSize / 2 + y * tileSize + 1,
                        tileSize - 2,
                        tileSize - 2
                    );
                    ctx.restore();
                }
            }

            const mini = this.els.dsMiniPreviewCanvas;
            if (mini) {
                if (mini.width !== width || mini.height !== height) {
                    mini.width = width;
                    mini.height = height;
                }
                const miniCtx = this.els.miniPreviewCtx;
                miniCtx.imageSmoothingEnabled = false;
                miniCtx.clearRect(0, 0, width, height);
                miniCtx.drawImage(canvas, 0, 0);
            }

            this.updatePreviewHint();
        },

        updatePreviewHint() {
            const grid = this.activeGrid();
            const visible = this.project.grids.filter(item => item.visible).length;
            if (!grid) return;
            const name = this.escapeHtml(grid.name);
            this.els.dsPreviewHint.innerHTML = this.showAllGrids
                ? `<i class="fas fa-eye"></i> Showing ${visible} visible grid${visible === 1 ? '' : 's'} · painting <strong>${name}</strong>. Outer grids render below inner grids.`
                : `<i class="fas fa-eye"></i> Showing only <strong>${name}</strong> · painting its test map.`;
        },

        previewCell(e) {
            const canvas = this.els.dsPreviewCanvas;
            const rect = canvas.getBoundingClientRect();
            const tileSize = this.tileSize();
            const px = (e.clientX - rect.left) / rect.width * canvas.width;
            const py = (e.clientY - rect.top) / rect.height * canvas.height;
            const x = Math.floor((px - tileSize / 2) / tileSize);
            const y = Math.floor((py - tileSize / 2) / tileSize);
            if (x < 0 || y < 0 || x >= this.project.mapW || y >= this.project.mapH) return null;
            return { x, y };
        },

        onPreviewPointerDown(e) {
            if (e.button !== 0 && e.button !== 2) return;
            e.preventDefault();
            const cell = this.previewCell(e);
            if (!cell) return;
            this.previewPainting = true;
            this.previewValue = e.button === 2 ? 0 : 1;
            this.hoverCell = cell;
            this.paintPreviewCell(cell, this.previewValue);
            try {
                this.els.dsPreviewCanvas.setPointerCapture(e.pointerId);
            } catch (error) {
                // ignore
            }
        },

        onPreviewPointerMove(e) {
            const cell = this.previewCell(e);
            this.hoverCell = cell;
            if (this.previewPainting && cell) {
                this.paintPreviewCell(cell, this.previewValue);
            } else {
                this.schedulePreview();
            }
        },

        onPreviewPointerUp(e) {
            if (!this.previewPainting) return;
            this.previewPainting = false;
            this.schedulePreview();
            try {
                this.els.dsPreviewCanvas.releasePointerCapture(e.pointerId);
            } catch (error) {
                // ignore
            }
        },

        paintPreviewCell(cell, value) {
            const grid = this.activeGrid();
            if (!grid) return;
            const index = cell.y * this.project.mapW + cell.x;
            if (grid.cells[index] === value) return;
            grid.cells[index] = value;
            this.schedulePreview();
            this.markDirty();
        },

        randomiseMap() {
            const grid = this.activeGrid();
            if (!grid) return;
            grid.cells = grid.role === 'inner'
                ? Core.generateSparseMap(this.project.mapW, this.project.mapH, Date.now())
                : Core.generateBlobMap(this.project.mapW, this.project.mapH, Date.now());
            this.renderPreview();
            this.markDirty();
            this.notify('info', `Generated a new ${grid.role} test map`);
        },

        clearPreviewMap() {
            const grid = this.activeGrid();
            if (!grid) return;
            Core.clearMap(grid);
            this.renderPreview();
            this.markDirty();
        },

        fillPreviewMap() {
            const grid = this.activeGrid();
            if (!grid) return;
            Core.fillMap(grid);
            this.renderPreview();
            this.markDirty();
        },

        /* --------------------------------------------------------
           Grids / project
           -------------------------------------------------------- */

        selectGrid(id) {
            const grid = Core.getGrid(this.project, id);
            if (!grid) return;
            this.project.activeGridId = grid.id;
            this.ensureSelectedMask();
            this.renderAtlas();
            this.renderEditor();
            this.renderVariations();
            this.renderLayers();
            this.renderGridList();
            this.renderGridSettings();
            this.renderPreview();
            this.renderExportHint();
            this.updateFooter();
            this.markDirty();
        },

        onGridListClick(e) {
            const item = e.target.closest('.ds-grid-item');
            if (!item) return;
            const id = item.dataset.gridId;
            const eye = e.target.closest('[data-grid-eye]');
            if (eye) {
                e.preventDefault();
                const grid = Core.getGrid(this.project, id);
                if (!grid) return;
                grid.visible = !grid.visible;
                this.renderGridList();
                this.renderPreview();
                this.renderAtlasMeta();
                this.markDirty();
                return;
            }
            this.selectGrid(id);
        },

        addGrid() {
            const number = this.project.grids.length + 1;
            const grid = Core.createGrid({
                name: `Grid ${number}`,
                role: 'inner',
                mode: 9,
                size: this.tileSize(),
                mapW: this.project.mapW,
                mapH: this.project.mapH
            });
            this.project.grids.push(grid);
            this.project.activeGridId = grid.id;
            this.selectedMask = 15;
            this.renderAll();
            this.markDirty();
            this.notify('success', `Added ${grid.name}`);
        },

        duplicateGrid() {
            const source = this.activeGrid();
            if (!source) return;

            const copy = Core.createGrid({
                name: `${source.name} copy`,
                role: source.role,
                mode: source.mode,
                size: this.tileSize(),
                mapW: this.project.mapW,
                mapH: this.project.mapH
            });
            copy.visible = source.visible;
            copy.cells = new Uint8Array(source.cells);

            const size = this.tileSize();
            for (let mask = 0; mask < 16; mask++) {
                const variations = Core.getVariations(source, mask).map(tile => Core.cloneTile(tile, size));
                copy.variations[mask] = variations.length ? variations : [Core.createTile(size)];
                copy.activeVariation[mask] = Core.getActiveVariationIndex(source, mask);
                copy.tiles[mask] = copy.variations[mask][copy.activeVariation[mask]] || Core.createTile(size);
            }

            this.project.grids.push(copy);
            this.project.activeGridId = copy.id;
            this.ensureSelectedMask();
            this.renderAll();
            this.markDirty();
            this.notify('success', `Duplicated ${source.name}`);
        },

        deleteGrid() {
            if (this.project.grids.length <= 1) {
                this.notify('info', 'A design needs at least one grid');
                return;
            }
            const grid = this.activeGrid();
            if (!grid) return;
            if (!window.confirm(`Delete the grid “${grid.name}”? Its tiles will be lost.`)) return;

            this.project.grids = this.project.grids.filter(item => item.id !== grid.id);
            this.project.activeGridId = this.project.grids[0].id;
            this.selectedMask = 15;
            this.ensureSelectedMask();
            this.resetHistory();
            this.renderAll();
            this.markDirty();
            this.notify('info', `Deleted ${grid.name}`);
        },

        changeTileSize(size) {
            if (!Number.isFinite(size) || size < 4 || size > 256) return;
            if (size === this.tileSize()) return;

            this.project.grids.forEach(grid => {
                Core.resizeGridTiles(grid, size);
                grid._size = size;
            });
            this.project.tileSize = size;
            this.resetHistory();
            this.renderAll();
            this.markDirty();
            this.notify('success', `Resized tiles to ${size}×${size} px`);
        },

        /* --------------------------------------------------------
           Save / load
           -------------------------------------------------------- */

        markDirty() {
            if (this.els.dsSaveState) {
                this.els.dsSaveState.textContent = 'Unsaved';
                this.els.dsSaveState.classList.add('dirty');
            }
            this.scheduleAutosave();
        },

        scheduleAutosave() {
            clearTimeout(this.saveTimer);
            this.saveTimer = setTimeout(() => this.saveAutosave(), 700);
        },

        saveAutosave(sync) {
            if (!this.project) return;
            try {
                const data = Core.serializeProject(this.project);
                localStorage.setItem(Core.STORAGE_KEY, JSON.stringify(data));
                if (!sync && this.els.dsSaveState) {
                    this.els.dsSaveState.textContent = 'Saved';
                    this.els.dsSaveState.classList.remove('dirty');
                }
            } catch (error) {
                console.warn('Autosave failed', error);
                if (this.els.dsSaveState) {
                    this.els.dsSaveState.textContent = 'Storage full';
                    this.els.dsSaveState.classList.add('dirty');
                }
                if (!sync) this.notify('error', 'Browser storage is full. Save the project to a file.');
            }
        },

        async loadAutosave() {
            try {
                const raw = localStorage.getItem(Core.STORAGE_KEY);
                if (!raw) return false;
                const data = JSON.parse(raw);
                this.project = await Core.deserializeProject(data);
                return true;
            } catch (error) {
                console.warn('Could not load autosave', error);
                return false;
            }
        },

        saveProjectFile() {
            try {
                const data = Core.serializeProject(this.project);
                Core.downloadJSON(data, `${Core.safeFilename(this.project.name, 'dual-grid-project')}.dual-grid.json`);
                if (this.els.dsSaveState) {
                    this.els.dsSaveState.textContent = 'Saved';
                    this.els.dsSaveState.classList.remove('dirty');
                }
                this.notify('success', 'Project saved');
            } catch (error) {
                console.error(error);
                this.notify('error', 'Could not save the project');
            }
        },

        async onFileSelected(event) {
            const file = event.target.files && event.target.files[0];
            event.target.value = '';
            if (!file) return;

            try {
                const text = await file.text();
                const data = JSON.parse(text);
                const project = await Core.deserializeProject(data);
                this.project = project;
                this.selectedMask = project.selectedMask != null ? project.selectedMask : 15;
                this.ensureSelectedMask();
                this.resetHistory();
                this.renderAll();
                this.saveAutosave();
                this.notify('success', `Opened ${project.name}`);
            } catch (error) {
                console.error(error);
                this.notify('error', error.message || 'Could not open that project');
            }
        },

        openNewModal() {
            this.els.dsNewName.value = 'Untitled Design';
            this.openModal('dsNewModal');
            setTimeout(() => this.els.dsNewName.focus(), 60);
        },

        async createNewDesign() {
            const name = (this.els.dsNewName.value || '').trim() || 'Untitled Design';
            const starter = this.els.dsNewStarter.value;
            const theme = Core.THEMES[starter];
            this.project = starter === 'blank'
                ? Core.createBlankProject({ name })
                : Core.createSampleProject({ name, theme: theme ? theme.key : 'meadow' });

            this.selectedMask = 15;
            this.ensureSelectedMask();
            this.resetHistory();
            this.renderAll();
            this.saveAutosave();
            this.closeModal('dsNewModal');
            this.updateFooter();
            this.notify('success', starter === 'blank'
                ? 'Blank design created'
                : `${theme ? theme.title : 'Sample'} example created`);
        },

        /* --------------------------------------------------------
           Export
           -------------------------------------------------------- */

        exportOptions() {
            return {
                layout: this.els.dsExportLayout.value,
                variations: this.els.dsExportVariations.value,
                scale: parseInt(this.els.dsExportScale.value, 10) || 1,
                gap: parseInt(this.els.dsExportGap.value, 10) || 0,
                margin: parseInt(this.els.dsExportMargin.value, 10) || 0,
                transparent: this.els.dsExportTransparent.checked,
                background: this.els.dsExportBg.value || this.project.background
            };
        },

        exportActiveGrid() {
            const grid = this.activeGrid();
            if (!grid) return;
            const options = this.exportOptions();
            const rendered = Core.renderGridAtlas(this.project, grid, options);
            const filename = `${Core.safeFilename(this.project.name)}-${Core.safeFilename(grid.name)}-${rendered.layout.cols}x${rendered.layout.rows}.png`;
            Core.downloadCanvas(rendered.canvas, filename);
            const variationCols = rendered.layout.variationCols || 1;
            const maskCount = rendered.layout.masks.length;
            this.notify('success', `Exported ${rendered.layout.cols}×${rendered.layout.rows} atlas (${maskCount} masks${variationCols > 1 ? `, ${variationCols} variation columns` : ''})`);
        },

        async exportAllGrids() {
            const options = this.exportOptions();
            const grids = this.project.grids.slice();
            if (!grids.length) return;

            for (let i = 0; i < grids.length; i++) {
                const grid = grids[i];
                const rendered = Core.renderGridAtlas(this.project, grid, options);
                const filename = `${Core.safeFilename(this.project.name)}-${Core.safeFilename(grid.name)}-${rendered.layout.cols}x${rendered.layout.rows}.png`;
                Core.downloadCanvas(rendered.canvas, filename);
                if (i < grids.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 350));
                }
            }
            this.notify('success', `Exported ${grids.length} grid atlases. Allow multiple downloads if your browser asks.`);
        },

        exportCombinedSheet() {
            const options = this.exportOptions();
            const rendered = Core.renderCombinedSheet(this.project, this.project.grids, options);
            Core.downloadCanvas(rendered.canvas, `${Core.safeFilename(this.project.name)}-combined-sheet.png`);
            this.notify('success', 'Exported combined sheet');
        },

        exportProjectJson() {
            const data = Core.serializeProject(this.project);
            Core.downloadJSON(data, `${Core.safeFilename(this.project.name)}.dual-grid.json`);
            this.notify('success', 'Exported project JSON');
        },

        renderExportHint() {
            if (!this.els.dsExportHint) return;
            const layout = this.els.dsExportLayout.value;
            const grid = this.activeGrid();
            const mode = layout === 'auto' ? (grid ? grid.mode : 15) : Number(layout);
            const allVariations = this.els.dsExportVariations.value === 'all';
            this.els.dsExportHint.innerHTML = (mode === 9
                ? 'The 3×3 atlas contains the 9 outer-edge masks: corners, edges and fill.'
                : 'The 4×4 atlas contains all 16 masks; #0 is the base/background fill.') +
                (allVariations ? ' Variations are added as extra columns beside each mask.' : ' Only the active variation of each tile is exported.');
        },

        scrollToExport() {
            const button = this.els.dsExportActiveBtn;
            const section = button.closest('.ds-section');
            if (section) {
                section.scrollIntoView({ behavior: 'smooth', block: 'center' });
                section.style.transition = 'box-shadow 0.4s ease';
                section.style.boxShadow = 'inset 0 0 0 1px var(--green)';
                setTimeout(() => {
                    section.style.boxShadow = 'none';
                }, 900);
            }
        },

        /* --------------------------------------------------------
           Modals
           -------------------------------------------------------- */

        openModal(id) {
            const modal = document.getElementById(id);
            if (!modal) return;
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
        },

        closeModal(id) {
            const modal = document.getElementById(id);
            if (!modal) return;
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
        },

        closeAllModals() {
            document.querySelectorAll('.ds-modal-overlay.open').forEach(modal => {
                modal.classList.remove('open');
                modal.setAttribute('aria-hidden', 'true');
            });
        },

        /* --------------------------------------------------------
           Keyboard
           -------------------------------------------------------- */

        onKeyDown(e) {
            const tag = (document.activeElement && document.activeElement.tagName) || '';
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
                if (e.key === 'Escape') {
                    document.activeElement.blur();
                }
                return;
            }

            const ctrl = e.ctrlKey || e.metaKey;
            const key = e.key.toLowerCase();

            if (e.key === 'Escape') {
                this.closeAllModals();
                this.closeNeighbourPicker();
                this.drawing = false;
                this.previewPainting = false;
                return;
            }

            if (ctrl) {
                if (key === 'z') {
                    e.preventDefault();
                    e.shiftKey ? this.redo() : this.undo();
                    return;
                }
                if (key === 'y') {
                    e.preventDefault();
                    this.redo();
                    return;
                }
                if (key === 's') {
                    e.preventDefault();
                    this.saveProjectFile();
                    return;
                }
                if (key === 'o') {
                    e.preventDefault();
                    this.els.dsFileInput.click();
                    return;
                }
            }

            if (key === 'p') {
                this.setTool('pencil');
                e.preventDefault();
            } else if (key === 'b') {
                this.setTool('brush');
                e.preventDefault();
            } else if (key === 's') {
                this.setTool('spray');
                e.preventDefault();
            } else if (key === 'e') {
                this.setTool('eraser');
                e.preventDefault();
            } else if (key === 'g') {
                this.setTool('fill');
                e.preventDefault();
            } else if (key === 'i') {
                this.setTool('picker');
                e.preventDefault();
            } else if (key === '[') {
                this.setBrushSize(this.brushSize - 1);
                e.preventDefault();
            } else if (key === ']') {
                this.setBrushSize(this.brushSize + 1);
                e.preventDefault();
            } else if (key === 'x') {
                const previous = this.previousColor;
                this.previousColor = this.color;
                this.setColor(previous, true);
                e.preventDefault();
            } else if (/^[1-9]$/.test(key)) {
                const grid = this.activeGrid();
                if (!grid) return;
                const masks = grid.mode === 9 ? Core.MASKS_9 : Core.MASKS_15;
                const index = parseInt(key, 10) - 1;
                if (masks[index] != null) {
                    this.selectMask(masks[index]);
                    e.preventDefault();
                }
            }
        },

        /* --------------------------------------------------------
           Misc
           -------------------------------------------------------- */

        selectMask(mask) {
            const grid = this.activeGrid();
            if (!grid) return;
            if (grid.mode === 9 && !Core.SET_9.has(mask)) {
                this.notify('info', 'That tile is not part of the 9-tile set. Switch the grid to the 4×4 set to edit it.');
                return;
            }
            this.selectedMask = mask;
            this.project.selectedMask = mask;
            this.els.dsPasteTileBtn.disabled = !this.clipboardTile;

            this.els.dsAtlasGrid.querySelectorAll('.ds-atlas-cell').forEach(cell => {
                cell.classList.toggle('active', parseInt(cell.dataset.mask, 10) === mask);
            });
            const selectedVariations = Core.getVariations(grid, mask);
            const selectedVariation = Core.getActiveVariationIndex(grid, mask);
            const editingLabel = selectedVariations.length > 1
                ? `Editing · V${selectedVariation + 1}`
                : 'Editing';
            this.els.dsAtlasList.querySelectorAll('.ds-atlas-list-item').forEach(row => {
                const rowMask = parseInt(row.dataset.mask, 10);
                row.classList.toggle('active', rowMask === mask);
                const label = row.querySelector('.ds-atlas-list-label');
                if (label) label.textContent = rowMask === mask ? editingLabel : '';
            });

            this.renderEditor();
            this.renderVariations();
            this.renderLayers();
            this.markDirty();
        }
    };

    window.DualStudio = App;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => App.init());
    } else {
        App.init();
    }
})();
