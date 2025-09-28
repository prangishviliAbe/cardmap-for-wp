# Animatrix for Elementor

![Plugin Cover](assets/cover.png)

Animatrix for Elementor is a lightweight WordPress plugin that adds a set of entrance, hover and scroll-triggered CSS animations to Elementor widgets. It provides easy-to-use controls in the Elementor editor so you can apply animations per-widget without writing custom code.

Key features

- Simple entrance and hover animations for Elementor widgets
- Scroll-triggered animations using the IntersectionObserver API
- Cleanly separated assets under `assets/` for easy packaging
- Ready for translation (text domain: `animatrix-for-elementor`)

Installation

1. Option A — Install from GitHub (recommended for development):
   - Clone this repository into your WordPress `wp-content/plugins/` directory and activate from the Plugins screen:

```bash
git clone https://github.com/prangishviliAbe/cardmap-for-wp.git animatrix-for-elementor
```

2. Option B — Upload ZIP:
   - Compress the plugin folder into a `.zip` and upload via WordPress Admin > Plugins > Add New > Upload Plugin.

Usage

1. Open Elementor and edit any page.
2. Select a widget, go to the Advanced tab and look for the "Animatrix Animations" section (or similar). Choose entrance, hover or scroll animation and tweak the duration/delay.
3. For scroll-triggered animations, the plugin uses IntersectionObserver; elements will animate when scrolled into view.

Developer notes

- Assets live in `assets/css/custom-animations.css` and `assets/js/custom-animations.js`.
- Translations: `load_plugin_textdomain( 'animatrix-for-elementor' )` is used; add `.po/.mo` files under `languages/`.
- Uninstall: `uninstall.php` is present as a placeholder for cleaning up any plugin options.

Contributing

Please open issues or PRs on GitHub. When submitting PRs, include a short description, the files changed and a test plan.

License

This project is licensed under the GNU General Public License v2 (or later).
