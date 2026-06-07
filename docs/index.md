---
layout: home

hero:
  name: "Jotter"
  text: "Local-First Kanban Board"
  tagline: "Combat task flooding while retaining 100% data ownership."
  image:
    src: /logo.png
    alt: Jotter Logo
  actions:
    - theme: brand
      text: Get Started
      link: /installation/precompiled
    - theme: alt
      text: Developer Docs
      link: /developer/architecture
    - theme: alt
      text: 🚀 Live Demo
      link: /demo/
      target: _blank

features:
  - icon: 🔐
    title: Data Sovereignty
    details: Tasks are stored locally as human-readable Markdown files on your own device. Your data remains yours, forever.
  - icon: 🌊
    title: Anti-Task-Flooding
    details: Offers comprehensive filtering, views and power user tools to battle task overwhelm.
  - icon: ⚡
    title: Built for Speed
    details: An local SQLite-based index delivers instant drag-and-drop, filter, and search operations.
  - icon: 🖧
    title: Git Sync
    details: Projects can be synced with Git repositories, allowing for multi-device support or team sharing.
---

<div class="markdown-feature-container">
  <div class="markdown-feature-header">
    <h2>Markdown-Native Power</h2>
    <p class="subtitle">Your tasks are just plain text Markdown. Beautifully structured, infinitely extensible, and 100% yours.</p>
  </div>
  <div class="markdown-feature-grid">
    <div class="markdown-feature-card info-card">
      <h3>The Best of Both Worlds</h3>
      <p>Jotter is not just a Kanban board that exports to Markdown — it is a <strong>direct visual interface</strong> for your Markdown files. Every drag-and-drop, label change, or column movement edits your files in real time.</p>
      <ul class="feature-checklist">
        <li><strong>Zero Proprietary Lock-in:</strong> Open and edit your files in Obsidian, VS Code, Logseq, or any basic text editor.</li>
        <li><strong>Standard GFM Checklists:</strong> Your subtasks map directly to standard checkbox items.</li>
        <li><strong>Frontmatter & Metadata:</strong> Due dates, priority levels, and custom tags are stored cleanly in the standard YAML header.</li>
        <li><strong>Comments & Content Preserved:</strong> Detailed descriptions, links, and nested notes are fully preserved.</li>
      </ul>
      <a class="feature-link" href="./user/format-spec">Explore the File Spec →</a>
    </div>
    <div class="markdown-feature-card visual-card">
      <div class="panel-tabs-container">
        <input type="radio" id="tab-markdown" name="view-selector" checked style="display:none;" />
        <input type="radio" id="tab-kanban" name="view-selector" style="display:none;" />
        <div class="panel-tabs">
          <label for="tab-markdown" class="tab-btn tab-btn-markdown">📝 task_item.md</label>
          <label for="tab-kanban" class="tab-btn tab-btn-kanban">📋 Kanban Card</label>
        </div>
        <div class="panel-content">
          <div class="tab-pane tab-pane-markdown">
            <pre class="mock-code"><code>---&#10;status: In Progress&#10;tags: [feature, frontend]&#10;due: 2026-06-15&#10;---&#10;&#10;# Add markdown highlight panel&#10;&#10;This feature panel needs to be extremely beautiful.&#10;&#10;- [x] Design layout&#10;- [ ] Implement responsive styles&#10;- [ ] Translate to German</code></pre>
          </div>
          <div class="tab-pane tab-pane-kanban">
            <div class="kanban-card-mock">
              <div class="card-tags">
                <span class="badge feature">feature</span>
                <span class="badge frontend">frontend</span>
              </div>
              <h4 class="card-title">Add markdown highlight panel</h4>
              <p class="card-desc">This feature panel needs to be extremely beautiful.</p>
              <div class="card-progress">
                <div class="progress-bar-container">
                  <div class="progress-bar" style="width: 33%"></div>
                </div>
                <span class="progress-text">1 / 3 Tasks</span>
              </div>
              <div class="card-footer">
                <span class="card-due">📅 June 15, 2026</span>
                <span class="card-status status-in-progress">In Progress</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style scoped>
.markdown-feature-container {
  margin: 6rem auto;
  max-width: 1152px;
  padding: 0 24px;
}

.markdown-feature-header {
  text-align: center;
  margin-bottom: 3rem;
}

.markdown-feature-header h2 {
  font-size: 2.25rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: 0.75rem;
  background: linear-gradient(120deg, var(--vp-c-brand-1) 30%, var(--vp-c-brand-2, #3b82f6) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.markdown-feature-header .subtitle {
  font-size: 1.15rem;
  color: var(--vp-c-text-2);
  max-width: 700px;
  margin: 0 auto;
  line-height: 1.6;
}

.markdown-feature-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2.5rem;
  align-items: stretch;
}

@media (min-width: 960px) {
  .markdown-feature-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.markdown-feature-card {
  background-color: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 16px;
  padding: 2.5rem;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.02);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
  display: flex;
  flex-direction: column;
}

.markdown-feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.06);
  border-color: var(--vp-c-brand-1);
}

.info-card h3 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-top: 0;
  margin-bottom: 1rem;
  color: var(--vp-c-text-1);
}

.info-card p {
  color: var(--vp-c-text-2);
  line-height: 1.6;
  margin-bottom: 1.5rem;
  font-size: 1rem;
}

.feature-checklist {
  list-style: none !important;
  padding: 0 !important;
  margin: 0 0 2rem 0 !important;
}

.feature-checklist li {
  position: relative;
  padding-left: 28px;
  margin-bottom: 0.85rem;
  color: var(--vp-c-text-1);
  line-height: 1.5;
  font-size: 0.95rem;
}

.feature-checklist li::before {
  content: "✓";
  position: absolute;
  left: 0;
  top: 1px;
  color: var(--vp-c-brand-1);
  font-weight: bold;
  font-size: 1.1rem;
}

.feature-link {
  display: inline-flex;
  align-items: center;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  transition: color 0.2s ease, transform 0.2s ease;
  margin-top: auto;
  text-decoration: none;
}

.feature-link:hover {
  color: var(--vp-c-brand-2, var(--vp-c-brand-1));
  text-decoration: none;
  transform: translateX(4px);
}

/* Visual Mockup Styling */
.visual-card {
  padding: 0 !important;
  overflow: hidden;
  min-height: 380px;
}

.panel-tabs-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.panel-tabs {
  display: flex;
  background-color: var(--vp-c-bg-mute);
  border-bottom: 1px solid var(--vp-c-divider);
  padding: 0 1rem;
}

.tab-btn {
  padding: 0.85rem 1.25rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--vp-c-text-2);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s ease;
  user-select: none;
}

.tab-btn:hover {
  color: var(--vp-c-text-1);
}

.panel-content {
  flex-grow: 1;
  padding: 1.5rem;
  background-color: var(--vp-c-bg-soft);
  display: flex;
  flex-direction: column;
}

/* Tab active styles */
#tab-markdown:checked ~ .panel-tabs .tab-btn-markdown {
  border-bottom-color: var(--vp-c-brand-1);
  color: var(--vp-c-text-1);
  background-color: var(--vp-c-bg-soft);
}
#tab-kanban:checked ~ .panel-tabs .tab-btn-kanban {
  border-bottom-color: var(--vp-c-brand-1);
  color: var(--vp-c-text-1);
  background-color: var(--vp-c-bg-soft);
}

.tab-pane {
  display: none;
  width: 100%;
}
#tab-markdown:checked ~ .panel-content .tab-pane-markdown {
  display: block;
}
#tab-kanban:checked ~ .panel-content .tab-pane-kanban {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
}

/* Code block view */
.tab-pane-markdown .mock-code {
  margin: 0;
  padding: 0.5rem;
  background: transparent !important;
  font-family: var(--vp-font-family-mono);
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--vp-c-text-1);
  white-space: pre-wrap;
}

/* Kanban card view */
.kanban-card-mock {
  background-color: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  padding: 1.25rem;
  width: 100%;
  max-width: 320px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
  box-sizing: border-box;
}

.card-tags {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  text-transform: uppercase;
}

.badge.feature {
  background-color: rgba(112, 161, 255, 0.15);
  color: #1e90ff;
}

.badge.frontend {
  background-color: rgba(255, 107, 129, 0.15);
  color: #ff4757;
}

.card-title {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: var(--vp-c-text-1);
}

.card-desc {
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
  margin: 0 0 1rem 0;
  line-height: 1.4;
}

.card-progress {
  margin-bottom: 1rem;
}

.progress-bar-container {
  background-color: var(--vp-c-bg-mute);
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 0.35rem;
}

.progress-bar {
  background-color: var(--vp-c-brand-1);
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.75rem;
  color: var(--vp-c-text-2);
  font-weight: 500;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--vp-c-divider);
  padding-top: 0.75rem;
  margin-top: 0.5rem;
}

.card-due {
  font-size: 0.75rem;
  color: var(--vp-c-text-2);
}

.card-status {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
}

.status-in-progress {
  background-color: rgba(255, 165, 0, 0.15);
  color: #ff9f43;
}
</style>
