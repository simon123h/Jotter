# themes

The colour themes of Jotter, shared by the desktop app (`web/`) and the mobile app (`mobile/`).

- `themes.css` defines each theme as `--theme-*` variables: the default (Nordic Light) on `:root`, every other theme
  as a class `.theme-<id>` on `<html>`. Both apps import it.
- `index.ts` lists the theme ids and whether each is dark, for the pickers.

To add a theme, add its block to `themes.css`, its entry to `index.ts`, and a name in each app's translations.
