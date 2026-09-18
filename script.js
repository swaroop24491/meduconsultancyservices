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
     - closes on Escape and after a link is chosen
     - locks background scrolling while open
     ------------------------------------------------------------------------- */
  var toggle = document.getElementById('menuCheckbox');
  var menu = document.getElementById('menu');

  if (toggle && menu) {
    toggle.setAttribute('aria-controls', 'menu');
    toggle.setAttribute('aria-expanded', 'false');

    var syncMenu = function () {
      var open = toggle.checked;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.style.overflow = open ? 'hidden' : '';
    };

    toggle.addEventListener('change', syncMenu);

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && toggle.checked) {
        toggle.checked = false;
        syncMenu();
        toggle.focus();
      }
    });

    menu.addEventListener('click', function (event) {
      if (toggle.checked && event.target.closest('a')) {
        toggle.checked = false;
        syncMenu();
      }
    });

    syncMenu();
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
