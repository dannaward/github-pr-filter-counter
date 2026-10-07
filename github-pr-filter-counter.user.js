// ==UserScript==
// @name         GitHub PR Filter Counter
// @namespace    https://github.com/dannaward/github-pr-filter-counter
// @version      0.1.0
// @description  Shows +/- line counts for only the files that match the PR file filter.
// @match        https://github.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      api.github.com
// @run-at       document-idle
// ==/UserScript==

// Same logic as content.js in the Chrome extension, with Tampermonkey storage.
// Matches all of github.com because GitHub moves between pages without a
// full load, so a PR opened from another page would otherwise be missed.

(function () {
  'use strict';

  // Shows +/- totals for the files that match the PR's file-filters[] URL params.
  // GitHub keeps the header totals for the whole PR, so we fetch the file list
  // from the API and sum it ourselves.

  const BADGE_ID = 'pr-filtered-loc-badge';
  const filesCache = new Map(); // "owner/repo#123" -> [{ filename, additions, deletions }]

  function parsePrUrl() {
    const m = location.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/(changes|files)/);
    if (!m) return null;
    return { owner: m[1], repo: m[2], number: m[3] };
  }

  function getFilters() {
    return new URLSearchParams(location.search).getAll('file-filters[]');
  }

  function matchesFilters(filename, filters) {
    const base = filename.split('/').pop();
    const dot = base.lastIndexOf('.');
    const ext = dot > 0 ? base.slice(dot) : null;
    return filters.some((f) => (ext ? f === ext : f === 'No extension'));
  }

  async function getToken() {
    return GM_getValue('token', '');
  }

  // Set the token from the Tampermonkey menu instead of an options page.
  GM_registerMenuCommand('Set GitHub token', () => {
    const token = prompt('GitHub token (run `gh auth token`). Leave empty to clear.', '');
    if (token === null) return;
    GM_setValue('token', token.trim());
    filesCache.clear();
    lastHref = ''; // re-run on the next tick with the new token
  });

  async function fetchFiles(pr) {
    const key = `${pr.owner}/${pr.repo}#${pr.number}`;
    if (filesCache.has(key)) return filesCache.get(key);

    const token = await getToken();
    const headers = { Accept: 'application/vnd.github+json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const files = [];
    for (let page = 1; ; page++) {
      const url = `https://api.github.com/repos/${pr.owner}/${pr.repo}/pulls/${pr.number}/files?per_page=100&page=${page}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`GitHub API ${res.status}${token ? '' : ' (no token set)'}`);
      const batch = await res.json();
      files.push(...batch);
      if (batch.length < 100) break;
    }

    filesCache.set(key, files);
    return files;
  }

  // Finds the PR-wide diffstat on the page by its numbers, since the new
  // /changes view uses generated class names. Picks the smallest element whose
  // text holds both "+<total adds>" and "−<total dels>".
  // Text an element shows on screen, without spaces or screen-reader labels.
  function visibleText(el) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('.sr-only').forEach((s) => s.remove());
    return clone.textContent.replace(/\s+/g, '');
  }

  function findDiffstat(totalAdd, totalDel) {
    const classic = document.getElementById('diffstat');
    if (classic) return classic;

    // The new /changes view puts a screen-reader label inside the diffstat:
    // "Lines changed: 1035 additions & 24 deletions". Per-file headers have
    // the same label, so match on the PR totals.
    const label = `Lines changed: ${totalAdd} additions & ${totalDel} deletions`;
    for (const el of document.querySelectorAll('.sr-only')) {
      if (el.textContent.trim() === label && !el.closest(`#${BADGE_ID}`)) return el.parentElement;
    }

    const fmt = (n) => [String(n), n.toLocaleString('en-US')];
    const adds = fmt(totalAdd).map((n) => `+${n}`);
    const dels = fmt(totalDel).flatMap((n) => [`−${n}`, `-${n}`]);
    const hasBoth = (t) => adds.some((a) => t.includes(a)) && dels.some((d) => t.includes(d));

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      // React renders `+{n}` as two text nodes ("+" and "1,035"), so compare
      // the parent's whole text rather than the single node.
      if (!node.nodeValue.includes('+')) continue;
      if (!adds.includes(node.parentElement.textContent.replace(/\s+/g, ''))) continue;
      if (node.parentElement.closest(`#${BADGE_ID}`)) continue;
      // Climb a few levels to the element that also holds the deletions.
      let el = node.parentElement;
      for (let i = 0; i < 4 && el; i++, el = el.parentElement) {
        const t = visibleText(el);
        if (t.length > 40) break;
        if (hasBoth(t)) return el;
      }
    }
    return null;
  }

  function placeBadge(html, anchor) {
    let badge = document.getElementById(BADGE_ID);
    if (!badge) {
      badge = document.createElement('span');
      badge.id = BADGE_ID;
    }
    badge.innerHTML = html;

    if (anchor) {
      badge.removeAttribute('style');
      Object.assign(badge.style, { marginLeft: '8px', whiteSpace: 'nowrap', fontSize: '12px' });
      if (badge.previousElementSibling !== anchor) anchor.after(badge);
    } else {
      // No diffstat found on the page: float the badge instead.
      Object.assign(badge.style, {
        position: 'fixed',
        top: '72px',
        right: '16px',
        zIndex: 9999,
        padding: '6px 10px',
        borderRadius: '6px',
        font: '12px ui-monospace, SFMono-Regular, Menlo, monospace',
        background: 'var(--bgColor-default, #fff)',
        border: '1px solid var(--borderColor-default, #d0d7de)',
        boxShadow: '0 1px 3px rgba(0,0,0,.12)',
        color: 'var(--fgColor-default, #1f2328)',
      });
      if (badge.parentElement !== document.body) document.body.appendChild(badge);
    }
  }

  function removeBadge() {
    current = null;
    document.getElementById(BADGE_ID)?.remove();
  }

  // What the badge should show for the current URL, kept so we can put it
  // back when GitHub re-renders the header and drops our node.
  let current = null;

  function render() {
    if (!current) return;
    placeBadge(current.html, current.totals && findDiffstat(...current.totals));
  }

  async function update() {
    const pr = parsePrUrl();
    const filters = getFilters();
    if (!pr || filters.length === 0) return removeBadge();

    try {
      const files = await fetchFiles(pr);
      let add = 0;
      let del = 0;
      let totalAdd = 0;
      let totalDel = 0;
      for (const f of files) {
        totalAdd += f.additions;
        totalDel += f.deletions;
        if (!matchesFilters(f.filename, filters)) continue;
        add += f.additions;
        del += f.deletions;
      }
      current = {
        totals: [totalAdd, totalDel],
        html:
          '(' +
          `<span style="color:var(--fgColor-success,#1a7f37)">+${add}</span> ` +
          `<span style="color:var(--fgColor-danger,#d1242f)">−${del}</span>)`,
      };
    } catch (err) {
      current = { totals: null, html: `filtered LOC: ${err.message}` };
    }
    render();
  }

  // GitHub changes the URL without a page load when you toggle filters,
  // so watch the href instead of relying on load events. Between URL changes,
  // put the badge back if a re-render removed it or moved the diffstat.
  let lastHref = '';
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      update();
      return;
    }
    const badge = document.getElementById(BADGE_ID);
    if (current && (!badge || !badge.isConnected || badge.style.position === 'fixed')) render();
  }, 500);
})();
