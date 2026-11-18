/* ============================================================
   Dual Grid Studio — focused dual tilemap editor UI
   ============================================================ */

(function () {
    'use strict';

    const Core = window.DualCore;
    const Notifications = window.Notifications;
    const PALETTE_KEY = 'pixelDualTilemaps:dual-studio:palette:v2';
    const RECENT_KEY = 'pixelDualTilemaps:dual-studio:recent:v2';

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
        mirrorX: false,
        mirrorY: false,
        showPixelGrid: true,
        showAllGrids: true,
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
            this.bindEvents();

            const loaded = await this.loadAutosave();
            if (!loaded) {
                this.project = Core.createSampleProject();
            }

            this.selectedMask = this.project.selectedMask || 15;
            this.ensureSelectedMask();
            this.renderAll();
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
                'dsMirrorX', 'dsMirrorY', 'dsShowPixelGrid', 'dsColorPicker', 'dsColorHex',
                'dsSaveColorBtn', 'dsPalette', 'dsRecentColors', 'dsAddLayerBtn', 'dsDuplicateLayerBtn',
                'dsDeleteLayerBtn', 'dsLayerOpacityWrap', 'dsLayerOpacity', 'dsLayerOpacityLabel', 'dsLayers',
                'dsAtlasGrid', 'dsAtlasSubtitle', 'dsAtlasBadges', 'dsEditorCanvas', 'dsEditorStage',
                'dsEditorTitle', 'dsEditorSubtitle', 'dsCopyTileBtn', 'dsPasteTileBtn', 'dsFlipHBtn',
                'dsFlipVBtn', 'dsClearTileBtn', 'dsMaskDiagram', 'dsMaskTitle', 'dsMaskBits',
                'dsCoords', 'dsTileInfo', 'dsPreviewCanvas', 'dsMiniPreviewCanvas', 'dsPreviewStage', 'dsPreviewHint',
                'dsRandomMapBtn', 'dsClearMapBtn', 'dsFillMapBtn', 'dsShowAllGrids', 'dsGridList',
                'dsAddGridBtn', 'dsGridName', 'dsGridRole', 'dsGridMode', 'dsTileSize',
                'dsDuplicateGridBtn', 'dsDeleteGridBtn', 'dsExportLayout', 'dsExportScale',
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
            els.dsMirrorX.addEventListener('change', (e) => this.mirrorX = e.target.checked);
            els.dsMirrorY.addEventListener('change', (e) => this.mirrorY = e.target.checked);
            els.dsShowPixelGrid.addEventListener('change', (e) => {
                this.showPixelGrid = e.target.checked;
                this.renderEditor();
            });

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
                if (!cell || cell.classList.contains('is-empty')) return;
                const mask = parseInt(cell.dataset.mask, 10);
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
            if (this.selectedMask === 0) this.selectedMask = 15;
            if (grid.mode === 9 && !Core.SET_9.has(this.selectedMask)) {
                this.selectedMask = 15;
            }
            if (!grid.tiles[this.selectedMask]) this.selectedMask = 15;
            this.project.selectedMask = this.selectedMask;
        },

        setFooter(text) {
            if (this.els.dsFooterStatus) this.els.dsFooterStatus.textContent = text;
        },

        updateFooter() {
            const grid = this.activeGrid();
            if (!grid) return;
            this.setFooter(`${grid.name} · ${grid.mode === 9 ? '9-tile' : '15-tile'} set · ${this.tileSize()} px tiles · preview ${this.project.mapW}×${this.project.mapH}`);
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

        editorPoint(e) {
            const canvas = this.els.dsEditorCanvas;
            const rect = canvas.getBoundingClientRect();
            const size = this.tileSize();
            const x = Math.floor((e.clientX - rect.left) / rect.width * size);
            const y = Math.floor((e.clientY - rect.top) / rect.height * size);
            return { x: Core.clamp(x, 0, size - 1), y: Core.clamp(y, 0, size - 1) };
        },

        onEditorPointerDown(e) {
            if (e.button !== 0 && e.button !== 2) return;
            e.preventDefault();

            const grid = this.activeGrid();
            const tile = this.activeTile();
            if (!grid || !tile) return;

            const point = this.editorPoint(e);
            this.updateCoords(point);

            if (this.tool === 'picker') {
                this.pickColor(point);
                return;
            }

            const erase = e.button === 2 || this.tool === 'eraser';

            if (this.tool === 'fill') {
                this.beginHistory();
                this.floodFill(tile, point, erase);
                this.commitHistory();
                this.afterTileChange();
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

            this.paintAt(point, erase);
            this.afterTileChange();
        },

        onEditorPointerMove(e) {
            const point = this.editorPoint(e);
            this.updateCoords(point);

            if (!this.drawing || e.pointerId !== this.activePointerId) return;
            // e.buttons can be 0 when a pointer leaves and re-enters; keep drawing
            // while the pointer is captured and the button started the stroke.
            if (e.buttons === 0 && e.pointerType === 'mouse') return;

            if (!this.lastPoint) {
                this.lastPoint = point;
            }

            this.strokeLine(this.lastPoint, point, this.strokeErase);
            this.lastPoint = point;
            this.afterTileChange();
        },

        onEditorPointerUp(e) {
            if (!this.drawing) return;
            this.drawing = false;
            this.lastPoint = null;
            this.activePointerId = null;
            this.commitHistory();
            this.afterTileChange();
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
            this.els.dsCoords.textContent = `${point.x}, ${point.y}`;
        },

        strokeLine(from, to, erase) {
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const steps = Math.max(Math.abs(dx), Math.abs(dy));
            if (steps === 0) {
                this.paintAt(to, erase);
                return;
            }
            for (let i = 1; i <= steps; i++) {
                this.paintAt({
                    x: Math.round(from.x + dx * (i / steps)),
                    y: Math.round(from.y + dy * (i / steps))
                }, erase);
            }
        },

        paintAt(point, erase) {
            const tile = this.activeTile();
            if (!tile) return;
            const layer = tile.layers[tile.activeLayer];
            if (!layer) return;

            if (!erase && !layer.visible) {
                layer.visible = true;
            }

            const size = this.tileSize();
            const ctx = layer.canvas.getContext('2d');
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
            };

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
        },

        floodFill(tile, point, erase) {
            const layer = tile.layers[tile.activeLayer];
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
            const tile = this.activeTile();
            if (!grid || !tile) return;
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

        afterTileChange() {
            const grid = this.activeGrid();
            if (!grid) return;
            Core.invalidateTile(grid, this.selectedMask);
            this.renderEditor();
            this.refreshAtlasThumb(this.selectedMask);
            this.schedulePreview();
            this.renderTileInfo();
            this.markDirty();
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

        beginHistory() {
            const grid = this.activeGrid();
            if (!grid) return;
            const tile = grid.tiles[this.selectedMask];
            if (!tile) return;
            this.pendingHistory = {
                gridId: grid.id,
                mask: this.selectedMask,
                before: this.snapshotTile(tile)
            };
        },

        commitHistory() {
            if (!this.pendingHistory) return;
            const entry = this.pendingHistory;
            this.pendingHistory = null;
            const grid = Core.getGrid(this.project, entry.gridId);
            if (!grid) return;
            const tile = grid.tiles[entry.mask];
            if (!tile) return;

            entry.after = this.snapshotTile(tile);
            this.undoStack.push(entry);
            if (this.undoStack.length > 60) this.undoStack.shift();
            this.redoStack = [];
            this.updateHistoryButtons();
        },

        undo() {
            const entry = this.undoStack.pop();
            if (!entry) return;
            const grid = Core.getGrid(this.project, entry.gridId);
            if (!grid) return;

            this.applyTileSnapshot(grid.tiles[entry.mask], entry.before);
            Core.invalidateTile(grid, entry.mask);
            this.redoStack.push(entry);

            this.project.activeGridId = grid.id;
            this.selectedMask = entry.mask;
            this.ensureSelectedMask();
            this.undoStack.length && this.updateHistoryButtons();
            this.renderAll();
            this.markDirty();
            this.notify('info', 'Undone');
        },

        redo() {
            const entry = this.redoStack.pop();
            if (!entry) return;
            const grid = Core.getGrid(this.project, entry.gridId);
            if (!grid) return;

            this.applyTileSnapshot(grid.tiles[entry.mask], entry.after);
            Core.invalidateTile(grid, entry.mask);
            this.undoStack.push(entry);

            this.project.activeGridId = grid.id;
            this.selectedMask = entry.mask;
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

            this.beginHistory();
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

            this.beginHistory();
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
            this.beginHistory();
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
            this.beginHistory();
            const layer = Core.createLayer(this.tileSize(), `Layer ${tile.layers.length + 1}`);
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

            this.beginHistory();
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
            if (tile.layers.length <= 1) {
                this.notify('info', 'A tile needs at least one layer');
                return;
            }
            this.beginHistory();
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
            this.beginHistory();
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
            this.renderEditor();
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
                if (mask === 0) cell.classList.add('is-empty');
                if (mask === this.selectedMask) cell.classList.add('active');

                const wrap = document.createElement('div');
                wrap.className = 'ds-atlas-canvas-wrap';

                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                wrap.appendChild(canvas);

                const indexBadge = document.createElement('span');
                indexBadge.className = 'ds-atlas-index';
                indexBadge.textContent = mask === 0 ? 'BG' : `#${mask}`;
                wrap.appendChild(indexBadge);

                if (mask !== 0) {
                    const bitDots = document.createElement('span');
                    bitDots.className = 'ds-atlas-bit-dots';
                    [1, 2, 4, 8].forEach(bit => {
                        const dot = document.createElement('i');
                        dot.className = mask & bit ? 'on' : '';
                        bitDots.appendChild(dot);
                    });
                    wrap.appendChild(bitDots);
                }

                const meta = document.createElement('div');
                meta.className = 'ds-atlas-meta';

                const name = document.createElement('span');
                name.className = 'ds-atlas-name';
                name.textContent = mask === 0 ? 'Background' : Core.MASK_SHORT[mask];
                name.title = Core.MASK_NAMES[mask];

                meta.appendChild(name);

                cell.appendChild(wrap);
                cell.appendChild(meta);
                gridEl.appendChild(cell);

                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                ctx.clearRect(0, 0, size, size);

                if (mask === 0) {
                    ctx.fillStyle = this.project.background || '#c99a63';
                    ctx.fillRect(0, 0, size, size);
                } else {
                    const tileCanvas = Core.getTileCanvas(grid, mask);
                    if (tileCanvas) ctx.drawImage(tileCanvas, 0, 0);
                }
            });

            this.renderAtlasMeta();
        },

        renderAtlasMeta() {
            const grid = this.activeGrid();
            if (!grid) return;
            const count = grid.mode === 9 ? 9 : 15;
            this.els.dsAtlasSubtitle.textContent =
                `${grid.name} · ${count} authored tiles · ${this.tileSize()} px` +
                (grid.mode === 9 ? ' · 9-tile set' : ' · 15-tile full set');

            this.els.dsAtlasBadges.innerHTML = '';
            const roleBadge = document.createElement('span');
            roleBadge.className = `ds-badge role-${grid.role}`;
            roleBadge.textContent = grid.role;
            const modeBadge = document.createElement('span');
            modeBadge.className = 'ds-badge';
            modeBadge.textContent = grid.mode === 9 ? '3×3 / 9' : '4×4 / 15';
            const visBadge = document.createElement('span');
            visBadge.className = 'ds-badge';
            visBadge.textContent = grid.visible ? 'preview on' : 'preview off';
            this.els.dsAtlasBadges.append(roleBadge, modeBadge, visBadge);
        },

        refreshAtlasThumb(mask) {
            const grid = this.activeGrid();
            if (!grid) return;
            const cell = this.els.dsAtlasGrid.querySelector(`.ds-atlas-cell[data-mask="${mask}"]`);
            if (!cell) return;
            const canvas = cell.querySelector('canvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const size = this.tileSize();
            ctx.clearRect(0, 0, size, size);
            if (mask === 0) {
                ctx.fillStyle = this.project.background || '#c99a63';
                ctx.fillRect(0, 0, size, size);
            } else {
                const tileCanvas = Core.getTileCanvas(grid, mask);
                if (tileCanvas) ctx.drawImage(tileCanvas, 0, 0);
            }
        },

        renderEditor() {
            const grid = this.activeGrid();
            const tile = this.activeTile();
            const size = this.tileSize();
            const canvas = this.els.dsEditorCanvas;
            const ctx = this.els.editorCtx;

            if (canvas.width !== size || canvas.height !== size) {
                canvas.width = size;
                canvas.height = size;
            }

            ctx.clearRect(0, 0, size, size);

            if (tile) {
                const composite = Core.compositeTile(tile, size);
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(composite, 0, 0);
            }

            if (this.showPixelGrid && size <= 64) {
                ctx.save();
                ctx.strokeStyle = 'rgba(235, 244, 255, 0.12)';
                ctx.lineWidth = 1;
                for (let i = 1; i < size; i++) {
                    ctx.beginPath();
                    ctx.moveTo(i + 0.5, 0);
                    ctx.lineTo(i + 0.5, size);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(0, i + 0.5);
                    ctx.lineTo(size, i + 0.5);
                    ctx.stroke();
                }
                ctx.restore();
            }

            this.renderTileInfo();
        },

        renderTileInfo() {
            const tile = this.activeTile();
            const mask = this.selectedMask;

            this.els.dsEditorTitle.textContent = `Tile #${mask} — ${Core.MASK_SHORT[mask]}`;
            this.els.dsEditorSubtitle.textContent = mask === 15
                ? 'Fully filled tile — used in the middle of a terrain chunk.'
                : `${Core.MASK_NAMES[mask]}. Draw the terrain in the highlighted corners.`;

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
                const visible = tile.layers.filter(layer => layer.visible).length;
                this.els.dsTileInfo.innerHTML =
                    `<strong>${this.tileSize()}×${this.tileSize()} px</strong> · ` +
                    `${tile.layers.length} layer${tile.layers.length === 1 ? '' : 's'} · ` +
                    `${visible} visible`;
            } else {
                this.els.dsTileInfo.textContent = '';
            }
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

            const activeLayer = tile.layers[tile.activeLayer] || tile.layers[0];
            const opacityValue = Math.round((activeLayer ? activeLayer.opacity : 1) * 100);
            this.els.dsLayerOpacity.value = opacityValue;
            this.els.dsLayerOpacityLabel.textContent = `${opacityValue}%`;

            tile.layers
                .map((layer, index) => ({ layer, index }))
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
                        if (!renderMask) continue;

                        const tileCanvas = Core.getTileCanvas(grid, renderMask);
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
            this.renderLayers();
            this.renderGridList();
            this.renderGridSettings();
            this.renderPreview();
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

            source.tiles.forEach((tile, mask) => {
                const clone = Core.createTile(this.tileSize());
                clone.activeLayer = tile.activeLayer;
                clone.layers = tile.layers.map(layer => {
                    const canvas = Core.makeCanvas(layer.canvas.width, layer.canvas.height);
                    canvas.getContext('2d').drawImage(layer.canvas, 0, 0);
                    return {
                        id: Core.uid(),
                        name: layer.name,
                        visible: layer.visible,
                        opacity: layer.opacity,
                        canvas
                    };
                });
                copy.tiles[mask] = clone;
            });

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
                this.selectedMask = project.selectedMask || 15;
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
            this.project = starter === 'blank'
                ? Core.createBlankProject({ name })
                : Core.createSampleProject({ name });

            this.selectedMask = 15;
            this.ensureSelectedMask();
            this.resetHistory();
            this.renderAll();
            this.saveAutosave();
            this.closeModal('dsNewModal');
            this.updateFooter();
            this.notify('success', `${starter === 'blank' ? 'Blank design' : 'Sample design'} created`);
        },

        /* --------------------------------------------------------
           Export
           -------------------------------------------------------- */

        exportOptions() {
            return {
                layout: this.els.dsExportLayout.value,
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
            this.notify('success', `Exported ${rendered.layout.cols}×${rendered.layout.rows} atlas (${rendered.layout.masks.length} cells)`);
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
            this.els.dsExportHint.innerHTML = mode === 9
                ? 'The 3×3 atlas contains the 9 outer-edge masks: corners, edges and fill. Unsupported inner-corner masks fall back to the fill tile at runtime.'
                : 'The 4×4 atlas contains 15 authored masks plus one background cell. Mask 0 is the empty/background slot.';
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
                this.notify('info', 'That tile is not part of the 9-tile set. Switch the grid to 15 tiles to edit it.');
                return;
            }
            if (mask === 0) {
                this.notify('info', 'The empty/background cell is not an editable tile');
                return;
            }
            this.selectedMask = mask;
            this.project.selectedMask = mask;
            this.els.dsPasteTileBtn.disabled = !this.clipboardTile;

            this.els.dsAtlasGrid.querySelectorAll('.ds-atlas-cell').forEach(cell => {
                cell.classList.toggle('active', parseInt(cell.dataset.mask, 10) === mask);
            });

            this.renderEditor();
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
