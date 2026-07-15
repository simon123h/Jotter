# Importing & Exporting Data

Jotter includes powerful, local-first spreadsheet utilities that allow you to seamlessly import tasks from any standard Excel or CSV table, as well as export your current filtered task views. All processing is executed strictly client-side inside Jotter, keeping your data private.

---

## 📥 Spreadsheet Importer (Excel & CSV)

Jotter features a flexible, step-by-step import wizard that lets you migrate boards and tasks from Microsoft Planner, other task managers, or custom spreadsheets.

### 🚀 Running the Import Wizard

1. Open Jotter and select the project where you want to import your tasks.
2. Click **"Import Excel/CSV"** in the sidebar.
3. Drag and drop your `.xlsx` or `.csv` file into the upload zone, or click **"Browse Files"** to select it.

### ⚙️ Steps and Configuration

#### 1. Sheet Selection
If you upload an Excel workbook (`.xlsx`) containing multiple sheets, you can select which sheet to import from using the dropdown. 
* *Smart Auto-Detection*: Jotter scans sheet names on load and automatically pre-selects names matching common task patterns like `"Tasks"`, `"Aufgaben"`, `"Consolidated Data"`, etc.

#### 2. Field & Column Mapping
Jotter automatically maps your spreadsheet columns to Jotter's native task model by searching for common English and German keywords. You can review or adjust these mappings:
* **Task Title** (matches `Title`, `Task title`, `Name`, `Aufgabenname`) &mdash; **Required**
* **Notes & Description** (matches `Description`, `Notes`, `Notizen`, `Body`)
* **Bucket/Column Name** (matches `Bucket`, `Eimer`, `Column`, `Status`)
* **Priority** (matches `Priority`, `Priorität`) &mdash; mapped to priority tags (`urgent`, `high`, `medium`, `low`)
* **Labels/Tags** (matches `Tags`, `Labels`, `Bezeichnungen`) &mdash; splits on commas or semicolons
* **Due Date** (matches `Due date`, `Due`, `Fälligkeitsdatum`)
* **Start Date** (matches `Start date`, `Start`, `Startdatum`) &mdash; mapped to Jotter's planned date
* **Checklist** (matches `Checklist`, `Checklistenpunkte`) &mdash; parses checklist items into GFM checklist formatting in the body

#### 3. Destination Strategy
Choose how tasks should be distributed across your board:
* **Use Excel's Bucket name**: Creates columns in Jotter named after your spreadsheet's bucket column. Missing columns are created automatically.
* **Map by Progress Status**: Places tasks in standard columns (`To Do`, `In Progress`, `Done`) based on the progress status column.
* **Place all in a single column**: Dumps all imported tasks into a single column of your choice.

#### 4. Preview and Confirm
Before writing anything to disk, Jotter presents a detailed, interactive row-by-row preview:
* Tasks with validation errors (e.g. missing title) are flagged and will be skipped.
* Completed tasks automatically show their destination column overridden to Jotter's native **Done** column (e.g., ~~Marketing~~ &rarr; `Done (Override)`).
* Click **Import Tasks** to compile and write the tasks as standard Markdown files.

---

## 📤 Spreadsheet Exporter (Excel & CSV)

Jotter allows you to export your tasks directly from your current view as a `.xlsx` Excel sheet or `.csv` text file.

### 🚀 Running the Export

1. Navigate to the view (Board, List, Matrix, Tag, Time, or Triage) and apply any project filter, search queries, or advanced filters.
2. Click the **More Options** (three vertical dots `...`) button next to the view selection controls in the top toolbar.
3. Select either **Export to Excel (.xlsx)** or **Export to CSV (.csv)**.
4. Your browser/app will compile the sheet client-side and trigger a local file download.

### 📊 Exported Columns
The exported sheet contains all relevant task metadata structured in the following columns:
* **ID**: Jotter's internal task filename/identifier.
* **Title**: The task's title.
* **Description**: The full task description body (with markdown formatting).
* **Column**: The active Kanban bucket/column name where the task resides.
* **Priority**: The priority level (`urgent`, `high`, `medium`, `low`, or `normal`).
* **Tags**: A semicolon-separated list of tags.
* **Start Date / Due Date**: Date values formatted cleanly as `YYYY-MM-DD`.
* **Project**: The parent project's name.

---

## 🔒 Security & Local Processing
All spreadsheet reading, column mapping, and file conversions run **100% locally** in your browser/app container. No data is sent to external servers.
