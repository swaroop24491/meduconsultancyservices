# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Hand-authored static HTML site for Medu Consultancy, a PF (EPF) & ESI compliance
consultancy based in Mangaluru, Karnataka. Deployed on GitHub Pages at the custom
domain `www.meduconsultancy.com` (see `CNAME`). **No build step, no bundler, no
package manager, no templating engine, no shared partials/includes.** Every page is
a complete, standalone `.html` file with the header/nav and footer copy-pasted
verbatim into it.

Pages: core pages (home, about, contact, EPF and ESI service pages), free tools and
calculators (tools hub plus EPF/ESI penalty calculators, eligibility checkers,
contribution calculators and the EPF Excel to Text converter), city landing pages
(`epf-esi-consultancy-<city>.html`), and `blogs/` (index plus posts). A parallel
Kannada tree under `kn/` mirrors the English pages. English and Kannada counterparts
are linked via `hreflang` alternate tags and a header `lang-switch` link.

GitHub Pages publishes everything committed to this repo. Never commit internal
documents, notes or screenshots. They live in `docs/` and `audit/`, which are
git-ignored.

## Working in this repo

There is no build/lint/test tooling - just edit the HTML/CSS/JS files directly and
open them in a browser (or a static file server) to check changes.

- **Sitemap edits**: after changing `sitemap.xml`, validate it's well-formed XML:
  `python3 -c "import xml.dom.minidom; xml.dom.minidom.parse('sitemap.xml'); print('OK')"`
- **Site-wide nav/footer changes**: since the header and footer are duplicated
  in every file, a nav/footer/service-list/locations-list change must be applied
  identically across all pages, English and Kannada. Prefer a scripted
  find-and-replace (e.g. `perl -0pi -e 's/.../.../s'` slurp mode) over hand-editing
  each file, and verify the replacement count matches the expected file count
  afterward.
- **Tools**: calculation logic in the tool pages must not change as part of design
  or content work. Any logic change is a separate, reviewed update with
  before/after test cases.

## Page structure

Every page shares `styles.css` (global stylesheet) and `script.js` (loaded via
`defer` on every page; it powers the FAQ accordion and the mobile hamburger menu,
including their accessibility behaviour). `script.js` must be included on every
page. Service detail pages use `<body class="service-page">` with
`servicepage.css`; `contactuspage.css` styles `contact-us.html`.

The mobile menu's `<nav class="mobile-nav">` must stay in its current position in
the header: the hamburger CSS uses `:nth-last-child` selectors that break if it
moves.

Head boilerplate on every page: favicons, `canonical` + `hreflang` (en/kn/x-default)
links, `application/ld+json` structured data (`LocalBusiness`, `BreadcrumbList`,
and on service pages `OfferCatalog`/`FAQPage`), Google Fonts (Inter, Poppins,
Noto Sans Kannada for `kn/` pages, Material Symbols Outlined), and Google Analytics
(`G-4MEQF5W0XX`).

There are **no contact forms** and no WhatsApp. Every call-to-action is
`tel:+918217542975`.

## Accessibility

The website must be accessible to everyone: meet WCAG 2.1 AA (colour contrast,
keyboard navigation, visible focus, alt text, proper headings and landmarks).
Keep existing accessibility features working on every edit and new page.

## Visual conventions

Current palette: page background `rgb(248,244,240)` (cream), green `#028940`,
blue `#305cde` for primary CTA buttons, red `#c1121f` for warnings and the
header phone number, body text `#333`, headings `rgb(24,24,24)`. The logo uses
green and mustard. The palette will be reviewed as part of the redesign
(see below); don't change colours outside that work.

Infographics are hand-authored inline `<svg>` (not external image files), flat
Material-Symbols style (`viewBox="0 -960 960 960"`, single `<path>`, fill only),
using the site palette.

## Website redesign

A redesign of the whole site is in progress.

**Read `docs/business-brief.md` before any page, content or design work.** It is
the source of truth for the business, audience, services, tone, locations and
legal facts. If a request conflicts with it, ask before acting.

### Never
- Change legal facts (thresholds, wage ceilings, rates, due dates, law references)
  unless they match section 11 of the brief. Flag anything that doesn't match.
- Change tool calculation logic as part of design or content work.
- Add WhatsApp, contact forms, callback forms, pricing, or client names/logos.
- Show the email address anywhere except the footer.
- Offer notice, arrears or VISHWAS help as a service.
- Use stock photos of people.
- Change page copy without showing the old and new text for approval first.

### Always
- The phone call (+91 82175 42975) is the only call-to-action.
- Write in simple, basic English: short sentences, everyday words, and every
  compliance term explained the first time it appears.
- Every page exists in English and Kannada (`kn/`). Change both together. Mark new
  or changed Kannada text for review by a fluent speaker.
- Design clean, clutter-free and light. When in doubt, remove it.
- Build with the shared design system: colours, spacing and type sizes come from
  CSS variables in `styles.css`, and components use the exact markup shown on the
  style guide page. No one-off styles on individual pages.
- After any page change, take screenshots at 390px and 1440px width with Playwright
  and review them before saying the work is done.
- Commit one page, or one small group of pages, at a time.

### Planned site changes (from the brief)
- City pages reduce to 3: Mangalore, Udupi and Bangalore. The other 19 city pages
  (English and Kannada) are removed, along with their links in the footer,
  sitemap and anywhere else on the site.
- New pages: an "Industries we serve" hub and one page each for hospitals,
  contractors, factories, schools and IT companies, in English and Kannada.

## Writing style / audience

Copy targets small-business owners and HR/accounts staff in Mangalore, Udupi and
Bangalore, many with only basic English. Use short sentences and everyday words,
avoid jargon, and lead with the plain benefit rather than the mechanism. Full
rules are in section 9 of `docs/business-brief.md`.