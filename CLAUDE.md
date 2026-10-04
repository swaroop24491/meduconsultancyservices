# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Website for Medu Consultancy, a PF (EPF) and ESI consultancy in Mangaluru, Karnataka. It serves
businesses in Mangalore and Bangalore. Deployed on GitHub Pages at `www.meduconsultancy.com`
(see `CNAME`). **GitHub Pages builds it with Jekyll** on every push; there is no other build step,
bundler or package manager.

Every page is in English (root URLs) and Kannada (`kn/`, same paths). Pages: home, about, contact,
PF and ESI monthly filing (`epf-consultancy-service`, `esi-consultancy-service`), PF and ESI
registration, 2 city pages (`epf-esi-consultancy-mangalore`, `-bangalore`), an industry hub and 5
industry pages (`industries/`), a tools hub and 7 tools, guides (`blogs/`: index + 11 posts), privacy,
terms, a bilingual 404, and the style guide (`/style-guide`, `/kn/style-guide`, noindex).

**Read `docs/business-brief.md` before any page, content or design work.** It is the source of truth
for the business, audience, services, tone (section 9), locations (section 10) and legal facts
(section 11). If a request conflicts with it, ask before acting. `docs/` and `audit/` are git-ignored.

GitHub Pages publishes everything committed and turns Markdown into pages. Never commit internal
notes or screenshots (keep them in `docs/` or `audit/`). Any other internal file (like this one and
`README.md`) must be listed under `exclude:` in `_config.yml`.

## Preview and checks

No lint/test tooling. Preview with Jekyll in Docker (the versions GitHub Pages uses, from `Gemfile`),
then open http://localhost:4000 (start Docker Desktop first if needed: `open -a Docker`):

```sh
docker run --rm -p 4000:4000 -v "$PWD":/srv -v medu-gems:/usr/local/bundle -w /srv \
  -e PAGES_REPO_NWO=swaroop24491/meduconsultancyservices ruby:3.3.4 \
  sh -c "bundle install --quiet && bundle exec jekyll serve --host 0.0.0.0"
```

Extensionless URLs (`/about-us`) work as on GitHub Pages. Build output is `_site/` (not committed).
The watcher misses files added in a new folder and deleted data: restart the container
(`docker restart <id>`) after those.

- **Sitemap**: `sitemap.xml` is generated from the pages (skips the 404, `noindex` pages and redirect
  stubs; hreflang pairs; `lastmod` from `last_modified`). Never edit URLs into it. After template or page
  changes: `python3 -c "import xml.dom.minidom; xml.dom.minidom.parse('_site/sitemap.xml'); print('OK')"`
- **Check scripts** (local only, in `audit/check/`, git-ignored; setup at the top of `check-page.mjs`):
  - `node audit/check/check-page.mjs audit/screenshots <path> <name>`: 320/390/768/1024/1440px,
    horizontal scroll, axe (WCAG 2.1 A/AA), keyboard (menu, FAQ), and 390/1440 screenshots.
  - `node audit/check/sweep.mjs`: every page at 5 widths, axe, JSON-LD, console.
  - `python3 audit/check/jsonld.py _site/<page>.html ...`: JSON-LD parses.
  - Tool cases: `*-cases.js`, `converter-compare.js`, `use-*.mjs`; `tool-text.mjs en|kn`.
  - `shot-sections.mjs <path> <name> <sg-id,...>` for section close-ups; `shot-contact.mjs` for the map.
- After any page change, take 390px and 1440px screenshots and review them before saying it's done.

## How the site is built

- `_layouts/base.html`: head, header, footer. Every page has front matter.
- Front matter: `layout: base`, `lang` (en/kn), `page_type` (home, service, registration, city,
  industries, industry, tools, tool, blog, post, about, contact, legal, other), `title`, `description`,
  `last_modified: YYYY-MM-DD` (update when content changes), `breadcrumb: [{ name }]`, optional
  `service: { type, name, offers, area }`, `faq: [{ q, a }]` (answers may hold simple links),
  `redirect_from:` (jekyll-redirect-from), `scripts:` and `tool: { name }` (tools),
  `headline` and `date_published` (posts; not `published`, which Jekyll reserves).
- `_data/site.yml`: business details (address, geo, map, founder, languages, cities, proof numbers,
  `gbp_url`, `founder_photo`). `_data/facts.yml`: legal facts (with `_kn` versions for Kannada; its
  header lists where facts are also typed by hand). `_data/icons.yml`: inline SVG icons.
  `_data/i18n/en.yml` + `kn.yml`: all component text, same keys.
- `_includes/`: components, each shown with its exact usage on `/style-guide`
  (`style-guide-body.html`). Links in includes go through `resolve-link.html`/`link.html`: links are built
  from the page language; on Kannada pages a missing Kannada page falls back to English, marked
  "(ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ)". The language switch and hreflang appear only when the other page exists.
- `_includes/head.html`: favicons, canonical, hreflang (en/kn/x-default), og tags (no og:image, owner
  decision; posts are `og:type` article), Google Fonts (Poppins 400/500/600; Noto Sans Kannada on `kn/`
  or `kannada_font: true`), `site.css`, Google Analytics `G-4MEQF5W0XX`. `noindex` pages omit
  canonical/hreflang/og:url.
- `_includes/schema.html`: JSON-LD (WebSite, WebPage or the page type's own type, business entity at
  `https://www.meduconsultancy.com/#business` (full on home and contact), BreadcrumbList, Service,
  WebApplication for tools, BlogPosting for posts, CollectionPage for hubs, founder `Person` defined once
  and referenced by `@id`). FAQPage comes from `faq.html schema=true`. No microdata.
- `site.css`: all styles; tokens in the `:root` block at the top. `style-guide.css`: style guide only.
- `script.js` (every page, `defer`): FAQ accordion, mobile menu (`<button data-menu-toggle>`), and
  sends the `phone_call_click` Google Analytics event on `tel:` links.
- Tool scripts: `eligibility-checker.js`, `contribution-calculator.js`, `penalty-calculator.js`,
  `converter.js` (lazy-loads SheetJS 0.20.3 from `/assets`). Each page passes its config inline; Kannada
  pages pass the Kannada words as `text:`.
- **Liquid in inline JS**: wrap any inline script containing `{{`, `}}`, `{%` or `%}` in
  `{% raw %}...{% endraw %}`. Jekyll 3 include parameters can't take `a[2].b`: `assign` first.

## Design

- Build with the design system only: colours, spacing and type sizes from the `site.css` variables,
  components from the includes shown on the style guide. No one-off styles on a page. Components are
  locked: changing one is a deliberate, style-guide-first change that affects every page using it.
- Tokens: logo green `#006d3c` (links, accents, call button); mustard `#fede00` for small highlights
  only (never text on cream); cream page base, white `section--surface`, `section--tint`, `--color-sand`,
  deep green `section--deep`; red only for real warnings. Contrast ratios are noted in `:root`.
- Light and clean; when in doubt, remove it. No fixed layout rules (owner): pages are composed from the
  components, guided by the design reviewer. Reference for the feel: claude.com/product/claude-code.
- No hero illustrations, mock cards or stock photos of people. Icons are inline SVG (`icon.html`); new
  infographics are inline `<svg>`, flat Material-Symbols style (`viewBox="0 -960 960 960"`, one
  `<path>`, fill only).
- Headings, titles, link names and FAQ questions weight 500; 600 only for buttons, footer titles and
  bold words. Hero H1 uses `--text-hero`. The closing call is a deep green band.
- Header is sticky (not under 421px tall). Up to 768px: logo, language switch, a round phone-icon call
  button, menu; no sticky call bar (owner decision). From 769px the header call button shows the
  full number. Industries is not in the desktop nav (phone menu and footer only).
- Tool pages stay tool-first: no "what Medu does" line at the top. Legal pages (`page_type: legal`) use
  the `.legal` layout, no call button, no closing band. Contact loads the Google map only after
  "Show the map" (`map-tap.html`).

## Accessibility

Meet WCAG 2.1 AA: contrast, keyboard navigation, visible focus, alt text, headings and landmarks.
Keep existing accessibility features working on every edit. Tap targets 44px. Results that update as
you type are not `aria-live`; after a tool button, a valid result gets focus, an invalid form focuses
the first wrong field.

## Content rules

### Never
- Change legal facts (thresholds, wage ceilings, rates, due dates, law references) unless they match
  brief section 11. Flag anything that doesn't match. Run the compliance reviewer on any change to
  facts, numbers or tool logic.
- Change tool calculation logic as part of design or content work. A logic change is a separate,
  reviewed update with before/after test cases. Tool text (questions, help, results) is a reviewed change.
- Add WhatsApp, contact forms, callback forms, pricing, client names/logos, or a share image.
- Show the email address anywhere except the footer.
- Offer notice, arrears or VISHWAS help as a service (no VISHWAS on tool pages).
- Change page copy without showing the old and new text for approval first.
- Name Udupi (no longer served; old Udupi URLs redirect to the Mangalore page).

### Always
- The phone call (`tel:+918217542975`, shown "+91 82175 42975") is the only call-to-action. Results
  link to the phone first. No links to `/contact-us` from tools.
- Simple, basic English: short sentences, everyday words, every compliance term explained the first
  time it appears. Write for both owners and HR/accounts staff.
- Every change in both languages: the Kannada page is a translation of the final English page, nothing
  added or left out.
- Commit one page, or one small group of pages, at a time.

### Settled wording (reuse exactly)
- Filing promise: "We never miss a PF or ESI due date." Next to call buttons, not in the hero. Never
  "no client has paid a late fine or interest" or "late-filing penalty".
- Proof: "25+ years in practice · Founder worked 35 years at EPFO · 100+ clients · 3,500+ employees
  covered"; in heroes number + label ("35 years" / "our founder worked at EPFO").
- Founder (Medu Thirumaleshwara Bhat) has retired: "He worked at EPFO for 35 years", past tense only,
  no job title, "CEO" or "leads". "He taught us the PF rules." Never "how the PF office works" after his
  EPFO years. He worked at EPFO, not ESIC. Founded 2000; don't claim it started in Mangaluru.
- Team: "6 people". "We have team members in Bangalore, backed by our Mangaluru office." Mangalore and
  Bangalore clients: "We can visit you if needed"; clients never need to visit us (never "visit us",
  "directions", "come to our office"). Don't say the Bangalore team will attend an inspection.
- Languages: "You can talk to us in English or Kannada, and we can help you in Hindi too." Never single
  out one language.
- "We tell you if PF and ESI apply" (never "what applies"). "We work by phone and email" (never "We
  handle everything").
- First mentions: "PF (Provident Fund, also called EPF) gives your staff savings and a pension"; "ESI
  (Employees' State Insurance) gives your staff medical care, and pay when they can't work because of
  sickness, injury or maternity" (short: "medical care and sick pay"). No bracketed explanations in hero
  lines; titles use "PF".
- The 15th is the payment deadline: "We get the payment slip (challan) ready in time, so you can pay by
  the 15th. Or send us the amount and we pay it." Never "we file before the 15th". Challan = "the PF/ESI
  payment slip". ECR = "the monthly list of each employee's wages and PF, sent to the PF office".
- Adding staff: "We'll check who must be in PF and ESI", "if the rules cover them" (never "every
  worker"). "Mark the date when staff leave". "Move their PF to a new job, or withdraw their PF money".
  Takeover "once you share the documents we need".
- Joining PF above ₹25,000: "if you and they both agree in writing". 50% rule: "PF/ESI wages must be at
  least half the total pay. If they come to less, the difference is added to PF/ESI wages."
- PF wages = basic pay plus DA (dearness allowance), not the full salary. ESI uses "ESI wages", never
  "gross wages" or "total pay".
- Who counts towards 20/10: all staff incl. casual, contractor-sent and high-salary staff; not
  apprentices, the proprietor or partners; directors: "call us to check how to count them". "Once PF/ESI
  applies, it stays". ESI "does not apply to seasonal factories" where 10-or-more is stated.
- Registration: no public document list ("We tell you which documents we need when you call"); "takes
  just a few hours" only with "once we have all your documents". New UANs come from the employee's face
  scan on the UMANG app ("We guide them"); we create IP numbers on the ESIC portal.
- Penalties: bands written "2 months or more, but less than 4" (never "2 to 4 months"); results say
  "Total (estimate)". The tools' checked date is `tools_checked` in `facts.yml`; update the "2026" in tool
  titles each January.

## Kannada

- Everyday Kannada, short sentences, ನೀವು. All acronyms in English letters (PF, ESI, EPF, EPFO, ESIC,
  UAN, IP, ECR, KYC, DA, HRA…); case endings attach directly (PFಗೆ, ESIಯ, EPFOನಲ್ಲಿ). Western digits,
  Indian grouping. Name: ಮೆದು ಕನ್ಸಲ್ಟೆನ್ಸಿ; cities ಮಂಗಳೂರು, ಬೆಂಗಳೂರು.
- Terms: employer ಉದ್ಯೋಗದಾತರು; pay ಸಂಬಳ (ವೇತನ only in set names: ಮೂಲ ವೇತನ, PF/ESI ವೇತನ, ಕನಿಷ್ಠ ವೇತನ,
  PF/ESI ವೇತನ ಮಿತಿ); contribution ವಂತಿಗೆ; due date ಕೊನೆಯ ದಿನಾಂಕ; challan ಚಲನ್ (PF ಪಾವತಿ ಚೀಟಿ);
  damages ಡ್ಯಾಮೇಜಸ್, first use "ಡ್ಯಾಮೇಜಸ್ (ದಂಡದಂತಹ ಹೆಚ್ಚುವರಿ ಮೊತ್ತ)"; penalty ದಂಡ; interest ಬಡ್ಡಿ;
  staff benefits ಸೌಲಭ್ಯಗಳು (ಲಾಭ only for a business gain); ESI cash benefit ಹಣದ ಸಹಾಯ (never ಸಂಬಳ);
  casual ತಾತ್ಕಾಲಿಕ ಮತ್ತು ದಿನಗೂಲಿ; principal employer ಮುಖ್ಯ ಉದ್ಯೋಗದಾತರು; seasonal factory ಋತುಮಾನದ ಕಾರ್ಖಾನೆ
  (no bracket); confirmation ರಸೀದಿ; inspection ತಪಾಸಣೆ; "Anytime" ಬೇಕಾದಾಗ. Never ಅನುಸರಣೆ: say what is
  done (fallback ನಿಯಮ ಪಾಲನೆ). Tool names all Kannada (ಉಚಿತ ಸಾಧನಗಳು, ಲೆಕ್ಕಾಚಾರ, ಪರಿಶೀಲನೆ). Tool messages
  say ಬರೆಯಿರಿ (never ನಮೂದಿಸಿ).
- Phrases: "if the rules cover them" ನಿಯಮಗಳು ಅವರಿಗೆ ಅನ್ವಯಿಸಿದರೆ; 50% rule "ಕಡಿಮೆ ಇರುವಷ್ಟು ಮೊತ್ತವನ್ನು
  PF/ESI ವೇತನಕ್ಕೆ ಸೇರಿಸಬೇಕು"; "15th" `{{ x.due_day }}ನೇ`; "Rules checked on" "{{ tools_checked_kn }}ರಂದು
  ನಿಯಮಗಳನ್ನು ಪರಿಶೀಲಿಸಲಾಗಿದೆ". No comma before ಮತ್ತು; a list that already contains "ತಾತ್ಕಾಲಿಕ ಮತ್ತು
  ದಿನಗೂಲಿ" joins its outer items with ಹಾಗೂ.
- Build: every page-text link through `link.html` (`arrow=false` inside a sentence); links between
  Kannada pages go to `/kn/...`; facts from the `_kn` keys. Call-button digits use `--font-body`.

## Reviews

Two read-only reviewer agents in `.claude/agents/` (compliance, design) report findings; fixes happen
in the main session after the owner approves. Run the compliance reviewer on any change to legal facts,
numbers or tool logic; run the design reviewer for a new page or a big design change; not for small
edits. The owner approves with short messages ("proceed as recommended").

## Git

`main` is the live branch: GitHub Pages rebuilds the site on every push to it (GitHub → Actions →
"pages build and deployment", about 1-3 minutes). Work on a branch from `main` and push only when
the owner asks. Site-wide changes (nav, footer, shared text) are made once in the include or
`_data/i18n/`.
