# Time Boxing Sidebar

The **Time Boxing** feature provides an interactive, daily schedule sidebar designed to help you structure focus periods and intentionally schedule tasks without leaving your Kanban board or task views.

---

## Overview

Time Boxing separates **time containers (boxes)** from **tasks**:
* A **Timebox** is an intentional block of focused time (e.g. *09:00–11:30 Deep Work*, *14:00–15:00 Sprint Code Reviews*).
* **Tasks** are slotted into these boxes via seamless drag-and-drop directly from your Kanban board, List, or Matrix views.
* Batch multiple tasks (or multi-selected tasks) into a single timebox, check them off directly inside the box, or resize boxes in real-time.

```mermaid
flowchart LR
    A["Kanban Board / List View"] -->|Drag Task(s)| B["Timebox Sidebar"]
    B --> C["Daily Schedule (08:00–18:00)"]
    C --> D["Direct Task Check-Off & Resize"]
```

---

## Key Features

### 1. Daily Schedule Sidebar
* **Toggle Anywhere**: Click the **Time Boxing** button in the top navigation bar to open or collapse the sidebar.
* **1-Click Day Navigation**: Easily switch days using the `<` and `>` buttons, the date picker, or jump directly back to **Today**.
* **Live Current-Time Highlight**: A glowing red line with a live time pill tracks the current time of day and auto-scrolls to your position.

### 2. Creating and Editing Timeboxes
* **Slot Click**: Click any empty hour slot on the daily grid to create a timebox pre-filled with that time.
* **Header Button**: Use the **+ New Timebox** button at the top of the sidebar.
* **Random Color Presets**: Automatically assigned vibrant accents on creation (Blue, Emerald, Amber, Rose, Teal, Indigo, Purple, Slate).

### 3. Drag-and-Drop Task Allocation (Single & Multi-Select)
* Drag any task card from your Kanban board, List view, or Matrix directly onto a timebox in the sidebar.
* **Multi-Selection Support**: Select multiple tasks on the board and drag them all together into a timebox in one drop!
* Tasks can be completed right inside the timebox with interactive checkboxes (`☑ / ☐`) or unallocated via the <kbd>×</kbd> button.

### 4. Drag-to-Move and Resize
* **Move Times**: Drag a timebox up or down to adjust its start time with 15-minute snapping.
* **Resize Duration**: Drag the handle at the bottom edge of any timebox to expand or shrink its duration.

---

## Configuration & Settings

Under **Settings → Time Boxing**, you can customize:
* **Calendar Start Hour**: Earliest visible hour on the grid (e.g. `7` or `8`).
* **Calendar End Hour**: Latest visible hour on the grid (e.g. `18` or `20`).
