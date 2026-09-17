# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Hand-authored static HTML site for Medu Consultancy, a PF (EPF) & ESI compliance
consultancy in Mangalore, Karnataka. Deployed on GitHub Pages at the custom domain
`www.meduconsultancy.com` (see `CNAME`). **No build step, no bundler, no package
manager, no templating engine, no shared partials/includes.** Every page is a
complete, standalone `.html` file with the header/nav and footer copy-pasted
verbatim into it.

There are 65 HTML files: core pages, 22 `epf-esi-consultancy-<city>.html` city
landing pages, `blogs/` (index + 4 posts), and a parallel Kannada tree under `kn/`
mirroring most of the above (`kn/epf-esi-consultancy-<city>.html` x22 plus the
non-location pages). English and Kannada counterparts are linked via `hreflang`
alternate tags and a header `lang-switch` link.

## Working in this repo

There is no build/lint/test tooling - just edit the HTML/CSS/JS files directly and
open them in a browser (or a static file server) to check changes.

- **Sitemap edits**: after changing `sitemap.xml`, validate it's well-formed XML:
  `python3 -c "import xml.dom.minidom; xml.dom.minidom.parse('sitemap.xml'); print('OK')"`
- **Site-wide nav/footer changes**: since the header and footer are duplicated
  in every file, a nav/footer/service-list/locations-list change must be applied
  identically across all ~65 pages. Prefer a scripted find-and-replace (e.g.
  `perl -0pi -e 's/.../.../s'` slurp mode) over hand-editing each file, and verify
  the replacement count matches the expected file count afterward.
- **New city page**: copy an existing `epf-esi-consultancy-<city>.html` (and its
  `kn/` counterpart), swap the city name throughout (title, meta description,
  canonical URL, schema.org `LocalBusiness`/breadcrumb, body copy), and add entries
  to the footer Locations list on every page, `sitemap.xml`, and the home page
  `OfferCatalog`/service links.

## Page structure

Every page follows the same skeleton and shares `styles.css` (global stylesheet,
no CSS variables/custom properties, no dark mode) and `script.js` (loaded via
`defer` on every page; progressively enhances the FAQ accordion and the mobile
hamburger menu - see its own comments for exact behavior).

Body flow: `#home` hero → `.services` → `.industries` → `.why-choose-us` →
`.cta` → `.faqs` → footer. Service detail pages (`epf-consultancy-service.html`,
`esi-consultancy-service.html`) use `<body class="service-page">`, left-aligned
via `servicepage.css`. City pages additionally have an `.importance-sec` block.
`contactuspage.css` styles `contact-us.html`.

Head boilerplate on every page: favicons, `canonical` + `hreflang` (en/kn/x-default)
links, one or more `application/ld+json` blocks (`LocalBusiness`, `BreadcrumbList`,
and on service pages an `OfferCatalog`/`FAQPage`), Google Fonts (Inter, Poppins,
Noto Sans Kannada for `kn/` pages, Material Symbols Outlined), gtag
(`G-4MEQF5W0XX`) and Hotjar (`5287852`) snippets.

There are **no contact forms**. Every call-to-action is `tel:+918217542975`,
`https://wa.me/919448622674`, or `mailto:hello.meduconsultancy@gmail.com`.

## Accessibility conventions (must be preserved on every page)

A full a11y pass was done across all pages; keep these intact on any edit or new
page:

- First body child is `<a class="skip-link" href="#main-content">`, and the
  content between the `header-space` div and `<footer>` is wrapped in
  `<main id="main-content" tabindex="-1">`.
- Two nav landmarks: desktop `<nav class="header-nav" aria-label="Primary">` and
  the off-canvas hamburger menu wrapped in
  `<nav class="mobile-nav" aria-label="Menu">` around `<ul id="menu">`.
  `.mobile-nav` must stay in the same sibling slot the bare `<ul>` used to occupy -
  the hamburger-bar CSS uses `:nth-last-child` selectors that break if it moves.
- Link red is `#c1121f` (AA-compliant; do not revert to the old
  `rgb(255,51,51)`). Global `:focus-visible` outline is `3px solid #1a3fb0`.
- Decorative images (check marks, WhatsApp glyph, industry/why-choose thumbnails)
  use `alt=""`; Material Symbols icon spans get `aria-hidden="true"`.
- External links use `target="_blank" rel="noopener noreferrer"` (no duplicate
  `target` attributes).
- `script.js` must be included (with `defer`) on every page - it wires up
  `aria-controls`/`role=region`/`aria-hidden`+`inert` for the FAQ accordion and
  the Open/Close menu label + Escape-to-close behavior for the hamburger menu.

## Visual conventions

Palette: brand blue `#305cde`, green `#028940`, page background
`rgb(248,244,240)`, body text `#333`, headings `rgb(24,24,24)`, card shadow
`rgba(0,0,0,0.05) 0px 4px 20px 7px`.

Infographics are hand-authored inline `<svg>` (not external image files), flat
Material-Symbols style (`viewBox="0 -960 960 960"`, single `<path>`, fill only),
using the site palette, centered via a `.listing-preview`/`.listing-preview-img`
CSS block.

## Writing style / audience

Copy targets small-business owners in tier-2/tier-3 Karnataka towns - not HR
specialists or marketers. Use short sentences and everyday words, avoid jargon,
and lead with the plain benefit rather than the mechanism.
