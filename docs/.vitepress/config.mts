import { defineConfig } from 'vitepress'

export default defineConfig({
	title: "Jotter",
	description: "Local-First Markdown Kanban Board",
	base: "/Jotter/",
	themeConfig: {
		logo: '/logo.png',
		nav: [
			{ text: 'Home', link: '/' },
			{ text: 'User Guide', link: '/installation/precompiled' },
			{ text: 'Developer Docs', link: '/developer/architecture' },
			{ text: 'Live Demo', link: '/demo/', target: '_blank' }
		],
		sidebar: {
			// Sidebar for installation and user guides
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
						{ text: 'Keyboard Shortcuts', link: '/user/shortcuts' },
						{ text: 'Markdown File Spec', link: '/user/format-spec' },
						{ text: 'Obsidian & PKM Sync', link: '/user/obsidian' },
						{ text: 'Git Sync & Collaboration', link: '/user/git-sync' },
						{ text: 'Data Safety & Recovery', link: '/user/safety' }
					]
				}
			],
			// Sidebar for technical developer docs
			'/developer/': [
				{
					text: 'Developer Reference',
					items: [
						{ text: 'Architecture (arc42)', link: '/developer/architecture' },
						{ text: 'REST API & OpenAPI', link: '/developer/api' }
					]
				}
			]
		},
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
