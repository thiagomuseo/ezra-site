/*
 * Ligação do site com o Supabase.
 * Guarda textos, tramas, meta e registro de cenas na tabela "docs" e as fotos no bucket "fotos".
 * Quem pode ler e escrever é decidido pelas regras do banco (arquivo supabase/setup.sql), não por este código.
 */
(function () {
  var cfg = window.EZRA_CONFIG || {};
  var ready = !!(window.supabase && cfg.url && cfg.anonKey && /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cfg.url));
  var sb = ready ? window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  }) : null;

  function photoUrl(id) {
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) return null;
    return cfg.url + '/storage/v1/object/public/fotos/' + id + '.jpg';
  }
  function newId(len) {
    var a = new Uint8Array(len || 20), s = '', abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
    crypto.getRandomValues(a);
    for (var i = 0; i < a.length; i++) s += abc[a[i] % abc.length];
    return s;
  }
  function err(e) {
    var code = 'unavailable';
    if (e && (e.code === '42501' || e.code === 'PGRST301' || /row-level security|permission/i.test(e.message || ''))) code = 'invalid_argument';
    if (e && /too large|payload/i.test(e.message || '')) code = 'too_large';
    return { code: code, message: (e && e.message) || 'erro' };
  }
  function escLike(s) { return s.replace(/[\\%_]/g, '\\$&'); }

  // "Escutas": o site recarrega os dados ao abrir, depois de cada gravação, ao voltar para a aba e a cada minuto.
  var listeners = [];
  function snap(path, row) {
    return {
      id: path.split('/').pop(), exists: !!row,
      data: function () { return row ? row.data : undefined; },
      metadata: { fromCache: false, hasPendingWrites: false }
    };
  }
  async function getDoc(path) {
    var r = await sb.from('docs').select('path,data').eq('path', path).maybeSingle();
    if (r.error) throw err(r.error);
    return r.data;
  }
  async function getCol(path) {
    var depth = path.split('/').length + 1;
    var r = await sb.from('docs').select('path,data').like('path', escLike(path) + '/%').limit(2000);
    if (r.error) throw err(r.error);
    return (r.data || []).filter(function (x) { return x.path.split('/').length === depth; });
  }
  async function refresh(l) {
    try {
      if (l.kind === 'doc') { l.fn(snap(l.path, await getDoc(l.path))); return; }
      var docs = (await getCol(l.path)).map(function (x) { return snap(x.path, x); });
      if (l.order) {
        var f = l.order.f, dir = l.order.dir === 'desc' ? -1 : 1;
        docs.sort(function (a, b) {
          var x = (a.data() || {})[f], y = (b.data() || {})[f];
          return (x > y ? 1 : x < y ? -1 : 0) * dir;
        });
      }
      if (l.limit) docs = docs.slice(0, l.limit);
      l.fn({ docs: docs, size: docs.length, empty: !docs.length, metadata: { fromCache: false, hasPendingWrites: false }, docChanges: function () { return []; } });
    } catch (e) { if (l.err) l.err(e); }
  }
  function notify() { listeners.forEach(refresh); }
  setInterval(function () { if (!document.hidden) notify(); }, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) notify(); });
  function listen(l) {
    listeners.push(l); refresh(l);
    return function () { var i = listeners.indexOf(l); if (i > -1) listeners.splice(i, 1); };
  }

  function docRef(path) {
    return {
      id: path.split('/').pop(), path: path,
      get: async function () { return snap(path, await getDoc(path)); },
      set: async function (data) {
        var r = await sb.from('docs').upsert({ path: path, data: data, updated_at: new Date().toISOString() });
        if (r.error) throw err(r.error);
        notify();
      },
      update: async function (data) {
        var cur = await getDoc(path);
        if (!cur) throw { code: 'invalid_argument', message: 'documento inexistente' };
        return this.set(Object.assign({}, cur.data, data));
      },
      delete: async function () {
        var r = await sb.from('docs').delete().eq('path', path);
        if (r.error) throw err(r.error);
        notify();
      },
      onSnapshot: function (fn, e) { return listen({ kind: 'doc', path: path, fn: fn, err: e }); },
      collection: function (c) { return colRef(path + '/' + c); }
    };
  }
  function colRef(path, order, limit) {
    return {
      path: path,
      orderBy: function (f, dir) { return colRef(path, { f: f, dir: dir }, limit); },
      limit: function (n) { return colRef(path, order, n); },
      doc: function (id) { return docRef(path + '/' + (id || newId())); },
      add: async function (data) { var d = docRef(path + '/' + newId()); await d.set(data); return d; },
      onSnapshot: function (fn, e) { return listen({ kind: 'col', path: path, fn: fn, err: e, order: order, limit: limit }); }
    };
  }

  var assets = {
    upload: async function (blob) {
      var id = newId(32);
      var r = await sb.storage.from('fotos').upload(id + '.jpg', blob, { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' });
      if (r.error) throw err(r.error);
      return { id: id, url: photoUrl(id) };
    },
    delete: async function (id) {
      if (!photoUrl(id)) return { deleted: false };
      var r = await sb.storage.from('fotos').remove([id + '.jpg']);
      if (r.error) throw err(r.error);
      return { deleted: true };
    }
  };

  var ctx = (async function () {
    var c = { db: null, user: null, owner: false, uid: null, assets: null };
    if (!ready) { console.warn('Configure js/config.js com a URL e a chave pública do Supabase.'); return c; }
    c.db = { doc: docRef, collection: colRef };
    var s = await sb.auth.getSession();
    if (s.data && s.data.session) {
      var r = await sb.rpc('is_owner');
      c.owner = !r.error && r.data === true;
    }
    if (c.owner) { c.uid = 'owner'; c.assets = assets; }
    c.user = {
      isOwner: async function () { return c.owner; },
      canEdit: async function () { return c.owner; },
      id: async function () { return c.uid; }
    };
    return c;
  })();

  async function signIn(email, password) {
    if (!sb) return { ok: false, message: 'O site ainda não foi configurado.' };
    var r = await sb.auth.signInWithPassword({ email: email, password: password });
    if (r.error) {
      var tooMany = /rate|too many/i.test(r.error.message || '');
      return { ok: false, message: tooMany ? 'Muitas tentativas. Espere alguns minutos e tente de novo.' : 'E-mail ou senha incorretos.' };
    }
    var o = await sb.rpc('is_owner');
    if (o.error || o.data !== true) {
      await sb.auth.signOut();
      return { ok: false, message: 'Esta conta não tem acesso ao painel.' };
    }
    return { ok: true };
  }
  async function signOut() { if (sb) await sb.auth.signOut(); }

  window.Backend = { ctx: ctx, photoUrl: photoUrl, signIn: signIn, signOut: signOut };
})();
