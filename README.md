![CardMap for WP Banner](assets/images/banner.png)

# CardMap for WP

A WordPress plugin for creating interactive, node-based maps with connections. Built with jsPlumb, this plugin allows you to visually design and display complex diagrams, flowcharts, or maps on your WordPress site using a simple shortcode.

## Features

- **Custom Post Type:** Adds a "CardMaps" post type to your WordPress admin for easy management.
- **Visual Editor:** A drag-and-drop interface to add, position, and connect nodes (cards).
- **Node Customization:** Add titles, captions, images, and links to each card.
- **Connection Styling:** Customize the color, thickness, and style of the connecting lines.
- **Rails System:** Add horizontal or vertical rails to align nodes neatly.
- **Frontend Rendering:** Display your map on any page or post with the `[cardmap id="..."]` shortcode.
- **Interactive Frontend:** Users can pan and zoom the map for better viewing.
- **Fullscreen Mode:** A dedicated button to view the map in fullscreen.

## Installation

1.  Download the plugin as a `.zip` file from the GitHub repository.
2.  In your WordPress admin dashboard, navigate to **Plugins > Add New**.
3.  Click **Upload Plugin** and select the `.zip` file you downloaded.
4.  Click **Install Now** and then **Activate Plugin**.

## How to Use

1.  After activating the plugin, a new **CardMaps** menu will appear in your WordPress admin sidebar.
2.  Click **CardMaps > Add New** to create a new map.
3.  Give your map a title and use the visual editor on the page to build your map:
    - **Add Node:** Creates a new card on the canvas.
    - **Add Rail:** Adds a horizontal or vertical rail for alignment.
    - **Connect Mode:** Click this, then click two nodes to draw a connection between them.
    - **Delete Mode:** Click this, then click a node to delete it.
4.  Double-click any node to edit its content (title, caption, image, link).
5.  Click the **Save Map** button in the editor toolbar to save your progress.
6.  Once you are finished, click the main **Publish** or **Update** button for the post.
7.  To display the map, copy the shortcode provided in the "Shortcode" meta box (e.g., `[cardmap id="123"]`) and paste it into any post or page.

## Changelog

### v1.10.0 (2025-10-10)

- **🎨 Individual Connection Styling:** Revolutionary new feature allowing each connection to have its own independent style settings, separate from card settings.
- **🖱️ Right-Click Context Menu:** Intuitive right-click interface on connections to instantly change their style (normal, dashed, dotted, arrows, etc.).
- **🎯 Smart Priority System:** Complete implementation of connection style priority: individual connection > source node > target node > global default.
- **✨ Enhanced User Experience:** Immediate visual feedback when changing connection styles with real-time preview.
- **🔧 Fixed Style Application:** Resolved issues where connection style changes in the panel weren't taking effect properly.
- **📋 Improved Data Structure:** Connection data now properly stores and manages individual style properties.
- **⚡ Performance Optimized:** Streamlined style rendering and repaint operations for better responsiveness.
- **🎨 Professional UI:** Clean, contextual menu design that integrates seamlessly with the existing interface.
- **🌐 Full Compatibility:** Both admin editor and frontend display now fully support individual connection styling.

### v1.9.1 (2025-10-09)

- **🐛 Critical Bug Fix:** Fixed connection style rendering issue where normal/solid lines were incorrectly displayed with dashed styles on the frontend.
- **✨ New Connection Style:** Added 'Normal' connection style option for clean solid lines without arrows, providing better visual clarity.
- **🎯 Enhanced Consistency:** Improved consistency between admin editor and frontend connection style rendering for all line types.
- **🔧 Better Defaults:** Updated default connection style handling to properly support normal, dashed, dotted, and arrow styles.
- **📋 Improved Compatibility:** Enhanced connection style fallback behavior for existing maps to ensure proper rendering.
- **⚡ Performance:** Optimized connection style configuration for faster rendering and better user experience.

### v1.9.0 (2025-10-09)

- **🎯 Enhanced History System:** Complete overhaul of undo/redo functionality with proper state management and UI feedback.
- **📋 Interactive History Panel:** New history dropdown showing all actions with timestamps and the ability to jump to any point in history.
- **🔄 Smart History Tracking:** Automatic history saving for all major actions including node creation, connection creation, deletions, and modifications.
- **⚡ Improved Performance:** Better connection rendering with reduced gaps and improved SVG positioning accuracy.
- **🎨 Better UI/UX:** Disabled state indicators for undo/redo buttons, better visual feedback, and cleaner interface.
- **🔧 Fixed Rail Connections:** Resolved issues with frontend connection gaps and improved rail-to-node connection accuracy.
- **⌨️ Keyboard Shortcuts:** Enhanced Ctrl+Z (undo) and Ctrl+Y (redo) support with proper state management.
- **💾 Persistent History:** History state properly maintained across editor sessions with smart cleanup.
- **🚀 Performance Optimizations:** Reduced unnecessary repaints and improved connection calculation speed.

### v1.8.3 (2025-10-09)

- **Major Enhancement:** Completely redesigned connection precision system for pixel-perfect accuracy.
- **Smart Anchoring:** Connections to cards now automatically snap to the nearest edge center (top, bottom, left, right) for perfect alignment regardless of where you click.
- **Precise Rail Connections:** Connections to rails maintain exact pixel positioning where you click for maximum flexibility.
- **Unified Coordinate System:** Fixed inconsistencies between node-to-rail and rail-to-node connections ensuring both directions work perfectly.
- **Improved User Experience:** Eliminated pixel-level positioning errors on cards while maintaining precise control on rails.
- **Technical:** Completely rewrote anchor calculation functions with unified coordinate handling and better error management.

### v1.8.2 (2025-10-09)

- **Fix:** Improved clicking precision for rail connections - connections now anchor exactly where you click instead of connecting to a different location.
- **Enhancement:** Updated default card size to 192px × 240px for better visual balance and consistency.
- **Technical:** Fixed coordinate transformation logic in anchor calculation functions for more accurate positioning.

### v1.8.1 (2025-10-07)

- Improvement: Moved fullscreen link generation from frontend to admin panel for cleaner user experience.
- Feature: Added automatic fullscreen mode when accessing cardmap links with fullscreen parameter.

### v1.8.0 (2025-10-07)

- **New Feature:** Added visible Undo/Redo buttons (↶ ↷) in the toolbar for easy access to history navigation.
- **New Feature:** Added Auto-Align button (📐) that proportionally distributes cards evenly within their current area.
- **Enhancement:** Dynamic connection anchors - connections to rails now move smoothly along the rail as you drag connected cards.
- **Enhancement:** Improved frontend connection rendering to match admin panel appearance exactly.
- **Enhancement:** Better anchor handling for rail connections with proper saved anchor support.
- **Enhancement:** Connections now properly process saved precise anchors from the admin panel.
- **Removed:** Grid snap and ruler features removed for simplified, cleaner interface.
- **Fix:** Connections now properly reach rails without gaps on the frontend.
- **Fix:** Connection styling now matches perfectly between admin panel and frontend display.
- **Fix:** Added initialization delays to ensure rails are fully set up before connections are created.

### v1.7.0 (2025-10-07)

- **New Feature:** Added comprehensive export/import functionality for plugin settings. Users can now backup their settings or transfer them between sites.
- **Export:** Download all plugin settings as a JSON file for backup or migration purposes.
- **Import:** Upload and restore settings from a previously exported JSON file.
- **User-Friendly:** Added intuitive UI controls in the settings page with progress feedback and error handling.
- **New Feature:** Added ruler overlay functionality in the editor for precise element alignment.
- **Ruler:** Toggle-able ruler overlay with customizable color and opacity for accurate positioning.
- **Keyboard Shortcut:** Press 'R' key to quickly toggle ruler on/off.

### v1.6.2 (2025-10-07)

- **Fixed:** Connection style selection now updates visually in real-time. Previously, selecting different connection styles (straight, bezier, dashed, etc.) from the dropdown had no visual effect on existing connections.
- **Technical:** Removed CSS `!important` declarations that were preventing JavaScript from updating connection styles dynamically.
- **Enhanced:** Added proper repaint calls and improved error handling for connection style changes.
- **Improved:** Added user feedback via toast notifications when connection styles are updated.
- **Debugging:** Enhanced console logging to help identify connection style issues in the future.

### v1.5.0 (2025-10-03)

- Added rail appearance controls in the admin editor: rail style (solid/dashed/dotted), color picker, and thickness.
- Improved rail settings panel positioning: panel now appears adjacent to the hovered rail and respects pan/zoom.
- Fixed plugin update checker slug and published release tags so WordPress can detect updates.

### v1.5.1 (2025-10-03)

- Added additional rail appearance styles (dash-heavy, dash-subtle, double-line, striped, gradient, embossed) and improved dashed rendering for better visibility.

### v1.5.2 (2025-10-03)

- Bugfix: Ensure rail appearance changes persist across save/load in the editor and reflect immediately on existing connections. Added extra debug logging to assist with persistence issues.
