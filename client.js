/**
 * dsh-color-style — ten reading colour schemes for the DeepSeek Harness web UI,
 * lifted from the Tinta Markdown reader (Paper, Sakura, Arctic, Meadow, Dusk,
 * Midnight, Dracula, Forest, Ember, Abyss).
 *
 * Three layers make a palette visible:
 *
 * 1. Design-system token layer — the palette is folded through
 *    `ctx.theme.overrideTokens` as a { light, dark } map, so every surface that
 *    reads `--dsw-*` aliases (window background, sidebar, composer, menus,
 *    Markdown container, code blocks, syntax highlighting) follows the palette.
 *    The selected scheme also owns the Appearance light/dark preference, which
 *    keeps `color-scheme`, `data-ds-dark-theme` and the un-layered tokens
 *    coherent.
 *
 * 2. Belt-and-suspenders stylesheet — one plugin-owned `<style>` node that
 *    paints `html`/`body` with the palette background and colours the Markdown
 *    typography (headings, links, inline code, blockquotes) through structural
 *    selectors. It only sets colours on elements that already exist: no
 *    overlays, no fixed layers, nothing that could cover the UI or block
 *    pointer events. Translucent materials keep their alpha, so menus and
 *    modals stay operable.
 *
 * 3. A dedicated Settings page — registered as a `settings.section`
 *    contribution with its own navigation entry and icon.
 *
 * The selected palette id is browser-local (localStorage); third-party theme
 * ids do not cross the Host settings schema. A leftover selection from the
 * predecessor bundle (`dsh.tinta-themes.active`) is migrated once.
 */
window.__ModuleLoader__.load({
  id: 'dsh-color-style',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const LAYER_SOURCE = 'dsh-color-style';
    const STORAGE_KEY = 'dsh.color-style.active';
    const LEGACY_STORAGE_KEY = 'dsh.tinta-themes.active';
    const LOCALE_NS = 'settings.color-style';
    const STYLE_NODE_ID = 'dsh-color-style-sheet';
    const UI_STYLE_NODE_ID = 'dsh-color-style-ui';

    /* ------------------------------------------------------------------ */
    /* colour helpers                                                      */
    /* ------------------------------------------------------------------ */

    /** Read `#rgb` or `#rrggbb` into an `[r, g, b]` triple. */
    function toRgb(hex) {
      const raw = String(hex).replace('#', '');
      const full =
        raw.length === 3
          ? raw.charAt(0) + raw.charAt(0) + raw.charAt(1) + raw.charAt(1) + raw.charAt(2) + raw.charAt(2)
          : raw;
      return [
        parseInt(full.slice(0, 2), 16),
        parseInt(full.slice(2, 4), 16),
        parseInt(full.slice(4, 6), 16),
      ];
    }

    /** Clamp one channel and format it as two hex digits. */
    function channel(value) {
      const n = Math.max(0, Math.min(255, Math.round(value)));
      return n.toString(16).padStart(2, '0');
    }

    /** Compose a colour from channels. */
    function toHex(r, g, b) {
      return '#' + channel(r) + channel(g) + channel(b);
    }

    /** Mix `ratio` of `b` into `a`. */
    function mix(a, b, ratio) {
      const first = toRgb(a);
      const second = toRgb(b);
      return toHex(
        first[0] + (second[0] - first[0]) * ratio,
        first[1] + (second[1] - first[1]) * ratio,
        first[2] + (second[2] - first[2]) * ratio,
      );
    }

    /** Append an 8-bit alpha channel to a hex colour. */
    function alpha(hex, value) {
      return hex + channel(Math.max(0, Math.min(1, value)) * 255);
    }

    /** Relative luminance of a hex colour. */
    function luminance(hex) {
      const channels = toRgb(hex).map((value) => {
        const c = value / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    }

    /** Readable ink for a filled surface. */
    function inkOn(hex) {
      return luminance(hex) > 0.42 ? '#141418' : '#ffffff';
    }

    /* ------------------------------------------------------------------ */
    /* palettes — the Markdown reader's ten schemes, verbatim hex values   */
    /* ------------------------------------------------------------------ */

    const PALETTES = [
      {
        id: 'paper',
        scheme: 'light',
        bg: '#F5F1E8',
        text: '#3D3329',
        heading: '#2A1F16',
        link: '#B85A3C',
        accent: '#B85A3C',
        codeBg: '#EDE6DA',
        border: '#C4B8A8',
        keyword: '#8B4513',
        string: '#3E7D5A',
        comment: '#9A8F80',
        number: '#B8860B',
        fn: '#3B5BA5',
        type: '#8A63A8',
        control: '#7D4CA0',
      },
      {
        id: 'sakura',
        scheme: 'light',
        bg: '#FDF8F8',
        text: '#404040',
        heading: '#C44569',
        link: '#D25980',
        accent: '#C44569',
        codeBg: '#F8ECF0',
        border: '#E8B4C0',
        keyword: '#C44569',
        string: '#4E9B6F',
        comment: '#A8969C',
        number: '#D25980',
        fn: '#6455B8',
        type: '#8B5570',
        control: '#9D5BC8',
      },
      {
        id: 'arctic',
        scheme: 'light',
        bg: '#F7FAFC',
        text: '#2D3748',
        heading: '#1A365D',
        link: '#2B6CB0',
        accent: '#2B6CB0',
        codeBg: '#EBF8FF',
        border: '#A0C4E8',
        keyword: '#2B6CB0',
        string: '#38795B',
        comment: '#8295A8',
        number: '#C05621',
        fn: '#2C7A7B',
        type: '#6B5B95',
        control: '#805AD5',
      },
      {
        id: 'meadow',
        scheme: 'light',
        bg: '#F7FAF7',
        text: '#1A2F1A',
        heading: '#1C4532',
        link: '#2F855A',
        accent: '#2F855A',
        codeBg: '#E6FFED',
        border: '#9AE6B4',
        keyword: '#2F6B4F',
        string: '#A0742C',
        comment: '#7E8B7E',
        number: '#C05621',
        fn: '#38A169',
        type: '#6B5B95',
        control: '#7D5BA6',
      },
      {
        id: 'dusk',
        scheme: 'light',
        bg: '#FFFBF5',
        text: '#553C10',
        heading: '#9C4221',
        link: '#A66A12',
        accent: '#A66A12',
        codeBg: '#FEF5E7',
        border: '#E8C48D',
        keyword: '#9C4221',
        string: '#4E8A5A',
        comment: '#9C8D77',
        number: '#A66A12',
        fn: '#5B5EA6',
        type: '#8B4513',
        control: '#8A4E9E',
      },
      {
        id: 'midnight',
        scheme: 'dark',
        bg: '#0D1B2A',
        text: '#E0E1DD',
        heading: '#F0F4F8',
        link: '#38C6E4',
        accent: '#38C6E4',
        codeBg: '#1B263B',
        border: '#415A77',
        keyword: '#38C6E4',
        string: '#9ADBA4',
        comment: '#6C7A89',
        number: '#F2CE6B',
        fn: '#90E0EF',
        type: '#C9A6DE',
        control: '#D793CF',
      },
      {
        id: 'dracula',
        scheme: 'dark',
        bg: '#282A36',
        text: '#F8F8F2',
        heading: '#FF79C6',
        link: '#8BE9FD',
        accent: '#BD93F9',
        codeBg: '#21222C',
        border: '#6272A4',
        keyword: '#FF79C6',
        string: '#F1FA8C',
        comment: '#6272A4',
        number: '#BD93F9',
        fn: '#50FA7B',
        type: '#8BE9FD',
        control: '#BD93F9',
      },
      {
        id: 'forest',
        scheme: 'dark',
        bg: '#0D1512',
        text: '#B8C5B2',
        heading: '#9AE6B4',
        link: '#68D391',
        accent: '#68D391',
        codeBg: '#1A2A23',
        border: '#4A6E5A',
        keyword: '#9AE6B4',
        string: '#D9CB7E',
        comment: '#5F7A6A',
        number: '#E8A85C',
        fn: '#68D391',
        type: '#81E6D9',
        control: '#C99BE8',
      },
      {
        id: 'ember',
        scheme: 'dark',
        bg: '#1A1614',
        text: '#D4C5B9',
        heading: '#F6AD55',
        link: '#F1975A',
        accent: '#F1975A',
        codeBg: '#252019',
        border: '#5C4A3A',
        keyword: '#F6AD55',
        string: '#A8C98A',
        comment: '#6B5B4F',
        number: '#D9A662',
        fn: '#ED8936',
        type: '#C9A0C9',
        control: '#E08BB0',
      },
      {
        id: 'abyss',
        scheme: 'dark',
        bg: '#000000',
        text: '#EDEDED',
        heading: '#2EE6CF',
        link: '#FF4DD8',
        accent: '#2EE6CF',
        codeBg: '#0F0F0F',
        border: '#333333',
        keyword: '#FF4DD8',
        string: '#B8F53C',
        comment: '#5C6660',
        number: '#FF8A3D',
        fn: '#2EE6CF',
        type: '#F5E663',
        control: '#C77DFF',
      },
    ];

    /* Palette hex values are stored lower case once, instead of at every use site. */
    for (const palette of PALETTES) {
      for (const key of Object.keys(palette)) {
        const value = palette[key];
        if (typeof value === 'string' && value.charAt(0) === '#') palette[key] = value.toLowerCase();
      }
    }

    /** Palette lookup by id. */
    function paletteById(id) {
      for (const palette of PALETTES) if (palette.id === id) return palette;
      return null;
    }

    const SUCCESS = '#22c55e';
    const WARNING = '#f59e0b';
    const DANGER = '#ef4444';

    /* ------------------------------------------------------------------ */
    /* token layer                                                         */
    /* ------------------------------------------------------------------ */

    /**
     * Derive the design-system token values for one palette. Every value is
     * published for both color schemes, so the layer survives Appearance
     * switches without going illegible.
     * @param palette - scheme data.
     * @returns token name to CSS value.
     */
    function deriveTokens(palette) {
      const dark = palette.scheme === 'dark';
      const bg = palette.bg;
      const fg = palette.text;
      const accent = palette.accent;
      const codeBg = palette.codeBg;

      /* raised surfaces */
      const layer1 = dark ? mix(bg, '#ffffff', 0.06) : mix(bg, '#ffffff', 0.55);
      const layer2 = dark ? mix(bg, '#ffffff', 0.1) : mix(bg, '#ffffff', 0.72);
      const layer3 = dark ? mix(bg, '#ffffff', 0.14) : mix(bg, '#ffffff', 0.88);
      const modulePlatform = dark ? mix(bg, '#ffffff', 0.08) : mix(bg, fg, 0.05);
      const multiSelect = dark ? mix(bg, '#ffffff', 0.06) : mix(bg, fg, 0.06);
      const overlay = dark ? mix(bg, '#ffffff', 0.16) : mix(bg, fg, 0.07);
      const documentPreview = dark ? mix(bg, '#ffffff', 0.05) : mix(bg, fg, 0.06);

      /* sidebar and selector surfaces */
      const sidebar = dark ? mix(bg, '#ffffff', 0.03) : mix(bg, fg, 0.035);
      const sidebarActive = dark ? mix(bg, '#ffffff', 0.1) : mix(bg, fg, 0.075);
      const sidebarHover = dark ? mix(bg, '#ffffff', 0.06) : mix(bg, fg, 0.05);
      const sidebarAccent = mix(bg, accent, dark ? 0.16 : 0.14);
      const selector = dark ? mix(bg, '#ffffff', 0.08) : mix(bg, fg, 0.06);
      const inputMajor = dark ? mix(bg, '#ffffff', 0.08) : mix(bg, '#ffffff', 0.6);
      const loginInput = dark ? mix(bg, '#ffffff', 0.05) : mix(bg, fg, 0.03);
      const tip = dark ? mix(bg, '#ffffff', 0.06) : mix(bg, fg, 0.05);
      const bubble = mix(bg, accent, dark ? 0.12 : 0.1);
      const bubbleHighlight = mix(bg, accent, dark ? 0.2 : 0.18);

      /* menu material keeps its translucency — an opaque fill here would sit
         over every dropdown and detach it from the window */
      const menuFill = dark ? alpha(mix(bg, '#ffffff', 0.12), 0.55) : alpha(mix(bg, '#ffffff', 0.62), 0.62);
      const menuGroupHeader = dark
        ? alpha(mix(bg, '#ffffff', 0.14), 0.94)
        : alpha(mix(bg, '#ffffff', 0.85), 0.94);

      /* ink */
      const labelSecondary = mix(fg, bg, dark ? 0.2 : 0.24);
      const labelTertiary = mix(fg, bg, dark ? 0.4 : 0.42);
      const labelCaption = mix(fg, bg, dark ? 0.66 : 0.58);
      const labelDimmed = mix(fg, bg, dark ? 0.8 : 0.82);
      const labelPrimaryDimmed = mix(fg, bg, dark ? 0.1 : 0.12);
      const labelBluish = mix(fg, accent, dark ? 0.3 : 0.35);
      const labelPreview = mix(fg, bg, dark ? 0.28 : 0.32);

      /* borders and washes */
      const border1 = alpha(dark ? '#ffffff' : fg, dark ? 0.08 : 0.06);
      const border2 = alpha(dark ? '#ffffff' : fg, dark ? 0.12 : 0.12);
      const border3 = alpha(dark ? '#ffffff' : fg, dark ? 0.18 : 0.16);
      const border4 = alpha(dark ? '#ffffff' : fg, dark ? 0.22 : 0.2);
      const washHover = alpha(dark ? '#ffffff' : fg, dark ? 0.08 : 0.05);
      const washActive = alpha(dark ? '#ffffff' : fg, dark ? 0.14 : 0.09);
      const washAccent = alpha(accent, dark ? 0.22 : 0.12);
      const washSolid = dark ? mix(bg, '#ffffff', 0.09) : mix(bg, fg, 0.05);

      /* controls */
      const elevated = layer2;
      const floating = dark ? mix(bg, '#ffffff', 0.1) : layer2;
      const floatingHover = dark ? mix(bg, '#ffffff', 0.14) : mix(bg, fg, 0.06);
      const ghostFill = dark ? mix(bg, '#ffffff', 0.12) : mix(bg, fg, 0.09);
      const ghostHover = dark ? mix(bg, '#ffffff', 0.16) : mix(bg, fg, 0.13);
      const ghostBorder = dark ? mix('#ffffff', bg, 0.55) : mix(fg, bg, 0.42);
      const contrast = dark ? mix('#ffffff', bg, 0.1) : mix(fg, bg, 0.06);
      const primaryHover = mix(accent, '#ffffff', 0.14);
      const primaryDimmed = mix(bg, accent, dark ? 0.22 : 0.14);

      /* status surfaces */
      const successTertiary = mix(bg, SUCCESS, dark ? 0.16 : 0.14);
      const warnTertiary = mix(bg, WARNING, dark ? 0.18 : 0.16);
      const businessTertiary = mix(bg, accent, dark ? 0.2 : 0.14);
      const idlePrimary = mix(fg, bg, dark ? 0.62 : 0.72);

      /* markdown */
      const codeBanner = mix(codeBg, fg, 0.05);
      const inlineCode = dark ? mix(codeBg, '#ffffff', 0.05) : mix(codeBg, '#ffffff', 0.35);
      const segmentUnselected = dark ? mix(bg, '#ffffff', 0.06) : mix(bg, fg, 0.05);
      const citation = dark ? mix(bg, '#ffffff', 0.1) : mix(bg, fg, 0.08);
      const markdownTag = dark ? mix(bg, '#ffffff', 0.08) : mix(bg, fg, 0.07);
      const markdownPlaceholder = dark ? mix(bg, '#ffffff', 0.08) : mix(bg, fg, 0.06);

      /* scrollbar, toast, tooltip */
      const scrollBar = alpha(dark ? '#ffffff' : fg, dark ? 0.15 : 0.13);
      const scrollBar2 = alpha(dark ? '#ffffff' : fg, dark ? 0.17 : 0.13);
      const scrollHover = alpha(dark ? '#ffffff' : fg, dark ? 0.24 : 0.22);
      const scrollHover2 = alpha(dark ? '#ffffff' : fg, dark ? 0.28 : 0.22);
      const toastBg = dark ? mix(bg, '#ffffff', 0.2) : mix(fg, bg, 0.06);
      const tooltipBg = dark ? mix(bg, '#ffffff', 0.2) : mix(fg, bg, 0.12);
      const tooltipKey = mix(tooltipBg, '#ffffff', 0.18);

      /* diffs */
      const addedBg = mix(bg, SUCCESS, dark ? 0.16 : 0.14);
      const addedGutter = mix(bg, SUCCESS, dark ? 0.09 : 0.08);
      const addedMarker = dark ? '#41c977' : mix(SUCCESS, fg, 0.3);
      const deletedBg = mix(bg, DANGER, dark ? 0.16 : 0.13);
      const deletedGutter = mix(bg, DANGER, dark ? 0.09 : 0.07);
      const deletedMarker = dark ? '#fa423e' : mix(DANGER, fg, 0.25);

      /* the reasoning rows fade through a gradient built from the page colour */
      const thinkSelect = dark ? mix(bg, '#ffffff', 0.1) : mix(bg, fg, 0.035);

      return {
        '--dsw-alias-bg-base': bg,
        '--dsw-alias-bg-layer-1': layer1,
        '--dsw-alias-bg-layer-2': layer2,
        '--dsw-alias-bg-layer-3': layer3,
        '--dsw-alias-bg-overlay': overlay,
        '--dsw-alias-bg-module-platform': modulePlatform,
        '--dsw-alias-bg-multi-select': multiSelect,
        '--dsw-alias-bg-document-preview': documentPreview,
        '--dsw-alias-bg-document-selection': alpha(accent, 0.32),
        '--dsw-alias-bg-skeleton': alpha(dark ? '#ffffff' : fg, dark ? 0.08 : 0.05),
        '--dsw-alias-bg-mask-drop': alpha(layer3, 0.7),

        '--dsw-alias-border-l1': border1,
        '--dsw-alias-border-l2': border2,
        '--dsw-alias-border-l2-darkmode-thin': border2,
        '--dsw-alias-border-l3': border3,
        '--dsw-alias-border-l4': border4,
        '--dsw-alias-border-inverted': dark ? alpha('#ffffff', 0.06) : '#00000000',
        '--dsw-alias-border-inverted2': dark ? alpha('#ffffff', 0.1) : '#00000000',

        '--dsw-alias-label-primary': fg,
        '--dsw-alias-label-secondary': labelSecondary,
        '--dsw-alias-label-tertiary': labelTertiary,
        '--dsw-alias-label-caption': labelCaption,
        '--dsw-alias-label-dimmed': labelDimmed,
        '--dsw-alias-label-primary-dimmed': labelPrimaryDimmed,
        '--dsw-alias-label-primary-inverted': inkOn(contrast),
        '--dsw-alias-label-primary-foreground': inkOn(accent),
        '--dsw-alias-label-primary-bluish': labelBluish,
        '--dsw-alias-label-document-preview': labelPreview,

        '--dsw-alias-brand-primary': accent,
        '--dsw-alias-brand-primary-invert': accent,
        '--dsw-alias-brand-primary-new-colorprimary-new-color': accent,
        '--dsw-alias-brand-text': palette.heading,
        '--dsw-alias-button-primary-fill': accent,
        '--dsw-alias-button-primary-hover': primaryHover,
        '--dsw-alias-button-primary-dimmed': primaryDimmed,
        '--dsw-alias-button-info-fill': accent,
        '--dsw-alias-button-info-hover': primaryHover,
        '--dsw-alias-button-contrast-fill': contrast,
        '--dsw-alias-button-elevated-fill': elevated,
        '--dsw-alias-button-floating-fill': floating,
        '--dsw-alias-button-floating-hover': floatingHover,
        '--dsw-alias-button-ghost-active-fill': ghostFill,
        '--dsw-alias-button-ghost-active-hover': ghostHover,
        '--dsw-alias-button-ghost-active-border': ghostBorder,
        '--dsw-alias-link': palette.link,
        '--dsw-alias-state-business-primary': accent,
        '--dsw-alias-state-business-tertiary': businessTertiary,
        '--dsw-alias-state-idle-primary': idlePrimary,
        '--dsw-alias-state-success-tertiary': successTertiary,
        '--dsw-alias-state-warn-tertiary': warnTertiary,
        '--dsw-alias-interactive-bg-hover': washHover,
        '--dsw-alias-interactive-bg-active': washActive,
        '--dsw-alias-interactive-bg-hover-accent': washAccent,
        '--dsw-alias-interactive-bg-hover-solid': washSolid,

        '--dsw-alias-markdown-code-block': codeBg,
        '--dsw-alias-markdown-code-block-banner': codeBanner,
        '--dsw-alias-markdown-code-segment-selected': layer3,
        '--dsw-alias-markdown-code-segment-unselected': segmentUnselected,
        '--dsw-alias-markdown-inline-code': inlineCode,
        '--dsw-alias-markdown-citation': citation,
        '--dsw-alias-markdown-tag': markdownTag,
        '--dsw-alias-markdown-placeholder': markdownPlaceholder,

        '--dsw-alias-menu-icon': mix(fg, bg, dark ? 0.18 : 0.28),
        '--dsw-alias-menu-group-header-fill': menuGroupHeader,
        '--dsw-alias-scrollbar-bg-l1': scrollBar,
        '--dsw-alias-scrollbar-bg-l2': scrollBar2,
        '--dsw-alias-scrollbar-hover-l1': scrollHover,
        '--dsw-alias-scrollbar-hover-l2': scrollHover2,
        '--dsw-alias-switch-thumb': dark ? mix(fg, bg, 0.55) : '#ffffff',
        '--dsw-alias-toast-bg': toastBg,
        '--dsw-alias-toast-label': inkOn(toastBg),
        '--dsw-alias-tooltip-bg': tooltipBg,
        '--dsw-alias-tooltip-key-bg': tooltipKey,
        '--dsw-alias-turn-trigger-bg': codeBg,
        '--dsw-alias-turn-trigger-bg-hover': washHover,

        '--dsw-alias-code-diff-added': alpha(SUCCESS, dark ? 0.12 : 0.08),
        '--dsw-alias-code-diff-deleted': alpha(DANGER, dark ? 0.12 : 0.08),
        '--dsw-alias-file-diff-added-bg': addedBg,
        '--dsw-alias-file-diff-added-gutter': addedGutter,
        '--dsw-alias-file-diff-added-marker': addedMarker,
        '--dsw-alias-file-diff-deleted-bg': deletedBg,
        '--dsw-alias-file-diff-deleted-gutter': deletedGutter,
        '--dsw-alias-file-diff-deleted-marker': deletedMarker,

        '--dsw-menu-surface-fill': menuFill,
        '--dsw-specific-menu': 'var(--dsw-menu-surface-fill)',
        '--dsw-specific-bubble': bubble,
        '--dsw-specific-bubble-highlight': bubbleHighlight,
        '--dsw-specific-input-major': inputMajor,
        '--dsw-specific-login-input': loginInput,
        '--dsw-specific-selector': selector,
        '--dsw-specific-sidebar-fill': sidebar,
        '--dsw-specific-sidebar-nav-item-active': sidebarActive,
        '--dsw-specific-sidebar-nav-item-active-accent': sidebarAccent,
        '--dsw-specific-sidebar-nav-item-hover': sidebarHover,
        '--dsw-specific-tip': tip,

        '--shiki-foreground': fg,
        '--shiki-background': 'var(--dsw-alias-markdown-code-block)',
        '--shiki-token-constant': palette.number,
        '--shiki-token-string': palette.string,
        '--shiki-token-comment': palette.comment,
        '--shiki-token-keyword': palette.keyword,
        '--shiki-token-parameter': palette.type,
        '--shiki-token-function': palette.fn,
        '--shiki-token-string-expression': palette.string,
        '--shiki-token-punctuation': mix(fg, bg, dark ? 0.35 : 0.42),
        '--shiki-token-link': palette.link,

        '--dsw-linear-gradient-think': 'linear-gradient(180deg, ' + bg + ' 20.19%, ' + alpha(bg, 0) + ')',
        '--dsw-linear-think-select':
          'linear-gradient(180deg, ' + thinkSelect + ' 20.19%, ' + alpha(thinkSelect, 0) + ')',
      };
    }

    /** Fold a flat token map into the `{ light, dark }` shape the layer wants. */
    function asLayer(tokens) {
      const layer = {};
      for (const name of Object.keys(tokens)) {
        layer[name] = { light: tokens[name], dark: tokens[name] };
      }
      return layer;
    }

    /* ------------------------------------------------------------------ */
    /* belt-and-suspenders stylesheet                                      */
    /* ------------------------------------------------------------------ */

    /**
     * Compile the palette stylesheet. Colours land on elements that already
     * exist (html/body and the Markdown typography); `html`/`body` only receive
     * a background colour behind the app, never a covering layer, so clicks,
     * menus and translucent materials stay untouched.
     * @param palette - scheme data.
     * @returns stylesheet text.
     */
    function compileSheet(palette) {
      const quoteInk = mix(palette.text, palette.bg, 0.22);
      return [
        /* whole-window canvas */
        ':root,html,body{background-color:' + palette.bg + '}',
        'body{color:' + palette.text + '}',
        /* Markdown typography — structural selectors over CSS-module roots */
        ':where([class*="_markdown_"]) :where(h1,h2,h3,h4,h5,h6){color:' + palette.heading + '}',
        ':where([class*="_markdown_"]) :where(a){color:' + palette.link + '}',
        ':where([class*="_markdown_"]) :where(a:focus,a:hover){text-decoration-color:' + palette.link + '}',
        ':where([class*="_markdown_"]) :where(blockquote){border-left-color:' + palette.border + ';color:' + quoteInk + '}',
        ':where([class*="_markdown_"]) :where(:not(pre)>code){color:' + palette.code + '}',
      ]
        .join('\n');
    }

    /** The palette-independent stylesheet for the settings page UI. */
    const UI_STYLE_TEXT = [
      '.dcs-page{display:flex;flex-direction:column;gap:16px;padding:20px 24px 32px;max-width:760px}',
      '.dcs-page-head{display:flex;flex-direction:column;gap:4px}',
      '.dcs-page-title{color:var(--dsw-alias-label-primary);font-size:16px;font-weight:500;line-height:24px}',
      '.dcs-page-desc{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}',
      '.dcs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:10px}',
      '.dcs-card{box-sizing:border-box;display:flex;flex-direction:column;gap:6px;padding:8px;font:inherit;color:var(--dsw-alias-label-primary);text-align:left;cursor:pointer;background:0 0;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md)}',
      '.dcs-card:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      ".dcs-card[aria-pressed='true']{border-color:var(--dsw-alias-brand-primary);box-shadow:inset 0 0 0 1px var(--dsw-alias-brand-primary)}",
      '.dcs-preview{display:flex;align-items:center;justify-content:space-between;gap:6px;height:44px;padding:0 9px;border-radius:var(--dsw-radius-xs);border:.5px solid transparent;overflow:hidden}',
      '.dcs-preview-strong{font-size:15px;font-weight:600;line-height:1}',
      '.dcs-preview-stack{display:flex;flex-direction:column;gap:3px;align-items:flex-end}',
      '.dcs-dots{display:flex;align-items:center;gap:3px}',
      '.dcs-dot{width:7px;height:7px;border-radius:50%}',
      '.dcs-preview-line{height:2px;border-radius:1px}',
      '.dcs-name{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:12px;line-height:16px;color:var(--dsw-alias-label-primary)}',
      '.dcs-tag{font-size:10px;line-height:14px;color:var(--dsw-alias-label-tertiary);border:.5px solid var(--dsw-alias-border-l2);border-radius:999px;padding:0 5px;flex:none}',
      '.dcs-reset{align-self:flex-start;border:0;background:0 0;padding:2px 0;color:var(--dsw-alias-link);font:inherit;font-size:12px;line-height:18px;cursor:pointer}',
      '.dcs-reset:hover{text-decoration:underline}',
    ].join('\n');

    /** Install (once) and return a plugin-owned style node. */
    function ensureStyleNode(id) {
      let node = document.getElementById(id);
      if (node === null) {
        node = document.createElement('style');
        node.id = id;
        node.dataset.plugin = 'dsh-color-style';
        document.head.appendChild(node);
      }
      return node;
    }

    /* ------------------------------------------------------------------ */
    /* copy                                                                */
    /* ------------------------------------------------------------------ */

    const DICTIONARIES = {
      zh: {
        nav: '配色方案',
        title: '配色方案',
        description:
          '十种来自 Markdown 阅读器的阅读配色：选中后整个窗口背景与正文 Markdown 跟随方案变化，外观的明暗模式也会同步切换。',
        reset: '恢复默认外观',
        light: '浅色',
        dark: '深色',
        'scheme.paper': '纸卷',
        'scheme.sakura': '樱雪',
        'scheme.arctic': '冰原',
        'scheme.meadow': '草甸',
        'scheme.dusk': '暮光',
        'scheme.midnight': '午夜',
        'scheme.dracula': '德古拉',
        'scheme.forest': '幽林',
        'scheme.ember': '余烬',
        'scheme.abyss': '深渊',
      },
      en: {
        nav: 'Colour schemes',
        title: 'Colour schemes',
        description:
          'Ten reading palettes from the Markdown viewer. The whole window background and the rendered Markdown follow the palette, and the light or dark appearance follows along.',
        reset: 'Restore default appearance',
        light: 'Light',
        dark: 'Dark',
        'scheme.paper': 'Paper',
        'scheme.sakura': 'Sakura',
        'scheme.arctic': 'Arctic',
        'scheme.meadow': 'Meadow',
        'scheme.dusk': 'Dusk',
        'scheme.midnight': 'Midnight',
        'scheme.dracula': 'Dracula',
        'scheme.forest': 'Forest',
        'scheme.ember': 'Ember',
        'scheme.abyss': 'Abyss',
      },
    };

    /* ------------------------------------------------------------------ */
    /* plugin                                                              */
    /* ------------------------------------------------------------------ */

    return {
      inject: ['slots', 'theme', 'locale'],
      apply(ctx) {
        const theme = ctx.theme;
        const locale = ctx.locale;

        ctx.effect(() => locale.register(LOCALE_NS, DICTIONARIES), 'color-style: dictionaries');

        /** Subscribers that need a re-render (React state bumpers). */
        const waiters = new Set();
        let activeId = null;
        let layer = null;
        let writing = false;
        let reasserts = 0;

        function bump() {
          for (const waiter of Array.from(waiters)) {
            try {
              waiter();
            } catch (error) {
              /* a torn-down component must not break the others */
            }
          }
        }

        function readStored() {
          try {
            return window.localStorage.getItem(STORAGE_KEY);
          } catch (error) {
            return null;
          }
        }

        function writeStored(value) {
          try {
            if (value === null) window.localStorage.removeItem(STORAGE_KEY);
            else window.localStorage.setItem(STORAGE_KEY, value);
          } catch (error) {
            /* private mode: the palette stays for this page only */
          }
        }

        /** Adopt a selection left by the predecessor tinta-themes bundle. */
        function migrateLegacyStorage() {
          try {
            const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
            if (legacy !== null) {
              window.localStorage.removeItem(LEGACY_STORAGE_KEY);
              if (readStored() === null && paletteById(legacy) !== null) writeStored(legacy);
            }
          } catch (error) {
            /* storage unavailable: nothing to migrate */
          }
        }

        /** Drop the palette layer and the injected sheet. */
        function dropPalette() {
          if (layer !== null) {
            layer();
            layer = null;
          }
          const sheet = document.getElementById(STYLE_NODE_ID);
          if (sheet !== null) sheet.textContent = '';
          activeId = null;
        }

        function applyPalette(id) {
          const palette = paletteById(id);
          if (palette === null) return;
          writing = true;
          try {
            theme.setTheme(palette.scheme);
            dropPalette();
            layer = theme.overrideTokens(LAYER_SOURCE, asLayer(deriveTokens(palette)));
            ensureStyleNode(STYLE_NODE_ID).textContent = compileSheet(palette);
            activeId = palette.id;
            writeStored(palette.id);
          } catch (error) {
            dropPalette();
          } finally {
            writing = false;
          }
          bump();
        }

        function selectPalette(id) {
          reasserts = 0;
          applyPalette(id);
        }

        function clearPalette() {
          reasserts = 0;
          writing = true;
          try {
            dropPalette();
            writeStored(null);
          } finally {
            writing = false;
          }
          bump();
        }

        /* The palette owns the Appearance mode. When the preference moves away
           from the active palette (a durable-settings echo, a rejected write, a
           reload), reassert it instead of losing the scheme; a bounded counter
           stops the loop if the Host keeps refusing the write. */
        ctx.on('theme/change', (snapshot) => {
          const snap = snapshot !== undefined && snapshot !== null ? snapshot : theme.getTheme();
          if (!writing && activeId !== null) {
            const palette = paletteById(activeId);
            if (palette !== null && snap.preference !== palette.scheme) {
              if (reasserts < 5) {
                reasserts += 1;
                applyPalette(activeId);
              } else if (reasserts === 5) {
                reasserts += 1;
                console.warn(
                  '[dsh-color-style] 外观模式跟随已停止（设置写入被反复拒绝），仅保留配色令牌层。',
                );
              }
            }
          }
          bump();
        });

        ctx.effect(
          () => () => {
            dropPalette();
            for (const id of [STYLE_NODE_ID, UI_STYLE_NODE_ID]) {
              const node = document.getElementById(id);
              if (node !== null) node.remove();
            }
          },
          'color-style: release palette layer and sheets',
        );

        ensureStyleNode(UI_STYLE_NODE_ID).textContent = UI_STYLE_TEXT;

        migrateLegacyStorage();
        const stored = readStored();
        if (stored !== null && paletteById(stored) !== null) applyPalette(stored);

        /* ---------------------------------------------------------------- */
        /* settings page                                                    */
        /* ---------------------------------------------------------------- */

        /** Navigation icon; currentColor keeps it on the palette's own ink. */
        function SectionIcon({ size }) {
          const px = typeof size === 'number' ? size : 16;
          return h(
            'svg',
            {
              width: px,
              height: px,
              viewBox: '0 0 24 24',
              fill: 'none',
              stroke: 'currentColor',
              strokeWidth: 1.6,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              'aria-hidden': true,
            },
            h('path', {
              d: 'M12 3a9 9 0 1 0 0 18h.6a2.4 2.4 0 0 0 1.7-4.1c-.6-.6-.9-1.4-.9-2.2a2.4 2.4 0 0 1 2.4-2.4H18A3 3 0 0 0 21 9.3 9 9 0 0 0 12 3Z',
            }),
            h('circle', { cx: 7.5, cy: 10.5, r: 1, fill: 'currentColor', stroke: 'none' }),
            h('circle', { cx: 12, cy: 7.5, r: 1, fill: 'currentColor', stroke: 'none' }),
            h('circle', { cx: 16.5, cy: 10.5, r: 1, fill: 'currentColor', stroke: 'none' }),
          );
        }

        function ColorStylePage() {
          const [, force] = React.useState(0);
          React.useEffect(() => {
            const waiter = () => force((value) => value + 1);
            waiters.add(waiter);
            const offLocale = locale.subscribe(waiter);
            return () => {
              waiters.delete(waiter);
              offLocale();
            };
          }, []);

          const t = locale.bind(LOCALE_NS);
          const selected = activeId;

          return h(
            'div',
            { className: 'dcs-page' },
            h(
              'div',
              { className: 'dcs-page-head' },
              h('div', { className: 'dcs-page-title' }, t('title')),
              h('div', { className: 'dcs-page-desc' }, t('description')),
            ),
            h(
              'div',
              { className: 'dcs-grid', role: 'group', 'aria-label': t('title') },
              PALETTES.map((palette) =>
                h(
                  'button',
                  {
                    key: palette.id,
                    type: 'button',
                    className: 'dcs-card',
                    'aria-pressed': selected === palette.id,
                    title: t('scheme.' + palette.id),
                    onClick: () => selectPalette(palette.id),
                  },
                  h(
                    'span',
                    {
                      className: 'dcs-preview',
                      style: { background: palette.bg, borderColor: palette.border },
                    },
                    h(
                      'span',
                      { className: 'dcs-preview-strong', style: { color: palette.heading } },
                      'Aa',
                    ),
                    h(
                      'span',
                      { className: 'dcs-preview-stack' },
                      h(
                        'span',
                        { className: 'dcs-dots' },
                        [palette.accent, palette.link, palette.string, palette.fn, palette.control].map(
                          (colour, index) =>
                            h('span', {
                              key: String(index),
                              className: 'dcs-dot',
                              style: { background: colour },
                            }),
                        ),
                      ),
                      h('span', {
                        className: 'dcs-preview-line',
                        style: { width: 34, background: palette.codeBg, border: '.5px solid ' + palette.border },
                      }),
                    ),
                  ),
                  h(
                    'span',
                    { className: 'dcs-name' },
                    h('span', null, t('scheme.' + palette.id)),
                    h('span', { className: 'dcs-tag' }, t(palette.scheme)),
                  ),
                ),
              ),
            ),
            selected === null
              ? null
              : h(
                  'button',
                  {
                    type: 'button',
                    className: 'dcs-reset',
                    onClick: () => clearPalette(),
                  },
                  t('reset'),
                ),
          );
        }

        ctx.slots.inject('settings.section.icon', () =>
          ctx.slots.register(
            {
              name: 'settings.section.icon',
              id: 'color-style',
            },
            SectionIcon,
          ),
        );

        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            {
              name: 'settings.section',
              id: 'color-style',
              order: 30,
              label: () => {
                const t = locale.bind(LOCALE_NS);
                return t('nav');
              },
              locale: LOCALE_NS,
              inject: () => ({}),
            },
            ColorStylePage,
          ),
        );
      },
    };
  },
});
