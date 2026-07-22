/**
 * Zhukovsky fact-check for Google Docs.
 *
 * Sends the essay (or a selection) to the Supabase `factcheck` edge function and
 * marks inaccuracies at one of three levels:
 *   1. Highlight mistakes            — spans only (student finds the error)
 *   2. Highlight + comments          — spans + a note on WHAT is wrong (a hint)
 *   3. Highlight + corrections       — spans + the corrected fact
 *
 * Notes are written as a numbered "Zhukovsky notes" list appended to the end of
 * the document, keyed by the quoted phrase. (Google's native anchored-comment API
 * fails silently in bound scripts, so this reliable approach is used instead.)
 *
 * Setup: see README.md — set Script Properties FACTCHECK_URL + FACTCHECK_SECRET.
 */

// ── Settings ────────────────────────────────────────────────────────────────
var FACTCHECK_URL = 'https://prmpzclkdjtrphsemrgm.functions.supabase.co/factcheck';
// The secret lives in SCRIPT PROPERTIES, not in this file, so pasting a code
// update never wipes it. Set it once:
//   Project Settings → Script Properties → Add: FACTCHECK_SECRET = <your secret>
// ────────────────────────────────────────────────────────────────────────────

var HIGHLIGHT_COLOR = '#fff1b8';            // soft amber — a flagged error
var CORRECT_COLOR = '#c8f7d0';              // light green — a fix applied in place
var NOTES_HEADING = '— Zhukovsky notes —';  // sentinel so we can find/clear the block

// Runs when a doc is opened with the add-on installed, and on install.
function onOpen() {
  DocumentApp.getUi()
    .createMenu('Zhukovsky')
    .addItem('1 · Highlight mistakes', 'runHighlight')
    .addItem('2 · Highlight + comments', 'runComment')
    .addItem('3 · Highlight + corrections', 'runCorrect')
    .addSeparator()
    .addItem('Clear Zhukovsky marks', 'clearMarks')
    .addToUi();
}

function onInstall(e) { onOpen(e); }

function runHighlight() { runFactcheck('highlight'); }
function runComment()   { runFactcheck('comment'); }
function runCorrect()   { runFactcheck('correct'); }

function runFactcheck(mode) {
  var ui = DocumentApp.getUi();
  var url = FACTCHECK_URL;
  var secret = PropertiesService.getScriptProperties().getProperty('FACTCHECK_SECRET');
  if (!secret) {
    ui.alert('One-time setup: in the Apps Script project go to Project Settings → Script Properties and add FACTCHECK_SECRET with your secret value.');
    return;
  }

  var doc = DocumentApp.getActiveDocument();
  var body = doc.getBody();

  // If text is selected, check only that (use this for long documents);
  // otherwise check the whole doc, excluding this tool's own notes block.
  var target = getTargetText(doc, body);
  var text = target.text;
  if (!text || text.trim().length < 40) {
    ui.alert(target.isSelection
      ? 'That selection is too short to check — select a bit more.'
      : 'There is not enough text to check.');
    return;
  }

  var resp;
  try {
    resp = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-factcheck-secret': secret },
      payload: JSON.stringify({ text: text }),
      muteHttpExceptions: true,
    });
  } catch (err) {
    ui.alert('Could not reach the fact-check service: ' + err);
    return;
  }

  var code = resp.getResponseCode();
  if (code !== 200) {
    var msg = code;
    try { msg = JSON.parse(resp.getContentText()).error || code; } catch (e) {}
    ui.alert('Fact-check failed (' + code + '): ' + msg);
    return;
  }

  var scopeNote = target.isSelection ? ' (your selection only)' : '';
  var issues = (JSON.parse(resp.getContentText()).issues) || [];
  if (issues.length === 0) {
    ui.alert('Zhukovsky found no clear factual errors' + scopeNote + '.\n\n(Silence is the normal result — it means nothing is checkably wrong, not that the essay is perfect.)');
    return;
  }

  // Clear any previous marks first so re-runs don't stack.
  clearMarksSilent(body);

  var placed = 0;
  var unlocated = [];
  var notes = []; // { n, quote, detail }

  issues.forEach(function (issue) {
    // Match the full quote first (needed to apply a fix); fall back to the short anchor.
    var loc = findSpan(body, issue.quote);
    var matchedFull = !!loc;
    if (!loc) loc = findSpan(body, issue.anchor);
    if (!loc) { unlocated.push(issue); return; }

    var canFix = mode === 'correct' && matchedFull
      && issue.replacement && issue.replacement !== issue.quote;

    if (canFix) {
      // Swap the wrong text for the corrected version, in place, and highlight green.
      var repl = issue.replacement;
      loc.text.deleteText(loc.start, loc.end);
      loc.text.insertText(loc.start, repl);
      loc.text.setBackgroundColor(loc.start, loc.start + repl.length - 1, CORRECT_COLOR);
      placed++;
      notes.push({ n: placed, quote: shorten(issue.quote), detail: '→ “' + repl + '”' });
    } else {
      loc.text.setBackgroundColor(loc.start, loc.end, HIGHLIGHT_COLOR);
      placed++;
      if (mode !== 'highlight') {
        var detail = mode === 'correct'
          ? (issue.correction || issue.why || '')  // couldn't fix in place → show the correction
          : (issue.why || issue.correction || '');
        notes.push({ n: placed, quote: shorten(issue.quote), detail: detail });
      }
    }
  });

  if (notes.length) appendNotes(body, notes);

  var verb = mode === 'correct' ? 'fixed' : 'highlighted';
  var summary = 'Zhukovsky ' + verb + ' ' + placed + ' possible '
    + (placed === 1 ? 'error' : 'errors') + scopeNote + '.';
  if (mode === 'correct') summary += '\nChanges are highlighted green; see "Zhukovsky notes" at the end for what changed.';
  else if (mode !== 'highlight') summary += '\nSee the numbered "Zhukovsky notes" at the end of the document.';
  if (unlocated.length) {
    summary += '\n\nCould not locate ' + unlocated.length + ' in the text:\n'
      + unlocated.map(function (i) { return '• "' + i.anchor + '" — ' + i.correction; }).join('\n');
  }
  ui.alert(summary);
}

/**
 * What to fact-check: the user's selection if there is one (handles partially
 * selected paragraphs), otherwise the whole body minus the notes block.
 */
function getTargetText(doc, body) {
  var sel = doc.getSelection();
  if (sel) {
    var parts = [];
    sel.getRangeElements().forEach(function (re) {
      var el = re.getElement();
      if (!el.editAsText) return;
      var t = el.asText();
      parts.push(re.isPartial()
        ? t.getText().substring(re.getStartOffset(), re.getEndOffsetInclusive() + 1)
        : t.getText());
    });
    var joined = parts.join('\n').trim();
    if (joined) return { text: joined, isSelection: true };
  }
  return { text: textBeforeNotes(body), isSelection: false };
}

/** Body text up to (not including) any existing Zhukovsky notes block. */
function textBeforeNotes(body) {
  var idx = notesHeadingIndex(body);
  if (idx < 0) return body.getText();
  var parts = [];
  for (var i = 0; i < idx; i++) {
    var child = body.getChild(i);
    if (child.editAsText) parts.push(child.asText().getText());
  }
  return parts.join('\n');
}

/** Append the numbered notes list at the end of the document. */
function appendNotes(body, notes) {
  body.appendParagraph(''); // spacer
  body.appendParagraph(NOTES_HEADING).editAsText().setBold(true);
  notes.forEach(function (note) {
    body.appendParagraph(note.n + '. “' + note.quote + '” — ' + note.detail);
  });
}

/** Index of the notes-heading paragraph, or -1. */
function notesHeadingIndex(body) {
  var n = body.getNumChildren();
  for (var i = 0; i < n; i++) {
    var child = body.getChild(i);
    if (child.getType() === DocumentApp.ElementType.PARAGRAPH
        && child.asParagraph().getText() === NOTES_HEADING) {
      return i;
    }
  }
  return -1;
}

/** Locate `needle` in the body. Returns { text, start, end } or null. */
function findSpan(body, needle) {
  if (!needle) return null;
  var found = body.findText(escapeForFindText(needle));
  if (!found) return null;
  return {
    text: found.getElement().asText(),
    start: found.getStartOffset(),
    end: found.getEndOffsetInclusive(),
  };
}

function shorten(s) {
  s = String(s);
  return s.length > 80 ? s.slice(0, 77) + '…' : s;
}

function clearMarks() {
  clearMarksSilent(DocumentApp.getActiveDocument().getBody());
  DocumentApp.getUi().alert('Cleared Zhukovsky highlights and notes.');
}

/** Remove highlighting across the body and delete the notes block if present. */
function clearMarksSilent(body) {
  var text = body.editAsText();
  var len = text.getText().length;
  if (len > 0) text.setBackgroundColor(0, len - 1, null);
  // Delete the notes block (heading + everything after it).
  var idx = notesHeadingIndex(body);
  if (idx >= 0) {
    for (var i = body.getNumChildren() - 1; i >= idx; i--) {
      // Body must keep at least one child; clear instead of removing the last.
      if (body.getNumChildren() === 1) { body.getChild(0).asParagraph().clear(); break; }
      body.removeChild(body.getChild(i));
    }
  }
}

/** Escape a literal string for Docs findText(), which takes an RE2-style pattern. */
function escapeForFindText(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
