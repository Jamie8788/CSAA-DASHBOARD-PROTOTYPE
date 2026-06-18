/**
 * Mino Bimaadiziwin Atlas — Sheet Sync (Google Apps Script)
 * =========================================================
 * ADD THIS AS A SEPARATE FILE — do NOT delete or change the existing
 * "Change Tracker" (Code.gs) script. This file only adds ONE new function,
 * syncToAtlas(), with its own uniquely-named config, so it can't collide with
 * anything already in the project. There is intentionally NO onOpen() here
 * (your Change Tracker already defines one).
 *
 * It runs INSIDE your sheet as you, so it needs NO sharing and NO API key —
 * it works even when the organization blocks external sharing. It reads every
 * tab, every cell, and every in-cell link, then posts the data to the
 * dashboard, which rebuilds the atlas with all links preserved.
 *
 * SETUP (one time)
 * ----------------
 * 1. In the Apps Script editor, click the + next to "Files" → "Script",
 *    name it  AtlasSync  (this creates AtlasSync.gs — your old Code.gs stays).
 * 2. Paste THIS whole file into AtlasSync.gs and Save.
 * 3. Set ATLAS_SYNC_TOKEN below to the same secret you put in Render
 *    (GSCRIPT_SYNC_TOKEN). ATLAS_SYNC_URL is already correct.
 * 4. In the function dropdown at the top, choose  syncToAtlas  → click Run.
 *    Approve the permission prompt (your own script on your own sheet).
 * 5. Done. Re-run syncToAtlas whenever you edit the sheet.
 *
 * (Optional) To get a menu without touching your Change Tracker's onOpen,
 * add this ONE line inside your existing onOpen() function in Code.gs:
 *     SpreadsheetApp.getUi().createMenu('Atlas').addItem('Sync to Atlas','syncToAtlas').addToUi();
 */

var ATLAS_SYNC_URL   = 'https://mino-bimaadiziwin-atlas.onrender.com/api/communities/import-gscript';
var ATLAS_SYNC_TOKEN = 'PASTE-THE-SAME-SECRET-YOU-PUT-IN-RENDER';

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
          var whole = rtv.getLinkUrl();
          if (whole) links.push(whole);
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

  var resp = UrlFetchApp.fetch(ATLAS_SYNC_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Sync-Token': ATLAS_SYNC_TOKEN },
    payload: JSON.stringify(out),
    muteHttpExceptions: true,
  });

  var code = resp.getResponseCode();
  var body = resp.getContentText();
  Logger.log(code + ' — ' + body);
  try {
    ss.toast(code === 200 ? ('Synced ✓ ' + body)
                          : ('Failed (' + code + '): ' + body),
             'Atlas Sync', 8);
  } catch (e) {}
}
