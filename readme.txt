=== Card Map Builder Pro ===
Contributors: prangishviliAbe
Tags: map, builder, diagram, flowchart, mind map, jsplumb
Requires at least: 5.0
Tested up to: 6.8
Stable tag: 1.8.2
Requires PHP: 7.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Draggable card maps with images, captions, links, connections, admin editor + settings, and frontend shortcode with zoom/pan/fullscreen.

== Description ==

Card Map Builder Pro allows you to create dynamic, interactive maps of cards. It's perfect for visualizing processes, creating simple diagrams, or building unique navigational experiences.

*   **Visual Editor:** Drag and drop cards, create connections, and build your map in a simple and intuitive admin interface.
*   **Customizable Cards:** Add titles, captions, images, and links to each card.
*   **Connections:** Draw lines between cards to show relationships.
*   **Frontend Display:** Use a simple shortcode `[cardmap id="your_map_id"]` to display your map on any page or post.
*   **Pan & Zoom:** Users can pan and zoom the map on the frontend for easy navigation.
*   **Customizable:** Control line colors, styles, hover effects, and more from the settings panel.
*   **Polylang Compatible:** Translate your maps into multiple languages.

== Installation ==

1.  Upload the `cardmap` folder to the `/wp-content/plugins/` directory.
2.  Activate the plugin through the 'Plugins' menu in WordPress.
3.  Go to "Card Maps" in the admin menu to start creating your first map.
4.  Use the shortcode `[cardmap id="your_map_id"]` to display your map.

== Changelog ==

= 1.8.2 =
*   Fix: Improved clicking precision for rail connections - connections now anchor exactly where you click instead of connecting to a different location.
*   Enhancement: Updated default card size to 192px × 240px for better visual balance and consistency.
*   Technical: Fixed coordinate transformation logic in anchor calculation functions for more accurate positioning.

= 1.8.1 =
*   Improvement: Moved fullscreen link generation from frontend to admin panel for cleaner user experience.
*   Feature: Added automatic fullscreen mode when accessing cardmap links with fullscreen parameter.

= 1.8.0 =
*   New Feature: Added visible Undo/Redo buttons in the toolbar for easy access to history navigation.
*   New Feature: Added Auto-Align button that proportionally distributes cards evenly within their current area.
*   Enhancement: Dynamic connection anchors - connections to rails now move smoothly along the rail as you drag connected cards.
*   Enhancement: Improved frontend connection rendering to match admin panel appearance exactly.
*   Enhancement: Better anchor handling for rail connections with proper saved anchor support.
*   Removed: Grid snap and ruler features removed for simplified interface.
*   Fix: Connections now properly reach rails without gaps on the frontend.
*   Fix: Connection styling now matches between admin panel and frontend display.

= 1.7.0 =
*   New Feature: Added comprehensive export/import functionality for plugin settings. Users can now backup their settings or transfer them between sites.
*   Export: Download all plugin settings as a JSON file for backup or migration purposes.
*   Import: Upload and restore settings from a previously exported JSON file.
*   User-Friendly: Added intuitive UI controls in the settings page with progress feedback and error handling.
*   New Feature: Added ruler overlay functionality in the editor for precise element alignment.
*   Ruler: Toggle-able ruler overlay with customizable color and opacity for accurate positioning.
*   Keyboard Shortcut: Press 'R' key to quickly toggle ruler on/off.

= 1.6.2 =
*   Fixed: Connection style selection now updates visually in real-time. Previously, selecting different connection styles (straight, bezier, dashed, etc.) from the dropdown had no visual effect on existing connections.
*   Technical: Removed CSS !important declarations that were preventing JavaScript from updating connection styles dynamically.
*   Enhanced: Added proper repaint calls and improved error handling for connection style changes.
*   Improved: Added user feedback via toast notifications when connection styles are updated.
*   Debugging: Enhanced console logging to help identify connection style issues in the future.

= 1.6.1 =
*   Maintenance: Updated version for release

= 1.6.0 =
*   Feature: Added comprehensive keyboard shortcuts (Ctrl+Z/Y for undo/redo, Delete for nodes, Arrow keys for nudging, G for grid toggle, Escape to deselect)
*   Feature: Implemented full undo/redo system with 50-state history tracking
*   Feature: Added grid snap functionality with visual grid background and toggle button
*   Enhancement: Improved user experience with toast notifications and visual feedback
*   Enhancement: Added professional-grade editing capabilities with history management

= 1.4.4 =
*   Fix: Prevented rails from being deleted on double-click.
*   Fix: Corrected rail resize initiation logic.

= 1.5.5 =
*   Fix: Double-click on connection lines now immediately breaks the connection and persists the change.
*   Fix: Prevent accidental connection creation immediately after dragging a rail (debounce click after drag).

= 1.4.3 =
*   Fix: Corrected rail resizing logic for vertical rails.
*   Fix: Improved precision of connection anchor points.

= 1.4.2 =
*   Tweak: Reverted update checker slug.

= 1.4.1 =
*   Fix: Corrected plugin update checker slug to match repository name.

= 1.4.0 =
*   Feature: Added automatic map generation from post/page hierarchies and taxonomies.
*   Tweak: Updated UI for map generation to support all post types and taxonomies.

= 1.3.0 =
*   Feature: Added automatic map generation from post hierarchies (e.g., parent/child pages).
*   Feature: Added a "Map Configuration" panel to switch between manual and generated maps.

= 1.2.0 =
*   Feature: Added full compatibility with the Polylang plugin for multi-language sites.
*   Tweak: Set the 'Card Map' post type to public to allow translation management plugins to see it.

= 1.1.1 =
*   Fix: Corrected the plugin slug in the update checker configuration to ensure update notifications work correctly.

= 1.1 =
*   Feature: Added selectable hover effects for frontend cards (Lift, Glow, Zoom, Border).
*   Tweak: Added a new "Appearance" section in the settings panel.

= 1.0 =
*   Initial public release.
*   Refactored admin JavaScript into a modern, object-oriented structure.
*   Added GitHub-based plugin update notifications.
