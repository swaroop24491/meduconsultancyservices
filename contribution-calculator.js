/*
 * EPF / ESI contribution calculator - shared form-and-breakdown-table
 * component used by /epf-contribution-calculator and
 * /esi-contribution-calculator.
 *
 * Legal sources (verify these are still current before relying on this for
 * an actual payroll run - rules last checked 2026-09-16):
 *   - EPF: Employees' Provident Funds & Miscellaneous Provisions Act, 1952;
 *     Employees' Provident Funds Scheme, 2026 (notified 29 June 2026),
 *     ₹15,000/month basic+DA wage ceiling and voluntary continuation above
 *     it; Employees' Pension Scheme, 1995 (8.33% EPS share, capped at
 *     ₹15,000 basic - max ₹1,250/month); Employees' Deposit Linked
 *     Insurance Scheme, 1976 (0.5% EDLI share, capped at ₹15,000); EPFO
 *     administrative-charges notification (0.5% of actual basic+DA,
 *     uncapped, ₹75/month minimum).
 *   - ESI: Employees' State Insurance Act, 1948; ESI (Central) Rules, 1950,
 *     Rule 50 (contribution rates and low-wage exemption); ESI (General)
 *     Regulations, 1950.
 *
 * This file is the reusable "component": initContributionCalculator(scheme,
 * config) renders a config-driven form and recalculates a breakdown table
 * live as the user types. Each page (epf-contribution-calculator.html /
 * esi-contribution-calculator.html) supplies its own fields, rates and
 * compute() logic as config/data - no markup or wiring is duplicated
 * between the two schemes.
 */
(function (window) {
  'use strict';

  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

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

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fieldErrorId(id) {
    return id + '-error';
  }

  function fieldHelpId(id) {
    return id + '-help';
  }

  function renderField(field) {
    var describedBy = [];
    if (field.help) describedBy.push(fieldHelpId(field.id));
    describedBy.push(fieldErrorId(field.id));
    var describedByAttr = ' aria-describedby="' + describedBy.join(' ') + '"';

    if (field.type === 'radio') {
      var options = field.options.map(function (opt) {
        return (
          '<label class="elig-radio-label">' +
          '<input type="radio" name="' + field.id + '" value="' + escapeHtml(opt.value) + '"' +
          (opt.value === field.default ? ' checked' : '') + '> ' +
          escapeHtml(opt.label) +
          '</label>'
        );
      }).join('');
      return (
        '<fieldset class="elig-field elig-radio-group" id="' + field.id + '-field">' +
        '<legend>' + escapeHtml(field.legend) + '</legend>' +
        '<div class="elig-radio-options">' + options + '</div>' +
        (field.help ? '<p class="calc-help" id="' + fieldHelpId(field.id) + '">' + field.help + '</p>' : '') +
        '<p class="calc-error" id="' + fieldErrorId(field.id) + '" aria-live="polite"></p>' +
        '</fieldset>'
      );
    }

    // numeric
    return (
      '<div class="elig-field calc-field" id="' + field.id + '-field">' +
      '<label for="' + field.id + '">' + escapeHtml(field.label) + '</label>' +
      '<input type="number" id="' + field.id + '" name="' + field.id + '" inputmode="numeric" step="1"' +
      (field.min !== undefined ? ' min="' + field.min + '"' : '') +
      describedByAttr + '>' +
      (field.help ? '<p class="calc-help" id="' + fieldHelpId(field.id) + '">' + field.help + '</p>' : '') +
      '<p class="calc-error" id="' + fieldErrorId(field.id) + '" aria-live="polite"></p>' +
      '</div>'
    );
  }

  function readField(field) {
    if (field.type === 'radio') {
      var checked = document.querySelector('input[name="' + field.id + '"]:checked');
      return checked ? checked.value : '';
    }
    var el = document.getElementById(field.id);
    if (!el) return undefined;
    return el.value === '' ? undefined : parseFloat(el.value);
  }

  function setError(field, message) {
    var el = document.getElementById(fieldErrorId(field.id));
    if (el) el.textContent = message || '';
    if (field.type === 'radio') {
      var fs = document.getElementById(field.id + '-field');
      if (fs) {
        if (message) fs.setAttribute('aria-invalid', 'true');
        else fs.removeAttribute('aria-invalid');
      }
    } else {
      var input = document.getElementById(field.id);
      if (input) {
        if (message) input.setAttribute('aria-invalid', 'true');
        else input.removeAttribute('aria-invalid');
      }
    }
  }

  function initContributionCalculator(scheme, config) {
    var form = document.getElementById('contribution-form');
    if (!form) return;

    var fieldsContainer = document.getElementById('contrib-fields');
    var resultsEl = document.getElementById('contrib-results');

    var required = config.fields.filter(function (f) { return !f.advanced; });
    var advanced = config.fields.filter(function (f) { return f.advanced; });
    var fieldsHtml = required.map(renderField).join('');
    if (advanced.length) {
      fieldsHtml += '<details class="elig-advanced"><summary>Advanced (optional)</summary>' +
        advanced.map(renderField).join('') + '</details>';
    }
    fieldsContainer.innerHTML = fieldsHtml;

    function currentAnswers() {
      var answers = {};
      config.fields.forEach(function (field) {
        answers[field.id] = readField(field);
      });
      return answers;
    }

    function updateVisibility(answers) {
      config.fields.forEach(function (field) {
        if (!field.visibleIf) return;
        var el = document.getElementById(field.id + '-field');
        if (!el) return;
        el.hidden = !field.visibleIf(answers);
      });
    }

    function validate(answers) {
      var valid = true;
      config.fields.forEach(function (field) {
        setError(field, '');
        var el = document.getElementById(field.id + '-field');
        if (el && el.hidden) return;
        var value = answers[field.id];
        if (field.type === 'radio') return; // always has a default
        var isEmpty = value === '' || value === undefined || isNaN(value);
        if (isEmpty) {
          if (field.required === false) return; // optional field left blank
          setError(field, field.errorRequired || 'This field is required.');
          valid = false;
          return;
        }
        if (field.min !== undefined && value < field.min) {
          setError(field, field.errorMin || ('Enter a value of ' + field.min + ' or more.'));
          valid = false;
        }
      });
      return valid;
    }

    function renderResult(result) {
      if (!result.applicable) {
        resultsEl.innerHTML =
          '<div class="calc-ontime calc-not-applicable">' +
          '<p><strong>' + result.headline + '</strong></p>' +
          '<p>' + result.message + '</p>' +
          (result.note ? '<p>' + result.note + '</p>' : '') +
          '</div>';
        return;
      }

      var html = '';
      if (result.summary && result.summary.length) {
        html += '<div class="calc-result-summary">';
        result.summary.forEach(function (line) {
          html += '<p>' + line + '</p>';
        });
        html += '</div>';
      }

      html += '<table class="calc-table">';
      html += '<caption class="visually-hidden">' + result.tableCaption + '</caption>';
      html += '<thead><tr><th scope="col">Component</th><th scope="col">Amount</th></tr></thead>';
      html += '<tbody>';
      result.rows.forEach(function (row) {
        var rowClass = row.emphasis ? ' class="calc-total-row"' : (row.subtotal ? ' class="calc-subtotal-row"' : '');
        html += '<tr' + rowClass + '>' +
          '<th scope="row">' + row.label + '</th>' +
          '<td>' + formatINR(row.amount) + '</td></tr>';
      });
      html += '</tbody></table>';

      (result.notes || []).forEach(function (note) {
        html += '<p class="calc-rule-note">' + note + '</p>';
      });

      resultsEl.innerHTML = html;
    }

    function recalculate() {
      var answers = currentAnswers();
      updateVisibility(answers);
      // Re-read after visibility changes, since a now-hidden field must not
      // block calculation and a now-visible one needs its default value.
      answers = currentAnswers();

      var hasAnyInput = config.fields.some(function (field) {
        return field.type !== 'radio' && answers[field.id] !== '' && !isNaN(answers[field.id]);
      });
      if (!hasAnyInput) {
        resultsEl.innerHTML = '';
        return;
      }

      if (!validate(answers)) {
        resultsEl.innerHTML = '';
        return;
      }

      var result = config.compute(answers);
      renderResult(result);
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      recalculate();
    });

    form.addEventListener('input', recalculate);
    form.addEventListener('change', recalculate);

    updateVisibility(currentAnswers());
  }

  window.ContributionCalculator = {
    round2: round2,
    formatINR: formatINR
  };
  window.initContributionCalculator = initContributionCalculator;
})(window);
