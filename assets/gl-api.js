/* G-LOVE 受付データベース（Supabase）との通信部品。
   ログイン・二段階認証・表の読み書き・関数の呼出し・写真の保管を扱う。
   接続先は config.js の supabaseUrl / supabaseAnonKey（公開してよい鍵）。 */
(function(){
  var C = window.GLOVE_CONFIG || {};
  var STORE = 'gl-session';
  var GL = { url: (C.supabaseUrl || '').replace(/\/$/, ''), key: C.supabaseAnonKey || '', session: null };
  GL.configured = !!(GL.url && GL.key);

  // keep：この端末にログインを残す（お客様用）。担当者用は画面を閉じるとログアウトする
  var KEEP = false;
  function box(){ try{ return KEEP ? localStorage : sessionStorage; }catch(e){ return null; } }
  GL.useStore = function(name, keep){ STORE = name; KEEP = !!keep; try{ GL.session = JSON.parse(box().getItem(STORE) || 'null'); }catch(e){ GL.session = null; } };
  function save(s){ GL.session = s; try{ s ? box().setItem(STORE, JSON.stringify(s)) : box().removeItem(STORE); }catch(e){} }
  function claims(tok){ try{ var p = tok.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'); return JSON.parse(decodeURIComponent(escape(atob(p)))); }catch(e){ return {}; } }
  GL.claims = function(){ return GL.session ? claims(GL.session.access_token) : {}; };
  GL.aal = function(){ return GL.claims().aal || null; };
  GL.userId = function(){ return GL.claims().sub || null; };
  GL.email = function(){ return GL.claims().email || null; };

  function msg(j, status){
    var m = j && (j.message || j.msg || j.error_description || j.error || j.hint);
    if(!m) m = '通信に失敗しました（' + status + '）';
    if(/Invalid login credentials/i.test(m)) m = 'メールアドレスまたはパスワードが違います';
    if(/Token has expired or is invalid|otp_expired|invalid.*token/i.test(m)) m = '確認コードが違うか、有効期限が切れています';
    if(/JWT expired/i.test(m)) m = 'ログインの有効期限が切れました。もう一度ログインしてください';
    if(/rate limit|too many/i.test(m)) m = '短時間に操作が集中しました。少し時間をおいてください';
    return m;
  }
  async function raw(method, path, body, headers, auth){
    if(!GL.configured) { var e0 = new Error('受付システムが未接続です'); e0.code = 'unconfigured'; throw e0; }
    if(auth !== false) await GL.ensureFresh();
    var h = Object.assign({ apikey: GL.key, Authorization: 'Bearer ' + ((auth !== false && GL.session) ? GL.session.access_token : GL.key) }, headers || {});
    var isBlob = (typeof Blob !== 'undefined') && body instanceof Blob;
    if(body !== undefined && !isBlob && !h['Content-Type']) h['Content-Type'] = 'application/json';
    var r;
    try{ r = await fetch(GL.url + path, { method: method, headers: h, body: body === undefined ? undefined : (isBlob ? body : JSON.stringify(body)) }); }
    catch(e){ var en = new Error('通信できませんでした。電波の状況をご確認ください'); en.code = 'network'; throw en; }
    var txt = await r.text(), j = null; try{ j = txt ? JSON.parse(txt) : null; }catch(e){ j = txt; }
    if(!r.ok){ var er = new Error(msg(j, r.status)); er.status = r.status; er.code = 'http'; throw er; }
    return j;
  }
  GL.raw = raw;

  // ── ログイン ──
  function adopt(j){ if(!j || !j.access_token) throw new Error('ログインできませんでした'); j.expires_at = Math.floor(Date.now()/1000) + (j.expires_in || 3600); save(j); return j; }
  GL.signInPassword = async function(email, password){ return adopt(await raw('POST', '/auth/v1/token?grant_type=password', { email: email, password: password }, null, false)); };
  // redirectTo を渡すと、メールのボタンを押すだけでログインできる（6桁のコードでも可）
  GL.sendOtp = async function(email, redirectTo){ return raw('POST', '/auth/v1/otp' + (redirectTo ? '?redirect_to=' + encodeURIComponent(redirectTo) : ''), { email: email, create_user: true }, null, false); };
  // メールのボタンから戻ってきたとき（アドレスの # 以降にログイン情報が付く）
  GL.fromLink = function(){
    var h = location.hash.replace(/^#/, ''); if(!/access_token=|error_description=/.test(h)) return null;
    var q = {}; h.split('&').forEach(function(kv){ var i = kv.indexOf('='); if(i > 0) q[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); });
    try{ history.replaceState(null, '', location.pathname + location.search); }catch(e){ location.hash = ''; }
    if(q.error_description) return { error: /expired|invalid/i.test(q.error_description) ? 'ログイン用のボタンの有効期限が切れています。もう一度メールを受け取ってください' : 'ログインできませんでした。もう一度メールを受け取ってください' };
    adopt({ access_token: q.access_token, refresh_token: q.refresh_token, expires_in: Number(q.expires_in) || 3600 }); return { ok: true };
  };
  GL.verifyOtp = async function(email, code){ return adopt(await raw('POST', '/auth/v1/verify', { type: 'email', email: email, token: code }, null, false)); };
  GL.ensureFresh = async function(){
    var s = GL.session; if(!s) return;
    if(s.expires_at && s.expires_at - 60 > Date.now()/1000) return;
    try{ adopt(await raw('POST', '/auth/v1/token?grant_type=refresh_token', { refresh_token: s.refresh_token }, null, false)); }
    catch(e){ save(null); throw new Error('ログインの有効期限が切れました。もう一度ログインしてください'); }
  };
  GL.signOut = async function(){ try{ await raw('POST', '/auth/v1/logout', {}); }catch(e){} save(null); };
  GL.user = async function(){ return raw('GET', '/auth/v1/user'); };
  GL.setPassword = function(pw){ return raw('PUT', '/auth/v1/user', { password: pw }); };

  // ── 二段階認証（認証アプリの6桁コード） ──
  GL.mfaFactors = async function(){ var u = await GL.user(); return (u.factors || []).filter(function(f){ return f.factor_type === 'totp'; }); };
  GL.mfaEnroll = async function(){ return raw('POST', '/auth/v1/factors', { factor_type: 'totp', friendly_name: 'G-LOVE ' + new Date().toISOString().slice(0,10) }); };
  GL.mfaUnenroll = function(factorId){ return raw('DELETE', '/auth/v1/factors/' + factorId); };
  GL.mfaVerify = async function(factorId, code){
    var ch = await raw('POST', '/auth/v1/factors/' + factorId + '/challenge', {});
    var j = await raw('POST', '/auth/v1/factors/' + factorId + '/verify', { challenge_id: ch.id, code: code });
    j.refresh_token = j.refresh_token || GL.session.refresh_token; return adopt(j);
  };

  // ── 表と関数 ──
  function qs(p){ var u = new URLSearchParams(); Object.keys(p || {}).forEach(function(k){ if(p[k] !== undefined && p[k] !== null) u.append(k, p[k]); }); var s = u.toString(); return s ? '?' + s : ''; }
  GL.select = function(table, p){ return raw('GET', '/rest/v1/' + table + qs(Object.assign({ select: '*' }, p))); };
  GL.insert = async function(table, row){ var j = await raw('POST', '/rest/v1/' + table, row, { Prefer: 'return=representation' }); return Array.isArray(j) ? j[0] : j; };
  GL.update = async function(table, match, patch){
    var p = {}; Object.keys(match).forEach(function(k){ p[k] = 'eq.' + match[k]; });
    var j = await raw('PATCH', '/rest/v1/' + table + qs(p), patch, { Prefer: 'return=representation' });
    if(Array.isArray(j) && j.length === 0) throw new Error('変更する権限がないか、対象が見つかりません');
    return Array.isArray(j) ? j[0] : j;
  };
  GL.fn = function(name, body){ return raw('POST', '/functions/v1/' + name, body); };
  GL.rpc = function(fn, args, anon){ return raw('POST', '/rest/v1/rpc/' + fn, args || {}, null, anon ? false : undefined); };

  // ── 写真の保管 ──
  // withLogin：ログイン中の人として送る（身分証の画像など）。省略時は申込時の写真と同じく、ログインなしで送る
  GL.upload = function(bucket, path, file, withLogin){ return raw('POST', '/storage/v1/object/' + bucket + '/' + path, file, { 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'false' }, withLogin ? undefined : false); };
  GL.list = function(bucket, prefix){ return raw('POST', '/storage/v1/object/list/' + bucket, { prefix: prefix, limit: 50, sortBy: { column: 'name', order: 'asc' } }); };
  GL.signedUrl = async function(bucket, path){ var j = await raw('POST', '/storage/v1/object/sign/' + bucket + '/' + path, { expiresIn: 600 }); return GL.url + '/storage/v1' + (j.signedURL || j.signedUrl); };

  GL.useStore(STORE);
  window.GL = GL;
})();
