# Importing from Microsoft Planner

Jotter includes a powerful, local-first **Microsoft Planner Importer** that allows you to easily migrate your existing boards and tasks from Microsoft Planner into Jotter. Your imported tasks are parsed on-the-fly and written as standard Markdown files.

---

## 📥 How to Export your Plan from Microsoft Planner

Before importing, you must export your plan from the official Microsoft Planner interface:

1. Open **Microsoft Planner** in your web browser.
2. Select the plan you want to export.
3. In the header menu, click the **"..." (More)** icon next to "Schedule".
4. Select **"Export plan to Excel"**.
5. Your browser will download a standard `.xlsx` spreadsheet file.

---

## 🚀 Running the Import Wizard in Jotter

To import your tasks:

1. Open Jotter.
2. Open the project where you want to import your tasks (or create a new project).
3. Click **"Import MS Planner"** in the sidebar.
4. Drag and drop your `.xlsx` file into the upload zone, or click **"Browse Files"** to select it.

---

## ⚙️ Configuration & Mappings

The wizard will guide you through mapping your Excel data to Jotter's native task model:

### 1. Sheet Selection (Multi-Sheet Workbooks)
Microsoft Planner exports can contain multiple sheets (such as localized data sheets).
* **Smart Auto-Detection**: Jotter automatically scans all sheet names and pre-selects the correct data sheet if it matches common names like `"Konsolidierte Daten"`, `"Consolidated Data"`, `"Tasks"`, or `"Aufgaben"`.
* **Manual Override**: If your sheet has a custom name, you can select it from the dropdown at the top of the mapping screen. Switching sheets instantly re-scans the headers and task rows.

### 2. Field Mappings
Jotter automatically maps your spreadsheet columns by searching for common English and German keywords. You can review or change these mappings:
* **Task Title** (matches `Aufgabenname`, `Task title`, `Title`, `Name`) &mdash; **Required**
* **Notes & Description** (matches `Notizen`, `Description`, `Notes`, `Body`)
* **Bucket Name** (matches `Eimer`, `Bucket name`, `Bucket`)
* **Status** (matches `Status`, `Progress`, `State`)
* **Priority** (matches `Priorität`, `Priority`)
* **Labels (Tags)** (matches `Bezeichnungen`, `Labels`, `Tags`)
* **Due Date** (matches `Fälligkeitsdatum`, `Due date`, `Due`, `Deadline`)
* **Start Date** (matches `Startdatum`, `Start date`, `Start`) &mdash; maps to Jotter's planned date
* **Checklist Items** (matches `Checklistenpunkte`, `Checklist`)

### 3. Destination Strategy
You can choose how tasks are distributed across your Jotter board columns:

* **Use Excel's Bucket name**: Create columns in Jotter named after your Planner buckets. Missing columns will be created automatically.
* **Map by Progress Status**: Place tasks in standard columns (`To Do`, `In Progress`, `Done`) based on the task's progress state.
* **Place all in a single column**: Disregard buckets and dump all imported tasks into a single column of your choice.

> [!NOTE]
> **Fallback Column**: If a task does not have a bucket name, it will be placed in the selected fallback column.

---

## ⚡ Completed Status Overrides (Eimer/Bucket Override)

In Microsoft Planner, completed tasks remain inside their original buckets but are marked as "Completed". In Jotter, completed tasks are moved to the unified **"Done"** column.

To maintain perfect compatibility, Jotter implements **Status Overrides**:
* **Order of Operations**: If you use the *Excel Bucket* strategy, Jotter **first** registers and creates the custom bucket (e.g. "Development") on your board to ensure your column structures match Planner.
* **Override Redirection**: It then checks the **Status** column. If the status indicates completion (such as `"Abgeschlossen"`, `"Completed"`, `"Done"`, or `"Erledigt"`), Jotter overrides the column setting and routes the task directly to Jotter's native **"Done"** column.
* **Preview and Logs**: During Step 3 (Preview), these tasks are displayed with their original bucket struck through (e.g. ~~Development~~ &rarr; `Done (Override)`). The live import logs will also clearly record these redirections.

---

## 📝 Markdown Conversions

During the import process, your spreadsheet cells are parsed and converted to fully compatible, Git-friendly Markdown format:

* **Priorities**: Planner priorities (*Dringend, Wichtig, Normal, Niedrig* / *Urgent, High, Medium, Low*) are translated into Jotter's internal tag metadata format.
* **Dates**: Excel serial or string date cells are converted cleanly to standard ISO dates (`YYYY-MM-DD`).
* **Tags**: Labels are split on semicolons or commas and appended as native Jotter tags.
* **Checklist Items**: If checklist items exist, they are parsed and appended to your task's description body as interactive GFM checkbox items:
  ```markdown
  ### Checklist
  - [ ] Research color palettes
  - [ ] Create CSS variables
  ```

---

## 🔒 Security & Local Processing

All parsing, sheet reading, and task creation execute **strictly client-side** inside your Jotter application sandbox. Your files are never uploaded to any cloud server, preserving Jotter's local-first privacy commitment.
