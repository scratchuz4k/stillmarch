(function () {
  'use strict';

  var state = {
    data: null,
    sectionOrder: [],
    sectionsById: {},
    collapsedGroups: new Set(),
    hideIdeas: false,
    searching: false,
    currentId: null
  };

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (c) node.appendChild(c);
    });
    return node;
  }

  function badge(statusKey) {
    var meta = state.data.statuses[statusKey];
    if (!meta) return null;
    return el('span', { class: 'badge badge--' + statusKey, title: meta.desc }, [
      document.createTextNode(meta.label)
    ]);
  }

  /* ---------------- Boot ---------------- */

  fetch('data/game-data.json')
    .then(function (r) {
      if (!r.ok) throw new Error('Could not load game-data.json (' + r.status + ')');
      return r.json();
    })
    .then(function (data) {
      state.data = data;
      data.sections.forEach(function (s) {
        state.sectionsById[s.id] = s;
      });
      data.nav.forEach(function (group) {
        group.items.forEach(function (id) {
          if (state.sectionsById[id]) state.sectionOrder.push(id);
        });
      });
      buildShell();
      var initial = (location.hash || '').replace('#', '') || state.sectionOrder[0];
      if (!state.sectionsById[initial]) initial = state.sectionOrder[0];
      goTo(initial, { replace: true });
    })
    .catch(function (err) {
      document.getElementById('main').innerHTML =
        '<div class="content"><p class="block--p">Could not load the archive data (' +
        (err && err.message ? err.message : 'unknown error') +
        '). Check that <code>data/game-data.json</code> is reachable from this page.</p></div>';
      console.error(err);
    });

  /* ---------------- Shell (sidebar, topbar) ---------------- */

  function buildShell() {
    document.title = state.data.site.title;
    $('#brandMark').textContent = state.data.site.title;
    $('#brandSub').textContent = 'Build ' + state.data.site.build + ' · updated ' + state.data.site.updated;
    $('#topbarTitle').textContent = state.data.site.title;

    buildNav();

    $('#search').addEventListener('input', function (e) {
      filterNav(e.target.value);
    });

    var ideaToggle = $('#hideIdeasToggle');
    try { state.hideIdeas = localStorage.getItem('stillmarch-hide-ideas') === '1'; } catch (e) {}
    ideaToggle.checked = state.hideIdeas;
    ideaToggle.addEventListener('change', function () {
      state.hideIdeas = ideaToggle.checked;
      try { localStorage.setItem('stillmarch-hide-ideas', state.hideIdeas ? '1' : '0'); } catch (e) {}
      applyIdeaVisibility();
    });

    $('#hamburger').addEventListener('click', function () {
      document.querySelector('.app').classList.add('nav-open');
    });
    $('#scrim').addEventListener('click', closeNav);

    var themeToggle = $('#themeToggle');
    var saved = null;
    try { saved = localStorage.getItem('stillmarch-theme'); } catch (e) {}
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved);
      themeToggle.textContent = saved === 'dark' ? '☀ Light' : '☽ Dark';
    }
    themeToggle.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme');
      var next = cur === 'dark' ? 'light' : (cur === 'light' ? null : 'dark');
      if (next) {
        document.documentElement.setAttribute('data-theme', next);
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
      themeToggle.textContent = next === 'dark' ? '☀ Light' : (next === 'light' ? '☽ Dark' : '☽ Dark');
      try {
        if (next) localStorage.setItem('stillmarch-theme', next);
        else localStorage.removeItem('stillmarch-theme');
      } catch (e) {}
    });

    window.addEventListener('hashchange', function () {
      var id = (location.hash || '').replace('#', '');
      if (id && state.sectionsById[id] && id !== state.currentId) {
        render(id);
      }
    });
  }

  function closeNav() {
    document.querySelector('.app').classList.remove('nav-open');
  }

  function loadCollapsedGroups() {
    try {
      var raw = localStorage.getItem('stillmarch-collapsed-groups');
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch (e) { return new Set(); }
  }

  function saveCollapsedGroups() {
    try {
      localStorage.setItem('stillmarch-collapsed-groups', JSON.stringify(Array.from(state.collapsedGroups)));
    } catch (e) {}
  }

  function buildNav() {
    state.collapsedGroups = loadCollapsedGroups();
    var wrap = $('#navGroups');
    wrap.innerHTML = '';
    state.data.nav.forEach(function (group) {
      var collapsed = state.collapsedGroups.has(group.group);
      var groupEl = el('div', { class: 'nav-group' + (collapsed ? ' is-collapsed' : ''), 'data-group': group.group });

      var titleBtn = el('button', {
        class: 'nav-group__title', type: 'button',
        'aria-expanded': collapsed ? 'false' : 'true'
      }, [
        el('span', { class: 'nav-group__chevron', html: '&#9656;' }),
        el('span', { text: group.group })
      ]);

      var itemsWrap = el('div', { class: 'nav-group__items' });
      itemsWrap.hidden = collapsed;

      titleBtn.addEventListener('click', function () {
        var nowCollapsed = !groupEl.classList.contains('is-collapsed');
        groupEl.classList.toggle('is-collapsed', nowCollapsed);
        itemsWrap.hidden = nowCollapsed && !state.searching;
        titleBtn.setAttribute('aria-expanded', nowCollapsed ? 'false' : 'true');
        if (nowCollapsed) state.collapsedGroups.add(group.group);
        else state.collapsedGroups.delete(group.group);
        saveCollapsedGroups();
      });

      group.items.forEach(function (id) {
        var section = state.sectionsById[id];
        if (!section) return;
        var dot = null;
        if (section.status) {
          dot = el('span', { class: 'nav-item__dot' });
          dot.style.background = 'var(--' + section.status + ')';
        }
        var btn = el('button', { class: 'nav-item', type: 'button', 'data-id': id, 'data-title': section.title.toLowerCase() }, [
          el('span', { text: section.title }),
          dot
        ]);
        btn.addEventListener('click', function () {
          var search = $('#search');
          if (search && search.value) {
            search.value = '';
            filterNav('');
          }
          goTo(id);
          closeNav();
        });
        itemsWrap.appendChild(btn);
      });

      groupEl.appendChild(titleBtn);
      groupEl.appendChild(itemsWrap);
      wrap.appendChild(groupEl);
    });
  }

  function expandGroupFor(id) {
    var groupEl = null;
    $$('.nav-group').forEach(function (g) {
      if ($('.nav-item[data-id="' + id + '"]', g)) groupEl = g;
    });
    if (!groupEl || !groupEl.classList.contains('is-collapsed')) return;
    groupEl.classList.remove('is-collapsed');
    $('.nav-group__items', groupEl).hidden = false;
    $('.nav-group__title', groupEl).setAttribute('aria-expanded', 'true');
    state.collapsedGroups.delete(groupEl.getAttribute('data-group'));
    saveCollapsedGroups();
  }

  function filterNav(query) {
    query = (query || '').trim().toLowerCase();
    state.searching = !!query;
    var any = false;
    $$('.nav-group').forEach(function (g) {
      var itemsWrap = $('.nav-group__items', g);
      var groupHasVisible = false;
      $$('.nav-item', g).forEach(function (btn) {
        var match = !query || btn.getAttribute('data-title').indexOf(query) !== -1;
        btn.hidden = !match;
        if (match) groupHasVisible = true;
      });
      if (query) {
        itemsWrap.hidden = !groupHasVisible;
      } else {
        itemsWrap.hidden = g.classList.contains('is-collapsed');
      }
      $('.nav-group__title', g).hidden = query && !groupHasVisible;
      if (groupHasVisible) any = true;
    });
    var existing = $('#noResults');
    if (!any) {
      if (!existing) {
        $('#navGroups').appendChild(el('div', { id: 'noResults', class: 'no-results', text: 'No systems match "' + query + '".' }));
      }
    } else if (existing) {
      existing.remove();
    }
  }

  function applyIdeaVisibility() {
    $$('[data-status-item="idea"]').forEach(function (node) {
      node.hidden = state.hideIdeas;
    });
  }

  /* ---------------- Routing / render ---------------- */

  function goTo(id, opts) {
    opts = opts || {};
    if (opts.replace) {
      history.replaceState(null, '', '#' + id);
    } else {
      location.hash = id;
    }
    render(id);
  }

  function render(id) {
    var section = state.sectionsById[id];
    if (!section) return;
    state.currentId = id;

    expandGroupFor(id);
    $$('.nav-item').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-id') === id);
    });

    var main = $('#main');
    main.innerHTML = '';
    var content = el('div', { class: 'content' });

    var head = el('div', { class: 'section-head' });
    var eyebrow = findGroupFor(id);
    head.appendChild(el('div', { class: 'section-head__eyebrow', text: eyebrow }));
    head.appendChild(el('h1', { text: section.title }));
    if (section.dek) head.appendChild(el('p', { class: 'section-head__dek', text: section.dek }));
    if (section.status) {
      var badges = el('div', { class: 'section-head__badges' }, [badge(section.status)]);
      head.appendChild(badges);
    }
    content.appendChild(head);

    (section.blocks || []).forEach(function (block) {
      var node = renderBlock(block);
      if (node) content.appendChild(node);
    });

    if (section.generated === 'backlog-index') {
      content.appendChild(buildBacklogIndex(id));
    }

    content.appendChild(buildPageNav(id));

    main.appendChild(content);
    applyIdeaVisibility();
    main.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function buildBacklogIndex(selfId) {
    var wrap = el('div', { class: 'backlog-index block' });

    var wholeSections = [];
    var itemized = [];

    state.sectionOrder.forEach(function (id) {
      if (id === selfId) return;
      var section = state.sectionsById[id];
      if (section.status === 'idea') {
        wholeSections.push(section);
        return;
      }
      var found = [];
      (section.blocks || []).forEach(function (block) {
        if (block.type === 'p' && block.status === 'idea') {
          found.push(block.text);
        } else if (block.type === 'note' && block.tone === 'idea') {
          found.push(block.text);
        } else if (block.type === 'list' || block.type === 'olist') {
          block.items.forEach(function (item) {
            var isObj = typeof item === 'object';
            var status = isObj ? item.status : block.status;
            if (status === 'idea') found.push(isObj ? item.text : item);
          });
        }
      });
      if (found.length) itemized.push({ section: section, items: found });
    });

    var total = wholeSections.length + itemized.reduce(function (n, g) { return n + g.items.length; }, 0);
    wrap.appendChild(el('p', {
      class: 'backlog-index__summary',
      text: total + ' idea' + (total === 1 ? '' : 's') + ' on record across ' + (wholeSections.length + itemized.length) + ' page' + ((wholeSections.length + itemized.length) === 1 ? '' : 's') + '.'
    }));

    if (wholeSections.length) {
      wrap.appendChild(el('h2', { class: 'block--h', text: 'Entire systems, not started' }));
      var cards = el('div', { class: 'backlog-cards' });
      wholeSections.forEach(function (section) {
        var card = el('button', { class: 'backlog-card', type: 'button' }, [
          el('span', { class: 'backlog-card__eyebrow', text: findGroupFor(section.id) }),
          el('span', { class: 'backlog-card__title', text: section.title }),
          section.dek ? el('span', { class: 'backlog-card__dek', text: section.dek }) : null
        ]);
        card.addEventListener('click', function () { goTo(section.id); });
        cards.appendChild(card);
      });
      wrap.appendChild(cards);
    }

    if (itemized.length) {
      wrap.appendChild(el('h2', { class: 'block--h', text: 'Ideas floated inside live systems' }));
      itemized.forEach(function (group) {
        var box = el('div', { class: 'backlog-group' });
        var head = el('button', { class: 'backlog-group__head', type: 'button' }, [
          el('span', { class: 'backlog-group__eyebrow', text: findGroupFor(group.section.id) }),
          el('span', { class: 'backlog-group__title', text: group.section.title + ' →' })
        ]);
        head.addEventListener('click', function () { goTo(group.section.id); });
        box.appendChild(head);
        var ul = el('ul', { class: 'list' });
        group.items.forEach(function (text) {
          ul.appendChild(el('li', { text: text }));
        });
        box.appendChild(ul);
        wrap.appendChild(box);
      });
    }

    if (!total) {
      wrap.appendChild(el('p', { class: 'backlog-index__summary', text: 'Nothing left on the backlog — everything proposed has shipped.' }));
    }

    return wrap;
  }

  function findGroupFor(id) {
    var found = 'The Chronicles';
    state.data.nav.forEach(function (g) {
      if (g.items.indexOf(id) !== -1) found = g.group;
    });
    return found;
  }

  function renderBlock(block) {
    switch (block.type) {
      case 'p': {
        var p = el('p', { class: 'block block--p' + (block.status ? ' is-annotated' : '') });
        p.appendChild(document.createTextNode(block.text));
        if (block.status) {
          p.setAttribute('data-status-item', block.status);
          p.appendChild(document.createElement('br'));
          p.appendChild(badge(block.status));
        }
        return p;
      }
      case 'h':
        return el('h2', { class: 'block--h', text: block.text });
      case 'list':
      case 'olist': {
        var tag = block.type === 'olist' ? 'ol' : 'ul';
        var list = el(tag, { class: block.type });
        block.items.forEach(function (item) {
          var isObj = typeof item === 'object';
          var text = isObj ? item.text : item;
          var status = isObj ? item.status : block.status;
          var li = el('li', {});
          if (status) li.setAttribute('data-status-item', status);
          li.appendChild(document.createTextNode(text));
          if (status) {
            var b = badge(status);
            if (b) {
              b.classList.add('li-badge');
              li.appendChild(b);
            }
          }
          list.appendChild(li);
        });
        return el('div', { class: 'block' }, [list]);
      }
      case 'chain': {
        var chain = el('div', { class: 'chain block' });
        block.items.forEach(function (text, i) {
          chain.appendChild(el('span', { class: 'chain__node', text: text }));
          if (i < block.items.length - 1) {
            chain.appendChild(el('span', { class: 'chain__arrow', html: '&#8594;' }));
          }
        });
        return chain;
      }
      case 'table': {
        var wrap = el('div', { class: 'table-wrap block' });
        if (block.caption) wrap.appendChild(el('div', { class: 'table-caption', text: block.caption }));
        var table = el('table');
        var thead = el('thead');
        var trh = el('tr');
        block.headers.forEach(function (h) { trh.appendChild(el('th', { text: h })); });
        thead.appendChild(trh);
        table.appendChild(thead);
        var tbody = el('tbody');
        block.rows.forEach(function (row) {
          var tr = el('tr');
          row.forEach(function (cell) { tr.appendChild(el('td', { text: cell })); });
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        wrap.appendChild(table);
        return wrap;
      }
      case 'note': {
        var note = el('div', { class: 'note note--' + (block.tone || 'context') + ' block' });
        if (block.tone === 'idea') note.setAttribute('data-status-item', 'idea');
        note.appendChild(document.createTextNode(block.text));
        return note;
      }
      case 'quote': {
        var bq = el('blockquote', { class: 'blockquote block' });
        bq.appendChild(document.createTextNode('“' + block.text + '”'));
        if (block.cite) bq.appendChild(el('cite', { text: block.cite }));
        return bq;
      }
      default:
        return null;
    }
  }

  function buildPageNav(id) {
    var idx = state.sectionOrder.indexOf(id);
    var prevId = idx > 0 ? state.sectionOrder[idx - 1] : null;
    var nextId = idx < state.sectionOrder.length - 1 ? state.sectionOrder[idx + 1] : null;
    var nav = el('div', { class: 'pagenav' });

    var prevBtn = el('button', { class: 'pagenav__btn pagenav__btn--prev', type: 'button' });
    if (prevId) {
      var ps = state.sectionsById[prevId];
      prevBtn.appendChild(el('span', { class: 'pagenav__dir', text: '← Previous' }));
      prevBtn.appendChild(el('span', { class: 'pagenav__title', text: ps.title }));
      prevBtn.addEventListener('click', function () { goTo(prevId); });
    } else {
      prevBtn.hidden = true;
    }

    var nextBtn = el('button', { class: 'pagenav__btn pagenav__btn--next', type: 'button' });
    if (nextId) {
      var ns = state.sectionsById[nextId];
      nextBtn.appendChild(el('span', { class: 'pagenav__dir', text: 'Next →' }));
      nextBtn.appendChild(el('span', { class: 'pagenav__title', text: ns.title }));
      nextBtn.addEventListener('click', function () { goTo(nextId); });
    } else {
      nextBtn.hidden = true;
    }

    nav.appendChild(prevBtn);
    nav.appendChild(nextBtn);
    return nav;
  }
})();
