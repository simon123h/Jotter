---
layout: home

hero:
  name: "Jotter"
  text: "Lokales Kanban-Board"
  tagline: "Beherrsche die Aufgabenflut und behalte 100% Kontrolle über deine Daten."
  image:
    src: /logo.png
    alt: Jotter Logo
  actions:
    - theme: brand
      text: Erste Schritte
      link: /de/installation/precompiled
    - theme: alt
      text: Entwickler-Doku
      link: /de/developer/architecture
    - theme: alt
      text: 🚀 Live-Demo
      link: /demo/
      target: _blank

features:
  - icon: 🔐
    title: Datensouveränität
    details: Aufgaben werden lokal als menschenlesbare Markdown-Dateien auf deinem eigenen Gerät gespeichert. Deine Daten gehören für immer dir.
  - icon: 🌊
    title: Anti-Aufgabenflut
    details: Bietet umfassende Filter, Ansichten und Werkzeuge für Power-User, um der Aufgabenüberlastung entgegenzuwirken.
  - icon: ⚡
    title: Auf Geschwindigkeit ausgelegt
    details: Ein lokaler SQLite-basierter Index ermöglicht blitzschnelles Drag-and-Drop, Filtern und Suchen.
  - icon: 🖧
    title: Git-Synchronisation
    details: Projekte können mit Git-Repositories synchronisiert werden, um die Nutzung auf mehreren Geräten oder im Team zu ermöglichen.
---

<div class="markdown-feature-container">
  <div class="markdown-feature-header">
    <h2>Markdown-Natives Kanban</h2>
    <p class="subtitle">Deine Aufgaben sind einfaches Markdown. Schön strukturiert, unendlich erweiterbar und zu 100 % in deiner Hand.</p>
  </div>
  <div class="markdown-feature-grid">
    <div class="markdown-feature-card info-card">
      <h3>Das Beste aus beiden Welten</h3>
      <p>Jotter ist nicht nur ein Kanban-Board, das nach Markdown exportiert – es ist eine <strong>direkte visuelle Schnittstelle</strong> für deine Markdown-Dateien. Jede Drag-and-Drop-Aktion, Statusänderung oder Spaltenverschiebung bearbeitet deine Dateien in Echtzeit.</p>
      <ul class="feature-checklist">
        <li><strong>Kein proprietärer Lock-in:</strong> Öffne und bearbeite deine Dateien in Obsidian, VS Code, Logseq oder einem beliebigen Texteditor.</li>
        <li><strong>Standard-GFM-Checklisten:</strong> Deine Unteraufgaben entsprechen direkt den standardmäßigen Checklisten-Elementen.</li>
        <li><strong>Frontmatter & Metadaten:</strong> Fälligkeitsdaten, Prioritäten und benutzerdefinierte Tags werden sauber im YAML-Frontmatter gespeichert.</li>
        <li><strong>Kommentare & Inhalte bleiben erhalten:</strong> Ausführliche Beschreibungen, Links und verschachtelte Notizen bleiben vollständig unberührt.</li>
      </ul>
      <a class="feature-link" href="./user/format-spec">Dateispezifikation erkunden →</a>
    </div>
    <div class="markdown-feature-card visual-card">
      <div class="panel-tabs-container">
        <input type="radio" id="tab-markdown-de" name="view-selector-de" checked style="display:none;" />
        <input type="radio" id="tab-kanban-de" name="view-selector-de" style="display:none;" />
        <div class="panel-tabs">
          <label for="tab-markdown-de" class="tab-btn tab-btn-markdown">📝 task_item.md</label>
          <label for="tab-kanban-de" class="tab-btn tab-btn-kanban">📋 Kanban-Karte</label>
        </div>
        <div class="panel-content">
          <div class="tab-pane tab-pane-markdown">
            <pre class="mock-code"><code>---&#10;status: In Bearbeitung&#10;tags: [feature, frontend]&#10;due: 2026-06-15&#10;---&#10;&#10;# Markdown-Feature-Panel hinzufügen&#10;&#10;Dieses Feature-Panel muss extrem schön aussehen.&#10;&#10;- [x] Layout entwerfen&#10;- [ ] Responsive Stile implementieren&#10;- [ ] Ins Deutsche übersetzen</code></pre>
          </div>
          <div class="tab-pane tab-pane-kanban">
            <div class="kanban-card-mock">
              <div class="card-tags">
                <span class="badge feature">feature</span>
                <span class="badge frontend">frontend</span>
              </div>
              <h4 class="card-title">Markdown-Feature-Panel hinzufügen</h4>
              <p class="card-desc">Dieses Feature-Panel muss extrem schön aussehen.</p>
              <div class="card-progress">
                <div class="progress-bar-container">
                  <div class="progress-bar" style="width: 33%"></div>
                </div>
                <span class="progress-text">1 / 3 Aufgaben</span>
              </div>
              <div class="card-footer">
                <span class="card-due">📅 15. Juni 2026</span>
                <span class="card-status status-in-progress">In Bearbeitung</span>
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
#tab-markdown-de:checked ~ .panel-tabs .tab-btn-markdown {
  border-bottom-color: var(--vp-c-brand-1);
  color: var(--vp-c-text-1);
  background-color: var(--vp-c-bg-soft);
}
#tab-kanban-de:checked ~ .panel-tabs .tab-btn-kanban {
  border-bottom-color: var(--vp-c-brand-1);
  color: var(--vp-c-text-1);
  background-color: var(--vp-c-bg-soft);
}

.tab-pane {
  display: none;
  width: 100%;
}
#tab-markdown-de:checked ~ .panel-content .tab-pane-markdown {
  display: block;
}
#tab-kanban-de:checked ~ .panel-content .tab-pane-kanban {
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
