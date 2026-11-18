/* ============================================================
   Dual Grid Studio — core model, sample tileset and export
   No DOM dependencies except canvas creation.
   ============================================================ */

window.DualCore = (function () {
    'use strict';

    const VERSION = 2;
    const FORMAT = 'dual-grid-studio';
    const STORAGE_KEY = 'pixelDualTilemaps:dual-studio:v2';
    const CREDIT = {
        label: 'Hand-drawn Dual Grid Tileset by Kaffe Medbulla',
        url: 'https://kaffemedbulla.itch.io/hand-drawn-dual-grid-tileset',
        note: 'Sample artwork is based on the reference image for the Hand-drawn Dual Grid Tileset by Kaffe Medbulla.'
    };

    /* ------------------------------------------------------------
       Mask sets
       Bits: TL = 1, TR = 2, BL = 4, BR = 8
       ------------------------------------------------------------ */

    const MASK = { TL: 1, TR: 2, BL: 4, BR: 8 };

    // 3×3 export layout: corners around the outside, edges on the sides, fill in the centre.
    const MASKS_9 = [1, 3, 2, 5, 15, 10, 4, 12, 8];
    const SET_9 = new Set(MASKS_9);

    // 4×4 export layout: mask 0..15 in row-major order.
    const MASKS_15 = Array.from({ length: 16 }, (_, i) => i);

    const MASK_NAMES = {
        0: 'Empty',
        1: 'Top-left corner',
        2: 'Top-right corner',
        3: 'Top edge',
        4: 'Bottom-left corner',
        5: 'Left edge',
        6: 'Diagonal · TR+BL',
        7: 'Inner corner · BR empty',
        8: 'Bottom-right corner',
        9: 'Diagonal · TL+BR',
        10: 'Right edge',
        11: 'Inner corner · BL empty',
        12: 'Bottom edge',
        13: 'Inner corner · TR empty',
        14: 'Inner corner · TL empty',
        15: 'Fill'
    };

    const MASK_SHORT = {
        0: 'Empty', 1: 'Top-left', 2: 'Top-right', 3: 'Top edge', 4: 'Bottom-left',
        5: 'Left edge', 6: 'Diagonal', 7: 'Inner BR', 8: 'Bottom-right', 9: 'Diagonal',
        10: 'Right edge', 11: 'Inner BL', 12: 'Bottom edge', 13: 'Inner TR',
        14: 'Inner TL', 15: 'Fill'
    };

    /* ------------------------------------------------------------
       Small utilities
       ------------------------------------------------------------ */

    function uid() {
        return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function makeCanvas(width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width));
        canvas.height = Math.max(1, Math.round(height));
        return canvas;
    }

    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = src;
        });
    }

    function hash(x, y, seed) {
        let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }

    function pick(list, index) {
        return list[index % list.length];
    }

    function popcount(value) {
        let n = value;
        let count = 0;
        while (n) {
            count += n & 1;
            n >>>= 1;
        }
        return count;
    }

    /* ------------------------------------------------------------
       Data model
       ------------------------------------------------------------ */

    function createLayer(size, name) {
        const canvas = makeCanvas(size, size);
        return {
            id: uid(),
            name: name || 'Layer 1',
            visible: true,
            opacity: 1,
            canvas
        };
    }

    function createTile(size) {
        return {
            layers: [createLayer(size, 'Base')],
            activeLayer: 0
        };
    }

    function createGrid(options) {
        const opts = options || {};
        const size = opts.size || 32;
        const mapW = opts.mapW || 24;
        const mapH = opts.mapH || 14;
        const grid = {
            id: opts.id || uid(),
            name: opts.name || 'Terrain',
            role: opts.role || 'outer',
            mode: opts.mode === 9 ? 9 : 15,
            visible: opts.visible !== false,
            tiles: Array.from({ length: 16 }, () => createTile(size)),
            cells: new Uint8Array(mapW * mapH),
            _size: size,
            tileset: null
        };
        grid.cache = new Map();
        return grid;
    }

    function createProject(options) {
        const opts = options || {};
        const size = opts.tileSize || 32;
        const mapW = opts.mapW || 24;
        const mapH = opts.mapH || 14;
        const project = {
            format: FORMAT,
            version: VERSION,
            name: opts.name || 'Untitled Design',
            tileSize: size,
            mapW,
            mapH,
            background: opts.background || '#c99a63',
            activeGridId: null,
            selectedMask: 15,
            grids: []
        };

        if (Array.isArray(opts.grids) && opts.grids.length) {
            project.grids = opts.grids;
        } else {
            const outer = createGrid({
                name: 'Outer Terrain', role: 'outer', mode: 15,
                size, mapW, mapH
            });
            project.grids.push(outer);
        }

        project.activeGridId = project.grids[0].id;
        return project;
    }

    function getGrid(project, gridId) {
        return project.grids.find(grid => grid.id === gridId) || project.grids[0] || null;
    }

    function getActiveGrid(project) {
        return getGrid(project, project.activeGridId);
    }

    function invalidateGrid(grid) {
        if (grid && grid.cache) grid.cache.clear();
    }

    function invalidateAll(project) {
        project.grids.forEach(invalidateGrid);
    }

    /* ------------------------------------------------------------
       Compositing
       ------------------------------------------------------------ */

    function compositeTile(tile, size) {
        const output = makeCanvas(size, size);
        const ctx = output.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        if (!tile || !Array.isArray(tile.layers)) return output;

        tile.layers.forEach(layer => {
            if (!layer.visible || !layer.canvas) return;
            ctx.save();
            ctx.globalAlpha = clamp(layer.opacity == null ? 1 : layer.opacity, 0, 1);
            ctx.drawImage(layer.canvas, 0, 0, size, size);
            ctx.restore();
        });

        return output;
    }

    function getTileCanvas(grid, mask) {
        if (!grid || mask === 0) return null;
        if (!grid.cache) grid.cache = new Map();
        if (grid.cache.has(mask)) return grid.cache.get(mask);

        const tile = grid.tiles[mask];
        if (!tile) return null;

        const composited = compositeTile(tile, tileSizeOf(grid));
        grid.cache.set(mask, composited);
        return composited;
    }

    function tileSizeOf(grid) {
        const first = grid && grid.tiles && grid.tiles[0];
        const canvas = first && first.layers && first.layers[0] && first.layers[0].canvas;
        return canvas ? canvas.width : 32;
    }

    function invalidateTile(grid, mask) {
        if (grid && grid.cache) grid.cache.delete(mask);
    }

    /**
     * A 3×3 grid only authors the 9 outer-edge masks. For the remaining
     * 16 dual-grid masks we fall back to the closest authored mask.
     */
    function resolveMask(grid, mask) {
        if (mask === 0) return 0;
        if (!grid || grid.mode !== 9) return mask;
        if (SET_9.has(mask)) return mask;

        let best = 15;
        let bestDistance = 99;
        MASKS_9.forEach(candidate => {
            const distance = popcount(candidate ^ mask);
            if (distance < bestDistance || (distance === bestDistance && candidate === 15)) {
                bestDistance = distance;
                best = candidate;
            }
        });
        return best;
    }

    /* ------------------------------------------------------------
       Map generation
       ------------------------------------------------------------ */

    function generateBlobMap(width, height, seed) {
        const cells = new Uint8Array(width * height);
        const s = (seed == null ? Math.random() * 1000 : seed) | 0;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const nx = x / Math.max(1, width - 1);
                const ny = y / Math.max(1, height - 1);
                const value =
                    Math.sin((nx * 3.4 + s * 0.013) * 6.2) +
                    Math.cos((ny * 2.8 - s * 0.017) * 5.1) +
                    Math.sin((nx + ny) * 4.6 + s * 0.01) * 0.8 +
                    Math.cos((nx - ny) * 3.8 - s * 0.008) * 0.7;
                cells[y * width + x] = value > 0.55 ? 1 : 0;
            }
        }

        // Guarantee at least one interesting chunk in the middle.
        if (!cells.some(Boolean)) {
            const cx = Math.floor(width / 2);
            const cy = Math.floor(height / 2);
            for (let y = cy - 3; y <= cy + 3; y++) {
                for (let x = cx - 5; x <= cx + 5; x++) {
                    if (x >= 0 && y >= 0 && x < width && y < height) {
                        cells[y * width + x] = 1;
                    }
                }
            }
        }

        return cells;
    }

    function generateSparseMap(width, height, seed) {
        const cells = new Uint8Array(width * height);
        const s = (seed == null ? Math.random() * 1000 : seed) | 0;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const cluster = hash(Math.floor(x / 2), Math.floor(y / 2), s) > 0.66;
                const speck = hash(x, y, s + 77) > 0.82;
                cells[y * width + x] = cluster && speck ? 1 : 0;
            }
        }
        return cells;
    }

    function clearMap(grid) {
        grid.cells.fill(0);
    }

    function fillMap(grid) {
        grid.cells.fill(1);
    }

    /* ------------------------------------------------------------
       Sample tileset
       Marks: base grass/dirt derived from the 4 quadrant bits.
       The sample is original procedural pixel art based on the
       hand-drawn dual-grid reference credited in the app.
       ------------------------------------------------------------ */

    const SAMPLE = {
        grass: ['#6fb63a', '#77c140', '#7dc947', '#69ae36'],
        grassLight: '#9ade58',
        grassDark: '#3f7a1f',
        grassDeep: '#2f5e18',
        dirt: ['#c99a63', '#d0a36d', '#c4935c', '#d6ac77'],
        dirtDark: '#a57645',
        dirtLight: '#e2bd88',
        flower: ['#ffd15c', '#ff90b3', '#fff1a8', '#d7a1ff', '#ffb45e']
    };

    function quadrantBit(mask, x, y, size) {
        const left = x < size / 2;
        const top = y < size / 2;
        if (top) return left ? MASK.TL : MASK.TR;
        return left ? MASK.BL : MASK.BR;
    }

    function isFilled(mask, x, y, size) {
        return (mask & quadrantBit(mask, x, y, size)) !== 0;
    }

    function paintSampleOuterTile(ctx, size, mask, seed) {
        const image = ctx.createImageData(size, size);
        const data = image.data;
        const filled = new Uint8Array(size * size);

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                filled[y * size + x] = isFilled(mask, x, y, size) ? 1 : 0;
            }
        }

        const at = (x, y) => (x >= 0 && y >= 0 && x < size && y < size ? filled[y * size + x] : 0);

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const index = y * size + x;
                const isGrass = filled[index] === 1;
                const h = hash(x, y, seed + mask * 31);
                let color;

                if (isGrass) {
                    color = pick(SAMPLE.grass, Math.floor(h * SAMPLE.grass.length));

                    // Dark seam along an internal grass/dirt boundary.
                    if (!at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1)) {
                        color = h > 0.82 ? SAMPLE.grassDark : SAMPLE.grassDeep;
                    } else if (!at(x - 2, y) || !at(x + 2, y) || !at(x, y - 2) || !at(x, y + 2)) {
                        color = h > 0.5 ? SAMPLE.grassLight : SAMPLE.grass[1];
                    } else if (h > 0.965) {
                        color = SAMPLE.grassLight;
                    }
                } else {
                    color = pick(SAMPLE.dirt, Math.floor(h * SAMPLE.dirt.length));

                    // Shadow and a few grass tufts spilling onto the dirt.
                    const touchesGrass = at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1);
                    if (touchesGrass && h > 0.48) {
                        color = SAMPLE.dirtDark;
                    } else if (touchesGrass && h > 0.3) {
                        color = SAMPLE.dirt[0];
                    } else if (h > 0.94) {
                        color = SAMPLE.dirtLight;
                    }

                    // Ragged grass fringe: a few 1px blades reach into the dirt.
                    if (touchesGrass && h > 0.86) {
                        color = SAMPLE.grassDark;
                    }
                }

                const rgb = hexToRgb(color);
                const p = index * 4;
                data[p] = rgb.r;
                data[p + 1] = rgb.g;
                data[p + 2] = rgb.b;
                data[p + 3] = 255;
            }
        }

        ctx.putImageData(image, 0, 0);

        // A couple of darker pebbles on the dirt areas.
        for (let i = 0; i < Math.max(1, Math.floor(size / 12)); i++) {
            const x = Math.floor(hash(i + 3, mask, seed + 9) * size);
            const y = Math.floor(hash(i + 11, mask, seed + 13) * size);
            if (!isFilled(mask, x, y, size)) {
                ctx.fillStyle = hash(x, y, seed + 21) > 0.5 ? SAMPLE.dirtDark : SAMPLE.dirtLight;
                ctx.fillRect(x, y, 1, 1);
                if (size >= 24 && hash(x, y, seed + 31) > 0.5) ctx.fillRect(x + 1, y, 1, 1);
            }
        }
    }

    function paintSampleInnerTile(ctx, size, mask, seed) {
        // Transparent overlay: mossy speckles and small flowers inside the filled quadrants.
        ctx.clearRect(0, 0, size, size);

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                if (!isFilled(mask, x, y, size)) continue;
                const h = hash(x, y, seed + mask * 17);
                if (h > 0.965) {
                    ctx.fillStyle = 'rgba(72, 120, 40, 0.55)';
                    ctx.fillRect(x, y, 1, 1);
                } else if (h > 0.9) {
                    ctx.fillStyle = 'rgba(255, 255, 210, 0.5)';
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }

        // Flower clusters, deterministic but organic.
        const clusterCount = Math.max(2, Math.round(size / 11));
        for (let i = 0; i < clusterCount; i++) {
            const cx = Math.floor(hash(i + 5, mask, seed + 3) * size);
            const cy = Math.floor(hash(i + 17, mask, seed + 7) * size);
            if (!isFilled(mask, cx, cy, size)) continue;

            const color = pick(SAMPLE.flower, Math.floor(hash(i, mask, seed + 11) * SAMPLE.flower.length));
            const blossom = Math.max(1, Math.round(size / 24));

            // stem
            if (cy + 1 < size) {
                ctx.fillStyle = 'rgba(46, 92, 26, 0.9)';
                ctx.fillRect(cx, cy + 1, 1, 1);
            }

            ctx.fillStyle = color;
            ctx.fillRect(cx, cy, blossom, blossom);
            if (blossom > 1) {
                ctx.fillStyle = 'rgba(255,255,255,0.55)';
                ctx.fillRect(cx, cy, 1, 1);
            }
        }
    }

    function paintSampleTiles(grid, kind, size) {
        grid.tiles.forEach((tile, mask) => {
            if (mask === 0) return;
            const layer = tile.layers[0];
            layer.canvas.width = size;
            layer.canvas.height = size;
            const ctx = layer.canvas.getContext('2d');
            const seed = kind === 'inner' ? 733 : 419;
            if (kind === 'inner') {
                paintSampleInnerTile(ctx, size, mask, seed);
            } else {
                paintSampleOuterTile(ctx, size, mask, seed);
            }
        });
        invalidateGrid(grid);
    }

    function createSampleProject(options) {
        const opts = options || {};
        const mapW = opts.mapW || 24;
        const mapH = opts.mapH || 14;
        const size = opts.tileSize || 32;
        const seed = opts.seed == null ? 2024 : opts.seed;

        const outer = createGrid({
            name: 'Meadow',
            role: 'outer',
            mode: 15,
            size,
            mapW,
            mapH
        });
        paintSampleTiles(outer, 'outer', size);
        outer.cells = generateBlobMap(mapW, mapH, seed);

        const inner = createGrid({
            name: 'Wildflowers',
            role: 'inner',
            mode: 9,
            size,
            mapW,
            mapH
        });
        paintSampleTiles(inner, 'inner', size);
        inner.cells = generateSparseMap(mapW, mapH, seed + 91);

        const project = createProject({
            name: opts.name || 'Meadow & Wildflowers — Sample',
            tileSize: size,
            mapW,
            mapH,
            background: SAMPLE.dirt[0]
        });
        project.grids = [outer, inner];
        project.activeGridId = outer.id;
        project.selectedMask = 15;
        return project;
    }

    function createBlankProject(options) {
        const opts = options || {};
        const size = opts.tileSize || 32;
        const mapW = opts.mapW || 24;
        const mapH = opts.mapH || 14;

        const outer = createGrid({
            name: 'Outer Terrain', role: 'outer', mode: 15, size, mapW, mapH
        });
        outer.cells = generateBlobMap(mapW, mapH, 91);

        const inner = createGrid({
            name: 'Inner Detail', role: 'inner', mode: 9, size, mapW, mapH
        });

        const project = createProject({
            name: opts.name || 'Untitled Design',
            tileSize: size,
            mapW,
            mapH,
            background: '#c99a63'
        });
        project.grids = [outer, inner];
        project.activeGridId = outer.id;
        project.selectedMask = 15;
        return project;
    }

    /* ------------------------------------------------------------
       Tile size / mode / resize
       ------------------------------------------------------------ */

    function resizeGridTiles(grid, newSize) {
        grid.tiles.forEach(tile => {
            tile.layers.forEach(layer => {
                const old = layer.canvas;
                const next = makeCanvas(newSize, newSize);
                const ctx = next.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                if (old && old.width && old.height) {
                    ctx.drawImage(old, 0, 0, old.width, old.height, 0, 0, newSize, newSize);
                }
                layer.canvas = next;
            });
        });
        invalidateGrid(grid);
    }

    function projectTileSize(project) {
        // Keep all grids on the same pixel size.
        const grid = getActiveGrid(project);
        return (grid && tileSizeOf(grid)) || project.tileSize || 32;
    }

    /* ------------------------------------------------------------
       Colour helpers
       ------------------------------------------------------------ */

    function hexToRgb(hex) {
        let value = (hex || '').replace('#', '').trim();
        if (value.length === 3) {
            value = value.split('').map(ch => ch + ch).join('');
        }
        if (!/^[0-9a-f]{6}$/i.test(value)) return { r: 0, g: 0, b: 0 };
        const int = parseInt(value, 16);
        return {
            r: (int >> 16) & 255,
            g: (int >> 8) & 255,
            b: int & 255
        };
    }

    function rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
    }

    /* ------------------------------------------------------------
       Serialisation
       ------------------------------------------------------------ */

    function serializeProject(project) {
        return {
            format: FORMAT,
            version: VERSION,
            name: project.name,
            tileSize: project.tileSize,
            mapW: project.mapW,
            mapH: project.mapH,
            background: project.background,
            activeGridId: project.activeGridId,
            selectedMask: project.selectedMask,
            credit: CREDIT,
            grids: project.grids.map(grid => ({
                id: grid.id,
                name: grid.name,
                role: grid.role,
                mode: grid.mode,
                visible: grid.visible !== false,
                cells: Array.from(grid.cells),
                tiles: grid.tiles.map((tile, mask) => ({
                    mask,
                    activeLayer: tile.activeLayer || 0,
                    layers: tile.layers.map(layer => ({
                        id: layer.id,
                        name: layer.name,
                        visible: layer.visible !== false,
                        opacity: layer.opacity == null ? 1 : layer.opacity,
                        data: layer.canvas.toDataURL('image/png')
                    }))
                }))
            }))
        };
    }

    async function deserializeProject(data) {
        if (!data || data.format !== FORMAT) {
            throw new Error('This does not look like a Dual Grid Studio project.');
        }

        const size = clamp(Number(data.tileSize) || 32, 4, 256);
        const mapW = clamp(Number(data.mapW) || 24, 4, 128);
        const mapH = clamp(Number(data.mapH) || 14, 4, 128);

        const project = createProject({
            name: data.name || 'Untitled Design',
            tileSize: size,
            mapW,
            mapH,
            background: data.background || '#c99a63'
        });
        project.grids = [];
        project.mapW = mapW;
        project.mapH = mapH;

        const gridInputs = Array.isArray(data.grids) ? data.grids : [];
        for (const gridData of gridInputs) {
            const grid = createGrid({
                id: gridData.id || uid(),
                name: gridData.name || 'Terrain',
                role: ['outer', 'inner', 'custom'].includes(gridData.role) ? gridData.role : 'outer',
                mode: gridData.mode === 9 ? 9 : 15,
                visible: gridData.visible !== false,
                size,
                mapW,
                mapH
            });

            grid.cache = new Map();

            if (Array.isArray(gridData.cells)) {
                const length = Math.min(grid.cells.length, gridData.cells.length);
                for (let i = 0; i < length; i++) {
                    grid.cells[i] = gridData.cells[i] ? 1 : 0;
                }
            }

            const tileInputs = Array.isArray(gridData.tiles) ? gridData.tiles : [];
            for (const tileData of tileInputs) {
                const mask = Number(tileData.mask);
                if (!Number.isInteger(mask) || mask < 0 || mask > 15) continue;
                const tile = createTile(size);
                tile.activeLayer = clamp(Number(tileData.activeLayer) || 0, 0, 127);
                tile.layers = [];

                const layerInputs = Array.isArray(tileData.layers) ? tileData.layers : [];
                for (const layerData of layerInputs) {
                    const layer = createLayer(size, layerData.name || 'Layer');
                    layer.id = layerData.id || uid();
                    layer.visible = layerData.visible !== false;
                    layer.opacity = layerData.opacity == null ? 1 : clamp(Number(layerData.opacity), 0, 1);

                    if (layerData.data) {
                        try {
                            const image = await loadImage(layerData.data);
                            const ctx = layer.canvas.getContext('2d');
                            ctx.imageSmoothingEnabled = false;
                            ctx.clearRect(0, 0, size, size);
                            ctx.drawImage(image, 0, 0, size, size);
                        } catch (error) {
                            // Keep the blank layer if the image fails.
                        }
                    }
                    tile.layers.push(layer);
                }

                if (!tile.layers.length) tile.layers = [createLayer(size, 'Base')];
                tile.activeLayer = Math.min(tile.activeLayer, tile.layers.length - 1);
                grid.tiles[mask] = tile;
            }

            grid._size = size;
            project.grids.push(grid);
        }

        if (!project.grids.length) {
            project.grids.push(createGrid({ name: 'Outer Terrain', role: 'outer', mode: 15, size, mapW, mapH }));
        }

        const requestedGrid = project.grids.find(grid => grid.id === data.activeGridId);
        project.activeGridId = requestedGrid ? requestedGrid.id : project.grids[0].id;
        project.selectedMask = clamp(Number(data.selectedMask) || 15, 1, 15);

        return project;
    }

    /* ------------------------------------------------------------
       Export
       ------------------------------------------------------------ */

    function getLayout(project, grid, layoutOption) {
        const mode = layoutOption === 'auto' || !layoutOption
            ? grid.mode
            : Number(layoutOption);
        const isNine = mode === 9;
        return {
            mode: isNine ? 9 : 15,
            cols: isNine ? 3 : 4,
            rows: isNine ? 3 : 4,
            masks: isNine ? MASKS_9.slice() : MASKS_15.slice()
        };
    }

    function renderGridAtlas(project, grid, options) {
        const opts = options || {};
        const layout = getLayout(project, grid, opts.layout || 'auto');
        const scale = clamp(Number(opts.scale) || 1, 1, 16);
        const tileSize = projectTileSize(project);
        const drawSize = tileSize * scale;
        const gap = clamp(Number(opts.gap) || 0, 0, 128);
        const margin = clamp(Number(opts.margin) || 0, 0, 256);
        const transparent = opts.transparent !== false;

        const width = margin * 2 + layout.cols * drawSize + (layout.cols - 1) * gap;
        const height = margin * 2 + layout.rows * drawSize + (layout.rows - 1) * gap;

        const canvas = makeCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        if (!transparent) {
            ctx.fillStyle = opts.background || project.background || '#c99a63';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        layout.masks.forEach((mask, index) => {
            if (mask === 0) return;

            const col = index % layout.cols;
            const row = Math.floor(index / layout.cols);
            const x = margin + col * (drawSize + gap);
            const y = margin + row * (drawSize + gap);

            const tileCanvas = compositeTile(grid.tiles[mask], tileSize);
            ctx.drawImage(tileCanvas, 0, 0, tileSize, tileSize, x, y, drawSize, drawSize);
        });

        return {
            canvas,
            layout,
            drawSize,
            tileSize,
            width,
            height
        };
    }

    function renderCombinedSheet(project, grids, options) {
        const opts = options || {};
        const scale = clamp(Number(opts.scale) || 1, 1, 16);
        const gap = clamp(Number(opts.gap) || 0, 0, 128);
        const margin = clamp(Number(opts.margin) || 0, 0, 256);
        const transparent = opts.transparent !== false;
        const between = Math.max(4, Math.round(4 * scale));

        const rendered = grids.map(grid => renderGridAtlas(project, grid, opts));
        const width = Math.max.apply(null, rendered.map(item => item.width)) + margin * 2;
        const height = margin * 2 + rendered.reduce((sum, item) => sum + item.height, 0) + between * Math.max(0, rendered.length - 1);

        const canvas = makeCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        if (!transparent) {
            ctx.fillStyle = opts.background || project.background || '#c99a63';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        let y = margin;
        rendered.forEach(item => {
            ctx.drawImage(item.canvas, margin, y);
            y += item.height + between;
        });

        return { canvas, width, height };
    }

    function downloadCanvas(canvas, filename) {
        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        link.remove();
    }

    function safeFilename(value, fallback) {
        const cleaned = String(value || '')
            .trim()
            .replace(/[^a-z0-9-_]+/gi, '-')
            .replace(/^-+|-+$/g, '');
        return cleaned || fallback || 'dual-grid';
    }

    function downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = filename;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    return {
        VERSION,
        FORMAT,
        STORAGE_KEY,
        CREDIT,
        MASK,
        MASKS_9,
        MASKS_15,
        SET_9,
        MASK_NAMES,
        MASK_SHORT,
        SAMPLE,
        uid,
        clamp,
        makeCanvas,
        loadImage,
        hash,
        createLayer,
        createTile,
        createGrid,
        createProject,
        createSampleProject,
        createBlankProject,
        getGrid,
        getActiveGrid,
        getTileCanvas,
        compositeTile,
        invalidateGrid,
        invalidateTile,
        invalidateAll,
        resolveMask,
        generateBlobMap,
        generateSparseMap,
        clearMap,
        fillMap,
        resizeGridTiles,
        projectTileSize,
        tileSizeOf,
        paintSampleTiles,
        hexToRgb,
        rgbToHex,
        serializeProject,
        deserializeProject,
        getLayout,
        renderGridAtlas,
        renderCombinedSheet,
        downloadCanvas,
        downloadJSON,
        safeFilename
    };
})();
