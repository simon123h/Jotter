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
								{ text: 'Installation & Setup', link: '/installation/precompiled' },
								{ text: 'Running from Source', link: '/installation/development' }
							]
						},
						{
							text: 'User Guide',
							items: [
								{ text: 'Configuration', link: '/user/configuration' },
								{ text: 'The Android App', link: '/user/mobile' },
								{ text: 'Search & Filtering DSL', link: '/user/searching-filtering' },
								{ text: 'Moving Tasks In and Out', link: '/user/migrating' },
								{ text: 'Keyboard Shortcuts', link: '/user/shortcuts' },
								{ text: 'Voice Dictation', link: '/user/voice-dictation' },
								{ text: 'Time Blocking', link: '/user/time-blocking' },
								{ text: '2D Infinite Canvas', link: '/user/canvas' },
								{ text: 'Planning Tasks', link: '/user/planning' },
								{ text: 'Saved Views', link: '/user/saved-views' },
								{ text: 'Links & Bookmarks', link: '/user/links' },
								{ text: 'The Lower Pane', link: '/user/lower-pane' },
								{ text: 'Recurring Tasks & Reminders', link: '/user/recurring-and-reminders' },
								{ text: 'Markdown File Spec', link: '/user/format-spec' },
								{ text: 'Obsidian & PKM Sync', link: '/user/obsidian' },
								{ text: 'Git Versioning & Time Machine', link: '/user/git-sync' },
								{ text: 'Data Safety & Recovery', link: '/user/safety' }
							]
						}
					],
					'/user/': [
						{
							text: 'Getting Started',
							items: [
								{ text: 'Installation & Setup', link: '/installation/precompiled' },
								{ text: 'Running from Source', link: '/installation/development' }
							]
						},
						{
							text: 'User Guide',
							items: [
								{ text: 'Configuration', link: '/user/configuration' },
								{ text: 'The Android App', link: '/user/mobile' },
								{ text: 'Search & Filtering DSL', link: '/user/searching-filtering' },
								{ text: 'Moving Tasks In and Out', link: '/user/migrating' },
								{ text: 'Keyboard Shortcuts', link: '/user/shortcuts' },
								{ text: 'Voice Dictation', link: '/user/voice-dictation' },
								{ text: 'Time Blocking', link: '/user/time-blocking' },
								{ text: '2D Infinite Canvas', link: '/user/canvas' },
								{ text: 'Planning Tasks', link: '/user/planning' },
								{ text: 'Saved Views', link: '/user/saved-views' },
								{ text: 'Links & Bookmarks', link: '/user/links' },
								{ text: 'The Lower Pane', link: '/user/lower-pane' },
								{ text: 'Recurring Tasks & Reminders', link: '/user/recurring-and-reminders' },
								{ text: 'Markdown File Spec', link: '/user/format-spec' },
								{ text: 'Obsidian & PKM Sync', link: '/user/obsidian' },
								{ text: 'Git Versioning & Time Machine', link: '/user/git-sync' },
								{ text: 'Data Safety & Recovery', link: '/user/safety' }
							]
						}
					],
					'/developer/': [
						{
							text: 'Developer Reference',
							items: [
								{ text: 'Architecture (arc42)', link: '/developer/architecture' },
								{ text: 'REST API & OpenAPI', link: '/developer/api' },
								{ text: 'Feature Budget', link: '/developer/features' }
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
					{ text: 'Entwickler-Doku (EN)', link: '/developer/architecture' },
					{ text: 'Live-Demo', link: '/demo/', target: '_blank' }
				],
				sidebar: {
					'/de/installation/': [
						{
							text: 'Erste Schritte',
							items: [
								{ text: 'Installation & Schnellstart', link: '/de/installation/precompiled' },
								{ text: 'Aus Quellcode ausführen', link: '/de/installation/development' }
							]
						},
						{
							text: 'Benutzerhandbuch',
							items: [
								{ text: 'Konfiguration', link: '/de/user/configuration' },
								{ text: 'Die Android-App', link: '/de/user/mobile' },
								{ text: 'Suche & DSL-Filter', link: '/de/user/searching-filtering' },
								{ text: 'Aufgaben hinein- und herausholen', link: '/de/user/migrating' },
								{ text: 'Tastaturkurzbefehle', link: '/de/user/shortcuts' },
								{ text: 'Sprachdiktat', link: '/de/user/voice-dictation' },
								{ text: 'Time Blocking', link: '/de/user/time-blocking' },
								{ text: '2D Infinite Canvas', link: '/de/user/canvas' },
								{ text: 'Aufgaben planen', link: '/de/user/planning' },
								{ text: 'Gespeicherte Ansichten', link: '/de/user/saved-views' },
								{ text: 'Links & Lesezeichen', link: '/de/user/links' },
								{ text: 'Der untere Bereich', link: '/de/user/lower-pane' },
								{ text: 'Wiederkehrende Aufgaben & Erinnerungen', link: '/de/user/recurring-and-reminders' },
								{ text: 'Markdown-Spezifikation', link: '/de/user/format-spec' },
								{ text: 'Obsidian & PKM-Sync', link: '/de/user/obsidian' },
								{ text: 'Git-Versionierung & Time Machine', link: '/de/user/git-sync' },
								{ text: 'Datensicherheit & Recovery', link: '/de/user/safety' }
							]
						},
						{
							text: 'Entwickler-Referenz (EN)',
							items: [
								{ text: 'Architecture (arc42)', link: '/developer/architecture' },
								{ text: 'REST API & OpenAPI', link: '/developer/api' },
								{ text: 'Feature Budget', link: '/developer/features' }
							]
						}
					],
					'/de/user/': [
						{
							text: 'Erste Schritte',
							items: [
								{ text: 'Installation & Schnellstart', link: '/de/installation/precompiled' },
								{ text: 'Aus Quellcode ausführen', link: '/de/installation/development' }
							]
						},
						{
							text: 'Benutzerhandbuch',
							items: [
								{ text: 'Konfiguration', link: '/de/user/configuration' },
								{ text: 'Die Android-App', link: '/de/user/mobile' },
								{ text: 'Suche & DSL-Filter', link: '/de/user/searching-filtering' },
								{ text: 'Aufgaben hinein- und herausholen', link: '/de/user/migrating' },
								{ text: 'Tastaturkurzbefehle', link: '/de/user/shortcuts' },
								{ text: 'Sprachdiktat', link: '/de/user/voice-dictation' },
								{ text: 'Time Blocking', link: '/de/user/time-blocking' },
								{ text: '2D Infinite Canvas', link: '/de/user/canvas' },
								{ text: 'Aufgaben planen', link: '/de/user/planning' },
								{ text: 'Gespeicherte Ansichten', link: '/de/user/saved-views' },
								{ text: 'Links & Lesezeichen', link: '/de/user/links' },
								{ text: 'Der untere Bereich', link: '/de/user/lower-pane' },
								{ text: 'Wiederkehrende Aufgaben & Erinnerungen', link: '/de/user/recurring-and-reminders' },
								{ text: 'Markdown-Spezifikation', link: '/de/user/format-spec' },
								{ text: 'Obsidian & PKM-Sync', link: '/de/user/obsidian' },
								{ text: 'Git-Versionierung & Time Machine', link: '/de/user/git-sync' },
								{ text: 'Datensicherheit & Recovery', link: '/de/user/safety' }
							]
						},
						{
							text: 'Entwickler-Referenz (EN)',
							items: [
								{ text: 'Architecture (arc42)', link: '/developer/architecture' },
								{ text: 'REST API & OpenAPI', link: '/developer/api' },
								{ text: 'Feature Budget', link: '/developer/features' }
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
	},
	vite: {
		build: {
			target: 'es2022'
		}
	}
})
