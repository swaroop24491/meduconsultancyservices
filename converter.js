/*
 * EPF Excel to Text (ECR) converter, used by /epf-excel-to-text-converter.
 * SheetJS (xlsx 0.20.3, self-hosted in /assets) is loaded only when needed:
 * when a file is chosen, or at the latest when the button is pressed. 0.20.3
 * fixes the published issues in 0.18.5 and gives byte-identical output.
 *
 * The conversion is unchanged from the old inline script: first sheet, cell
 * values (so UANs stay whole and commas in names are kept), heading row
 * skipped, empty rows dropped, cells joined with #~#, rows with new lines,
 * file name without spaces. Messages show on the page (role="status")
 * instead of browser pop-ups.
 */
(function () {
  'use strict';

  var MESSAGES = {
    noFile: 'Choose your Excel file first.',
    done: 'Done. Check your Downloads folder for the text file.',
    error: "We couldn't read this file. Check that it is an .xls or .xlsx file.",
    loadError: "The converter didn't load. Check your internet connection and try again."
  };

  var SHEETJS_SRC = '/assets/xlsx-0.20.3.full.min.js';
  var sheetjsLoading = null;

  function loadSheetJS() {
    if (window.XLSX) return Promise.resolve();
    if (!sheetjsLoading) {
      sheetjsLoading = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = SHEETJS_SRC;
        s.onload = resolve;
        s.onerror = function () { sheetjsLoading = null; reject(); };
        document.head.appendChild(s);
      });
    }
    return sheetjsLoading;
  }

  function setStatus(message, isError) {
    var el = document.getElementById('converter-status');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('tool-status--error', !!isError);
  }

  function convertEPF() {
    const input = document.getElementById('fileInput').files[0];
    if (!input) {
      setStatus(MESSAGES.noFile, true);
      document.getElementById('fileInput').focus(); // same rule as the other tools: focus the field to fix
      return;
    }
    setStatus('');

    const reader = new FileReader();
    reader.onload = function (event) {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Process first sheet of Excel file
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Read the cell values, not the text Excel shows, so UANs stay
        // whole (not 1.00123E+11) and commas in names or numbers are kept.
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '', blankrows: false })
          .slice(1) // Remove header row
          .map(row => row.map(cell => String(cell).replace(/[\r\n\t]+/g, ' ').trim()))
          .filter(row => row.some(cell => cell !== '')); // Remove empty rows

        // Join fields with #~# and rows with new lines
        let formattedText = rows.map(row => row.join('#~#')).join('\n');

        // Save the formatted text file
        const blob = new Blob([formattedText], { type: 'text/plain' });
        const filename = input.name.replace(/\s+/g, '').replace(/\.[^/.]+$/, '') + '.txt'; // Remove spaces in filename
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();

        setStatus(MESSAGES.done);
      } catch (error) {
        setStatus(MESSAGES.error, true);
      }
    };
    reader.readAsArrayBuffer(input);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('converter-form');
    if (!form) return;
    // Start loading SheetJS as soon as a file is chosen
    document.getElementById('fileInput').addEventListener('change', function () {
      loadSheetJS().catch(function () {});
    });
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!document.getElementById('fileInput').files[0]) {
        convertEPF(); // shows "Choose your Excel file first."
        return;
      }
      loadSheetJS().then(convertEPF, function () {
        setStatus(MESSAGES.loadError, true);
      });
    });
  });
})();
