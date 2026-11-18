# Dual Grid Studio

A focused browser tool for creating **dual-grid tilesets** and seeing them auto-tile
against their neighbours in real time. No build step, no dependencies — open
`index.html` in a modern browser.

![Dual grid](https://img.shields.io/badge/dual--grid-9%20%2F%2015%20tiles-7ee04a)
![No build](https://img.shields.io/badge/build-none-43d9ff)
![License](https://img.shields.io/badge/licence-see%20repo-ff4f9a)

## Why dual grids?

A dual grid places one output tile over every **corner** of the logical map. The four
logical cells around that corner form a 4-bit mask:

```
TL = 1   TR = 2
BL = 4   BR = 8
```

The tileset only needs one tile per mask, so a complete set is **15 corner masks** plus
an editable **#0 base fill** (the sample uses a brown dirt fill). A compact **9-tile**
set (four corners, four edges and the fill tile) is also supported for simpler
outer-edge terrains.

## Features

- **Tile atlas + large editor** — select any mask from a 3×3 or 4×4 atlas and draw it
  at its native pixel size. The canvas shows the centre tile at full opacity plus a
  compatible neighbour in each half-tile margin at 50% opacity, so seams are visible
  while drawing.
- **Compatible neighbour slots** — click the `#` label in any margin to load another
  tile that connects in that direction. Painting a margin seam edits that neighbour and
  syncs the shared edge back into the centre and every other compatible tile.
- **Zoomable canvas** — `−` / `+` / `Fit` controls, or `Ctrl/⌘ + wheel` over the editor.
- **Tabbed center workspace** — the Tile Editor and Neighbour Preview are separate
  tabs. Drag the splitter between the Tile Atlas and Tile Editor, or use **Focus
  editor** to expand the editor and minimise the atlas.
- **Expandable neighbour preview** — a dedicated toolbar can expand the preview across
  the workspace, export the active tileset PNG, and export per-group tile rules as
  Unity/Godot-friendly JSON.
- **Centre border toggle** — an optional thin dashed guide marks the centre tile and is
  off by default so it never looks like a seam in the artwork.
- **Tile variations** — every mask can have several variations. Duplicate the active
  variation, switch between chips, and the live preview picks variations stably by
  map position. Edits to an edge are propagated to every matching neighbour and to the
  other variations of the same mask.
- **Live neighbour preview** — the test map is rendered with the dual-grid algorithm
  on every stroke, so edges, outer corners and inner corners can be checked instantly.
  A compact live preview stays visible in the right sidebar.
- **Multiple grids per design** — add, duplicate, rename and delete grids. Each grid has
  its own tile atlas and test map. Roles (`outer`, `custom`, `inner`) control the preview
  order so an outer terrain can sit beneath an inner overlay.
- **Layers per tile** — add, duplicate, hide, rename and set opacity on tile layers.
- **Pixel tools** — pencil, brush, eraser, spray can, flood fill and eyedropper, with
  brush size, opacity, edge-wrap drawing, mirror X/Y and a pixel-grid overlay. The
  spray can keeps spraying while held, supports density and opacity-variation controls,
  and can dither through the current palette. Right-click with Spray to dither-erase, or
  enable **Spray erase** on the Eraser for a reverse spray can.
- **Seam sync** — with **Sync edges** on, drawing an edge copies it into every compatible
  neighbouring mask and every variation, so the atlas stays seamless automatically.
- **Undo / redo** for tile edits, sync changes and layer operations, including the
  variation that was edited.
- **Palette + recent colours**, persisted in browser storage. Import a palette from a
  Coolors URL or a list of hex colours using the import button in the Color panel.
- **Project save / open** — a single `.dual-grid.json` file contains every grid,
  variation, tile, layer and test map.
- **Autosave** to local storage.
- **PNG export** — active grid, all grids, or a combined sheet, with configurable
  scale, gap, margin, background, and active-only or all-variation export. Also exports
  the project JSON.
- **Tile-rule export** — the preview toolbar exports a rules JSON containing every
  group's mask-to-tile mapping, atlas coordinates and pixel rects for Unity or Godot.
- **Themed examples** — six procedural starter sets: Meadow & Wildflowers, Sand Dunes
  & Shells, Snowfield & Ice, Dungeon Floor & Moss, Pebble Beach & Foam, and
  Cobblestones & Puddles. Each includes its own tile art, inner overlay and test-map
  shape, inspired by the hand-drawn dual-grid reference credited below.

## Quick start

1. Open `index.html` directly, or serve the folder:
   ```bash
   python3 -m http.server 8080
   ```
   Then visit `http://localhost:8080`.
2. The sample design loads automatically. Choose **New → Starter** to load any of the
   themed examples. Click a tile in the atlas and draw in the large editor. Each
   half-tile margin shows a compatible neighbour at 50% opacity; click its `#` label
   to load another compatible tile into that slot.
3. Draw across a seam. With **Sync edges** on, compatible neighbour masks and all their
   variations receive the same edge pixels, including the `#0` base fill when it has art.
4. Watch the **Live Preview** in the right sidebar and the larger **Neighbour Preview**
   below the editor.
5. Use **New variation** to make alternate art for the selected mask. The preview mixes
   variations; **Export → Variations → All variations** exports them as extra columns.
6. Paint the test map with left-click (fill) and right-click (empty) to try different
   neighbour arrangements.
7. Use **Export active grid** for a PNG atlas.

## Export layouts

### 4×4 · 16 tiles

Masks are written in row-major order, mask `0` → `15`. Mask `0` is the editable
base/background fill used where all four map corners are empty (the sample paints it
as dirt). It is transparent when “Transparent” is enabled and the tile has not been
painted.

```
 0   1   2   3
 4   5   6   7
 8   9  10  11
12  13  14  15
```

### 3×3 · 9 tiles

The compact outer-edge set uses this order:

```
 1   3   2
 5  15  10
 4  12   8
```

The runtime falls back to the closest authored mask for inner-corner configurations
when a 9-tile set is used.

When **All variations** is selected in Export, each mask's variations are placed in
extra columns beside it. A mask with fewer variations leaves the extra columns blank.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `P` / `B` / `S` / `E` / `G` / `I` | Pencil / Brush / Spray / Eraser / Fill / Picker |
| `1`–`9` | Select an atlas slot |
| `[` / `]` | Decrease / increase brush size |
| `X` | Swap to the previous colour |
| `Ctrl/Cmd+Z` / `Ctrl/Cmd+Y` | Undo / redo |
| `Ctrl/Cmd+S` | Save project file |
| `Ctrl/Cmd+O` | Open project file |
| `Ctrl/Cmd + wheel` | Zoom the drawing canvas |
| `Esc` | Close modals / stop the current stroke |

## Project structure

The active application is intentionally small:

```
index.html
css/dual-studio.css
js/dual-core.js      # model, sample tileset, serialisation, export
js/dual-studio.js    # UI, drawing, preview, project/grid management
js/notifications.js  # toast notifications
```

Older editor modules remain in the repository but are not loaded by `index.html`.

## Sample & credit

The built-in sample and themed example tilesets are original procedural
interpretations based on the hand-drawn dual-grid reference image and technique
from:

**[Hand-drawn Dual Grid Tileset by Kaffe Medbulla](https://kaffemedbulla.itch.io/hand-drawn-dual-grid-tileset)**

Credit is also available from the footer, the Help dialog and the Credit panel. Each opens
an in-app Credits modal listing every sample tileset and the tech stack used. Exported
project JSON carries the same reference.

## Browser support

Chrome/Edge 90+, Firefox 90+, Safari 15+. The app uses Canvas 2D, pointer events,
`localStorage` and the File/Blob download APIs.
