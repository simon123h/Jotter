import { defineConfig } from 'vitepress'

export default defineConfig({
	base: "/Jotter/",
	locales: {
		root: {
			label: 'English',
			lang: 'en',
			title: 'Jotter',
			description: 'Local-First Markdown Kanban Board',
			themeConfig: {
				nav: [
					{ text: 'Home', link: '/' },
					{ text: 'User Guide', link: '/installation/precompiled' },
					{ text: 'Developer Docs', link: '/developer/architecture' },
					{ text: 'Live Demo', link: '/demo/', target: '_blank' }
				],
				sidebar: {
					'/installation/': [
						{
							text: 'Getting Started',
							items: [
								{ text: 'Precompiled Binaries', link: '/installation/precompiled' },
								{ text: 'Running from Source', link: '/installation/development' }
							]
						},
						{
							text: 'User Guide',
							items: [
								{ text: 'Configuration', link: '/user/configuration' },
								{ text: 'MS Planner Import', link: '/user/import-planner' },
								{ text: 'Keyboard Shortcuts', link: '/user/shortcuts' },
								{ text: 'Markdown File Spec', link: '/user/format-spec' },
								{ text: 'Obsidian & PKM Sync', link: '/user/obsidian' },
								{ text: 'Git Sync & Collaboration', link: '/user/git-sync' },
								{ text: 'Data Safety & Recovery', link: '/user/safety' }
							]
						}
					],
					'/user/': [
						{
							text: 'Getting Started',
							items: [
								{ text: 'Precompiled Binaries', link: '/installation/precompiled' },
								{ text: 'Running from Source', link: '/installation/development' }
							]
						},
						{
							text: 'User Guide',
							items: [
								{ text: 'Configuration', link: '/user/configuration' },
								{ text: 'MS Planner Import', link: '/user/import-planner' },
								{ text: 'Keyboard Shortcuts', link: '/user/shortcuts' },
								{ text: 'Markdown File Spec', link: '/user/format-spec' },
								{ text: 'Obsidian & PKM Sync', link: '/user/obsidian' },
								{ text: 'Git Sync & Collaboration', link: '/user/git-sync' },
								{ text: 'Data Safety & Recovery', link: '/user/safety' }
							]
						}
					],
					'/developer/': [
						{
							text: 'Developer Reference',
							items: [
								{ text: 'Architecture (arc42)', link: '/developer/architecture' },
								{ text: 'REST API & OpenAPI', link: '/developer/api' }
							]
						}
					]
				}
			}
		},
		de: {
			label: 'Deutsch',
			lang: 'de',
			title: 'Jotter',
			description: 'Lokale Markdown Kanban-Boards',
			themeConfig: {
				nav: [
					{ text: 'Startseite', link: '/de/' },
					{ text: 'Benutzerhandbuch', link: '/de/installation/precompiled' },
					{ text: 'Entwickler-Doku', link: '/de/developer/architecture' },
					{ text: 'Live-Demo', link: '/demo/', target: '_blank' }
				],
				sidebar: {
					'/de/installation/': [
						{
							text: 'Erste Schritte',
							items: [
								{ text: 'Vorkompilierte Binärdateien', link: '/de/installation/precompiled' },
								{ text: 'Aus Quellcode ausführen', link: '/de/installation/development' }
							]
						},
						{
							text: 'Benutzerhandbuch',
							items: [
								{ text: 'Konfiguration', link: '/de/user/configuration' },
								{ text: 'MS Planner Import', link: '/de/user/import-planner' },
								{ text: 'Tastaturkurzbefehle', link: '/de/user/shortcuts' },
								{ text: 'Markdown-Spezifikation', link: '/de/user/format-spec' },
								{ text: 'Obsidian & PKM-Sync', link: '/de/user/obsidian' },
								{ text: 'Git-Sync & Zusammenarbeit', link: '/de/user/git-sync' },
								{ text: 'Datensicherheit & Recovery', link: '/de/user/safety' }
							]
						}
					],
					'/de/user/': [
						{
							text: 'Erste Schritte',
							items: [
								{ text: 'Vorkompilierte Binärdateien', link: '/de/installation/precompiled' },
								{ text: 'Aus Quellcode ausführen', link: '/de/installation/development' }
							]
						},
						{
							text: 'Benutzerhandbuch',
							items: [
								{ text: 'Konfiguration', link: '/de/user/configuration' },
								{ text: 'MS Planner Import', link: '/de/user/import-planner' },
								{ text: 'Tastaturkurzbefehle', link: '/de/user/shortcuts' },
								{ text: 'Markdown-Spezifikation', link: '/de/user/format-spec' },
								{ text: 'Obsidian & PKM-Sync', link: '/de/user/obsidian' },
								{ text: 'Git-Sync & Zusammenarbeit', link: '/de/user/git-sync' },
								{ text: 'Datensicherheit & Recovery', link: '/de/user/safety' }
							]
						}
					],
					'/de/developer/': [
						{
							text: 'Entwickler-Referenz',
							items: [
								{ text: 'Architektur (arc42)', link: '/de/developer/architecture' },
								{ text: 'REST-API & OpenAPI', link: '/de/developer/api' }
							]
						}
					]
				}
			}
		}
	},
	themeConfig: {
		logo: '/logo.png',
		search: {
			provider: 'local'
		},
		socialLinks: [
			{ icon: 'github', link: 'https://github.com/simon123h/jotter' }
		],
		footer: {
			message: 'Released under the Apache-2.0 License.',
			copyright: 'Copyright © 2026 simon123h'
		}
	}
})
