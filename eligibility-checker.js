/*
 * EPF / ESI eligibility checkers - shared standalone-question-and-verdict
 * component used by /epf-eligibility-checker and /esi-eligibility-checker.
 *
 * Legal sources (verify these are still current before relying on this for
 * an actual EPFO/ESIC registration decision - rules last checked 2026-09-27):
 *   Code on Social Security, 2020 (in force from 21 November 2025). It
 *   replaced the EPF Act, 1952 and the ESI Act, 1948; section numbers that
 *   replace the old Act sections are still being verified.
 *   - EPF: 20 or more employees; voluntary and continued coverage;
 *     coverage stays once triggered. Employees' Provident Funds Scheme,
 *     2026; wage ceiling ₹25,000/month from 17 September 2026 (Gazette
 *     S.O. 5109(E)) - it was ₹15,000 before that.
 *   - ESI: 10 or more employees in every state, except seasonal factories;
 *     ₹21,000 wage ceiling (₹25,000 for a person with disability);
 *     low-wage exemption up to ₹176/day.
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

  // Inline SVG icons (Material Symbols paths, same as _data/icons.yml:
  // check-circle, cancel, info, help). Rebuilt pages load no icon font.
  var RING = 'Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z';
  var CIRCLE = 'q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80' + RING;
  var STATUS_ICON = {
    positive: 'm424-296 282-282-56-57-226 226-114-114-56 57 170 170Zm56 216' + CIRCLE,
    negative: 'm336-280 144-144 144 144 56-56-144-144 144-144-56-56-144 144-144-144-56 56 144 144-144 144 56 56ZM480-80' + CIRCLE,
    neutral: 'M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520' + CIRCLE,
    uncertain: 'M478-240q21 0 35.5-14.5T528-290q0-21-14.5-35.5T478-340q-21 0-35.5 14.5T428-290q0 21 14.5 35.5T478-240Zm-36-154h74q0-33 7.5-52t42.5-52q26-26 41-49.5t15-56.5q0-56-41-86t-97-30q-57 0-92.5 30T342-618l66 26q5-18 22.5-39t53.5-21q32 0 48 17.5t16 38.5q0 20-12 37.5T506-526q-44 39-54 59t-10 73Zm38 314' + CIRCLE
  };

  function iconSvg(path) {
    return '<svg class="icon" width="24" height="24" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true" focusable="false"><path d="' + path + '"/></svg>';
  }

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
          '<label class="radio" for="' + optId + '">' +
          '<input type="radio" id="' + optId + '" name="' + groupName + '" value="' + escapeHtml(opt.value) + '"' +
          (field.required ? ' required' : '') + '> ' +
          escapeHtml(opt.label) +
          '</label>'
        );
      }).join('');
      return (
        '<fieldset class="field" id="' + ids.input + '-fieldset"' + describedByAttr + '>' +
        '<legend>' + escapeHtml(field.legend) + '</legend>' +
        '<div class="field__options">' + options + '</div>' +
        (field.help ? '<p class="field__help" id="' + ids.help + '">' + field.help + '</p>' : '') +
        '<p class="field__error" id="' + ids.error + '" aria-live="polite"></p>' +
        '</fieldset>'
      );
    }

    if (field.type === 'select') {
      var opts = '<option value="">Select…</option>' + field.options.map(function (opt) {
        return '<option value="' + escapeHtml(opt.value) + '"' +
          (opt.selected ? ' selected' : '') + '>' + escapeHtml(opt.label) + '</option>';
      }).join('');
      return (
        '<div class="field">' +
        '<label for="' + ids.input + '">' + escapeHtml(field.label) + '</label>' +
        '<select id="' + ids.input + '" name="' + ids.input + '"' + describedByAttr + '>' + opts + '</select>' +
        (field.help ? '<p class="field__help" id="' + ids.help + '">' + field.help + '</p>' : '') +
        '<p class="field__error" id="' + ids.error + '" aria-live="polite"></p>' +
        '</div>'
      );
    }

    // numeric
    return (
      '<div class="field">' +
      '<label for="' + ids.input + '">' + escapeHtml(field.label) + '</label>' +
      '<input type="number" id="' + ids.input + '" name="' + ids.input + '" inputmode="numeric" step="1"' +
      (field.min !== undefined ? ' min="' + field.min + '"' : '') +
      describedByAttr + '>' +
      (field.help ? '<p class="field__help" id="' + ids.help + '">' + field.help + '</p>' : '') +
      '<p class="field__error" id="' + ids.error + '" aria-live="polite"></p>' +
      '</div>'
    );
  }

  function renderFields(prefix, fields) {
    var required = fields.filter(function (f) { return !f.advanced; });
    var advanced = fields.filter(function (f) { return f.advanced; });
    var html = required.map(function (f) { return renderField(prefix, f); }).join('');
    if (advanced.length) {
      html += '<details class="field-more"><summary>More (optional)</summary>' +
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
          setError(prefix, field, field.errorRequired || 'Please fill this in.');
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
      '<div class="verdict verdict--' + kind + '">' +
      '<p class="verdict__label">' + escapeHtml(title) + '</p>' +
      '<p class="verdict__title">' + iconSvg(icon) + '<span>' + escapeHtml(headline) + '</span></p>' +
      '<p>' + reason + '</p>' +
      (note ? '<p class="verdict__note">' + note + '</p>' : '') +
      (crosslink ? '<p>' + crosslink + '</p>' : '') +
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
      html += '<p><button type="button" class="btn-link" data-restart>Check again</button></p>';
      resultsEl.innerHTML = html;
      resultsEl.hidden = false;
      resultsEl.focus();

      resultsEl.querySelector('[data-restart]').addEventListener('click', function () {
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
