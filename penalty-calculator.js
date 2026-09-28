/*
 * EPF / ESI late-payment penalty calculator.
 *
 * Legal sources (verify these are still current before relying on this for
 * an actual EPFO/ESIC matter - rates last checked 2026-09-27):
 *   Code on Social Security, 2020 (in force from 21 November 2025). It
 *   replaced the EPF Act, 1952 and the ESI Act, 1948; section numbers that
 *   replace the old Act sections are still being verified.
 *   Interest and damages on late contributions (formerly EPF Act s.7Q/14B
 *   and ESI Act s.85B). EPF damages rates as changed from 14 June 2024;
 *   ESI slabs as in the ESI (General) Regulations (Reg. 31-A/31C), which
 *   secondary sources say still apply under the Code.
 *
 * Both EPF and ESI charge two separate amounts on a late contribution:
 *   1. Interest - 12% p.a. simple interest on the arrears, for every day
 *      of delay. Fixed for both schemes, not discretionary.
 *   2. Damages - a separate, punitive charge. For ESI, and for EPF defaults
 *      before 14 June 2024, this is a slab rate based on how long the delay
 *      is, counting a month as 30 days: under 2 months (under 60 days) 5%
 *      p.a.; 2 to under 4 months (60-119 days) 10%; 4 to under 6 months
 *      (120-179 days) 15%; 6 months or more (180+ days) 25%. For EPF defaults on or after 14 June 2024,
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

  function slabFor(delayDays) {
    // Slabs use the actual delay in 30-day months, not rounded up: a delay
    // of exactly 60 days is 2 months and falls in the 10% slab.
    var months = delayDays / 30;
    if (months < 2) return { rate: 0.05, label: 'a delay under 2 months' };
    if (months < 4) return { rate: 0.10, label: 'a delay from 2 months up to 4 months' };
    if (months < 6) return { rate: 0.15, label: 'a delay from 4 months up to 6 months' };
    return { rate: 0.25, label: 'a delay of 6 months or more' };
  }

  function calculateInterest(amount, delayDays) {
    return round2(amount * INTEREST_RATE_ANNUAL * (delayDays / 365));
  }

  function calculateEsiDamages(amount, delayDays) {
    var slab = slabFor(delayDays);
    return {
      amount: round2(amount * slab.rate * (delayDays / 365)),
      ruleLabel: 'Rate: ' + (slab.rate * 100) + '% a year',
      bracketLabel: slab.label,
      capped: false,
      usesRoundedMonths: false
    };
  }

  function calculateEpfDamages(amount, delayDays, delayMonths, dueDate) {
    if (dueDate < EPF_RATE_CHANGE_DATE) {
      var slab = slabFor(delayDays);
      return {
        amount: round2(amount * slab.rate * (delayDays / 365)),
        ruleLabel: 'Old rate (before 14 June 2024): ' + (slab.rate * 100) + '% a year',
        bracketLabel: slab.label,
        capped: false,
        usesRoundedMonths: false
      };
    }
    var raw = amount * EPF_POST_CHANGE_MONTHLY_RATE * delayMonths;
    var cap = amount * EPF_DAMAGES_CAP_RATIO;
    var capped = raw > cap;
    return {
      amount: round2(Math.min(raw, cap)),
      ruleLabel: 'New rate (from 14 June 2024): 1% a month',
      bracketLabel: delayMonths + ' month' + (delayMonths === 1 ? '' : 's') + ' late',
      capped: capped,
      usesRoundedMonths: true
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
      : calculateEsiDamages(input.amount, delayDays);
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

  // Shared tool behaviour (style guide "Tool parts"): after the button, a valid
  // result gets focus and scrolls into view (clear of the sticky header and call
  // bar); an invalid form focuses the first field with an error.
  function showResult(el) {
    el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'start' });
  }

  function focusFirstInvalid(form) {
    var el = form.querySelector('[aria-invalid="true"]');
    if (el && el.tagName === 'FIELDSET') el = el.querySelector('input');
    if (el) el.focus();
  }

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
      dueDateOutput.value = formatDateLong(due); // the help line says it is the 15th of the next month
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
        setError('amount', 'Enter the unpaid amount.');
        valid = false;
      } else if (amountValue <= 0) {
        setError('amount', 'Enter an amount more than ₹0.');
        valid = false;
      }

      var due = updateDueDate();
      if (!due) {
        setError('wage-month', 'Choose the salary month.');
        valid = false;
      }

      var paymentDate = parseDateInput(paymentDateInput.value);
      if (!paymentDate) {
        setError('payment-date', 'Choose the date you paid, or will pay.');
        valid = false;
      }

      if (!valid) {
        resultsEl.innerHTML = '';
        focusFirstInvalid(form);
        return;
      }

      var result = calculate(scheme, {
        amount: amountValue,
        dueDate: due,
        paymentDate: paymentDate
      });

      renderResult(resultsEl, labels, result, paymentDate);
      showResult(resultsEl);
    });

    var CALL = '<a href="tel:+918217542975" data-call-location="result">Call us</a>';

    function renderResult(container, labels, result, paymentDate) {
      if (result.onTime) {
        container.innerHTML =
          '<div class="result-message">' +
          '<strong>On time. Nothing extra to pay.</strong>' +
          '<p>Your payment date is on or before the due date (' +
          formatDateLong(result.dueDate) + '). No interest or damages.</p>' +
          '</div>';
        return;
      }

      var html = '';
      html += '<div class="result-summary">';
      html += '<p><strong>Due date:</strong> ' + formatDateLong(result.dueDate) + '</p>';
      html += '<p><strong>Days late:</strong> ' + result.delayDays;
      if (result.damages.usesRoundedMonths) {
        html += ' (counted as ' + result.delayMonths +
          ' month' + (result.delayMonths === 1 ? '' : 's') + ' for damages)';
      }
      html += '</p>';
      html += '</div>';

      html += '<table class="result-table">';
      html += '<caption class="visually-hidden">' + labels.tableCaption + '</caption>';
      html += '<thead><tr><th scope="col">What</th><th scope="col">Amount</th></tr></thead>';
      html += '<tbody>';
      html += '<tr><th scope="row">Unpaid amount</th><td>' + formatINR(result.principal) + '</td></tr>';
      html += '<tr><th scope="row">' + labels.interestLabel + '</th><td>' + formatINR(result.interest) + '</td></tr>';
      html += '<tr><th scope="row">' + labels.damagesLabel + '</th><td>' + formatINR(result.damages.amount) + '</td></tr>';
      html += '<tr class="result-table__total"><th scope="row">Total (estimate)</th><td>' + formatINR(result.total) + '</td></tr>';
      html += '</tbody></table>';

      html += '<p class="result-note">' + result.damages.ruleLabel +
        ', for ' + result.damages.bracketLabel + '.</p>';

      // Text-only notes (the amounts above don't change). Strategy 9.4 #18: PF
      // due before the 14 June 2024 change but paid after it. 9.4 #1/#2: the old
      // slabs have no cap here, so very long delays can give damages above the
      // unpaid amount; the cap under the Code is not yet confirmed.
      if (scheme === 'epf' && result.dueDate < EPF_RATE_CHANGE_DATE && paymentDate >= EPF_RATE_CHANGE_DATE) {
        html += '<p class="result-note">Your PF was due before 14 June 2024 and paid after it. The rules for this are not clear, so this figure may change. ' + CALL + ' to check.</p>';
      }
      if (!result.damages.capped && result.damages.amount > result.principal) {
        html += '<p class="result-note">Damages this high are unusual. ' + CALL + ' to check.</p>';
      }

      if (result.damages.capped) {
        html += '<p class="result-note">Damages can\'t be more than the unpaid amount. So they stop at 100% of it.</p>';
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
