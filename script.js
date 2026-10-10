/* Progressive accessibility enhancements. Runs after the DOM is parsed
   (loaded with `defer`). Everything here is guarded so pages without an
   accordion or without the mobile menu are unaffected. */
(function () {
  'use strict';

  /* -------------------------------------------------------------------------
     FAQ accordion
     - wires each button to its panel (aria-controls / role=region)
     - keeps a single panel open at a time
     - hides collapsed panels from assistive tech and the tab order
     ------------------------------------------------------------------------- */
  function setPanelState(button, panel, open) {
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (!panel) {
      return;
    }
    if (open) {
      panel.removeAttribute('aria-hidden');
      panel.removeAttribute('inert');
    } else {
      panel.setAttribute('aria-hidden', 'true');
      panel.setAttribute('inert', '');
    }
  }

  /* The panel follows the button, or follows the heading that wraps the
     button (<h3 class="accordion-heading"><button>). */
  function getPanel(button) {
    var parent = button.parentElement;
    var panel = parent && parent.classList.contains('accordion-heading')
      ? parent.nextElementSibling
      : button.nextElementSibling;
    return panel && panel.classList.contains('accordion-content') ? panel : null;
  }

  document.querySelectorAll('.accordion').forEach(function (accordion) {
    var buttons = Array.prototype.slice.call(
      accordion.querySelectorAll('.accordion-item > button, .accordion-item > .accordion-heading > button')
    );

    buttons.forEach(function (button, index) {
      var panel = getPanel(button);

      button.setAttribute('type', 'button');

      if (panel) {
        if (!panel.id) {
          panel.id = (button.id || accordion.id || 'accordion') + '-panel-' + index;
        }
        button.setAttribute('aria-controls', panel.id);
        panel.setAttribute('role', 'region');
        if (button.id) {
          panel.setAttribute('aria-labelledby', button.id);
        }
      }

      setPanelState(button, panel, button.getAttribute('aria-expanded') === 'true');

      button.addEventListener('click', function () {
        var willOpen = button.getAttribute('aria-expanded') !== 'true';

        buttons.forEach(function (other) {
          setPanelState(other, getPanel(other), false);
        });

        if (willOpen) {
          setPanelState(button, panel, true);
        }
      });
    });
  });

  /* -------------------------------------------------------------------------
     Mobile (hamburger) menu
     - keeps the toggle's accessible name in sync with its state
     - dims/blocks the rest of the page with a backdrop while open, and
       makes it inert so Tab can't reach content hidden behind it
     - traps focus inside the drawer, closes on Escape/backdrop click/link
       choice, and returns focus to the toggle on close
     - locks background scrolling while open
     ------------------------------------------------------------------------- */
  /* Old pages use a checkbox (#menuCheckbox); rebuilt pages use a real
     <button data-menu-toggle>. Both share the behaviour below. */
  var toggle = document.getElementById('menuCheckbox');
  var toggleButton = toggle ? null : document.querySelector('[data-menu-toggle]');
  var control = toggle || toggleButton;
  var menu = document.getElementById('menu');
  var mobileNav = document.querySelector('.mobile-nav');
  var mainContent = document.getElementById('main-content');
  var footer = document.querySelector('footer');

  var isMenuOpen = function () {
    return toggle ? toggle.checked : toggleButton.getAttribute('aria-expanded') === 'true';
  };

  var setMenuOpen = function (open) {
    if (toggle) {
      toggle.checked = open;
    } else {
      toggleButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
  };

  if (control && menu) {
    control.setAttribute('aria-controls', 'menu');
    control.setAttribute('aria-expanded', 'false');

    if (mobileNav) {
      mobileNav.setAttribute('role', 'dialog');
    }

    var backdrop = document.createElement('div');
    backdrop.className = 'menu-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(backdrop, document.body.firstChild);

    var getFocusable = function () {
      var items = Array.prototype.slice
        .call(menu.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'))
        .filter(function (el) {
          return el.offsetParent !== null;
        });
      /* The close button stays reachable inside the focus trap */
      return toggleButton ? [toggleButton].concat(items) : items;
    };

    var syncMenu = function () {
      var open = isMenuOpen();
      control.setAttribute('aria-expanded', open ? 'true' : 'false');
      control.setAttribute('aria-label', open
        ? (control.getAttribute('data-label-close') || 'Close menu')
        : (control.getAttribute('data-label-open') || 'Open menu'));
      document.body.style.overflow = open ? 'hidden' : '';
      document.body.classList.toggle('menu-open', open);
      backdrop.classList.toggle('is-visible', open);

      if (mobileNav) {
        if (open) {
          mobileNav.setAttribute('aria-modal', 'true');
        } else {
          mobileNav.removeAttribute('aria-modal');
        }
      }

      [mainContent, footer].forEach(function (el) {
        if (!el) {
          return;
        }
        if (open) {
          el.setAttribute('inert', '');
        } else {
          el.removeAttribute('inert');
        }
      });
    };

    var closeMenu = function (returnFocus) {
      if (!isMenuOpen()) {
        return;
      }
      setMenuOpen(false);
      syncMenu();
      if (returnFocus) {
        control.focus();
      }
    };

    var onMenuToggled = function () {
      syncMenu();
      if (isMenuOpen()) {
        /* Deferred two frames: the browser both (a) keeps focus on the
           checkbox as the last step of handling the click that triggered
           this 'change', and (b) hasn't necessarily laid out the
           just-revealed drawer yet, so an immediate focus() call here can
           silently no-op. Waiting for the next paint makes the target
           genuinely focusable before we move focus into it. */
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(function () {
            if (!isMenuOpen()) {
              return;
            }
            var focusables = getFocusable();
            /* Skip the close button: focus the first item in the menu */
            var first = toggleButton ? focusables[1] : focusables[0];
            if (first) {
              first.focus();
            }
          });
        });
      }
    };

    if (toggle) {
      toggle.addEventListener('change', onMenuToggled);
    } else {
      toggleButton.addEventListener('click', function () {
        setMenuOpen(!isMenuOpen());
        onMenuToggled();
      });
    }

    backdrop.addEventListener('click', function () {
      closeMenu(true);
    });

    document.addEventListener('keydown', function (event) {
      if (!isMenuOpen()) {
        return;
      }

      if (event.key === 'Escape') {
        closeMenu(true);
        return;
      }

      if (event.key === 'Tab') {
        var focusables = getFocusable();
        if (!focusables.length) {
          return;
        }
        var first = focusables[0];
        var last = focusables[focusables.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    menu.addEventListener('click', function (event) {
      if (isMenuOpen() && event.target.closest('a')) {
        closeMenu(false);
      }
    });

    syncMenu();
  }

  /* -------------------------------------------------------------------------
     Shrinking header
     - adds .is-scrolled once the page scrolls past a small threshold, so
       the fixed header takes up less vertical space while reading
     - rAF-throttled so the scroll listener never runs the check more than
       once per frame
     ------------------------------------------------------------------------- */
  var header = document.querySelector('header');

  if (header) {
    var SCROLL_THRESHOLD = 24;
    var scrollTicking = false;

    var syncHeaderScrolled = function () {
      header.classList.toggle('is-scrolled', window.scrollY > SCROLL_THRESHOLD);
      scrollTicking = false;
    };

    window.addEventListener('scroll', function () {
      if (!scrollTicking) {
        window.requestAnimationFrame(syncHeaderScrolled);
        scrollTicking = true;
      }
    }, { passive: true });

    syncHeaderScrolled();
  }

  /* -------------------------------------------------------------------------
     Call tracking (decision D5)
     - every tel: link click sends a Google Analytics event, with where the
       button sits (data-call-location) and the page type (body data-page-type)
     ------------------------------------------------------------------------- */
  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('a[href^="tel:"]');
    if (!link || typeof window.gtag !== 'function') {
      return;
    }
    window.gtag('event', 'phone_call_click', {
      call_location: link.getAttribute('data-call-location') || 'other',
      page_type: document.body.getAttribute('data-page-type') || 'other'
    });
  });

  /* -------------------------------------------------------------------------
     Date and month fields in Indian format (dd/mm/yyyy, mm/yyyy)
     - a native <input type="date"> or "month" shows the browser's own format
       (mm/dd/yyyy in a US browser) and its own calendar, which the page can't
       style or put in Kannada (and Safari and Firefox on computers have no
       month calendar). So each one becomes a text field with a calendar
       button (.date-input).
     - the native input stays in the page, hidden, and keeps its id and its
       "YYYY-MM-DD" / "YYYY-MM" value, so the tool scripts read it as before.
       Typing or picking sets it and fires input and change on it; scripts
       that set .value update the text field. aria-invalid set on the native
       input shows on the text field, and focusing it focuses the text field.
     - the calendar (.date-pop) opens under the field from the button (focus
       moves into it) or a click on the field (focus stays, typing still
       works). Dates use Cally (/assets/cally-0.9.2.js, MIT; month and day
       names from the browser in English or Kannada); months use our own
       12-month grid. Esc, a click outside or tabbing away closes it.
     ------------------------------------------------------------------------- */
  var isKn = document.documentElement.lang === 'kn';
  var LOCALE = isKn ? 'kn-IN' : 'en-IN';
  var DATE_TEXT = {
    dateFormat: isKn ? 'ದಿನ/ತಿಂಗಳು/ವರ್ಷ (dd/mm/yyyy) ರೀತಿಯಲ್ಲಿ ಬರೆಯಿರಿ.' : 'Write it as dd/mm/yyyy.',
    monthFormat: isKn ? 'ತಿಂಗಳು/ವರ್ಷ (mm/yyyy) ರೀತಿಯಲ್ಲಿ ಬರೆಯಿರಿ.' : 'Write it as mm/yyyy.',
    pickDate: isKn ? 'ಕ್ಯಾಲೆಂಡರ್‌ನಲ್ಲಿ ದಿನಾಂಕ ಆಯ್ಕೆ ಮಾಡಿ' : 'Choose a date on the calendar',
    pickMonth: isKn ? 'ಕ್ಯಾಲೆಂಡರ್‌ನಲ್ಲಿ ತಿಂಗಳು ಆಯ್ಕೆ ಮಾಡಿ' : 'Choose a month on the calendar',
    prevMonth: isKn ? 'ಹಿಂದಿನ ತಿಂಗಳು' : 'Previous month',
    nextMonth: isKn ? 'ಮುಂದಿನ ತಿಂಗಳು' : 'Next month',
    prevYear: isKn ? 'ಹಿಂದಿನ ವರ್ಷ' : 'Previous year',
    nextYear: isKn ? 'ಮುಂದಿನ ವರ್ಷ' : 'Next year',
    month: isKn ? 'ತಿಂಗಳು' : 'Month',
    year: isKn ? 'ವರ್ಷ' : 'Year'
  };
  var ICON = {
    calendar: 'M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Zm0 0v-80 80Z',
    prev: 'M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z',
    next: 'M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z'
  };
  function svg(name, attrs) {
    return '<svg class="icon" width="20" height="20" viewBox="0 -960 960 960" fill="currentColor" focusable="false" ' +
      (attrs || 'aria-hidden="true"') + '><path d="' + ICON[name] + '"/></svg>';
  }
  var nativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  var pad2 = function (n) { return String(n).padStart(2, '0'); };

  // Each kind: native value <-> text, digits-only typing gets its slashes, and the calendar.
  var KINDS = {
    date: {
      placeholder: 'dd/mm/yyyy',
      format: DATE_TEXT.dateFormat,
      pick: DATE_TEXT.pickDate,
      toText: function (iso) {
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
        return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
      },
      // "dd/mm/yyyy" (also d/m/yyyy, or with - or .) to "YYYY-MM-DD"; '' if not a real date.
      toIso: function (text) {
        var m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(text.trim());
        if (!m) return '';
        var d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
        var date = new Date(y, mo - 1, d);
        if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return '';
        return y + '-' + pad2(mo) + '-' + pad2(d);
      },
      // 25102026 → 25/10/2026; 25/1026 → 25/10/26
      addSlashes: function (text) {
        if (/^\d+$/.test(text)) {
          if (text.length > 4) return text.slice(0, 2) + '/' + text.slice(2, 4) + '/' + text.slice(4, 8);
          if (text.length > 2) return text.slice(0, 2) + '/' + text.slice(2);
          return text;
        }
        var m = /^(\d{2})\/(\d{2})(\d+)$/.exec(text);
        return m ? m[1] + '/' + m[2] + '/' + m[3].slice(0, 4) : text;
      },
      picker: datePicker
    },
    month: {
      placeholder: 'mm/yyyy',
      format: DATE_TEXT.monthFormat,
      pick: DATE_TEXT.pickMonth,
      toText: function (iso) {
        var m = /^(\d{4})-(\d{2})$/.exec(iso || '');
        return m ? m[2] + '/' + m[1] : '';
      },
      // "mm/yyyy" (also m/yyyy, or with - or .) to "YYYY-MM"; '' if not a real month.
      toIso: function (text) {
        var m = /^(\d{1,2})[\/.-](\d{4})$/.exec(text.trim());
        if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) return '';
        return m[2] + '-' + pad2(m[1]);
      },
      // 102026 → 10/2026
      addSlashes: function (text) {
        return /^\d{3,}$/.test(text) ? text.slice(0, 2) + '/' + text.slice(2, 6) : text;
      },
      picker: monthPicker
    }
  };

  // Cally loads once, the first time a page has a date field.
  var cally = null;
  function loadCally() {
    if (!cally) cally = import('/assets/cally-0.9.2.js');
    return cally;
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  // Each picker fills `pop` and returns { show(iso), focus() }; it calls pick(iso) on a choice.
  function datePicker(pop, pick) {
    loadCally();
    var cal = document.createElement('calendar-date');
    cal.setAttribute('locale', LOCALE);
    cal.setAttribute('first-day-of-week', '0');
    cal.innerHTML =
      svg('prev', 'slot="previous" role="img" aria-label="' + DATE_TEXT.prevMonth + '"') +
      svg('next', 'slot="next" role="img" aria-label="' + DATE_TEXT.nextMonth + '"') +
      '<span slot="heading" class="date-pop__selects">' +
        '<calendar-select-month format-month="short"><span slot="label">' + DATE_TEXT.month + '</span></calendar-select-month>' +
        '<calendar-select-year max-years="40"><span slot="label">' + DATE_TEXT.year + '</span></calendar-select-year>' +
      '</span>' +
      '<calendar-month></calendar-month>';
    pop.appendChild(cal);
    cal.addEventListener('change', function () { pick(cal.value); });
    return {
      show: function (iso) {
        loadCally().then(function () {
          cal.value = iso || '';
          cal.focusedDate = iso || today();
        });
      },
      focus: function () {
        loadCally().then(function () {
          requestAnimationFrame(function () { cal.focus(); });
        });
      }
    };
  }

  function monthPicker(pop, pick) {
    var year = 0, selected = '', focusMonth = 0;
    var longName = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric', timeZone: 'UTC' });
    var monthName = new Intl.DateTimeFormat(LOCALE, { month: 'long', timeZone: 'UTC' });
    var headId = pop.id + '-year';
    pop.innerHTML =
      '<div class="date-pop__head">' +
        '<button type="button" class="date-pop__nav" data-step="-1" aria-label="' + DATE_TEXT.prevYear + '">' + svg('prev') + '</button>' +
        '<p class="date-pop__heading" id="' + headId + '" aria-live="polite"></p>' +
        '<button type="button" class="date-pop__nav" data-step="1" aria-label="' + DATE_TEXT.nextYear + '">' + svg('next') + '</button>' +
      '</div>' +
      '<div class="month-grid" role="group" aria-labelledby="' + headId + '"></div>';
    var heading = pop.querySelector('.date-pop__heading');
    var grid = pop.querySelector('.month-grid');
    var buttons = [];
    for (var i = 0; i < 12; i++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'month-grid__month';
      b.dataset.month = i + 1;
      b.textContent = monthName.format(Date.UTC(2000, i, 1));
      grid.appendChild(b);
      buttons.push(b);
    }

    function render() {
      heading.textContent = year;
      var now = today().slice(0, 7);
      buttons.forEach(function (btn, i) {
        var iso = year + '-' + pad2(i + 1);
        btn.setAttribute('aria-label', longName.format(Date.UTC(year, i, 1)));
        btn.setAttribute('aria-pressed', iso === selected ? 'true' : 'false');
        if (iso === now) btn.setAttribute('aria-current', 'date');
        else btn.removeAttribute('aria-current');
        btn.tabIndex = i === focusMonth ? 0 : -1;
      });
    }
    function moveTo(month, keepFocus) {
      // Arrow past January or December moves to the year before or after.
      year += Math.floor(month / 12);
      focusMonth = ((month % 12) + 12) % 12;
      render();
      if (keepFocus) buttons[focusMonth].focus();
    }

    pop.querySelectorAll('.date-pop__nav').forEach(function (nav) {
      nav.addEventListener('click', function () {
        year += Number(nav.dataset.step);
        render();
      });
    });
    grid.addEventListener('click', function (e) {
      var btn = e.target.closest('.month-grid__month');
      if (btn) pick(year + '-' + pad2(btn.dataset.month));
    });
    grid.addEventListener('keydown', function (e) {
      var step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[e.key];
      if (e.key === 'Home') step = -focusMonth;
      if (e.key === 'End') step = 11 - focusMonth;
      if (e.key === 'PageUp') step = -12;
      if (e.key === 'PageDown') step = 12;
      if (step === undefined) return;
      e.preventDefault();
      moveTo(focusMonth + step, true);
    });

    return {
      show: function (iso) {
        selected = iso || '';
        var start = selected || today().slice(0, 7);
        year = Number(start.slice(0, 4));
        focusMonth = Number(start.slice(5, 7)) - 1;
        render();
      },
      focus: function () { buttons[focusMonth].focus(); }
    };
  }

  document.querySelectorAll('input[type="date"], input[type="month"]').forEach(function (native) {
    var kind = KINDS[native.type] || KINDS[native.getAttribute('type')];
    var id = native.id;
    var wrap = document.createElement('span');
    wrap.className = 'date-input';
    native.parentNode.insertBefore(wrap, native);

    var text = document.createElement('input');
    text.type = 'text';
    text.id = id + '-text';
    text.inputMode = 'numeric';
    text.autocomplete = 'off';
    text.placeholder = kind.placeholder;
    text.maxLength = kind.placeholder.length;
    var hint = document.createElement('span');
    hint.className = 'visually-hidden';
    hint.id = id + '-format';
    hint.textContent = kind.format;
    text.setAttribute('aria-describedby', (hint.id + ' ' + (native.getAttribute('aria-describedby') || '')).trim());
    if (native.required) text.required = true;
    text.value = kind.toText(native.value);

    var label = document.querySelector('label[for="' + id + '"]');
    if (label) label.htmlFor = text.id;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'date-input__pick';
    btn.setAttribute('aria-label', kind.pick);
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = svg('calendar');

    var pop = document.createElement('div');
    pop.className = 'date-pop';
    pop.id = id + '-calendar';
    pop.hidden = true;
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', kind.pick);
    btn.setAttribute('aria-controls', pop.id);

    wrap.appendChild(text);
    wrap.appendChild(hint);
    wrap.appendChild(native);
    wrap.appendChild(btn);
    wrap.appendChild(pop);
    native.classList.add('date-input__native');
    native.tabIndex = -1;
    native.setAttribute('aria-hidden', 'true');

    // Set the value from typing or the calendar, and tell the tool script.
    function setValue(iso) {
      if (iso === nativeValue.get.call(native)) return;
      nativeValue.set.call(native, iso);
      native.dispatchEvent(new Event('input', { bubbles: true }));
      native.dispatchEvent(new Event('change', { bubbles: true }));
    }

    var picker = kind.picker(pop, function (iso) {
      setValue(iso);
      text.value = kind.toText(iso);
      close();
      text.focus();
    });

    function open(moveFocus) {
      if (pop.hidden) {
        picker.show(nativeValue.get.call(native));
        pop.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
      }
      if (moveFocus) picker.focus();
    }
    function close() {
      pop.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }

    btn.addEventListener('click', function () {
      if (pop.hidden) open(true);
      else close();
    });
    // Clicking the field opens the calendar too (typing still works); the
    // keyboard opens nothing, so tabbing through the form stays quiet.
    text.addEventListener('click', function () { open(false); });
    wrap.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !pop.hidden) {
        e.preventDefault();
        var fromPop = pop.contains(document.activeElement);
        close();
        (fromPop ? btn : text).focus();
      }
    });
    wrap.addEventListener('focusout', function (e) {
      if (e.relatedTarget && !wrap.contains(e.relatedTarget)) close();
    });
    document.addEventListener('pointerdown', function (e) {
      if (!pop.hidden && !wrap.contains(e.target)) close();
    });

    // Scripts that set native.value (e.g. clearing a form) update the text field too.
    Object.defineProperty(native, 'value', {
      configurable: true,
      get: function () { return nativeValue.get.call(native); },
      set: function (v) {
        nativeValue.set.call(native, v);
        text.value = kind.toText(nativeValue.get.call(native));
      }
    });

    // Typing: the tool script hears it from the native input, not the text field.
    text.addEventListener('input', function (e) {
      e.stopPropagation();
      var formatted = kind.addSlashes(text.value);
      if (formatted !== text.value) text.value = formatted;
      var iso = kind.toIso(text.value);
      setValue(iso);
      if (iso && !pop.hidden) picker.show(iso);
    });
    text.addEventListener('change', function (e) { e.stopPropagation(); });
    text.addEventListener('blur', function () {
      var iso = kind.toIso(text.value);
      if (iso) text.value = kind.toText(iso); // 5/9/2026 → 05/09/2026
    });
    native.addEventListener('focus', function () { text.focus(); });

    new MutationObserver(function () {
      var bad = native.getAttribute('aria-invalid');
      if (bad) text.setAttribute('aria-invalid', bad);
      else text.removeAttribute('aria-invalid');
    }).observe(native, { attributes: true, attributeFilter: ['aria-invalid'] });
  });

  /* -------------------------------------------------------------------------
     Map on tap (contact page): load the Google map only after the tap, then
     move focus to it.
     ------------------------------------------------------------------------- */
  document.querySelectorAll('.map-tap[data-map-src]').forEach(function (box) {
    var button = box.querySelector('button');
    if (!button) {
      return;
    }
    box.hidden = false;
    button.addEventListener('click', function () {
      var frame = document.createElement('iframe');
      frame.src = box.getAttribute('data-map-src');
      frame.title = box.getAttribute('data-map-title');
      frame.setAttribute('loading', 'lazy');
      box.replaceChildren(frame);
      frame.focus();
    });
  });
})();
