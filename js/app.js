/* Quem está vendo: dono ou visitante */
var CTX = window.Backend.ctx;

/* Datas: semanas de segunda a domingo */
var DT = (function () {
  var M = ['jan.', 'fev.', 'mar.', 'abr.', 'maio', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function fmt(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  function parse(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function today() { return fmt(new Date()); }
  function weekKey(s) {
    var d = parse(s); if (!d) return null;
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return fmt(d);
  }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return fmt(d); }
  function label(key) {
    var a = parse(key), b = parse(addDays(key, 6));
    if (a.getMonth() === b.getMonth()) return a.getDate() + ' a ' + b.getDate() + ' de ' + M[b.getMonth()];
    return a.getDate() + ' de ' + M[a.getMonth()] + ' a ' + b.getDate() + ' de ' + M[b.getMonth()];
  }
  function short(s) { var d = parse(s); return p2(d.getDate()) + '/' + p2(d.getMonth() + 1); }
  return { today: today, weekKey: weekKey, addDays: addDays, label: label, short: short, parse: parse };
})();

/* Meta pública: um documento lido por todos e escrito só pelo dono */
var GOAL = { doc: {}, ready: false, listeners: [] };
function goalValue(d) { var g = parseInt(d && d.goal, 10); return (g >= 1 && g <= 100) ? g : 10; }

(function () {
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
  var ids = tabs.map(function (t) { return t.getAttribute('aria-controls'); });
  var nav = document.querySelector('.tabs');
  var main = document.getElementById('conteudo');

  function show(id, focus) {
    if (ids.indexOf(id) === -1 || document.getElementById('t-' + id).hidden) id = 'historia';
    tabs.forEach(function (t) {
      var on = t.getAttribute('aria-controls') === id;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      if (on) {
        if (focus) t.focus({ preventScroll: true });
        var bar = t.parentElement;
        var left = t.offsetLeft - bar.offsetLeft;
        if (left < bar.scrollLeft || left + t.offsetWidth > bar.scrollLeft + bar.clientWidth) {
          bar.scrollLeft = left - 16;
        }
      }
    });
  }

  function select(id, focus) {
    show(id, focus);
    try { history.replaceState(null, '', '#' + id); } catch (e) { location.hash = id; }
    var top = main.getBoundingClientRect().top;
    if (Math.abs(top - nav.offsetHeight) > 2) {
      window.scrollTo({ top: window.scrollY + top - nav.offsetHeight, behavior: 'auto' });
    }
  }

  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { select(t.getAttribute('aria-controls'), false); });
    t.addEventListener('keydown', function (e) {
      var vis = tabs.filter(function (x) { return !x.hidden; });
      var k = vis.indexOf(t), j = null;
      if (e.key === 'ArrowRight') j = (k + 1) % vis.length;
      if (e.key === 'ArrowLeft') j = (k - 1 + vis.length) % vis.length;
      if (j !== null) { e.preventDefault(); select(vis[j].getAttribute('aria-controls'), true); }
    });
  });

  window.addEventListener('hashchange', function () { show(location.hash.slice(1), false); });
  show(location.hash.slice(1), false);
  window.__showTab = function (id) { show(id, false); };
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[data-go]') : null;
    if (!a) return;
    e.preventDefault();
    select(a.getAttribute('data-go'), false);
  });
})();

/* Ampliar fotos ao tocar */
(function () {
  var lb = document.getElementById('lb');
  var img = document.getElementById('lb-img');
  var cap = document.getElementById('lb-cap');
  var closeBtn = document.getElementById('lb-close');
  var last = null;
  function open(src, alt, caption, from) {
    last = from;
    img.src = src; img.alt = alt || '';
    cap.textContent = caption || '';
    cap.hidden = !caption;
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }
  function close() {
    if (lb.hidden) return;
    lb.hidden = true;
    img.removeAttribute('src');
    document.body.style.overflow = '';
    if (last) { try { last.focus({ preventScroll: true }); } catch (e) {} }
  }
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!(t instanceof HTMLImageElement) || !lb.hidden) return;
    if (!t.closest('.frame, .ph, .char')) return;
    var fig = t.closest('figure');
    var fc = fig ? fig.querySelector('figcaption') : null;
    var name = t.closest('.char') ? t.closest('.char').querySelector('span') : null;
    open(t.currentSrc || t.src, t.alt, fc ? fc.textContent : (name ? name.textContent : ''), t);
  });
  lb.addEventListener('click', function (e) { if (e.target !== img) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  window.__closeLightbox = close;
})();

/* Tramas: personagens, edição e novas tramas */
(function () {
  var list = document.querySelector('.tramas');
  var addBtn = document.getElementById('add-trama');
  var sync = document.getElementById('sync');
  var NEWDEF = { title: 'Nova trama', by: '', text: '', max: 1, chars: [] };
  var TR = {}, staticIds = [], docs = {};
  var db = null, assets = null, canEdit = false;

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function blobSrc(id) { return (typeof id === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(id)) ? window.Backend.photoUrl(id) : null; }
  function note(msg) { sync.textContent = msg || ''; sync.hidden = !msg; }

  Array.prototype.forEach.call(list.querySelectorAll('.trama[data-id]'), function (el) {
    var id = el.getAttribute('data-id');
    staticIds.push(id);
    TR[id] = {
      el: el, custom: false, num: el.querySelector('.n').textContent,
      def: {
        title: el.querySelector('h3').textContent,
        text: el.querySelector('.txt').textContent,
        max: parseInt(el.getAttribute('data-max'), 10) || 1,
        chars: Array.prototype.map.call(el.querySelectorAll('.char'), function (c) {
          var im = c.querySelector('img');
          return { name: c.querySelector('span').textContent, img: null, src: im ? im.getAttribute('src') : null };
        })
      }
    };
    wire(id);
  });

  function wire(id) {
    var btn = TR[id].el.querySelector('.edit');
    btn.addEventListener('click', function () { openEd(id, btn, false); });
  }

  function view(id) {
    var d = docs[id] || {}, def = TR[id] ? TR[id].def : NEWDEF;
    var max = parseInt(d.max, 10);
    return {
      title: (typeof d.title === 'string' && d.title.trim()) ? d.title.slice(0, 80) : def.title,
      text: (typeof d.text === 'string' && d.text.trim()) ? d.text.slice(0, 3000) : def.text,
      max: (max >= 1 && max <= 20) ? max : def.max,
      chars: Array.isArray(d.chars) ? d.chars.filter(function (c) { return c && typeof c === 'object'; }).slice(0, 20) : (def.chars || [])
    };
  }
  function localSrc(s) { return (typeof s === 'string' && /^img\/[a-z0-9_-]+\.jpg$/.test(s)) ? s : null; }
  function picOf(c) { return blobSrc(c.img) || localSrc(c.src); }

  function pairLine(v) {
    var names = v.chars.map(function (c) { return typeof c.name === 'string' ? c.name.trim().slice(0, 60) : ''; }).filter(Boolean);
    if (!names.length) return 'Ezra & ' + (v.max > 1 ? 'Personagens' : 'Personagem');
    if (names.length === 1) return 'Ezra & ' + names[0];
    return 'Ezra & ' + names.slice(0, -1).join(', ') + ' e ' + names[names.length - 1];
  }

  function makeArticle(id) {
    var a = document.createElement('article');
    a.className = 'trama';
    a.setAttribute('data-id', id);
    a.innerHTML = '<span class="n"></span><div><h3></h3><span class="by"></span><p class="txt"></p>' +
      '<div class="chars" hidden></div><div class="row"><span class="pill"></span>' +
      '<button class="btn edit" type="button">Editar</button></div></div>';
    a.querySelector('.edit').hidden = !(canEdit && editMode);
    return a;
  }

  function syncCustom() {
    var ids = Object.keys(docs).filter(function (id) {
      return docs[id] && docs[id].custom === true && staticIds.indexOf(id) === -1;
    });
    ids.sort(function (a, b) {
      return ((Number(docs[a].order) || 0) - (Number(docs[b].order) || 0)) || (a < b ? -1 : 1);
    });
    Object.keys(TR).forEach(function (id) {
      if (TR[id].custom && ids.indexOf(id) === -1) { TR[id].el.remove(); delete TR[id]; }
    });
    ids.forEach(function (id, i) {
      if (!TR[id]) { TR[id] = { el: makeArticle(id), custom: true, def: NEWDEF }; wire(id); }
      TR[id].num = pad(staticIds.length + i + 1);
      list.appendChild(TR[id].el);
    });
  }

  function avatar(name, src) {
    if (src) {
      var im = document.createElement('img');
      im.src = src; im.alt = name || 'Personagem'; im.loading = 'lazy';
      im.addEventListener('error', function () { im.replaceWith(avatar(name, null)); });
      return im;
    }
    var ph = document.createElement('div');
    ph.className = 'noimg';
    ph.textContent = ((name || '').trim().charAt(0) || '?').toUpperCase();
    return ph;
  }

  function render(id) {
    var t = TR[id], v = view(id);
    t.el.querySelector('.n').textContent = t.num;
    t.el.querySelector('h3').textContent = v.title;
    var by = t.el.querySelector('.by');
    by.textContent = pairLine(v);
    t.el.querySelector('.txt').textContent = v.text;
    var box = t.el.querySelector('.chars');
    box.textContent = '';
    v.chars.forEach(function (c) {
      var name = typeof c.name === 'string' ? c.name.slice(0, 60) : '';
      var item = document.createElement('div');
      item.className = 'char';
      item.appendChild(avatar(name, picOf(c)));
      var s = document.createElement('span');
      s.textContent = name || 'Sem nome';
      item.appendChild(s);
      box.appendChild(item);
    });
    box.hidden = v.chars.length === 0;
    var n = v.chars.length, pill = t.el.querySelector('.pill');
    pill.textContent = (n >= v.max ? 'Preenchida' : 'Disponível') + ' · ' + pad(n) + '/' + pad(v.max);
    pill.classList.toggle('full', n >= v.max);
  }
  function renderAll() {
    syncCustom();
    Object.keys(TR).forEach(render);
    var total = 0, free = 0;
    Object.keys(TR).forEach(function (id) { var v = view(id); total += v.max; free += Math.max(v.max - v.chars.length, 0); });
    var fs = document.getElementById('free-slots');
    if (fs) fs.textContent = free + ' de ' + total + (free === 1 ? ' livre' : ' livres');
  }

  /* Editor */
  var ed = document.getElementById('ed');
  var edKind = document.getElementById('ed-kind');
  var edTitle = document.getElementById('ed-title');
  var edName = document.getElementById('ed-name');
  var edText = document.getElementById('ed-text');
  var edReset = document.getElementById('ed-reset');
  var edMax = document.getElementById('ed-max');
  var edList = document.getElementById('ed-list');
  var edMsg = document.getElementById('ed-msg');
  var edSave = document.getElementById('ed-save');
  var edDelete = document.getElementById('ed-delete');
  var edNoPhoto = document.getElementById('ed-nophoto');
  var cur = null, opener = null, busy = false, delArmed = false;

  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var im = new Image();
      im.onload = function () {
        var s = Math.min(1, 900 / Math.max(im.naturalWidth, im.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(im.naturalWidth * s));
        c.height = Math.max(1, Math.round(im.naturalHeight * s));
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error('blob')); }, 'image/jpeg', 0.85);
      };
      im.onerror = function () { URL.revokeObjectURL(url); reject(new Error('img')); };
      im.src = url;
    });
  }

  function drawList() {
    edList.textContent = '';
    if (!cur.chars.length) {
      var p = document.createElement('p');
      p.className = 'ed-empty';
      p.textContent = 'Nenhum personagem nesta trama ainda.';
      edList.appendChild(p);
    }
    cur.chars.forEach(function (c, i) {
      var row = document.createElement('div');
      row.className = 'ed-char';
      row.appendChild(avatar(c.name, c.preview || picOf(c)));
      var right = document.createElement('div');
      var lab = document.createElement('label');
      lab.setAttribute('for', 'ed-char-' + i);
      lab.textContent = 'Nome do personagem';
      var inp = document.createElement('input');
      inp.type = 'text'; inp.id = 'ed-char-' + i; inp.maxLength = 60; inp.value = c.name;
      inp.addEventListener('input', function () { c.name = inp.value; });
      right.appendChild(lab); right.appendChild(inp);
      var acts = document.createElement('div');
      acts.className = 'ed-acts';
      if (assets) {
        var file = document.createElement('input');
        file.type = 'file'; file.accept = 'image/*'; file.id = 'ed-file-' + i;
        var fl = document.createElement('label');
        fl.setAttribute('for', 'ed-file-' + i);
        fl.className = 'btn';
        fl.style.margin = '0';
        fl.textContent = (c.img || c.src || c.preview) ? 'Trocar foto' : 'Escolher foto';
        file.addEventListener('change', function () {
          var f = file.files && file.files[0];
          if (!f) return;
          edMsg.textContent = 'Preparando a foto…';
          shrink(f).then(function (b) {
            if (c.preview) URL.revokeObjectURL(c.preview);
            c.file = b; c.preview = URL.createObjectURL(b);
            edMsg.textContent = '';
            drawList();
          }, function () { edMsg.textContent = 'Não deu para abrir essa imagem. Tente outra foto.'; });
        });
        acts.appendChild(file); acts.appendChild(fl);
      }
      var rm = document.createElement('button');
      rm.type = 'button'; rm.className = 'btn'; rm.textContent = 'Remover';
      rm.addEventListener('click', function () {
        if (c.preview) URL.revokeObjectURL(c.preview);
        cur.chars.splice(i, 1);
        drawList();
      });
      acts.appendChild(rm);
      right.appendChild(acts);
      row.appendChild(right);
      edList.appendChild(row);
    });
  }

  function openEd(id, btn, isNew) {
    var v = isNew ? { title: '', by: '', text: '', max: 1, chars: [] } : view(id);
    opener = btn;
    cur = {
      id: id, isNew: !!isNew, custom: !!isNew || TR[id].custom,
      chars: v.chars.map(function (c) {
        return { name: typeof c.name === 'string' ? c.name : '', img: blobSrc(c.img) ? c.img : null, src: localSrc(c.src), file: null, preview: null };
      })
    };
    cur.orig = cur.chars.map(function (c) { return c.img; }).filter(Boolean);
    edKind.textContent = isNew ? 'Nova trama' : 'Editar trama';
    edTitle.textContent = isNew ? 'Adicionar trama' : v.title;
    edName.value = v.title;
    edText.value = v.text;
    edMax.value = v.max;
    edReset.hidden = cur.custom;
    edDelete.hidden = !cur.custom || cur.isNew;
    edDelete.textContent = 'Excluir trama';
    delArmed = false;
    edMsg.textContent = '';
    edNoPhoto.hidden = !!assets;
    drawList();
    ed.hidden = false;
    document.body.style.overflow = 'hidden';
    edName.focus();
  }
  function closeEd() {
    if (busy) return;
    if (cur) cur.chars.forEach(function (c) { if (c.preview) URL.revokeObjectURL(c.preview); });
    cur = null;
    ed.hidden = true;
    document.body.style.overflow = '';
    var back = (opener && document.body.contains(opener)) ? opener : addBtn;
    try { back.focus({ preventScroll: true }); } catch (e) {}
  }
  function errText(e) {
    var code = e && e.code;
    if (code === 'too_large') return 'Essa foto é grande demais. Escolha outra.';
    if (code === 'quota_exceeded' || code === 'quota_or_state') return 'O espaço de armazenamento do site encheu. Remova fotos antigas e tente de novo.';
    if (code === 'invalid_argument' || code === 'not_granted') return 'Este acesso não tem permissão para salvar. Abra o site com a sua conta.';
    return 'Não foi possível salvar. Tente de novo.';
  }

  async function save() {
    if (!cur || busy) return;
    var title = edName.value.trim(), text = edText.value.trim();
    var max = parseInt(edMax.value, 10);
    if (cur.custom && !title) { edMsg.textContent = 'Dê um nome para a trama.'; edName.focus(); return; }
    busy = true; edSave.disabled = true;
    edMsg.textContent = 'Salvando…';
    try {
      for (var i = 0; i < cur.chars.length; i++) {
        var c = cur.chars[i];
        if (c.file && assets) {
          var res = await assets.upload(c.file, { type: 'image/jpeg' });
          c.img = res.id; c.src = null; c.file = null;
        }
      }
      var chars = cur.chars
        .filter(function (c) { return c.name.trim() || c.img || c.src; })
        .map(function (c) { return { name: c.name.trim().slice(0, 60), img: c.img || null, src: c.img ? null : (c.src || null) }; });
      var body;
      if (cur.custom) {
        var old = docs[cur.id] || {};
        body = {
          custom: true,
          order: cur.isNew ? Date.now() : (Number(old.order) || Date.now()),
          title: title.slice(0, 80), text: text.slice(0, 3000),
          max: (max >= 1 && max <= 20) ? max : 1,
          chars: chars
        };
      } else {
        var def = TR[cur.id].def;
        body = {
          title: (title && title !== def.title) ? title.slice(0, 80) : null,
          text: (text && text !== def.text) ? text.slice(0, 3000) : null,
          max: (max >= 1 && max <= 20) ? max : def.max,
          chars: chars
        };
      }
      await db.doc('tramas/' + cur.id).set(body);
      docs[cur.id] = body;
      renderAll();
      var keep = chars.map(function (c) { return c.img; });
      var gone = cur.orig.filter(function (id) { return keep.indexOf(id) === -1; });
      busy = false; edSave.disabled = false;
      closeEd();
      if (assets) gone.forEach(function (id) { assets.delete(id).catch(function () {}); });
    } catch (e) {
      busy = false; edSave.disabled = false;
      edMsg.textContent = errText(e);
    }
  }

  async function removeTrama() {
    if (!cur || !cur.custom || cur.isNew || busy) return;
    if (!delArmed) { delArmed = true; edDelete.textContent = 'Toque de novo para excluir'; return; }
    busy = true; edSave.disabled = true; edDelete.disabled = true;
    edMsg.textContent = 'Excluindo…';
    try {
      await db.doc('tramas/' + cur.id).delete();
      var imgs = cur.orig.slice();
      delete docs[cur.id];
      renderAll();
      busy = false; edSave.disabled = false; edDelete.disabled = false;
      closeEd();
      if (assets) imgs.forEach(function (id) { assets.delete(id).catch(function () {}); });
    } catch (e) {
      busy = false; edSave.disabled = false; edDelete.disabled = false;
      edMsg.textContent = 'Não foi possível excluir. Tente de novo.';
    }
  }

  document.getElementById('ed-add').addEventListener('click', function () {
    if (!cur || cur.chars.length >= 20) return;
    cur.chars.push({ name: '', img: null, file: null, preview: null });
    drawList();
    var last = document.getElementById('ed-char-' + (cur.chars.length - 1));
    if (last) last.focus();
  });
  edName.addEventListener('input', function () { if (cur) edTitle.textContent = edName.value.trim() || (cur.isNew ? 'Adicionar trama' : ''); });
  edReset.addEventListener('click', function () {
    if (!cur || cur.custom) return;
    var def = TR[cur.id].def;
    edName.value = def.title; edText.value = def.text; edTitle.textContent = def.title;
  });
  document.getElementById('ed-cancel').addEventListener('click', closeEd);
  edSave.addEventListener('click', save);
  edDelete.addEventListener('click', removeTrama);
  ed.addEventListener('click', function (e) { if (e.target === ed) closeEd(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !ed.hidden) closeEd(); });
  addBtn.addEventListener('click', function () {
    openEd('n' + Date.now().toString(36) + Math.floor(Math.random() * 1000), addBtn, true);
  });

  var editMode = true;
  try { editMode = localStorage.getItem('ezra-editmode') !== 'off'; } catch (e) {}
  var hint = 'Você está vendo os botões de edição porque é o dono do site.';
  function applyEdit() {
    var on = canEdit && editMode;
    Object.keys(TR).forEach(function (id) { TR[id].el.querySelector('.edit').hidden = !on; });
    addBtn.hidden = !on;
    note(on ? hint : '');
  }
  window.__setEditMode = function (on) {
    editMode = !!on;
    try { localStorage.setItem('ezra-editmode', on ? 'on' : 'off'); } catch (e) {}
    applyEdit();
  };
  window.__getEditMode = function () { return editMode; };

  async function start() {
    var ctx = await CTX;
    db = ctx.db;
    if (!db) return;
    canEdit = ctx.owner;
    assets = ctx.assets;
    applyEdit();
    var timer = setTimeout(function () {
      if (canEdit && editMode) note('As edições das tramas ainda não carregaram. Confira a conexão.');
    }, 10000);
    db.collection('tramas').onSnapshot(function (snap) {
      if (!snap.metadata.fromCache) { clearTimeout(timer); applyEdit(); }
      var next = {};
      snap.docs.forEach(function (d) { if (d.exists) next[d.id] = d.data(); });
      docs = next;
      renderAll();
    }, function () {
      clearTimeout(timer);
      if (canEdit) note('Não foi possível carregar as edições das tramas.');
    });
  }
  start();
})();

/* Gadget da meta semanal (aba Tramas) */
(function () {
  var done = document.getElementById('goal-done');
  var of = document.getElementById('goal-of');
  var bar = document.getElementById('goal-bar');
  var fill = document.getElementById('goal-fill');
  var note = document.getElementById('goal-note');
  var week = document.getElementById('goal-week');
  function render() {
    var d = GOAL.doc || {}, goal = goalValue(d), wk = DT.weekKey(DT.today());
    var n = (d.week === wk && d.done >= 0) ? Math.min(Math.floor(d.done), 999) : 0;
    week.textContent = 'Semana de ' + DT.label(wk);
    done.textContent = n;
    of.textContent = 'de ' + goal + ' cenas';
    bar.hidden = false;
    bar.setAttribute('aria-valuemax', goal);
    bar.setAttribute('aria-valuenow', n);
    fill.style.width = Math.min(100, Math.round(n / goal * 100)) + '%';
    note.textContent = n >= goal ? 'Meta da semana batida.' : ('Faltam ' + (goal - n) + (goal - n === 1 ? ' cena' : ' cenas') + ' para a meta.');
  }
  GOAL.listeners.push(render);
  (async function () {
    var ctx = await CTX;
    if (!ctx.db) return;
    ctx.db.doc('public/goal').onSnapshot(function (s) {
      GOAL.doc = s.exists ? (s.data() || {}) : {};
      GOAL.ready = true;
      GOAL.listeners.forEach(function (f) { f(); });
    }, function () {});
  })();
})();

/* Aviso do player (público) */
(function () {
  var box = document.getElementById('notice'), txt = document.getElementById('notice-text');
  (async function () {
    var ctx = await CTX;
    if (!ctx.db) return;
    ctx.db.doc('public/notice').onSnapshot(function (s) {
      var d = s.exists ? (s.data() || {}) : {};
      var v = typeof d.text === 'string' ? d.text.trim().slice(0, 300) : '';
      window.__notice = v;
      txt.textContent = v;
      box.hidden = !v;
      var inp = document.getElementById('pn-notice');
      if (inp && document.activeElement !== inp) inp.value = v;
    }, function () {});
  })();
})();

/* Edição do site inteiro (só o dono) */
(function () {
  var els = Array.prototype.slice.call(document.querySelectorAll('[data-k]'));
  var figs = Array.prototype.slice.call(document.querySelectorAll('[data-pk]'));
  var ORIG = {}, state = { texts: {}, photos: {} }, ctx = null, on = false, chain = Promise.resolve();
  var bar = document.getElementById('editbar'), barMsg = document.getElementById('editbar-msg');
  var defMsg = barMsg.textContent;
  els.forEach(function (el) { ORIG[el.getAttribute('data-k')] = el.textContent; });
  function blobSrc(id) { return (typeof id === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(id)) ? window.Backend.photoUrl(id) : null; }

  function setPhoto(fig, src) {
    var img = fig.querySelector('img');
    var slot = fig.querySelector('.slot');
    if (!img) {
      img = document.createElement('img');
      img.alt = slot ? slot.textContent.replace('Foto a adicionar', '').trim() : '';
      if (slot) slot.replaceWith(img); else fig.insertBefore(img, fig.firstChild);
    }
    img.src = src;
  }
  function apply() {
    els.forEach(function (el) {
      var k = el.getAttribute('data-k');
      if (el === document.activeElement) return;
      var v = state.texts[k];
      el.textContent = (typeof v === 'string' && v.trim()) ? v.slice(0, 2000) : ORIG[k];
      el.classList.toggle('changed', typeof v === 'string' && !!v.trim());
    });
    figs.forEach(function (fig) {
      var src = blobSrc(state.photos[fig.getAttribute('data-pk')]);
      if (src) setPhoto(fig, src);
    });
  }
  function flash(msg) {
    barMsg.textContent = msg;
    clearTimeout(flash.t);
    flash.t = setTimeout(function () { barMsg.textContent = defMsg; }, 2500);
  }
  function save() {
    var body = { texts: Object.assign({}, state.texts), photos: Object.assign({}, state.photos) };
    chain = chain.then(function () { return ctx.db.doc('public/site').set(body); })
      .then(function () { flash('Salvo.'); }, function () { flash('Não foi possível salvar. Tente de novo.'); });
    return chain;
  }

  function onBlur(e) {
    var el = e.target, k = el.getAttribute('data-k');
    var v = (el.innerText || '').replace(/\s+/g, ' ').trim();
    var prev = state.texts[k];
    if (!v || v === ORIG[k]) {
      if (prev === undefined) { el.textContent = ORIG[k]; return; }
      delete state.texts[k];
      el.textContent = ORIG[k];
    } else {
      if (prev === v) return;
      state.texts[k] = v.slice(0, 2000);
    }
    el.classList.toggle('changed', !!state.texts[k]);
    save();
  }
  function onKey(e) { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } }

  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var s = Math.min(1, 1400 / Math.max(im.naturalWidth, im.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error('blob')); }, 'image/jpeg', 0.84);
      };
      im.onerror = function () { URL.revokeObjectURL(url); reject(new Error('img')); };
      im.src = url;
    });
  }
  figs.forEach(function (fig) {
    var k = fig.getAttribute('data-pk');
    var input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.className = 'photo-file'; input.id = 'photo-' + k;
    var lab = document.createElement('label');
    lab.className = 'btn photo-btn'; lab.setAttribute('for', input.id); lab.textContent = 'Trocar foto'; lab.hidden = true;
    fig.appendChild(input); fig.appendChild(lab);
    input.addEventListener('change', async function () {
      var f = input.files && input.files[0];
      if (!f || !ctx || !ctx.assets) return;
      flash('Enviando a foto…');
      try {
        var b = await shrink(f);
        var res = await ctx.assets.upload(b, { type: 'image/jpeg' });
        var old = state.photos[k];
        state.photos[k] = res.id;
        setPhoto(fig, res.url || window.Backend.photoUrl(res.id));
        await save();
        if (old && old !== res.id) ctx.assets.delete(old).catch(function () {});
      } catch (e) { flash('Não foi possível trocar a foto. Tente outra imagem.'); }
      input.value = '';
    });
  });

  function setOn(v) {
    on = !!v;
    document.body.classList.toggle('editing', on);
    bar.hidden = !on;
    els.forEach(function (el) {
      if (on) {
        el.setAttribute('contenteditable', 'plaintext-only');
        if (el.contentEditable !== 'plaintext-only') el.setAttribute('contenteditable', 'true');
        el.setAttribute('spellcheck', 'true');
        el.addEventListener('blur', onBlur); el.addEventListener('keydown', onKey);
      } else {
        el.removeAttribute('contenteditable');
        el.removeEventListener('blur', onBlur); el.removeEventListener('keydown', onKey);
      }
    });
    figs.forEach(function (fig) { fig.querySelector('.photo-btn').hidden = !(on && ctx && ctx.assets); });
    var b = document.getElementById('pn-siteedit');
    if (b) b.textContent = on ? 'Sair da edição do site' : 'Editar textos e fotos do site';
  }
  // links internos não navegam enquanto você edita um texto dentro deles
  document.addEventListener('click', function (e) {
    if (on && e.target.closest && e.target.closest('[data-k]')) e.preventDefault();
  }, true);
  document.getElementById('editbar-exit').addEventListener('click', function () {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    setOn(false);
  });
  document.getElementById('pn-siteedit').addEventListener('click', function () {
    var next = !on;
    setOn(next);
    if (next && window.__showTab) { window.__showTab('historia'); window.scrollTo({ top: 0 }); }
  });

  (async function () {
    ctx = await CTX;
    if (!ctx.db) return;
    ctx.db.doc('public/site').onSnapshot(function (s) {
      var d = s.exists ? (s.data() || {}) : {};
      state = {
        texts: (d.texts && typeof d.texts === 'object') ? Object.assign({}, d.texts) : {},
        photos: (d.photos && typeof d.photos === 'object') ? Object.assign({}, d.photos) : {}
      };
      apply();
    }, function () {});
  })();
})();

/* Painel do player */
(function () {
  var tab = document.getElementById('t-painel');
  var body = document.getElementById('pn-body');
  var lock = document.getElementById('pn-lock');
  var form = document.getElementById('lg-form');
  var fDate = document.getElementById('lg-date');
  var fQty = document.getElementById('lg-qty');
  var fWith = document.getElementById('lg-with');
  var fCtx = document.getElementById('lg-ctx');
  var fSave = document.getElementById('lg-save');
  var lgMsg = document.getElementById('lg-msg');
  var pnMsg = document.getElementById('pn-msg');
  var goalIn = document.getElementById('pn-goal');
  var editBox = document.getElementById('pn-editmode');
  var logBox = document.getElementById('pn-log');
  var db = null, col = null, entries = [], armed = null;

  function clean(d, id) {
    var q = parseInt(d.qty, 10);
    return {
      id: id,
      date: DT.parse(d.date) ? d.date : null,
      partner: typeof d.partner === 'string' ? d.partner.slice(0, 80) : '',
      context: typeof d.context === 'string' ? d.context.slice(0, 500) : '',
      qty: (q >= 1 && q <= 50) ? q : 1,
      created: Number(d.created) || 0
    };
  }
  function byWeek(list) {
    var m = {};
    list.forEach(function (e) {
      if (!e.date) return;
      var k = DT.weekKey(e.date);
      (m[k] = m[k] || { total: 0, items: [] });
      m[k].total += e.qty; m[k].items.push(e);
    });
    return m;
  }
  function el(tag, cls, text) { var x = document.createElement(tag); if (cls) x.className = cls; if (text != null) x.textContent = text; return x; }

  function render() {
    if (body.hidden) return;
    var goal = goalValue(GOAL.doc);
    if (document.activeElement !== goalIn) goalIn.value = goal;
    var wk = DT.weekKey(DT.today()), weeks = byWeek(entries);
    var cur = weeks[wk] || { total: 0, items: [] };
    document.getElementById('pn-week').textContent = cur.total + '/' + goal;
    document.getElementById('pn-week-l').textContent = DT.label(wk);
    var left = Math.max(goal - cur.total, 0);
    document.getElementById('pn-left').textContent = left;
    document.getElementById('pn-left-l').textContent = left ? (left === 1 ? 'cena para a meta' : 'cenas para a meta') : 'meta batida';
    var names = {};
    cur.items.forEach(function (e) { var k = e.partner.trim().toLowerCase(); if (k) names[k] = 1; });
    document.getElementById('pn-partners').textContent = Object.keys(names).length;
    var last4 = [0, 1, 2, 3].map(function (i) { var k = DT.addDays(wk, -7 * i); return weeks[k] ? weeks[k].total : 0; });
    var avg = last4.reduce(function (a, b) { return a + b; }, 0) / 4;
    document.getElementById('pn-avg').textContent = (Math.round(avg * 10) / 10).toString().replace('.', ',');
    var pb = document.getElementById('pn-bar');
    pb.setAttribute('aria-valuemax', goal); pb.setAttribute('aria-valuenow', cur.total);
    document.getElementById('pn-fill').style.width = Math.min(100, Math.round(cur.total / goal * 100)) + '%';

    // gráfico das últimas 8 semanas
    var keys = []; for (var i = 7; i >= 0; i--) keys.push(DT.addDays(wk, -7 * i));
    var vals = keys.map(function (k) { return weeks[k] ? weeks[k].total : 0; });
    var top = Math.max(goal, Math.max.apply(null, vals), 1);
    var chart = document.getElementById('pn-chart'), labels = document.getElementById('pn-chart-l');
    chart.textContent = ''; labels.textContent = '';
    var line = el('div', 'goal-line'); line.style.bottom = (goal / top * 100) + '%';
    line.appendChild(el('span', null, 'meta ' + goal));
    chart.appendChild(line);
    keys.forEach(function (k, i) {
      var c = el('div', 'wk' + (vals[i] >= goal ? ' met' : '') + (k === wk ? ' now' : ''));
      c.appendChild(el('b', null, vals[i]));
      var bar = el('i'); bar.style.height = (vals[i] / top * 100) + '%';
      c.appendChild(bar);
      c.title = DT.label(k) + ': ' + vals[i] + ' cenas';
      chart.appendChild(c);
      labels.appendChild(el('span', null, DT.short(k)));
    });

    // histórico
    logBox.textContent = '';
    var ks = Object.keys(weeks).sort().reverse();
    if (!ks.length) { logBox.appendChild(el('p', 'empty', 'Nenhuma cena registrada ainda.')); return; }
    ks.forEach(function (k) {
      var w = weeks[k], box = el('div', 'log-week');
      var h = el('h4', null, DT.label(k));
      h.appendChild(el('small', null, w.total + (w.total === 1 ? ' cena' : ' cenas') + ' · meta ' + goal));
      box.appendChild(h);
      w.items.sort(function (a, b) { return (b.date + b.created) > (a.date + a.created) ? 1 : -1; });
      w.items.forEach(function (e) {
        var row = el('div', 'log-row');
        row.appendChild(el('span', 'd', DT.short(e.date)));
        var mid = el('div');
        mid.appendChild(el('div', 'w', e.partner || 'Sem parceiro informado'));
        if (e.context) mid.appendChild(el('p', 'c', e.context));
        row.appendChild(mid);
        var q = el('div', 'q', e.qty + (e.qty === 1 ? ' cena' : ' cenas'));
        q.appendChild(document.createElement('br'));
        var del = el('button', 'btn', armed === e.id ? 'Confirmar' : 'Apagar');
        del.type = 'button';
        del.addEventListener('click', function () { removeEntry(e.id); });
        q.appendChild(del);
        row.appendChild(q);
        box.appendChild(row);
      });
      logBox.appendChild(box);
    });
  }

  async function pushSummary(list) {
    var wk = DT.weekKey(DT.today()), goal = goalValue(GOAL.doc);
    var done = list.reduce(function (a, e) { return a + (e.date && DT.weekKey(e.date) === wk ? e.qty : 0); }, 0);
    var d = GOAL.doc || {};
    if (d.goal === goal && d.week === wk && d.done === done) return;
    await db.doc('public/goal').set({ goal: goal, week: wk, done: done });
  }

  form.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    if (!col) return;
    var date = fDate.value, qty = parseInt(fQty.value, 10);
    if (!DT.parse(date)) { lgMsg.textContent = 'Escolha a data da cena.'; fDate.focus(); return; }
    if (!(qty >= 1 && qty <= 50)) { lgMsg.textContent = 'A quantidade vai de 1 a 50 cenas.'; fQty.focus(); return; }
    var entry = { date: date, partner: fWith.value.trim().slice(0, 80), context: fCtx.value.trim().slice(0, 500), qty: qty, created: Date.now() };
    fSave.disabled = true; lgMsg.textContent = 'Salvando…';
    try {
      await col.add(entry);
      var list = entries.concat([clean(entry, 'novo')]);
      await pushSummary(list);
      fWith.value = ''; fCtx.value = ''; fQty.value = 1;
      lgMsg.textContent = 'Cena registrada.';
    } catch (e) {
      lgMsg.textContent = (e && e.code === 'quota_exceeded') ? 'O espaço do registro encheu. Apague cenas antigas e tente de novo.' : 'Não foi possível registrar. Tente de novo.';
    }
    fSave.disabled = false;
  });

  async function removeEntry(id) {
    if (armed !== id) { armed = id; render(); return; }
    armed = null;
    try {
      await col.doc(id).delete();
      await pushSummary(entries.filter(function (e) { return e.id !== id; }));
    } catch (e) { pnMsg.textContent = 'Não foi possível apagar. Tente de novo.'; }
  }

  document.getElementById('pn-goal-save').addEventListener('click', async function () {
    var g = parseInt(goalIn.value, 10);
    if (!(g >= 1 && g <= 100)) { pnMsg.textContent = 'A meta vai de 1 a 100 cenas por semana.'; return; }
    var wk = DT.weekKey(DT.today());
    var done = entries.reduce(function (a, e) { return a + (e.date && DT.weekKey(e.date) === wk ? e.qty : 0); }, 0);
    pnMsg.textContent = 'Salvando…';
    try { await db.doc('public/goal').set({ goal: g, week: wk, done: done }); pnMsg.textContent = 'Meta salva. Ela já aparece na aba Tramas.'; }
    catch (e) { pnMsg.textContent = 'Não foi possível salvar a meta. Tente de novo.'; }
  });

  editBox.addEventListener('change', function () { if (window.__setEditMode) window.__setEditMode(editBox.checked); });

  var noticeIn = document.getElementById('pn-notice');
  async function saveNotice(text) {
    if (!db) return;
    if ((window.__notice || '') === text) { pnMsg.textContent = text ? 'O aviso já está assim.' : 'Não há aviso no site.'; return; }
    pnMsg.textContent = 'Salvando…';
    try { await db.doc('public/notice').set({ text: text }); pnMsg.textContent = text ? 'Aviso publicado no topo do site.' : 'Aviso retirado do site.'; }
    catch (e) { pnMsg.textContent = 'Não foi possível salvar o aviso. Tente de novo.'; }
  }
  document.getElementById('pn-notice-save').addEventListener('click', function () { saveNotice(noticeIn.value.trim().slice(0, 300)); });
  document.getElementById('pn-notice-clear').addEventListener('click', function () { noticeIn.value = ''; saveNotice(''); });

  (async function () {
    var ctx = await CTX;
    if (!ctx.owner || !ctx.db) return;
    db = ctx.db;
    tab.hidden = false;
    lock.hidden = true;
    body.hidden = false;
    fDate.value = DT.today();
    if (window.__getEditMode) editBox.checked = window.__getEditMode();
    if (location.hash === '#painel' && window.__showTab) window.__showTab('painel');
    GOAL.listeners.push(render);
    render();
    if (!ctx.uid) {
      lgMsg.textContent = 'Não foi possível identificar sua conta para guardar o registro. Recarregue a página.';
      fSave.disabled = true;
      return;
    }
    col = db.doc('data/users/' + ctx.uid + '/log').collection('scenes');
    var timer = setTimeout(function () { pnMsg.textContent = 'O registro ainda não carregou. Confira a conexão.'; }, 10000);
    col.orderBy('date', 'desc').limit(1000).onSnapshot(function (snap) {
      if (!snap.metadata.fromCache) { clearTimeout(timer); if (/carregou/.test(pnMsg.textContent)) pnMsg.textContent = ''; }
      entries = snap.docs.filter(function (d) { return d.exists; }).map(function (d) { return clean(d.data() || {}, d.id); });
      render();
    }, function () { clearTimeout(timer); pnMsg.textContent = 'Não foi possível carregar o registro de cenas.'; });
  })();
})();

/* Login do player */
(function () {
  var box = document.getElementById('login'), form = document.getElementById('login-form');
  var email = document.getElementById('login-email'), pass = document.getElementById('login-pass');
  var msg = document.getElementById('login-msg'), go = document.getElementById('login-go');
  var link = document.getElementById('foot-login');
  function open() { box.hidden = false; document.body.style.overflow = 'hidden'; msg.textContent = ''; email.focus(); }
  function close() { box.hidden = true; document.body.style.overflow = ''; pass.value = ''; }
  link.addEventListener('click', function (e) { e.preventDefault(); open(); });
  document.getElementById('login-cancel').addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !box.hidden) close(); });
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!email.value.trim() || !pass.value) { msg.textContent = 'Preencha o e-mail e a senha.'; return; }
    go.disabled = true; msg.textContent = 'Entrando…';
    var r = await window.Backend.signIn(email.value.trim(), pass.value);
    go.disabled = false;
    if (!r.ok) { msg.textContent = r.message; pass.value = ''; return; }
    location.hash = 'painel'; location.reload();
  });
  document.getElementById('pn-logout').addEventListener('click', async function () {
    await window.Backend.signOut(); location.hash = ''; location.reload();
  });
  CTX.then(function (ctx) { if (ctx.owner) link.hidden = true; });
  if (location.hash === '#entrar') open();
})();
