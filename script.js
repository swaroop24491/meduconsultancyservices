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

  document.querySelectorAll('.accordion').forEach(function (accordion) {
    var buttons = Array.prototype.slice.call(
      accordion.querySelectorAll('.accordion-item > button')
    );

    buttons.forEach(function (button, index) {
      var panel = button.nextElementSibling;
      if (!panel || !panel.classList.contains('accordion-content')) {
        panel = null;
      }

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
          var otherPanel = other.nextElementSibling;
          if (!otherPanel || !otherPanel.classList.contains('accordion-content')) {
            otherPanel = null;
          }
          setPanelState(other, otherPanel, false);
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
  var toggle = document.getElementById('menuCheckbox');
  var menu = document.getElementById('menu');
  var mobileNav = document.querySelector('.mobile-nav');
  var mainContent = document.getElementById('main-content');
  var footer = document.querySelector('footer');

  if (toggle && menu) {
    toggle.setAttribute('aria-controls', 'menu');
    toggle.setAttribute('aria-expanded', 'false');

    if (mobileNav) {
      mobileNav.setAttribute('role', 'dialog');
    }

    var backdrop = document.createElement('div');
    backdrop.className = 'menu-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(backdrop, document.body.firstChild);

    var getFocusable = function () {
      return Array.prototype.slice
        .call(menu.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'))
        .filter(function (el) {
          return el.offsetParent !== null;
        });
    };

    var syncMenu = function () {
      var open = toggle.checked;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.style.overflow = open ? 'hidden' : '';
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
      if (!toggle.checked) {
        return;
      }
      toggle.checked = false;
      syncMenu();
      if (returnFocus) {
        toggle.focus();
      }
    };

    toggle.addEventListener('change', function () {
      syncMenu();
      if (toggle.checked) {
        /* Deferred two frames: the browser both (a) keeps focus on the
           checkbox as the last step of handling the click that triggered
           this 'change', and (b) hasn't necessarily laid out the
           just-revealed drawer yet, so an immediate focus() call here can
           silently no-op. Waiting for the next paint makes the target
           genuinely focusable before we move focus into it. */
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(function () {
            if (!toggle.checked) {
              return;
            }
            var focusables = getFocusable();
            if (focusables.length) {
              focusables[0].focus();
            }
          });
        });
      }
    });

    backdrop.addEventListener('click', function () {
      closeMenu(true);
    });

    document.addEventListener('keydown', function (event) {
      if (!toggle.checked) {
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
      if (toggle.checked && event.target.closest('a')) {
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
     Date/month inputs
     - native browsers only open the calendar popup when the tiny icon is
       clicked; clicking the rest of the field just places a text caret.
       Make the whole field open the picker, since that's what people expect.
     ------------------------------------------------------------------------- */
  document.querySelectorAll('input[type="date"], input[type="month"]').forEach(function (input) {
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
})();
