/*
 * EPF / ESI late-payment penalty calculator.
 *
 * Legal sources (verify these are still current before relying on this for
 * an actual EPFO/ESIC matter - rates last checked 2026-09-15):
 *   - EPF: Employees' Provident Funds & Miscellaneous Provisions Act, 1952,
 *     Section 7Q (interest) & Section 14B (damages); EPF Scheme 1952,
 *     Para 32A, as amended by EPFO circular effective 14 June 2024.
 *   - ESI: Employees' State Insurance Act, 1948, Section 85B (damages);
 *     ESI (General) Regulations, 1950, Regulation 31-A (interest) &
 *     Regulation 31C (damages).
 *
 * Both EPF and ESI charge two separate amounts on a late contribution:
 *   1. Interest - 12% p.a. simple interest on the arrears, for every day
 *      of delay. Fixed for both schemes, not discretionary.
 *   2. Damages - a separate, punitive charge. For ESI, and for EPF defaults
 *      before 14 June 2024, this is a slab rate (5/10/15/25% p.a.) based on
 *      how long the delay is. For EPF defaults on or after 14 June 2024,
 *      it is a flat 1% per month (or part month), capped at 100% of the
 *      arrears.
 *
 * This file has two parts: pure calculation (PenaltyCalculator, reusable
 * and unit-testable on its own) and DOM wiring (initPenaltyCalculator,
 * which both /epf-penalty-calculator and /esi-penalty-calculator call with
 * their own scheme name and copy - the shared "component" the two pages
 * are built from).
 */
(function (window) {
  'use strict';

  var MS_PER_DAY = 24 * 60 * 60 * 1000;

  var INTEREST_RATE_ANNUAL = 0.12; // 12% p.a., both schemes

  var EPF_RATE_CHANGE_DATE = new Date(2024, 5, 14); // 14 June 2024
  var EPF_POST_CHANGE_MONTHLY_RATE = 0.01; // 1% per month/part-month
  var EPF_DAMAGES_CAP_RATIO = 1.0; // statutory ceiling: 100% of arrears

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function dueDateForWageMonth(wageMonthIndex, wageYear) {
    // Contribution for a wage month is due on the 15th of the next month.
    // JS Date rolls December -> January of the next year automatically.
    return new Date(wageYear, wageMonthIndex + 1, 15);
  }

  function daysBetween(from, to) {
    return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
  }

  function delayMonthsRoundedUp(delayDays) {
    return Math.ceil(delayDays / 30);
  }

  function slabFor(delayMonths) {
    if (delayMonths < 2) return { rate: 0.05, label: 'delay under 2 months' };
    if (delayMonths <= 4) return { rate: 0.10, label: 'delay bracket 2-4 months' };
    if (delayMonths <= 6) return { rate: 0.15, label: 'delay bracket 4-6 months' };
    return { rate: 0.25, label: 'delay bracket 6+ months' };
  }

  function calculateInterest(amount, delayDays) {
    return round2(amount * INTEREST_RATE_ANNUAL * (delayDays / 365));
  }

  function calculateEsiDamages(amount, delayDays, delayMonths) {
    var slab = slabFor(delayMonths);
    return {
      amount: round2(amount * slab.rate * (delayDays / 365)),
      ruleLabel: 'Slab rate (Regulation 31C): ' + (slab.rate * 100) + '% p.a.',
      bracketLabel: slab.label,
      capped: false
    };
  }

  function calculateEpfDamages(amount, delayDays, delayMonths, dueDate) {
    if (dueDate < EPF_RATE_CHANGE_DATE) {
      var slab = slabFor(delayMonths);
      return {
        amount: round2(amount * slab.rate * (delayDays / 365)),
        ruleLabel: 'Pre-June 2024 slab rate (Section 14B): ' + (slab.rate * 100) + '% p.a.',
        bracketLabel: slab.label,
        capped: false
      };
    }
    var raw = amount * EPF_POST_CHANGE_MONTHLY_RATE * delayMonths;
    var cap = amount * EPF_DAMAGES_CAP_RATIO;
    var capped = raw > cap;
    return {
      amount: round2(Math.min(raw, cap)),
      ruleLabel: 'Post-June 2024 flat rate (EPF Scheme Para 32A, as amended): 1% per month',
      bracketLabel: delayMonths + ' month' + (delayMonths === 1 ? '' : 's') + ' of delay',
      capped: capped
    };
  }

  function calculate(scheme, input) {
    var dueDate = input.dueDate;
    var paymentDate = input.paymentDate;
    var delayDays = daysBetween(dueDate, paymentDate);

    if (delayDays <= 0) {
      return { onTime: true, dueDate: dueDate };
    }

    var delayMonths = delayMonthsRoundedUp(delayDays);
    var interest = calculateInterest(input.amount, delayDays);
    var damages = scheme === 'epf'
      ? calculateEpfDamages(input.amount, delayDays, delayMonths, dueDate)
      : calculateEsiDamages(input.amount, delayDays, delayMonths);
    var total = round2(input.amount + interest + damages.amount);

    return {
      onTime: false,
      dueDate: dueDate,
      delayDays: delayDays,
      delayMonths: delayMonths,
      principal: input.amount,
      interest: interest,
      damages: damages,
      total: total
    };
  }

  function formatDateLong(date) {
    var months = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    return date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
  }

  function formatINR(amount) {
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2
      }).format(amount);
    } catch (e) {
      return '₹' + amount.toFixed(2);
    }
  }

  function parseMonthInput(value) {
    // <input type="month"> gives "YYYY-MM"
    if (!value) return null;
    var parts = value.split('-');
    if (parts.length !== 2) return null;
    var year = parseInt(parts[0], 10);
    var monthIndex = parseInt(parts[1], 10) - 1;
    if (isNaN(year) || isNaN(monthIndex)) return null;
    return { year: year, monthIndex: monthIndex };
  }

  function parseDateInput(value) {
    // <input type="date"> gives "YYYY-MM-DD"
    if (!value) return null;
    var parts = value.split('-');
    if (parts.length !== 3) return null;
    var year = parseInt(parts[0], 10);
    var monthIndex = parseInt(parts[1], 10) - 1;
    var day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(monthIndex) || isNaN(day)) return null;
    return new Date(year, monthIndex, day);
  }

  /* ------------------------------- DOM wiring ------------------------------ */

  function initPenaltyCalculator(scheme, labels) {
    var form = document.getElementById('penalty-form');
    if (!form) return;

    var amountInput = document.getElementById('amount');
    var wageMonthInput = document.getElementById('wage-month');
    var dueDateOutput = document.getElementById('due-date');
    var paymentDateInput = document.getElementById('payment-date');
    var resultsEl = document.getElementById('calc-results');

    function fieldError(id) {
      return document.getElementById(id + '-error');
    }

    function clearError(id) {
      var el = fieldError(id);
      if (el) el.textContent = '';
      var input = document.getElementById(id);
      if (input) input.removeAttribute('aria-invalid');
    }

    function setError(id, message) {
      var el = fieldError(id);
      if (el) el.textContent = message;
      var input = document.getElementById(id);
      if (input) input.setAttribute('aria-invalid', 'true');
    }

    function updateDueDate() {
      var parsed = parseMonthInput(wageMonthInput.value);
      if (!parsed) {
        dueDateOutput.value = '';
        return null;
      }
      var due = dueDateForWageMonth(parsed.monthIndex, parsed.year);
      dueDateOutput.value = formatDateLong(due) + ' (15th of the following month)';
      return due;
    }

    wageMonthInput.addEventListener('change', updateDueDate);
    updateDueDate();

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var valid = true;
      clearError('amount');
      clearError('wage-month');
      clearError('payment-date');

      var amountValue = parseFloat(amountInput.value);
      if (!amountInput.value || isNaN(amountValue)) {
        setError('amount', 'Enter the arrears amount.');
        valid = false;
      } else if (amountValue <= 0) {
        setError('amount', 'Enter an amount greater than ₹0.');
        valid = false;
      }

      var due = updateDueDate();
      if (!due) {
        setError('wage-month', 'Select the wage month this contribution relates to.');
        valid = false;
      }

      var paymentDate = parseDateInput(paymentDateInput.value);
      if (!paymentDate) {
        setError('payment-date', 'Select the actual or expected payment date.');
        valid = false;
      }

      if (!valid) {
        resultsEl.innerHTML = '';
        return;
      }

      var result = calculate(scheme, {
        amount: amountValue,
        dueDate: due,
        paymentDate: paymentDate
      });

      renderResult(resultsEl, labels, result);
    });

    function renderResult(container, labels, result) {
      if (result.onTime) {
        container.innerHTML =
          '<div class="calc-ontime">' +
          '<p><strong>No penalty - you’re on time.</strong></p>' +
          '<p>The payment date you entered is on or before the due date (' +
          formatDateLong(result.dueDate) + '). No interest or damages apply.</p>' +
          '</div>';
        return;
      }

      var html = '';
      html += '<div class="calc-result-summary">';
      html += '<p><strong>Due date:</strong> ' + formatDateLong(result.dueDate) + '</p>';
      html += '<p><strong>Delay:</strong> ' + result.delayDays +
        ' day' + (result.delayDays === 1 ? '' : 's') + ' (' + result.delayMonths +
        ' month' + (result.delayMonths === 1 ? '' : 's') +
        ' for damages calculation, rounded up)</p>';
      html += '</div>';

      html += '<table class="calc-table">';
      html += '<caption class="visually-hidden">' + labels.tableCaption + '</caption>';
      html += '<thead><tr><th scope="col">Component</th><th scope="col">Amount</th></tr></thead>';
      html += '<tbody>';
      html += '<tr><th scope="row">Principal arrears</th><td>' + formatINR(result.principal) + '</td></tr>';
      html += '<tr><th scope="row">' + labels.interestLabel + '</th><td>' + formatINR(result.interest) + '</td></tr>';
      html += '<tr><th scope="row">' + labels.damagesLabel + '</th><td>' + formatINR(result.damages.amount) + '</td></tr>';
      html += '<tr class="calc-total-row"><th scope="row">Total payable</th><td>' + formatINR(result.total) + '</td></tr>';
      html += '</tbody></table>';

      html += '<p class="calc-rule-note">' + result.damages.ruleLabel +
        ' - ' + result.damages.bracketLabel + '.</p>';

      if (result.damages.capped) {
        html += '<p class="calc-cap-note">Damages have been capped at 100% of the arrears amount (statutory ceiling).</p>';
      }

      container.innerHTML = html;
    }
  }

  window.PenaltyCalculator = {
    calculate: calculate,
    dueDateForWageMonth: dueDateForWageMonth,
    formatINR: formatINR,
    formatDateLong: formatDateLong,
    EPF_RATE_CHANGE_DATE: EPF_RATE_CHANGE_DATE
  };
  window.initPenaltyCalculator = initPenaltyCalculator;
})(window);
