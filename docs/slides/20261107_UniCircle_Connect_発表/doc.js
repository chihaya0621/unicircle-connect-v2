/* =====================================================================
   資料テンプレート doc.js
   index.html の head に <script src="doc.js" defer></script> を書いて読み込む。
   次の処理を自動で行い、終わると window.__docReady = true にする。
     1. 章番号と章ごとの配色（.chapter に data-theme が無ければ順に割り当て）
     2. ページのヘッダー（資料名・章名）とフッター（ページ番号 n / N）
     3. 見出し番号（2.1 など）、図表番号（図1・表1）、囲みのラベル
     4. 用語注（<span class="fn" data-note="説明">用語</span> → ページ下の注）
     5. Mermaid の図とコードの色分け（CDN から読み込むためインターネット接続が必要）
     6. 目次、章扉、相互参照（<a class="ref" href="#id"></a>）、用語集
   見つかった問題は window.__docProblems に入れ、build.mjs が報告する。
   ===================================================================== */
(() => {
  'use strict';

  const MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@11.17.2/dist/mermaid.esm.min.mjs';
  const HLJS_URL = 'https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.12.0/highlight.min.js';
  const THEMES = ['indigo', 'teal', 'amber', 'violet', 'green', 'rose', 'slate'];
  const CALLOUT_LABELS = { note: '補足', point: 'ポイント', warn: '注意', summary: 'まとめ' };
  const CALLOUT_ICONS = { note: 'info', point: 'bulb', warn: 'alert', summary: 'list-check' };

  // アイコン（24 × 24 の線画）。<i class="ic" data-ic="名前"></i> で使う。名前の一覧は references/components.md
  const ICONS = {
    'info': '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8h.01"/>',
    'bulb': '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2v.5h5v-.5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
    'alert': '<path d="M12 3.5 2.8 19.5h18.4z"/><path d="M12 9.5v4.5M12 17h.01"/>',
    'question': '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01"/>',
    'check': '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    'check-circle': '<circle cx="12" cy="12" r="9"/><path d="M8 12.3l2.8 2.8 5.4-5.6"/>',
    'cross': '<path d="M6 6l12 12M18 6 6 18"/>',
    'list-check': '<path d="M11 6h9M11 12h9M11 18h9M3.5 6l1.5 1.5L8 4.5M3.5 12l1.5 1.5L8 10.5M3.5 18l1.5 1.5L8 16.5"/>',
    'doc': '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    'pencil': '<path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5z"/><path d="M13.5 7l3 3"/>',
    'book': '<path d="M4 5.5C6.5 4 9.5 4 12 6c2.5-2 5.5-2 8-.5V19c-2.5-1.5-5.5-1.5-8 .5-2.5-2-5.5-2-8-.5z"/><path d="M12 6v13.5"/>',
    'folder': '<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    'calendar': '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    'clock': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    'user': '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
    'users': '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.8 2.9-6 6.5-6s6.5 2.2 6.5 6"/><circle cx="17" cy="9" r="2.8"/><path d="M17 14c2.8.2 4.5 2.2 4.5 5"/>',
    'chat': '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
    'mail': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5 12 13l8.5-6.5"/>',
    'building': '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01M10.5 21v-3h3v3"/>',
    'home': '<path d="M3.5 11 12 4l8.5 7M6 9.5V20h12V9.5"/>',
    'chart': '<path d="M4 20h16M7 16v-5M12 16V6.5M17 16V9"/>',
    'trend': '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
    'target': '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12h.01"/>',
    'flag': '<path d="M5 21V4h11l-2 4 2 4H5"/>',
    'star': '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
    'yen': '<path d="M6 4l6 8 6-8M12 12v8M8 13h8M8 16.5h8"/>',
    'search': '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    'sliders': '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    'lock': '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    'shield': '<path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
    'link': '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    'monitor': '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/>',
    'phone': '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
    'server': '<rect x="4" y="4" width="16" height="7" rx="1.5"/><rect x="4" y="13" width="16" height="7" rx="1.5"/><path d="M8 7.5h.01M8 16.5h.01"/>',
    'database': '<ellipse cx="12" cy="6" rx="7" ry="2.8"/><path d="M5 6v12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6M5 12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8"/>',
    'cloud': '<path d="M7 18a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.5 1.6A3.8 3.8 0 0 1 17.5 18z"/>',
    'code': '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14"/>',
    'bolt': '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
    'refresh': '<path d="M20 11a8 8 0 0 0-14.3-4.5L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.3 4.5l1.7-2M20 20v-4.5h-4.5"/>',
    'arrow-right': '<path d="M4 12h15M13 6l6 6-6 6"/>',
  };
  const PAGE_SIZES = { 'a4': '210mm 297mm', 'a4-landscape': '297mm 210mm', 'wide': '338.667mm 190.5mm' };
  const MM = 96 / 25.4; // 1mm あたりの px

  const MERMAID_CONFIG = {
    startOnLoad: false,
    theme: 'base',
    fontSize: 13,
    securityLevel: 'strict',
    suppressErrorRendering: true,
    logLevel: 'fatal',
    flowchart: { useMaxWidth: false, padding: 12, nodeSpacing: 40, rankSpacing: 48 },
    sequence: {
      useMaxWidth: false, mirrorActors: false, width: 120, actorMargin: 40, boxMargin: 8,
      // 下端の番号の丸（autonumber）が切れないよう、上下の余白を既定の10より広くする
      diagramMarginY: 20,
      messageMargin: 34, noteMargin: 10, actorFontSize: 13, messageFontSize: 13, noteFontSize: 12,
    },
    class: { useMaxWidth: false },
    state: { useMaxWidth: false },
    er: { useMaxWidth: false },
    gantt: {
      useMaxWidth: true, fontSize: 12, sectionFontSize: 12, barHeight: 22, barGap: 6,
      topPadding: 40, leftPadding: 96, gridLineStartPadding: 30,
    },
    pie: { useMaxWidth: false },
    journey: { useMaxWidth: false },
    timeline: { useMaxWidth: false },
    mindmap: { useMaxWidth: false },
    xyChart: { useMaxWidth: false },
    quadrantChart: { useMaxWidth: false },
    block: { useMaxWidth: false },
    requirement: { useMaxWidth: false },
    architecture: { useMaxWidth: false },
  };

  const root = document.documentElement;
  const problems = (window.__docProblems = []);
  window.__docReady = false;
  let pages = [];
  const glossaryTerms = [];

  /* ---------- 小道具 ---------- */
  const $$ = (sel, base = document) => Array.from(base.querySelectorAll(sel));
  const make = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };
  const pageNo = node => {
    const page = node && node.closest ? node.closest('.page') : null;
    return page ? pages.indexOf(page) + 1 : 0;
  };
  const report = (level, msg, node) => {
    problems.push({ level, msg, page: pageNo(node) || null });
    console.warn('[doc] ' + msg);
  };
  // 見出し番号や注の記号を除いた文字列
  const plainText = node => {
    const copy = node.cloneNode(true);
    copy.querySelectorAll('.h-no, .cap-no, sup.fn-mark').forEach(x => x.remove());
    return copy.textContent.replace(/\s+/g, ' ').trim();
  };
  // "120" / "120mm" / "300px" / "80%" を px に直す（単位なしは mm）
  const toPx = (value, base) => {
    const m = String(value || '').trim().match(/^(\d+(?:\.\d+)?)\s*(mm|px|%)?$/);
    if (!m) return null;
    const n = parseFloat(m[1]);
    return m[2] === '%' ? base * n / 100 : m[2] === 'px' ? n : n * MM;
  };
  const loadScript = src => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(src));
    document.head.appendChild(s);
  });
  // 本文エリアの下端から中身が何 px はみ出しているか（負なら余裕がある）
  const overflowPx = body => {
    const r = body.getBoundingClientRect();
    const limit = r.bottom - parseFloat(getComputedStyle(body).paddingBottom);
    let bottom = -Infinity;
    for (const child of body.children) {
      const cr = child.getBoundingClientRect();
      if (cr.width || cr.height) bottom = Math.max(bottom, cr.bottom);
    }
    return bottom === -Infinity ? -Infinity : bottom - limit;
  };
  // ページ内の部品を ヘッダー → 本文 → 用語注 → フッター の順に並べる
  const orderFrame = page => {
    ['.page-header', '.page-body', '.page-notes', '.page-footer'].forEach(sel => {
      const part = page.querySelector(':scope > ' + sel);
      if (part) page.appendChild(part);
    });
  };
  const isAppendix = ch => ch.hasAttribute('data-appendix') || ch.classList.contains('appendix');

  /* ---------- 1. 用紙 ---------- */
  function applyFormat() {
    const format = root.dataset.format || 'a4';
    if (!PAGE_SIZES[format]) {
      report('error', `data-format="${format}" は使えません（a4 / a4-landscape / wide のいずれか）`);
      return;
    }
    if (format !== 'a4') {
      const st = make('style');
      st.textContent = `@page { size: ${PAGE_SIZES[format]}; margin: 0; }`;
      document.head.appendChild(st);
    }
    const mode = root.dataset.mode;
    if (mode && mode !== 'present') report('warn', `data-mode="${mode}" は使えません（プレゼン資料なら present、通常の資料なら書かない）`);
  }

  /* ---------- 2. 章 ---------- */
  function setupChapters() {
    let chapterCount = 0;
    let appendixCount = 0;
    $$('.chapter').forEach(ch => {
      const appendix = isAppendix(ch);
      let no;
      let label;
      if (appendix) {
        appendixCount += 1;
        no = String.fromCharCode(64 + appendixCount);
        label = '付録' + no;
      } else {
        chapterCount += 1;
        no = String(chapterCount);
        label = '第' + no + '章';
      }
      ch.dataset.no = no;
      ch.dataset.label = label;
      if (!ch.dataset.theme) ch.dataset.theme = appendix ? 'slate' : THEMES[(chapterCount - 1) % THEMES.length];
      if (!THEMES.includes(ch.dataset.theme)) {
        report('warn', `${label} の data-theme="${ch.dataset.theme}" は定義されていません（${THEMES.join(' / ')}）`, ch.querySelector('.page'));
      }
      const titleEl = ch.querySelector('.chapter-title');
      if (!ch.dataset.title) ch.dataset.title = titleEl ? plainText(titleEl) : '';
      if (!ch.dataset.title) report('warn', `${label} のタイトルがありません（.chapter-title か data-title を書く）`, ch.querySelector('.page'));
      if (!ch.id) ch.id = appendix ? 'appendix-' + no.toLowerCase() : 'ch-' + no;
      $$('.chapter-head', ch).forEach(head => {
        let noEl = head.querySelector('.chapter-no');
        if (!noEl) {
          noEl = make('p', 'chapter-no');
          head.insertBefore(noEl, head.firstChild);
        }
        if (!noEl.textContent.trim()) noEl.textContent = label;
        if (!head.dataset.no) head.dataset.no = appendix ? no : no.padStart(2, '0');
      });
    });
  }

  /* ---------- 3. ページ枠（ヘッダー・本文・フッター） ---------- */
  function setupFrames() {
    const total = pages.length;
    const docTitle = root.dataset.shortTitle || document.title || '';
    const footText = root.dataset.footer || '';
    pages.forEach((page, i) => {
      page.classList.toggle('is-last', i === total - 1);
      if (page.classList.contains('cover')) return;
      let body = page.querySelector(':scope > .page-body');
      if (!body) {
        body = make('div', 'page-body');
        Array.from(page.childNodes).forEach(node => {
          if (node.nodeType === 1 && node.matches('.page-header, .page-footer, .page-notes')) return;
          body.appendChild(node);
        });
        page.appendChild(body);
      }
      const frame = page.dataset.frame !== 'none';
      const ch = page.closest('.chapter');
      const wantHeader = frame && page.dataset.header !== 'none' && !page.classList.contains('chapter-cover');
      if (wantHeader && !page.querySelector(':scope > .page-header')) {
        // 左に章（番号・章名・ページの題 data-crumb）、右に資料名
        const header = make('div', 'page-header');
        const chap = make('span', 'rh-chap');
        if (ch) {
          const no = make('span', 'rh-no');
          no.append(make('span', 'rh-label', ch.dataset.label), make('span', 'rh-num', isAppendix(ch) ? ch.dataset.no : ch.dataset.no.padStart(2, '0')));
          chap.append(no, make('span', 'rh-title', ch.dataset.title));
        } else {
          const titleEl = body.querySelector('.page-title');
          chap.appendChild(make('span', 'rh-title', page.dataset.header || page.dataset.toc || (titleEl ? plainText(titleEl) : '')));
        }
        if (page.dataset.crumb) chap.appendChild(make('span', 'rh-crumb', page.dataset.crumb));
        header.append(chap, make('span', 'rh-doc', docTitle));
        page.appendChild(header);
      }
      if (frame && page.dataset.footer !== 'none' && !page.querySelector(':scope > .page-footer')) {
        const footer = make('div', 'page-footer');
        const pg = make('span', 'pg');
        pg.append(make('span', 'pg-cur', String(i + 1)), make('span', 'pg-sep', '/'), make('span', 'pg-tot', String(total)));
        footer.append(make('span', 'pf-left', footText), pg);
        page.appendChild(footer);
      }
      orderFrame(page);
    });
  }

  /* ---------- 4. 見出し番号 ---------- */
  function numberHeadings() {
    const show = root.dataset.numbering !== 'off';
    $$('.chapter').forEach(ch => {
      let n = 0;
      $$('.page-body h2', ch).forEach(h => {
        if (h.classList.contains('no-number')) return;
        n += 1;
        const secNo = ch.dataset.no + '.' + n;
        h.dataset.secNo = secNo;
        if (!h.id) h.id = 'sec-' + ch.dataset.no.toLowerCase() + '-' + n;
        if (show && !h.querySelector('.h-no')) h.insertBefore(make('span', 'h-no', secNo), h.firstChild);
      });
    });
  }

  /* ---------- 5. 囲みのラベル ---------- */
  function setupCallouts() {
    const kinds = Object.keys(CALLOUT_LABELS);
    const sel = kinds.map(k => `div.${k}, aside.${k}`).join(', ');
    $$(sel).forEach(box => {
      if (box.dataset.label === 'none') return;
      const first = box.firstElementChild;
      if (first && first.classList.contains('callout-label')) return;
      const kind = kinds.find(k => box.classList.contains(k));
      const label = make('p', 'callout-label', box.dataset.label || CALLOUT_LABELS[kind]);
      const icon = box.dataset.icon || CALLOUT_ICONS[kind];
      if (icon !== 'none') {
        const ic = make('i', 'ic');
        ic.dataset.ic = icon;
        label.insertBefore(ic, label.firstChild);
      }
      box.insertBefore(label, box.firstChild);
    });
  }

  /* ---------- 5b. アイコン（<i class="ic" data-ic="名前"></i> を線画の SVG にする） ---------- */
  function setupIcons() {
    $$('i.ic[data-ic], ul.icons > li[data-ic]').forEach(el => {
      const name = el.dataset.ic;
      const shape = ICONS[name];
      if (!shape) {
        report('error', `アイコン「${name}」はありません（使える名前は references/components.md）`, el);
        return;
      }
      const svg = `<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shape}</svg>`;
      if (el.tagName === 'LI') el.insertAdjacentHTML('afterbegin', `<span class="ic li-ic">${svg}</span>`);
      else el.innerHTML = svg;
    });
  }

  /* ---------- 6. 手順の番号（ページをまたいで続けるとき <ol class="steps" start="4">） ---------- */
  function setupSteps() {
    $$('ol.steps[start]').forEach(ol => {
      const start = parseInt(ol.getAttribute('start'), 10);
      if (start > 1) ol.style.counterReset = 'step ' + (start - 1);
    });
    // 番号付きの行: 各行の先頭に「解決策 01」を入れる（start で続き番号）
    $$('ol.num-rows').forEach(ol => {
      const label = ol.dataset.label || '';
      let n = (parseInt(ol.getAttribute('start'), 10) || 1) - 1;
      $$(':scope > li', ol).forEach(li => {
        n += 1;
        if (li.querySelector(':scope > .nr-no')) return;
        const no = make('span', 'nr-no');
        if (label) no.appendChild(make('small', null, label));
        no.appendChild(make('b', null, String(n).padStart(2, '0')));
        li.insertBefore(no, li.firstChild);
      });
    });
  }

  /* ---------- 7. 用語注 ---------- */
  function setupNotes() {
    pages.forEach(page => {
      const marks = $$('.fn', page);
      if (!marks.length) return;
      const numbers = new Map();
      let box = page.querySelector(':scope > .page-notes');
      marks.forEach(fn => {
        const term = (fn.dataset.term || fn.textContent).replace(/\s+/g, ' ').trim();
        const note = (fn.dataset.note || '').trim();
        if (!note) {
          report('error', `用語注の説明（data-note）がありません: 「${term}」`, fn);
          return;
        }
        glossaryTerms.push({ term, note, yomi: fn.dataset.yomi || '' });
        const key = term + '\u0000' + note;
        let no = numbers.get(key);
        if (!no) {
          no = numbers.size + 1;
          numbers.set(key, no);
          if (!box) {
            box = make('div', 'page-notes');
            page.appendChild(box);
          }
          const line = make('p');
          line.append(make('span', 'fn-no', '※' + no), make('span', 'fn-term', term), document.createTextNode(note));
          box.appendChild(line);
        }
        fn.after(make('sup', 'fn-mark', '※' + no));
      });
      orderFrame(page);
    });
  }

  /* ---------- 8. 図表番号 ----------
     ページをまたいで続く表や図は <figure class="tbl" data-cont> と書くと、直前の番号を引き継ぐ。
     キャプションが空なら「直前のキャプション（続き）」を入れる */
  function numberCaptions() {
    const perChapter = root.dataset.captionNumbering === 'chapter';
    const count = { fig: 0, tbl: 0 };
    const last = { fig: null, tbl: null };
    let current = null;
    $$('figure').forEach(fig => {
      if (fig.dataset.caption === 'none') return;
      const kind = fig.classList.contains('tbl') ? 'tbl' : 'fig';
      let cap = fig.querySelector(':scope > figcaption');
      if (fig.hasAttribute('data-cont')) {
        const prev = last[kind];
        if (!prev) {
          report('warn', `data-cont の${kind === 'tbl' ? '表' : '図'}の前に、続きの元になる${kind === 'tbl' ? '表' : '図'}がありません`, fig);
          return;
        }
        if (!cap) {
          cap = make('figcaption');
          if (kind === 'tbl') fig.insertBefore(cap, fig.firstChild);
          else fig.appendChild(cap);
        }
        if (!cap.textContent.trim()) cap.textContent = prev.title + '（続き）';
        fig.dataset.label = prev.label;
        if (!cap.querySelector('.cap-no')) cap.insertBefore(make('span', 'cap-no', prev.label), cap.firstChild);
        return;
      }
      if (!cap) return;
      const ch = fig.closest('.chapter');
      if (perChapter && ch !== current) {
        count.fig = 0;
        count.tbl = 0;
        current = ch;
      }
      count[kind] += 1;
      const n = perChapter && ch ? ch.dataset.no + '-' + count[kind] : String(count[kind]);
      const label = (kind === 'tbl' ? '表' : '図') + n;
      fig.dataset.label = label;
      if (!fig.id) fig.id = kind + '-' + n.toLowerCase();
      last[kind] = { label, title: plainText(cap) };
      if (!cap.querySelector('.cap-no')) cap.insertBefore(make('span', 'cap-no', label), cap.firstChild);
    });
  }

  /* ---------- 9. Mermaid ---------- */
  function dedent(src) {
    const lines = src.replace(/\r/g, '').replace(/\t/g, '    ').split('\n');
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    const indents = lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length);
    const cut = indents.length ? Math.min(...indents) : 0;
    return lines.map(l => l.slice(cut)).join('\n');
  }

  function accentProbe() {
    const cache = {};
    return theme => {
      if (!cache[theme]) {
        const probe = make('div');
        probe.dataset.theme = theme;
        probe.style.display = 'none';
        document.body.appendChild(probe);
        cache[theme] = getComputedStyle(probe).getPropertyValue('--accent').trim();
        probe.remove();
      }
      return cache[theme];
    };
  }

  // 図を置いた章の配色を Mermaid の色設定に変換する
  function mermaidVars(host, accentOf) {
    const cs = getComputedStyle(host);
    const v = name => cs.getPropertyValue(name).trim();
    const themed = host.closest('[data-theme]');
    const own = themed ? themed.dataset.theme : 'indigo';
    const palette = [own].concat(THEMES.filter(t => t !== own)).map(accentOf);
    const vars = {
      darkMode: false,
      fontFamily: v('--font-sans'),
      fontSize: '13px',
      background: '#ffffff',
      primaryColor: v('--accent-soft'),
      primaryBorderColor: v('--accent'),
      primaryTextColor: v('--ink'),
      secondaryColor: v('--bg-subtle'),
      secondaryBorderColor: v('--rule-strong'),
      secondaryTextColor: v('--ink'),
      tertiaryColor: '#ffffff',
      tertiaryBorderColor: v('--rule-strong'),
      tertiaryTextColor: v('--ink'),
      lineColor: v('--ink-2'),
      textColor: v('--ink'),
      mainBkg: v('--accent-soft'),
      nodeBorder: v('--accent'),
      nodeTextColor: v('--ink'),
      clusterBkg: v('--accent-faint'),
      clusterBorder: v('--accent-line'),
      titleColor: v('--ink'),
      edgeLabelBackground: '#ffffff',
      noteBkgColor: v('--bg-subtle'),
      noteBorderColor: v('--rule-strong'),
      noteTextColor: v('--ink-2'),
      actorBkg: v('--accent-soft'),
      actorBorder: v('--accent'),
      actorTextColor: v('--ink'),
      actorLineColor: v('--rule-strong'),
      signalColor: v('--ink-2'),
      signalTextColor: v('--ink'),
      labelBoxBkgColor: v('--accent-soft'),
      labelBoxBorderColor: v('--accent'),
      labelTextColor: v('--accent-ink'),
      loopTextColor: v('--ink-2'),
      activationBkgColor: v('--accent-line'),
      activationBorderColor: v('--accent'),
      sequenceNumberColor: '#ffffff',
      classText: v('--ink'),
      transitionColor: v('--ink-2'),
      transitionLabelColor: v('--ink'),
      stateBkg: v('--accent-soft'),
      stateLabelColor: v('--ink'),
      compositeBackground: '#ffffff',
      compositeTitleBackground: v('--accent-faint'),
      compositeBorder: v('--accent-line'),
      altBackground: v('--accent-faint'),
      specialStateColor: v('--ink-2'),
      innerEndBackground: v('--ink-2'),
      attributeBackgroundColorOdd: '#ffffff',
      attributeBackgroundColorEven: v('--accent-faint'),
      sectionBkgColor: v('--accent-faint'),
      sectionBkgColor2: '#ffffff',
      altSectionBkgColor: '#ffffff',
      taskBkgColor: v('--accent-line'),
      taskBorderColor: v('--accent'),
      taskTextColor: v('--ink'),
      taskTextDarkColor: v('--ink'),
      taskTextLightColor: '#ffffff',
      taskTextOutsideColor: v('--ink'),
      activeTaskBkgColor: v('--accent-mid'),
      activeTaskBorderColor: v('--accent-strong'),
      doneTaskBkgColor: v('--rule'),
      doneTaskBorderColor: v('--rule-strong'),
      critBkgColor: v('--warn-line'),
      critBorderColor: v('--warn'),
      gridColor: v('--rule'),
      todayLineColor: v('--warn'),
      pieStrokeColor: '#ffffff',
      pieStrokeWidth: '1.5px',
      pieOuterStrokeColor: v('--rule-strong'),
      pieOuterStrokeWidth: '1px',
      pieTitleTextColor: v('--ink'),
      pieSectionTextColor: '#ffffff',
      pieLegendTextColor: v('--ink'),
      xyChart: {
        plotColorPalette: palette.join(','),
        backgroundColor: '#ffffff',
        titleColor: v('--ink'),
        xAxisLabelColor: v('--ink-2'),
        xAxisTitleColor: v('--ink-2'),
        xAxisTickColor: v('--rule-strong'),
        xAxisLineColor: v('--rule-strong'),
        yAxisLabelColor: v('--ink-2'),
        yAxisTitleColor: v('--ink-2'),
        yAxisTickColor: v('--rule-strong'),
        yAxisLineColor: v('--rule-strong'),
      },
    };
    palette.forEach((c, i) => { vars['pie' + (i + 1)] = c; });
    return vars;
  }

  // 図ごとに id を付け替え、複数の図で id が衝突しないようにする
  function uniquifyIds(svg, prefix) {
    const map = new Map();
    svg.querySelectorAll('[id]').forEach(node => {
      if (node === svg || node.id.startsWith(prefix)) return;
      const id = prefix + '-' + node.id;
      map.set(node.id, id);
      node.id = id;
    });
    if (!map.size) return;
    const swap = text => text.replace(/url\(#([^)]+)\)/g, (m, id) => (map.has(id) ? `url(#${map.get(id)})` : m));
    svg.querySelectorAll('*').forEach(node => {
      Array.from(node.attributes).forEach(attr => {
        if (attr.value.includes('url(#')) node.setAttribute(attr.name, swap(attr.value));
        if ((attr.name === 'href' || attr.name === 'xlink:href') && attr.value.startsWith('#') && map.has(attr.value.slice(1))) {
          node.setAttribute(attr.name, '#' + map.get(attr.value.slice(1)));
        }
      });
    });
    svg.querySelectorAll('style').forEach(st => {
      st.textContent = swap(st.textContent).replace(/#([A-Za-z][\w-]*)/g, (m, id) => (map.has(id) ? '#' + map.get(id) : m));
    });
  }

  // 図を本文の幅と高さに収める（data-scale / data-width / data-maxh で調整できる）
  function fitDiagram(host) {
    const svg = host.querySelector('svg');
    if (!svg) return;
    const vb = svg.viewBox && svg.viewBox.baseVal;
    const box = svg.getBoundingClientRect();
    const w = vb && vb.width ? vb.width : box.width;
    const h = vb && vb.height ? vb.height : box.height;
    if (!w || !h) return;
    const cs = getComputedStyle(host);
    const avail = host.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const body = host.closest('.page-body');
    let bodyH = Infinity;
    if (body) {
      const bs = getComputedStyle(body);
      bodyH = body.clientHeight - parseFloat(bs.paddingTop) - parseFloat(bs.paddingBottom);
    }
    const maxH = toPx(host.dataset.maxh, bodyH) || bodyH * 0.75;
    const want = toPx(host.dataset.width, avail);
    let scale = want ? Math.min(want, avail) / w : Math.min(parseFloat(host.dataset.scale) || 1, avail / w);
    scale = Math.min(scale, maxH / h);
    svg.setAttribute('width', (w * scale).toFixed(2));
    svg.setAttribute('height', (h * scale).toFixed(2));
    svg.style.maxWidth = 'none';
    host.dataset.fit = scale.toFixed(3);
  }

  async function renderMermaid() {
    const jobs = [];
    $$('script[type="text/x-mermaid"], div.mermaid, pre.mermaid').forEach(src => {
      if (src.dataset.processed) return;
      let host = src;
      if (src.tagName !== 'DIV') {
        host = make('div', 'mermaid');
        ['scale', 'width', 'maxh'].forEach(k => { if (src.dataset[k]) host.dataset[k] = src.dataset[k]; });
        src.replaceWith(host);
      }
      jobs.push({ host, code: dedent(src.textContent) });
      host.textContent = '';
    });
    if (!jobs.length) return;

    let mermaid;
    try {
      mermaid = (await import(MERMAID_URL)).default;
    } catch (e) {
      jobs.forEach(({ host, code }) => {
        host.classList.add('is-error');
        host.textContent = '図を描画できませんでした（Mermaid を読み込めません）\n\n' + code;
      });
      report('error', 'Mermaid を読み込めませんでした。インターネットに接続できるか確認してください（' + e.message + '）');
      return;
    }

    const accentOf = accentProbe();
    const fontFamily = getComputedStyle(root).getPropertyValue('--font-sans').trim();
    let n = 0;
    for (const { host, code } of jobs) {
      n += 1;
      const id = 'mmd-' + n;
      mermaid.initialize(Object.assign({}, MERMAID_CONFIG, { fontFamily, themeVariables: mermaidVars(host, accentOf) }));
      try {
        const { svg } = await mermaid.render(id, code, host);
        host.innerHTML = svg;
        const el = host.querySelector('svg');
        if (el) uniquifyIds(el, id);
        host.dataset.processed = 'true';
        fitDiagram(host);
      } catch (e) {
        const msg = String((e && e.message) || e);
        host.classList.add('is-error');
        host.textContent = 'Mermaid の記述に誤りがあります\n' + msg.slice(0, 500) + '\n\n' + code;
        report('error', 'Mermaid の記述に誤りがあります: ' + msg.split('\n')[0], host);
      } finally {
        const tmp = document.getElementById('d' + id);
        if (tmp) tmp.remove();
      }
    }
    $$('body > .mermaidTooltip').forEach(x => x.remove());
  }

  /* ---------- 10. コードの色分け ---------- */
  async function highlightCode() {
    const blocks = $$('pre code[class*="language-"]');
    if (!blocks.length) return;
    try {
      if (!window.hljs) await loadScript(HLJS_URL);
    } catch (e) {
      report('warn', 'highlight.js を読み込めませんでした。コードは色分けなしで出力されます');
      return;
    }
    const hljs = window.hljs;
    hljs.configure({ ignoreUnescapedHTML: true });
    blocks.forEach(code => {
      const lang = (code.className.match(/language-([\w+#.-]+)/) || [])[1];
      if (!lang || lang === 'plaintext' || lang === 'text' || code.dataset.highlighted) return;
      if (!hljs.getLanguage(lang)) {
        report('info', `コードの言語「${lang}」は色分けに対応していません（そのまま表示します）`, code);
        return;
      }
      try {
        hljs.highlightElement(code);
      } catch (e) {
        report('warn', 'コードの色分けに失敗しました: ' + e.message, code);
      }
    });
  }

  /* ---------- 11. 表紙の色帯（章の色を並べる） ---------- */
  function buildCoverPalette() {
    $$('.cover-palette').forEach(bar => {
      if (bar.children.length) return;
      const themes = $$('.chapter').map(ch => ch.dataset.theme);
      (themes.length ? themes : ['indigo']).forEach(theme => {
        const s = make('span');
        s.dataset.theme = theme;
        s.style.background = 'var(--accent)';
        bar.appendChild(s);
      });
    });
  }

  /* ---------- 12. 目次（入りきらない分は次の ol.toc へ送る） ---------- */
  function buildToc() {
    const lists = $$('ol.toc');
    if (!lists.length) return;
    const depth = parseInt(lists[0].dataset.depth || '2', 10);
    const numbered = root.dataset.numbering !== 'off';
    const items = [];
    $$('.page[data-toc], .chapter, .chapter h2[data-sec-no]').forEach(node => {
      if (node.classList.contains('page')) {
        if (node.closest('.chapter')) return;
        if (!node.id) node.id = 'page-' + pageNo(node);
        items.push({ level: 1, no: '', title: node.dataset.toc, id: node.id, page: pageNo(node) });
      } else if (node.classList.contains('chapter')) {
        items.push({
          level: 1, no: node.dataset.no, title: node.dataset.title, id: node.id,
          page: pageNo(node.querySelector('.page')), theme: node.dataset.theme,
        });
      } else if (depth >= 2 && !node.classList.contains('no-toc')) {
        const ch = node.closest('.chapter');
        items.push({
          level: 2, no: numbered ? node.dataset.secNo : '', title: plainText(node), id: node.id,
          page: pageNo(node), theme: ch.dataset.theme,
        });
      }
    });
    const entries = items.map(it => {
      const li = make('li', 'toc-l' + it.level);
      if (it.theme) li.dataset.theme = it.theme;
      const a = make('a');
      a.href = '#' + it.id;
      a.append(make('span', 'toc-no', it.no), make('span', 'toc-t', it.title), make('span', 'toc-p', String(it.page)));
      li.appendChild(a);
      return li;
    });
    lists.forEach(list => { list.textContent = ''; });
    lists[0].append(...entries);
    for (let i = 0; i < lists.length - 1; i++) {
      const body = lists[i].closest('.page-body');
      if (!body) continue;
      while (overflowPx(body) > 0.5 && lists[i].children.length > 1) lists[i + 1].prepend(lists[i].lastElementChild);
      // 章の行だけがページ末に残らないようにする
      const last = lists[i].lastElementChild;
      const head = lists[i + 1].firstElementChild;
      if (last && head && last.classList.contains('toc-l1') && head.classList.contains('toc-l2') && lists[i].children.length > 1) {
        lists[i + 1].prepend(last);
      }
    }
  }

  /* ---------- 13. 章扉（中身が空の .page.chapter-cover を埋める） ---------- */
  function buildChapterCovers() {
    $$('.chapter > .page.chapter-cover').forEach(page => {
      const ch = page.closest('.chapter');
      const body = page.querySelector(':scope > .page-body');
      if (!body || body.textContent.trim()) return;
      // 中身が章扉の絵（img.cc-illust）だけなら、絵を残して文字を足す
      if (Array.from(body.children).some(el => !el.matches('img.cc-illust'))) return;
      const illust = body.querySelector('img.cc-illust');
      const appendix = isAppendix(ch);
      // 章の最初のページに .chapter-title があれば、PDF のしおりが重ならないよう見出しにしない
      const titleTag = ch.querySelector('.chapter-title') ? 'p' : 'h1';
      body.append(
        make('p', 'cc-no', ch.dataset.label),
        make('p', 'cc-big', appendix ? ch.dataset.no : ch.dataset.no.padStart(2, '0')),
        make(titleTag, 'cc-title', ch.dataset.title)
      );
      const leadEl = ch.querySelector('.chapter-lead');
      const lead = ch.dataset.lead || (leadEl ? plainText(leadEl) : '');
      if (lead) body.appendChild(make('p', 'cc-lead', lead));
      const secs = $$('h2[data-sec-no]', ch).filter(h => !h.classList.contains('no-toc'));
      if (secs.length) {
        const list = make('ol', 'cc-list');
        secs.forEach(h => {
          const li = make('li');
          li.append(make('span', 'cc-sec', h.dataset.secNo), make('span', null, plainText(h)));
          list.appendChild(li);
        });
        body.appendChild(list);
      }
      if (illust) body.appendChild(illust);
    });
  }

  /* ---------- 14. 相互参照 ---------- */
  function resolveRefs() {
    const withPage = root.dataset.refPage !== 'off';
    $$('a.ref').forEach(a => {
      const href = a.getAttribute('href') || '';
      const id = decodeURIComponent(href.replace(/^#/, ''));
      const target = id ? document.getElementById(id) : null;
      if (!target) {
        report('error', `参照先が見つかりません: ${href || '（href なし）'}`, a);
        a.classList.add('is-broken');
        if (!a.textContent.trim()) a.textContent = '（参照先不明）';
        return;
      }
      if (a.textContent.trim()) return;
      let text;
      let anchor = target;
      if (target.matches('figure')) {
        text = target.dataset.label;
        if (!text) report('warn', `キャプションのない図表を参照しています: #${id}`, a);
      } else if (target.matches('.chapter')) {
        text = target.dataset.label;
        anchor = target.querySelector('.page');
      } else if (target.matches('.chapter-head, .chapter-title')) {
        text = target.closest('.chapter').dataset.label;
      } else if (target.dataset.secNo) {
        text = target.dataset.secNo + '節';
      } else if (target.matches('.page')) {
        text = 'p.' + pageNo(target);
        anchor = null;
      } else if (target.matches('h1, h2, h3, h4, dt')) {
        text = '「' + plainText(target) + '」';
      }
      if (!text) text = '「' + plainText(target).slice(0, 24) + '」';
      if (withPage && anchor) {
        const tp = pageNo(anchor);
        const ap = pageNo(a);
        if (tp && ap && tp !== ap) text += '（p.' + tp + '）';
      }
      a.textContent = text;
    });
  }

  /* ---------- 15. 用語集（<dl class="glossary" data-auto></dl> に用語注を集める） ---------- */
  function buildGlossary() {
    $$('dl.glossary[data-auto]').forEach(dl => {
      if (dl.children.length) return;
      const terms = new Map();
      glossaryTerms.forEach(t => { if (!terms.has(t.term)) terms.set(t.term, t); });
      if (!terms.size) {
        report('warn', '用語集（data-auto）に載せる用語注（.fn）がありません', dl);
        return;
      }
      Array.from(terms.values())
        .sort((a, b) => (a.yomi || a.term).localeCompare(b.yomi || b.term, 'ja'))
        .forEach(t => {
          const dt = make('dt', null, t.term);
          // 読みがなは漢字を含む用語だけに表示する（カタカナや英字の用語では並べ替えにだけ使う）
          if (t.yomi && /\p{Script=Han}/u.test(t.term)) dt.appendChild(make('span', 'yomi', t.yomi));
          dl.append(dt, make('dd', null, t.note));
        });
    });
  }

  /* ---------- 16. 読み込み待ちとはみ出しの印 ---------- */
  async function waitAssets() {
    await Promise.all($$('img').map(img => (img.complete ? null : new Promise(resolve => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    }))));
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  function markOverflow() {
    pages.forEach(page => {
      const body = page.querySelector(':scope > .page-body');
      const over = body ? overflowPx(body) > 0.5 : page.scrollHeight > page.clientHeight + 1;
      page.classList.toggle('is-overflow', over);
    });
  }

  async function main() {
    try {
      pages = $$('.page');
      $$('img[loading="lazy"]').forEach(img => { img.loading = 'eager'; });
      applyFormat();
      setupChapters();
      setupFrames();
      numberHeadings();
      setupCallouts();
      setupIcons();
      setupSteps();
      setupNotes();
      numberCaptions();
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      await renderMermaid();
      await highlightCode();
      buildCoverPalette();
      buildToc();
      buildChapterCovers();
      resolveRefs();
      buildGlossary();
      await waitAssets();
      markOverflow();
    } catch (e) {
      report('error', 'doc.js の処理中にエラーが起きました: ' + ((e && e.stack) || e));
    } finally {
      window.__docReady = true;
      document.dispatchEvent(new Event('doc:ready'));
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main);
  else main();
})();
