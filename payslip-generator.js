/*
 * Payslip generator - /free-payslip-generator and /kn/free-payslip-generator.
 *
 * Everything happens in the browser: nothing is sent anywhere. The form is
 * static HTML on the page (labels in the page language); this script adds the
 * earning and deduction rows, works out paid days and totals, draws the live
 * payslip preview, and prints it (the print CSS in site.css shows only the
 * payslip, so the browser's "Save as PDF" gives a one-page A4 payslip).
 *
 * Optional PF/ESI auto-fill uses the same rules as the contribution
 * calculators (epf-contribution-calculator.html, esi-contribution-calculator.html).
 * Legal sources - verify they are still current, last checked 2026-09-27
 * (brief section 11; tools_checked in _data/facts.yml):
 *   Code on Social Security, 2020 (in force from 21 November 2025).
 *   - EPF: employee share 12% (10% for some businesses the government has
 *     named) of PF wages; ₹25,000/month wage ceiling from 17 September 2026
 *     (Gazette S.O. 5109(E)), ₹15,000 before that; PF on the full PF wages
 *     above the ceiling only if employer and employee both agree.
 *   - ESI: employee share 0.75% of ESI wages; ₹21,000 wage ceiling (₹25,000
 *     for a person with a disability). The ₹176/day low-pay exemption is not
 *     confirmed under the Code, so it is not checked (owner decision
 *     2026-09-28); the page tells users to call.
 * Amounts are rounded to the rupee with Math.round, like the contribution
 * calculators.
 *
 * Page config: initPayslipGenerator({ lang, text, slipText, rowNames }).
 * English pages pass nothing; Kannada pages pass their own words.
 */
(function (window) {
  'use strict';

  var PF_WAGE_CEILING = 25000;
  var PF_OLD_CEILING = 15000;
  var FIRST_AUTO_MONTH = '2026-09';
  var ESI_CEILING = 21000;
  var ESI_CEILING_PWD = 25000;
  var ESI_EMPLOYEE_RATE = 0.0075;
  var LOGO_MAX_BYTES = 1024 * 1024;
  var STORE_KEY = 'medu-payslip-company';

  // ---------- Pure helpers (also used by the test cases) ----------

  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function formatINR(amount) {
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2
      }).format(amount);
    } catch (e) {
      return '₹' + amount.toFixed(2);
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function daysInMonth(ym) {
    var m = /^(\d{4})-(\d{2})$/.exec(ym || '');
    if (!m) return 0;
    return new Date(Number(m[1]), Number(m[2]), 0).getDate();
  }

  // Paid days = days in the month minus days without pay (never below 0).
  function paidDays(ym, lop) {
    var days = daysInMonth(ym);
    if (!days) return 0;
    return Math.max(0, round2(days - (lop > 0 ? lop : 0)));
  }

  // Employee PF share. full = true: PF on the full PF wages (both agree).
  function pfShare(pfWages, rate, full) {
    if (!(pfWages > 0)) return 0;
    var base = full ? pfWages : Math.min(pfWages, PF_WAGE_CEILING);
    return Math.round(base * (rate === 10 ? 0.10 : 0.12));
  }

  // Employee ESI share; 0 above the limit.
  function esiShare(esiWages, pwd) {
    if (!(esiWages > 0)) return 0;
    if (esiWages > (pwd ? ESI_CEILING_PWD : ESI_CEILING)) return 0;
    return Math.round(esiWages * ESI_EMPLOYEE_RATE);
  }

  // Indian-style amount in words (lakh, crore), English.
  var EN_ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  var EN_TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function enBelow100(n) {
    if (n < 20) return EN_ONES[n];
    return EN_TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + EN_ONES[n % 10] : '');
  }

  function enBelow1000(n) {
    var h = Math.floor(n / 100), r = n % 100;
    return (h ? EN_ONES[h] + ' Hundred' + (r ? ' ' : '') : '') + (r ? enBelow100(r) : '');
  }

  function enWhole(n) {
    if (n === 0) return 'Zero';
    var parts = [];
    var crore = Math.floor(n / 10000000);
    n %= 10000000;
    var lakh = Math.floor(n / 100000);
    n %= 100000;
    var thousand = Math.floor(n / 1000);
    n %= 1000;
    if (crore) parts.push(enWhole(crore) + ' Crore');
    if (lakh) parts.push(enBelow100(lakh) + ' Lakh');
    if (thousand) parts.push(enBelow100(thousand) + ' Thousand');
    if (n) parts.push(enBelow1000(n));
    return parts.join(' ');
  }

  // Kannada. 1-19 and the tens are listed; 21-99 join the tens stem and the
  // unit (ಇಪ್ಪತ್ತ + ಒಂದು = ಇಪ್ಪತ್ತೊಂದು). With more after them, hundreds,
  // thousands and lakhs take their joining form (ನೂರ, ಸಾವಿರದ, ಲಕ್ಷದ, ಕೋಟಿಯ).
  var KN_ONES = ['', 'ಒಂದು', 'ಎರಡು', 'ಮೂರು', 'ನಾಲ್ಕು', 'ಐದು', 'ಆರು', 'ಏಳು', 'ಎಂಟು', 'ಒಂಬತ್ತು', 'ಹತ್ತು',
    'ಹನ್ನೊಂದು', 'ಹನ್ನೆರಡು', 'ಹದಿಮೂರು', 'ಹದಿನಾಲ್ಕು', 'ಹದಿನೈದು', 'ಹದಿನಾರು', 'ಹದಿನೇಳು', 'ಹದಿನೆಂಟು', 'ಹತ್ತೊಂಬತ್ತು'];
  var KN_TENS = ['', '', 'ಇಪ್ಪತ್ತು', 'ಮೂವತ್ತು', 'ನಲವತ್ತು', 'ಐವತ್ತು', 'ಅರವತ್ತು', 'ಎಪ್ಪತ್ತು', 'ಎಂಬತ್ತು', 'ತೊಂಬತ್ತು'];
  // Unit endings after a tens stem ending in ತ್ತ: vowel signs join, 3 and 4 follow as they are.
  var KN_UNIT_JOIN = ['', 'ೊಂದು', 'ೆರಡು', 'ಮೂರು', 'ನಾಲ್ಕು', 'ೈದು', 'ಾರು', 'ೇಳು', 'ೆಂಟು', 'ೊಂಬತ್ತು'];
  var KN_HUNDREDS = ['', 'ನೂರು', 'ಇನ್ನೂರು', 'ಮುನ್ನೂರು', 'ನಾನೂರು', 'ಐನೂರು', 'ಆರುನೂರು', 'ಏಳುನೂರು', 'ಎಂಟುನೂರು', 'ಒಂಬೈನೂರು'];

  function knBelow100(n) {
    if (n < 20) return KN_ONES[n];
    var t = Math.floor(n / 10), u = n % 10;
    if (!u) return KN_TENS[t];
    return KN_TENS[t].slice(0, -1) + KN_UNIT_JOIN[u]; // drop the final ು of the tens word
  }

  function knBelow1000(n) {
    var h = Math.floor(n / 100), r = n % 100;
    if (!h) return knBelow100(r);
    if (!r) return KN_HUNDREDS[h];
    return KN_HUNDREDS[h].slice(0, -1) + ' ' + knBelow100(r); // ನೂರು → ನೂರ
  }

  function knWhole(n) {
    if (n === 0) return 'ಸೊನ್ನೆ';
    var crore = Math.floor(n / 10000000);
    var rest = n % 10000000;
    var lakh = Math.floor(rest / 100000);
    var thousand = Math.floor((rest % 100000) / 1000);
    var below = rest % 1000;
    var parts = [];
    if (crore) parts.push(knWhole(crore) + (rest ? ' ಕೋಟಿಯ' : ' ಕೋಟಿ'));
    if (lakh) parts.push(knBelow100(lakh) + (rest % 100000 ? ' ಲಕ್ಷದ' : ' ಲಕ್ಷ'));
    if (thousand) parts.push(knBelow100(thousand) + (below ? ' ಸಾವಿರದ' : ' ಸಾವಿರ'));
    if (below) parts.push(knBelow1000(below));
    return parts.join(' ');
  }

  function amountInWords(amount, lang) {
    var negative = amount < 0;
    var total = Math.round(Math.abs(amount) * 100);
    var rupees = Math.floor(total / 100), paise = total % 100;
    if (lang === 'kn') {
      return (negative ? 'ಮೈನಸ್ ' : '') + knWhole(rupees) + ' ರೂಪಾಯಿ' +
        (paise ? ' ' + knBelow100(paise) + ' ಪೈಸೆ' : '') + ' ಮಾತ್ರ';
    }
    return (negative ? 'Minus ' : '') + 'Rupees ' + enWhole(rupees) +
      (paise ? ' and ' + enBelow100(paise) + ' Paise' : '') + ' Only';
  }

  // ---------- Words ----------

  var DEFAULT_TEXT = {
    earningName: function (n) { return 'Earning ' + n + ': name'; },
    earningAmount: function (n) { return 'Earning ' + n + ': amount (₹)'; },
    deductionName: function (n) { return 'Deduction ' + n + ': name'; },
    deductionAmount: function (n) { return 'Deduction ' + n + ': amount (₹)'; },
    detailName: function (n) { return 'Detail ' + n + ': name'; },
    detailValue: function (n) { return 'Detail ' + n + ': value'; },
    remove: function (name) { return 'Remove ' + name; },
    unnamed: 'this row',
    workedOut: 'Calculated',
    needCompany: 'Enter the company name.',
    needEmployee: "Enter the employee's name.",
    needMonth: 'Choose the pay month.',
    needEarning: 'Enter at least one earning.',
    notNegative: 'Enter 0 or more.',
    lopTooMany: 'Days without pay are more than the days in the month.',
    logoType: 'Choose a PNG or JPG image.',
    logoSize: 'Choose an image of 1 MB or less.',
    checkErrors: 'Some details are missing. Check the fields marked above.',
    // Notes under the PF/ESI auto-fill. CALL is replaced by the call link.
    pfSeptNote: 'Calculating September 2026 pay? CALL first. The PF office has not yet said which limit (₹15,000 or ₹25,000) to use for that month.',
    esiAboveNote: function (limit) {
      return 'ESI wages are above ' + limit + ', so we left ESI blank. Was this employee already in ESI, and their pay went above the limit during the period? They may stay in ESI until the period ends (end of September or end of March). CALL to check.';
    },
    beforeNote: 'This tool calculates PF and ESI from September 2026. For earlier months, enter the amounts yourself, or CALL.',
    pfHalfNote: 'PF wages must be at least half the total pay. If they come to less, the difference is added to PF wages. Check the PF wages above. Not sure? CALL.',
    esiHalfNote: 'ESI wages must be at least half the total pay. If they come to less, the difference is added to ESI wages. Check the ESI wages above. Not sure? CALL.',
    printTitle: function (name, month) { return 'Payslip - ' + name + ' - ' + month; },
    callUs: 'call us',
    callUsStart: 'Call us'
  };

  var DEFAULT_SLIP = {
    title: 'Payslip for',
    companyPlaceholder: 'Company name',
    employeeName: 'Employee name',
    employeeId: 'Employee ID',
    designation: 'Designation',
    department: 'Department',
    joined: 'Date of joining',
    uan: 'UAN',
    ip: 'ESI IP number',
    pan: 'PAN',
    bank: 'Bank account',
    payDate: 'Pay date',
    paidDays: 'Paid days',
    lopDays: 'Days without pay (LOP)',
    earnings: 'Earnings',
    deductions: 'Deductions',
    amount: 'Amount',
    gross: 'Total earnings',
    totalDeductions: 'Total deductions',
    net: 'Net pay',
    netHint: 'Total earnings minus total deductions',
    words: 'Net pay in words',
    none: 'None',
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  };

  // Starting rows and suggested names. pf: counts towards PF wages (basic pay
  // plus DA); esiOut: left out of ESI wages (HRA, overtime, bonus, commission,
  // travel allowance), as the ESI calculator's help text says.
  var ROW_NAMES = {
    en: {
      basic: 'Basic pay', da: 'DA (dearness allowance)', hra: 'HRA (house rent allowance)',
      special: 'Special allowance', overtime: 'Overtime',
      bonus: 'Bonus', commission: 'Commission', travel: 'Travel allowance',
      pf: 'PF', esi: 'ESI', pt: 'Professional tax', tds: 'Income tax (TDS)', advance: 'Advance', loan: 'Loan'
    }
  };
  var ROW_KIND = {
    basic: { pf: true }, da: { pf: true }, hra: { esiOut: true }, overtime: { esiOut: true },
    bonus: { esiOut: true }, commission: { esiOut: true }, travel: { esiOut: true }
  };
  var EARNING_KEYS = ['basic', 'da', 'hra', 'special', 'overtime', 'bonus', 'commission', 'travel'];
  var DEDUCTION_KEYS = ['pf', 'esi', 'pt', 'tds', 'advance', 'loan'];

  function merge(base, extra) {
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    if (extra) Object.keys(extra).forEach(function (k) { out[k] = extra[k]; });
    return out;
  }

  // ---------- Storage (company details only; never employee data) ----------

  function loadStore() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveStore(data) {
    try {
      if (data) window.localStorage.setItem(STORE_KEY, JSON.stringify(data));
      else window.localStorage.removeItem(STORE_KEY);
    } catch (e) { /* storage blocked or full: the page works without it */ }
  }

  // ---------- The page ----------

  function initPayslipGenerator(config) {
    config = config || {};
    var form = document.getElementById('payslip-form');
    var slipEl = document.getElementById('payslip');
    if (!form || !slipEl) return;

    var T = merge(DEFAULT_TEXT, config.text);
    var pageLang = config.lang || 'en';
    var slipTexts = { en: DEFAULT_SLIP, kn: merge(DEFAULT_SLIP, config.slipText && config.slipText.kn) };
    var rowNames = { en: ROW_NAMES.en, kn: merge(ROW_NAMES.en, config.rowNames && config.rowNames.kn) };
    var callTel = form.getAttribute('data-tel') || 'tel:+918217542975';
    // The remove button's icon comes from the page (icon.html), in a <template>.
    var iconTpl = document.getElementById('ps-icon-remove');
    var removeIcon = iconTpl ? iconTpl.innerHTML : '×';

    function $(id) { return document.getElementById(id); }
    var els = {
      company: $('ps-company'), address: $('ps-address'), logo: $('ps-logo'), logoRemove: $('ps-logo-remove'),
      month: $('ps-month'), name: $('ps-name'), id: $('ps-id'), payDate: $('ps-pay-date'), lop: $('ps-lop'),
      paidOut: $('ps-paid-out'), paidChange: $('ps-paid-change'), paidField: $('ps-paid-field'), paid: $('ps-paid'),
      designation: $('ps-designation'), department: $('ps-department'), joined: $('ps-joined'), uan: $('ps-uan'),
      ip: $('ps-ip'), pan: $('ps-pan'), bank: $('ps-bank'),
      details: $('ps-details'), addDetail: $('ps-add-detail'),
      earnings: $('ps-earnings'), addEarning: $('ps-add-earning'),
      deductions: $('ps-deductions'), addDeduction: $('ps-add-deduction'),
      auto: $('ps-auto'), autoFields: $('ps-auto-fields'), pfWages: $('ps-pf-wages'), esiWages: $('ps-esi-wages'),
      pfFullField: $('ps-pf-full-field'), pwd: $('ps-pwd'), autoNotes: $('ps-auto-notes'),
      remember: $('ps-remember'), download: $('ps-download'), status: $('ps-status'),
      next: $('ps-next'), clear: $('ps-clear')
    };

    var state = { logo: '', paidEdited: false, pfWagesEdited: false, esiWagesEdited: false, rowSeq: 0 };

    function slipLang() {
      var r = form.querySelector('input[name="ps-slip-lang"]:checked');
      return r ? r.value : pageLang;
    }

    function num(el) {
      if (!el || el.value === '') return 0;
      var v = parseFloat(el.value);
      return isNaN(v) ? 0 : v;
    }

    // Which preset key a typed row name matches, in either language.
    function keyForName(name) {
      var n = String(name || '').trim().toLowerCase();
      if (!n) return '';
      var keys = EARNING_KEYS.concat(DEDUCTION_KEYS);
      for (var i = 0; i < keys.length; i++) {
        if (rowNames.en[keys[i]].toLowerCase() === n || rowNames.kn[keys[i]].toLowerCase() === n) return keys[i];
      }
      if (n === 'basic' || n === 'da' || n === 'hra') return n;
      return '';
    }

    // ---------- Rows ----------

    function rowLabels(list) {
      return list === 'earnings'
        ? [T.earningName, T.earningAmount]
        : list === 'deductions' ? [T.deductionName, T.deductionAmount] : [T.detailName, T.detailValue];
    }

    function relabel(listEl, list) {
      var labels = rowLabels(list);
      Array.prototype.forEach.call(listEl.children, function (li, i) {
        li.querySelector('.line-item__name-label').textContent = labels[0](i + 1);
        li.querySelector('.line-item__value-label').textContent = labels[1](i + 1);
        var nameVal = li.querySelector('.line-item__name').value.trim();
        li.querySelector('.line-item__remove').setAttribute('aria-label', T.remove(nameVal || T.unnamed));
      });
    }

    function addRow(list, name, value, opts) {
      opts = opts || {};
      var listEl = els[list];
      var n = ++state.rowSeq;
      var nameId = 'ps-row-' + n + '-name', valueId = 'ps-row-' + n + '-value';
      var isDetail = list === 'details';
      var li = document.createElement('li');
      li.className = 'line-item';
      if (opts.auto) li.setAttribute('data-auto', opts.auto);
      li.innerHTML =
        '<label class="visually-hidden line-item__name-label" for="' + nameId + '"></label>' +
        '<input type="text" class="line-item__name" id="' + nameId + '"' +
          (isDetail ? '' : ' list="ps-' + (list === 'earnings' ? 'earning' : 'deduction') + '-names"') +
          ' autocomplete="off" value="' + escapeHtml(name || '') + '">' +
        '<label class="visually-hidden line-item__value-label" for="' + valueId + '"></label>' +
        (isDetail
          ? '<input type="text" class="line-item__value" id="' + valueId + '" autocomplete="off" value="' + escapeHtml(value || '') + '">'
          : '<input type="number" class="line-item__value" id="' + valueId + '" inputmode="decimal" min="0" step="0.01" value="' + escapeHtml(value === undefined || value === null ? '' : value) + '" aria-describedby="' + valueId + '-tag ' + valueId + '-error">') +
        '<button type="button" class="line-item__remove">' + removeIcon + '</button>' +
        (isDetail ? '' :
          '<p class="line-item__tag" id="' + valueId + '-tag">' + (opts.auto ? escapeHtml(T.workedOut) : '') + '</p>' +
          '<p class="field__error line-item__error" id="' + valueId + '-error" aria-live="polite"></p>');
      listEl.appendChild(li);
      relabel(listEl, list);
      return li;
    }

    function removeRow(li) {
      var listEl = li.parentNode;
      var list = listEl.id === 'ps-earnings' ? 'earnings' : listEl.id === 'ps-deductions' ? 'deductions' : 'details';
      var next = li.nextElementSibling || li.previousElementSibling;
      li.remove();
      relabel(listEl, list);
      // Keep focus in the list: the next row's name, or the add button.
      var addBtn = list === 'earnings' ? els.addEarning : list === 'deductions' ? els.addDeduction : els.addDetail;
      (next ? next.querySelector('.line-item__name') : addBtn).focus();
      update();
    }

    function readRows(listEl) {
      return Array.prototype.map.call(listEl.children, function (li) {
        var valueEl = li.querySelector('.line-item__value');
        return {
          li: li,
          name: li.querySelector('.line-item__name').value.trim(),
          valueEl: valueEl,
          value: valueEl.type === 'number' ? num(valueEl) : valueEl.value.trim(),
          auto: li.getAttribute('data-auto') || ''
        };
      });
    }

    function setTag(li, on) {
      if (on) li.setAttribute('data-auto', li.getAttribute('data-auto') || 'on');
      var tag = li.querySelector('.line-item__tag');
      if (tag) tag.textContent = on ? T.workedOut : '';
    }

    // ---------- PF / ESI auto-fill ----------

    function autoRow(kind) {
      var li = els.deductions.querySelector('[data-auto="' + kind + '"]');
      if (li) return li;
      // A PF / ESI row the user typed over is theirs: leave it. With no such
      // row at all, add one. (Turning the switch on takes over matching rows.)
      var owned = readRows(els.deductions).some(function (r) { return keyForName(r.name) === kind; });
      return owned ? null : addRow('deductions', rowNames[slipLang()][kind], '', { auto: kind });
    }

    function runAuto(earningRows, gross) {
      els.autoNotes.innerHTML = '';
      if (!els.auto.checked) return;

      var pfBase = 0, esiOut = 0;
      earningRows.forEach(function (r) {
        var kind = ROW_KIND[keyForName(r.name)] || {};
        if (kind.pf) pfBase += r.value;
        if (kind.esiOut) esiOut += r.value;
      });
      if (!state.pfWagesEdited) els.pfWages.value = pfBase ? round2(pfBase) : '';
      if (!state.esiWagesEdited) els.esiWages.value = gross ? round2(Math.max(0, gross - esiOut)) : '';

      var pfWages = num(els.pfWages), esiWages = num(els.esiWages);
      var rateEl = form.querySelector('input[name="ps-pf-rate"]:checked');
      var rate = rateEl && rateEl.value === '10' ? 10 : 12;
      els.pfFullField.hidden = !(pfWages > PF_WAGE_CEILING);
      var fullEl = form.querySelector('input[name="ps-pf-base"]:checked');
      var full = !els.pfFullField.hidden && fullEl && fullEl.value === 'full';
      var pwd = els.pwd.checked;

      var call = function (start) {
        return '<a href="' + callTel + '" data-call-location="result">' + escapeHtml(start ? T.callUsStart : T.callUs) + '</a>';
      };
      var notes = [];
      var pfLi = autoRow('pf'), esiLi = autoRow('esi');

      // The limits above are the rules from September 2026 (the ₹25,000 PF
      // limit started on 17 September 2026). For earlier months the tool
      // fills in nothing and asks the user to call.
      if (els.month.value && els.month.value < FIRST_AUTO_MONTH) {
        [pfLi, esiLi].forEach(function (li) {
          if (!li) return;
          li.querySelector('.line-item__value').value = '';
          setTag(li, false);
        });
        els.autoNotes.innerHTML = '<p class="result-note">' + T.beforeNote.replace('CALL', call(false)) + '</p>';
        return;
      }

      var limit = pwd ? ESI_CEILING_PWD : ESI_CEILING;
      if (pfLi) {
        pfLi.querySelector('.line-item__value').value = pfWages ? pfShare(pfWages, rate, full) : '';
        setTag(pfLi, true);
      }
      if (esiLi) {
        // Above the limit the amount is left blank, not 0: the employee may
        // still be in ESI until the contribution period ends (open item).
        esiLi.querySelector('.line-item__value').value = esiWages && esiWages <= limit ? esiShare(esiWages, pwd) : '';
        setTag(esiLi, true);
      }

      if (pfWages > PF_OLD_CEILING && els.month.value === '2026-09') notes.push(T.pfSeptNote.replace('CALL', call(true)));
      // 50% rule: PF/ESI wages must be at least half the total pay. The tool
      // doesn't add the difference itself; it points it out.
      if (gross && pfWages && pfWages < gross / 2) notes.push(T.pfHalfNote.replace('CALL', call(true)));
      if (gross && esiWages && esiWages <= limit && esiWages < gross / 2) notes.push(T.esiHalfNote.replace('CALL', call(true)));
      if (esiWages > limit) notes.push(T.esiAboveNote('₹' + limit.toLocaleString('en-IN')).replace('CALL', call(true)));
      els.autoNotes.innerHTML = notes.map(function (n) { return '<p class="result-note">' + n + '</p>'; }).join('');
    }

    // ---------- Paid days ----------

    function currentPaidDays() {
      if (state.paidEdited) return num(els.paid);
      return paidDays(els.month.value, num(els.lop));
    }

    // ---------- Preview ----------

    function formatMonth(ym, S) {
      var m = /^(\d{4})-(\d{2})$/.exec(ym || '');
      return m ? S.months[Number(m[2]) - 1] + ' ' + m[1] : '';
    }

    function formatDate(iso, S) {
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
      return m ? Number(m[3]) + ' ' + S.months[Number(m[2]) - 1] + ' ' + m[1] : '';
    }

    function formatDays(n) {
      return String(round2(n)).replace(/\.0+$/, '');
    }

    function moneyRows(rows, S) {
      var shown = rows.filter(function (r) { return r.name || r.valueEl.value !== ''; });
      if (!shown.length) return '<tr><th scope="row" class="payslip__muted">' + escapeHtml(S.none) + '</th><td></td></tr>';
      return shown.map(function (r) {
        // An amount left blank shows as "-", not ₹0.00, so it reads as not filled in.
        var amount = r.valueEl.value === '' ? '<span class="payslip__muted">-</span>' : formatINR(r.value);
        return '<tr><th scope="row">' + escapeHtml(r.name || '-') + '</th><td>' + amount + '</td></tr>';
      }).join('');
    }

    function render(earningRows, deductionRows, gross, totalDed, net) {
      var lang = slipLang();
      var S = slipTexts[lang];
      slipEl.setAttribute('lang', lang);

      var company = els.company.value.trim();
      var address = els.address.value.trim();
      var details = [
        [S.employeeName, els.name.value.trim()],
        [S.employeeId, els.id.value.trim()],
        [S.designation, els.designation.value.trim()],
        [S.department, els.department.value.trim()],
        [S.joined, formatDate(els.joined.value, S)],
        [S.payDate, formatDate(els.payDate.value, S)],
        [S.paidDays, els.month.value ? formatDays(currentPaidDays()) : ''],
        [S.lopDays, num(els.lop) ? formatDays(num(els.lop)) : ''],
        [S.uan, els.uan.value.trim()],
        [S.ip, els.ip.value.trim()],
        [S.pan, els.pan.value.trim().toUpperCase()],
        [S.bank, els.bank.value.trim()]
      ];
      readRows(els.details).forEach(function (r) { if (r.name || r.value) details.push([r.name || '-', r.value]); });
      // Name always shows (as a gap to fill); the rest only when filled in.
      details = details.filter(function (d, i) { return i < 1 || d[1]; });

      var html =
        '<div class="payslip__head">' +
          '<div class="payslip__company">' +
            (state.logo ? '<img class="payslip__logo" src="' + state.logo + '" alt="">' : '') +
            '<div><p class="payslip__name' + (company ? '' : ' payslip__muted') + '">' + escapeHtml(company || S.companyPlaceholder) + '</p>' +
            (address ? '<p class="payslip__address">' + escapeHtml(address).replace(/\n/g, '<br>') + '</p>' : '') + '</div>' +
          '</div>' +
          '<p class="payslip__title"><span>' + escapeHtml(S.title) + '</span> <strong>' + escapeHtml(formatMonth(els.month.value, S)) + '</strong></p>' +
        '</div>' +
        '<dl class="payslip__details">' + details.map(function (d) {
          return '<div><dt>' + escapeHtml(d[0]) + '</dt><dd>' + (d[1] ? escapeHtml(d[1]) : '<span class="payslip__muted">-</span>') + '</dd></div>';
        }).join('') + '</dl>' +
        '<div class="payslip__tables">' +
          '<table class="payslip__table"><thead><tr><th scope="col">' + escapeHtml(S.earnings) + '</th><th scope="col">' + escapeHtml(S.amount) + '</th></tr></thead>' +
            '<tbody>' + moneyRows(earningRows, S) + '</tbody>' +
            '<tfoot><tr><th scope="row">' + escapeHtml(S.gross) + '</th><td>' + formatINR(gross) + '</td></tr></tfoot></table>' +
          '<table class="payslip__table"><thead><tr><th scope="col">' + escapeHtml(S.deductions) + '</th><th scope="col">' + escapeHtml(S.amount) + '</th></tr></thead>' +
            '<tbody>' + moneyRows(deductionRows, S) + '</tbody>' +
            '<tfoot><tr><th scope="row">' + escapeHtml(S.totalDeductions) + '</th><td>' + formatINR(totalDed) + '</td></tr></tfoot></table>' +
        '</div>' +
        '<div class="payslip__net"><p><span class="payslip__net-label">' + escapeHtml(S.net) + '</span>' +
          '<span class="payslip__net-hint">' + escapeHtml(S.netHint) + '</span></p>' +
          '<p class="payslip__net-amount">' + formatINR(net) + '</p></div>' +
        '<p class="payslip__words"><span>' + escapeHtml(S.words) + ':</span> ' + escapeHtml(amountInWords(net, lang)) + '</p>';
      slipEl.innerHTML = html;
    }

    // ---------- Update cycle ----------

    function update() {
      var lop = num(els.lop);
      els.paidOut.textContent = els.month.value ? formatDays(paidDays(els.month.value, lop)) : '';

      var earningRows = readRows(els.earnings);
      var gross = round2(earningRows.reduce(function (s, r) { return s + r.value; }, 0));
      runAuto(earningRows, gross);
      var deductionRows = readRows(els.deductions);
      var totalDed = round2(deductionRows.reduce(function (s, r) { return s + r.value; }, 0));
      render(earningRows, deductionRows, gross, totalDed, round2(gross - totalDed));
      remember();
    }

    // ---------- Validation (only on Download) ----------

    function setError(input, errorEl, message) {
      if (errorEl) errorEl.textContent = message || '';
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }

    function validate() {
      var ok = true;
      function req(input, message) {
        var bad = !input.value.trim();
        setError(input, $(input.id + '-error'), bad ? message : '');
        if (bad) ok = false;
      }
      req(els.company, T.needCompany);
      req(els.month, T.needMonth);
      req(els.name, T.needEmployee);

      var lopBad = num(els.lop) < 0 ? T.notNegative
        : els.month.value && num(els.lop) > daysInMonth(els.month.value) ? T.lopTooMany : '';
      setError(els.lop, $('ps-lop-error'), lopBad);
      if (lopBad) ok = false;

      var anyEarning = false;
      ['earnings', 'deductions'].forEach(function (list) {
        readRows(els[list]).forEach(function (r) {
          var bad = r.valueEl.value !== '' && (isNaN(parseFloat(r.valueEl.value)) || parseFloat(r.valueEl.value) < 0);
          setError(r.valueEl, $(r.valueEl.id + '-error'), bad ? T.notNegative : '');
          if (bad) ok = false;
          if (list === 'earnings' && r.value > 0) anyEarning = true;
        });
      });
      if (!anyEarning) {
        var first = els.earnings.querySelector('.line-item__value');
        if (first) setError(first, $(first.id + '-error'), T.needEarning);
        else els.addEarning.setAttribute('aria-invalid', 'true');
        ok = false;
      } else {
        els.addEarning.removeAttribute('aria-invalid');
      }
      return ok;
    }

    function clearErrors() {
      Array.prototype.forEach.call(form.querySelectorAll('[aria-invalid="true"]'), function (el) {
        setError(el, $(el.id + '-error'), '');
      });
      els.status.textContent = '';
    }

    // ---------- Remember (company details and row names only) ----------

    function remember() {
      if (!els.remember.checked) return;
      saveStore({
        company: els.company.value,
        address: els.address.value,
        logo: state.logo,
        earnings: readRows(els.earnings).map(function (r) { return r.name; }),
        deductions: readRows(els.deductions).map(function (r) { return r.name; })
      });
    }

    // ---------- Starting state ----------

    function lastMonth() {
      var d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - 1);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    }

    function fillRows(list, names) {
      els[list].innerHTML = '';
      names.forEach(function (name) { addRow(list, name, ''); });
    }

    function startRows(stored) {
      var names = rowNames[pageLang];
      fillRows('earnings', stored && stored.earnings && stored.earnings.length ? stored.earnings : [names.basic, names.hra]);
      fillRows('deductions', stored && stored.deductions && stored.deductions.length ? stored.deductions : [names.pf, names.esi]);
    }

    function setLogo(dataUrl) {
      state.logo = dataUrl || '';
      els.logoRemove.hidden = !state.logo;
    }

    function clearEmployee() {
      ['name', 'id', 'designation', 'department', 'joined', 'uan', 'ip', 'pan', 'bank', 'payDate'].forEach(function (k) { els[k].value = ''; });
      els.lop.value = '0';
      state.paidEdited = false;
      els.paidField.hidden = true;
      els.paid.value = '';
      els.paidChange.hidden = false;
      readRows(els.details).forEach(function (r) { r.valueEl.value = ''; });
      ['earnings', 'deductions'].forEach(function (list) {
        readRows(els[list]).forEach(function (r) { r.valueEl.value = ''; });
      });
      state.pfWagesEdited = false;
      state.esiWagesEdited = false;
      els.pfWages.value = '';
      els.esiWages.value = '';
    }

    // ---------- Events ----------

    form.addEventListener('submit', function (e) { e.preventDefault(); });

    form.addEventListener('input', function (e) {
      var t = e.target;
      if (t === els.pfWages) state.pfWagesEdited = true;
      if (t === els.esiWages) state.esiWagesEdited = true;
      if (t === els.paid) state.paidEdited = true;
      if (t.classList.contains('line-item__value') && t.closest('[data-auto]')) {
        // Typed over a worked-out amount: it is the user's own from now on.
        var li = t.closest('[data-auto]');
        li.removeAttribute('data-auto');
        setTag(li, false);
      }
      if (t.classList.contains('line-item__name')) {
        var list = t.closest('ul');
        relabel(list, list.id === 'ps-earnings' ? 'earnings' : list.id === 'ps-deductions' ? 'deductions' : 'details');
      }
      if (t.getAttribute('aria-invalid') === 'true' && t.value !== '') setError(t, $(t.id + '-error'), '');
      update();
    });

    form.addEventListener('change', function (e) {
      var t = e.target;
      if (t === els.auto) {
        els.autoFields.hidden = !els.auto.checked;
        if (!els.auto.checked) {
          Array.prototype.forEach.call(els.deductions.querySelectorAll('[data-auto]'), function (li) {
            li.removeAttribute('data-auto');
            setTag(li, false);
          });
        } else {
          // Turning it on again takes over the PF and ESI rows.
          readRows(els.deductions).forEach(function (r) {
            var k = keyForName(r.name);
            if ((k === 'pf' || k === 'esi') && !els.deductions.querySelector('[data-auto="' + k + '"]')) r.li.setAttribute('data-auto', k);
          });
        }
      }
      if (t.name === 'ps-slip-lang') {
        // Starting row names follow the payslip language; typed names stay.
        var from = t.value === 'kn' ? 'en' : 'kn';
        ['earnings', 'deductions'].forEach(function (list) {
          readRows(els[list]).forEach(function (r) {
            var k = keyForName(r.name);
            if (k && rowNames[from][k] === r.name) r.li.querySelector('.line-item__name').value = rowNames[t.value][k];
          });
          relabel(els[list], list);
        });
      }
      if (t === els.remember && !els.remember.checked) saveStore(null);
      if (t === els.logo) readLogo();
      update();
    });

    function readLogo() {
      var file = els.logo.files && els.logo.files[0];
      var errEl = $('ps-logo-error');
      if (!file) return;
      if (!/^image\/(png|jpeg)$/.test(file.type)) {
        setError(els.logo, errEl, T.logoType);
        els.logo.value = '';
        return;
      }
      if (file.size > LOGO_MAX_BYTES) {
        setError(els.logo, errEl, T.logoSize);
        els.logo.value = '';
        return;
      }
      setError(els.logo, errEl, '');
      var reader = new FileReader();
      reader.onload = function () {
        setLogo(reader.result);
        update();
      };
      reader.readAsDataURL(file);
    }

    els.logoRemove.addEventListener('click', function () {
      setLogo('');
      els.logo.value = '';
      els.logo.focus();
      update();
    });

    els.paidChange.addEventListener('click', function () {
      els.paidField.hidden = false;
      els.paidChange.hidden = true;
      if (!state.paidEdited) els.paid.value = els.month.value ? formatDays(paidDays(els.month.value, num(els.lop))) : '';
      els.paid.focus();
    });

    form.addEventListener('click', function (e) {
      var btn = e.target.closest('.line-item__remove');
      if (btn) removeRow(btn.closest('.line-item'));
    });

    function addAndFocus(list) {
      var li = addRow(list, '', '');
      if (list === 'earnings') els.addEarning.removeAttribute('aria-invalid');
      li.querySelector('.line-item__name').focus();
      update();
    }
    els.addEarning.addEventListener('click', function () { addAndFocus('earnings'); });
    els.addDeduction.addEventListener('click', function () { addAndFocus('deductions'); });
    els.addDetail.addEventListener('click', function () { addAndFocus('details'); });

    els.download.addEventListener('click', function () {
      update();
      if (!validate()) {
        els.status.textContent = T.checkErrors;
        var bad = form.querySelector('[aria-invalid="true"]');
        if (bad) {
          var more = bad.closest('details');
          if (more) more.open = true;
          bad.focus();
        }
        return;
      }
      els.status.textContent = '';
      // The PDF file name comes from the page title: "Payslip - Asha Rao - October 2026".
      var pageTitle = document.title;
      document.title = T.printTitle(els.name.value.trim(), formatMonth(els.month.value, slipTexts[slipLang()]));
      window.addEventListener('afterprint', function restore() {
        document.title = pageTitle;
        window.removeEventListener('afterprint', restore);
      });
      window.print();
    });

    els.next.addEventListener('click', function () {
      clearEmployee();
      clearErrors();
      update();
      els.name.focus();
    });

    els.clear.addEventListener('click', function () {
      clearEmployee();
      clearErrors();
      els.company.value = '';
      els.address.value = '';
      els.logo.value = '';
      setLogo('');
      els.month.value = lastMonth();
      els.details.innerHTML = '';
      els.auto.checked = false;
      els.autoFields.hidden = true;
      startRows(null);
      saveStore(null);
      update();
      els.company.focus();
    });

    // ---------- Start ----------

    var stored = loadStore();
    if (stored) {
      els.company.value = stored.company || '';
      els.address.value = stored.address || '';
      setLogo(stored.logo || '');
    } else {
      setLogo('');
    }
    if (!els.month.value) els.month.value = lastMonth();
    els.autoFields.hidden = !els.auto.checked;
    startRows(stored);
    update();
  }

  window.PayslipGenerator = {
    amountInWords: amountInWords,
    paidDays: paidDays,
    daysInMonth: daysInMonth,
    pfShare: pfShare,
    esiShare: esiShare,
    formatINR: formatINR
  };
  window.initPayslipGenerator = initPayslipGenerator;
})(window);
