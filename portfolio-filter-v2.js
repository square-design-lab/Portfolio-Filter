(function () {
    /*
      Squarespace Portfolio Filter Ultimate v3.4 (Final Fixes)
      - Features: SWR, Subcategories, Lazy Loading, Dynamic Styling, Sidebar 30/70
      - Fixes: Layouts(Check/Drop), Subcat Logic, URL Format, Subcat Grouping, Delimiter
    */

    const DEFAULT_CONFIG = {
        dataSource: window.location.protocol === 'file:' || window.location.origin === 'null' ? 'portfolio-data.json' : window.location.pathname + '?format=json',
        layout: 'top',
        filterLayout: 'inline', // inline, dropdown, checkbox
        desktopInlineVariant: 'buttons', // buttons | text

        searchEnabled: true,
        sortEnabled: false,
        multipleFilterGroups: true,
        allowMultiSelect: false,
        showItemCounts: false,
        showResetButton: false,
        displayYearInSort: true,
        defaultSortOrder: 'original',
        hideSingleValueFilters: false,
        showFilterLabel: true,
        randomOrder: false, // Shuffle items once on load when true
        gridAnimation: 'fade-up', // none, fade, fade-up, zoom
        animationSpeed: 'normal', // slow, normal, fast
        animationStagger: true,

        pagination: {
            type: 'none',
            itemsPerPage: 12,
            loadMoreLabel: 'Load More',
            showProgress: true
        },

        styles: {
            stylePreset: 'buttons',
            align: 'left',
            gap: 10,
            marginBottom: 30,
            mobileStack: false,

            radius: 4,
            borderWidth: 1,
            borderStyle: 'solid',
            paddingVertical: 8,
            paddingHorizontal: 16,

            colorDefault: { bg: 'transparent', text: '#555', border: '#ddd' },
            colorHover: { bg: 'transparent', text: '#333', border: '#999' },
            colorActive: { bg: '#333', text: '#fff', border: '#333' },

            fontFamily: 'inherit',
            fontSize: 14,
            textTransform: 'none',
            letterSpacing: 0,

            separator: '/',
            separatorColor: '#ccc'
        },

        metaDisplay: {
            showTags: false,
            showYear: false,
            showLocation: false,
            showExcerpt: true,
            showCustom: true, // legacy author toggle (kept for backwards compatibility)
            showCustomMeta: false, // renders key/value spans for requested meta
            customMetaFields: '', // comma-separated keys from SEO data
            tagDelimiterMode: 'space',
            tagDelimiterCustom: '',
            metaLayout: 'stacked-above'
        },
        showMetaLabels: false,
        sidebarWidthPercent: 30,
        gridWidthPercent: 70,

        allText: 'All',
        resetText: 'Reset All',
        searchPlaceholder: 'Search projects...',
        sortText: 'Sort By',
        defaultFilterName: 'Tags',
        noResultsText: 'No results found.', // Customizable empty state copy

        mobile: {
            displayStyle: 'wrap', // chips, wrap, checkbox
            behavior: 'none' // accordion or checkbox
        },
        stickySidebar: false, stickyTopSpacing: 20, truncateFilters: false, truncateMax: 5,
        textLabels: { showMore: 'Show more', showLess: 'Show less' },
        tagStyle: { style: 'text', bg: '#f0f0f0', text: '#333', radius: 4, borderWidth: 0, borderColor: '#cccccc', padX: 6, padY: 2, fontSize: 14 },
        truncateToggle: { fontSize: 14, textColor: '#333' },

        cacheKey: 'portfolio-data-v1'
    };

    const CONFIG = { ...DEFAULT_CONFIG, ...(window.PORTFOLIO_CONFIG || {}) };

    // Deep merge
    if (window.PORTFOLIO_CONFIG?.styles) CONFIG.styles = { ...DEFAULT_CONFIG.styles, ...window.PORTFOLIO_CONFIG.styles };
    if (window.PORTFOLIO_CONFIG?.pagination) CONFIG.pagination = { ...DEFAULT_CONFIG.pagination, ...window.PORTFOLIO_CONFIG.pagination };
    if (window.PORTFOLIO_CONFIG?.metaDisplay) CONFIG.metaDisplay = { ...DEFAULT_CONFIG.metaDisplay, ...window.PORTFOLIO_CONFIG.metaDisplay };
    if (window.PORTFOLIO_CONFIG?.mobile) CONFIG.mobile = { ...DEFAULT_CONFIG.mobile, ...window.PORTFOLIO_CONFIG.mobile };
    if (window.PORTFOLIO_CONFIG?.textLabels) CONFIG.textLabels = { ...DEFAULT_CONFIG.textLabels, ...window.PORTFOLIO_CONFIG.textLabels };
    if (window.PORTFOLIO_CONFIG?.tagStyle) CONFIG.tagStyle = { ...DEFAULT_CONFIG.tagStyle, ...window.PORTFOLIO_CONFIG.tagStyle };
    if (window.PORTFOLIO_CONFIG?.truncateToggle) CONFIG.truncateToggle = { ...DEFAULT_CONFIG.truncateToggle, ...window.PORTFOLIO_CONFIG.truncateToggle };
    if (typeof window.PORTFOLIO_CONFIG?.sortEnabled !== 'boolean') {
        CONFIG.sortEnabled = (CONFIG.layout || '').toLowerCase() === 'top';
    }

    const TEXT = {
        allText: CONFIG.textLabels?.allText ?? CONFIG.allText ?? 'All',
        resetText: CONFIG.textLabels?.resetText ?? CONFIG.resetText ?? 'Reset All',
        searchPlaceholder: CONFIG.textLabels?.searchPlaceholder ?? CONFIG.searchPlaceholder ?? 'Search projects...',
        sortText: CONFIG.textLabels?.sortText ?? CONFIG.sortText ?? 'Sort By',
        defaultFilterName: CONFIG.textLabels?.defaultFilterName ?? CONFIG.defaultFilterName ?? 'Tags',
        showMore: CONFIG.textLabels?.showMore ?? 'Show more',
        showLess: CONFIG.textLabels?.showLess ?? 'Show less'
    };
    const TAG_STYLE = (CONFIG.tagStyle?.style || 'text').toLowerCase();
    const IS_TAG_PILL_STYLE = ['pill', 'pills', 'badge', 'badges'].includes(TAG_STYLE);
    CONFIG.metaDisplay.tagDelimiter = getTagDelimiterString();
    const ANIM_MODE = CONFIG.gridAnimation || 'fade-up';
    const ANIM_SPEED = CONFIG.animationSpeed || 'normal';
    const ANIM_STAGGER = CONFIG.animationStagger !== false;
    const NO_RESULTS_TEXT = CONFIG.noResultsText ?? CONFIG.textLabels?.noResultsText ?? 'No results found.';
    const ALL_OPTION_VALUE = '__all__';

    let state = {
        items: [],
        filteredItems: [],
        visibleItems: [],
        filters: {},
        hierarchy: {},
        activeFilters: {},
        activeSubFilters: {},
        searchQuery: '',
        sortOrder: (!CONFIG.displayYearInSort && CONFIG.defaultSortOrder.startsWith('date')) ? 'original' : CONFIG.defaultSortOrder,
        currentPage: 1,
        isRevealed: false
    };

    let styleTagId = 'portfolio-dynamic-styles';
    let itemObserver;

    const MOBILE_BREAKPOINT = 1024;
    const DESKTOP_MEDIA_QUERY = `(min-width: ${MOBILE_BREAKPOINT}px)`;
    let resizeDebounceId;
    let resizeHandlerAttached = false;
    let resizeHandler;
    const PORTFOLIO_SECTION_CLASS = 'portfolio-section-has-main-wrapper';
    let bodyClassObserver;
    let layoutSyncResizeAttached = false;
    let layoutSyncDebounceId;
    let layoutSyncHandler;
    let randomOrderMap = null;
    let randomOrderApplied = false;
    let wrapperRevealDone = false;
    let allowScrollToGrid = false;
    let bodyReadyApplied = false;
    let checkboxDropdownListenersAttached = false;
    let checkboxDropdownDocHandler;
    let checkboxDropdownKeyHandler;
    let topbarDropdownListenersAttached = false;
    let topbarDropdownDocHandler;
    let topbarDropdownKeyHandler;

    document.addEventListener('DOMContentLoaded', initFilter);
    window.addEventListener('mercury:load', initFilter);
    window.addEventListener('popstate', handleUrlChange);

    function initFilter() {
        applyDynamicStyles();
        setupItemObserver();
        syncPortfolioSectionStyling();
        setTimeout(applyBodyReady, 1500);
        window.addEventListener('beforeunload', cleanup);

        const gridWrapper = document.getElementById('gridThumbs');
        if (gridWrapper) {
            gridWrapper.style.opacity = '0';
            // Transition handled by CSS class or style block
        }

        if (typeof window.MOCK_DATA !== 'undefined') {
            const processed = parseRawItems(window.MOCK_DATA);
            initializeWithItems(processed);
            revealContent();
            return;
        }

        const cached = localStorage.getItem(CONFIG.cacheKey);
        let cacheUsed = false;

        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                // Optimization: Check for processed items
                if (parsed.items && Array.isArray(parsed.items)) {
                    state.items = parsed.items;
                    initializeWithItems(state.items);
                    cacheUsed = true;
                    revealContent();
                }
            } catch (e) { console.warn('Cache error', e); }
        }

        // SWR: Fetch fresh data
        fetch(CONFIG.dataSource)
            .then(response => response.json())
            .then(freshData => {
                const freshItems = parseRawItems(freshData.items);

                if (cacheUsed) {
                    const currentSig = JSON.stringify(state.items.map(i => i.id || i.fullUrl));
                    const freshSig = JSON.stringify(freshItems.map(i => i.id || i.fullUrl));
                    if (currentSig === freshSig) {
                        return; // No change
                    }
                }

                // Update Cache with PROCESSED items
                localStorage.setItem(CONFIG.cacheKey, JSON.stringify({ timestamp: Date.now(), items: freshItems }));

                // Save state to restore position/filter after reload
                const savedState = {
                    activeFilters: { ...state.activeFilters },
                    activeSubFilters: { ...state.activeSubFilters },
                    searchQuery: state.searchQuery,
                    sortOrder: state.sortOrder,
                    currentPage: state.currentPage
                };

                initializeWithItems(freshItems);

                // Restore state
                state.activeFilters = savedState.activeFilters;
                state.activeSubFilters = savedState.activeSubFilters;
                state.searchQuery = savedState.searchQuery;
                state.sortOrder = savedState.sortOrder;
                state.currentPage = savedState.currentPage || 1;

                updateAllUI();
                const searchInput = document.querySelector('.search-group input');
                if (searchInput) searchInput.value = state.searchQuery;
                const sortSelect = document.querySelector('.sort-group select');
                if (sortSelect) sortSelect.value = state.sortOrder;

                filterGrid(false);
                if (!cacheUsed) revealContent();
            })
            .catch(err => {
                console.error('Error fetching Squarespace data:', err);
                if (!cacheUsed) revealContent();
            });

        setTimeout(revealContent, 1000);
    }

    function cleanup() {
        if (itemObserver) itemObserver.disconnect();
        if (bodyClassObserver) bodyClassObserver.disconnect();
        if (resizeDebounceId) clearTimeout(resizeDebounceId);
        if (layoutSyncDebounceId) clearTimeout(layoutSyncDebounceId);
        if (resizeHandler) window.removeEventListener('resize', resizeHandler);
        if (layoutSyncHandler) window.removeEventListener('resize', layoutSyncHandler);
        if (checkboxDropdownListenersAttached) {
            document.removeEventListener('click', checkboxDropdownDocHandler);
            document.removeEventListener('keydown', checkboxDropdownKeyHandler);
            checkboxDropdownListenersAttached = false;
        }
        if (topbarDropdownListenersAttached) {
            document.removeEventListener('click', topbarDropdownDocHandler);
            document.removeEventListener('keydown', topbarDropdownKeyHandler);
            topbarDropdownListenersAttached = false;
        }
    }

    function setupItemObserver() {
        if (itemObserver) itemObserver.disconnect();
        itemObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '';
                    entry.target.style.transform = '';
                    entry.target.classList.add('pf-anim-visible');
                    itemObserver.unobserve(entry.target);
                }
            });
        }, { rootMargin: '0px 0px -50px 0px' });
    }

    function refreshItemObserverTargets() {
        if (!itemObserver) return;
        const gridWrapper = document.getElementById('gridThumbs');
        if (!gridWrapper) return;
        const items = Array.from(gridWrapper.querySelectorAll('.grid-item'));
        items.forEach(item => {
            itemObserver.unobserve(item);
            if (!item.classList.contains('pf-anim-visible')) {
                itemObserver.observe(item);
            }
        });
    }

    function getPortfolioElements() {
        const gridWrapper = document.getElementById('gridThumbs');
        const mainWrapper = document.querySelector('.portfolio-main-wrapper');
        if (!gridWrapper || !mainWrapper) return null;
        return { gridWrapper, mainWrapper };
    }

    function syncGridThumbsSpacingToWrapper() {
        const elements = getPortfolioElements();
        if (!elements) return;
        const { gridWrapper, mainWrapper } = elements;

        // Clear overrides so Squarespace padding is measurable
        gridWrapper.style.paddingTop = '';
        gridWrapper.style.paddingBottom = '';
        gridWrapper.style.minHeight = '';

        const computed = window.getComputedStyle(gridWrapper);
        const paddingTop = computed.paddingTop;
        const paddingBottom = computed.paddingBottom;
        const minHeight = computed.minHeight;

        mainWrapper.style.paddingTop = paddingTop;
        mainWrapper.style.paddingBottom = paddingBottom;
        mainWrapper.style.minHeight = minHeight;

        gridWrapper.style.paddingTop = '0px';
        gridWrapper.style.paddingBottom = '0px';
        gridWrapper.style.minHeight = 'auto';
    }

    function tagPortfolioSectionContent() {
        const elements = getPortfolioElements();
        if (!elements) return;
        const { mainWrapper } = elements;
        const contentEl = mainWrapper.closest('.content');
        if (contentEl) contentEl.classList.add(PORTFOLIO_SECTION_CLASS);
    }

    function setupPortfolioSpacingObservers() {
        if (!getPortfolioElements()) return;
        if (!bodyClassObserver) {
            bodyClassObserver = new MutationObserver((mutations) => {
                if (mutations.some(m => m.attributeName === 'class')) {
                    syncGridThumbsSpacingToWrapper();
                }
            });
            bodyClassObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        }
        if (!layoutSyncResizeAttached) {
            layoutSyncHandler = () => {
                clearTimeout(layoutSyncDebounceId);
                layoutSyncDebounceId = setTimeout(syncGridThumbsSpacingToWrapper, 150);
            };
            layoutSyncResizeAttached = true;
            window.addEventListener('resize', layoutSyncHandler);
        }
    }

    function syncPortfolioSectionStyling() {
        if (!getPortfolioElements()) return;
        tagPortfolioSectionContent();
        syncGridThumbsSpacingToWrapper();
        setupPortfolioSpacingObservers();
    }

    function revealContent() {
        if (state.isRevealed) return;
        state.isRevealed = true;

        // Fix Squarespace Image Loader & Layout
        window.dispatchEvent(new Event('resize'));
        if (window.Squarespace && window.Squarespace.initializeTweakable) {
            window.Squarespace.initializeTweakable();
        }
        if (window.ImageLoader && window.ImageLoader.loadAllImages) {
            window.ImageLoader.loadAllImages();
        }

        const gridWrapper = document.getElementById('gridThumbs');
        if (gridWrapper) gridWrapper.style.opacity = '1';
        const controlPanel = document.querySelector('.portfolio-control-panel');
        if (controlPanel) {
            controlPanel.style.opacity = '0';
            controlPanel.style.animation = 'fadeIn 0.5s ease forwards';
        }
    }

    function applyBodyReady() {
        if (bodyReadyApplied || document.body.classList.contains('pf-ready')) return;
        const gridWrapper = document.getElementById('gridThumbs');
        const mainWrapper = document.querySelector('.portfolio-main-wrapper');
        if (!gridWrapper || !mainWrapper) return;
        bodyReadyApplied = true;
        requestAnimationFrame(() => {
            document.body.classList.add('pf-ready');
            refreshItemObserverTargets();
        });
    }

    function applyDynamicStyles() {
        const old = document.getElementById(styleTagId);
        if (old) old.remove();
        const s = CONFIG.styles;
        const legacyMobileStack = CONFIG.styles && CONFIG.styles.mobileStack;
        const mobileDisplay = CONFIG.mobile?.displayStyle || (legacyMobileStack ? 'wrap' : 'chips');
        const mobileBehavior = CONFIG.mobile?.behavior;
        const mobileStyle = mobileBehavior === 'checkbox' ? 'checkbox' : mobileDisplay;
        const mobileWrap = mobileStyle === 'wrap' ? 'wrap' : 'nowrap';
        const mobileOverflow = mobileStyle === 'chips' ? 'auto' : 'visible';
        const stickyTop = Number(CONFIG.stickyTopSpacing ?? 0);
        const tagRadius = Number(CONFIG.tagStyle?.radius ?? 4);
        const tagBorderWidth = Number(CONFIG.tagStyle?.borderWidth ?? 0);
        const tagPadY = Number(CONFIG.tagStyle?.padY ?? 2);
        const tagPadX = Number(CONFIG.tagStyle?.padX ?? 6);
        const tagFontSizeRaw = CONFIG.tagStyle?.fontSize;
        const tagFontSizeNum = Number(tagFontSizeRaw ?? 14);
        const tagFontSize = tagFontSizeRaw === 'inherit' ? 'inherit' : `${isNaN(tagFontSizeNum) ? 14 : tagFontSizeNum}px`;
        const truncFontSizeRaw = CONFIG.truncateToggle?.fontSize;
        const truncFontSizeNum = Number(truncFontSizeRaw ?? 14);
        const truncFontSize = truncFontSizeRaw === 'inherit' ? 'inherit' : `${isNaN(truncFontSizeNum) ? 14 : truncFontSizeNum}px`;
        const truncColor = CONFIG.truncateToggle?.textColor || '#333';
        const sidebarPercent =
            clampPercent(CONFIG.sidebarWidthPercent ?? 30) ?? 30;
        const gridPercent = clampPercent(CONFIG.gridWidthPercent ?? 70) ?? 70;

        // CSS Variables Only (Static styles moved to .css file)
        const css = `
            :root {
                --pf-gap: ${s.gap}px;
                --pf-margin-bottom: ${s.marginBottom}px;
                --pf-group-gap: ${s.marginBottom}px;
                --pf-radius: ${s.radius}px;
                --pf-border-w: ${s.borderWidth}px;
                --pf-border-s: ${s.borderStyle};
                --pf-pad-v: ${s.paddingVertical}px;
                --pf-pad-h: ${s.paddingHorizontal}px;
                --pf-bg-def: ${s.colorDefault.bg};
                --pf-text-def: ${s.colorDefault.text};
                --pf-border-def: ${s.colorDefault.border};
                --pf-bg-hov: ${s.colorHover.bg};
                --pf-text-hov: ${s.colorHover.text};
                --pf-border-hov: ${s.colorHover.border};
                --pf-bg-act: ${s.colorActive.bg};
                --pf-text-act: ${s.colorActive.text};
                --pf-border-act: ${s.colorActive.border};
                --pf-font: ${s.fontFamily === 'inherit' ? 'inherit' : s.fontFamily};
                --pf-font-size: ${s.fontSize}px;
                --pf-transform: ${s.textTransform};
                --pf-letter-spacing: ${s.letterSpacing}px;
                --pf-align: ${s.align};
                --pf-mobile-wrap: ${mobileWrap};
                --pf-mobile-overflow: ${mobileOverflow};
                --pf-separator: "${s.separator}";
                --pf-separator-color: ${s.separatorColor};
                --pf-sticky-top: ${isNaN(stickyTop) ? 0 : stickyTop}px;
                --pf-tag-bg: ${CONFIG.tagStyle?.bg || '#f0f0f0'};
                --pf-tag-text: ${CONFIG.tagStyle?.text || '#333333'};
                --pf-tag-radius: ${isNaN(tagRadius) ? 4 : tagRadius}px;
                --pf-tag-border-width: ${isNaN(tagBorderWidth) ? 0 : tagBorderWidth}px;
                --pf-tag-border-color: ${CONFIG.tagStyle?.borderColor || '#cccccc'};
                --pf-tag-pad-y: ${isNaN(tagPadY) ? 2 : tagPadY}px;
                --pf-tag-pad-x: ${isNaN(tagPadX) ? 6 : tagPadX}px;
                --pf-tag-font-size: ${tagFontSize};
                --pf-truncate-font-size: ${truncFontSize};
                --pf-truncate-text-color: ${truncColor};
                --pf-sidebar-width: ${sidebarPercent}%;
                --pf-grid-width: ${gridPercent}%;
            }
        `;
        const styleEl = document.createElement('style');
        styleEl.id = styleTagId;
        styleEl.textContent = css;
        document.head.appendChild(styleEl);
        if (document.body) {
            document.body.classList.toggle(
                'pf-show-meta-labels',
                !!CONFIG.showMetaLabels
            );
        }
    }

    function isMobileViewport() {
        if (typeof window === 'undefined') return false;
        if (window.matchMedia) return !window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
        return window.innerWidth < MOBILE_BREAKPOINT;
    }

    function closeOtherOpenMenus(currentGroup) {
        if (!currentGroup) return;
        const panel = currentGroup.closest('.portfolio-control-panel');
        if (!panel || !panel.classList.contains('pf-topbar') || isMobileViewport()) return;
        const groups = panel.querySelectorAll('.filter-group-container.open');
        groups.forEach(group => {
            if (group === currentGroup) return;
            group.classList.remove('open');
            const header = group.querySelector('.filter-dropdown-header');
            const options = group.querySelector('.filter-dropdown-content');
            if (header) header.setAttribute('aria-expanded', 'false');
            if (options) options.setAttribute('aria-hidden', 'true');
        });
    }

    function syncAccordionStateForDesktop(container) {
        if (CONFIG.filterLayout === 'dropdown' || (container && container.classList.contains('pf-checkbox-dropdown'))) return;
        const groups = container.querySelectorAll('.filter-group-container');
        groups.forEach(group => {
            group.classList.remove('open');
            const options = group.querySelector('.filter-options');
            const header = group.querySelector('.filter-group-header');
            if (options) options.setAttribute('aria-hidden', 'false');
            if (options) options.style.maxHeight = '';
            if (header) header.setAttribute('aria-expanded', 'true');
        });
    }

    function syncAccordionStateForMobile(container) {
        if (CONFIG.filterLayout === 'dropdown' || (container && container.classList.contains('pf-checkbox-dropdown'))) return;
        const groups = container.querySelectorAll('.filter-group-container');
        groups.forEach(group => {
            const isOpen = group.classList.contains('open');
            const options = group.querySelector('.filter-options');
            const header = group.querySelector('.filter-group-header');
            if (options) options.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
            if (options) options.style.maxHeight = isOpen ? `${options.scrollHeight}px` : '0px';
            if (header) header.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
    }

    function applyResponsiveMode() {
        const container = document.querySelector('.portfolio-control-panel');
        if (!container) return;
        const isMobile = isMobileViewport();

        container.classList.remove('mobile-style-wrap', 'mobile-style-chips', 'mobile-style-checkbox', 'mobile-behavior-accordion');

        if (isMobile) {
            const legacyMobileStack = CONFIG.styles && CONFIG.styles.mobileStack;
            const mobileDisplay = CONFIG.mobile?.displayStyle || (legacyMobileStack ? 'wrap' : 'chips');
            const mobileBehavior = CONFIG.mobile?.behavior;
            const wantsCheckboxLayout = mobileBehavior === 'checkbox' || mobileDisplay === 'checkbox';
            const mobileStyleClass = wantsCheckboxLayout ? 'mobile-style-checkbox' : (mobileDisplay === 'wrap' ? 'mobile-style-wrap' : 'mobile-style-chips');
            if (mobileStyleClass) container.classList.add(mobileStyleClass);
            if (CONFIG.mobile?.behavior === 'accordion') {
                container.classList.add('mobile-behavior-accordion');
                syncAccordionStateForMobile(container);
            } else {
                syncAccordionStateForDesktop(container);
            }
        } else {
            syncAccordionStateForDesktop(container);
        }
    }

    function setupResponsiveListeners() {
        if (resizeHandlerAttached) return;
        resizeHandler = () => {
            clearTimeout(resizeDebounceId);
            resizeDebounceId = setTimeout(() => applyResponsiveMode(), 150);
        };
        resizeHandlerAttached = true;
        window.addEventListener('resize', resizeHandler);
    }

    function parseRawItems(items) {
        if (!items) return [];
        return items.map((item, index) => {
            const { filters, excerpt, customData } = parseSeoData(item);
            return {
                ...item, originalIndex: index, parsedFilters: filters, parsedExcerpt: excerpt, parsedCustom: customData,
                searchText: [item.title, item.seoData?.seoTitle, item.seoData?.seoDescription].join(' ').toLowerCase(),
                parsedDate: parseDateFromFilters(filters)
            };
        });
    }

    function initializeWithItems(processedItems) {
        state.items = processedItems;
        prepareRandomOrder(state.items);
        const { flat, nested } = aggregateFilters(state.items);
        state.filters = flat;
        state.hierarchy = nested;
        delete state.filters['Categories'];
        delete state.hierarchy['Categories'];
        if (Object.keys(state.filters).length > 0) {
            setupLayout();
            syncPortfolioSectionStyling();
            createControls();
            applyInitialOrderIfNeeded();
            injectMetaToGrid();
            if (Object.keys(state.activeFilters).length === 0 && !state.searchQuery) readUrlParams();
            filterGrid(false);
            applyBodyReady();
        }
    }

    function parseSeoData(item) {
        let title = (item.seoData?.seoTitle || "").trim();
        let desc = (item.seoData?.seoDescription || "").trim();
        let fullText = `${title}\n${desc}`;
        const filters = {};
        const customData = {};
        const regex = /([A-Za-z0-9 ]+):\s*([^|;.\n]+)(?=[|;.\n]|$)/gi;
        const matches = [...fullText.matchAll(regex)];
        matches.forEach(m => {
            let keyOriginal = m[1].trim();
            let valueStr = m[2].trim();
            let key = normalizeKey(keyOriginal);
            let rawValues = [];
            if (key === 'Location') {
                rawValues = [valueStr];
            } else if (key === 'Tags' || key === 'Categories' || key === 'Filter') {
                rawValues = splitTagsByMode(valueStr);
            } else {
                rawValues = valueStr.split(',').map(v => v.trim()).filter(v => v.length > 0);
            }
            rawValues.forEach(val => {
                if (!filters[key]) filters[key] = [];
                const parts = val.split('>').map(p => p.trim());
                if (parts.length > 1) {
                    const parent = parts[0];
                    const child = parts[1];
                    const fullChild = `${parent} > ${child}`;
                    if (!filters[key].includes(parent)) filters[key].push(parent);
                    if (!filters[key].includes(fullChild)) filters[key].push(fullChild);
                } else {
                    if (!filters[key].includes(val)) filters[key].push(val);
                }
            });
            customData[key] = filters[key];
        });
        let excerpt = fullText.replace(regex, '');
        excerpt = excerpt.replace(/[.\n]+/g, '. ').trim();
        excerpt = excerpt.replace(/\s+\./g, '.');
        excerpt = excerpt.replace(/^\.+/, '').trim();
        return { filters, excerpt, customData };
    }

    function normalizeKey(key) {
        const lower = key.toLowerCase();
        if (lower === 'tag' || lower === 'tags') return 'Tags';
        if (lower === 'category' || lower === 'categories') return 'Categories';
        if (lower === 'loc' || lower === 'location' || lower === 'locations') return 'Location';
        if (lower === 'year' || lower === 'years' || lower === 'date') return 'Year';
        return key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
    }

    function escapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function getAnimDuration() {
        if (ANIM_SPEED === 'slow') return '0.8s';
        if (ANIM_SPEED === 'fast') return '0.3s';
        return '0.5s';
    }

    function applyAnimationSettings() {
        const gridWrapper = document.getElementById('gridThumbs');
        if (!gridWrapper) return;
        const modes = ['pf-anim-none', 'pf-anim-fade', 'pf-anim-fade-up', 'pf-anim-zoom'];
        gridWrapper.classList.add('pf-anim');
        modes.forEach(c => gridWrapper.classList.remove(c));
        const modeClass = ANIM_MODE === 'fade' ? 'pf-anim-fade' : (ANIM_MODE === 'zoom' ? 'pf-anim-zoom' : (ANIM_MODE === 'none' ? 'pf-anim-none' : 'pf-anim-fade-up'));
        gridWrapper.classList.add(modeClass);
        gridWrapper.style.setProperty('--pf-anim-duration', getAnimDuration());
        gridWrapper.style.setProperty('--pf-anim-delay-step', ANIM_STAGGER ? '60ms' : '0ms');
    }

    function replayGridAnimationAfterFilterChange() {
        const gridWrapper = document.getElementById('gridThumbs');
        if (!gridWrapper) return;
        const animMode = ANIM_MODE;
        if (animMode === 'none') return;
        const visibleItems = (state.visibleItems || []).filter(it => it && it.style.display !== 'none');
        if (!visibleItems.length) return;
        const delayStepMs = ANIM_STAGGER ? 60 : 0;
        const baseTransform = animMode === 'zoom' ? 'scale(0.97)' : (animMode === 'fade-up' ? 'translateY(10px)' : 'none');

        visibleItems.forEach(item => {
            item.classList.remove('pf-anim-visible');
            item.style.transition = 'none';
            item.style.opacity = '0';
            item.style.transform = baseTransform;
            item.style.setProperty('--pf-anim-delay', '0ms');
            if (itemObserver) itemObserver.unobserve(item);
        });

        void gridWrapper.offsetHeight;
        requestAnimationFrame(() => {
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
            const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
            visibleItems.forEach((item, idx) => {
                const delay = ANIM_STAGGER ? idx * delayStepMs : 0;
                item.style.transition = '';
                item.style.setProperty('--pf-anim-delay', `${delay}ms`);
                const rect = item.getBoundingClientRect();
                const inView = rect.bottom > 0 && rect.top < viewportHeight && rect.right > 0 && rect.left < viewportWidth;
                if (inView) {
                    item.style.opacity = '';
                    item.style.transform = '';
                    item.classList.add('pf-anim-visible');
                    if (itemObserver) itemObserver.unobserve(item);
                } else if (itemObserver) {
                    itemObserver.observe(item);
                }
            });
        });

        document.querySelectorAll('.pf-truncate-toggle').forEach(btn => {
            const meta = btn._pfTruncate;
            if (!meta) return;
            const { hiddenItems, setExpanded } = meta;
            const hasActiveHidden = hiddenItems.some(item => item.classList.contains('active') || item.querySelector('input:checked'));
            if (hasActiveHidden) setExpanded(true);
        });
    }

    function getTagDelimiterString() {
        const mode = CONFIG.metaDisplay?.tagDelimiterMode || (CONFIG.metaDisplay?.tagDelimiter ? 'custom' : 'space');
        const custom = CONFIG.metaDisplay?.tagDelimiterCustom || CONFIG.metaDisplay?.tagDelimiter || '';
        if (mode === 'comma') return ', ';
        if (mode === 'pipe') return ' | ';
        if (mode === 'slash') return ' / ';
        if (mode === 'dot') return ' • ';
        if (mode === 'custom') return custom || ' ';
        return ' ';
    }

    function splitTagsByMode(val) {
        const mode = CONFIG.metaDisplay?.tagDelimiterMode || (CONFIG.metaDisplay?.tagDelimiter ? 'custom' : 'space');
        const custom = CONFIG.metaDisplay?.tagDelimiterCustom || CONFIG.metaDisplay?.tagDelimiter || '';
        if (!val) return [];
        let splitRaw = (() => {
            if (mode === 'comma') return val.split(/\s*,\s*/);
            if (mode === 'pipe') return val.split(/\s*\|\s*/);
            if (mode === 'slash') return val.split(/\s*\/\s*/);
            if (mode === 'dot') return val.split(/\s*•\s*/);
            if (mode === 'custom' && custom) {
                const rx = new RegExp(`\\s*${escapeRegExp(custom)}\\s*`);
                return val.split(rx);
            }
            return val.trim().split(/\s+/);
        })();
        if (mode === 'space' && splitRaw.length >= 3) {
            const rebuilt = [];
            for (let i = 0; i < splitRaw.length; i++) {
                const cur = splitRaw[i];
                if (cur === '>') continue;
                if (splitRaw[i + 1] === '>' && splitRaw[i + 2]) {
                    rebuilt.push(`${cur} > ${splitRaw[i + 2]}`);
                    i += 2;
                    continue;
                }
                rebuilt.push(cur);
            }
            splitRaw = rebuilt;
        }
        const normalize = (t) => {
            if (!t) return '';
            let v = t.trim();
            v = v.replace(/[,\|\/•]+$/g, '').trim();
            v = v.replace(/\s+/g, ' ');
            return v;
        };
        const seen = new Set();
        const cleaned = [];
        splitRaw.map(normalize).filter(Boolean).forEach(tag => {
            const key = tag.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            cleaned.push(tag);
        });
        return cleaned;
    }

    function parseCustomFieldList(raw) {
        if (Array.isArray(raw)) return raw.map(v => String(v).trim()).filter(Boolean);
        return (raw || '').split(',').map(v => v.trim()).filter(Boolean);
    }

    function sanitizeKeyForClassName(key) {
        return (key || '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
    }

    function clampPercent(value) {
        const num = Number(value);
        if (Number.isNaN(num)) return null;
        return Math.min(90, Math.max(10, num));
    }

    function getMetaLayoutClassName() {
        const raw = (CONFIG.metaDisplay?.metaLayout || 'stacked-above').toLowerCase();
        if (raw === 'stacked-above') return 'meta-layout-stacked-above';
        if (raw === 'split') return 'meta-layout-split';
        if (raw === 'overlay-top-left') return 'meta-layout-overlay-top-left';
        if (raw === 'overlay-top-right') return 'meta-layout-overlay-top-right';
        if (raw === 'stacked' || raw === 'stacked-below') return 'meta-layout-stacked-below';
        return 'meta-layout-stacked-below';
    }

    function getCustomValues(parsedCustom, keyName) {
        if (!parsedCustom || !keyName) return null;
        const lower = keyName.toLowerCase();
        const matchKey = Object.keys(parsedCustom).find(k => k.toLowerCase() === lower);
        if (!matchKey) return null;
        return parsedCustom[matchKey];
    }

    function shuffleArray(arr) {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    function prepareRandomOrder(items) {
        if (!CONFIG.randomOrder) {
            randomOrderMap = null;
            randomOrderApplied = false;
            return;
        }
        const ids = items.map(it => it.fullUrl || it.id || it.originalIndex);
        randomOrderMap = new Map();
        shuffleArray(ids).forEach((id, idx) => randomOrderMap.set(id, idx));
        randomOrderApplied = false;
    }

    function aggregateFilters(items) {
        const flat = {};
        const nested = {};
        items.forEach(item => {
            Object.keys(item.parsedFilters).forEach(key => {
                if (!flat[key]) flat[key] = {};
                if (!nested[key]) nested[key] = {};
                item.parsedFilters[key].forEach(val => {
                    if (val.includes(' > ')) {
                        const parts = val.split(' > ');
                        const parent = parts[0];
                        const child = parts[1];
                        if (!nested[key][parent]) nested[key][parent] = new Set();
                        nested[key][parent].add(child);
                    } else {
                        if (!nested[key][val]) nested[key][val] = new Set();
                    }
                    if (!flat[key][val]) flat[key][val] = [];
                    flat[key][val].push(item.fullUrl);
                });
            });
        });
        Object.keys(nested).forEach(k => {
            Object.keys(nested[k]).forEach(p => nested[k][p] = Array.from(nested[k][p]).sort());
        });
        if (!CONFIG.multipleFilterGroups) {
            const keys = Object.keys(flat);
            const pref = ['Tags', 'Categories', 'Filter'];
            const found = pref.find(k => keys.includes(k)) || keys[0];
            if (found) return { flat: { [found]: flat[found] }, nested: { [found]: nested[found] } };
            return { flat: {}, nested: {} };
        }
        return { flat, nested };
    }

    function parseDateFromFilters(filters) {
        if (!filters['Year']) return null;
        const yearVal = filters['Year'][0];
        if (!yearVal) return null;
        const d = new Date(yearVal);
        if (!isNaN(d.getTime())) return d;
        if (/^\d{4}$/.test(yearVal)) return new Date(yearVal + "-01-01");
        return null;
    }

    // URL FIX: Handle -- double hyphen
    function readUrlParams() {
        const params = new URLSearchParams(window.location.search);
        state.activeFilters = {};
        state.activeSubFilters = {};
        Object.keys(state.filters).forEach(groupKey => {
            const paramVal = params.get(groupKey) || params.get(groupKey.toLowerCase());
            if (paramVal) {
                // Decode subcategories (Interiors--Residential -> Interiors > Residential)
                const values = paramVal.split(',').map(v => v.trim().replace(/--/g, ' > ')).filter(v => v && v !== ALL_OPTION_VALUE);
                if (!values.length) return;
                state.activeFilters[groupKey] = values;
                values.forEach(v => {
                    if (v.includes(' > ')) {
                        const parts = v.split(' > ');
                        if (!state.activeSubFilters[groupKey]) state.activeSubFilters[groupKey] = {};
                        state.activeSubFilters[groupKey][parts[0]] = parts[1];
                        // Ensure parent also inactive or handled?
                        // If logic: Parent should NOT be in activeFilters if strict...
                        // But let's verify logic below.
                    }
                });
            }
        });
        updateAllUI();
    }

    function updateUrl() {
        const params = new URLSearchParams();
        Object.keys(state.activeFilters).forEach(group => {
            const values = state.activeFilters[group].filter(v => v !== ALL_OPTION_VALUE);
            if (values && values.length > 0) {
                // Encode subcategories ( > to --)
                const encoded = values.map(v => v.replace(/ > /g, '--'));
                params.set(group, encoded.join(','));
            }
        });
        const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
        window.history.replaceState({}, '', newUrl);
    }

    function handleUrlChange() {
        readUrlParams();
        allowScrollToGrid = true;
        filterGrid(false);
    }

    function getItemDataFromDom(domItem) {
        let href = domItem.getAttribute('href') || (domItem.querySelector('a')?.getAttribute('href')) || '';
        const u = href.split('?')[0];
        return state.items.find(i => i.fullUrl.endsWith(u) || u.endsWith(i.fullUrl));
    }

    function getOrderIndex(item) {
        if (CONFIG.randomOrder && randomOrderMap) {
            const key = item.fullUrl || item.id || item.originalIndex;
            const mapped = randomOrderMap.get(key);
            if (mapped !== undefined) return mapped;
        }
        return item.originalIndex;
    }

    function applyInitialOrderIfNeeded() {
        if (!CONFIG.randomOrder || randomOrderApplied) return;
        const gridWrapper = document.getElementById('gridThumbs');
        if (!gridWrapper) return;
        const gridItems = Array.from(gridWrapper.querySelectorAll('.grid-item'));
        const sorted = gridItems
            .map((el, idx) => ({ el, data: getItemDataFromDom(el), fallback: idx }))
            .sort((a, b) => {
                if (a.data && b.data) return getOrderIndex(a.data) - getOrderIndex(b.data);
                if (a.data) return -1;
                if (b.data) return 1;
                return a.fallback - b.fallback;
            });
        sorted.forEach(({ el }) => gridWrapper.appendChild(el));
        randomOrderApplied = true;
    }

    function injectMetaToGrid() {
        const wrapper = document.getElementById('gridThumbs');
        if (!wrapper) return;
        const items = wrapper.querySelectorAll('.grid-item');
        const delim = getTagDelimiterString();
        const showCustomMeta = CONFIG.metaDisplay.showCustomMeta ?? CONFIG.metaDisplay.showCustom;
        let customFields = showCustomMeta ? parseCustomFieldList(CONFIG.metaDisplay.customMetaFields) : [];
        if (showCustomMeta && customFields.length === 0) customFields = ['Author'];
        const ensureField = (label) => {
            if (!customFields.some(f => f.toLowerCase() === label.toLowerCase())) customFields.push(label);
        };
        if (showCustomMeta && CONFIG.metaDisplay.showLocation) ensureField('Location');
        if (showCustomMeta && CONFIG.metaDisplay.showYear) ensureField('Year');
        items.forEach(domItem => {
            domItem.querySelectorAll('.portfolio-item-injected').forEach(el => el.remove());
            const itemData = getItemDataFromDom(domItem);
            if (!itemData) return;
            const textWrapper = domItem.querySelector('.portfolio-text');
            if (!textWrapper) return;
            const layoutClass = getMetaLayoutClassName();
            textWrapper.classList.remove('meta-layout-stacked-above', 'meta-layout-stacked-below', 'meta-layout-split', 'meta-layout-overlay-top-left', 'meta-layout-overlay-top-right');
            const titleEl = textWrapper.querySelector('.portfolio-title') || textWrapper.querySelector('h3') || textWrapper.querySelector('h2') || textWrapper.querySelector('h4');
            if (titleEl && !titleEl.classList.contains('portfolio-title')) {
                titleEl.classList.add('portfolio-title');
            }
            const createMetaFieldWrapper = (
                keyName,
                labelText,
                valueText,
                extraClasses = ''
            ) => {
                const safeKey = sanitizeKeyForClassName(
                    labelText || keyName || 'meta'
                );
                const wrapper = document.createElement('div');
                const classNames = [
                    `custom-tag-${safeKey}-wrapper`,
                    'portfolio-meta-item',
                    'portfolio-item-injected',
                    extraClasses
                ]
                    .filter(Boolean)
                    .join(' ');
                wrapper.className = classNames;
                const labelSpan = document.createElement('span');
                labelSpan.className = `custom-tag-${safeKey}`;
                const trimmedLabel = (labelText || keyName || '').trim();
                labelSpan.textContent = trimmedLabel ? `${trimmedLabel}: ` : '';
                const valueSpan = document.createElement('span');
                valueSpan.className = 'custom-tag-value';
                valueSpan.textContent =
                    valueText === undefined || valueText === null
                        ? ''
                        : String(valueText);
                wrapper.appendChild(labelSpan);
                wrapper.appendChild(valueSpan);
                return wrapper;
            };
            const metaNodes = [];
            if (CONFIG.metaDisplay.showTags) {
                const tagsKey = ['Tags', 'Categories', 'Filter'].find(k => itemData.parsedCustom[k]);
                if (tagsKey && itemData.parsedCustom[tagsKey]) {
                    const displayTags = itemData.parsedCustom[tagsKey].map(t => t.includes(' > ') ? t.split(' > ')[1] : t);
                    const uniqueTags = [...new Set(displayTags)];
                    if (uniqueTags.length) {
                        const div = document.createElement('div');
                        div.className = 'portfolio-item-tags portfolio-meta-group portfolio-item-injected';
                        if (IS_TAG_PILL_STYLE) {
                            uniqueTags.forEach(t => {
                                const span = document.createElement('span');
                                span.className = 'portfolio-meta-item portfolio-meta-tag';
                                span.textContent = t;
                                div.appendChild(span);
                            });
                        } else {
                            const span = document.createElement('span');
                            span.className = 'portfolio-meta-item portfolio-meta-tag';
                            span.textContent = uniqueTags.join(delim);
                            div.appendChild(span);
                        }
                        metaNodes.push(div);
                    }
                }
            }
            if (CONFIG.metaDisplay.showYear && itemData.parsedCustom['Year'] && !showCustomMeta) {
                const valueText = itemData.parsedCustom['Year'].join(', ');
                if (String(valueText).trim()) {
                    metaNodes.push(
                        createMetaFieldWrapper(
                            'Year',
                            'Year',
                            valueText,
                            'portfolio-item-year portfolio-meta-year'
                        )
                    );
                }
            }
            if (CONFIG.metaDisplay.showLocation && itemData.parsedCustom['Location'] && !showCustomMeta) {
                const valueText = itemData.parsedCustom['Location'].join(' ');
                if (String(valueText).trim()) {
                    metaNodes.push(
                        createMetaFieldWrapper(
                            'Location',
                            'Location',
                            valueText,
                            'portfolio-item-location portfolio-meta-location'
                        )
                    );
                }
            }
            if (showCustomMeta && itemData.parsedCustom) {
                customFields.forEach(fieldName => {
                    const values = getCustomValues(itemData.parsedCustom, fieldName);
                    if (!values || (Array.isArray(values) && values.length === 0)) return;
                    const delimiter = fieldName.toLowerCase() === 'location' ? ' ' : delim;
                    const valueText = Array.isArray(values) ? values.join(delimiter) : values;
                    if (String(valueText).trim() === '') return;
                    const label = fieldName.trim() || fieldName;
                    metaNodes.push(
                        createMetaFieldWrapper(
                            fieldName,
                            label,
                            valueText,
                            'portfolio-item-custom-meta portfolio-meta-custom'
                        )
                    );
                });
            }
            if (metaNodes.length) {
                textWrapper.classList.add(layoutClass);
                const wrapperDiv = document.createElement('div');
                wrapperDiv.className = 'portfolio-meta-wrapper portfolio-item-injected';
                metaNodes.forEach(node => wrapperDiv.appendChild(node));
                if (layoutClass === 'meta-layout-stacked-above' || layoutClass === 'meta-layout-overlay-top-left' || layoutClass === 'meta-layout-overlay-top-right') {
                    textWrapper.insertBefore(wrapperDiv, titleEl || textWrapper.firstChild);
                } else if (titleEl && titleEl.parentNode === textWrapper) {
                    titleEl.insertAdjacentElement('afterend', wrapperDiv);
                } else {
                    textWrapper.insertBefore(wrapperDiv, textWrapper.firstChild);
                }
            }
            if (CONFIG.metaDisplay.showExcerpt && itemData.parsedExcerpt) {
                const div = document.createElement('div');
                div.className = 'portfolio-item-excerpt portfolio-item-injected';
                const p = document.createElement('p');
                p.textContent = itemData.parsedExcerpt;
                div.appendChild(p);
                textWrapper.appendChild(div);
            }
        });
    }

    // FIX: Layout Support (Check/Drop) & Subcat Grouping
    function createControls() {
        let container = document.querySelector('.portfolio-control-panel');
        if (container) container.remove();
        container = document.createElement('div');
        container.className = `portfolio-control-panel layout-${CONFIG.filterLayout}`;
        if (CONFIG.filterLayout === 'inline' && CONFIG.desktopInlineVariant === 'text') {
            container.classList.add('inline-variant-text');
        }
        // Add preset class if defined
        if (CONFIG.styles?.stylePreset) container.classList.add(`preset-${CONFIG.styles.stylePreset}`);

        const isTopbarLayout = (CONFIG.layout || '').toLowerCase() === 'top';
        const isSidebarLayout = (CONFIG.layout || '').toLowerCase() === 'sidebar';
        const useCheckboxDropdown = CONFIG.filterLayout === 'checkbox' && isTopbarLayout;
        const isDropdown = CONFIG.filterLayout === 'dropdown' || useCheckboxDropdown;
        const accordionEnabled = CONFIG.mobile?.behavior === 'accordion';
        const isMobileNow = isMobileViewport();
        const mobileCheckboxMode = isMobileNow && (CONFIG.mobile?.displayStyle === 'checkbox' || CONFIG.mobile?.behavior === 'checkbox');
        const useCheckboxLayout = CONFIG.filterLayout === 'checkbox' || mobileCheckboxMode;
        const applyDropdownInit = isDropdown && !isMobileNow;
        let dropdownRenderIndex = 0;
        let groupRenderCount = 0;
        if (CONFIG.stickySidebar && isSidebarLayout) {
            container.classList.add('pf-sticky');
        }
        if (isTopbarLayout) {
            container.classList.add('pf-topbar');
        }
        if (useCheckboxDropdown) {
            container.classList.add('pf-checkbox-dropdown');
        }
        const applyTruncation = (listEl) => {
            if (!CONFIG.truncateFilters) return;
            const optionItems = Array.from(listEl.children).filter(node => node.classList.contains('filter-item-wrapper') && !node.classList.contains('filter-item-all'));
            const maxVisible = Math.max(parseInt(CONFIG.truncateMax, 10) || 0, 0);
            if (optionItems.length <= maxVisible) return;

            const hiddenItems = optionItems.slice(maxVisible);
            const hiddenContainer = document.createElement('div');
            hiddenContainer.className = 'pf-truncate-hidden';
            hiddenContainer.setAttribute('aria-hidden', 'true');
            hiddenContainer.style.height = '0px';
            hiddenContainer.style.overflow = 'hidden';
            hiddenContainer.style.transition = 'height 0.3s ease';
            hiddenItems.forEach(el => hiddenContainer.appendChild(el));

            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'pf-truncate-toggle';
            toggle.textContent = TEXT.showMore;
            toggle.setAttribute('aria-expanded', 'false');
            if (listEl.id) toggle.setAttribute('aria-controls', listEl.id);

            const refreshParentHeights = () => {
                if (listEl.style.maxHeight && listEl.getAttribute('aria-hidden') !== 'true') {
                    listEl.style.maxHeight = `${listEl.scrollHeight}px`;
                }
                if (listEl.style.height && listEl.style.height !== 'auto') {
                    listEl.style.height = `${listEl.scrollHeight}px`;
                }
            };

            const setExpanded = (expanded) => {
                const startHeight = hiddenContainer.offsetHeight;
                const targetHeight = expanded ? hiddenContainer.scrollHeight : 0;
                hiddenContainer.style.height = `${startHeight}px`;
                hiddenContainer.style.overflow = 'hidden';
                hiddenContainer.setAttribute('aria-hidden', expanded ? 'false' : 'true');
                toggle.textContent = expanded ? TEXT.showLess : TEXT.showMore;
                toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
                toggle.classList.toggle('expanded', expanded);
                requestAnimationFrame(() => {
                    hiddenContainer.style.height = `${targetHeight}px`;
                    refreshParentHeights();
                });
                const tidy = () => {
                    if (expanded) hiddenContainer.style.height = 'auto';
                    refreshParentHeights();
                    hiddenContainer.removeEventListener('transitionend', tidy);
                };
                hiddenContainer.addEventListener('transitionend', tidy);
            };

            setExpanded(false);
            toggle.addEventListener('click', () => {
                const next = toggle.getAttribute('aria-expanded') !== 'true';
                setExpanded(next);
            });
            toggle._pfTruncate = { setExpanded, hiddenItems, container: listEl, hiddenContainer };
            listEl.appendChild(hiddenContainer);
            listEl.appendChild(toggle);
        };

        let topbarRow = null;
        let topbarLeft = null;
        let topbarRight = null;
        let filtersHost = container;
        let controlHost = container;
        if (isTopbarLayout) {
            topbarRow = document.createElement('div');
            topbarRow.className = 'pf-topbar-row';
            topbarLeft = document.createElement('div');
            topbarLeft.className = 'pf-topbar-left';
            topbarRight = document.createElement('div');
            topbarRight.className = 'pf-topbar-right';
            topbarRow.appendChild(topbarLeft);
            topbarRow.appendChild(topbarRight);
            container.appendChild(topbarRow);
            filtersHost = topbarLeft;
            controlHost = topbarRight;
        }

        if (CONFIG.searchEnabled) {
            const searchWrapper = document.createElement('div');
            searchWrapper.className = 'control-group search-group';
            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.placeholder = TEXT.searchPlaceholder;
            searchInput.addEventListener('input', (e) => {
                state.searchQuery = e.target.value.toLowerCase();
                state.currentPage = 1;
                allowScrollToGrid = true;
                filterGrid(false);
            });
            searchWrapper.appendChild(searchInput);
            controlHost.appendChild(searchWrapper);
        }

        const filtersWrapper = document.createElement('div');
        filtersWrapper.className = 'filters-wrapper';

        const groupNames = Object.keys(state.hierarchy);
        groupNames.forEach(groupName => {
            if (groupName === 'Categories') return;
            const displayName = groupName === 'Tags' ? TEXT.defaultFilterName : groupName;
            const parents = Object.keys(state.hierarchy[groupName]).sort();
            if (CONFIG.hideSingleValueFilters && parents.length <= 1) {
                const singleParent = parents[0];
                if (!singleParent || state.hierarchy[groupName][singleParent].length === 0) return;
            }

            const groupWrapper = document.createElement('div');
            groupWrapper.className = 'filter-group-container';
            groupWrapper.dataset.group = groupName;

            const contentIndex = groupRenderCount++;
            const forceMobileLabel = accordionEnabled && isMobileNow;
            const forceLabelForLayout = CONFIG.filterLayout !== 'inline';
            const shouldShowLabel = forceLabelForLayout || CONFIG.showFilterLabel || forceMobileLabel;
            let shouldStartOpen = applyDropdownInit && isSidebarLayout && dropdownRenderIndex === 0;
            if (accordionEnabled && isMobileNow) shouldStartOpen = false;
            if (isDropdown) dropdownRenderIndex++;
            if (shouldStartOpen) groupWrapper.classList.add('open');

            let headerEl;
            const toggleGroup = () => {
                if (!isDropdown && accordionEnabled && !isMobileViewport()) return;
                const isMobileCheckboxMode = container.classList.contains('mobile-style-checkbox') && isDropdown;
                const willOpen = !groupWrapper.classList.contains('open');
                if (willOpen) closeOtherOpenMenus(groupWrapper);
                const isOpenNow = groupWrapper.classList.toggle('open');
                if (headerEl) headerEl.setAttribute('aria-expanded', isOpenNow ? 'true' : 'false');
                if (optionsContainer) {
                    if (isMobileCheckboxMode) {
                        const panel = optionsContainer;
                        const tidy = (finalDisplayNone) => {
                            panel.style.overflow = 'visible';
                            panel.style.height = '';
                            panel.style.opacity = '';
                            if (finalDisplayNone) {
                                panel.style.display = '';
                                panel.setAttribute('aria-hidden', 'true');
                                panel.style.pointerEvents = 'none';
                            } else {
                                panel.setAttribute('aria-hidden', 'false');
                                panel.style.pointerEvents = 'auto';
                            }
                        };
                        if (isOpenNow) {
                            panel.style.display = '';
                            panel.setAttribute('aria-hidden', 'false');
                            panel.style.pointerEvents = 'auto';
                            panel.style.overflow = 'hidden';
                            panel.style.height = '0px';
                            panel.style.opacity = '0';
                            requestAnimationFrame(() => {
                                const target = panel.scrollHeight;
                                panel.style.height = `${target}px`;
                                panel.style.opacity = '1';
                            });
                            const onEnd = (e) => {
                                if (e.propertyName !== 'height') return;
                                panel.removeEventListener('transitionend', onEnd);
                                tidy(false);
                            };
                            panel.addEventListener('transitionend', onEnd);
                        } else {
                            const startHeight = panel.scrollHeight || 0;
                            panel.style.overflow = 'hidden';
                            panel.style.height = `${startHeight}px`;
                            panel.style.opacity = '1';
                            panel.setAttribute('aria-hidden', 'true');
                            panel.style.pointerEvents = 'none';
                            requestAnimationFrame(() => {
                                panel.style.height = '0px';
                                panel.style.opacity = '0';
                            });
                            const onEndClose = (e) => {
                                if (e.propertyName !== 'height') return;
                                panel.removeEventListener('transitionend', onEndClose);
                                tidy(true);
                            };
                            panel.addEventListener('transitionend', onEndClose);
                        }
                    } else {
                        optionsContainer.setAttribute('aria-hidden', isOpenNow ? 'false' : 'true');
                        if (accordionEnabled && isMobileNow && !isDropdown) {
                            optionsContainer.style.maxHeight = isOpenNow ? `${optionsContainer.scrollHeight}px` : '0px';
                        }
                    }
                }
            };
            const handleKeyToggle = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleGroup();
                }
            };

            if (isDropdown) {
                headerEl = document.createElement('div');
                headerEl.className = 'filter-dropdown-header';
                headerEl.setAttribute('role', 'button');
                headerEl.tabIndex = 0;
                headerEl.innerHTML = `<span class="${shouldShowLabel ? '' : 'pf-hide-label'}">${displayName}</span><svg class="pf-caret" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
                headerEl.addEventListener('click', toggleGroup);
                headerEl.addEventListener('keydown', handleKeyToggle);
                groupWrapper.appendChild(headerEl);
            } else if (shouldShowLabel) {
                headerEl = document.createElement('p');
                headerEl.className = 'filter-group-header';
                headerEl.innerHTML = `${displayName}${accordionEnabled ? ' <svg class="pf-caret" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"></path></svg>' : ''}`;
                if (accordionEnabled) {
                    headerEl.setAttribute('role', 'button');
                    headerEl.tabIndex = 0;
                    headerEl.addEventListener('click', toggleGroup);
                    headerEl.addEventListener('keydown', handleKeyToggle);
                }
                groupWrapper.appendChild(headerEl);
            }

            const optionsContainer = document.createElement('div');
            const contentId = `pf-content-${groupName.replace(/\s+/g, '-').toLowerCase()}-${contentIndex}`;
            optionsContainer.className = isDropdown ? 'filter-dropdown-content' : 'filter-options';
            optionsContainer.id = contentId;
            const shouldHideByDefault = isDropdown ? !shouldStartOpen : (accordionEnabled && isMobileNow ? !shouldStartOpen : false);
            optionsContainer.setAttribute('aria-hidden', shouldHideByDefault ? 'true' : 'false');
            if (accordionEnabled && !isDropdown) {
                optionsContainer.style.maxHeight = shouldHideByDefault ? '0px' : `${optionsContainer.scrollHeight}px`;
            }
            if (headerEl) {
                const expanded = isDropdown ? shouldStartOpen : (accordionEnabled && isMobileNow ? shouldStartOpen : true);
                headerEl.setAttribute('aria-expanded', expanded ? 'true' : 'false');
                headerEl.setAttribute('aria-controls', contentId);
            }

            const allItemWrapper = document.createElement('div');
            allItemWrapper.className = 'filter-item-wrapper filter-item-all';
            allItemWrapper.dataset.group = groupName;
            if (useCheckboxLayout) {
                const allLabel = document.createElement('label');
                allLabel.className = 'filter-label-checkbox filter-option-all';
                const allChk = document.createElement('input');
                allChk.type = 'checkbox';
                allChk.className = 'group-all-chk';
                allChk.dataset.group = groupName;
                allChk.dataset.value = ALL_OPTION_VALUE;
                allChk.addEventListener('change', () => handleGroupAllClick(groupName));
                allLabel.appendChild(allChk);
                allLabel.appendChild(document.createTextNode(TEXT.allText));
                allItemWrapper.appendChild(allLabel);
            } else {
                const allBtn = document.createElement('button');
                allBtn.type = 'button';
                allBtn.className = 'filter-option-btn filter-option-all';
                allBtn.textContent = TEXT.allText;
                allBtn.dataset.group = groupName;
                allBtn.dataset.value = ALL_OPTION_VALUE;
                allBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    handleGroupAllClick(groupName);
                });
                allItemWrapper.appendChild(allBtn);
            }
            optionsContainer.appendChild(allItemWrapper);

            parents.forEach(parent => {
                const children = state.hierarchy[groupName][parent];
                const count = (state.filters[groupName][parent] || []).length;
                const countHTML = CONFIG.showItemCounts ? ` <span class="count">(${count})</span> ` : '';

                const itemWrapper = document.createElement('div');
                itemWrapper.className = 'filter-item-wrapper';
                itemWrapper.dataset.parent = parent;

                let parentEl;
                if (useCheckboxLayout) {
                    parentEl = document.createElement('label');
                    parentEl.className = 'filter-label-checkbox';
                    const chk = document.createElement('input');
                    chk.type = 'checkbox';
                    chk.dataset.value = parent;
                    chk.className = 'parent-chk';
                    chk.addEventListener('change', () => {
                        handleParentClick(groupName, parent, children);
                    });
                    parentEl.appendChild(chk);
                    parentEl.appendChild(document.createTextNode(parent));
                    if (CONFIG.showItemCounts) {
                        const s = document.createElement('span');
                        s.className = 'count';
                        s.textContent = `(${count})`;
                        parentEl.appendChild(s);
                    }
                } else {
                    parentEl = document.createElement('button');
                    parentEl.type = 'button';
                    parentEl.className = 'filter-option-btn parent-btn';
                    parentEl.innerHTML = `${parent}${countHTML}`;
                    parentEl.dataset.value = parent;
                    parentEl.addEventListener('click', (e) => {
                        e.preventDefault();
                        handleParentClick(groupName, parent, children);
                    });
                }
                itemWrapper.appendChild(parentEl);

                if (children && children.length > 0) {
                    const subContainer = document.createElement('div');
                    subContainer.className = 'filter-options children';

                    // "All Parent" Control
                    if (useCheckboxLayout) {
                        const label = document.createElement('label');
                        label.className = 'filter-label-checkbox child-checkbox';
                        const chk = document.createElement('input');
                        chk.type = 'checkbox';
                        chk.className = 'child-chk-all';
                        chk.dataset.parent = parent;
                        chk.addEventListener('change', () => {
                            state.activeFilters[groupName] = state.activeFilters[groupName].filter(v => !v.startsWith(parent + ' > '));
                            if (!CONFIG.allowMultiSelect) {
                                state.activeFilters[groupName] = [parent];
                            } else if (!state.activeFilters[groupName].includes(parent)) state.activeFilters[groupName].push(parent);
                            if (state.activeSubFilters[groupName]) delete state.activeSubFilters[groupName][parent];
                            state.currentPage = 1;
                            updateAllUI();
                            allowScrollToGrid = true;
                            filterGrid(false);
                            updateUrl();
                        });
                        label.appendChild(chk);
                        label.appendChild(document.createTextNode(`${TEXT.allText} ${parent}`));
                        subContainer.appendChild(label);
                    } else {
                        const allBtn = document.createElement('button');
                        allBtn.type = 'button';
                        allBtn.className = 'filter-option-btn child-btn child-btn-all';
                        allBtn.textContent = `${TEXT.allText} ${parent}`;
                        allBtn.dataset.parent = parent;
                        allBtn.addEventListener('click', (e) => {
                            e.preventDefault();
                            state.activeFilters[groupName] = state.activeFilters[groupName].filter(v => !v.startsWith(parent + ' > '));
                            if (!CONFIG.allowMultiSelect) {
                                state.activeFilters[groupName] = [parent];
                            } else if (!state.activeFilters[groupName].includes(parent)) state.activeFilters[groupName].push(parent);
                            if (state.activeSubFilters[groupName]) delete state.activeSubFilters[groupName][parent];
                            state.currentPage = 1;
                            updateAllUI();
                            allowScrollToGrid = true;
                            filterGrid(false);
                            updateUrl();
                        });
                        subContainer.appendChild(allBtn);
                    }

                    children.forEach(child => {
                        if (useCheckboxLayout) {
                            const label = document.createElement('label');
                            label.className = 'filter-label-checkbox child-checkbox';
                            const chk = document.createElement('input');
                            chk.type = 'checkbox';
                            chk.className = 'child-chk';
                            chk.dataset.value = `${parent} > ${child}`;
                            chk.addEventListener('change', () => handleChildClick(groupName, parent, child));
                            label.appendChild(chk);
                            label.appendChild(document.createTextNode(child));
                            subContainer.appendChild(label);
                        } else {
                            const btn = document.createElement('button');
                            btn.type = 'button';
                            btn.className = 'filter-option-btn child-btn';
                            btn.textContent = child;
                            btn.dataset.value = `${parent} > ${child}`;
                            btn.addEventListener('click', (e) => {
                                e.preventDefault();
                                handleChildClick(groupName, parent, child);
                            });
                            subContainer.appendChild(btn);
                        }
                    });
                    itemWrapper.appendChild(subContainer);
                }

                optionsContainer.appendChild(itemWrapper);
            });
            groupWrapper.appendChild(optionsContainer);
            applyTruncation(optionsContainer);

            if (accordionEnabled && isMobileNow && !shouldHideByDefault && !isDropdown) {
                requestAnimationFrame(() => {
                    optionsContainer.style.maxHeight = `${optionsContainer.scrollHeight}px`;
                });
            }
            filtersWrapper.appendChild(groupWrapper);
        });
        filtersHost.appendChild(filtersWrapper);

        container.classList.remove('pf-groups-1', 'pf-groups-2', 'pf-groups-3plus');
        if (groupRenderCount === 1) container.classList.add('pf-groups-1');
        else if (groupRenderCount === 2) container.classList.add('pf-groups-2');
        else if (groupRenderCount >= 3) container.classList.add('pf-groups-3plus');

        if (CONFIG.sortEnabled || CONFIG.showResetButton) {
            const sortWrapper = document.createElement('div');
            sortWrapper.className = 'control-group sort-group';
            if (CONFIG.sortEnabled) {
                const sortSelect = document.createElement('select');
                const sortLabel = (TEXT.sortText || 'Sort By').trim() || 'Sort By';
                let optionsHTML = `
                    <option value="original">${sortLabel}</option>
                    <option value="asc">Name (A-Z)</option>
                    <option value="desc">Name (Z-A)</option>
                `;
                if (CONFIG.displayYearInSort) {
                    optionsHTML += `
                    <option value="date-newest">Year (Newest)</option>
                    <option value="date-oldest">Year (Oldest)</option>`;
                }
                sortSelect.innerHTML = optionsHTML;
                sortSelect.value = state.sortOrder;
                sortSelect.addEventListener('change', (e) => {
                    state.sortOrder = e.target.value;
                    allowScrollToGrid = true;
                    sortGrid();
                });
                sortWrapper.appendChild(sortSelect);
            }
            if (CONFIG.showResetButton) {
                const resetBtn = document.createElement('button');
                resetBtn.className = 'reset-btn';
                resetBtn.textContent = TEXT.resetText;
                resetBtn.addEventListener('click', resetAll);
                sortWrapper.appendChild(resetBtn);
            }
            controlHost.appendChild(sortWrapper);
        }

        if (isTopbarLayout && topbarRight && topbarRight.children.length === 0) {
            topbarRight.remove();
        }

        const mainWrapper = document.querySelector('.portfolio-main-wrapper');
        if (mainWrapper && !mainWrapper.querySelector('.portfolio-control-panel')) {
            mainWrapper.insertBefore(container, mainWrapper.firstChild); // Insert before content
        }

        if (useCheckboxDropdown) attachCheckboxDropdownListeners();
        if (isTopbarLayout && isDropdown) attachTopbarDropdownListeners();
        applyResponsiveMode();
        setupResponsiveListeners();
    }

    function clearGroupSelections(group) {
        if (state.activeFilters[group]) delete state.activeFilters[group];
        if (state.activeSubFilters[group]) delete state.activeSubFilters[group];
    }

    function handleGroupAllClick(group) {
        clearGroupSelections(group);
        state.currentPage = 1;
        updateAllUI();
        allowScrollToGrid = true;
        filterGrid(false);
        updateUrl();
    }

    function closeCheckboxDropdownPanels(container) {
        if (!container) return;
        const groups = container.querySelectorAll('.filter-group-container.open');
        groups.forEach(group => {
            group.classList.remove('open');
            const header = group.querySelector('.filter-dropdown-header');
            const options = group.querySelector('.filter-dropdown-content');
            if (header) header.setAttribute('aria-expanded', 'false');
            if (options) options.setAttribute('aria-hidden', 'true');
        });
    }

    function attachCheckboxDropdownListeners() {
        if (checkboxDropdownListenersAttached) return;
        checkboxDropdownDocHandler = (event) => {
            const panel = document.querySelector('.portfolio-control-panel.pf-checkbox-dropdown');
            if (!panel) return;
            const targetGroup = event.target.closest('.filter-group-container');
            if (!targetGroup || !panel.contains(targetGroup)) {
                closeCheckboxDropdownPanels(panel);
            }
        };
        checkboxDropdownKeyHandler = (event) => {
            if (event.key !== 'Escape') return;
            const panel = document.querySelector('.portfolio-control-panel.pf-checkbox-dropdown');
            if (!panel) return;
            closeCheckboxDropdownPanels(panel);
        };
        document.addEventListener('click', checkboxDropdownDocHandler);
        document.addEventListener('keydown', checkboxDropdownKeyHandler);
        checkboxDropdownListenersAttached = true;
    }

    function attachTopbarDropdownListeners() {
        if (topbarDropdownListenersAttached) return;
        topbarDropdownDocHandler = (event) => {
            const panel = document.querySelector('.portfolio-control-panel.pf-topbar');
            if (!panel || isMobileViewport()) return;
            if (!panel.classList.contains('layout-dropdown') && !panel.classList.contains('pf-checkbox-dropdown')) return;
            const targetGroup = event.target.closest('.filter-group-container');
            if (!targetGroup || !panel.contains(targetGroup)) {
                closeCheckboxDropdownPanels(panel);
            }
        };
        topbarDropdownKeyHandler = (event) => {
            if (event.key !== 'Escape') return;
            const panel = document.querySelector('.portfolio-control-panel.pf-topbar');
            if (!panel || isMobileViewport()) return;
            if (!panel.classList.contains('layout-dropdown') && !panel.classList.contains('pf-checkbox-dropdown')) return;
            closeCheckboxDropdownPanels(panel);
        };
        document.addEventListener('click', topbarDropdownDocHandler);
        document.addEventListener('keydown', topbarDropdownKeyHandler);
        topbarDropdownListenersAttached = true;
    }

    function handleParentClick(group, parent, children) {
        // Toggle Parent
        const isActive = state.activeFilters[group] && state.activeFilters[group].includes(parent);
        if (!state.activeFilters[group]) state.activeFilters[group] = [];

        if (isActive) {
            state.activeFilters[group] = state.activeFilters[group].filter(v => v !== parent);
            // Also remove all children
            state.activeFilters[group] = state.activeFilters[group].filter(v => !v.startsWith(parent + ' > '));
            if (state.activeSubFilters[group]) delete state.activeSubFilters[group][parent];
        } else {
            if (!CONFIG.allowMultiSelect) {
                state.activeFilters[group] = [parent];
                state.activeSubFilters[group] = {};
            } else {
                state.activeFilters[group].push(parent);
                // Ensure no specific child is selected to avoid conflict
                state.activeFilters[group] = state.activeFilters[group].filter(v => !v.startsWith(parent + ' > '));
                if (state.activeSubFilters[group]) delete state.activeSubFilters[group][parent];
            }
        }

        state.activeFilters[group] = state.activeFilters[group].filter(v => v !== ALL_OPTION_VALUE);
        if (state.activeFilters[group].length === 0) delete state.activeFilters[group];
        state.currentPage = 1;
        updateAllUI();
        allowScrollToGrid = true;
        filterGrid(false);
        updateUrl();
    }

    function handleChildClick(group, parent, child) {
        const fullValue = `${parent} > ${child}`;
        const isActive = state.activeFilters[group] && state.activeFilters[group].includes(fullValue);
        if (!state.activeFilters[group]) state.activeFilters[group] = [];

        if (isActive) {
            // Unselecting Child
            state.activeFilters[group] = state.activeFilters[group].filter(v => v !== fullValue);

            // If Last Child, and Parent NOT selected, do we select Parent?
            // User says "selecting subcategory doesn't filter to only hotels" -> Implies STRICT filtering.

            // If I unselect child, I'm verifying if I should return to "No Selection" or "All Parent"?
            // Default behavior: Remove selection.
            if (state.activeSubFilters[group]) delete state.activeSubFilters[group][parent];

            // Logic: If no other children of this parent, should we remove parent?
            // Wait, we don't add parent anymore (Fix 1).

        } else {
            // SELECT Child
            // FIX: DO NOT PUSH PARENT. This solves "Shows all interiors".
            // We only push the specific child.
            if (!CONFIG.allowMultiSelect) {
                state.activeFilters[group] = [fullValue];
            } else {
                state.activeFilters[group].push(fullValue);
                // Remove Broad Parent if it exists (Toggle off "All")
                state.activeFilters[group] = state.activeFilters[group].filter(v => v !== parent);
            }

            if (!state.activeSubFilters[group]) state.activeSubFilters[group] = {};
            state.activeSubFilters[group][parent] = child;
            if (!CONFIG.allowMultiSelect) {
                Object.keys(state.activeSubFilters[group]).forEach(p => {
                    if (p !== parent) delete state.activeSubFilters[group][p];
                });
            }
        }

        state.activeFilters[group] = state.activeFilters[group].filter(v => v !== ALL_OPTION_VALUE);
        if (state.activeFilters[group].length === 0) delete state.activeFilters[group];
        state.currentPage = 1;
        updateAllUI();
        allowScrollToGrid = true;
        filterGrid(false);
        updateUrl();
    }

    function updateAllUI() {
        const useCheckboxLayout = CONFIG.filterLayout === 'checkbox' || (isMobileViewport() && (CONFIG.mobile?.displayStyle === 'checkbox' || CONFIG.mobile?.behavior === 'checkbox'));
        // Clear all active states
        document.querySelectorAll('.filter-option-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.filter-option-all').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.parent-chk').forEach(c => { c.checked = false; c.indeterminate = false; }); // Reset indeterminate
        document.querySelectorAll('.child-chk').forEach(c => c.checked = false);
        document.querySelectorAll('.child-chk-all').forEach(c => c.checked = false);
        document.querySelectorAll('.group-all-chk').forEach(c => c.checked = false);
        document.querySelectorAll('.filter-item-wrapper').forEach(w => w.classList.remove('active'));

        Object.keys(state.activeFilters).forEach(group => {
            const groupEl = document.querySelector(`.filter-group-container[data-group="${group}"]`);
            if (!groupEl) return;

            state.activeFilters[group].filter(val => val !== ALL_OPTION_VALUE).forEach(val => {
                if (val.includes(' > ')) {
                    const parts = val.split(' > ');
                    const parent = parts[0];
                    const child = parts[1];

                    // Activate Wrapper (shows children)
                    const wrapper = groupEl.querySelector(`.filter-item-wrapper[data-parent="${parent}"]`);
                    if (wrapper) wrapper.classList.add('active');

                    // Activate Child Button/Checkbox
                    if (useCheckboxLayout) {
                        const childChk = groupEl.querySelector(`.child-chk[data-value="${val}"]`);
                        if (childChk) childChk.checked = true;
                        // Set parent checkbox to indeterminate if some children are selected
                        const pChk = groupEl.querySelector(`.parent-chk[data-value="${parent}"]`);
                        if (pChk) pChk.indeterminate = true;
                    } else {
                        const childBtn = groupEl.querySelector(`.child-btn[data-value="${val}"]`);
                        if (childBtn) childBtn.classList.add('active');
                        // Activate Parent Button as 'active-parent' (maybe different style?)
                        const parentBtn = groupEl.querySelector(`.parent-btn[data-value="${parent}"]`);
                        if (parentBtn) parentBtn.classList.add('active');
                    }

                } else {
                    // Strictly Parent Selected (ALL)
                    const parent = val;
                    const wrapper = groupEl.querySelector(`.filter-item-wrapper[data-parent="${parent}"]`);
                    if (wrapper) wrapper.classList.add('active'); // Show Children

                    if (useCheckboxLayout) {
                        const pChk = groupEl.querySelector(`.parent-chk[data-value="${parent}"]`);
                        if (pChk) pChk.checked = true;
                        const allChk = groupEl.querySelector(`.child-chk-all[data-parent="${parent}"]`);
                        if (allChk) allChk.checked = true;
                    } else {
                        const parentBtn = groupEl.querySelector(`.parent-btn[data-value="${parent}"]`);
                        if (parentBtn) parentBtn.classList.add('active');
                        // Activate "All" Button
                        const allBtn = groupEl.querySelector(`.child-btn-all[data-parent="${parent}"]`);
                        if (allBtn) allBtn.classList.add('active');
                    }
                }
            });
        });

        document.querySelectorAll('.filter-group-container').forEach(groupEl => {
            const group = groupEl.dataset.group;
            const values = Array.isArray(state.activeFilters[group]) ? state.activeFilters[group].filter(v => v !== ALL_OPTION_VALUE) : [];
            if (values.length > 0) return;
            const allBtn = groupEl.querySelector('.filter-option-all.filter-option-btn');
            if (allBtn) allBtn.classList.add('active');
            const allChk = groupEl.querySelector('.group-all-chk');
            if (allChk) allChk.checked = true;
        });
    }

    function resetAll() {
        allowScrollToGrid = true;
        state.activeFilters = {};
        state.activeSubFilters = {};
        state.searchQuery = '';
        const defaultSort = (!CONFIG.displayYearInSort && CONFIG.defaultSortOrder.startsWith('date')) ? 'original' : CONFIG.defaultSortOrder;
        state.sortOrder = defaultSort;
        state.currentPage = 1;
        const searchIn = document.querySelector('.search-group input');
        if (searchIn) searchIn.value = '';
        const s = document.querySelector('.sort-group select');
        if (s) s.value = defaultSort;
        updateAllUI();
        filterGrid(false);
        updateUrl();
    }

    function filterGrid(isLoadMore = false) {
        const gridWrapper = document.getElementById('gridThumbs');
        if (!gridWrapper) return;
        if (!CONFIG.allowMultiSelect) {
            Object.keys(state.activeFilters).forEach(g => {
                const vals = state.activeFilters[g];
                if (Array.isArray(vals) && vals.length > 1) state.activeFilters[g] = [vals[vals.length - 1]];
            });
        }
        applyInitialOrderIfNeeded();
        const gridItems = Array.from(gridWrapper.querySelectorAll('.grid-item'));

        if (!isLoadMore && allowScrollToGrid) {
            const mainWrapper = document.querySelector('.portfolio-main-wrapper');
            if (mainWrapper) mainWrapper.scrollIntoView({ behavior: 'smooth' });
            else gridWrapper.scrollIntoView({ behavior: 'smooth' });
        }

        const filtered = gridItems.filter(item => checkRule(item));
        state.filteredItems = filtered;

        const maxPage = Math.ceil(filtered.length / CONFIG.pagination.itemsPerPage);
        if (state.currentPage > maxPage) state.currentPage = maxPage || 1;

        let limit = filtered.length;
        if (CONFIG.pagination.type !== 'none') {
            limit = state.currentPage * CONFIG.pagination.itemsPerPage;
        }

        const show = filtered.slice(0, limit);
        state.visibleItems = show;

        const animMode = ANIM_MODE;
        const animStagger = ANIM_STAGGER;
        const delayStepMs = animStagger ? 60 : 0;
        const showOrder = new Map();
        show.forEach((itm, idx) => showOrder.set(itm, idx));
        applyAnimationSettings();
        gridItems.forEach(item => {
            if (show.includes(item)) {
                item.style.display = '';
                if (!isLoadMore) {
                    item.classList.remove('pf-anim-visible');
                    void item.offsetWidth;
                    if (itemObserver) {
                        itemObserver.unobserve(item);
                        itemObserver.observe(item);
                    }
                } else {
                    if (itemObserver && !item.classList.contains('pf-anim-visible')) {
                        itemObserver.observe(item);
                    }
                }
                const idx = showOrder.get(item) ?? 0;
                const delay = (animMode !== 'none' && animStagger) ? idx * delayStepMs : 0;
                item.style.setProperty('--pf-anim-delay', `${ delay } ms`);
            } else {
                item.style.display = 'none';
                item.classList.remove('pf-anim-visible');
                if (itemObserver) itemObserver.unobserve(item);
            }
        });
        requestAnimationFrame(replayGridAnimationAfterFilterChange);

        let emptyEl = document.getElementById('pf-no-results');
        if (!emptyEl) {
            emptyEl = document.createElement('div');
            emptyEl.id = 'pf-no-results';
            emptyEl.className = 'pf-no-results';
            const parentCol = document.querySelector('.portfolio-content-col') || gridWrapper.parentNode;
            parentCol.appendChild(emptyEl);
        }
        emptyEl.textContent = NO_RESULTS_TEXT;
        emptyEl.style.display = filtered.length === 0 ? 'block' : 'none';

        updatePaginationControls(filtered.length, show.length);
    }

    function updatePaginationControls(total, shown) {
        let loadBtn = document.getElementById('portfolio-load-more');
        let infMarker = document.getElementById('portfolio-infinite-marker');
        let btnContainer = document.getElementById('portfolio-load-more-container');

        if (loadBtn) loadBtn.remove();
        if (infMarker) infMarker.remove();
        if (btnContainer) btnContainer.remove();

        if (shown >= total) return;

        const gridWrapper = document.getElementById('gridThumbs');
        // Sidebar Layout -> .portfolio-content-col
        const parentCol = document.querySelector('.portfolio-content-col') || gridWrapper.parentNode;

        btnContainer = document.createElement('div');
        btnContainer.id = 'portfolio-load-more-container';
        btnContainer.className = 'portfolio-pagination-container';

        if (CONFIG.pagination.type === 'loadMore') {
            if (CONFIG.pagination.showProgress) {
                const prog = document.createElement('div');
                prog.className = 'pagination-progress';
                prog.textContent = `Showing ${ shown } of ${ total } Projects`;
                btnContainer.appendChild(prog);
            }
            loadBtn = document.createElement('button');
            loadBtn.id = 'portfolio-load-more';
            loadBtn.className = 'load-more-btn';
            loadBtn.textContent = CONFIG.pagination.loadMoreLabel;
            loadBtn.addEventListener('click', () => {
                state.currentPage++;
                filterGrid(true);
            });
            btnContainer.appendChild(loadBtn);
            parentCol.appendChild(btnContainer);

        } else if (CONFIG.pagination.type === 'infinite') {
            infMarker = document.createElement('div');
            infMarker.id = 'portfolio-infinite-marker';
            infMarker.style.height = '20px';
            infMarker.style.marginBottom = '20px';
            parentCol.appendChild(infMarker);
            setupInfiniteScroll(infMarker);
        }
    }

    function checkRule(domItem) {
        const activeGroups = Object.keys(state.activeFilters);
        let groupsMatch = true;
        let href = domItem.getAttribute('href') || (domItem.querySelector('a')?.getAttribute('href')) || '';
        const itemUrl = href.split('?')[0];

        if (activeGroups.length > 0) {
            groupsMatch = activeGroups.every(group => {
                const selectedValues = state.activeFilters[group].filter(v => v !== ALL_OPTION_VALUE);
                if (!selectedValues.length) return true;
                return selectedValues.some(val => {
                    const allowedUrls = state.filters[group][val];
                    return allowedUrls && allowedUrls.some(u => itemUrl.endsWith(u) || u.endsWith(itemUrl));
                });
            });
        }

        let searchMatch = true;
        if (state.searchQuery.length > 0) {
            const dataItem = state.items.find(i => i.fullUrl.endsWith(itemUrl) || itemUrl.endsWith(i.fullUrl));
            if (dataItem) {
                searchMatch = dataItem.searchText.includes(state.searchQuery);
            } else {
                searchMatch = domItem.textContent.toLowerCase().includes(state.searchQuery);
            }
        }
        return groupsMatch && searchMatch;
    }

    function sortGrid() {
        const gridWrapper = document.getElementById('gridThumbs');
        const gridItems = Array.from(gridWrapper.querySelectorAll('.grid-item'));
        gridItems.sort((a, b) => {
            const itemA = getItemDataFromDom(a);
            const itemB = getItemDataFromDom(b);
            if (!itemA || !itemB) return 0;
            if (state.sortOrder === 'original') return getOrderIndex(itemA) - getOrderIndex(itemB);
            if (state.sortOrder === 'asc') return itemA.title.localeCompare(itemB.title);
            if (state.sortOrder === 'desc') return itemB.title.localeCompare(itemA.title);
            if (state.sortOrder === 'date-newest') return (itemB.parsedDate?.getTime() || 0) - (itemA.parsedDate?.getTime() || 0);
            if (state.sortOrder === 'date-oldest') return (itemA.parsedDate?.getTime() || 0) - (itemB.parsedDate?.getTime() || 0);
            return getOrderIndex(itemA) - getOrderIndex(itemB);
        });
        gridItems.forEach(item => gridWrapper.appendChild(item));
        filterGrid(false);
    }

    function applyWrapperState(mainWrapper) {
        if (!mainWrapper) return;
        const topOffset = Number(CONFIG.stickyTopSpacing ?? 0);
        const allowSticky = !!(CONFIG.stickySidebar && (CONFIG.layout || '').toLowerCase() === 'sidebar');
        mainWrapper.classList.toggle('pf-sticky-enabled', allowSticky);
        if (allowSticky) {
            mainWrapper.style.setProperty('--pf-sticky-top', `${isNaN(topOffset) ? 0 : topOffset}px`);
        } else {
            mainWrapper.style.removeProperty('--pf-sticky-top');
        }

        mainWrapper.classList.toggle('pf-tag-style-pills', IS_TAG_PILL_STYLE);
        const tagBg = CONFIG.tagStyle?.bg || '#f0f0f0';
        const tagText = CONFIG.tagStyle?.text || '#333333';
        const tagRadius = Number(CONFIG.tagStyle?.radius ?? 4);
        const tagBorderWidth = Number(CONFIG.tagStyle?.borderWidth ?? 0);
        const tagPadX = Number(CONFIG.tagStyle?.padX ?? 6);
        const tagPadY = Number(CONFIG.tagStyle?.padY ?? 2);
        const tagFontSizeRaw = CONFIG.tagStyle?.fontSize;
        const tagFontSizeNum = Number(tagFontSizeRaw ?? 14);
        const tagFontSize = tagFontSizeRaw === 'inherit' ? 'inherit' : `${isNaN(tagFontSizeNum) ? 14 : tagFontSizeNum}px`;
        mainWrapper.style.setProperty('--pf-tag-bg', tagBg);
        mainWrapper.style.setProperty('--pf-tag-text', tagText);
        mainWrapper.style.setProperty('--pf-tag-radius', `${isNaN(tagRadius) ? 0 : tagRadius}px`);
        mainWrapper.style.setProperty('--pf-tag-border-width', `${isNaN(tagBorderWidth) ? 0 : tagBorderWidth}px`);
        mainWrapper.style.setProperty('--pf-tag-border-color', CONFIG.tagStyle?.borderColor || '#cccccc');
        mainWrapper.style.setProperty('--pf-tag-pad-x', `${isNaN(tagPadX) ? 6 : tagPadX}px`);
        mainWrapper.style.setProperty('--pf-tag-pad-y', `${isNaN(tagPadY) ? 2 : tagPadY}px`);
        mainWrapper.style.setProperty('--pf-tag-font-size', tagFontSize);
    }

    function setupLayout() {
        const gridWrapper = document.getElementById('gridThumbs');
        if (!gridWrapper) return;

        let mainWrapper = document.querySelector('.portfolio-main-wrapper');

        // Ensure wrapper exists
        if (!mainWrapper) {
            mainWrapper = document.createElement('div');
            mainWrapper.classList.add('portfolio-main-wrapper');
            gridWrapper.parentNode.insertBefore(mainWrapper, gridWrapper);
        } else {
            mainWrapper.classList.add('portfolio-main-wrapper');
        }

        let contentCol = mainWrapper.querySelector('.portfolio-content-col');
        if (!contentCol) {
            contentCol = document.createElement('div');
            contentCol.className = 'portfolio-content-col';
            mainWrapper.appendChild(contentCol);
        }
        if (!contentCol.contains(gridWrapper)) {
            contentCol.appendChild(gridWrapper);
        }

        Array.from(mainWrapper.classList)
            .filter(c => c.startsWith('layout-'))
            .forEach(c => mainWrapper.classList.remove(c));
        mainWrapper.classList.add(`layout-${CONFIG.layout}`);

        applyWrapperState(mainWrapper);
    }

    window.PortfolioFilter = { state, CONFIG, initFilter };

})();
