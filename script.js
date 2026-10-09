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
     Date/month inputs
     - native browsers only open the calendar popup when the tiny icon is
       clicked; clicking the rest of the field just places a text caret.
       Make the whole field open the picker, since that's what people expect.
     ------------------------------------------------------------------------- */
  document.querySelectorAll('input[type="month"]').forEach(function (input) {
    if (!input.showPicker) {
      return;
    }
    input.addEventListener('click', function () {
      try {
        input.showPicker();
      } catch (err) {
        /* showPicker() throws if the input is disabled/readonly - ignore. */
      }
    });
  });

  /* -------------------------------------------------------------------------
     Date inputs in Indian format (dd/mm/yyyy)
     - a native <input type="date"> shows the browser's own format (mm/dd/yyyy
       in a US browser), and the page can't change that. So each one becomes
       a dd/mm/yyyy text field with a calendar button (.date-input).
     - the native input stays in the page, hidden, and keeps its id and its
       "YYYY-MM-DD" value, so the tool scripts read it as before. The text
       field writes to it; the calendar (showPicker, opened by clicking the
       field or its button) and scripts that set .value write back to the
       text field. aria-invalid set on the native input shows on the text
       field, and focusing it focuses the text field.
     ------------------------------------------------------------------------- */
  var isKn = document.documentElement.lang === 'kn';
  var DATE_TEXT = {
    format: isKn ? 'ದಿನ/ತಿಂಗಳು/ವರ್ಷ (dd/mm/yyyy) ರೀತಿಯಲ್ಲಿ ಬರೆಯಿರಿ.' : 'Write it as dd/mm/yyyy.',
    pick: isKn ? 'ಕ್ಯಾಲೆಂಡರ್‌ನಲ್ಲಿ ದಿನಾಂಕ ಆಯ್ಕೆ ಮಾಡಿ' : 'Choose a date on the calendar'
  };
  var nativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

  function isoToText(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
  }

  // "dd/mm/yyyy" (also d/m/yyyy, or with - or .) to "YYYY-MM-DD"; '' if not a real date.
  function textToIso(text) {
    var m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(text.trim());
    if (!m) return '';
    var d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
    var date = new Date(y, mo - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return '';
    return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  // Typing only digits: put the slashes in (25102026 → 25/10/2026).
  function addSlashes(text) {
    if (/^\d+$/.test(text)) {
      if (text.length > 4) return text.slice(0, 2) + '/' + text.slice(2, 4) + '/' + text.slice(4, 8);
      if (text.length > 2) return text.slice(0, 2) + '/' + text.slice(2);
      return text;
    }
    var m = /^(\d{2})\/(\d{2})(\d+)$/.exec(text); // 25/1026 → 25/10/26
    return m ? m[1] + '/' + m[2] + '/' + m[3].slice(0, 4) : text;
  }

  document.querySelectorAll('input[type="date"]').forEach(function (native) {
    var id = native.id;
    var wrap = document.createElement('span');
    wrap.className = 'date-input';
    native.parentNode.insertBefore(wrap, native);

    var text = document.createElement('input');
    text.type = 'text';
    text.id = id + '-text';
    text.inputMode = 'numeric';
    text.autocomplete = 'off';
    text.placeholder = 'dd/mm/yyyy';
    text.maxLength = 10;
    var hint = document.createElement('span');
    hint.className = 'visually-hidden';
    hint.id = id + '-format';
    hint.textContent = DATE_TEXT.format;
    text.setAttribute('aria-describedby', (hint.id + ' ' + (native.getAttribute('aria-describedby') || '')).trim());
    if (native.required) text.required = true;
    text.value = isoToText(native.value);

    var label = document.querySelector('label[for="' + id + '"]');
    if (label) label.htmlFor = text.id;

    wrap.appendChild(text);
    wrap.appendChild(hint);
    wrap.appendChild(native);
    native.classList.add('date-input__native');
    native.tabIndex = -1;
    native.setAttribute('aria-hidden', 'true');

    if (native.showPicker) {
      // Clicking the field opens the calendar too (typing still works); the
      // keyboard opens nothing, so tabbing through the form stays quiet.
      text.addEventListener('click', function () {
        try { native.showPicker(); } catch (err) { /* not allowed here: typing still works */ }
      });
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'date-input__pick';
      btn.setAttribute('aria-label', DATE_TEXT.pick);
      btn.innerHTML = '<svg class="icon" width="20" height="20" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true" focusable="false"><path d="M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Zm0 0v-80 80Z"/></svg>';
      btn.addEventListener('click', function () {
        try { native.showPicker(); } catch (err) { /* not allowed here: typing still works */ }
      });
      wrap.appendChild(btn);
    }

    // Scripts that set native.value (e.g. clearing a form) update the text field too.
    Object.defineProperty(native, 'value', {
      configurable: true,
      get: function () { return nativeValue.get.call(native); },
      set: function (v) {
        nativeValue.set.call(native, v);
        text.value = isoToText(nativeValue.get.call(native));
      }
    });

    // Typing: the text event bubbles on to the form after the native value is set.
    text.addEventListener('input', function () {
      var formatted = addSlashes(text.value);
      if (formatted !== text.value) text.value = formatted;
      nativeValue.set.call(native, textToIso(text.value));
    });
    text.addEventListener('blur', function () {
      var iso = textToIso(text.value);
      if (iso) text.value = isoToText(iso); // 5/9/2026 → 05/09/2026
    });

    // The calendar: copy the picked date into the text field.
    native.addEventListener('change', function () {
      text.value = isoToText(nativeValue.get.call(native));
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
