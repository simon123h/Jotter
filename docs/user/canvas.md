# 2D Infinite Canvas

Jotter includes a full-featured, infinite 2D visual canvas that allows you to spatially organize, map, connect, and brainstorm tasks and notes alongside your traditional Kanban board.

Canvases are stored in your project's `canvases/` directory as standard JSON files compatible with the **Obsidian Canvas 1.0 JSON format** (`<name>.canvas`), ensuring zero data lock-in and direct inter-operability with PKM tools.

---

## Accessing the Canvas

1. Navigate to any project in Jotter.
2. In the top navigation / view switcher, select the **Canvas** tab.
3. Your canvas loads automatically. If no canvas exists yet, Jotter creates `main.canvas` for you.

---

## Interacting with the Board

### Navigation & Modes
You can navigate the infinite board using two interaction modes:
* **Pan Mode (`Hand` icon)**: Drag anywhere on the empty canvas to pan around.
* **Select / Marquee Mode (`MousePointer` icon)**: Click and drag a selection rectangle across the canvas to select multiple nodes simultaneously.

> [!TIP] Keyboard Shortcuts
> * Press <kbd>V</kbd> to quickly toggle between **Pan Mode** and **Select Mode**.
> * When in Select Mode, hold down <kbd>Space</kbd> while dragging with the mouse to temporarily pan the canvas.
> * Use mouse wheel to zoom in and out, or pinch to zoom on trackpads.
> * When switching between canvases or loading the page, Jotter automatically focuses and zooms to fit all existing content onto your screen.

---

## Canvas Elements

The Canvas supports three types of nodes, plus visual arrows:

### 1. Task Cards
* Open the **Tasks Drawer** on the right side of the toolbar.
* Drag any unplaced task card directly from the drawer onto the canvas.
* Task cards mirror your Kanban board items: title, status indicator, priority, tags, checklist progress, and color badge.
* You can drag tasks around, connect them to other tasks or notes, and select them for bulk actions.

### 2. Markdown Notes (`Add Text`)
* Click the **Add Text** button in the toolbar. A new markdown note is placed directly in the center of your current view.
* Double-click a note to edit its content in Markdown. Click outside or press the checkmark to save.
* Click the palette icon in the node header to choose a color accent for the note.
* Drag the resize handles on the edges or corners to adjust its dimensions.

### 3. Groups / Sections (`Add Group`)
* Click the **Add Group** button in the toolbar. A new group section is placed in the center of your current view.
* Double-click the group title to rename it.
* Click the palette icon to assign a color to the group border and background.
* Drag the resize handles on the borders to resize the group around related tasks or notes. Groups render behind tasks and notes so you can visually cluster topics.

### 4. Connection Arrows & Connectors
* Hover over any node to reveal its 4 connection handles (Top, Right, Bottom, Left).
* Drag from any handle to another node's handle to draw a connecting arrow.
* Click on an arrow to select it:
  * Change arrow color via the palette in the floating toolbar.
  * Adjust arrowheads: choose one-way, bidirectional, or no arrowheads.
  * Click the reverse button to switch arrow direction.
  * Add a label to the edge to clarify relationships (e.g., "blocks", "depends on", "relates to").

---

## Deleting Elements

* To delete an arrow, select it and press <kbd>Delete</kbd> or <kbd>Backspace</kbd>.
* To delete notes, groups, or task nodes from the canvas, select them and press <kbd>Delete</kbd> or <kbd>Backspace</kbd>.
* *Note: Deleting a task node from the canvas simply unplaces it from the canvas board; it does not delete the task file from your project.* Unplaced tasks remain accessible in your Kanban board and can be re-added via the Tasks Drawer at any time.

---

## Obsidian Canvas Interoperability

Jotter saves your canvases directly into the `canvases/` folder of your project as `.canvas` JSON files compliant with the open specification:

```json
{
  "nodes": [
    {
      "id": "c1f7a8b9",
      "type": "file",
      "file": "01HJKM7ST89AB234CDEFGHJKMN.md",
      "x": 200,
      "y": 100,
      "width": 280,
      "height": 140
    },
    {
      "id": "e4b2d10a",
      "type": "text",
      "text": "Brainstorming and architecture notes",
      "x": 540,
      "y": 100,
      "width": 260,
      "height": 160,
      "color": "3"
    }
  ],
  "edges": [
    {
      "id": "edge-1234",
      "fromNode": "c1f7a8b9",
      "fromSide": "right",
      "toNode": "e4b2d10a",
      "toSide": "left",
      "toEnd": "arrow"
    }
  ]
}
```

If your Jotter project is located inside an **Obsidian vault**, you can open and edit the exact same `.canvas` file directly in Obsidian's native Canvas view without any conversion!
