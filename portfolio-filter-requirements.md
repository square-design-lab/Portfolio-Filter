# Squarespace Portfolio Filter — Plugin Requirements & Implementation Reference

**Purpose:** A drop-in JavaScript/CSS plugin that adds a fully configurable filtering, searching, sorting, and pagination system to a Squarespace portfolio collection page. Sold via LemonSqueezy; buyers receive access to a visual configuration dashboard (HTML app) that generates the installation code snippet.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Delivery & Distribution Model](#2-delivery--distribution-model)
3. [Architecture](#3-architecture)
4. [Core Plugin — JavaScript (`portfolio-filter-v2.js`)](#4-core-plugin--javascript)
   - 4.1 Initialization & Lifecycle
   - 4.2 Data Layer
   - 4.3 Filter Engine
   - 4.4 Layout System
   - 4.5 Control Panel (UI)
   - 4.6 Filter Interaction Modes
   - 4.7 Search
   - 4.8 Sorting
   - 4.9 Pagination
   - 4.10 Meta Injection
   - 4.11 Animation System
   - 4.12 URL State Management
   - 4.13 Responsive / Mobile Behavior
   - 4.14 Performance & Safety
   - 4.15 Configuration Reference
5. [Core Plugin — CSS (`portfolio-filter-v2.css`)](#5-core-plugin--css)
6. [Configuration Dashboard (`config-generator-v3.html`)](#6-configuration-dashboard)
7. [Generated Code Output](#7-generated-code-output)
8. [SEO Data Format (Content Schema)](#8-seo-data-format-content-schema)
9. [Known Constraints & Squarespace Integration Notes](#9-known-constraints--squarespace-integration-notes)
10. [Feature Status Summary](#10-feature-status-summary)

---

## 1. Product Overview

The plugin transforms a standard Squarespace portfolio grid (`#gridThumbs`) into a fully interactive, filterable gallery. It reads metadata embedded in each portfolio item's **SEO title/description fields**, builds a dynamic filter control panel, and shows/hides grid items client-side without any page reloads.

**Core capabilities:**
- Multi-group filtering (Tags, Location, Year, or any custom key)
- Hierarchical / subcategory filtering (parent > child)
- Full-text search across title, SEO fields, and injected meta
- Alphabetical and date-based sorting
- Load More and Infinite Scroll pagination
- Grid item meta display injection (tags, year, location, excerpt, custom fields)
- Stagger animation on filter change
- Sidebar and Top (full-width) layout modes
- Per-deployment visual configuration via a no-code dashboard

---

## 2. Delivery & Distribution Model

- Plugin files (`portfolio-filter-v2.js` and `portfolio-filter-v2.css`) will be hosted on a **CDN**.
- Buyers purchase via **LemonSqueezy** and receive access to the **Config Generator** web app (`config-generator-v3.html`).
- The Config Generator is a self-contained single-page HTML app.
- The buyer uses the Config Generator to visually configure and preview the plugin, then clicks **Copy Code** to get a ready-made snippet.
- The snippet is pasted into a Squarespace **Code Injection** block or **Code Block** on the portfolio page.
- The snippet references the CDN-hosted CSS and JS files.

**Generated snippet structure:**
```html
<style>#gridThumbs{opacity:0;transition:opacity 0.2s ease;}</style>
<link rel="stylesheet" href="https://cdn.example.com/portfolio-filter-v2.css">
<script>
window.PORTFOLIO_CONFIG = { /* full config object */ };
</script>
<script src="https://cdn.example.com/portfolio-filter-v2.js" defer></script>
```

---

## 3. Architecture

```
portfolio-filter-v2.js     — Core IIFE plugin (self-contained, no dependencies)
portfolio-filter-v2.css    — Static structural + animation styles; CSS custom properties only for theming
config-generator-v3.html   — Standalone visual dashboard; generates PORTFOLIO_CONFIG + snippet
```

**Runtime data flow:**
1. Page loads → plugin hides `#gridThumbs` immediately (prevents FOUC).
2. Plugin checks `localStorage` for cached portfolio JSON (SWR pattern).
3. If cache exists → renders immediately using cached data.
4. Fetches `{page-url}?format=json` in background.
5. If fresh data differs from cache → updates cache and re-renders (restoring filter/page state).
6. If no cache → waits for fetch, then renders.
7. Fallback: after 1 second or 3 seconds (CSS safety timer), content is revealed regardless.

**Global namespace:**
```js
window.PortfolioFilter = { state, CONFIG, initFilter }
window.PORTFOLIO_CONFIG = { /* user config object */ }
```

---

## 4. Core Plugin — JavaScript

### 4.1 Initialization & Lifecycle

| Event | Handler |
|---|---|
| `DOMContentLoaded` | `initFilter()` |
| `mercury:load` | `initFilter()` (Squarespace AJAX nav support) |
| `popstate` | `handleUrlChange()` |
| `beforeunload` | `cleanup()` |

**`initFilter()` sequence:**
1. Call `applyDynamicStyles()` — inject CSS custom properties `<style>` tag.
2. Call `setupItemObserver()` — set up IntersectionObserver for scroll-based animation.
3. Call `syncPortfolioSectionStyling()` — sync padding/min-height from `#gridThumbs` to wrapper.
4. Schedule `applyBodyReady()` at 1500 ms.
5. Hide `#gridThumbs` (opacity 0).
6. If `window.MOCK_DATA` exists — use it (dev/preview mode).
7. Attempt cache read from `localStorage[CONFIG.cacheKey]`.
8. Fetch fresh data from `CONFIG.dataSource`.
9. On fresh data: compare signatures, update cache if changed, restore state, re-render.
10. Fallback `revealContent()` at 1000 ms.

**`cleanup()`** — disconnects IntersectionObserver and MutationObserver, clears resize debounce timers, removes dropdown click/keydown listeners.

### 4.2 Data Layer

**Data source:**
- Default: `window.location.pathname + '?format=json'` (Squarespace JSON endpoint)
- Local dev fallback: `'portfolio-data.json'` (when `protocol === 'file:'`)

**Caching (SWR):**
- Cache key: `CONFIG.cacheKey` (default `'portfolio-data-v1'`), stored in `localStorage`.
- Cached value: `{ timestamp, items: [processedItems] }` — stores **processed** items to avoid re-parsing on load.
- Staleness detection: compare item ID/URL signatures between cached and fresh fetch.

**Item parsing (`parseRawItems`):**
Each raw Squarespace item is mapped to an enriched object:
```js
{
  ...rawItem,
  originalIndex,
  parsedFilters,   // { Tags: [...], Location: [...], Year: [...], CustomKey: [...] }
  parsedExcerpt,   // cleaned text stripped of key:value pairs
  parsedCustom,    // same as parsedFilters — used for meta injection
  searchText,      // lowercased: title + seoTitle + seoDescription concatenated
  parsedDate       // Date object parsed from Year filter value
}
```

**SEO parsing (`parseSeoData`):**
Parses `seoData.seoTitle` and `seoData.seoDescription` using regex:
```
([A-Za-z0-9 ]+):\s*([^|;.\n]+)(?=[|;.\n]|$)
```
Keys are normalized via `normalizeKey()`:
- `tag / tags` → `Tags`
- `category / categories` → `Categories`
- `loc / location / locations` → `Location`
- `year / years / date` → `Year`
- Other keys → Title-cased

**Subcategory syntax:** Values containing `>` are split into parent/child:
- Input: `Interiors > Residential`
- Stored as: parent `Interiors` (with Set of children) in `state.hierarchy`

**Filter aggregation (`aggregateFilters`):**
Builds two structures:
- `state.filters` (flat): `{ GroupKey: { value: [itemUrls] } }` — used for matching
- `state.hierarchy` (nested): `{ GroupKey: { parent: [children] } }` — used for UI rendering

`Categories` group is always deleted from both after aggregation (it maps to Tags).

If `multipleFilterGroups` is `false`, only one group is rendered — preferring `Tags`, then `Categories`, then `Filter`, then the first key found.

### 4.3 Filter Engine

**`checkRule(domItem)`** — returns `true` if a DOM grid item passes all active filters AND search:
- Extracts `href` (or child `a[href]`) and strips query string.
- For each active filter group: checks if item URL exists in `state.filters[group][selectedValue]`.
- `OR` logic within a group: any selected value match passes.
- `AND` logic across groups: all groups must pass.
- Search check: matches `state.searchQuery` against `dataItem.searchText` (or fallback DOM text).

**`filterGrid(isLoadMore)`:**
1. Enforces single-select constraint (keeps last selected value if `allowMultiSelect` is false).
2. Calls `applyInitialOrderIfNeeded()` for random order.
3. Reads DOM grid items from `#gridThumbs`.
4. Optionally scrolls to main wrapper on filter change.
5. Runs `checkRule()` for each item → builds `state.filteredItems`.
6. Clamps `state.currentPage` to valid range.
7. Slices `filteredItems` to page limit → `state.visibleItems`.
8. Shows/hides items via `display: none` / `''`.
9. Assigns `--pf-anim-delay` CSS custom property per item.
10. Triggers `replayGridAnimationAfterFilterChange()`.
11. Shows/hides `#pf-no-results` element.
12. Calls `updatePaginationControls()`.

### 4.4 Layout System

**Two main layouts** (set by `CONFIG.layout`):

| Value | Description |
|---|---|
| `top` | Filter controls above grid, full width. Search/sort appear in a right-aligned column (topbar row). |
| `sidebar` | Filter controls in left column (default 30%), grid in right column (default 70%). |

**DOM structure built by `setupLayout()`:**
```
.portfolio-main-wrapper.layout-{top|sidebar}
  ├── .portfolio-control-panel        (inserted before content col)
  └── .portfolio-content-col
        └── #gridThumbs
```

**Width configuration (sidebar layout):**
- `sidebarWidthPercent` (default 30, range 10–90) → `--pf-sidebar-width`
- `gridWidthPercent` (default 70, range 10–90) → `--pf-grid-width`

**Squarespace section padding sync (`syncGridThumbsSpacingToWrapper`):**
- Reads computed `paddingTop`, `paddingBottom`, `minHeight` from `#gridThumbs`.
- Applies those values to `.portfolio-main-wrapper`.
- Sets `#gridThumbs` padding to `0` and `minHeight` to `auto`.
- Re-runs on body class change (Squarespace tweakable updates) and window resize.

**Section gutter class:** Adds `portfolio-section-has-main-wrapper` to the nearest `.content` ancestor for CSS targeting.

### 4.5 Control Panel (UI)

Built by `createControls()`. Removes any existing `.portfolio-control-panel` and rebuilds from scratch.

**Control panel classes added:**
- `layout-{filterLayout}` — always
- `preset-{stylePreset}` — if defined
- `pf-topbar` — if layout is `top`
- `pf-sticky` — if sticky sidebar enabled
- `pf-checkbox-dropdown` — if filterLayout is `checkbox` AND layout is `top`
- `inline-variant-text` — if filterLayout is `inline` AND desktopInlineVariant is `text`
- `pf-groups-1 / pf-groups-2 / pf-groups-3plus` — based on rendered group count

**Topbar structure (layout=top):**
```
.pf-topbar-row
  ├── .pf-topbar-left    ← filter groups
  └── .pf-topbar-right   ← search input + sort select
```

**Sidebar structure (layout=sidebar):**
Filter groups, then search, then sort — all in a single column.

**Filter group rendering per group:**
1. Skip `Categories` group.
2. Optionally skip if `hideSingleValueFilters` and only one parent with no children.
3. Create `.filter-group-container[data-group]`.
4. Render header (dropdown header button OR label paragraph).
5. Render options container (`.filter-dropdown-content` for dropdown, `.filter-options` for inline/checkbox).
6. Render "All" control (button or checkbox).
7. Render each parent, and if parent has children, render child sub-container.
8. Apply truncation if enabled.
9. Set initial open/closed state.

**Accessibility:**
- All interactive headers have `role="button"`, `tabindex="0"`, `aria-expanded`, `aria-controls`.
- `Enter` / `Space` key handlers on all toggleable headers.
- Filter option containers use `aria-hidden`.

### 4.6 Filter Interaction Modes

**Desktop filter layout** (set by `CONFIG.filterLayout`):

| Value | Behavior |
|---|---|
| `inline` | Buttons or text links rendered in a horizontal/wrapped row. Controlled by `desktopInlineVariant` (`buttons` \| `text`). |
| `dropdown` | Each filter group has a collapsed dropdown header. Clicking opens a panel containing the options. In topbar layout, panels are positioned absolutely. |
| `checkbox` | Options rendered as `<label><input type="checkbox">` elements. In topbar layout, acts as `pf-checkbox-dropdown` (checkbox options inside a dropdown panel). |

**Multi-select vs single-select:**
- `allowMultiSelect: false` (default) — selecting a new value deselects the previous one within the same group.
- `allowMultiSelect: true` — multiple values selectable per group; AND logic still applies across groups.

**Subcategory interaction:**
- Selecting a **parent** shows that parent's children in the UI (adds `.active` to `.filter-item-wrapper`).
- In single-select mode, selecting parent clears any previously selected child of that parent.
- Selecting a **child** (`parent > child` value) does NOT auto-select the parent — child is filtered strictly.
- Selecting child removes the broad parent selection from `activeFilters`.
- An "All [Parent]" sub-button exists to return to parent-level selection.
- In checkbox mode, the parent checkbox shows **indeterminate** state if any children are checked.

**Click handlers:**
- `handleGroupAllClick(group)` — clears all selections for a group.
- `handleParentClick(group, parent, children)` — toggles parent selection.
- `handleChildClick(group, parent, child)` — toggles child selection.

**Dropdown close behaviors:**
- Clicking outside a dropdown group closes all open groups (document click listener).
- `Escape` key closes all open dropdowns.
- In topbar layout on desktop, opening a new dropdown closes other open ones (`closeOtherOpenMenus`).

**`updateAllUI()`** — synchronizes all button `.active` states and checkbox checked/indeterminate states to match `state.activeFilters` and `state.activeSubFilters`.

### 4.7 Search

- Optional (controlled by `CONFIG.searchEnabled`).
- Renders a text `<input>` with `CONFIG.searchPlaceholder`.
- In topbar layout: placed in `.pf-topbar-right`.
- In sidebar layout: placed at the top of the control panel.
- On `input` event: updates `state.searchQuery` (lowercased), resets `state.currentPage = 1`, calls `filterGrid()`.
- Search scope: `item.searchText` = `[title, seoTitle, seoDescription].join(' ').toLowerCase()`.

### 4.8 Sorting

- Optional (controlled by `CONFIG.sortEnabled`). Defaults to `true` when layout is `top`.
- Renders a `<select>` with options:
  - `original` — original Squarespace order (or random order if enabled)
  - `asc` — Title A–Z
  - `desc` — Title Z–A
  - `date-newest` — Year descending (only if `displayYearInSort: true`)
  - `date-oldest` — Year ascending (only if `displayYearInSort: true`)
- Default sort order: `CONFIG.defaultSortOrder` (default `'original'`).
- `sortGrid()` re-orders DOM items and calls `filterGrid()`.

**Random order (`CONFIG.randomOrder`):**
- On load, shuffles item IDs into a `randomOrderMap`.
- `applyInitialOrderIfNeeded()` re-orders DOM items once based on this map.
- Used as the "original" order when sort is `original` and random is enabled.

### 4.9 Pagination

Controlled by `CONFIG.pagination`:

```js
pagination: {
  type: 'none' | 'loadMore',   // 'infinite' exists in CSS/preview but maps to 'none' in generator
  itemsPerPage: 12,
  loadMoreLabel: 'Load More',
  showProgress: true
}
```

**`type: 'none'`** — all filtered items shown at once.

**`type: 'loadMore'`:**
- Shows first `itemsPerPage * currentPage` items.
- Appends a `.portfolio-pagination-container` with optional progress text and a Load More button.
- Button click: `state.currentPage++`, calls `filterGrid(true)` (isLoadMore = true skips animation reset for already-visible items).
- Progress text format: `"Showing X of Y Projects"`.

**`type: 'infinite'` (in CSS/preview):**
- Appends a sentinel `div#portfolio-infinite-marker`.
- IntersectionObserver on the marker triggers `state.currentPage++` and `filterGrid(true)`.
- Note: the Config Dashboard currently maps this to `'none'` in generated code (not yet exposed as a user option).

Pagination container is appended to `.portfolio-content-col` (or `gridWrapper.parentNode` as fallback).

### 4.10 Meta Injection

**`injectMetaToGrid()`** — runs once after data loads; injects metadata elements into each `.portfolio-text` wrapper inside `.grid-item`.

**Injected elements use class `portfolio-item-injected`** so they can be cleaned up and re-injected on SWR refresh.

**Meta layout positions** (set by `metaDisplay.metaLayout`):

| Value | CSS Class | Behavior |
|---|---|---|
| `stacked-above` | `meta-layout-stacked-above` | Meta wrapper inserted before title element |
| `stacked-below` | `meta-layout-stacked-below` | Meta wrapper inserted after title element |
| `split` | `meta-layout-split` | Grid layout; meta aligned right of title |
| `overlay-top-left` | `meta-layout-overlay-top-left` | Meta absolutely positioned top-left of image |
| `overlay-top-right` | `meta-layout-overlay-top-right` | Meta absolutely positioned top-right of image |

**Displayable meta fields:**

| Config Key | Description |
|---|---|
| `metaDisplay.showTags` | Shows Tags/Categories/Filter values |
| `metaDisplay.showYear` | Shows Year value |
| `metaDisplay.showLocation` | Shows Location value |
| `metaDisplay.showExcerpt` | Shows cleaned excerpt (SEO text with key:value removed) |
| `metaDisplay.showCustomMeta` | Shows arbitrary custom fields by key name |
| `metaDisplay.customMetaFields` | Comma-separated list of custom field keys (e.g. `"Client, Author"`) |

**Tag display styles:**
- `text` — values joined by delimiter string
- `pills` / `badges` — each value in its own `<span>` styled as a badge

**Tag delimiter modes** (`metaDisplay.tagDelimiterMode`):
- `space` (default), `comma`, `pipe`, `slash`, `dot`, `custom`
- Custom delimiter: `metaDisplay.tagDelimiterCustom`

**Meta label display:**
- `CONFIG.showMetaLabels: true` → adds class `pf-show-meta-labels` to `<body>`, revealing `<span class="custom-tag-{key}">` label elements.

**Custom field DOM structure:**
```html
<div class="custom-tag-{safekey}-wrapper portfolio-meta-item portfolio-item-injected">
  <span class="custom-tag-{safekey}">{Label}: </span>
  <span class="custom-tag-value">{Value}</span>
</div>
```

### 4.11 Animation System

Controlled by `CONFIG.gridAnimation`, `CONFIG.animationSpeed`, `CONFIG.animationStagger`.

**Animation modes:**
- `none` — no animation, items appear instantly
- `fade` — opacity 0 → 1
- `fade-up` — opacity 0 + translateY(10px) → visible (default)
- `zoom` — opacity 0 + scale(0.97) → visible

**Classes applied to `#gridThumbs`:**
- `pf-anim` — enables the animation system
- `pf-anim-{mode}` — sets initial hidden state via CSS
- `.pf-anim-visible` — added to each item when it enters viewport (via IntersectionObserver)

**Speed:**
- `slow` → `0.8s`, `normal` → `0.5s` (default), `fast` → `0.3s`
- Applied as `--pf-anim-duration` CSS custom property on `#gridThumbs`.

**Stagger:**
- When `animationStagger: true`, each item gets `--pf-anim-delay: {index * 60}ms`.
- Delay resets on every filter change.

**`replayGridAnimationAfterFilterChange()`:**
- Strips `pf-anim-visible` and transition from all visible items.
- Forces reflow.
- Re-adds delays in a `requestAnimationFrame`.
- Items in viewport get `pf-anim-visible` immediately; out-of-viewport items are observed by IntersectionObserver.
- Also handles truncation toggle — if a hidden filter item is active, auto-expands the truncation.

**CSS safety timer:**
```css
#gridThumbs {
  animation: pfSafetyReveal 0.5s ease 3s forwards;
}
```
Reveals content automatically after 3 seconds if JS crashes.

### 4.12 URL State Management

Filter state is reflected in the URL query string for shareability and browser back/forward support.

**`updateUrl()`** — uses `window.history.replaceState`:
- Active filter values serialized as: `?{GroupKey}={val1},{val2}`
- Subcategory `parent > child` encoded as `parent--child` (double-hyphen) in URL.

**`readUrlParams()`:**
- Reads `URLSearchParams` on load.
- Decodes `--` back to ` > `.
- Populates `state.activeFilters` and `state.activeSubFilters`.
- Calls `updateAllUI()`.

**`handleUrlChange()`:**
- Triggered on `popstate`.
- Calls `readUrlParams()` then `filterGrid()`.

### 4.13 Responsive / Mobile Behavior

**Breakpoint:** `1024px` (desktop = `≥ 1024px`, mobile = `< 1024px`).

**Responsive listener:** Debounced resize handler (150ms) calls `applyResponsiveMode()`.

**Mobile display styles** (set by `CONFIG.mobile.displayStyle`):

| Value | CSS Class Added | Description |
|---|---|---|
| `chips` | `mobile-style-chips` | Horizontal scrollable row of filter buttons |
| `wrap` | `mobile-style-wrap` | Buttons wrap to multiple lines (default) |
| `checkbox` | `mobile-style-checkbox` | Checkbox list, stacked vertically |

**Mobile behavior** (set by `CONFIG.mobile.behavior`):

| Value | CSS Class Added | Description |
|---|---|---|
| `none` | — | All filter groups always visible |
| `accordion` | `mobile-behavior-accordion` | Filter group headers become toggles; options collapse/expand with height animation |
| `checkbox` | Sets `displayStyle: 'checkbox'` | Implies checkbox layout |

**Sidebar layout on mobile:**
- Sidebar collapses to full-width stacked layout automatically at breakpoint.
- Sticky sidebar disabled on mobile.

**Accordion state sync:**
- `syncAccordionStateForMobile()` — ensures closed groups have `maxHeight: 0` and `aria-hidden: true`.
- `syncAccordionStateForDesktop()` — removes all accordion state (forces groups open, removes `max-height`).
- These are called on resize to switch between modes without re-rendering.

### 4.14 Performance & Safety

**IntersectionObserver (`setupItemObserver`):**
- `rootMargin: '0px 0px -50px 0px'` — items animate in slightly before they fully enter viewport.
- On intersection: removes custom opacity/transform styles, adds `pf-anim-visible`, unobserves item.

**MutationObserver (`bodyClassObserver`):**
- Watches `document.body` class changes (Squarespace tweakable system changes body classes).
- On change: re-syncs grid spacing.

**Debouncing:**
- Resize events debounced at 150ms (two separate debounce IDs for responsive mode and layout sync).

**Squarespace image loader compatibility:**
- On `revealContent()`: dispatches `resize` event and calls `window.ImageLoader.loadAllImages()` if available.
- Also calls `window.Squarespace.initializeTweakable()` if available.

**Body ready state (`applyBodyReady`):**
- Adds `pf-ready` class to `<body>`.
- CSS uses `body.pf-ready #gridThumbs { opacity: 1 !important }` to reveal grid.
- Guarded against double-application.

**Reveal safety fallbacks:**
- `setTimeout(revealContent, 1000)` — content revealed after 1 second regardless.
- CSS `@keyframes pfSafetyReveal` applied to `#gridThumbs` with 3-second delay — reveals grid even if JS crashes entirely.

### 4.15 Configuration Reference

All config is set via `window.PORTFOLIO_CONFIG` before the script loads. Deep merged with `DEFAULT_CONFIG`.

```js
window.PORTFOLIO_CONFIG = {
  // Data
  dataSource: '{page-path}?format=json',  // auto-detected
  cacheKey: 'portfolio-data-v1',

  // Layout
  layout: 'top',                          // 'top' | 'sidebar'
  filterLayout: 'inline',                 // 'inline' | 'dropdown' | 'checkbox'
  desktopInlineVariant: 'buttons',        // 'buttons' | 'text' (only for inline)
  sidebarWidthPercent: 30,
  gridWidthPercent: 70,
  stickySidebar: false,
  stickyTopSpacing: 20,

  // Filter behavior
  multipleFilterGroups: true,
  allowMultiSelect: false,
  hideSingleValueFilters: false,
  showFilterLabel: true,
  showItemCounts: false,
  showResetButton: false,

  // Truncation
  truncateFilters: false,
  truncateMax: 5,
  truncateToggle: { fontSize: 14, textColor: '#333' },
  textLabels: {
    showMore: 'Show more',
    showLess: 'Show less'
  },

  // Search & Sort
  searchEnabled: true,
  sortEnabled: false,          // true when layout='top' if not explicitly set
  displayYearInSort: true,
  defaultSortOrder: 'original', // 'original' | 'asc' | 'desc' | 'date-newest' | 'date-oldest'
  randomOrder: false,

  // Pagination
  pagination: {
    type: 'none',              // 'none' | 'loadMore'
    itemsPerPage: 12,
    loadMoreLabel: 'Load More',
    showProgress: true
  },

  // Animation
  gridAnimation: 'fade-up',   // 'none' | 'fade' | 'fade-up' | 'zoom'
  animationSpeed: 'normal',   // 'slow' | 'normal' | 'fast'
  animationStagger: true,

  // Text labels
  allText: 'All',
  resetText: 'Reset All',
  searchPlaceholder: 'Search projects...',
  sortText: 'Sort By',
  defaultFilterName: 'Tags',
  noResultsText: 'No results found.',
  textLabels: {
    // Overrides for all of the above
  },

  // Mobile
  mobile: {
    displayStyle: 'wrap',     // 'chips' | 'wrap' | 'checkbox'
    behavior: 'none'          // 'none' | 'accordion' | 'checkbox'
  },

  // Meta display
  metaDisplay: {
    showTags: false,
    showYear: false,
    showLocation: false,
    showExcerpt: true,
    showCustomMeta: false,
    customMetaFields: '',      // 'Client, Author' etc.
    tagDelimiterMode: 'space', // 'space' | 'comma' | 'pipe' | 'slash' | 'dot' | 'custom'
    tagDelimiterCustom: '',
    metaLayout: 'stacked-above'
  },
  showMetaLabels: false,

  // Tag display style
  tagStyle: {
    style: 'text',             // 'text' | 'pills'
    bg: '#f0f0f0',
    text: '#333',
    radius: 4,
    borderWidth: 0,
    borderColor: '#cccccc',
    padX: 6,
    padY: 2,
    fontSize: 14
  },

  // Filter button visual styles
  styles: {
    stylePreset: 'buttons',   // 'buttons' | 'underline' | 'minimal'
    align: 'left',            // 'left' | 'center' | 'right'
    gap: 10,
    marginBottom: 30,
    radius: 4,
    borderWidth: 1,
    borderStyle: 'solid',
    paddingVertical: 8,
    paddingHorizontal: 16,
    colorDefault: { bg: 'transparent', text: '#555', border: '#ddd' },
    colorHover:   { bg: 'transparent', text: '#333', border: '#999' },
    colorActive:  { bg: '#333',        text: '#fff', border: '#333' },
    fontFamily: 'inherit',
    fontSize: 14,
    textTransform: 'none',
    letterSpacing: 0,
    separator: '/',           // used by 'minimal' preset
    separatorColor: '#ccc'
  }
}
```

---

## 5. Core Plugin — CSS

**File:** `portfolio-filter-v2.css`

All visual customization is driven by **CSS custom properties** (injected by JS `applyDynamicStyles()`). The CSS file contains only structural rules and references variables — no hardcoded color or spacing values except defaults.

### Layout Classes

| Class | Description |
|---|---|
| `.portfolio-main-wrapper` | Outer flex container for the full plugin |
| `.portfolio-main-wrapper.layout-sidebar` | Side-by-side, 4% gap between panel and grid |
| `.portfolio-main-wrapper.layout-top` | Stacked column |
| `.portfolio-control-panel` | Filter panel container |
| `.portfolio-content-col` | Grid container column |
| `.pf-sticky-enabled` | Enables sticky sidebar (requires `.layout-sidebar`) |
| `.pf-topbar` | Control panel in topbar mode |
| `.pf-checkbox-dropdown` | Checkbox options inside dropdown panels |

### CSS Custom Properties (set by JS)

| Property | Description |
|---|---|
| `--pf-gap` | Gap between filter buttons |
| `--pf-group-gap` | Gap between filter groups |
| `--pf-radius` | Button border radius |
| `--pf-border-w`, `--pf-border-s` | Button border width and style |
| `--pf-pad-v`, `--pf-pad-h` | Button padding |
| `--pf-bg-def`, `--pf-text-def`, `--pf-border-def` | Default button colors |
| `--pf-bg-hov`, `--pf-text-hov`, `--pf-border-hov` | Hover button colors |
| `--pf-bg-act`, `--pf-text-act`, `--pf-border-act` | Active button colors |
| `--pf-font`, `--pf-font-size`, `--pf-transform`, `--pf-letter-spacing` | Typography |
| `--pf-align` | `justify-content` value for filter option rows |
| `--pf-mobile-wrap`, `--pf-mobile-overflow` | Mobile scroll/wrap behavior |
| `--pf-separator`, `--pf-separator-color` | Minimal preset separator |
| `--pf-sticky-top` | Sticky sidebar top offset |
| `--pf-sidebar-width`, `--pf-grid-width` | Layout column widths |
| `--pf-tag-*` | Tag/badge styling properties |
| `--pf-truncate-font-size`, `--pf-truncate-text-color` | Truncation toggle button |
| `--pf-anim-duration`, `--pf-anim-delay-step` | Animation timing |
| `--pf-anim-delay` | Per-item stagger delay (set inline on each item) |

### Style Presets

| Class | Behavior |
|---|---|
| `.preset-buttons` | Standard bordered buttons (default) |
| `.preset-underline` | Bottom border only, transparent background, no radius |
| `.preset-minimal` | No border, no background, items separated by `--pf-separator` via `::after` |

### Animation Classes

| Class | Description |
|---|---|
| `.pf-anim` | Applied to `#gridThumbs`; enables animation system |
| `.pf-anim-none` | Disables all animation |
| `.pf-anim-fade` | Items start `opacity: 0` |
| `.pf-anim-fade-up` | Items start `opacity: 0; transform: translateY(10px)` |
| `.pf-anim-zoom` | Items start `opacity: 0; transform: scale(0.97)` |
| `.pf-anim-visible` | Added when item enters viewport — resets opacity and transform |

### Sticky Sidebar

- Applied to `.pf-sticky-enabled.layout-sidebar .portfolio-control-panel`.
- Uses `position: sticky`, `top: var(--pf-sticky-top)`, `max-height: calc(100vh - top - 20px)`, `overflow-y: auto`.
- Scrollbar hidden by default, revealed on hover (thin, 4px, rgba track).

### Truncation

- `.pf-truncated` — hidden items class.
- `.pf-truncate-hidden` — container for hidden items; height animated via JS.
- `.pf-truncate-toggle` / `.pf-truncate-btn` — styled as underline text links.

### Meta Injection Styles

| Class | Description |
|---|---|
| `.portfolio-meta-wrapper` | Flex row containing all meta items |
| `.portfolio-meta-item` | Individual meta value |
| `.portfolio-item-tags` | Tags container |
| `.portfolio-item-year` | Year element |
| `.portfolio-item-location` | Location element |
| `.portfolio-item-excerpt` | Excerpt paragraph |
| `.portfolio-item-custom-meta` | Custom field container |
| `.pf-tag-style-pills .portfolio-meta-wrapper .portfolio-meta-item` | Badge/pill styling |

### Mobile Responsive Overrides

At `max-width: 1023px`:
- Sidebar layout collapses to stacked column.
- `mobile-style-chips` → `flex-wrap: nowrap; overflow-x: auto`
- `mobile-style-wrap` → `flex-wrap: wrap`
- `mobile-style-checkbox` → column layout
- `mobile-behavior-accordion` → groups collapsible with max-height animation

At `min-width: 1024px`:
- All mobile style overrides reset to `flex-wrap: wrap; overflow: visible`.

---

## 6. Configuration Dashboard

**File:** `config-generator-v3.html`

A fully self-contained single-page application. No server required. Designed to be delivered to buyers as a downloadable or hosted HTML file.

### Interface Layout

| Area | Description |
|---|---|
| Left sidebar (340px) | All settings, organized in collapsible groups |
| Top bar | Desktop/Mobile preview toggle + Copy Code button |
| Preview canvas | Live WYSIWYG mock of the configured plugin |
| Code drawer (250px) | Read-only generated installation snippet |
| Mobile: Tabs | Settings / Preview / Code tabs (bottom tab bar) |

### Sidebar Setting Groups

Each group is collapsible (chevron toggle). Groups:

1. **Layout & Structure** — main layout, sticky sidebar, filter groups, filter label, sidebar/grid width percentages
2. **Styling & Colors** — preset theme, alignment, gap/margin, radius, border, padding, 3 active/default color pickers
3. **Grid Item Meta** — meta layout position, tag style, tag delimiter, show/hide toggles for each meta type, custom field keys, meta labels
4. **Text Labels** — all user-visible string overrides
5. **Motion** — animation mode, speed, stagger
6. **Advanced Behavior** — desktop filter style, mobile filter style, search, sort, reset, multi-select, item counts, truncation settings, default sort, random order, pagination

### Preview Engine

The dashboard renders a **mock preview** using generated sample data (60 items with Tags, Location, Year, Author, Client). It is a completely independent reimplementation of the plugin's rendering logic in vanilla JS — not an iframe of the real plugin.

**Mock data fields:**
- Tags: `['Branding', 'Architecture', 'Interiors', 'Photography']` (cycling)
- Locations: `['Miami', 'Austin', 'NYC', 'LA']`
- Years: `[2022, 2023, 2024, 2025]`
- Author: `['Alex Kim', 'Jordan Lee', 'Taylor Morgan', 'Riley Chen']`
- Client: `['Google', 'Apple', 'Nike', 'Tesla']`

**Preview capabilities:**
- Desktop (full width) and Mobile (375px phone frame) preview modes
- All filter layouts rendered (inline buttons, text, dropdown, checkbox)
- Mobile display style previews (chips, wrap, accordion, checkbox)
- Dropdown open/close with click-outside and escape handling
- Truncation with animated expand/collapse
- Sorting (A-Z, Z-A, Year, Random)
- Search filtering
- Load More pagination
- Meta injection with all layout positions
- Tag pill styling
- Sticky sidebar simulation
- Entrance animation replay on filter change

**State persistence within preview:**
- `groupOpenState` — preserves which dropdown groups are open across re-renders
- `previewRandomMap` — stable shuffle order for random mode
- Search input focus and cursor position preserved across re-renders

### `updateAll()` Function

Called on every input event across all sidebar controls. It:
1. Resolves dependent UI states (shows/hides conditional controls).
2. Builds the `config` object from all form values.
3. Calls `renderMock()` to update the preview.
4. Calls `generateCode()` to update the code drawer.

### `generateCode()` Function

Produces the installable HTML snippet:
```js
const js = `
<style>#gridThumbs{opacity:0;transition:opacity 0.2s ease;}</style>
<link rel="stylesheet" href="portfolio-filter-v2.css">
<script>
window.PORTFOLIO_CONFIG = ${JSON.stringify(cfg, null, 4)};
<\/script>
<script src="portfolio-filter-v2.js" defer><\/script>`
```

Note: CDN URLs are currently placeholder paths (`portfolio-filter-v2.css` / `.js`). These need to be updated to real CDN URLs before distributing to buyers.

### Desktop Filter Style Selector Logic

The dashboard uses a single **"Desktop Filter Style"** dropdown that maps to two internal hidden fields:

| Selected Value | `filterLayout` | `desktopInlineVariant` |
|---|---|---|
| Buttons | `inline` | `buttons` |
| Minimal Text | `inline` | `text` |
| Dropdown | `dropdown` | `buttons` |
| Checkboxes | `checkbox` | `buttons` |

### Mobile Filter Style Selector Logic

| Selected Value | `mobile.displayStyle` | `mobile.behavior` |
|---|---|---|
| Horizontal Chips | `chips` | `none` |
| Stacked Wrap | `wrap` | `none` |
| Accordion | `wrap` | `accordion` |
| Checkbox | `checkbox` | `checkbox` |

---

## 7. Generated Code Output

The buyer copies a snippet from the Config Dashboard and pastes it into Squarespace. The snippet must be placed:

- In **Site Settings → Advanced → Code Injection → Footer**, OR
- In a **Code Block** on the portfolio page

**Snippet components:**
1. Inline `<style>` to immediately hide `#gridThumbs` (prevents flash of unstyled content).
2. `<link>` to CDN CSS file.
3. `<script>` setting `window.PORTFOLIO_CONFIG` with the full JSON config.
4. `<script defer>` loading the CDN JS file.

**The CDN JS file must be loaded after `window.PORTFOLIO_CONFIG` is set.** The `defer` attribute ensures DOMContentLoaded fires after both scripts are parsed.

---

## 8. SEO Data Format (Content Schema)

Users embed filter metadata directly in Squarespace's **SEO Title** and **SEO Description** fields for each portfolio item, using a `Key: Value` format.

**Syntax:**
```
Tags: Branding Photography | Location: NYC | Year: 2024
Client: Google | Budget: 50k
```

**Delimiter rules between key-value pairs:**
- `|`, `;`, `.`, or newline — any of these separates pairs

**Multi-value tags:**
- Values within a Tags/Categories/Filter key are split by the configured tag delimiter (space, comma, pipe, slash, dot, custom).

**Subcategory syntax (for Tags/Filter keys):**
```
Tags: Interiors > Residential Photography Branding
```
- `>` followed by a word creates a parent-child relationship.
- Results in `Interiors` as parent and `Residential` as child in filter hierarchy.
- In space-delimiter mode, the `>` symbol is detected and adjacent tokens are grouped.

**Supported built-in keys** (case-insensitive, normalized):
- `Tags` / `Tag` → `Tags` filter group
- `Categories` / `Category` → `Categories` (merged into Tags, excluded from UI)
- `Filter` → `Tags` group (alias)
- `Location` / `Loc` / `Locations` → `Location` filter group (treated as single value)
- `Year` / `Date` / `Years` → `Year` filter group

**Custom keys:**
Any other `Key: Value` pairs are parsed and stored in `parsedCustom`. They can be:
- Used as additional filter groups (if enabled via `multipleFilterGroups`)
- Displayed as meta on grid items via `customMetaFields` config

---

## 9. Known Constraints & Squarespace Integration Notes

| Constraint | Detail |
|---|---|
| Portfolio JSON endpoint | `{page-url}?format=json` must return `{ items: [...] }`. This is a standard Squarespace endpoint available on Portfolio pages. |
| `#gridThumbs` | The plugin requires this specific DOM element ID, which Squarespace uses for its portfolio grid. |
| `.grid-item` | Each portfolio item must have this class (standard in Squarespace templates). |
| `.portfolio-text` | Meta injection requires this inner text container class. |
| Mercury navigation | Squarespace uses client-side routing (`mercury:load` event). The plugin re-initializes on this event. |
| Image loading | Squarespace's lazy image loader may need to be re-triggered after filter changes. Plugin dispatches `resize` event and calls `window.ImageLoader.loadAllImages()` on reveal. |
| Body class changes | Squarespace's tweakable system may modify `document.body` classes. Plugin uses a MutationObserver to re-sync layout on these changes. |
| Code injection location | Injecting in the page footer (or after `#gridThumbs` in DOM order) is required. Header injection may cause `#gridThumbs` not to exist yet. |
| CORS / JSON endpoint | The `?format=json` endpoint must be accessible from the page origin. No CORS issues expected on same-origin Squarespace pages. |
| `localStorage` | Used for SWR cache. Will fail gracefully (try/catch) if storage is full or blocked. |

---

## 10. Feature Status Summary

| Feature | Status |
|---|---|
| Top layout | ✅ Implemented |
| Sidebar layout (30/70) | ✅ Implemented |
| Inline button filter | ✅ Implemented |
| Inline text filter | ✅ Implemented |
| Dropdown filter | ✅ Implemented |
| Checkbox filter | ✅ Implemented |
| Checkbox-in-dropdown (top layout) | ✅ Implemented |
| Multi-group filtering | ✅ Implemented |
| Single-select per group | ✅ Implemented |
| Multi-select per group | ✅ Implemented |
| Subcategory (parent > child) | ✅ Implemented |
| Full-text search | ✅ Implemented |
| Sorting (A-Z, Z-A, date) | ✅ Implemented |
| Random order | ✅ Implemented |
| Load More pagination | ✅ Implemented |
| Infinite scroll pagination | ⚠️ Partially implemented (CSS/JS), not exposed in Config Dashboard |
| URL state (shareable links) | ✅ Implemented |
| SWR caching | ✅ Implemented |
| Meta injection (tags, year, location, excerpt) | ✅ Implemented |
| Meta injection (custom fields) | ✅ Implemented |
| Tag delimiter modes | ✅ Implemented |
| Tag pill/badge style | ✅ Implemented |
| Meta layout positions (5 options) | ✅ Implemented |
| Meta labels toggle | ✅ Implemented |
| Grid animation (fade, fade-up, zoom) | ✅ Implemented |
| Animation stagger | ✅ Implemented |
| Animation speed control | ✅ Implemented |
| Sticky sidebar | ✅ Implemented |
| Filter truncation (show more/less) | ✅ Implemented |
| Mobile chips layout | ✅ Implemented |
| Mobile wrap layout | ✅ Implemented |
| Mobile checkbox layout | ✅ Implemented |
| Mobile accordion behavior | ✅ Implemented |
| Item count display | ✅ Implemented |
| Reset button | ✅ Implemented |
| "Hide if single option" | ✅ Implemented |
| Show/hide filter label | ✅ Implemented |
| Style presets (buttons, underline, minimal) | ✅ Implemented |
| Color customization (active/default) | ✅ Implemented |
| Hover state (default only, no picker) | ⚠️ Hardcoded in CSS; hover colors not exposed in Config Dashboard |
| Font family, size, transform, letter-spacing | ✅ In CONFIG, not exposed in Config Dashboard |
| Config Dashboard WYSIWYG preview | ✅ Implemented |
| Config Dashboard mobile preview | ✅ Implemented |
| Config Dashboard copy code | ✅ Implemented |
| CDN URL in generated snippet | ⚠️ Placeholder paths — needs real CDN URLs |
| Safety reveal (CSS timer + 1s JS fallback) | ✅ Implemented |
| Mercury (AJAX nav) support | ✅ Implemented |
| Squarespace image loader compatibility | ✅ Implemented |
| Keyboard accessibility (Enter/Space/Escape) | ✅ Implemented |
| ARIA attributes | ✅ Implemented |
