# Background Image Feature - Implementation Summary

## Overview

Added a new feature to the Card Map Builder Pro plugin that allows users to set a custom background image for maps displayed on the frontend.

## Features Implemented

### 1. Settings Registration

**File: `includes/settings-page.php`**

- Added three new settings:
  - `cardmap_background_image` - Stores the URL of the uploaded background image
  - `cardmap_background_size` - Controls how the background image is sized (auto, cover, contain, stretch)
  - `cardmap_background_repeat` - Controls background repetition (repeat, no-repeat, repeat-x, repeat-y)

### 2. User Interface Controls

**File: `includes/settings-page.php`**

Added to the "Appearance" settings card:

#### Background Image Upload Field

- Text input displaying the selected image URL
- "Select Image" button that opens WordPress Media Library
- "Remove" button to clear the selected image
- Live image preview (200px max width/height)

#### Background Size Selector

Dropdown options:

- **Auto** - Original image size
- **Cover** - Fill the entire container (may crop)
- **Contain** - Fit within container (maintains aspect ratio)
- **Stretch (100% 100%)** - Fill entire area (may distort)

#### Background Repeat Selector

Dropdown options:

- **Repeat** - Tile in both directions
- **No Repeat** - Display once
- **Repeat Horizontally** - Tile only on X-axis
- **Repeat Vertically** - Tile only on Y-axis

### 3. WordPress Media Library Integration

**File: `includes/settings-page.php`**

- Integrated WordPress native media uploader using `wp.media()`
- Filter to show only image files
- Live preview update when image is selected
- Remove button functionality to clear selection

**File: `cardmap.php`**

- Enqueued `wp_enqueue_media()` on the settings page to load required media library scripts

### 4. Frontend Application

**File: `includes/shortcode.php`**

- Fetch background settings along with other map settings
- Apply background styles as inline CSS to the `.cardmap-frontend-wrapper` element
- Background styles include:
  - `background-image: url(...)`
  - `background-size: [user selection]`
  - `background-repeat: [user selection]`
  - `background-position: center` (fixed for optimal centering)

### 5. Export/Import Support

**File: `includes/settings-page.php`**

- Added all three background settings to export array
- Added all three background settings to import array
- Background image URLs are preserved during export/import operations

## How It Works

1. **Admin Setup:**

   - Navigate to Card Maps → Settings
   - Scroll to the "Appearance" section
   - Click "Select Image" to open the WordPress Media Library
   - Choose an image or upload a new one
   - Select desired background size and repeat options
   - Click "Save Changes"

2. **Frontend Display:**

   - When a cardmap shortcode `[cardmap id="X"]` is rendered
   - The plugin fetches the background settings from options
   - Applies inline styles to the map wrapper
   - Background image displays behind the map cards and connections

3. **Default Behavior:**
   - If no background image is set, the default dotted pattern background is used (existing behavior)
   - Custom background overrides the default pattern when set
   - Settings can be exported and imported between sites

## Technical Details

### CSS Properties Applied

```css
background-image: url(selected-image-url);
background-size: [auto|cover|contain|100% 100%];
background-repeat: [repeat|no-repeat|repeat-x|repeat-y];
background-position: center;
```

### Database Options

- `cardmap_background_image` (string, default: '')
- `cardmap_background_size` (string, default: 'auto')
- `cardmap_background_repeat` (string, default: 'repeat')

## Files Modified

1. **cardmap.php** - Added wp_enqueue_media() for settings page
2. **includes/settings-page.php** - Added settings registration, UI controls, and media uploader JavaScript
3. **includes/shortcode.php** - Applied background settings to frontend wrapper

## Compatibility

- WordPress 5.0+
- Works with existing map configurations
- Backward compatible - maps without custom backgrounds display default pattern
- Export/import functionality preserves background settings
