/**
 * Mino Bimaadiziwin Atlas — Sheet Sync (Google Apps Script)
 * =========================================================
 * Runs INSIDE your Google Sheet, as you. Because it runs as the signed-in
 * user who already has access, it needs NO link-sharing and NO service
 * account — so it works even when the organization blocks external sharing.
 *
 * It reads every tab, every cell, AND every in-cell link (getRichTextValues →
 * each run's getLinkUrl), then posts the data to the dashboard, which rebuilds
 * the atlas with all links preserved.
 *
 * SETUP (one time)
 * ----------------
 * 1. Open your Google Sheet → Extensions → Apps Script.
 * 2. Delete whatever is there, paste THIS whole file, and Save.
 * 3. Set the two values below: ATLAS_URL and SYNC_TOKEN.
 *    - SYNC_TOKEN must match the GSCRIPT_SYNC_TOKEN you set in Render
 *      (any long random string — make one up, put the same value both places).
 * 4. Click Run ▸ syncToAtlas. Approve the permission prompt (it's your own
 *    script on your own sheet).
 * 5. Done — the dashboard updates. Re-run any time you edit the sheet, or use
 *    the "⟳ Sync to Atlas" menu that appears in the sheet after the first run.
 */

var ATLAS_URL  = 'https://mino-bimaadiziwin-atlas.onrender.com/api/communities/import-gscript';
var SYNC_TOKEN = 'PASTE-THE-SAME-SECRET-YOU-PUT-IN-RENDER';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Atlas')
    .addItem('⟳ Sync to Atlas', 'syncToAtlas')
    .addToUi();
}

function syncToAtlas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var out = { sheets: [] };

  ss.getSheets().forEach(function (sheet) {
    var range = sheet.getDataRange();
    if (!range) return;
    var display = range.getDisplayValues();
    var rich = range.getRichTextValues();
    var rows = [];

    for (var r = 0; r < display.length; r++) {
      var row = [];
      for (var c = 0; c < display[r].length; c++) {
        var links = [];
        var rtv = rich[r][c];
        if (rtv) {
          // Whole-cell link (if any)
          var whole = rtv.getLinkUrl();
          if (whole) links.push(whole);
          // Per-run links (the multiple in-cell links .xlsx export drops)
          var runs = rtv.getRuns();
          for (var i = 0; i < runs.length; i++) {
            var u = runs[i].getLinkUrl();
            if (u && links.indexOf(u) === -1) links.push(u);
          }
        }
        row.push({ v: display[r][c], links: links });
      }
      rows.push(row);
    }
    out.sheets.push({ title: sheet.getName(), rows: rows });
  });

  var resp = UrlFetchApp.fetch(ATLAS_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Sync-Token': SYNC_TOKEN },
    payload: JSON.stringify(out),
    muteHttpExceptions: true,
  });

  var code = resp.getResponseCode();
  var body = resp.getContentText();
  Logger.log(code + ' — ' + body);
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      code === 200 ? ('Synced ✓ ' + body) : ('Failed (' + code + '): ' + body),
      'Atlas Sync', 8);
  } catch (e) {}
}
