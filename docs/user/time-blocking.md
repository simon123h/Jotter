# Time Blocking Sidebar

The **Time Blocking** feature provides an interactive, daily schedule sidebar designed to help you structure focus periods and intentionally schedule tasks without leaving your Kanban board or task views.

---

## Overview

Time Blocking separates **time blocks** from **tasks**:
* A **Time Block** is an intentional block of focused time (e.g. *09:00–11:30 Deep Work*, *14:00–15:00 Sprint Code Reviews*).
* **Tasks** are slotted into these blocks via seamless click-to-allocate or drag-and-drop directly from your Kanban board, List, or Matrix views.
* Batch multiple tasks (or multi-selected tasks) into a single time block, check them off directly inside the block, or resize blocks in real-time.

```mermaid
flowchart LR
    A["Kanban Board / List View"] -->|Allocate Task(s)| B["Time Blocking Sidebar"]
    B --> C["Daily Schedule (06:00–18:00)"]
    C --> D["Direct Task Check-Off & Resize"]
```

---

## Key Features

### 1. Daily Schedule Sidebar
* **Toggle Anywhere**: Click the **Time Blocking** button in the top navigation bar to open or collapse the sidebar.
* **1-Click Day Navigation**: Easily switch days using the `<` and `>` buttons, the date picker, or jump directly back to **Today**.
* **Live Current-Time Highlight**: A glowing red line with a live time pill tracks the current time of day and auto-scrolls to your position.

### 2. Creating and Editing Time Blocks
* **Slot Click**: Click any empty hour slot on the daily grid to create a time block pre-filled with that time.
* **Click to Edit**: Click on any time block box to open its details dialog for editing title, times, accent color, or deletion.
* **Vibrant Accent Colors**: Choose from color presets (Red, Orange, Yellow, Green, Blue, Purple, Pink) matching the Task Card palette.

### 3. Task Allocation (Single & Multi-Select)
* Select tasks on the board, then click the **Add Tasks** (`+` / ListPlus) button on the header of any time block.
* Tasks scheduled in a time block for today automatically have their qualitative planned date updated to **Today**.
* Tasks can be completed right inside the time block with interactive checkboxes (`☑ / ☐`) or unallocated via the <kbd>×</kbd> button.

### 4. Drag-to-Move and Resize
* **Move Times**: Drag a time block up or down to adjust its start time with 15-minute snapping.
* **Resize Duration**: Drag the handle at the bottom edge of any time block to expand or shrink its duration.

---

## Configuration & Settings

Under **Settings → Time Blocking**, you can customize:
* **Schedule Start Hour**: Earliest visible hour on the grid (e.g. `6` or `8`).
* **Schedule End Hour**: Latest visible hour on the grid (e.g. `18` or `20`).
