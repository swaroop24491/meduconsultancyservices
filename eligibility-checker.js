/*
 * EPF / ESI eligibility checkers - shared standalone-question-and-verdict
 * component used by /epf-eligibility-checker and /esi-eligibility-checker.
 *
 * Legal sources (verify these are still current before relying on this for
 * an actual EPFO/ESIC registration decision - rules last checked 2026-09-16):
 *   - EPF: Employees' Provident Funds & Miscellaneous Provisions Act, 1952,
 *     Section 1(4) (voluntary coverage), Section 1(5) (continued coverage),
 *     Section 17(1) (permanent coverage once triggered); Employees'
 *     Provident Funds Scheme, 2026 (notified 29 June 2026), which
 *     reconfirmed the ₹15,000/month basic+DA wage ceiling.
 *   - ESI: Employees' State Insurance Act, 1948; ESI (Central) Rules, 1950,
 *     Rule 50 (wage ceiling and low-wage exemption); ESI (General)
 *     Regulations, 1950; state government notifications on the
 *     coverage-threshold headcount (10 vs 20 employees), which vary by
 *     state and change from time to time.
 *
 * This file is the reusable "component": initEligibilityCalculator(id,
 * config) renders ONE config-driven, self-contained calculator - its own
 * fields, its own submit action, its own single-card verdict - scoped
 * entirely under the DOM id passed as `id` (e.g. "business-eligibility" or
 * "employee-eligibility"). Each eligibility-checker page calls this twice,
 * once per calculator, so the two are fully independent: neither depends on
 * the other's inputs, submission order, or state. Each page supplies its
 * own questions, thresholds and evaluate() logic as config/data - no
 * markup or wiring logic is duplicated between the two schemes or the two
 * calculators on a page.
 */
(function (window) {
  'use strict';

  function formatINR(amount) {
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2
      }).format(amount);
    } catch (e) {
      return '₹' + amount;
    }
  }

  var STATUS_ICON = {
    positive: 'task_alt',
    negative: 'cancel',
    neutral: 'info',
    uncertain: 'help'
  };

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fieldIds(prefix, id) {
    return {
      input: prefix + '-' + id,
      help: prefix + '-' + id + '-help',
      error: prefix + '-' + id + '-error'
    };
  }

  function renderField(prefix, field) {
    var ids = fieldIds(prefix, field.id);
    var describedBy = [];
    if (field.help) describedBy.push(ids.help);
    describedBy.push(ids.error);
    var describedByAttr = ' aria-describedby="' + describedBy.join(' ') + '"';

    if (field.type === 'radio') {
      var groupName = prefix + '-' + field.id;
      var options = field.options.map(function (opt, i) {
        var optId = ids.input + '-' + i;
        return (
          '<label class="elig-radio-label" for="' + optId + '">' +
          '<input type="radio" id="' + optId + '" name="' + groupName + '" value="' + escapeHtml(opt.value) + '"' +
          (field.required ? ' required' : '') + '> ' +
          escapeHtml(opt.label) +
          '</label>'
        );
      }).join('');
      return (
        '<fieldset class="elig-field elig-radio-group" id="' + ids.input + '-fieldset">' +
        '<legend>' + escapeHtml(field.legend) + '</legend>' +
        '<div class="elig-radio-options">' + options + '</div>' +
        (field.help ? '<p class="calc-help" id="' + ids.help + '">' + field.help + '</p>' : '') +
        '<p class="calc-error" id="' + ids.error + '" aria-live="polite"></p>' +
        '</fieldset>'
      );
    }

    if (field.type === 'select') {
      var opts = '<option value="">Select…</option>' + field.options.map(function (opt) {
        return '<option value="' + escapeHtml(opt.value) + '"' +
          (opt.selected ? ' selected' : '') + '>' + escapeHtml(opt.label) + '</option>';
      }).join('');
      return (
        '<div class="elig-field">' +
        '<label for="' + ids.input + '">' + escapeHtml(field.label) + '</label>' +
        '<select id="' + ids.input + '" name="' + ids.input + '"' + describedByAttr + '>' + opts + '</select>' +
        (field.help ? '<p class="calc-help" id="' + ids.help + '">' + field.help + '</p>' : '') +
        '<p class="calc-error" id="' + ids.error + '" aria-live="polite"></p>' +
        '</div>'
      );
    }

    // numeric
    return (
      '<div class="elig-field">' +
      '<label for="' + ids.input + '">' + escapeHtml(field.label) + '</label>' +
      '<input type="number" id="' + ids.input + '" name="' + ids.input + '" inputmode="numeric" step="1"' +
      (field.min !== undefined ? ' min="' + field.min + '"' : '') +
      describedByAttr + '>' +
      (field.help ? '<p class="calc-help" id="' + ids.help + '">' + field.help + '</p>' : '') +
      '<p class="calc-error" id="' + ids.error + '" aria-live="polite"></p>' +
      '</div>'
    );
  }

  function renderFields(prefix, fields) {
    var required = fields.filter(function (f) { return !f.advanced; });
    var advanced = fields.filter(function (f) { return f.advanced; });
    var html = required.map(function (f) { return renderField(prefix, f); }).join('');
    if (advanced.length) {
      html += '<details class="elig-advanced"><summary>Advanced (optional)</summary>' +
        advanced.map(function (f) { return renderField(prefix, f); }).join('') + '</details>';
    }
    return html;
  }

  function readField(prefix, field) {
    var ids = fieldIds(prefix, field.id);
    if (field.type === 'radio') {
      var checked = document.querySelector('input[name="' + prefix + '-' + field.id + '"]:checked');
      return checked ? checked.value : '';
    }
    var el = document.getElementById(ids.input);
    if (!el) return field.type === 'select' ? '' : undefined;
    if (field.type === 'select') return el.value;
    return el.value === '' ? undefined : parseFloat(el.value);
  }

  function setError(prefix, field, message) {
    var ids = fieldIds(prefix, field.id);
    var el = document.getElementById(ids.error);
    if (el) el.textContent = message || '';
    if (field.type === 'radio') {
      var fs = document.getElementById(ids.input + '-fieldset');
      if (fs) {
        if (message) fs.setAttribute('aria-invalid', 'true');
        else fs.removeAttribute('aria-invalid');
      }
    } else {
      var input = document.getElementById(ids.input);
      if (input) {
        if (message) input.setAttribute('aria-invalid', 'true');
        else input.removeAttribute('aria-invalid');
      }
    }
  }

  function validateFields(prefix, fields) {
    var valid = true;
    var answers = {};
    fields.forEach(function (field) {
      var value = readField(prefix, field);
      setError(prefix, field, '');

      var isEmpty = value === '' || value === undefined || (typeof value === 'number' && isNaN(value));
      if (isEmpty) {
        if (!field.advanced && field.required !== false) {
          setError(prefix, field, field.errorRequired || 'This field is required.');
          valid = false;
        }
        answers[field.id] = field.type === 'number' ? undefined : '';
        return;
      }

      if (field.type === 'number' && field.min !== undefined && value < field.min) {
        setError(prefix, field, field.errorMin || ('Enter a value of ' + field.min + ' or more.'));
        valid = false;
      }

      answers[field.id] = value;
    });
    return { valid: valid, answers: answers };
  }

  function statusCard(kind, title, headline, reason, note, crosslink) {
    var icon = STATUS_ICON[kind] || STATUS_ICON.uncertain;
    return (
      '<div class="verdict-card status-' + kind + '">' +
      '<div class="verdict-status">' +
      '<span class="material-symbols-outlined" aria-hidden="true">' + icon + '</span>' +
      '<span class="verdict-label">' + escapeHtml(headline) + '</span>' +
      '</div>' +
      '<h4>' + escapeHtml(title) + '</h4>' +
      '<p class="verdict-reason">' + reason + '</p>' +
      (note ? '<p class="verdict-note">' + note + '</p>' : '') +
      (crosslink ? '<p class="verdict-cta">' + crosslink + '</p>' : '') +
      '</div>'
    );
  }

  /**
   * Renders and wires ONE standalone calculator. `id` is both the DOM id
   * of the outer <section> (so it doubles as the deep-link anchor, e.g.
   * "business-eligibility") and the prefix used for every element inside
   * it, so two calculators can coexist on the same page with zero id
   * collisions and zero shared state.
   */
  function initEligibilityCalculator(id, config) {
    var form = document.getElementById(id + '-form');
    if (!form) return;

    var fieldsContainer = document.getElementById(id + '-fields');
    var resultsEl = document.getElementById(id + '-results');

    fieldsContainer.innerHTML = renderFields(id, config.fields);
    resultsEl.setAttribute('tabindex', '-1');

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var result = validateFields(id, config.fields);
      if (!result.valid) {
        resultsEl.hidden = true;
        resultsEl.innerHTML = '';
        return;
      }
      renderResult(config.evaluate(result.answers));
    });

    function renderResult(verdict) {
      var html = statusCard(verdict.kind, config.cardTitle, verdict.headline, verdict.reason, verdict.note, verdict.crosslink);
      html += '<button type="button" class="elig-restart-btn">Check another scenario</button>';
      resultsEl.innerHTML = html;
      resultsEl.hidden = false;
      resultsEl.focus();

      resultsEl.querySelector('.elig-restart-btn').addEventListener('click', function () {
        resultsEl.hidden = true;
        resultsEl.innerHTML = '';
        form.reset();
        config.fields.forEach(function (field) { setError(id, field, ''); });
        var firstField = form.querySelector('input, select');
        if (firstField) firstField.focus();
      });
    }
  }

  // Smooth-scrolls to the element matching the current URL hash (e.g.
  // "#employee-eligibility"), if one exists on the page. Fields are
  // rendered synchronously by initEligibilityCalculator above, so calling
  // this after both calculators have initialized lands on the right spot
  // even though content height changes after the browser's own initial,
  // non-smooth fragment jump.
  function scrollToHash() {
    var hash = window.location.hash;
    if (!hash || hash.length < 2) return;
    var target = document.getElementById(hash.slice(1));
    if (!target) return;
    window.requestAnimationFrame(function () {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  window.EligibilityChecker = {
    formatINR: formatINR,
    scrollToHash: scrollToHash
  };
  window.initEligibilityCalculator = initEligibilityCalculator;
})(window);
