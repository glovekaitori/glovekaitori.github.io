/* G-LOVE 管理画面 */
(function(){
'use strict';
var $ = function(s, r){ return (r || document).querySelector(s); };
var root = document.getElementById('root');
function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function dt(v){ if(!v) return '—'; var d = new Date(v); return d.toLocaleString('ja-JP', {timeZone:'Asia/Tokyo', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'}); }
function day(v){ if(!v) return '—'; return new Date(v).toLocaleDateString('ja-JP', {timeZone:'Asia/Tokyo'}); }
function yen(n){ return n == null ? '—' : '¥' + Number(n).toLocaleString('ja-JP'); }
function toast(m, bad){ var t = document.createElement('div'); t.className = 'toast' + (bad ? ' bad' : ''); t.setAttribute('role', bad ? 'alert' : 'status'); t.textContent = m; document.body.appendChild(t); setTimeout(function(){ t.remove(); }, bad ? 6000 : 3000); }
function formData(f){ var o = {}; new FormData(f).forEach(function(v, k){ o[k] = typeof v === 'string' ? v.trim() : v; }); f.querySelectorAll('input[type=checkbox]').forEach(function(c){ o[c.name] = c.checked; }); return o; }
async function safe(p){ try{ return await p; }catch(e){ return []; } }

// ── 表示名 ──
var STATUS = { received:['受付','info'], contacting:['連絡中','info'], identity_pending:['本人確認待ち','warn'], pickup_arranging:['集荷手配中','info'],
  in_transit:['輸送中','info'], goods_received:['受領済','info'], appraising:['査定中','info'], appraisal_notified:['査定通知済','gold'],
  return_scheduled:['返却予定通知済','warn'], approved:['承認','ok'], partially_approved:['一部承認','ok'], declined:['辞退','bad'],
  contracted:['契約成立','ok'], paid:['振込済','ok'], returning:['返却中','warn'], returned:['返却済',''], closed:['完了',''], cancelled:['取消','bad'] };
var MANUAL = ['received','contacting','identity_pending','pickup_arranging','in_transit','goods_received','appraising','returning','returned','closed','cancelled'];
var ROLE = { admin:'管理者', reception:'受付', appraiser:'査定', finance:'経理', sales:'営業' };
var COMPANY = { management_advisers:'マネージメントアドバイザーズ', glove:'グローブ' };
var APPLICANT = { self:'本人', agent:'代理人', corporate_staff:'法人担当者' };
var SUBJECT = { seller:'売主', agent:'代理人', corporate_staff:'法人の担当者' };
var METHOD = {
  honnin_gentei_yubin:'本人限定受取郵便で連絡し到達を確認', honnin_gentei_daikin:'本人限定受取郵便で代金を送付',
  juminhyo_kakitome:'住民票の写し等＋転送不要書留で到達確認', juminhyo_koza:'住民票の写し等＋記載名義の口座へ入金',
  mibun_copy_kakitome_koza:'身分証の写し＋転送不要書留＋同名義口座へ入金', mibun_copy_2ten_kakitome:'身分証の写し2点（又は1点＋公共料金領収書）＋転送不要書留',
  inkan_shomei:'印鑑登録証明書＋登録印を押した書面', denshi_shomei_mail:'電子署名付きメール', jpki:'公的個人認証（マイナンバーカード）',
  tokutei_ninsho:'特定認証業務の電子証明書', id_password:'確認済みの方のID・パスワード', soft_image_kakitome:'自社の仕組みで身分証画像＋転送不要書留',
  ic_chip_kakitome:'ICチップ情報＋転送不要書留', soft_yobo_image:'自社の仕組みで容貌画像＋写真付き身分証画像', soft_yobo_ic:'自社の仕組みで容貌画像＋写真付きICチップ情報',
  other_legal:'その他（施行規則に定める方法）' };
var CKIND = { sale:'売買契約', mandate:'委任状', nda:'秘密保持契約', receipt:'受領書' };
var PAY = { draft:['承認待ち','info'], needs_review:['要確認（名義）','warn'], approved:['承認済・未実行','gold'], paid:['振込済','ok'], cancelled:['取消','bad'] };
function pill(map, k){ var v = map[k] || [k, '']; return '<span class="pill ' + v[1] + '">' + esc(v[0]) + '</span>'; }

var S = { me: null, staff: [], seq: 0 };
function can(){ if(!S.me) return false; if(S.me.role === 'admin') return true; for(var i = 0; i < arguments.length; i++) if(S.me.role === arguments[i]) return true; return false; }

// ============ ログイン ============
function viewLogin(msg){
  root.innerHTML = '<div class="login"><form class="box" id="lf"><b>G-LOVE</b><p style="margin:0;color:var(--mute)">担当者用の管理画面です。</p>'
    + '<label class="l">メールアドレス<input type="email" name="email" id="lf-email" autocomplete="username" required></label>'
    + '<label class="l">パスワード<input type="password" name="password" id="lf-pass" autocomplete="current-password" required></label>'
    + '<p class="err" id="lf-err">' + esc(msg || '') + '</p><button class="btn" type="submit">ログイン</button></form></div>';
  $('#lf').addEventListener('submit', async function(e){
    e.preventDefault(); var f = formData(e.target), err = $('#lf-err'); err.textContent = '';
    try{ await GL.signInPassword(f.email, f.password); await afterPassword(); }catch(x){ err.textContent = x.message; }
  });
}
async function afterPassword(){
  var fs = await GL.mfaFactors(), v = fs.filter(function(f){ return f.status === 'verified'; });
  if(v.length) return viewMfa(v[0].id, null);
  for(var i = 0; i < fs.length; i++){ try{ await GL.mfaUnenroll(fs[i].id); }catch(e){} }
  var en = await GL.mfaEnroll(); viewMfa(en.id, en);
}
function viewMfa(fid, enroll){
  root.innerHTML = '<div class="login"><form class="box" id="mf"><b>G-LOVE</b>'
    + (enroll ? '<p style="margin:0">初回のみ、二段階認証を設定します。スマートフォンの認証アプリ（Google Authenticator など）でこのコードを読み取ってください。</p>'
      + '<div class="qr"><img alt="二段階認証の設定コード" src="' + esc(/^data:/.test(enroll.totp.qr_code) ? enroll.totp.qr_code : 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(enroll.totp.qr_code)) + '"></div>'
      + '<p style="margin:0;font-size:12px;color:var(--mute)">読み取れない場合の手入力キー：<span class="mono">' + esc(enroll.totp.secret) + '</span></p>'
      : '<p style="margin:0">認証アプリに表示されている6桁のコードを入力してください。</p>')
    + '<label class="l">6桁のコード<input name="code" id="mf-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required></label>'
    + '<p class="err" id="mf-err"></p><button class="btn" type="submit">確認する</button><button class="btn sub" type="button" id="mf-out">別のアカウントでログイン</button></form></div>';
  $('#mf-code').focus();
  $('#mf-out').addEventListener('click', async function(){ await GL.signOut(); viewLogin(); });
  $('#mf').addEventListener('submit', async function(e){
    e.preventDefault(); var err = $('#mf-err'); err.textContent = '';
    try{ await GL.mfaVerify(fid, formData(e.target).code); await start(); }catch(x){ err.textContent = /Invalid TOTP/i.test(x.message) ? 'コードが違います。もう一度お試しください' : x.message; }
  });
}

// ============ 骨組み ============
var NAV = [
  ['support','サポート', function(){ return can('reception'); }],
  ['faq','自動応答', function(){ return can('reception'); }],
  ['cases','案件', function(){ return can('reception','appraiser','finance'); }],
  ['contacts','問い合わせ', function(){ return can('reception'); }],
  ['codes','紹介コード', function(){ return can('sales','reception'); }],
  ['payments','振込', function(){ return can('finance'); }],
  ['ledger','古物台帳', function(){ return can('appraiser','finance'); }],
  ['rates','掛率の設定', function(){ return can('appraiser','finance'); }],
  ['resale','再販・粗利', function(){ return can('appraiser','finance'); }],
  ['summary','集計', function(){ return true; }],
  ['staff','担当者', function(){ return can(); }],
  ['audit','操作履歴', function(){ return can(); }],
  ['backup','バックアップ', function(){ return can(); }],
  ['health','接続の確認', function(){ return can(); }],
  ['account','パスワード変更', function(){ return true; }]
];
async function start(){
  if(GL.aal() !== 'aal2'){ return afterPassword(); }
  var me = await GL.select('staff', { user_id: 'eq.' + GL.userId() });
  if(!me.length || !me[0].active){ root.innerHTML = '<div class="login"><div class="box"><b>G-LOVE</b><p>このアカウントは担当者として登録されていないか、停止されています。管理者にご確認ください。</p><button class="btn sub" id="o">ログアウト</button></div></div>'; $('#o').onclick = async function(){ await GL.signOut(); viewLogin(); }; return; }
  S.me = me[0]; S.staff = await safe(GL.select('staff', { order: 'name.asc' }));
  root.innerHTML = '<div class="app"><aside class="side" id="side"><div class="brand"><b>G-LOVE</b><small>管理画面</small></div><nav id="nav"></nav>'
    + '<div class="me"><span>' + esc(S.me.name) + '（' + esc(ROLE[S.me.role]) + '・' + esc(COMPANY[S.me.company]) + '）</span><button class="btn sub sm" id="logout">ログアウト</button></div></aside>'
    + '<main class="main" id="main"></main></div>';
  $('#logout').onclick = async function(){ await GL.signOut(); location.hash = ''; viewLogin('ログアウトしました'); };
  window.onhashchange = route; route();
  var beat = function(){ if(!document.hidden) GL.rpc('staff_heartbeat', {}).catch(function(){}); }; beat(); setInterval(beat, 30000);
  if(can('reception')){ var cnt = async function(){ if(document.hidden) return; try{ var t = await GL.select('support_threads', { select: 'id,last_customer_at,last_staff_at', status: 'eq.open', mode: 'eq.staff', limit: 500 });
      var n = t.filter(function(x){ return !x.last_staff_at || new Date(x.last_customer_at) > new Date(x.last_staff_at); }).length; S.waiting = n;
      var a = document.querySelector('#nav a[href="#support"]'); if(a){ var b = a.querySelector('.cnt'); if(n && !b){ b = document.createElement('span'); b.className = 'cnt'; a.appendChild(b); } if(b){ if(n) b.textContent = n; else b.remove(); } }
      document.title = (n ? '(' + n + ') ' : '') + 'G-LOVE 管理画面'; }catch(e){} }; cnt(); setInterval(cnt, 15000); }
}
function renderNav(cur){
  $('#nav').innerHTML = NAV.filter(function(n){ return n[2](); }).map(function(n){ return '<a href="#' + n[0] + '" class="' + (cur === n[0] ? 'on' : '') + '">' + n[1] + (n[0] === 'support' && S.waiting ? '<span class="cnt">' + S.waiting + '</span>' : '') + '</a>'; }).join('');
}
function top(title, extra){ return '<div class="top"><div class="btns"><button class="btn sub sm menu-t" type="button" data-menu>メニュー</button><h1>' + title + '</h1></div><div class="btns">' + (extra || '') + '</div></div>'; }
async function route(){
  S.seq++;
  var h = (location.hash || '').slice(1), parts = h.split('/'), m = $('#main');
  var first = NAV.filter(function(n){ return n[2](); })[0][0];
  var key = parts[0] || first; renderNav(key === 'case' || key === 'sheet' ? 'cases' : key);
  $('#side').classList.remove('open');
  m.onclick = null; m.onchange = null; m.onsubmit = null; m.oninput = null;
  if(!m.dataset.menuBound){ m.dataset.menuBound = '1'; m.addEventListener('click', function(e){ if(e.target.closest('[data-menu]')) $('#side').classList.toggle('open'); }); }
  m.innerHTML = '<p class="empty">読み込んでいます…</p>';
  try{
    if(key === 'case') return await viewCase(parts[1]);
    if(key === 'sheet') return await viewSheet(parts[1], parts[2] && parts[2] !== '-' ? parts[2] : null, Number(parts[3]) || 1);
    var fn = { rates: viewRates, health: viewHealth, resale: viewResale, faq: viewFaq, support: viewSupport, backup: viewBackup, account: viewAccount, cases: viewCases, contacts: viewContacts, codes: viewCodes, payments: viewPayments, ledger: viewLedger, summary: viewSummary, staff: viewStaff, audit: viewAudit }[key];
    await (fn || viewCases)();
  }catch(e){ m.innerHTML = '<div class="note bad">' + esc(e.message) + '</div>'; if(/ログイン/.test(e.message)) viewLogin(e.message); }
}

// ============ 案件一覧 ============
async function viewCases(){ var my = S.seq;
  var apps = await GL.select('applications', { order: 'created_at.desc', limit: 500 });
  var ids = apps.map(function(a){ return a.customer_id; });
  var cust = ids.length ? await safe(GL.select('customers', { id: 'in.(' + ids.join(',') + ')' })) : [];
  var cm = {}; cust.forEach(function(c){ cm[c.id] = c; });
  var counts = {}; apps.forEach(function(a){ counts[a.status] = (counts[a.status] || 0) + 1; });
  var lastMsg = {}; (await safe(GL.select('messages', { select: 'application_id,sender_kind,created_at', order: 'created_at.asc', limit: 5000 }))).forEach(function(m){ lastMsg[m.application_id] = m.sender_kind; });
  var reqs = {}; (await safe(GL.select('pickup_requests', { select: 'application_id', limit: 5000 }))).forEach(function(r){ reqs[r.application_id] = 1; });
  (await safe(GL.select('identity_requests', { select: 'application_id', limit: 5000 }))).forEach(function(r){ reqs[r.application_id] = 1; });
  if(my !== S.seq) return; $('#main').innerHTML = top('案件', '<span class="pill">' + apps.length + '件</span>')
    + '<div class="filters"><input id="q" placeholder="受付番号・名前で探す" style="min-width:220px"><select id="st"><option value="">すべての状態</option>'
    + Object.keys(STATUS).map(function(k){ return '<option value="' + k + '">' + STATUS[k][0] + (counts[k] ? '（' + counts[k] + '）' : '') + '</option>'; }).join('') + '</select>'
    + '<label class="chk" style="align-items:center"><label><input type="checkbox" id="open" checked>完了・取消を除く</label></label></div>'
    + '<div class="card"><div class="tw"><table><thead><tr><th>受付番号</th><th>受付日時</th><th>申込者</th><th>区分</th><th>売主</th><th>品物</th><th>地域</th><th>状態</th><th>担当</th></tr></thead><tbody id="tb"></tbody></table></div></div>';
  var sm = {}; S.staff.forEach(function(s){ sm[s.user_id] = s.name; });
  function draw(){
    var q = $('#q').value.trim().toLowerCase(), st = $('#st').value, op = $('#open').checked;
    var rows = apps.filter(function(a){
      if(st && a.status !== st) return false;
      if(!st && op && (a.status === 'closed' || a.status === 'cancelled')) return false;
      if(q){ var c = cm[a.customer_id] || {}; return (a.receipt_no + ' ' + a.applicant_name + ' ' + (c.name || '') + ' ' + (a.agent_org || '')).toLowerCase().indexOf(q) >= 0; }
      return true;
    });
    $('#tb').innerHTML = rows.length ? rows.map(function(a){ var c = cm[a.customer_id] || {};
      return '<tr class="click" data-id="' + a.id + '" tabindex="0"><td class="mono">' + esc(a.receipt_no) + (a.trial ? ' <span class="pill warn">試験</span>' : '') + (lastMsg[a.id] && lastMsg[a.id] !== 'staff' ? ' <span class="pill bad">要返信</span>' : '') + (reqs[a.id] && ['received','contacting','identity_pending','pickup_arranging'].indexOf(a.status) >= 0 ? ' <span class="pill gold">申告あり</span>' : '') + '</td><td>' + dt(a.created_at) + '</td><td>' + esc(a.applicant_name) + (a.agent_org ? '<br><small style="color:var(--mute)">' + esc(a.agent_org) + '</small>' : '') + '</td><td>' + esc(APPLICANT[a.applicant_role]) + '</td><td>' + esc(c.verified_name || c.name || '—') + '</td><td>' + esc((a.categories || []).join('、')) + '</td><td>' + esc(a.pref) + '</td><td>' + pill(STATUS, a.status) + '</td><td>' + esc(sm[a.assigned_to] || '—') + '</td></tr>'; }).join('')
      : '<tr><td colspan="9" class="empty">該当する案件はありません</td></tr>';
  }
  ['q','st','open'].forEach(function(i){ $('#' + i).addEventListener('input', draw); });
  $('#tb').addEventListener('click', function(e){ var tr = e.target.closest('tr[data-id]'); if(tr) location.hash = 'case/' + tr.dataset.id; });
  $('#tb').addEventListener('keydown', function(e){ var tr = e.target.closest('tr[data-id]'); if(tr && e.key === 'Enter') location.hash = 'case/' + tr.dataset.id; });
  draw();
}

// ============ 案件の詳細 ============
var C = null;
async function loadCase(id){
  var a = (await GL.select('applications', { id: 'eq.' + id }))[0];
  if(!a) throw new Error('案件が見つからないか、閲覧の権限がありません');
  var by = { application_id: 'eq.' + id };
  var r = await Promise.all([
    safe(GL.select('customers', { id: 'eq.' + a.customer_id })), safe(GL.select('mandates', Object.assign({ order: 'created_at.asc' }, by))),
    safe(GL.select('identity_checks', Object.assign({ order: 'checked_at.asc' }, by))), safe(GL.select('pickups', Object.assign({ order: 'created_at.asc' }, by))),
    safe(GL.select('items', Object.assign({ order: 'created_at.asc' }, by))), safe(GL.select('appraisals', Object.assign({ order: 'version.asc' }, by))),
    safe(GL.select('contracts', Object.assign({ order: 'created_at.asc' }, by))), safe(GL.select('payments', Object.assign({ order: 'created_at.asc' }, by))),
    safe(GL.select('returns', Object.assign({ order: 'created_at.asc' }, by))), safe(GL.select('application_notes', Object.assign({ order: 'created_at.asc' }, by))),
    safe(GL.select('notifications', Object.assign({ order: 'created_at.desc' }, by))), safe(GL.select('portal_events', Object.assign({ order: 'at.desc' }, by))),
    safe(GL.select('identity_requests', Object.assign({ order: 'created_at.asc' }, by))), safe(GL.select('pickup_requests', Object.assign({ order: 'created_at.asc' }, by))),
    safe(GL.select('return_requests', Object.assign({ order: 'created_at.asc' }, by))), safe(GL.select('messages', Object.assign({ order: 'created_at.asc' }, by)))
  ]);
  var c = { app: a, cust: r[0][0] || {}, mandates: r[1], idc: r[2], pickups: r[3], items: r[4], appraisals: r[5], contracts: r[6], payments: r[7], returns: r[8], notes: r[9], notifs: r[10], events: r[11], idr: r[12], pkr: r[13], rtr: r[14], msgs: r[15], lines: [], approvals: [], sigs: [], banks: [], photos: [] };
  var apIds = c.appraisals.map(function(x){ return x.id; }), ctIds = c.contracts.map(function(x){ return x.id; });
  var more = await Promise.all([
    apIds.length ? safe(GL.select('appraisal_lines', { appraisal_id: 'in.(' + apIds.join(',') + ')' })) : [],
    apIds.length ? safe(GL.select('approvals', { appraisal_id: 'in.(' + apIds.join(',') + ')' })) : [],
    ctIds.length ? safe(GL.select('contract_signatures', { contract_id: 'in.(' + ctIds.join(',') + ')' })) : [],
    can('finance') ? safe(GL.select('bank_accounts', { customer_id: 'eq.' + a.customer_id })) : [],
    can('reception','appraiser') ? safe(GL.list('intake', a.upload_token)) : [],
    safe(GL.select('auto_runs', { application_id: 'eq.' + a.id, order: 'created_at.desc', limit: 1 })),
    safe(GL.select('appraisal_sheets', { select: 'id,slot,version,source,data,created_at', application_id: 'eq.' + a.id, source: 'eq.auto', order: 'version.desc', limit: 50 }))
  ]);
  c.lines = more[0]; c.approvals = more[1]; c.sigs = more[2]; c.banks = more[3]; c.photos = more[4]; c.autoRun = more[5][0] || null;
  var seen = {}; c.autoSheets = more[6].filter(function(x){ if(seen[x.slot]) return false; seen[x.slot] = 1; return true; }).sort(function(x, y){ return x.slot - y.slot; });
  return c;
}
function staffName(id){ var s = S.staff.filter(function(x){ return x.user_id === id; })[0]; return s ? s.name : '—'; }
function latestAppraisal(){ var l = C.appraisals.filter(function(x){ return x.status !== 'withdrawn'; }); return l[l.length - 1] || null; }
function approvedLines(ap){ if(!ap) return []; return C.lines.filter(function(l){ return l.appraisal_id === ap.id && C.approvals.some(function(v){ return v.appraisal_line_id === l.id && v.decision === 'approve'; }); }); }
function itemOf(id){ return C.items.filter(function(i){ return i.id === id; })[0] || {}; }
function autoBox(){
  var r = C.autoRun, st = r ? ({ queued: '受付済み', running: '鑑定中', done: '完了', failed: '失敗' })[r.status] : '未実行';
  var rows = (C.autoSheets || []).map(function(x){ var s1 = (x.data.ai || {}).s1 || {}, s2 = (x.data.ai || {}).s2 || {};
    return '<li><a href="#sheet/' + C.app.id + '/-/' + x.slot + '">' + x.slot + '. ' + esc([s1.brand, s1.model, s1.ref].filter(Boolean).join(' ') || '（特定できず）') + '</a>　<small>ランク ' + esc(s2.rank || '—') + '・第' + x.version + '版・' + dt(x.created_at) + '</small></li>'; }).join('');
  return '<div class="ai-box" style="margin-bottom:12px"><b>AIの自動鑑定（写真が届くと自動で実行）</b>'
    + '<p style="margin:0;font-size:13px">状態：<span class="pill' + (r && r.status === 'done' ? ' ok' : r && r.status === 'failed' ? ' bad' : '') + '">' + st + '</span>' + (r ? '　' + dt(r.finished_at || r.created_at) + '　写真' + (r.photo_count || 0) + '枚' + (r.cost_usd ? '　費用 約' + Math.ceil(r.cost_usd * 160) + '円' : '') + (r.error ? '　<small>' + esc(r.error) + '</small>' : '') : (C.app.ai_consent ? '　管理者が有効にすると、写真が届いた時点で鑑定シートが自動で作られます' : '　お客様のお申し出により、AIの利用を止めています')) + '</p>'
    + (rows ? '<ol style="margin:0;padding-left:18px">' + rows + '</ol>' : '')
    + '<div class="btns">' + (can('appraiser') && C.app.ai_consent ? '<button class="btn sub sm" type="button" id="auto-retry">自動鑑定をやり直す</button>' : '')
    + (C.app.ai_consent ? '<button class="btn sub sm" type="button" id="ai-stop">AIの利用を止める（お客様の申し出）</button>' : '<span class="pill bad">AIの利用は停止中</span>') + '</div></div>';
}
function card(id, title, hint, body){ return '<section class="card" id="' + id + '"><header><h2>' + title + '</h2>' + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</header><div class="in">' + body + '</div></section>'; }

async function viewCase(id){ var my = S.seq;
  C = await loadCase(id);
  var a = C.app, cu = C.cust;
  var html = top('案件 <span class="mono">' + esc(a.receipt_no) + '</span> ' + pill(STATUS, a.status) + (a.trial ? ' <span class="pill warn">試験データ</span>' : ''), '<a class="btn sub sm" href="#cases">一覧へ</a>');
  html += '<div class="grid2"><div>';
  // 概要
  html += card('s-sum', 'お申込みの内容', '受付 ' + dt(a.created_at),
    '<dl class="kv"><dt>申込者</dt><dd>' + esc(a.applicant_name) + '（' + esc(APPLICANT[a.applicant_role]) + '）' + (a.agent_org ? '　' + esc(a.agent_org) : '') + (a.relation ? '　' + esc(a.relation) : '') + '</dd>'
    + '<dt>連絡先</dt><dd>' + esc([a.applicant_email, a.applicant_tel].filter(Boolean).join(' ／ ')) + '　希望：' + esc(a.contact_way || '—') + '</dd>'
    + '<dt>紹介コード</dt><dd>' + (a.referral_code_text ? '' : '<span class="pill">紹介なし</span>') + esc(a.referral_code_text || '') + (a.referral_code_text && !a.referral_code_id ? ' <span class="pill warn">無効なコード</span>' : '') + '</dd>'
    + '<dt>品物</dt><dd>' + esc((a.categories || []).join('、')) + '　' + esc(a.qty || '') + '</dd><dt>概要</dt><dd>' + esc(a.summary || '—') + '</dd>'
    + '<dt>集荷</dt><dd>' + esc(a.pref) + esc(a.city || '') + '　' + esc(a.pickup_way || '') + '　引渡し：' + esc(a.handover || '—') + '　希望日時：' + esc(a.wish || '—') + '</dd>'
    + '<dt>ご要望</dt><dd>' + esc(a.note || '—') + '</dd></dl>'
    + (can('reception','appraiser') ? '<form class="f" data-form="status"><div class="row"><label class="l">状態<select name="status">' + MANUAL.map(function(k){ return '<option value="' + k + '"' + (a.status === k ? ' selected' : '') + '>' + STATUS[k][0] + '</option>'; }).join('')
      + (MANUAL.indexOf(a.status) < 0 ? '<option value="' + a.status + '" selected>' + STATUS[a.status][0] + '（自動）</option>' : '') + '</select></label>'
      + '<label class="l">担当者<select name="assigned_to"><option value="">未割当</option>' + S.staff.filter(function(s){ return s.active; }).map(function(s){ return '<option value="' + s.user_id + '"' + (a.assigned_to === s.user_id ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join('') + '</select></label></div>'
      + '<div class="btns"><button class="btn sm">更新する</button><span class="hint" style="color:var(--mute);font-size:12px">承認・契約成立・振込済は、お客様の操作や記録に応じて自動で変わります</span></div></form>' : ''));
  // お客様からの申告と連絡
  html += card('s-req', 'お客様からの申告・連絡', needsAction(C) ? '<span class="pill warn">要対応</span>' : '', renderRequests());
  // 売主
  html += card('s-cust', '売主', cu.verified_name ? '本人確認済みの名義あり' : '本人確認後に名義を登録',
    can('reception','appraiser') ? '<form class="f" data-form="cust"><div class="row"><label class="l">区分<select name="kind"><option value="person"' + (cu.kind === 'person' ? ' selected' : '') + '>個人</option><option value="corporation"' + (cu.kind === 'corporation' ? ' selected' : '') + '>法人</option></select></label>'
      + '<label class="l">お名前・法人名<input name="name" value="' + esc(cu.name) + '"></label></div><div class="row"><label class="l">売主のメール（お客様用画面のログインに使う）<input name="email" type="email" value="' + esc(cu.email) + '"></label><label class="l">電話<input name="tel" value="' + esc(cu.tel) + '"></label></div>'
      + '<div class="row"><label class="l">確認済みの名義（漢字）<input name="verified_name" value="' + esc(cu.verified_name) + '"></label><label class="l">確認済みの名義（カナ）<input name="verified_kana" value="' + esc(cu.verified_kana) + '"></label></div>'
      + (a.applicant_role === 'agent' ? '<p class="note">代理の方によるお申込みです。売主ご本人の連絡先を登録すると、売主ご本人がお客様用画面で委任状に署名できます。</p>' : '')
      + '<div class="btns"><button class="btn sm">保存する</button>' + (cu.user_id ? '<span class="pill ok">お客様用画面に登録済</span>' : '<span class="pill">お客様用画面は未登録</span>') + '</div></form>'
      : '<dl class="kv"><dt>名前</dt><dd>' + esc(cu.verified_name || cu.name) + '</dd></dl>');
  // 写真
  if(can('reception','appraiser')) html += card('s-photo', 'お品物の写真と鑑定補助', C.photos.length + '枚（担当者だけが見られます。お客様には送りません）', C.photos.length ? autoBox() + '<div class="photos" id="photos"></div>'
      + '<div class="btns" style="margin-top:12px"><button class="btn sub sm" type="button" id="pc-run">写真を点検する（無料）</button><button class="btn sub sm" type="button" id="ai-run">AIで鑑定の補助を受ける（有料・任意）</button><button class="btn sub sm" type="button" id="pc-pdf">報告書をPDFで保存（メール添付用）</button>' + (can('appraiser','finance') ? '<a class="btn sub sm" href="#sheet/' + a.id + '/-">鑑定シート（品物の登録前）</a>' : '') + '<span id="ai-quota" style="font-size:12px;color:var(--mute)"></span></div>'
      + '<p class="note" style="margin:8px 0 0">点検とAIの結果は、担当者が実物を確認するときの参考です。真贋と査定額は、株式会社グローブの査定担当者が実物で判断します。</p><div id="pc-out"></div><div id="free-out"></div><div id="ai-out"></div><div id="mail-out"></div>' : '<p class="empty">写真はありません</p>');
  // 委任
  if(can('reception','appraiser')) html += card('s-mandate', '代理（委任）', '代理の方の権限は売主ご本人の署名で有効になります',
    (C.mandates.length ? '<div class="tw"><table><thead><tr><th>代理人</th><th>委任の範囲</th><th>期限</th><th>状態</th><th></th></tr></thead><tbody>' + C.mandates.map(function(m){
      var sc = [m.scope_apply && '申込・連絡', m.scope_pickup && '集荷立会い', m.scope_approve && '査定承認', m.scope_documents && '書類', m.scope_sign && '契約署名'].filter(Boolean).join('、');
      var stt = m.revoked_at ? '<span class="pill bad">撤回 ' + day(m.revoked_at) + '</span>' : !m.seller_signed_at ? '<span class="pill warn">売主の署名待ち</span>' : !m.agent_identity_checked ? '<span class="pill warn">代理人の本人確認待ち</span>' : (m.seller_contact_by_agent && !m.seller_confirmed_at) ? '<span class="pill warn">売主ご本人への確認待ち</span>' : (m.valid_until && new Date(m.valid_until) < new Date()) ? '<span class="pill bad">期限切れ</span>' : '<span class="pill ok">有効</span>';
      var mk = C.contracts.filter(function(k){ return k.mandate_id === m.id; })[0], acc = mk && C.sigs.some(function(g){ return g.contract_id === mk.id && g.signer_kind === 'agent'; });
      return '<tr><td>' + esc(m.agent_name) + '<br><small>' + esc(m.agent_org || '') + ' ' + esc(m.agent_email) + '</small><br>' + (m.created_via === 'agent' ? '<span class="pill gold">代理人が作成</span> ' : '') + (acc ? '<span class="pill ok">受任者署名済</span>' : '<span class="pill">受任者署名なし</span>') + '</td><td>' + esc(sc) + '</td><td>' + (m.valid_until ? day(m.valid_until) : '取引完了まで') + '</td><td>' + stt + '</td><td>'
        + (!m.agent_identity_checked && !m.revoked_at ? '<button class="btn sub sm" data-act="agentok" data-id="' + m.id + '">代理人の本人確認済にする</button>' : '')
        + (m.seller_contact_by_agent && !m.seller_confirmed_at && !m.revoked_at ? '<p class="note bad" style="margin:6px 0">売主の連絡先は代理人が入力したものです。代理人を通さない方法（売主ご本人の電話など）で、委任の意思をご本人に確認してください。</p><form class="f" data-form="sellerok" data-id="' + m.id + '"><label class="l">確認した方法と日時<input name="note" required placeholder="例：10/24 15時 ご本人の携帯へ電話して確認"></label><div class="btns"><button class="btn sub sm">売主本人に確認したことを記録する</button></div></form>' : '')
        + (m.seller_confirmed_at ? '<small>売主確認：' + esc(m.seller_confirm_note || '') + '</small>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="empty">委任はありません</p>')
    + '<details><summary style="cursor:pointer;color:var(--gold-hi)">委任状を作成する</summary><form class="f" data-form="mandate" style="margin-top:10px"><div class="row"><label class="l">代理人のお名前<input name="agentName" required value="' + (a.applicant_role === 'agent' ? esc(a.applicant_name) : '') + '"></label><label class="l">ご所属<input name="agentOrg" value="' + esc(a.agent_org || '') + '"></label><label class="l">代理人のメール<input name="agentEmail" type="email" required value="' + (a.applicant_role === 'agent' ? esc(a.applicant_email || '') : '') + '"></label><label class="l">期限（空欄は取引完了まで）<input name="validUntil" type="date"></label></div>'
    + '<div class="chk"><label><input type="checkbox" name="apply" checked>申込・連絡</label><label><input type="checkbox" name="pickup">集荷の立会い</label><label><input type="checkbox" name="approve">査定額の承認</label><label><input type="checkbox" name="documents">書類の閲覧</label><label><input type="checkbox" name="sign">売買契約の署名</label></div>'
    + '<p class="note">査定額の承認・契約の署名は、売主ご本人が明示的に任せる場合にだけ付けてください。委任状は売主ご本人がお客様用画面で署名します。</p><div class="btns"><button class="btn sm">委任状を作成する</button></div></form></details>');
  html += '</div><div>';
  // 本人確認
  if(can('appraiser','finance')) html += card('s-idc', '本人確認（古物営業法）', '電子署名とは別の記録です',
    (C.idc.length ? '<div class="tw"><table><thead><tr><th>対象</th><th>氏名・住所・職業・年齢</th><th>方法</th><th>確認</th></tr></thead><tbody>' + C.idc.map(function(x){ return '<tr><td class="nw">' + esc(SUBJECT[x.subject]) + '</td><td>' + esc(x.full_name) + '<br><small>' + esc(x.address) + '　' + esc(x.occupation || '') + '　' + (x.age != null ? esc(x.age) + '歳' : '') + '</small></td><td>' + esc(METHOD[x.method]) + (x.evidence_note ? '<br><small>' + esc(x.evidence_note) + '</small>' : '') + '</td><td>' + dt(x.checked_at) + '<br><small>' + esc(staffName(x.checked_by)) + '</small></td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="note bad">本人確認の記録がありません。確認が済むまで売買契約は作成できません。</p>')
    + (can('appraiser') ? '<details><summary style="cursor:pointer;color:var(--gold-hi)">本人確認を記録する</summary><form class="f" data-form="idc" style="margin-top:10px"><div class="row"><label class="l">対象<select name="subject"><option value="seller">売主</option><option value="agent">代理人</option><option value="corporate_staff">法人の担当者</option></select></label><label class="l">氏名<input name="full_name" required></label><label class="l">職業<input name="occupation"></label><label class="l">年齢<input name="age" type="number" min="0" max="130"></label></div>'
      + '<label class="l">住所<input name="address" required></label><label class="l">確認の方法<select name="method">' + Object.keys(METHOD).map(function(k){ return '<option value="' + k + '">' + METHOD[k] + '</option>'; }).join('') + '</select></label><label class="l">証跡のメモ（書留の番号・確認書類など）<input name="evidence_note"></label><div class="btns"><button class="btn sm">記録する</button></div></form></details>' : ''));
  // 集荷
  if(can('reception','appraiser')) html += card('s-pick', '集荷・受領', '直接集荷は個別に判断し、理由を残します',
    (C.pickups.length ? '<div class="tw"><table><thead><tr><th>方法</th><th>予定・配送</th><th>判断理由</th><th>受領</th></tr></thead><tbody>' + C.pickups.map(function(x){ return '<tr><td>' + (x.method === 'direct' ? '直接集荷' : '宅配') + '</td><td>' + dt(x.scheduled_at) + '<br><small>' + esc(x.carrier || '') + ' ' + esc(x.tracking_no || '') + '</small></td><td>' + esc(x.decision_reason || '—') + '</td><td>' + (x.received_at ? dt(x.received_at) + '<br><small>' + esc(x.received_note || '') + '</small>' : '<form class="btns" data-form="receive" data-id="' + x.id + '"><input name="received_note" placeholder="受領時の状態・点数" style="width:170px"><button class="btn sm">受領を記録</button></form>') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="empty">集荷の記録はありません</p>')
    + '<details><summary style="cursor:pointer;color:var(--gold-hi)">集荷を手配する</summary><form class="f" data-form="pickup" style="margin-top:10px"><div class="row"><label class="l">方法<select name="method"><option value="delivery">宅配便</option><option value="direct">直接集荷</option></select></label><label class="l">予定日時<input name="scheduled_at" type="datetime-local"></label><label class="l">配送会社<input name="carrier"></label><label class="l">伝票番号<input name="tracking_no"></label></div><label class="l">判断理由（直接集荷のとき必須：品物の種類・数量・価値・輸送リスク・希望・場所・実施可能性）<input name="decision_reason"></label><div class="btns"><button class="btn sm">記録する</button></div></form></details>');
  // 商品と査定
  html += card('s-items', '商品と査定', '', renderItems());
  // 契約
  html += card('s-ctr', '契約・書類', '本文は作成後に変更できません（改ざん検知つき）', renderContracts());
  // 振込
  if(can('finance')) html += card('s-pay', '振込', '名義が一致しない振込は自動で「要確認」になります', renderPayments());
  // 返却
  if(can('reception','appraiser')) html += card('s-ret', '返却', '通常の返送料はG-LOVE負担', (C.returns.length ? '<div class="tw"><table><thead><tr><th>理由</th><th>発送</th><th>到着</th><th></th></tr></thead><tbody>' + C.returns.map(function(x){ return '<tr><td>' + esc(x.reason) + '</td><td>' + dt(x.shipped_at) + '<br><small>' + esc(x.carrier || '') + ' ' + esc(x.tracking_no || '') + '</small></td><td>' + dt(x.delivered_at) + '</td><td>' + (!x.shipped_at ? '<button class="btn sub sm" data-act="shipped" data-id="' + x.id + '">発送を記録</button>' : !x.delivered_at ? '<button class="btn sub sm" data-act="delivered" data-id="' + x.id + '">到着を記録</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="empty">返却の記録はありません</p>')
    + '<details><summary style="cursor:pointer;color:var(--gold-hi)">返却を手配する</summary><form class="f" data-form="return" style="margin-top:10px"><div class="row"><label class="l">理由<select name="reason"><option value="declined">辞退された商品</option><option value="no_answer">無回答による返却</option><option value="not_acceptable">お取扱いできない商品</option><option value="other">その他</option></select></label><label class="l">配送会社<input name="carrier"></label><label class="l">伝票番号<input name="tracking_no"></label></div><div class="btns"><button class="btn sm">記録する</button></div></form></details>');
  // メモと履歴
  html += card('s-notes', 'メモ・連絡の記録', '', (C.notes.length ? '<ul class="timeline">' + C.notes.map(function(n){ return '<li>' + dt(n.created_at) + '　' + esc(staffName(n.author)) + '<span>' + esc(n.body) + '</span></li>'; }).join('') + '</ul>' : '<p class="empty">メモはありません</p>')
    + '<form class="f" data-form="note"><textarea name="body" placeholder="連絡した内容・判断の理由など" required></textarea><div class="btns"><button class="btn sm">メモを残す</button></div></form>');
  html += card('s-hist', '通知とお客様側の操作', '', '<ul class="timeline">' + C.events.map(function(e){ return '<li>' + dt(e.at) + '<span>' + (e.actor_kind === 'agent' ? '代理人' : '売主') + '：' + esc(EVENT[e.kind] || e.kind) + '</span></li>'; }).join('')
    + C.notifs.map(function(n){ return '<li>' + dt(n.created_at) + '<span>通知「' + esc(NOTIF[n.kind] || n.kind) + '」→ ' + esc(n.to_addr) + '　' + (n.status === 'sent' ? '送信依頼済' : n.status === 'skipped' ? '未設定のため未送信' : n.status === 'failed' ? '失敗' : '待機') + '</span></li>'; }).join('') + '</ul>');
  html += '</div></div>';
  if(my !== S.seq) return; $('#main').innerHTML = html;
  bindCase();
  var caseId = C.app.id, seen = C.msgs.length;
  if(S.caseTimer) clearInterval(S.caseTimer);
  S.caseTimer = setInterval(async function(){
    if(location.hash.indexOf('#case/' + caseId) !== 0){ clearInterval(S.caseTimer); return; } if(document.hidden) return;
    var ms = await safe(GL.select('messages', { application_id: 'eq.' + caseId, select: 'id', limit: 1000 }));
    if(ms.length > seen){ seen = ms.length; var ta = $('form[data-form=reply] textarea'); if(ta && ta.value){ toast('お客様から新しい連絡があります（返信を送ると表示されます）'); return; }
      toast('お客様から新しい連絡があります'); viewCase(caseId); }
  }, 10000);
  var sd = document.querySelector('[data-saledraft]'); if(sd) GL.rpc('staff_sale_draft', { p_application: C.app.id }).then(function(b){ sd.value = b; }).catch(function(x){ sd.value = x.message; });
  if(C.photos.length && $('#pc-run')) photoTools();
  if($('#ai-stop')) $('#ai-stop').onclick = async function(){ var b = this; if(b.dataset.ok !== '1'){ b.dataset.ok = '1'; b.textContent = 'もう一度押すと止めます（再開はできません）'; return; }
    b.disabled = true; try{ await GL.rpc('staff_set_ai_consent', { p_application: C.app.id, p_on: false, p_reason: 'お客様のお申し出' }); toast('この案件では、写真をAIに送りません'); route(); }catch(x){ toast(x.message, true); b.disabled = false; } };
  if($('#auto-retry')) $('#auto-retry').onclick = async function(){ var b = this; b.disabled = true; try{ await GL.rpc('staff_auto_retry', { p_application: C.app.id }); toast('自動鑑定を依頼しました。数分で鑑定シートができます'); }catch(x){ toast(x.message, true); b.disabled = false; } };
  if(C.photos.length && $('#photos')) C.photos.forEach(async function(p){ try{ var u = await GL.signedUrl('intake', C.app.upload_token + '/' + p.name); var im = new Image(); im.alt = 'お品物の写真'; im.src = u; im.loading = 'lazy'; var a = document.createElement('a'); a.href = u; a.target = '_blank'; a.rel = 'noopener'; a.appendChild(im); $('#photos').appendChild(a); }catch(e){} });
}
var EVENT = { nda_requested:'秘密保持契約を希望', mandate_requested:'委任状を作成して署名を依頼', mandate_accepted:'受任者として委任状に署名', identity_submitted:'本人確認の情報を送信', pickup_requested:'集荷を依頼', shipped:'発送（伝票番号を入力）', bank_registered:'振込先を登録', return_address:'返却先を確認', appraisal_answered:'査定に回答', contract_signed:'書類に署名', mandate_signed:'委任状に署名', mandate_revoked:'委任を撤回' };
var NOTIF = { new_application:'新しい申込', receipt:'受付番号', appraisal_ready:'査定結果', appraisal_reminder:'査定の再通知', return_notice:'返却予定', staff_reminder:'担当者へ再通知', staff_return_notice:'担当者へ返却予定', contract_ready:'契約書', paid:'振込完了', appraisal_answered:'回答あり', mandate_ready:'委任状', mandate_revoked:'委任撤回', new_contact:'問い合わせ', staff_message:'担当者からの連絡', customer_message:'お客様からの連絡', customer_request:'お客様の手続き', mandate_requested:'代理人が委任状を作成', mandate_signed:'委任状の署名完了', support_new:'チャット相談（担当者へ切替）', test:'通知のテスト', nda_ready:'秘密保持契約書', contract_closed:'契約成立（お客様へ）', sale_closed:'契約成立（担当者へ）' };

var IDM = { honnin_gentei_yubin:'本人限定受取郵便', mibun_copy_kakitome_koza:'身分証の写し＋書留', consult:'相談したい' };
var PKM = { kit:'梱包キットを送ってほしい', self_ship:'自分で梱包して送る', direct:'直接集荷を相談したい' };
function needsAction(c){
  var last = c.msgs[c.msgs.length - 1];
  if(last && last.sender_kind !== 'staff') return true;
  if(c.idr.some(function(r){ return !c.idc.some(function(x){ return x.subject === r.subject; }); })) return true;
  if(c.pkr.length && !c.pickups.length) return true;
  if(c.rtr.length && !c.returns.length) return true;
  return false;
}
function renderRequests(){
  var out = '';
  if(C.idr.length) out += '<h3 style="font-size:13px;color:var(--gold-hi)">本人確認の申告</h3><div class="tw"><table><tbody>' + C.idr.map(function(r){
    var done = C.idc.some(function(x){ return x.subject === r.subject; });
    return '<tr><td class="nw">' + (r.subject === 'agent' ? '代理人' : '売主') + '</td><td>' + esc(r.full_name) + '（' + esc(r.kana || '') + '）<br><small>' + esc(r.address) + '　' + esc(r.occupation || '') + '　' + (r.birthdate ? '生年月日 ' + esc(r.birthdate) : '') + '　' + esc(r.tel || '') + '</small></td><td>希望：' + esc(IDM[r.method_pref]) + '<br><small>' + dt(r.created_at) + '</small></td><td>'
      + (done ? '<span class="pill ok">確認済</span>' : can('appraiser') ? '<button class="btn sub sm" data-act="useidr" data-id="' + r.id + '">本人確認欄に写す</button>' : '<span class="pill warn">確認待ち</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>';
  if(C.pkr.length) out += '<h3 style="font-size:13px;color:var(--gold-hi)">集荷の希望</h3><div class="tw"><table><tbody>' + C.pkr.map(function(r){
    return '<tr><td>' + esc(PKM[r.method]) + '<br><small>' + dt(r.created_at) + '</small></td><td>' + esc(r.address) + '<br><small>' + esc(r.recipient || '') + '　' + esc(r.tel || '') + '</small></td><td>希望日時：' + esc((r.dates || []).join('／') || '—') + (r.note ? '<br><small>' + esc(r.note) + '</small>' : '') + '</td><td>' + (r.tracking_no ? '<span class="pill info">発送済</span><br><small>' + esc(r.carrier || '') + ' ' + esc(r.tracking_no) + '</small>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>';
  if(C.rtr.length) out += '<h3 style="font-size:13px;color:var(--gold-hi)">返却先</h3><div class="tw"><table><tbody>' + C.rtr.map(function(r){
    return '<tr><td>' + esc(r.recipient) + '　' + esc(r.tel || '') + '</td><td>' + esc(r.address) + (r.note ? '<br><small>' + esc(r.note) + '</small>' : '') + '</td><td><small>' + dt(r.created_at) + '</small></td></tr>'; }).join('') + '</tbody></table></div>';
  out += '<h3 style="font-size:13px;color:var(--gold-hi)">連絡</h3>' + (C.msgs.length ? '<ul class="timeline">' + C.msgs.map(function(m){
    var who = m.sender_kind === 'staff' ? '担当 ' + staffName(m.sender) : m.sender_kind === 'agent' ? '代理人' : '売主';
    return '<li>' + dt(m.created_at) + '　' + esc(who) + '<span style="white-space:pre-wrap' + (m.sender_kind === 'staff' ? ';color:var(--mute)' : '') + '">' + esc(m.body) + '</span></li>'; }).join('') + '</ul>' : '<p class="empty">連絡はありません</p>');
  out += '<form class="f" data-form="reply"><textarea name="body" maxlength="2000" required placeholder="お客様への返信（お客様用画面に表示され、メールで「返信あり」とだけ通知されます）"></textarea><div class="btns"><button class="btn sm">返信する</button></div></form>';
  return out;
}
function renderItems(){
  var ap = latestAppraisal(), draft = ap && ap.status === 'draft';
  var lm = {}; if(ap) C.lines.filter(function(l){ return l.appraisal_id === ap.id; }).forEach(function(l){ lm[l.item_id] = l; });
  var dm = {}; C.approvals.forEach(function(v){ dm[v.appraisal_line_id] = v; });
  var out = '';
  if(ap) out += '<div class="btns"><span class="pill gold">査定 第' + ap.version + '版</span>' + (ap.status === 'draft' ? '<span class="pill">下書き</span>' : ap.status === 'notified' ? '<span class="pill info">通知済 ' + dt(ap.notified_at) + '</span>' + (ap.reminder7_at ? '<span class="pill warn">再通知 ' + day(ap.reminder7_at) + '</span>' : '') + (ap.return_notice_at ? '<span class="pill warn">返却予定通知 ' + day(ap.return_notice_at) + '</span>' : '') : '<span class="pill ok">回答済 ' + dt(ap.answered_at) + '</span>') + '</div>';
  if(C.items.length){
    out += '<form data-form="lines"><div class="tw"><table><thead><tr><th>商品</th><th>特徴</th><th class="r">数量</th><th class="r">査定額</th><th>お客様の回答</th></tr></thead><tbody>' + C.items.map(function(i){
      var l = lm[i.id], v = l && dm[l.id];
      return '<tr><td>' + esc(i.category) + '<br><small>' + esc(i.description) + '</small>' + (can('appraiser','finance') ? '<br><a class="btn sub sm" href="#sheet/' + C.app.id + '/' + i.id + '">鑑定シート</a>' : '') + '</td><td><small>' + esc(i.features || '') + ' ' + esc(i.condition_note || '') + '</small></td><td class="r num">' + i.quantity + '</td><td class="r num">'
        + (draft && can('appraiser') ? '<input name="amt_' + i.id + '" type="number" min="0" step="1" value="' + (l ? l.amount : '') + '" style="width:130px;text-align:right" aria-label="' + esc(i.description) + 'の査定額">' : (l ? yen(l.amount) : '—'))
        + '</td><td>' + (v ? (v.decision === 'approve' ? '<span class="pill ok">承認</span>' : '<span class="pill bad">辞退</span>') + '<br><small>' + (v.responder_kind === 'agent' ? '代理人' : '売主') + ' ' + dt(v.responded_at) + '</small>' : '—') + '</td></tr>'; }).join('')
      + (ap ? '<tr><td colspan="3" class="r">合計</td><td class="r num">' + yen(C.lines.filter(function(l){ return l.appraisal_id === ap.id; }).reduce(function(s, l){ return s + l.amount; }, 0)) + '</td><td>承認分 ' + yen(approvedLines(ap).reduce(function(s, l){ return s + l.amount; }, 0)) + '</td></tr>' : '') + '</tbody></table></div>'
      + (draft && can('appraiser') ? '<div class="btns" style="margin-top:8px"><button class="btn sub sm">査定額を保存</button><button class="btn sm" type="button" data-act="notify">お客様へ査定結果を通知</button></div>' : '') + '</form>';
  } else out += '<p class="empty">商品はまだ登録されていません。受領後に登録してください。</p>';
  if(can('appraiser')){
    out += '<details><summary style="cursor:pointer;color:var(--gold-hi)">商品を登録する</summary><form class="f" data-form="item" style="margin-top:10px"><div class="row"><label class="l">種類<select name="category"><option>時計</option><option>宝石・ジュエリー</option><option>ブランドバッグ・小物</option><option>貴金属</option><option>美術品・骨董</option><option>その他</option></select></label><label class="l">品名<input name="description" required></label><label class="l">数量<input name="quantity" type="number" min="1" value="1"></label></div><label class="l">特徴（古物台帳に記載：型番・刻印・色・素材など）<input name="features"></label><label class="l">状態<input name="condition_note"></label><div class="btns"><button class="btn sm">登録する</button></div></form></details>';
    if(!draft && C.items.length) out += '<div class="btns"><button class="btn sub sm" data-act="newap">' + (ap ? '査定をやり直す（新しい版を作る）' : '査定を始める') + '</button></div>';
  }
  return out;
}
function renderContracts(){
  var out = C.contracts.length ? '<div class="tw"><table><thead><tr><th>書類</th><th>作成</th><th>署名</th><th>状態</th><th></th></tr></thead><tbody>' + C.contracts.map(function(k){
    var sg = C.sigs.filter(function(s){ return s.contract_id === k.id; });
    return '<tr><td>' + esc(CKIND[k.kind]) + '<br><small>' + esc(k.title) + '</small><br><small class="mono" style="color:var(--mute)">要約値 ' + esc(k.body_sha256.slice(0, 16)) + '…</small></td><td>' + dt(k.created_at) + '</td><td>' + (sg.map(function(s){ return ({ seller:'売主', agent:'代理人', buyer:'買主' })[s.signer_kind] + (s.basis === 'offer' ? '（査定通知による申込み）' : '') + ' ' + dt(s.signed_at); }).join('<br>') || '—') + (k.checks ? '<br><small style="color:var(--mute)">お客様の確認：品物と金額・所有と盗品でないこと・真正品と返金・規約（' + esc(k.checks.termsVersion || '') + '）</small>' : '') + '</td><td>' + (k.status === 'signed' ? '<span class="pill ok">締結</span>' : k.status === 'void' ? '<span class="pill bad">無効</span>' : '<span class="pill warn">署名待ち</span>') + '</td><td><div class="btns">'
      + '<button class="btn sub sm" data-act="view" data-id="' + k.id + '">本文</button><button class="btn sub sm" data-act="intact" data-id="' + k.id + '">改ざん確認</button>'
      + (k.kind === 'sale' && k.status === 'pending' && can('appraiser') && S.me.company === 'glove' && !sg.some(function(s){ return s.signer_kind === 'buyer'; }) ? '<button class="btn sm" data-act="buyersign" data-id="' + k.id + '">買主として署名</button>' : '')
      + '</div></td></tr><tr hidden id="doc-' + k.id + '"><td colspan="5"><pre class="doc">' + esc(k.body) + '</pre></td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="empty">書類はまだありません</p>';
  var ndaReq = C.events.some(function(e){ return e.kind === 'nda_requested'; });
  if(can('reception','appraiser') && !C.contracts.some(function(k){ return k.kind === 'nda' && k.status !== 'void'; }))
    out += '<div class="btns" style="margin-top:10px">' + (ndaReq ? '<span class="pill bad">お客様が秘密保持契約を希望</span>' : '') + '<button class="btn sub sm" data-act="nda">秘密保持契約を作成してお客様へ送る（当社として署名）</button></div>';
  var st = C.app.status;
  if(can('appraiser') && (st === 'approved' || st === 'partially_approved') && !C.contracts.some(function(k){ return k.kind === 'sale' && k.status !== 'void'; })){
    out += '<details open><summary style="cursor:pointer;color:var(--gold-hi)">売買契約書を作成する</summary><form class="f" data-form="sale" style="margin-top:10px"><p class="note">お客様の画面の「かんたん成約」と同じ条文で、承認された商品と金額から作成します。作成後は本文を変更できません。</p><textarea name="body" style="min-height:260px" readonly data-saledraft>読み込んでいます…</textarea><div class="btns"><button class="btn sm">この本文で作成し、お客様へ署名を依頼する</button></div></form></details>';
  }
  return out;
}
function saleBody(){
  var ap = latestAppraisal(), ls = approvedLines(ap), total = ls.reduce(function(s, l){ return s + l.amount; }, 0), cu = C.cust;
  return '売買契約書【法務確認前の雛形】\n\n売主 ' + (cu.verified_name || cu.name) + '（以下「売主」）と、買主 株式会社グローブ（以下「買主」）は、次のとおり売買契約を締結する。\n\n'
    + '第1条（目的物と代金）\n' + ls.map(function(l, i){ var it = itemOf(l.item_id); return '　' + (i + 1) + '. ' + it.category + '　' + it.description + (it.features ? '（' + it.features + '）' : '') + '　数量' + it.quantity + '　' + yen(l.amount); }).join('\n')
    + '\n　合計 ' + yen(total) + '（受付番号 ' + C.app.receipt_no + '、査定 第' + (ap ? ap.version : '') + '版）\n\n'
    + '第2条（支払）買主は、本契約の締結後、売主名義の金融機関口座へ代金を振り込む。振込手数料は買主の負担とする。\n'
    + '第3条（所有権の移転）目的物の所有権は、買主が代金の支払を完了した時に売主から買主へ移転する。【要法務確認】\n'
    + '第4条（引渡し）目的物は、本契約の締結時点で買主が預かっており、所有権の移転をもって引渡しを完了したものとする。\n'
    + '第5条（表明保証）売主は、目的物が売主の所有物であり、盗品その他の不正な品でないことを表明し保証する。\n'
    + '第6条（秘密保持）両当事者は、本取引の存在および内容を第三者に開示しない。ただし法令に基づく場合を除く。\n'
    + '第7条（反社会的勢力の排除）両当事者は、反社会的勢力に該当しないことを表明し保証する。\n'
    + '第8条（承認しなかった商品）売主が承認しなかった商品は、買主の負担で売主へ返却する。\n'
    + '第9条（管轄）本契約に関する紛争は、【要確認】地方裁判所を第一審の専属的合意管轄裁判所とする。';
}
function renderPayments(){
  var signed = C.contracts.filter(function(k){ return k.kind === 'sale' && k.status === 'signed'; })[0];
  var bm = {}; C.banks.forEach(function(b){ bm[b.id] = b; });
  var out = C.payments.length ? '<div class="tw"><table><thead><tr><th>金額</th><th>口座</th><th>名義照合</th><th>状態</th><th></th></tr></thead><tbody>' + C.payments.map(function(p){ var b = bm[p.bank_account_id] || {};
    return '<tr><td class="num">' + yen(p.amount) + '</td><td>' + esc(b.bank_name) + ' ' + esc(b.branch_name) + '<br><small>' + esc(b.account_type) + ' ' + esc(b.account_number) + ' ' + esc(b.holder_name) + (b.registered_by_customer ? '　<span class="pill info">お客様が登録</span>' : '') + '</small></td><td>' + (p.name_match ? '<span class="pill ok">一致</span>' : '<span class="pill warn">不一致</span>') + '</td><td>' + pill(PAY, p.status) + (p.review_note ? '<br><small>' + esc(p.review_note) + '</small>' : '') + (p.approved_by ? '<br><small>承認 ' + esc(staffName(p.approved_by)) + '</small>' : '') + '</td><td>'
      + ((p.status === 'draft' || p.status === 'needs_review') && p.created_by !== GL.userId() ? '<form class="btns" data-form="approvepay" data-id="' + p.id + '">' + (p.status === 'needs_review' ? '<input name="note" placeholder="確認した内容（必須）" required style="width:180px">' : '') + '<button class="btn sm">承認する</button></form>' : '')
      + ((p.status === 'draft' || p.status === 'needs_review') && p.created_by === GL.userId() ? '<small style="color:var(--mute)">作成者以外の経理担当が承認します</small>' : '')
      + (p.status === 'approved' ? '<button class="btn sm" data-act="paid" data-id="' + p.id + '">振込を実行した</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="empty">振込はまだありません</p>';
  if(C.banks.length) out += '<h3 style="font-size:13px;color:var(--gold-hi)">登録済みの口座</h3><ul class="timeline">' + C.banks.map(function(b){ return '<li>' + dt(b.created_at) + '<span>' + esc(b.bank_name + ' ' + b.branch_name + ' ' + b.account_type + ' ' + b.account_number + ' ' + b.holder_name) + (b.registered_by_customer ? '　<span class="pill info">お客様が登録</span>' : '　<span class="pill">担当者が登録</span>') + '</span></li>'; }).join('') + '</ul>';
  out += '<details><summary style="cursor:pointer;color:var(--gold-hi)">振込先の口座を登録する</summary><form class="f" data-form="bank" style="margin-top:10px"><div class="row"><label class="l">金融機関<input name="bank_name" required></label><label class="l">支店<input name="branch_name" required></label><label class="l">種別<select name="account_type"><option>普通</option><option>当座</option><option>貯蓄</option></select></label><label class="l">口座番号<input name="account_number" inputmode="numeric" pattern="[0-9]{6,8}" required></label></div><label class="l">口座名義（カナ）<input name="holder_name" required></label><p class="note">原則として売主ご本人（法人の場合は法人）名義の口座です。代理人名義の口座は承認時に確認が必要になります。</p><div class="btns"><button class="btn sm">登録する</button></div></form></details>';
  if(signed && !C.payments.some(function(p){ return p.status !== 'cancelled'; })){
    var total = approvedLines(latestAppraisal()).reduce(function(s, l){ return s + l.amount; }, 0);
    out += C.banks.length ? '<form class="f" data-form="payment"><input type="hidden" name="contract_id" value="' + signed.id + '"><div class="row"><label class="l">振込先<select name="bank_account_id">' + C.banks.map(function(b){ return '<option value="' + b.id + '">' + esc(b.bank_name + ' ' + b.branch_name + ' ' + b.account_number + ' ' + b.holder_name) + '</option>'; }).join('') + '</select></label><label class="l">金額（契約の合計・変更不可）<input name="amount" type="number" value="' + total + '" readonly></label></div><div class="btns"><button class="btn sm">振込を作成する</button></div></form>' : '<p class="empty">口座を登録すると振込を作成できます</p>';
  } else if(!signed) out += '<p class="empty">売買契約の締結後に振込を作成できます</p>';
  return out;
}

function bindCase(){
  var m = $('#main');
  m.onsubmit = async function(e){
    var f = e.target.closest('form[data-form]'); if(!f) return; e.preventDefault();
    var d = formData(f), k = f.dataset.form, btn = f.querySelector('button:not([type=button])'); if(btn) btn.disabled = true;
    try{ await FORMS[k](d, f); toast('保存しました'); await viewCase(C.app.id); }
    catch(x){ toast(x.message, true); if(btn) btn.disabled = false; }
  };
  m.onclick = async function(e){
    var b = e.target.closest('[data-act]'); if(!b) return;
    var k = b.dataset.act;
    if(k === 'view'){ var r = $('#doc-' + b.dataset.id); r.hidden = !r.hidden; return; }
    if(ASK[k] && !b.dataset.sure){ return askFirst(b, ASK[k]); }
    b.disabled = true;
    try{ var msg = await ACTS[k](b.dataset.id); toast(msg || '保存しました'); if(k !== 'intact' && k !== 'useidr') await viewCase(C.app.id); else b.disabled = false; }
    catch(x){ toast(x.message, true); b.disabled = false; delete b.dataset.sure; }
  };
}
function askFirst(b, text){
  var box = document.createElement('div'); box.className = 'ask'; box.innerHTML = '<span>' + esc(text) + '</span><button class="btn sm" type="button">実行する</button><button class="btn sub sm" type="button">やめる</button>';
  b.after(box); b.hidden = true;
  box.querySelectorAll('button')[0].onclick = function(){ box.remove(); b.hidden = false; b.dataset.sure = '1'; b.click(); };
  box.querySelectorAll('button')[1].onclick = function(){ box.remove(); b.hidden = false; };
}
var ASK = { nda: '定型の秘密保持契約書を作成し、当社（株式会社グローブ・株式会社マネージメントアドバイザーズ）としてあなたの名前で署名します。お客様へ署名のお願いが届きます。', notify: 'お客様へ査定結果を通知します。通知後は金額を変更できません。株式会社グローブの担当者が通知すると、買主の申込みとして記録され、お客様はお手続き画面のチェックと電子署名だけで売買契約まで完了できます。', buyersign: '株式会社グローブを代表して売買契約に署名します。', paid: '銀行での振込を実行したことを記録します。お客様へ振込完了を通知します。', agentok: '代理人の本人確認が記録済みであることを確認しました。', newap: '新しい版の査定を作成します。通知済みの査定は取り下げになります。' };
var FORMS = {
  status: function(d){ return GL.update('applications', { id: C.app.id }, { status: d.status, assigned_to: d.assigned_to || null }); },
  cust: function(d){ return GL.update('customers', { id: C.cust.id }, { kind: d.kind, name: d.name, email: (d.email || '').toLowerCase() || null, tel: d.tel || null, verified_name: d.verified_name || null, verified_kana: d.verified_kana || null }); },
  reply: function(d){ return GL.insert('messages', { application_id: C.app.id, sender: GL.userId(), sender_kind: 'staff', body: d.body }); },
  note: function(d){ return GL.insert('application_notes', { application_id: C.app.id, body: d.body, author: GL.userId() }); },
  mandate: function(d){ return GL.rpc('staff_create_mandate', { p_application: C.app.id, p: { agentName: d.agentName, agentOrg: d.agentOrg, agentEmail: d.agentEmail, validUntil: d.validUntil ? d.validUntil + 'T23:59:59+09:00' : '', apply: d.apply, pickup: d.pickup, approve: d.approve, documents: d.documents, sign: d.sign } }); },
  idc: function(d){ return GL.insert('identity_checks', { application_id: C.app.id, subject: d.subject, full_name: d.full_name, address: d.address, occupation: d.occupation || null, age: d.age ? Number(d.age) : null, method: d.method, evidence_note: d.evidence_note || null, checked_by: GL.userId() }); },
  pickup: function(d){ if(d.method === 'direct' && !d.decision_reason) throw new Error('直接集荷の判断理由を入力してください'); return GL.insert('pickups', { application_id: C.app.id, method: d.method, scheduled_at: d.scheduled_at ? new Date(d.scheduled_at).toISOString() : null, carrier: d.carrier || null, tracking_no: d.tracking_no || null, decision_reason: d.decision_reason || null }); },
  receive: async function(d, f){ await GL.update('pickups', { id: f.dataset.id }, { received_at: new Date().toISOString(), received_by: GL.userId(), received_note: d.received_note || null }); if(['received','contacting','identity_pending','pickup_arranging','in_transit'].indexOf(C.app.status) >= 0) await GL.update('applications', { id: C.app.id }, { status: 'goods_received' }); },
  item: function(d){ return GL.insert('items', { application_id: C.app.id, category: d.category, description: d.description, quantity: Number(d.quantity || 1), features: d.features || null, condition_note: d.condition_note || null }); },
  lines: async function(d){
    var ap = latestAppraisal(), have = {}; C.lines.filter(function(l){ return l.appraisal_id === ap.id; }).forEach(function(l){ have[l.item_id] = l; });
    for(var i = 0; i < C.items.length; i++){ var it = C.items[i], v = d['amt_' + it.id]; if(v === '' || v == null) continue;
      if(have[it.id]) await GL.update('appraisal_lines', { id: have[it.id].id }, { amount: Number(v) }); else await GL.insert('appraisal_lines', { appraisal_id: ap.id, item_id: it.id, amount: Number(v) }); }
  },
  sale: function(d){ return GL.rpc('staff_create_sale_contract', { p_application: C.app.id, p_body: d.body }); },
  bank: function(d){ return GL.insert('bank_accounts', { customer_id: C.cust.id, bank_name: d.bank_name, branch_name: d.branch_name, account_type: d.account_type, account_number: d.account_number, holder_name: d.holder_name }); },
  payment: function(d){ return GL.insert('payments', { application_id: C.app.id, contract_id: d.contract_id, bank_account_id: d.bank_account_id, amount: Number(d.amount), created_by: GL.userId() }); },
  sellerok: function(d, f){ return GL.rpc('staff_confirm_seller', { p_mandate: f.dataset.id, p_note: d.note }); },
  approvepay: function(d, f){ return GL.rpc('staff_approve_payment', { p_payment: f.dataset.id, p_note: d.note || '' }); },
  return: async function(d){ await GL.insert('returns', { application_id: C.app.id, reason: d.reason, carrier: d.carrier || null, tracking_no: d.tracking_no || null }); }
};
var ACTS = {
  notify: async function(){ var ap = latestAppraisal(); if(C.lines.filter(function(l){ return l.appraisal_id === ap.id; }).length < C.items.length){ var f = $('form[data-form=lines]'); await FORMS.lines(formData(f)); } await GL.rpc('staff_notify_appraisal', { p_appraisal: ap.id }); return '査定結果を通知しました'; },
  newap: async function(){ var v = C.appraisals.reduce(function(m, x){ return Math.max(m, x.version); }, 0) + 1; await GL.insert('appraisals', { application_id: C.app.id, version: v }); if(['received','contacting','identity_pending','pickup_arranging','in_transit','goods_received'].indexOf(C.app.status) >= 0) await GL.update('applications', { id: C.app.id }, { status: 'appraising' }); return '査定の下書きを作成しました'; },
  useidr: async function(id){
    var r = C.idr.filter(function(x){ return x.id === id; })[0], f = $('form[data-form=idc]'); if(!f) throw new Error('本人確認欄が見つかりません');
    f.closest('details').open = true; f.subject.value = r.subject; f.full_name.value = r.full_name; f.address.value = r.address; f.occupation.value = r.occupation || '';
    if(r.birthdate){ var b = new Date(r.birthdate), n = new Date(), age = n.getFullYear() - b.getFullYear() - ((n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) ? 1 : 0); f.age.value = age; }
    if(r.method_pref === 'honnin_gentei_yubin' || r.method_pref === 'mibun_copy_kakitome_koza') f.method.value = r.method_pref;
    f.scrollIntoView({ block: 'center' }); return '申告の内容を写しました。確認の方法を実施してから「記録する」を押してください';
  },
  agentok: function(id){ return GL.update('mandates', { id: id }, { agent_identity_checked: true }); },
  intact: async function(id){ var ok = await GL.rpc('contract_intact', { p_contract: id }); if(!ok) throw new Error('改ざんの疑いがあります。本文または署名時の内容が一致しません'); return '改ざんは検出されませんでした'; },
  buyersign: async function(id){ await GL.rpc('staff_sign_contract', { p_contract: id }); return '署名しました'; },
  nda: async function(){ await GL.rpc('staff_create_nda', { p_application: C.app.id }); return '秘密保持契約を作成し、お客様へ署名をお願いしました'; },
  paid: async function(id){ await GL.rpc('staff_mark_paid', { p_payment: id }); return '振込を記録しました'; },
  shipped: function(id){ return GL.update('returns', { id: id }, { shipped_at: new Date().toISOString() }); },
  delivered: async function(id){ await GL.update('returns', { id: id }, { delivered_at: new Date().toISOString() }); }
};

// ============ その他の画面 ============
async function viewContacts(){ var my = S.seq;
  var rows = await GL.select('contacts', { order: 'created_at.desc', limit: 300 });
  if(my !== S.seq) return; $('#main').innerHTML = top('問い合わせ', '<span class="pill">' + rows.filter(function(r){ return !r.handled; }).length + '件 未対応</span>') + '<div class="card"><div class="tw"><table><thead><tr><th>日時</th><th>お名前</th><th>連絡先</th><th>内容</th><th></th></tr></thead><tbody>'
    + (rows.map(function(r){ return '<tr><td>' + dt(r.created_at) + '</td><td>' + esc(r.name) + '</td><td>' + esc(r.reach) + '</td><td style="white-space:pre-wrap">' + esc(r.body) + '</td><td>' + (r.handled ? '<span class="pill ok">対応済</span>' : '<button class="btn sub sm" data-id="' + r.id + '">対応済にする</button>') + '</td></tr>'; }).join('') || '<tr><td colspan="5" class="empty">問い合わせはありません</td></tr>') + '</tbody></table></div></div>';
  $('#main').onclick = async function(e){ var b = e.target.closest('button[data-id]'); if(!b) return; b.disabled = true; try{ await GL.update('contacts', { id: b.dataset.id }, { handled: true }); viewContacts(); }catch(x){ toast(x.message, true); b.disabled = false; } };
}
async function viewCodes(){ var my = S.seq;
  var rows = await GL.select('referral_codes', { order: 'created_at.desc' });
  if(my !== S.seq) return; $('#main').innerHTML = top('紹介コード') + (can('sales') ? '<div class="card"><header><h2>紹介コードを発行する</h2><span class="hint">英大文字・数字・ハイフンで4〜32文字</span></header><div class="in"><form class="f" id="cf"><div class="row"><label class="l">コード<input name="code" required pattern="[A-Za-z0-9-]{4,32}" value="' + genCode() + '"></label><label class="l">紹介者<input name="referrer_name" required></label><label class="l">有効期限<input name="expires" type="date"></label><label class="l">利用回数の上限<input name="max_uses" type="number" min="1"></label></div><label class="l">メモ<input name="note"></label><div class="btns"><button class="btn sm">発行する</button></div></form></div></div>' : '')
    + '<div class="card"><div class="tw"><table><thead><tr><th>コード</th><th>紹介者</th><th>期限</th><th class="r">利用</th><th>状態</th><th></th></tr></thead><tbody>' + (rows.map(function(r){
      var live = r.active && (!r.expires_at || new Date(r.expires_at) > new Date()) && (!r.max_uses || r.uses < r.max_uses);
      return '<tr><td class="mono">' + esc(r.code) + '</td><td>' + esc(r.referrer_name) + (r.note ? '<br><small>' + esc(r.note) + '</small>' : '') + '</td><td>' + (r.expires_at ? day(r.expires_at) : '無期限') + '</td><td class="r num">' + r.uses + (r.max_uses ? ' / ' + r.max_uses : '') + '</td><td>' + (live ? '<span class="pill ok">有効</span>' : '<span class="pill">無効</span>') + '</td><td>' + (can('sales') ? '<button class="btn sub sm" data-id="' + r.id + '" data-on="' + (!r.active) + '">' + (r.active ? '停止する' : '再開する') + '</button>' : '') + '</td></tr>'; }).join('') || '<tr><td colspan="6" class="empty">紹介コードはありません</td></tr>') + '</tbody></table></div></div>';
  var cf = $('#cf'); if(cf) cf.addEventListener('submit', async function(e){ e.preventDefault(); var d = formData(cf); try{ await GL.insert('referral_codes', { code: d.code.toUpperCase(), referrer_name: d.referrer_name, note: d.note || null, expires_at: d.expires ? d.expires + 'T23:59:59+09:00' : null, max_uses: d.max_uses ? Number(d.max_uses) : null }); toast('発行しました：' + d.code.toUpperCase()); viewCodes(); }catch(x){ toast(/duplicate|unique/i.test(x.message) ? 'そのコードはすでに使われています' : x.message, true); } });
  $('#main').onclick = async function(e){ var b = e.target.closest('button[data-id]'); if(!b) return; try{ await GL.update('referral_codes', { id: b.dataset.id }, { active: b.dataset.on === 'true' }); viewCodes(); }catch(x){ toast(x.message, true); } };
}
function genCode(){ var a = 'ACDEFGHJKLMNPQRTUVWXY34679', s = 'GL-'; var r = new Uint32Array(6); crypto.getRandomValues(r); for(var i = 0; i < 6; i++) s += a[r[i] % a.length]; return s; }
async function viewPayments(){ var my = S.seq;
  var rows = await GL.select('payments', { order: 'created_at.desc', limit: 300 });
  var apps = rows.length ? await safe(GL.select('applications', { id: 'in.(' + rows.map(function(r){ return r.application_id; }).join(',') + ')' })) : [];
  var am = {}; apps.forEach(function(a){ am[a.id] = a; });
  if(my !== S.seq) return; $('#main').innerHTML = top('振込') + '<div class="card"><div class="tw"><table><thead><tr><th>受付番号</th><th>作成</th><th class="r">金額</th><th>名義照合</th><th>状態</th></tr></thead><tbody>' + (rows.map(function(p){ var a = am[p.application_id] || {};
    return '<tr class="click" data-id="' + p.application_id + '"><td class="mono">' + esc(a.receipt_no) + '</td><td>' + dt(p.created_at) + '</td><td class="r num">' + yen(p.amount) + '</td><td>' + (p.name_match ? '<span class="pill ok">一致</span>' : '<span class="pill warn">不一致</span>') + '</td><td>' + pill(PAY, p.status) + '</td></tr>'; }).join('') || '<tr><td colspan="5" class="empty">振込はありません</td></tr>') + '</tbody></table></div></div>';
  $('#main').onclick = function(e){ var tr = e.target.closest('tr[data-id]'); if(tr) location.hash = 'case/' + tr.dataset.id + '/s-pay'; };
}
async function viewLedger(){ var my = S.seq;
  var rows = await GL.select('kobutsu_ledger', { order: 'trade_at.desc', limit: 1000 });
  if(my !== S.seq) return; $('#main').innerHTML = top('古物台帳', '<button class="btn sub sm" id="csv">表計算用に保存（CSV）</button>') + '<p class="note">古物営業法に基づく取引の記録です。売買契約が締結された、承認済みの商品だけが載ります。記録は削除できません。</p><div class="card"><div class="tw"><table><thead><tr><th>取引日</th><th>受付番号</th><th>品目</th><th>特徴</th><th class="r">数量</th><th class="r">代価</th><th>相手方（氏名・住所・職業・年齢）</th><th>確認方法</th></tr></thead><tbody>'
    + (rows.map(function(r){ return '<tr><td>' + day(r.trade_at) + '</td><td class="mono">' + esc(r.receipt_no) + '</td><td>' + esc(r.category) + '<br><small>' + esc(r.description) + '</small></td><td><small>' + esc(r.features || '') + '</small></td><td class="r num">' + r.quantity + '</td><td class="r num">' + yen(r.amount) + '</td><td>' + esc(r.full_name) + '<br><small>' + esc(r.address) + '　' + esc(r.occupation || '') + '　' + (r.age != null ? r.age + '歳' : '') + '</small></td><td><small>' + esc(METHOD[r.identity_method] || '') + '</small></td></tr>'; }).join('') || '<tr><td colspan="8" class="empty">記録はありません</td></tr>') + '</tbody></table></div></div>';
  $('#csv').onclick = function(){
    var head = ['取引日','受付番号','品目','品名','特徴','数量','代価','氏名','住所','職業','年齢','確認方法','確認日時'];
    var lines = [head].concat(rows.map(function(r){ return [day(r.trade_at), r.receipt_no, r.category, r.description, r.features, r.quantity, r.amount, r.full_name, r.address, r.occupation, r.age, METHOD[r.identity_method], dt(r.checked_at)]; }));
    var csv = '﻿' + lines.map(function(l){ return l.map(function(v){ return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = '古物台帳_' + new Date().toISOString().slice(0, 10) + '.csv'; a.click();
  };
}
async function viewSummary(){ var my = S.seq;
  var apps = can('reception','appraiser','finance') ? await safe(GL.select('applications', { select: 'id,status,created_at', limit: 5000 })) : [];
  var pays = can('finance') ? await safe(GL.select('payments', { select: 'amount,status,paid_at', status: 'eq.paid', limit: 5000 })) : [];
  var month = new Date().toISOString().slice(0, 7), counts = {};
  apps.forEach(function(a){ counts[a.status] = (counts[a.status] || 0) + 1; });
  var thisMonth = apps.filter(function(a){ return a.created_at.slice(0, 7) === month; }).length;
  var byM = {}; pays.forEach(function(p){ var m = (p.paid_at || '').slice(0, 7); byM[m] = (byM[m] || 0) + p.amount; });
  var openN = apps.filter(function(a){ return ['closed','cancelled','paid','returned','declined'].indexOf(a.status) < 0; }).length;
  if(my !== S.seq) return; $('#main').innerHTML = top('集計') + '<div class="stats"><div class="stat"><b>' + thisMonth + '</b><span>今月の申込</span></div><div class="stat"><b>' + openN + '</b><span>進行中の案件</span></div><div class="stat"><b>' + (counts.appraisal_notified || 0) + '</b><span>回答待ちの査定</span></div>'
    + (can('finance') ? '<div class="stat"><b>' + yen(byM[month] || 0) + '</b><span>今月の買取額（振込済）</span></div>' : '') + '</div>'
    + '<div class="grid2"><div class="card"><header><h2>状態ごとの件数</h2></header><div class="in"><table><tbody>' + Object.keys(STATUS).filter(function(k){ return counts[k]; }).map(function(k){ return '<tr><td>' + pill(STATUS, k) + '</td><td class="r num">' + counts[k] + '件</td></tr>'; }).join('') + '</tbody></table>' + (apps.length ? '' : '<p class="empty">表示できる案件はありません</p>') + '</div></div>'
    + (can('finance') ? '<div class="card"><header><h2>月別の買取額（振込済）</h2></header><div class="in"><table><tbody>' + (Object.keys(byM).sort().reverse().map(function(m){ return '<tr><td>' + esc(m.replace('-', '年')) + '月</td><td class="r num">' + yen(byM[m]) + '</td></tr>'; }).join('') || '<tr><td class="empty">振込済の記録はありません</td></tr>') + '</tbody></table><p class="note">再販による売上・粗利は「再販・粗利」の画面で確認できます。</p></div></div>' : '') + '</div>';
}
async function viewStaff(){ var my = S.seq;
  S.staff = await GL.select('staff', { order: 'name.asc' });
  if(my !== S.seq) return; $('#main').innerHTML = top('担当者') + '<div class="card"><header><h2>担当者を登録する</h2><span class="hint">先にSupabaseの管理画面からメールで招待してください</span></header><div class="in"><form class="f" id="sf"><div class="row"><label class="l">メールアドレス<input name="email" type="email" required></label><label class="l">氏名<input name="name" required></label><label class="l">所属<select name="company"><option value="management_advisers">マネージメントアドバイザーズ</option><option value="glove">グローブ</option></select></label><label class="l">役割<select name="role">' + Object.keys(ROLE).map(function(k){ return '<option value="' + k + '">' + ROLE[k] + '</option>'; }).join('') + '</select></label></div><div class="btns"><button class="btn sm">登録する</button></div></form></div></div>'
    + '<div class="card"><div class="tw"><table><thead><tr><th>氏名</th><th>所属</th><th>役割</th><th>状態</th><th></th></tr></thead><tbody>' + S.staff.map(function(s){ return '<tr><td>' + esc(s.name) + '</td><td>' + esc(COMPANY[s.company]) + '</td><td><select data-role="' + s.user_id + '" aria-label="役割">' + Object.keys(ROLE).map(function(k){ return '<option value="' + k + '"' + (s.role === k ? ' selected' : '') + '>' + ROLE[k] + '</option>'; }).join('') + '</select></td><td>' + (s.active ? '<span class="pill ok">有効</span>' : '<span class="pill bad">停止</span>') + '</td><td>' + (s.user_id !== GL.userId() ? '<button class="btn sub sm" data-act="' + s.user_id + '" data-on="' + (!s.active) + '">' + (s.active ? '停止する' : '再開する') + '</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div></div>'
    + '<div class="note">役割ごとに見られる情報：受付＝案件・問い合わせ・写真／査定＝案件・本人確認・査定・契約／経理＝振込・口座・本人確認／営業＝紹介コードのみ／管理者＝すべてと操作履歴</div>';
  $('#sf').addEventListener('submit', async function(e){ e.preventDefault(); var d = formData(e.target); try{ await GL.rpc('admin_add_staff', { p_email: d.email, p_name: d.name, p_company: d.company, p_role: d.role }); toast('登録しました'); viewStaff(); }catch(x){ toast(x.message, true); } });
  $('#main').onchange = async function(e){ var s = e.target.closest('select[data-role]'); if(!s) return; try{ await GL.update('staff', { user_id: s.dataset.role }, { role: s.value }); toast('役割を変更しました'); }catch(x){ toast(x.message, true); } };
  $('#main').onclick = async function(e){ var b = e.target.closest('button[data-act]'); if(!b) return; try{ await GL.update('staff', { user_id: b.dataset.act }, { active: b.dataset.on === 'true' }); viewStaff(); }catch(x){ toast(x.message, true); } };
}
var TBL = { applications:'申込', customers:'売主', mandates:'委任', identity_checks:'本人確認', pickups:'集荷', items:'商品', appraisals:'査定', appraisal_lines:'査定額', approvals:'承認', contracts:'契約', contract_signatures:'署名', bank_accounts:'口座', payments:'振込', returns:'返却', staff:'担当者', referral_codes:'紹介コード', application_notes:'メモ', contacts:'問い合わせ' };
async function viewAudit(){ var my = S.seq;
  var rows = await GL.select('audit_log', { order: 'id.desc', limit: 300 });
  if(my !== S.seq) return; $('#main').innerHTML = top('操作履歴', '<span class="pill">最新300件</span>') + '<p class="note">誰が・いつ・何を変えたかの記録です。追記のみで、削除や書換えはできません。</p><div class="card"><div class="tw"><table><thead><tr><th>日時</th><th>操作した人</th><th>対象</th><th>操作</th><th>変わった項目</th></tr></thead><tbody>'
    + rows.map(function(r){ var ch = []; if(r.action === 'UPDATE' && r.before && r.after) Object.keys(r.after).forEach(function(k){ if(JSON.stringify(r.before[k]) !== JSON.stringify(r.after[k]) && k !== 'updated_at') ch.push(k); });
      return '<tr><td>' + dt(r.at) + '</td><td>' + (r.actor ? esc(staffName(r.actor)) === '—' ? 'お客様・代理人' : esc(staffName(r.actor)) : '受付フォーム・自動処理') + '</td><td>' + esc(TBL[r.table_name] || r.table_name) + '</td><td>' + ({ INSERT:'作成', UPDATE:'変更', DELETE:'削除' })[r.action] + '</td><td><small>' + esc(ch.join('、')) + '</small></td></tr>'; }).join('') + '</tbody></table></div></div>';
}

async function viewAccount(){ var my = S.seq;
  if(my !== S.seq) return; $('#main').innerHTML = top('パスワード変更') + '<div class="card" style="max-width:520px"><div class="in"><form class="f" id="pw"><label class="l">新しいパスワード（12文字以上）<input type="password" name="p1" minlength="12" autocomplete="new-password" required></label><label class="l">もう一度<input type="password" name="p2" minlength="12" autocomplete="new-password" required></label><p class="err" id="pw-err"></p><div class="btns"><button class="btn sm">変更する</button></div></form></div></div>';
  $('#pw').addEventListener('submit', async function(e){ e.preventDefault(); var d = formData(e.target), er = $('#pw-err'); er.textContent = '';
    if(d.p1.length < 12) return er.textContent = '12文字以上にしてください'; if(d.p1 !== d.p2) return er.textContent = '2回の入力が一致しません';
    try{ await GL.setPassword(d.p1); e.target.reset(); toast('パスワードを変更しました'); }catch(x){ er.textContent = x.message; } });
}
var BK_TABLES = ['support_faq','support_cat','resales','identity_requests','pickup_requests','return_requests','messages','support_threads','support_messages','staff','referral_codes','customers','applications','application_notes','contacts','mandates','identity_checks','pickups','items','appraisals','appraisal_lines','approvals','contracts','contract_signatures','bank_accounts','payments','returns','notifications','portal_events','audit_log'];
async function viewBackup(){ var my = S.seq;
  if(my !== S.seq) return; $('#main').innerHTML = top('バックアップ') + '<div class="card" style="max-width:640px"><div class="in"><p>すべての記録を、合言葉で暗号化した1つのファイルにして、この端末に保存します。無料プランには自動の復元機能がないため、週に1回の保存をおすすめします。</p>'
    + '<p class="note">合言葉を忘れると復元できません。合言葉はファイルと別の場所に控えてください。写真を含めるとファイルが大きくなり、時間がかかります（目安：写真100枚で数十MB）。</p>'
    + '<form class="f" id="bk"><label class="l">合言葉（16文字以上）<input type="password" name="pass" minlength="16" autocomplete="new-password" required></label><label class="l">もう一度<input type="password" name="pass2" minlength="16" autocomplete="new-password" required></label><label class="chk" style="display:block"><label><input type="checkbox" name="photos" checked> お品物の写真も含める</label></label><p class="err" id="bk-err"></p><div class="btns"><button class="btn sm">暗号化して保存する</button></div></form></div></div>'
    + '<div class="card" style="max-width:640px"><header><h2>バックアップの中身を確認する</h2></header><div class="in"><p class="note">保存したファイルが正しく復元できるかを、この端末の中だけで確かめます（どこにも送信しません）。</p><form class="f" id="bkc"><label class="l">バックアップファイル<input type="file" name="file" accept=".glbak" required></label><label class="l">合言葉<input type="password" name="pass" autocomplete="off" required></label><p class="err" id="bkc-err"></p><div class="btns"><button class="btn sub sm">確認する</button></div></form><div id="bkc-out"></div></div></div>';
  $('#bkc').addEventListener('submit', async function(e){
    e.preventDefault(); var f = e.target, er = $('#bkc-err'); er.textContent = ''; $('#bkc-out').innerHTML = '';
    try{
      var buf = new Uint8Array(await f.file.files[0].arrayBuffer());
      if(new TextDecoder().decode(buf.slice(0, 8)) !== 'GLOVEBK1') throw new Error('G-LOVEのバックアップファイルではありません');
      var base = await crypto.subtle.importKey('raw', new TextEncoder().encode(f.pass.value), 'PBKDF2', false, ['deriveKey']);
      var key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: buf.slice(8, 24), iterations: 310000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      var pt; try{ pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(24, 36) }, key, buf.slice(36)); }catch(x){ throw new Error('合言葉が違うか、ファイルが壊れています'); }
      var j = JSON.parse(new TextDecoder().decode(pt));
      $('#bkc-out').innerHTML = '<p class="note ok">復元できます。保存日時 ' + dt(j.at) + '　保存した人 ' + esc(j.by || '') + '</p><div class="tw"><table><tbody>' + Object.keys(j.tables).map(function(k){ return '<tr><td>' + esc(k) + '</td><td class="r">' + j.tables[k].length + '件</td></tr>'; }).join('') + '<tr><td>写真</td><td class="r">' + (j.photos ? Object.keys(j.photos).length + '枚' : '含まれていません') + '</td></tr></tbody></table></div>';
      f.pass.value = '';
    }catch(x){ er.textContent = x.message; }
  });
  $('#bk').addEventListener('submit', async function(e){
    e.preventDefault(); var d = formData(e.target), er = $('#bk-err'), btn = e.target.querySelector('button'); er.textContent = '';
    if(d.pass.length < 16) return er.textContent = '16文字以上にしてください'; if(d.pass !== d.pass2) return er.textContent = '2回の入力が一致しません';
    btn.disabled = true; btn.textContent = '読み出しています…';
    try{
      var out = { app: 'G-LOVE', at: new Date().toISOString(), by: S.me.name, tables: {} };
      for(var i = 0; i < BK_TABLES.length; i++){ var t = BK_TABLES[i], rows = [], off = 0, page;
        do{ page = await GL.select(t, { limit: 1000, offset: off }); rows = rows.concat(page); off += 1000; } while(page.length === 1000);
        out.tables[t] = rows; }
      var nPhoto = 0;
      if(d.photos){
        out.photos = {}; var apps = out.tables.applications || [];
        for(var j = 0; j < apps.length; j++){ var tok = apps[j].upload_token; if(!tok) continue;
          var objs = []; try{ objs = await GL.list('intake', tok); }catch(x){}
          for(var k = 0; k < objs.length; k++){ var path = tok + '/' + objs[k].name;
            btn.textContent = '写真を読み出しています…（' + (nPhoto + 1) + '枚目）';
            try{ var u = await GL.signedUrl('intake', path), res = await fetch(u); if(!res.ok) continue; var bl = await res.blob();
              out.photos[path] = await new Promise(function(ok, ng){ var fr = new FileReader(); fr.onload = function(){ ok(fr.result); }; fr.onerror = ng; fr.readAsDataURL(bl); }); nPhoto++; }catch(x){} } }
      }
      btn.textContent = '暗号化しています…';
      var enc = new TextEncoder(), salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
      var base = await crypto.subtle.importKey('raw', enc.encode(d.pass), 'PBKDF2', false, ['deriveKey']);
      var key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: 310000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
      var ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, enc.encode(JSON.stringify(out))));
      var hdr = enc.encode('GLOVEBK1'), blob = new Blob([hdr, salt, iv, ct], { type: 'application/octet-stream' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'g-love-backup-' + out.at.slice(0, 10) + '.glbak'; a.click();
      var n = Object.keys(out.tables).reduce(function(s, k){ return s + out.tables[k].length; }, 0);
      toast('保存しました（' + n + '件の記録' + (d.photos ? '・写真' + nPhoto + '枚' : '') + '）'); e.target.reset();
    }catch(x){ er.textContent = x.message; }
    btn.disabled = false; btn.textContent = '暗号化して保存する';
  });
}

// ============ サポート（リアルタイム相談） ============
var SUP = { cur: null, last: 0, msgs: [], timer: null, list: [] };
var TOPIC_PAGE = { top:'トップ', guide:'ご利用ガイド', apply:'申込画面', status:'お手続き', result:'査定結果', documents:'契約・書類', agent:'代理の方へ', contact:'お問い合わせ' };
async function viewSupport(){ var my = S.seq;
  if(SUP.timer) clearInterval(SUP.timer);
  if(my !== S.seq) return; $('#main').innerHTML = top('サポート', '<span class="pill ok">在席中として表示されています</span>')
    + '<p class="note">サイト右下の「使い方・相談」の相談です。はじめは自動応答がお答えし、お客様が「担当者につなぐ」を押すか、自動応答で答えられないときに、ここへ「返信待ち」で届きます（メールでもお知らせします）。この画面を開いている間、お客様には「担当者が対応しています」と表示されます。自動応答中の相談にこちらから返信すると、その相談は担当者対応に切り替わります。回答の追加・修正は「自動応答」の画面で行えます。</p>'
    + '<div class="sup"><div class="card sup-list"><header><h2>相談</h2><label class="chk"><label><input type="checkbox" id="sup-auto">自動応答中も表示</label><label><input type="checkbox" id="sup-closed">終了も表示</label></label></header><div id="sup-items"></div></div>'
    + '<div class="card sup-chat"><div id="sup-pane" class="in"><p class="empty">左の一覧から相談を選んでください</p></div></div></div>';
  $('#sup-closed').onchange = loadList; $('#sup-auto').onchange = loadList;
  $('#sup-items').onclick = function(e){ var a = e.target.closest('[data-th]'); if(a) openThread(a.dataset.th); };
  await loadList(); if(SUP.cur) openThread(SUP.cur);
  SUP.timer = setInterval(function(){ if(location.hash.indexOf('#support') !== 0){ clearInterval(SUP.timer); return; } if(document.hidden) return; loadList(); if(SUP.cur) pollThread(); }, 4000);
}
async function loadList(){
  var all = $('#sup-closed') && $('#sup-closed').checked;
  var p = { order: 'last_customer_at.desc', limit: 200 }; if(!all) p.status = 'eq.open'; if(!($('#sup-auto') && $('#sup-auto').checked)) p.mode = 'eq.staff';
  SUP.list = await safe(GL.select('support_threads', p));
  var box = $('#sup-items'); if(!box) return;
  box.innerHTML = SUP.list.length ? SUP.list.map(function(t){ var wait = t.status === 'open' && t.mode === 'staff' && (!t.last_staff_at || new Date(t.last_customer_at) > new Date(t.last_staff_at));
    return '<button type="button" class="sup-item' + (SUP.cur === t.id ? ' on' : '') + '" data-th="' + t.id + '"><b>' + esc(t.display_name) + '</b>' + (wait ? ' <span class="pill bad">返信待ち</span>' : '') + (t.mode === 'auto' && t.status === 'open' ? ' <span class="pill">自動応答中</span>' : '') + (t.status === 'closed' ? ' <span class="pill">終了</span>' : '') + (t.trial ? ' <span class="pill warn">試験</span>' : '') + '<br><small>' + esc(t.topic) + '　' + esc(TOPIC_PAGE[t.page] || t.page || '') + '　' + dt(t.last_customer_at) + '</small></button>'; }).join('')
    : '<p class="empty" style="padding:12px 16px">担当者への相談はありません（自動応答中の相談は上のチェックで表示）</p>';
}
async function openThread(id){
  SUP.cur = id; SUP.last = 0; SUP.msgs = [];
  document.querySelectorAll('.sup-item').forEach(function(b){ b.classList.toggle('on', b.dataset.th === id); });
  var t = SUP.list.filter(function(x){ return x.id === id; })[0] || {};
  $('#sup-pane').innerHTML = '<div class="btns" style="justify-content:space-between"><div><b>' + esc(t.display_name) + '</b>　<small style="color:var(--mute)">' + esc(t.topic) + '　開始 ' + dt(t.created_at) + '</small></div>' + (t.status === 'open' ? '<button class="btn sub sm" id="sup-close">相談を終了する</button>' : '<span class="pill">終了</span>') + '</div>'
    + '<div class="sup-log" id="sup-log"></div>'
    + (t.status === 'open' ? '<form class="f" id="sup-form"><textarea name="body" maxlength="1000" required placeholder="お客様への返信（Ctrl＋Enterでも送信）" style="min-height:70px"></textarea><div class="btns"><button class="btn sm">返信する</button><span style="font-size:12px;color:var(--mute)">お取引の詳細（ご住所・口座など）は、チャットではなくログイン後の画面で伺ってください</span></div></form>' : '');
  var f = $('#sup-form');
  if(f){ f.onsubmit = async function(e){ e.preventDefault(); var b = f.querySelector('button'); b.disabled = true; try{ await GL.rpc('staff_support_reply', { p_thread: id, p_body: f.body.value }); f.body.value = ''; await pollThread(); loadList(); }catch(x){ toast(x.message, true); } b.disabled = false; };
    f.body.onkeydown = function(e){ if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); f.requestSubmit(); } }; f.body.focus(); }
  var c = $('#sup-close'); if(c) c.onclick = function(){ if(!c.dataset.sure){ c.dataset.sure = 1; c.textContent = 'もう一度押すと終了します'; return; } GL.rpc('staff_support_close', { p_thread: id }).then(function(){ toast('相談を終了しました'); loadList().then(function(){ openThread(id); }); }).catch(function(x){ toast(x.message, true); }); };
  await pollThread();
}
async function pollThread(){
  var id = SUP.cur; if(!id) return;
  var rows = await safe(GL.select('support_messages', { thread_id: 'eq.' + id, id: 'gt.' + SUP.last, order: 'id.asc', limit: 500 }));
  if(id !== SUP.cur || !rows.length) return;
  SUP.msgs = SUP.msgs.concat(rows); SUP.last = rows[rows.length - 1].id;
  var log = $('#sup-log'); if(!log) return;
  log.innerHTML = SUP.msgs.map(function(m){ return '<div class="sup-m ' + m.sender_kind + '"><small>' + (m.sender_kind === 'staff' ? '担当 ' + esc(staffName(m.staff_id)) : m.sender_kind === 'bot' ? '自動応答' + (m.meta && m.meta.miss ? '（答えられず）' : '') : 'お客様') + '　' + dt(m.created_at) + '</small><p>' + esc(m.body) + '</p></div>'; }).join('');
  log.scrollTop = log.scrollHeight;
}

// ============ 写真の鑑定補助（担当者用・お客様には出さない） ============
async function photoBlob(name){ var u = await GL.signedUrl('intake', C.app.upload_token + '/' + name); var r = await fetch(u); if(!r.ok) throw new Error('写真を読み出せませんでした'); return r.blob(); }
// JPEGの撮影情報（機器・日時・編集ソフト）を読む
function readExif(buf){
  var v = new DataView(buf); if(v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return null;
  var o = 2;
  while(o + 4 < v.byteLength){
    var mk = v.getUint16(o); if((mk & 0xFF00) !== 0xFF00) return null; var len = v.getUint16(o + 2);
    if(mk === 0xFFE1 && v.getUint32(o + 4) === 0x45786966){
      var t = o + 10, le = v.getUint16(t) === 0x4949, g16 = function(p){ return v.getUint16(p, le); }, g32 = function(p){ return v.getUint32(p, le); };
      var str = function(p, n){ var s = ''; for(var i = 0; i < n - 1 && p + i < v.byteLength; i++){ var c = v.getUint8(p + i); if(!c) break; s += String.fromCharCode(c); } return s.trim(); };
      var out = {}, names = { 0x010F:'make', 0x0110:'model', 0x0131:'software', 0x0132:'modified', 0x9003:'taken' };
      var ifd = function(start, depth){ if(start <= 0 || t + start + 2 > v.byteLength) return; var n = g16(t + start);
        for(var i = 0; i < n; i++){ var e = t + start + 2 + i * 12; if(e + 12 > v.byteLength) break; var tag = g16(e), type = g16(e + 2), cnt = g32(e + 4);
          if(tag === 0x8769 && depth < 1) ifd(g32(e + 8), depth + 1);
          else if(names[tag] && type === 2) out[names[tag]] = str(cnt <= 4 ? e + 8 : t + g32(e + 8), cnt); } };
      ifd(g32(t + 4), 0); return out;
    }
    o += 2 + len;
  }
  return {};
}
function grayAt(bmp, w, h){ var c = document.createElement('canvas'); c.width = w; c.height = h; var x = c.getContext('2d'); x.drawImage(bmp, 0, 0, w, h); var d = x.getImageData(0, 0, w, h).data, g = new Float32Array(w * h); for(var i = 0; i < w * h; i++) g[i] = d[i*4] * .299 + d[i*4+1] * .587 + d[i*4+2] * .114; return g; }
function dhash(bmp){ var g = grayAt(bmp, 9, 8), b = ''; for(var y = 0; y < 8; y++) for(var x = 0; x < 8; x++) b += g[y*9 + x] > g[y*9 + x + 1] ? '1' : '0'; return b; }
function sharpness(bmp){ var w = 256, h = Math.max(8, Math.round(bmp.height * 256 / bmp.width)), g = grayAt(bmp, w, h), s = 0, s2 = 0, n = 0;
  for(var y = 1; y < h - 1; y++) for(var x = 1; x < w - 1; x++){ var i = y * w + x, l = 4 * g[i] - g[i-1] - g[i+1] - g[i-w] - g[i+w]; s += l; s2 += l * l; n++; }
  var m = s / n; return Math.round((s2 / n - m * m) * 10) / 10; }
var EDITORS = /photoshop|lightroom|snapseed|picsart|meitu|gimp|canva|facetune|beautycam|vsco|photoroom|remini/i;
function photoTools(){
  GL.rpc('staff_ai_quota', {}).then(function(q){ $('#ai-quota').textContent = q.enabled ? '本日 ' + q.today + '/' + q.dailyLimit + '回・今月 約' + Math.round(q.monthUsd * 155) + '円（上限 約' + Math.round(q.monthlyCapUsd * 155) + '円）' : 'AIの補助は管理者の承認・設定後に使えます'; if(!q.enabled) $('#ai-run').disabled = true; }).catch(function(){});
  $('#pc-run').onclick = async function(){ var b = this; b.disabled = true; b.textContent = '点検しています…';
    try{
      var have = {}; (await safe(GL.select('photo_checks', { application_id: 'eq.' + C.app.id }))).forEach(function(r){ have[r.path] = r; });
      var rows = [];
      for(var i = 0; i < C.photos.length; i++){ var nm = C.photos[i].name, path = C.app.upload_token + '/' + nm;
        if(have[path]){ rows.push(have[path]); continue; }
        var bl = await photoBlob(nm), ex = null; try{ ex = readExif(await bl.arrayBuffer()); }catch(e){}
        var bmp = await createImageBitmap(bl), row = { application_id: C.app.id, path: path, dhash: dhash(bmp), width: bmp.width, height: bmp.height, blur: sharpness(bmp), exif: ex };
        try{ await GL.insert('photo_checks', row); }catch(e){} rows.push(row); }
      var dup = await safe(GL.rpc('staff_photo_dupes', { p_application: C.app.id })); C.pcRows = rows; C.pcDup = dup;
      $('#pc-out').innerHTML = '<div class="tw" style="margin-top:12px"><table><thead><tr><th>写真</th><th>大きさ</th><th>ピント</th><th>撮影情報</th><th>気になる点</th></tr></thead><tbody>' + rows.map(function(r, i){
        var ex = r.exif || {}, warn = [];
        if(!r.exif || (!ex.make && !ex.model && !ex.taken)) warn.push('撮影情報がありません（スクリーンショット・ネットの画像・SNS経由の可能性。実物の写真を追加でお願いすると確実です）');
        if(ex.software && EDITORS.test(ex.software)) warn.push('編集ソフトの記録：' + esc(ex.software));
        if(Math.max(r.width, r.height) < 1000) warn.push('写真が小さいため、細部を確認しにくい');
        if(r.blur < 60) warn.push('ピンぼけの可能性');
        dup.filter(function(d){ return d.path === r.path; }).forEach(function(d){ warn.push('<b>別の案件（' + esc(d.otherReceipt) + '）と同じ、またはほぼ同じ写真</b>'); });
        return '<tr><td class="nw">' + (i + 1) + '枚目</td><td class="nw">' + r.width + '×' + r.height + '</td><td class="nw">' + (r.blur < 60 ? '<span class="pill warn">甘い</span>' : '<span class="pill ok">良好</span>') + '</td><td style="font-size:12px">' + esc([ex.make, ex.model].filter(Boolean).join(' ') || '—') + (ex.taken ? '<br>撮影 ' + esc(ex.taken) : '') + '</td><td style="font-size:12px">' + (warn.join('<br>') || '<span class="pill ok">なし</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    }catch(x){ toast(x.message, true); }
    b.disabled = false; b.textContent = '写真を点検する（無料）'; };
  $('#ai-run').onclick = async function(){ var b = this;
    if(!b.dataset.sure){ b.dataset.sure = 1; b.textContent = '費用がかかります（1回 約5〜10円）。もう一度押すと実行'; return; }
    b.disabled = true; b.textContent = 'AIが写真を確認しています…';
    try{
      var photos = [];
      for(var i = 0; i < Math.min(6, C.photos.length); i++){ var bmp = await createImageBitmap(await photoBlob(C.photos[i].name)), sc = Math.min(1, 1568 / Math.max(bmp.width, bmp.height));
        var cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * sc); cv.height = Math.round(bmp.height * sc); cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
        photos.push({ path: C.app.upload_token + '/' + C.photos[i].name, media_type: 'image/jpeg', data: cv.toDataURL('image/jpeg', .86).split(',')[1] }); }
      await GL.fn('photo-review', { application_id: C.app.id, categories: C.app.categories || [], photos: photos });
      toast('AIの確認結果を記録しました'); MAIL.rows = null; await drawAi(); photoTools();
    }catch(x){ toast(x.message, true); }
    delete b.dataset.sure; b.disabled = false; b.textContent = 'AIで鑑定の補助を受ける（有料・任意）'; };
  $('#pc-pdf').onclick = function(){ photoReport().catch(function(x){ toast(x.message, true); }); };
  drawFree();
  drawAi().then(drawMail, drawMail);
}
// ── 無料の鑑定補助：画像検索（Googleレンズ）・相場の検索・品目ごとの確認チェックリスト ──
var CHECKLIST = {
  '時計': ['文字盤・針・ロゴの印字のにじみ、位置のずれ', '裏蓋・ラグの間の刻印とシリアル番号（保証書の番号と一致するか）', 'リューズ・バックル・コマの刻印', 'ムーブメント（裏蓋を開けられる場合）と秒針の動き', '重さ（同じ型の正規品と比べる）', '保証書・箱・付属品の年代と型番の一致'],
  '宝石・ジュエリー': ['地金の刻印（Pt900・K18 など）と、刻印の位置・深さ', '鑑定書・鑑別書の番号を発行機関で照会', '石の留め方・地金の仕上げ', 'ルーペで石の内包物・研磨の状態を確認', 'ブランド品は刻印・シリアル・ケースの一致'],
  'ブランドバッグ・小物': ['ロゴ刻印の書体・間隔・深さ', 'シリアル（製造番号）・タグの形式と年代の一致', '縫い目の数・間隔・糸の色', '金具の刻印・重さ・メッキの質感', '内側の素材・ポケットの作り', '保存袋・箱・ギャランティカードの一致'],
  '貴金属': ['刻印（K24・K18・Pt1000・SV925 など）', '重さの計量', '磁石に付かないか', '比重の測定（必要に応じて）', 'インゴットは刻印・番号・製造元の確認'],
  '美術品・骨董': ['作家の落款・サイン・共箱', '鑑定書・来歴の書類', '技法・素材・経年の状態', '専門家への照会の要否'],
  'その他': ['製造元・型番・製造番号', '動作の確認', '付属品の有無']
};
function drawFree(){
  var box = $('#free-out'); if(!box) return;
  var cats = (C.app.categories || []).filter(function(c){ return CHECKLIST[c]; }); if(!cats.length) cats = ['その他'];
  var kw = (C.items[0] && (C.items[0].description || '')) || (MAIL.rows && MAIL.rows[0] && MAIL.rows[0].name) || '';
  box.innerHTML = '<div class="ai-box"><p class="ai-h">無料の鑑定補助</p>'
    + '<p style="margin:0;font-size:13px"><b>画像で調べる（Googleレンズ）</b>　同じ型の品物や、ネットに同じ写真がないか（他人の写真の流用）を確かめられます。</p>'
    + '<div class="btns">' + C.photos.map(function(p, i){ return '<button class="btn sub sm" type="button" data-lens="' + esc(p.name) + '">' + (i + 1) + '枚目をレンズで調べる</button>'; }).join('') + '</div>'
    + '<p class="note bad" style="margin:0">押すと、その写真を見られるURL（10分で無効）がGoogleに渡ります。顔・住所・書類などが写っている写真には使わないでください。</p>'
    + '<p style="margin:10px 0 0;font-size:13px"><b>相場を調べる</b>　品名・型番の言葉だけで検索します（写真は送りません）。</p>'
    + '<div class="btns"><input id="kw" value="' + esc(kw) + '" placeholder="例：ブランド名 型番" style="min-width:260px"><button class="btn sub sm" type="button" data-mkt="yahoo">ヤフオクの落札相場</button><button class="btn sub sm" type="button" data-mkt="mercari">メルカリの売り切れ</button><button class="btn sub sm" type="button" data-mkt="google">Googleで検索</button></div>'
    + '<p style="margin:10px 0 0;font-size:13px"><b>真贋の確認チェックリスト</b>　実物を確認しながらチェックし、記録に残せます。</p>'
    + cats.map(function(c){ return '<div class="cl"><p style="margin:4px 0;color:var(--gold-hi)">' + esc(c) + '</p>' + CHECKLIST[c].map(function(t, i){ return '<label class="cl-i"><input type="checkbox" data-cl="' + esc(c) + '|' + i + '"> ' + esc(t) + '</label>'; }).join('') + '</div>'; }).join('')
    + '<label class="l">確認のメモ（任意）<textarea id="cl-note" style="min-height:50px" placeholder="例：裏蓋の刻印とシリアルは保証書と一致"></textarea></label>'
    + '<div class="btns"><button class="btn sub sm" type="button" id="cl-save">確認の結果を案件のメモに記録する</button></div></div>';
  box.onclick = async function(e){ var t = e.target;
    if(t.dataset.lens){ if(!t.dataset.sure){ t.dataset.sure = 1; t.textContent = 'もう一度押すとGoogleレンズを開きます'; return; }
      var w = window.open('about:blank', '_blank');
      try{ var u = await GL.signedUrl('intake', C.app.upload_token + '/' + t.dataset.lens); if(!/^https:\/\//.test(u)) u = location.origin + u.replace(/^.*?(\/storage\/v1)/, '$1');
        if(w) w.location = 'https://lens.google.com/uploadbyurl?url=' + encodeURIComponent(u); }catch(x){ if(w) w.close(); toast(x.message, true); }
      delete t.dataset.sure; t.textContent = t.textContent.replace('もう一度押すとGoogleレンズを開きます', 'レンズで調べる'); drawFree(); return; }
    if(t.dataset.mkt){ var k = $('#kw').value.trim(); if(!k){ toast('品名・型番を入力してください', true); return; }
      var q = encodeURIComponent(k), url = { yahoo: 'https://auctions.yahoo.co.jp/closedsearch/closedsearch?p=' + q, mercari: 'https://jp.mercari.com/search?keyword=' + q + '&status=sold_out', google: 'https://www.google.com/search?q=' + q + '+%E8%B2%B7%E5%8F%96+%E7%9B%B8%E5%A0%B4' }[t.dataset.mkt];
      window.open(url, '_blank', 'noopener'); return; }
    if(t.id === 'cl-save'){ var done = [], left = [];
      box.querySelectorAll('[data-cl]').forEach(function(c){ var k = c.dataset.cl.split('|'), txt = CHECKLIST[k[0]][k[1]]; (c.checked ? done : left).push(txt); });
      var body = '【真贋の確認】' + new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) + '\n確認済み：' + (done.join('／') || 'なし') + '\n未確認：' + (left.join('／') || 'なし') + ($('#cl-note').value.trim() ? '\nメモ：' + $('#cl-note').value.trim() : '');
      try{ await GL.insert('application_notes', { application_id: C.app.id, body: body.slice(0, 2000), author: GL.userId() }); C.clLast = { done: done, left: left, note: $('#cl-note').value.trim() }; toast('案件のメモに記録しました'); }catch(x){ toast(x.message, true); } }
  };
}
// お客様へのご案内文（写真による目安）。金額は担当者が入力欄で決める。AIの結果はそのまま載せない
var MAIL = { rows: null, extra: '' };
function drawMail(){
  var box = $('#mail-out'); if(!box) return;
  if(!MAIL.rows || MAIL.app !== C.app.id){
    var src = (C.aiLast && C.aiLast.items && C.aiLast.items.length) ? C.aiLast.items.map(function(it){ return [it.brand, it.model].filter(Boolean).join(' ') || it.category || ''; })
      : C.items.length ? C.items.map(function(it){ return it.description; }) : [''];
    MAIL = { app: C.app.id, rows: src.map(function(n){ return { name: n, lo: '', hi: '' }; }), photos: (C.aiLast && C.aiLast.more_photos) || [] };
  }
  box.innerHTML = '<div class="ai-box mail-box"><p class="ai-h">お客様へのご案内文（写真による査定の目安）</p>'
    + '<p class="note" style="margin:0">金額を入れると、下の文章に反映されます。AIの結果は参考にとどめ、品名と金額は担当者が確かめて入力してください。</p>'
    + '<div class="tw"><table class="mail-t"><thead><tr><th>品名（お客様に表示）</th><th class="r">目安の下限（円）</th><th class="r">目安の上限（円）</th><th></th></tr></thead><tbody>'
    + MAIL.rows.map(function(r, i){ return '<tr><td><input data-m="name" data-i="' + i + '" value="' + esc(r.name) + '"></td><td><input data-m="lo" data-i="' + i + '" type="number" min="0" step="1000" value="' + esc(r.lo) + '"></td><td><input data-m="hi" data-i="' + i + '" type="number" min="0" step="1000" value="' + esc(r.hi) + '"></td><td><button class="btn sub sm" type="button" data-mdel="' + i + '">削除</button></td></tr>'; }).join('')
    + '</tbody></table></div><div class="btns"><button class="btn sub sm" type="button" id="m-add">行を追加</button><label style="font-size:12px"><input type="checkbox" id="m-mask"' + (MAIL.mask ? ' checked' : '') + '> 品名を伏せる（「お品物1」などと表示）</label></div>'
    + '<label class="l">追加でお願いする写真（任意・1行に1つ）<textarea id="m-photos" style="min-height:50px">' + esc((MAIL.photos || []).join('\n')) + '</textarea></label>'
    + '<label class="l">メールの文章（そのまま編集もできます）<textarea id="m-text" style="min-height:300px;font-family:inherit"></textarea></label>'
    + '<p class="note bad" style="margin:0">メールに品物名や金額を書くと、第三者に見られた場合にお取引が分かります。お客様がメールでのご連絡を希望している場合を除き、「お手続き画面の連絡として送る」をおすすめします（お客様には、連絡が届いたことだけがメールで通知されます）。</p>'
    + '<div class="btns"><button class="btn sm" type="button" id="m-copy">件名と本文をコピー</button><button class="btn sub sm" type="button" id="m-save">文章をファイルで保存（.txt）</button><button class="btn sub sm" type="button" id="m-portal">お手続き画面の連絡として送る</button></div></div>';
  var yen0 = function(n){ return Number(n).toLocaleString('ja-JP'); };
  var make = function(){
    var rows = MAIL.rows.filter(function(r){ return r.name || r.lo || r.hi; }), lo = 0, hi = 0, all = true;
    var lines = rows.map(function(r, i){ var nm = MAIL.mask ? 'お品物' + (i + 1) : (r.name || 'お品物' + (i + 1)), a = r.lo === '' ? null : Number(r.lo), b = r.hi === '' ? null : Number(r.hi);
      if(a == null && b == null){ all = false; return '　' + (i + 1) + '. ' + nm + '：実物を拝見してからのご案内となります'; }
      if(a == null) a = b; if(b == null) b = a; if(a > b){ var t = a; a = b; b = t; } lo += a; hi += b;
      return '　' + (i + 1) + '. ' + nm + '：' + (a === b ? '約' + yen0(a) + '円' : '約' + yen0(a) + '円〜' + yen0(b) + '円'); });
    var ph = $('#m-photos').value.split('\n').map(function(x){ return x.trim(); }).filter(Boolean);
    return '件名：【G-LOVE】お写真による査定の目安のご案内（受付番号 ' + C.app.receipt_no + '）\n\n'
      + 'G-LOVEをご利用いただき、ありがとうございます。\nお送りいただいたお写真を拝見し、査定の目安をお知らせいたします。\n\n'
      + '■ 受付番号：' + C.app.receipt_no + '\n■ 査定の目安（お写真による仮査定）\n' + lines.join('\n') + '\n'
      + (rows.length > 1 && hi ? '　合計の目安：' + (lo === hi ? '約' + yen0(lo) + '円' : '約' + yen0(lo) + '円〜' + yen0(hi) + '円') + (all ? '' : '（金額をお示ししたお品物のみ）') + '\n' : '')
      + '\n※ 上記はお写真からの目安です。実物を拝見したうえで、正式な査定額をお手続き画面で改めてお知らせします。お品物の状態・付属品・真贋の確認により、金額が変わる場合があります。\n'
      + '※ 正式な査定額のご連絡後、売るかどうかはお品物ごとにお選びいただけます。お売りにならない場合も、査定料・送料はかかりません。\n'
      + (ph.length ? '\nより正確な目安のため、次のお写真もお送りいただけますと幸いです。\n' + ph.map(function(x){ return '　・' + x; }).join('\n') + '\n' : '')
      + '\n次のお手続き：お手続き画面にログインし、ご本人確認と集荷の方法をお選びください。\n' + location.origin + location.pathname.replace(/admin\/?.*$/, '') + 'status/\n\n'
      + 'ご不明な点は、お手続き画面の「担当者への連絡」からお気軽にお尋ねください。\n\nG-LOVE　担当：' + S.me.name.split(' ')[0] + '\n※ このメールにお心当たりのない場合は、お手数ですが破棄してください。';
  };
  var redraw = function(){ $('#m-text').value = make(); };
  redraw();
  box.oninput = function(e){ var t = e.target; if(t.dataset.m){ MAIL.rows[t.dataset.i][t.dataset.m] = t.value; redraw(); } if(t.id === 'm-photos'){ MAIL.photos = t.value.split('\n'); redraw(); } };
  box.onchange = function(e){ if(e.target.id === 'm-mask'){ MAIL.mask = e.target.checked; redraw(); } };
  box.onclick = async function(e){ var t = e.target;
    if(t.id === 'm-add'){ MAIL.rows.push({ name: '', lo: '', hi: '' }); drawMail(); }
    if(t.dataset.mdel){ MAIL.rows.splice(Number(t.dataset.mdel), 1); if(!MAIL.rows.length) MAIL.rows.push({ name: '', lo: '', hi: '' }); drawMail(); }
    if(t.id === 'm-copy'){ var v = $('#m-text').value; try{ await navigator.clipboard.writeText(v); toast('コピーしました。メールに貼り付けてください'); }catch(x){ $('#m-text').select(); document.execCommand('copy'); toast('コピーしました'); } }
    if(t.id === 'm-save'){ var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + $('#m-text').value.replace(/\n/g, '\r\n')], { type: 'text/plain' })); a.download = '査定の目安のご案内_' + C.app.receipt_no + '.txt'; a.click(); }
    if(t.id === 'm-portal'){ if(!t.dataset.sure){ t.dataset.sure = 1; t.textContent = 'もう一度押すと、お客様の画面に送ります'; return; }
      t.disabled = true; try{ var body = $('#m-text').value.replace(/^件名：.*\n\n/, ''); await GL.insert('messages', { application_id: C.app.id, sender: GL.userId(), sender_kind: 'staff', body: body.slice(0, 2000) }); toast('お手続き画面の連絡として送りました'); }catch(x){ toast(x.message, true); }
      t.disabled = false; delete t.dataset.sure; t.textContent = 'お手続き画面の連絡として送る'; }
  };
}
// 鑑定補助の報告書（A4・写真は縮小。お名前・ご住所・連絡先は載せない）。印刷画面で「PDFに保存」を選ぶ
async function photoReport(){
  var b = $('#pc-pdf'); b.disabled = true; b.textContent = '報告書を作っています…';
  try{
    var rows = C.pcRows || await safe(GL.select('photo_checks', { application_id: 'eq.' + C.app.id }));
    var ai = (await safe(GL.select('ai_reviews', { application_id: 'eq.' + C.app.id, order: 'created_at.desc', limit: 1 })))[0];
    var thumbs = [];
    for(var i = 0; i < C.photos.length; i++){ try{ var bmp = await createImageBitmap(await photoBlob(C.photos[i].name)), sc = Math.min(1, 520 / Math.max(bmp.width, bmp.height)), cv = document.createElement('canvas');
      cv.width = Math.round(bmp.width * sc); cv.height = Math.round(bmp.height * sc); cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height); thumbs.push(cv.toDataURL('image/jpeg', .72)); }catch(e){ thumbs.push(''); } }
    var rowOf = function(i){ var path = C.app.upload_token + '/' + C.photos[i].name; return rows.filter(function(r){ return r.path === path; })[0]; };
    var x = (ai && ai.result) || {}, now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    var html = '<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>鑑定補助報告書_' + esc(C.app.receipt_no) + '</title><style>'
      + '@page{size:A4;margin:14mm}body{font-family:"Hiragino Sans","Yu Gothic","Noto Sans CJK JP",sans-serif;color:#1c1a16;font-size:10.5pt;line-height:1.6}h1{font-size:15pt;margin:0 0 2mm}.sub{color:#6a6255;font-size:9pt}'
      + '.conf{border:1px solid #8c7448;color:#5a4a2a;padding:2mm 3mm;font-size:9pt;margin:3mm 0}table{width:100%;border-collapse:collapse;margin:2mm 0}td,th{border:1px solid #cfc6b4;padding:1.5mm 2mm;vertical-align:top;text-align:left;font-size:9.5pt}th{background:#f1ece2;width:24%}'
      + '.ph{display:flex;gap:4mm;page-break-inside:avoid;margin:3mm 0;border-top:1px solid #e2dbcd;padding-top:3mm}.ph img{width:55mm;max-height:70mm;object-fit:contain;border:1px solid #cfc6b4;background:#f4f1ea}.ph div{flex:1}h2{font-size:12pt;border-bottom:2px solid #c8ae7d;padding-bottom:1mm;margin:5mm 0 2mm}ul{margin:1mm 0;padding-left:5mm}</style></head><body>'
      + '<h1>写真の鑑定補助 報告書</h1><p class="sub">G-LOVE　受付番号 ' + esc(C.app.receipt_no) + '　作成 ' + esc(now) + '　作成者 ' + esc(S.me.name) + '</p>'
      + '<p class="conf">社外秘・担当者用。お客様には送らないでください。写真の点検とAIの結果は参考情報です。真贋と査定額は、株式会社グローブの査定担当者が実物で判断します。この報告書には、お客様のお名前・ご住所・連絡先を載せていません。</p>'
      + '<table><tr><th>申込の品物の種類</th><td>' + esc((C.app.categories || []).join('、')) + '</td></tr><tr><th>写真</th><td>' + C.photos.length + '枚</td></tr></table>'
      + '<h2>写真ごとの点検</h2>' + C.photos.map(function(p, i){ var r = rowOf(i) || {}, ex = r.exif || {}, w = [];
          if(r.path){ if(!r.exif || (!ex.make && !ex.model && !ex.taken)) w.push('撮影情報なし'); if(ex.software && EDITORS.test(ex.software)) w.push('編集ソフトの記録：' + esc(ex.software)); if(Math.max(r.width, r.height) < 1000) w.push('写真が小さい'); if(r.blur < 60) w.push('ピンぼけの可能性');
            (C.pcDup || []).filter(function(d){ return d.path === r.path; }).forEach(function(d){ w.push('別の案件（' + esc(d.otherReceipt) + '）と同じ写真'); }); }
          return '<div class="ph">' + (thumbs[i] ? '<img src="' + thumbs[i] + '" alt="">' : '') + '<div><b>' + (i + 1) + '枚目</b><table><tr><th>大きさ</th><td>' + (r.width ? r.width + '×' + r.height : '未点検') + '</td></tr><tr><th>撮影情報</th><td>' + esc([ex.make, ex.model].filter(Boolean).join(' ') || '—') + (ex.taken ? '（' + esc(ex.taken) + '）' : '') + '</td></tr><tr><th>気になる点</th><td>' + (r.path ? (w.join('<br>') || 'なし') : '「写真を点検する」を先に実行してください') + '</td></tr></table></div></div>'; }).join('')
      + (C.clLast ? '<h2>真贋の確認チェックリスト</h2><table><tr><th>確認済み</th><td>' + esc(C.clLast.done.join('／') || 'なし') + '</td></tr><tr><th>未確認</th><td>' + esc(C.clLast.left.join('／') || 'なし') + '</td></tr>' + (C.clLast.note ? '<tr><th>メモ</th><td>' + esc(C.clLast.note) + '</td></tr>' : '') + '</table>' : '')
      + '<h2>AIの確認結果（参考）</h2>' + (ai ? '<p class="sub">' + esc(dt(ai.created_at)) + '・' + esc(ai.model) + '</p>' + (x.summary ? '<p>' + esc(x.summary) + '</p>' : '')
          + (x.items || []).map(function(it, i){ return '<table><tr><th>' + esc(it.photo || i + 1) + '枚目</th><td><b>' + esc(it.category || '') + '　' + esc([it.brand, it.model].filter(Boolean).join(' ') || '品物の特定は不明') + '</b>（確からしさ ' + esc(it.confidence || '—') + '）</td></tr>'
            + '<tr><th>素材・特徴・状態</th><td>' + esc([it.material, it.features, it.condition].filter(Boolean).join('／') || '—') + '</td></tr>'
            + '<tr><th>実物で確かめる点</th><td>' + ((it.checks || []).length ? '<ul>' + it.checks.map(function(c){ return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' : '—') + '</td></tr>'
            + ((it.concerns || []).length ? '<tr><th>気になる点</th><td>' + it.concerns.map(esc).join('／') + '</td></tr>' : '') + '</table>'; }).join('')
          + ((x.more_photos || []).length ? '<p>追加でほしい写真：' + x.more_photos.map(esc).join('、') + '</p>' : '') : '<p>AIの確認は行っていません（無料の点検・画像検索・チェックリストで確認）。</p>')
      + '</body></html>';
    var w = window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })), '_blank');
    if(!w){ toast('新しい画面を開けませんでした。ブラウザのポップアップの設定をご確認ください', true); return; }
    w.addEventListener('load', function(){ setTimeout(function(){ try{ w.print(); }catch(e){} }, 400); });
    toast('印刷の画面で「PDFに保存」を選ぶと、メールに添付できるファイルになります');
  } finally { b.disabled = false; b.textContent = '報告書をPDFで保存（メール添付用）'; }
}
async function drawAi(){
  var rs = await safe(GL.select('ai_reviews', { application_id: 'eq.' + C.app.id, order: 'created_at.desc', limit: 5 }));
  if(!rs.length || !$('#ai-out')) return; var r = rs[0], x = r.result || {}; C.aiLast = x;
  $('#ai-out').innerHTML = '<div class="ai-box"><p class="ai-h">AIの確認結果（参考） <small>' + dt(r.created_at) + '・' + esc(r.model) + '・約' + Math.round((r.cost_usd || 0) * 155 * 10) / 10 + '円</small></p>'
    + (x.summary ? '<p>' + esc(x.summary) + '</p>' : '')
    + (x.items || []).map(function(it, i){ return '<div class="ai-item"><p><b>' + esc(it.photo || i + 1) + '枚目：' + esc(it.category || '') + '　' + esc([it.brand, it.model].filter(Boolean).join(' ') || '品物の特定は不明') + '</b>　<span class="pill ' + (it.confidence === '高' ? 'ok' : it.confidence === '低' ? 'warn' : '') + '">確からしさ ' + esc(it.confidence || '—') + '</span></p>'
        + '<p style="font-size:12px;color:var(--mute)">' + esc([it.material, it.features, it.condition].filter(Boolean).join('／')) + '</p>'
        + ((it.checks || []).length ? '<p style="font-size:13px">実物で確かめる点：</p><ul>' + it.checks.map(function(c){ return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' : '')
        + ((it.concerns || []).length ? '<p class="note bad" style="margin:6px 0">気になる点：' + it.concerns.map(esc).join('／') + '</p>' : '')
        + '<button class="btn sub sm" type="button" data-ai-item="' + i + '">この内容で商品欄に下書きする</button></div>'; }).join('')
    + ((x.more_photos || []).length ? '<p style="font-size:13px;margin-top:8px">お客様に追加でお願いしたい写真：' + x.more_photos.map(esc).join('、') + '</p>' : '')
    + (x.privacy_note ? '<p class="note bad">写真に個人情報が写っている可能性：' + esc(x.privacy_note) + '</p>' : '')
    + '<p class="note" style="margin:8px 0 0">この結果は担当者だけが見られます。お客様への連絡に、結果をそのまま使わないでください。</p></div>';
  $('#ai-out').onclick = function(e){ var bt = e.target.closest('[data-ai-item]'); if(!bt) return; var it = (x.items || [])[bt.dataset.aiItem] || {}, f = document.querySelector('form[data-form=item]'); if(!f){ toast('商品の登録欄が見つかりません', true); return; }
    var d = f.closest('details'); if(d) d.open = true; if(f.category){ var opt = Array.prototype.filter.call(f.category.options || [], function(o){ return o.value === it.category || o.text === it.category; })[0]; if(opt) f.category.value = opt.value; else if(f.category.tagName === 'INPUT') f.category.value = it.category || ''; }
    if(f.description) f.description.value = [it.brand, it.model].filter(Boolean).join(' ') || ''; if(f.features) f.features.value = [it.material, it.features].filter(Boolean).join('、'); if(f.condition_note) f.condition_note.value = it.condition || '';
    f.scrollIntoView({ block: 'center' }); toast('下書きしました。実物を確認してから登録してください'); };
}

// ============ 鑑定シート（品物ごと・5段階。担当者用） ============
var RANKS = [['N','新品','未開封・タグ付きなど、販売時のままの状態'],['S','未使用','使用した形跡がない。保管による小さな変化のみ'],['A','美品','目立つ傷・汚れがなく、わずかな使用感のみ'],['B','一般','使用感・小傷はあるが、使用に問題がない'],['C','難あり','目立つ傷・汚れ・破損・動作不良などがある']];
var RANK_ORDER = 'NSABC';
var NEGATIVES = [['ニオイ（たばこ・香水・カビなど）','B'],['動作が未確認','B'],['目立つキズ','B'],['汚れ・シミ・変色','B'],['角・縁のスレ','B'],['付属品の欠品','A'],['修理・部品交換の跡','B'],['破損・欠け・パーツの欠損','C'],['ベタつき・加水分解','C'],['動作不良','C'],['電池の液漏れ','C']];
var ACCESSORIES = ['保証書・ギャランティカード','箱','保存袋','ストラップ・ベルト','鍵・カデナ','鑑定書・鑑別書','説明書','購入時のレシート'];
var SRC = [
  ['dom', '国内オークション（業者間など）', ['JBA（日本ブランドオークション）','SBA（スターバイヤーズオークション）','エコリングのオークション']],
  ['intl', '海外オークション', ['eBay（落札済み）','Catawiki','Heritage Auctions']],
  ['major', '主要販売サイト', ['Amazon','楽天市場','Yahoo!ショッピング','ZOZOTOWN','Chrono24']],
  ['genauc', '一般オークションサイト', ['ヤフオク!（落札相場）','オークファン','モバオク']],
  ['flea', '一般ネット販売サイト（フリマ）', ['メルカリ（売り切れ）','楽天ラクマ','Yahoo!フリマ']],
  ['shop', '中古販売店', ['コメ兵','ブランドオフ','大黒屋','銀蔵','セカンドストリート']]
];
var OTHERS = ['なんぼや','ブランディア','大黒屋','コメ兵','おたからや','ブランドオフ','銀蔵'];
var SEARCH = {
  'eBay（落札済み）': 'https://www.ebay.com/sch/i.html?LH_Sold=1&LH_Complete=1&_nkw=',
  'ヤフオク!（落札相場）': 'https://auctions.yahoo.co.jp/closedsearch/closedsearch?p=',
  'メルカリ（売り切れ）': 'https://jp.mercari.com/search?status=sold_out&keyword=',
  'Amazon': 'https://www.amazon.co.jp/s?k=',
  '楽天市場': 'https://search.rakuten.co.jp/search/mall/'
};
var DOMAINS = { 'Catawiki':'catawiki.com','Heritage Auctions':'ha.com','Yahoo!ショッピング':'shopping.yahoo.co.jp','ZOZOTOWN':'zozo.jp','Chrono24':'chrono24.jp','オークファン':'aucfan.com','モバオク':'mbok.jp','楽天ラクマ':'fril.jp','Yahoo!フリマ':'paypayfleamarket.yahoo.co.jp','コメ兵':'komehyo.jp','ブランドオフ':'brandoff.co.jp','大黒屋':'daikokuya78.com','銀蔵':'ginzo-buy.jp','セカンドストリート':'2ndstreet.jp','なんぼや':'nanboya.com','ブランディア':'brandear.jp','おたからや':'otakaraya.jp' };
function searchUrl(site, kw){ var q = encodeURIComponent(kw); if(SEARCH[site]) return SEARCH[site] + q; if(DOMAINS[site]) return 'https://www.google.com/search?q=' + encodeURIComponent('site:' + DOMAINS[site] + ' ') + q; return 'https://www.google.com/search?q=' + encodeURIComponent(site + ' ') + q; }
function median(a){ a = a.slice().sort(function(x, y){ return x - y; }); var n = a.length; return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : null; }
function num(v){ v = String(v == null ? '' : v).replace(/[,，円\s]/g, ''); return v === '' || isNaN(Number(v)) ? null : Number(v); }
function r1000(v){ return v == null ? null : Math.round(v / 1000) * 1000; }

async function viewSheet(appId, itemId, slot){ var my = S.seq; slot = slot || 1;
  var a = (await GL.select('applications', { id: 'eq.' + appId }))[0]; if(!a) throw new Error('案件が見つかりません');
  var items = await safe(GL.select('items', { application_id: 'eq.' + appId, order: 'created_at.asc' })), it = items.filter(function(x){ return x.id === itemId; })[0] || null;
  var sheets = await safe(GL.select('appraisal_sheets', { application_id: 'eq.' + appId, order: 'version.desc', limit: 50 }));
  var autos = sheets.filter(function(x){ return x.source === 'auto'; });
  sheets = sheets.filter(function(x){ return (x.item_id || null) === (it ? it.id : null) && (it || (x.slot || 1) === slot); });
  // 品物ごとのシートがまだなければ、自動鑑定のシート（同じ順番のもの）を下書きに使う
  var baseRow = sheets[0] || (it ? (autos.filter(function(x){ return x.slot === items.indexOf(it) + 1; })[0] || autos.filter(function(x){ return x.slot === 1; })[0]) : null) || null;
  var rules = {}; (await safe(GL.select('price_rules', { limit: 200 }))).forEach(function(r){ (rules[r.category] = rules[r.category] || {})[r.rank] = Number(r.rate); });
  var ai = (await safe(GL.select('ai_reviews', { application_id: 'eq.' + appId, order: 'created_at.desc', limit: 1 })))[0];
  if(my !== S.seq) return;
  var cat = (it && it.category) || (a.categories || [])[0] || 'その他';
  var blank = function(){ return { s1: { brand: '', model: '', ref: '', year: '', acc: {}, accNote: '', rankGuess: 'A', retail: '' }, s2: { neg: {}, note: '' }, s3: { list: '', saleMin: '', saleMax: '', market: {}, whole: [{ ch: '業者間オークション', min: '', max: '' }, { ch: '買取業者・卸', min: '', max: '' }, { ch: 'インターネット販売', min: '', max: '' }], method: '', others: {}, estOverride: '', costs: { repair: '', cleaning: '', storage: '', fees: '' }, offerFinal: '' }, s4: { points: {}, aging: {}, accuracy: '', missing: '' }, s5: { fx: '横ばい', trend: '横ばい', stock: 'ふつう', script: '' } }; };
  var D = baseRow ? JSON.parse(JSON.stringify(baseRow.data)) : blank();
  if(D.ai && !D.s1){ var meta = D.meta; D = importAi(blank(), D.ai, 'auto'); D.autoMeta = meta || null; }
  if(!baseRow && it){ D.s1.model = it.description || ''; D.s1.features = it.features || ''; }
  if(!baseRow && ai && ai.result && ai.result.items && ai.result.items[0]){ var x0 = ai.result.items[0]; D.s1.brand = D.s1.brand || x0.brand || ''; D.s1.model = D.s1.model || x0.model || ''; }
  var kw = function(){ return [D.s1.brand, D.s1.model, D.s1.ref].filter(Boolean).join(' '); };

  function calc(){
    var mids = []; SRC.forEach(function(g){ ((D.s3.market[g[0]]) || []).forEach(function(r){ if(r.ex) return; var lo = num(r.min), hi = num(r.max); if(lo != null || hi != null) mids.push(((lo != null ? lo : hi) + (hi != null ? hi : lo)) / 2); }); });
    var est = num(D.s3.estOverride) != null ? num(D.s3.estOverride) : median(mids);
    var caps = Object.keys(D.s2.neg).filter(function(k){ return D.s2.neg[k]; }).map(function(k){ return (NEGATIVES.filter(function(n){ return n[0] === k; })[0] || [0, 'C'])[1]; });
    var rank = [D.s1.rankGuess || 'B'].concat(caps).reduce(function(m, r){ return RANK_ORDER.indexOf(r) > RANK_ORDER.indexOf(m) ? r : m; }, 'N');
    var rate = (rules[cat] || rules['その他'] || {})[rank]; if(rate == null) rate = 0.6;
    var cost = ['repair','cleaning','storage','fees'].reduce(function(s, k){ return s + (num(D.s3.costs[k]) || 0); }, 0);
    var base = est != null ? est * rate - cost : null;
    var oth = OTHERS.map(function(n){ var o = D.s3.others[n] || {}; return o.ex ? [null, null] : [num(o.min), num(o.max)]; }).filter(function(p){ return p[0] != null || p[1] != null; });
    var othMax = oth.length ? Math.max.apply(null, oth.map(function(p){ return p[1] != null ? p[1] : p[0]; })) : null, othMin = oth.length ? Math.min.apply(null, oth.map(function(p){ return p[0] != null ? p[0] : p[1]; })) : null;
    var std = r1000(base), low = r1000(base != null ? base * 0.9 : null), high = base != null ? r1000(Math.min(base * 1.08, othMax != null ? Math.max(othMax, base) : base * 1.08)) : null;
    var whole = D.s3.whole.map(function(w){ return { ch: w.ch, mid: (num(w.min) != null && num(w.max) != null) ? (num(w.min) + num(w.max)) / 2 : (num(w.min) != null ? num(w.min) : num(w.max)) }; }).filter(function(w){ return w.mid != null; }).sort(function(x, y){ return y.mid - x.mid; });
    var missing = [];
    [['brand','ブランド・メーカー名'],['model','モデル名'],['ref','型番'],['year','製造年'],['retail','定価']].forEach(function(f){ if(!String(D.s1[f[0]] || '').trim()) missing.push(f[1]); });
    if(!Object.keys(D.s1.acc).some(function(k){ return D.s1.acc[k] != null; })) missing.push('付属品の有無');
    if(!mids.length) missing.push('中古市場の相場');
    if(!oth.length) missing.push('他社の買取価格');
    if(num(D.s4.accuracy) == null) missing.push('真贋の精度');
    (D.s1.aiMissing || []).forEach(function(t){ missing.push(t + '（AIの指摘）'); });
    var pts = (CHECKLIST[cat] || CHECKLIST['その他']), done = pts.filter(function(t, i){ return D.s4.points[i]; }).length;
    return { est: est, mids: mids.length, rank: rank, rate: rate, cost: cost, base: base, std: std, low: low, high: high, othMax: othMax, othMin: othMin, whole: whole, missing: missing, ptsDone: done, ptsAll: pts.length };
  }
  function talk(c){
    var fx = { '円安': '現在は円安の影響で、海外での需要が高まっており、相場が上がりやすい状況です。', '円高': '現在は円高の影響で、海外向けの需要がやや落ち着いています。', '横ばい': '為替は大きく動いておらず、相場は安定しています。' }[D.s5.fx];
    var tr = { '上昇': 'この' + (D.s1.brand || '品物') + 'は、最近の中古市場で取引の価格が上がっている傾向にあります。', '下落': '同じ型の出品が増え、中古市場の価格はやや下がり気味です。', '横ばい': '中古市場の価格は、ここしばらく安定しています。' }[D.s5.trend];
    var st = { '少ない': '市場に出回っている数が少なく、求める方が多い状態です。', '多い': '市場に同じ型が多く出回っているため、状態の良さが価格を左右します。', 'ふつう': '' }[D.s5.stock];
    var acc = ACCESSORIES.filter(function(k){ return D.s1.acc[k] === true; });
    var neg = Object.keys(D.s2.neg).filter(function(k){ return D.s2.neg[k]; });
    return 'お品物を拝見しました。' + [D.s1.brand, D.s1.model].filter(Boolean).join(' ') + (acc.length ? '、' + acc.join('・') + 'もそろっており、' : '') + '大切にお使いだったことが伝わります。\n\n'
      + '金額の根拠をご説明します。' + [fx, tr, st].filter(Boolean).join('') + '\n'
      + '国内外のオークションや販売店での実際の取引の価格を調べ、' + (c.est != null ? '同じ状態の品物はおおむね' + yen(r1000(c.est)) + '前後で取引されています。' : '取引の価格を比べています。') + '\n'
      + 'お品物の状態は「' + c.rank + '（' + (RANKS.filter(function(r){ return r[0] === c.rank; })[0] || ['', ''])[1] + '）」と判定しました。' + (neg.length ? neg.join('・') + 'の点を、正直に価格へ反映しています。' : '') + '\n'
      + 'そのうえで、販売までにかかるクリーニングや手数料などの費用を差し引き、' + (c.std != null ? yen(c.std) + 'をご提示します。' : '金額をご提示します。') + '\n\n'
      + 'ご納得いただけない場合は、お売りにならなくても費用はかかりません。売るかどうかは、お品物ごとに決めていただけます。';
  }
  var IN = function(path, v, attr){ return '<input data-k="' + path + '" value="' + esc(v == null ? '' : v) + '"' + (attr || '') + '>'; };
  var NUMIN = function(path, v){ return IN(path, v, ' inputmode="numeric" placeholder="円"'); };
  function render(){
    var c = calc();
    var pts = CHECKLIST[cat] || CHECKLIST['その他'];
    var AGING = ['加水分解・ベタつき','電池の液漏れ','ニオイの移り','金具の変色・腐食','革の硬化・ひび割れ','動作の未確認'];
    $('#main').innerHTML = top('鑑定シート', '<a class="btn sub sm" href="#case/' + appId + '">案件に戻る</a><button class="btn sm" id="sh-save">この内容で保存（新しい版）</button><button class="btn sub sm" id="sh-pdf">報告書をPDFで保存</button><button class="btn sub sm" id="sh-mail">提示額をご案内文に使う</button>')
      + '<p class="note">受付番号 ' + esc(a.receipt_no) + '　品物：' + esc(it ? it.category + '　' + it.description : '（品物の登録前）') + '　' + (sheets[0] ? '最新 第' + sheets[0].version + '版（' + dt(sheets[0].created_at) + '・' + (sheets[0].source === 'auto' ? 'AI（自動）' : esc(staffName(sheets[0].created_by))) + '）' : baseRow ? '未保存（自動鑑定の下書きを表示中）' : '未保存') + '。担当者用の資料です。お客様には送りません。' + (D.autoMeta ? '<br>AIの自動鑑定（' + esc(D.autoMeta.model || '') + '・写真を' + (D.autoMeta.votes || 1) + '回読み取り・' + dt(D.autoMeta.at) + '）の下書きです。メモに「AI推定・要確認」とある相場は、AIの知識による推定です（検索はしていません）。各サイトの「検索」で確かめてください。' + ((D.ai && D.ai.notes || []).length ? '<br>' + D.ai.notes.map(esc).join('<br>') : '') : '') + '</p>'
      + '<section class="card ai-box"><header><h2>AIで下書きを作る（無料・Gemini アプリ）</h2></header><div class="in">'
      + '<ol class="steps"><li><button class="btn sub sm" type="button" id="sh-prompt">① Gemini 用の依頼文をコピー</button>　<button class="btn sub sm" type="button" id="sh-dl">写真をまとめて保存</button>　<a class="btn sub sm" href="https://gemini.google.com/app" target="_blank" rel="noopener noreferrer">② Gemini を開く</a></li>'
      + '<li>Gemini に依頼文を貼り付け、保存した写真を添付して送信します。</li><li>Gemini の回答をすべてコピーし、下の欄に貼り付けて「③ 取り込む」を押します。</li></ol>'
      + '<textarea id="sh-ai" placeholder="Gemini の回答をここに貼り付け" style="min-height:90px;width:100%"></textarea><div class="row"><button class="btn sm" type="button" id="sh-import">③ 回答を取り込む</button></div>'
      + (D.ai ? '<p class="note bad" style="margin:0">' + dt(D.ai.at) + ' に AI の下書きを取り込みました。相場・他社価格・精度は <b>AI推定</b> です。各サイトの「検索」で実際の値を確かめてから使ってください。</p>' : '')
      + (a.ai_consent ? '' : '<p class="note bad" style="margin:0">この案件は、お客様のお申し出によりAIの利用を止めています。写真を Gemini などに送らないでください。</p>')
      + '<p class="note" style="margin:0">依頼文にお客様の名前・連絡先は入りません。Gemini アプリは「アクティビティを保存」をオフにして使ってください（オフでも最大72時間は保存されます）。写真に住所・顔・送り状が写っている場合は、隠してから添付してください。</p></div></section>'
      + '<div class="sheet">'
      // Step 1
      + '<section class="card"><header><h2>Step 1　情報の構造化と不足の確認</h2></header><div class="in"><div class="row">'
      + '<label class="l">ブランド・メーカー名' + IN('s1.brand', D.s1.brand) + '</label><label class="l">モデル名' + IN('s1.model', D.s1.model) + '</label><label class="l">型番' + IN('s1.ref', D.s1.ref) + '</label><label class="l">製造年（推定可）' + IN('s1.year', D.s1.year) + '</label></div>'
      + '<p class="lbl">付属品</p><div class="acc">' + ACCESSORIES.map(function(k){ var v = D.s1.acc[k]; return '<span class="accr"><b>' + esc(k) + '</b><label><input type="radio" name="acc-' + k + '" data-acc="' + esc(k) + '" value="1"' + (v === true ? ' checked' : '') + '>あり</label><label><input type="radio" name="acc-' + k + '" data-acc="' + esc(k) + '" value="0"' + (v === false ? ' checked' : '') + '>なし</label></span>'; }).join('') + '</div>'
      + '<label class="l">付属品のメモ' + IN('s1.accNote', D.s1.accNote) + '</label>'
      + '<div class="row"><label class="l">状態ランクの仮定<select data-k="s1.rankGuess">' + RANKS.map(function(r){ return '<option value="' + r[0] + '"' + (D.s1.rankGuess === r[0] ? ' selected' : '') + '>' + r[0] + '：' + r[1] + '</option>'; }).join('') + '</select></label><label class="l">定価（円）' + NUMIN('s1.retail', D.s1.retail) + '</label></div>'
      + (D.s1.aiEvidence ? '<p class="note" style="margin:0">AIの根拠：' + esc(D.s1.aiEvidence) + '</p>' : '')
      + (D.s1.aiPrivacy ? '<p class="note bad" style="margin:0">写真に個人情報が写っている可能性：' + esc(D.s1.aiPrivacy) + '</p>' : '')
      + '<div class="miss"><b>鑑定に必要な情報の不足</b>' + (c.missing.length ? '<ul>' + c.missing.map(function(m){ return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' : '<p>不足はありません</p>') + '</div></div></section>'
      // Step 2
      + '<section class="card"><header><h2>Step 2　状態ランクの厳格な判定</h2></header><div class="in"><table class="rk"><tbody>' + RANKS.map(function(r){ return '<tr' + (r[0] === c.rank ? ' class="on"' : '') + '><td class="nw"><b>' + r[0] + '</b> ' + r[1] + '</td><td>' + r[2] + '</td></tr>'; }).join('') + '</tbody></table>'
      + '<p class="lbl">マイナス要因（1つでも当てはまれば、ランクの上限が下がります）</p><div class="negs">' + NEGATIVES.map(function(n){ return '<label><input type="checkbox" data-neg="' + esc(n[0]) + '"' + (D.s2.neg[n[0]] ? ' checked' : '') + '> ' + esc(n[0]) + '<small>（' + n[1] + '以下）</small></label>'; }).join('') + '</div>'
      + '<p class="verdict">判定ランク：<b>' + c.rank + '（' + (RANKS.filter(function(r){ return r[0] === c.rank; })[0] || ['', ''])[1] + '）</b>　仮定 ' + esc(D.s1.rankGuess) + ' → 懸念がある場合は低い方を採用</p>'
      + '<label class="l">状態のメモ' + IN('s2.note', D.s2.note) + '</label></div></section>'
      // Step 3
      + '<section class="card"><header><h2>Step 3　価格の算出</h2></header><div class="in">'
      + '<h3 class="h3">① 定価</h3><div class="row"><label class="l">希望小売価格（上代）' + NUMIN('s3.list', D.s3.list || D.s1.retail) + '</label><label class="l">セール等の最低' + NUMIN('s3.saleMin', D.s3.saleMin) + '</label><label class="l">セール等の最高' + NUMIN('s3.saleMax', D.s3.saleMax) + '</label></div>'
      + '<h3 class="h3">② 中古市場の相場　<small>検索の言葉：<input id="sh-kw" value="' + esc(kw()) + '" style="min-width:240px"></small></h3>'
      + SRC.map(function(g){ var rows = D.s3.market[g[0]] = D.s3.market[g[0]] || g[2].map(function(n){ return { site: n, min: '', max: '', memo: '' }; });
          return '<p class="lbl">' + g[1] + '（' + g[2].length + '社）</p><div class="tw"><table class="mk"><thead><tr><th>サイト・企業</th><th>最小（円）</th><th>最高（円）</th><th>メモ</th><th>計算</th><th></th></tr></thead><tbody>' + rows.map(function(r, i){ var p = 's3.market.' + g[0] + '.' + i + '.';
            return '<tr' + (r.ex ? ' class="ex"' : '') + '><td>' + IN(p + 'site', r.site) + (r.url ? '<a class="src" href="' + esc(safeUrl(r.url)) + '" target="_blank" rel="noopener noreferrer">出典を開く</a>' : '') + '</td><td>' + NUMIN(p + 'min', r.min) + '</td><td>' + NUMIN(p + 'max', r.max) + '</td><td>' + IN(p + 'memo', r.memo) + '</td><td class="nw"><label><input type="checkbox" data-use="' + p + 'ex"' + (r.ex ? '' : ' checked') + '>使う</label></td><td><button class="btn sub sm" type="button" data-srch="' + esc(r.site) + '">検索</button></td></tr>'; }).join('') + '</tbody></table></div>'; }).join('')
      + '<p class="verdict">推定市場販売価格：<b>' + yen(r1000(c.est)) + '</b>（入力した相場' + c.mids + '件の中央値）　<label style="font-size:12px">手入力で決める場合 ' + NUMIN('s3.estOverride', D.s3.estOverride) + '</label></p>'
      + '<h3 class="h3">③ 卸値（販売先ごとの相場）</h3><div class="tw"><table class="mk"><thead><tr><th>販売先</th><th>最小（円）</th><th>最高（円）</th></tr></thead><tbody>' + D.s3.whole.map(function(w, i){ var p = 's3.whole.' + i + '.'; return '<tr><td>' + IN(p + 'ch', w.ch) + '</td><td>' + NUMIN(p + 'min', w.min) + '</td><td>' + NUMIN(p + 'max', w.max) + '</td></tr>'; }).join('') + '</tbody></table></div>'
      + '<p class="verdict">推奨の販売先：<b>' + (c.whole[0] ? esc(c.whole[0].ch) + '（約' + yen(r1000(c.whole[0].mid)) + '）' : '—') + '</b></p><label class="l">推奨の販売手法' + IN('s3.method', D.s3.method) + '</label>'
      + '<h3 class="h3">④ 他社の買取適正価格（7社）</h3><div class="tw"><table class="mk"><thead><tr><th>企業</th><th>最低（円）</th><th>最大（円）</th><th>計算</th></tr></thead><tbody>' + OTHERS.map(function(n){ var o = D.s3.others[n] = D.s3.others[n] || { min: '', max: '' }, p = 's3.others.' + n + '.'; return '<tr' + (o.ex ? ' class="ex"' : '') + '><td>' + esc(n) + (o.url ? '<a class="src" href="' + esc(safeUrl(o.url)) + '" target="_blank" rel="noopener noreferrer">出典</a>' : '') + (o.memo ? '<br><small>' + esc(o.memo) + '</small>' : '') + '</td><td>' + NUMIN(p + 'min', o.min) + '</td><td>' + NUMIN(p + 'max', o.max) + '</td><td class="nw"><label><input type="checkbox" data-use="' + p + 'ex"' + (o.ex ? '' : ' checked') + '>使う</label> <button class="btn sub sm" type="button" data-srch="' + esc(n) + '" data-buy="1">検索</button></td></tr>'; }).join('') + '</tbody></table></div>'
      + '<p class="verdict">他社の買取額：' + (c.othMin != null ? yen(c.othMin) + '〜' + yen(c.othMax) : '—') + '</p>'
      + '<h3 class="h3">⑤ 買取提示価格表</h3><div class="row"><label class="l">修繕（円）' + NUMIN('s3.costs.repair', D.s3.costs.repair) + '</label><label class="l">クリーニング（円）' + NUMIN('s3.costs.cleaning', D.s3.costs.cleaning) + '</label><label class="l">保管費（円）' + NUMIN('s3.costs.storage', D.s3.costs.storage) + '</label><label class="l">手数料等（円）' + NUMIN('s3.costs.fees', D.s3.costs.fees) + '</label></div>'
      + '<table class="calc"><tbody><tr><th>推定市場販売価格</th><td class="r">' + yen(r1000(c.est)) + '</td></tr><tr><th>ジャンル別掛率（' + esc(cat) + '・' + c.rank + '）</th><td class="r">× ' + c.rate + '</td></tr><tr><th>修繕・クリーニング・保管・手数料</th><td class="r">− ' + yen(c.cost) + '</td></tr>'
      + '<tr class="tot"><th>算出結果</th><td class="r">' + yen(c.base != null ? Math.round(c.base) : null) + '</td></tr></tbody></table>'
      + '<table class="calc"><thead><tr><th>提示の段階</th><th class="r">金額</th><th>使い方</th></tr></thead><tbody><tr><td>下限</td><td class="r">' + yen(c.low) + '</td><td>最初の提示の目安（算出結果の9割）</td></tr><tr class="tot"><td>標準</td><td class="r">' + yen(c.std) + '</td><td>通常の提示額</td></tr><tr><td>上限</td><td class="r">' + yen(c.high) + '</td><td>ご相談時の上限（算出結果の1.08倍、または他社の最大額まで）</td></tr></tbody></table>'
      + '<label class="l">最終の提示額（担当者が決定）' + NUMIN('s3.offerFinal', D.s3.offerFinal) + '</label><p class="note" style="margin:0">掛率は「掛率の設定」で変更できます。最終の提示額は、実物の確認後に査定画面へ入力してください。</p></div></section>'
      // Step 4
      + '<section class="card"><header><h2>Step 4　リスクの指摘と真贋の確認</h2></header><div class="in"><p class="lbl">コピー品の特徴（真贋の確認点）</p><div class="negs">' + pts.map(function(t, i){ return '<label><input type="checkbox" data-pt="' + i + '"' + (D.s4.points[i] ? ' checked' : '') + '> ' + esc(t) + '</label>'; }).join('') + '</div>'
      + '<p class="lbl">経年劣化しやすい箇所</p><div class="negs">' + AGING.map(function(t){ return '<label><input type="checkbox" data-ag="' + esc(t) + '"' + (D.s4.aging[t] ? ' checked' : '') + '> ' + esc(t) + ' を確認した</label>'; }).join('') + '</div>'
      + (D.s4.aiOk && D.s4.aiOk.length ? '<p class="note" style="margin:0">AI：写真で問題がなかった点：' + D.s4.aiOk.map(esc).join('、') + '</p>' : '')
      + (D.s4.aiConcern && D.s4.aiConcern.length ? '<p class="note bad" style="margin:0">AI：気になる点：' + D.s4.aiConcern.map(esc).join('、') + '</p>' : '')
      + (D.s4.aiAging && D.s4.aiAging.length ? '<p class="note" style="margin:0">AIが挙げた劣化の確認箇所：' + D.s4.aiAging.map(esc).join('、') + '</p>' : '')
      + '<div class="row"><label class="l">真贋の精度（%）' + IN('s4.accuracy', D.s4.accuracy, ' inputmode="numeric" placeholder="例：85"') + '</label></div><p class="note" style="margin:0">参考：確認点 ' + c.ptsDone + ' / ' + c.ptsAll + ' 件を確認済み（' + Math.round(c.ptsDone / c.ptsAll * 100) + '%）。精度は担当者が判断して入力します。</p>'
      + '<label class="l">精度を上げるために必要な情報（1行に1つ）<textarea data-k="s4.missing" style="min-height:60px">' + esc(D.s4.missing || pts.filter(function(t, i){ return !D.s4.points[i]; }).join('\n')) + '</textarea></label></div></section>'
      // Step 5
      + '<section class="card"><header><h2>Step 5　接客トーク</h2></header><div class="in"><div class="row"><label class="l">為替<select data-k="s5.fx"><option>横ばい</option><option>円安</option><option>円高</option></select></label><label class="l">相場の流れ<select data-k="s5.trend"><option>横ばい</option><option>上昇</option><option>下落</option></select></label><label class="l">市場の在庫<select data-k="s5.stock"><option>ふつう</option><option>少ない</option><option>多い</option></select></label><button class="btn sub sm" type="button" id="sh-talk" style="align-self:end">文章を作り直す</button></div>'
      + '' + (D.s5.basis ? '<p class="note" style="margin:0">市場の背景（検索の結果）：' + esc(D.s5.basis) + '</p>' : '') + '<label class="l">価格の根拠の説明（お客様へのご説明用。編集できます）<textarea data-k="s5.script" style="min-height:220px">' + esc(D.s5.script ? D.s5.script.replace(/\{提示額\}/g, c.std != null ? yen(num(D.s3.offerFinal) != null ? num(D.s3.offerFinal) : c.std) : '提示額').replace(/\{相場\}/g, c.est != null ? yen(r1000(c.est)) + '前後' : '相場') : talk(c)) + '</textarea></label><p class="note" style="margin:0">事実と異なる説明や、判断を急かす言い方は使わないでください。</p></div></section>'
      + '</div>';
    ['s5.fx','s5.trend','s5.stock'].forEach(function(k){ var el = document.querySelector('[data-k="' + k + '"]'); if(el) el.value = k.split('.').reduce(function(o, p){ return o[p]; }, D); });
  }
  function setPath(path, v){ var ps = path.split('.'), o = D; for(var i = 0; i < ps.length - 1; i++){ o = o[ps[i]] = o[ps[i]] != null ? o[ps[i]] : {}; } o[ps[ps.length - 1]] = v; }
  var timer = null, refresh = function(){ var y = window.scrollY, f = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.k : null; render(); window.scrollTo(0, y); if(f){ var el = document.querySelector('[data-k="' + f + '"]'); if(el){ el.focus(); try{ el.setSelectionRange(el.value.length, el.value.length); }catch(e){} } } };
  render();
  var m = $('#main');
  m.oninput = function(e){ var t = e.target; if(t.dataset.k){ setPath(t.dataset.k, t.value); clearTimeout(timer); if(t.tagName !== 'TEXTAREA') timer = setTimeout(refresh, 700); } };
  m.onchange = function(e){ var t = e.target;
    if(t.dataset.use){ setPath(t.dataset.use, !t.checked); refresh(); }
    else if(t.dataset.acc){ D.s1.acc[t.dataset.acc] = t.value === '1'; refresh(); }
    else if(t.dataset.neg){ D.s2.neg[t.dataset.neg] = t.checked; refresh(); }
    else if(t.dataset.pt != null){ D.s4.points[t.dataset.pt] = t.checked; refresh(); }
    else if(t.dataset.ag){ D.s4.aging[t.dataset.ag] = t.checked; }
    else if(t.dataset.k && t.tagName === 'SELECT'){ setPath(t.dataset.k, t.value); refresh(); } };
  m.onclick = async function(e){ var t = e.target;
    if(t.dataset.srch){ var k = ($('#sh-kw') && $('#sh-kw').value.trim()) || kw(); if(!k){ toast('ブランド名・モデル名を入力してください', true); return; } window.open(searchUrl(t.dataset.srch, k + (t.dataset.buy ? ' 買取' : '')), '_blank', 'noopener'); return; }
    if(t.id === 'sh-prompt'){ var pr = sheetPrompt(a, cat); try{ await navigator.clipboard.writeText(pr); toast('依頼文をコピーしました。Gemini に貼り付けてください'); }catch(x){ $('#sh-ai').value = pr; $('#sh-ai').select(); toast('コピーできなかったため欄に表示しました。選択してコピーしてください', true); } return; }
    if(t.id === 'sh-dl'){ t.disabled = true; try{ var objs = (await GL.list('intake', a.upload_token)).filter(function(o){ return o.name && /\.(jpe?g|png|webp|heic)$/i.test(o.name); }); if(!objs.length) throw new Error('写真がありません');
        for(var q = 0; q < objs.length; q++){ var u = await GL.signedUrl('intake', a.upload_token + '/' + objs[q].name), r = await fetch(u); if(!r.ok) continue; var bl = await r.blob(); if(/^image\/jpeg$/.test(bl.type) || /\.jpe?g$/i.test(objs[q].name)) bl = new Blob([stripJpeg(new Uint8Array(await bl.arrayBuffer()))], { type: 'image/jpeg' }); var ln = document.createElement('a'); ln.href = URL.createObjectURL(bl); ln.download = a.receipt_no + '_' + (q + 1) + '.' + objs[q].name.split('.').pop().toLowerCase(); document.body.appendChild(ln); ln.click(); ln.remove(); setTimeout(URL.revokeObjectURL.bind(URL, ln.href), 5000); }
        toast(objs.length + '枚を保存しました（ファイル名は受付番号だけ。撮影場所などの情報は消しています）'); }catch(x){ toast(x.message, true); } t.disabled = false; return; }
    if(t.id === 'sh-import'){ try{ importAi(D, parseAiJson($('#sh-ai').value), 'gemini-app'); render(); toast('取り込みました。AI推定の値を確かめてから保存してください'); }catch(x){ toast('取り込めませんでした：' + x.message, true); } return; }
    if(t.id === 'sh-talk'){ D.s5.script = ''; refresh(); return; }
    if(t.id === 'sh-save'){ t.disabled = true; try{ var v = (sheets[0] ? sheets[0].version : 0) + 1, c = calc(); D.result = { rank: c.rank, rate: c.rate, est: c.est, low: c.low, std: c.std, high: c.high, offer: num(D.s3.offerFinal) };
        var row = await GL.insert('appraisal_sheets', { application_id: appId, item_id: it ? it.id : null, slot: it ? 1 : slot, version: v, data: D, created_by: GL.userId() }); sheets.unshift(row || { version: v, created_at: new Date().toISOString(), created_by: GL.userId(), data: D }); toast('第' + v + '版として保存しました'); render(); }catch(x){ toast(x.message, true); } t.disabled = false; return; }
    if(t.id === 'sh-mail'){ var c2 = calc(), off = num(D.s3.offerFinal) != null ? num(D.s3.offerFinal) : c2.std;
      MAIL = { app: appId, rows: [{ name: [D.s1.brand, D.s1.model].filter(Boolean).join(' ') || (it && it.description) || '', lo: c2.low != null ? String(c2.low) : '', hi: off != null ? String(off) : '' }], photos: [] }; location.hash = 'case/' + appId; toast('案件の画面の「お客様へのご案内文」に反映しました'); return; }
    if(t.id === 'sh-pdf'){ sheetPdf(a, it, D, calc(), cat); return; }
  };
}
function sheetPdf(a, it, D, c, cat){
  var tr = function(k, v){ return '<tr><th>' + k + '</th><td>' + (v == null || v === '' ? '—' : v) + '</td></tr>'; };
  var acc = ACCESSORIES.map(function(k){ return k + '：' + (D.s1.acc[k] === true ? 'あり' : D.s1.acc[k] === false ? 'なし' : '未確認'); }).join('／');
  var neg = Object.keys(D.s2.neg).filter(function(k){ return D.s2.neg[k]; });
  var mk = SRC.map(function(g){ var rows = (D.s3.market[g[0]] || []).filter(function(r){ return num(r.min) != null || num(r.max) != null; }); return '<tr><th>' + esc(g[1]) + '</th><td>' + (rows.map(function(r){ return esc(r.site) + '：' + yen(num(r.min)) + '〜' + yen(num(r.max)) + (r.memo ? '（' + esc(r.memo) + '）' : ''); }).join('<br>') || '—') + '</td></tr>'; }).join('');
  var oth = OTHERS.filter(function(n){ var o = D.s3.others[n] || {}; return num(o.min) != null || num(o.max) != null; }).map(function(n){ var o = D.s3.others[n]; return esc(n) + '：' + yen(num(o.min)) + '〜' + yen(num(o.max)); }).join('<br>');
  var pts = (CHECKLIST[cat] || CHECKLIST['その他']);
  var html = '<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>鑑定報告書_' + esc(a.receipt_no) + '</title><style>@page{size:A4;margin:13mm}body{font-family:"Hiragino Sans","Yu Gothic","Noto Sans CJK JP",sans-serif;font-size:9.5pt;color:#1c1a16;line-height:1.55}h1{font-size:15pt;margin:0}h2{font-size:11.5pt;border-bottom:2px solid #c8ae7d;margin:5mm 0 2mm;padding-bottom:1mm}.sub{color:#6a6255;font-size:8.5pt}.conf{border:1px solid #8c7448;color:#5a4a2a;padding:2mm 3mm;font-size:8.5pt;margin:3mm 0}table{width:100%;border-collapse:collapse}th,td{border:1px solid #cfc6b4;padding:1.3mm 2mm;text-align:left;vertical-align:top}th{background:#f1ece2;width:28%;font-weight:600}.big td{font-size:11pt;font-weight:700}pre{white-space:pre-wrap;font-family:inherit;margin:0}</style></head><body>'
    + '<h1>鑑定報告書</h1><p class="sub">G-LOVE　受付番号 ' + esc(a.receipt_no) + '　作成 ' + esc(new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })) + '　作成者 ' + esc(S.me.name) + '</p>'
    + '<p class="conf">社外秘・担当者用。お客様には送らないでください。相場・算出結果は参考です。真贋と査定額は、株式会社グローブの査定担当者が実物で判断します。お客様のお名前・ご住所・連絡先は載せていません。' + (D.ai ? '<br><b>AI（Gemini）の下書きを含みます。相場・他社価格・精度のうちメモに「AI推定」とある値は、担当者が確かめるまで参考値です。</b>' : '') + '</p>'
    + '<h2>Step 1　情報の構造化と不足の確認</h2><table>' + tr('品目', esc(cat)) + tr('ブランド・メーカー', esc(D.s1.brand)) + tr('モデル名', esc(D.s1.model)) + tr('型番', esc(D.s1.ref)) + tr('製造年', esc(D.s1.year)) + tr('付属品', esc(acc) + (D.s1.accNote ? '<br>' + esc(D.s1.accNote) : '')) + tr('状態ランクの仮定', esc(D.s1.rankGuess)) + tr('定価', yen(num(D.s1.retail))) + tr('不足している情報', c.missing.map(esc).join('、') || 'なし') + '</table>'
    + '<h2>Step 2　状態ランクの判定</h2><table>' + tr('判定ランク', '<b>' + c.rank + '（' + (RANKS.filter(function(r){ return r[0] === c.rank; })[0] || ['', ''])[1] + '）</b>　仮定 ' + esc(D.s1.rankGuess) + '・懸念がある場合は低い方を採用') + tr('マイナス要因', neg.map(esc).join('、') || 'なし') + tr('メモ', esc(D.s2.note)) + '</table>'
    + '<h2>Step 3　価格の算出</h2><table>' + tr('① 定価', '上代 ' + yen(num(D.s3.list || D.s1.retail)) + '／セール等 ' + yen(num(D.s3.saleMin)) + '〜' + yen(num(D.s3.saleMax))) + '</table><p class="sub">② 中古市場の相場</p><table>' + mk + tr('推定市場販売価格', '<b>' + yen(r1000(c.est)) + '</b>（中央値）') + '</table>'
    + '<p class="sub">③ 卸値</p><table>' + D.s3.whole.map(function(w){ return tr(esc(w.ch), yen(num(w.min)) + '〜' + yen(num(w.max))); }).join('') + tr('推奨の販売先・手法', (c.whole[0] ? esc(c.whole[0].ch) : '—') + (D.s3.method ? '／' + esc(D.s3.method) : '')) + '</table>'
    + '<p class="sub">④ 他社の買取適正価格</p><table>' + tr('7社の比較', oth || '—') + tr('最低〜最大', c.othMin != null ? yen(c.othMin) + '〜' + yen(c.othMax) : '—') + '</table>'
    + '<p class="sub">⑤ 買取提示価格表</p><table>' + tr('計算', yen(r1000(c.est)) + ' × ' + c.rate + '（' + esc(cat) + '・' + c.rank + '）− ' + yen(c.cost) + '（修繕・クリーニング・保管・手数料）＝ ' + yen(c.base != null ? Math.round(c.base) : null)) + '</table><table class="big">' + tr('下限', yen(c.low)) + tr('標準', yen(c.std)) + tr('上限', yen(c.high)) + tr('最終の提示額', yen(num(D.s3.offerFinal))) + '</table>'
    + '<h2>Step 4　リスクと真贋</h2><table>' + tr('確認済みの真贋ポイント', pts.filter(function(t, i){ return D.s4.points[i]; }).map(esc).join('<br>') || 'なし') + tr('未確認の真贋ポイント', pts.filter(function(t, i){ return !D.s4.points[i]; }).map(esc).join('<br>') || 'なし') + tr('経年劣化の確認', Object.keys(D.s4.aging).filter(function(k){ return D.s4.aging[k]; }).map(esc).join('、') || '—') + tr('真贋の精度', num(D.s4.accuracy) != null ? num(D.s4.accuracy) + '%' : '—') + tr('精度を上げるための不足情報', '<pre>' + esc(D.s4.missing || '') + '</pre>') + '</table>'
    + '<h2>Step 5　接客トーク（価格の根拠の説明）</h2><table>' + tr('市場の背景', '為替：' + esc(D.s5.fx) + '／相場：' + esc(D.s5.trend) + '／在庫：' + esc(D.s5.stock)) + tr('説明文', '<pre>' + esc(D.s5.script || '') + '</pre>') + '</table></body></html>';
  var w = window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })), '_blank');
  if(!w){ toast('新しい画面を開けませんでした', true); return; }
  w.addEventListener('load', function(){ setTimeout(function(){ try{ w.print(); }catch(e){} }, 400); });
  toast('印刷の画面で「PDFに保存」を選ぶと、メールに添付できるファイルになります');
}
// ============ 掛率の設定 ============
async function viewRates(){ var my = S.seq;
  var rows = await GL.select('price_rules', { order: 'category.asc,rank.asc', limit: 200 }); if(my !== S.seq) return;
  var cats = []; rows.forEach(function(r){ if(cats.indexOf(r.category) < 0) cats.push(r.category); });
  var get = function(c, k){ var r = rows.filter(function(x){ return x.category === c && x.rank === k; })[0]; return r ? r.rate : ''; };
  $('#main').innerHTML = top('掛率の設定', '<button class="btn sm" id="rt-save">保存する</button>')
    + '<p class="note">鑑定シートの「⑤ 買取提示価格表」で使う掛率です（推定市場販売価格に掛ける割合）。初期値は仮の値です。実際の販売実績に合わせて調整してください。変更は操作履歴に残ります。</p>'
    + '<div class="card"><div class="tw"><table><thead><tr><th>品目</th>' + RANKS.map(function(r){ return '<th class="r">' + r[0] + '：' + r[1] + '</th>'; }).join('') + '</tr></thead><tbody>'
    + cats.map(function(c){ return '<tr><td>' + esc(c) + '</td>' + RANKS.map(function(r){ return '<td class="r"><input class="rt" data-c="' + esc(c) + '" data-r="' + r[0] + '" value="' + esc(get(c, r[0])) + '" inputmode="decimal" style="width:70px;text-align:right"></td>'; }).join('') + '</tr>'; }).join('')
    + '</tbody></table></div></div>' + (can('appraiser') ? '' : '<p class="note bad">掛率の変更は査定担当（または管理者）が行えます。</p>');
  $('#rt-save').onclick = async function(){ var b = this; b.disabled = true; var n = 0;
    try{ var els = document.querySelectorAll('.rt'); for(var i = 0; i < els.length; i++){ var el = els[i], v = Number(el.value); if(isNaN(v) || v < 0 || v > 1.2) throw new Error(el.dataset.c + '・' + el.dataset.r + ' の掛率は 0〜1.2 で入力してください');
        var old = get(el.dataset.c, el.dataset.r); if(String(old) !== String(el.value) && Number(old) !== v){ await GL.update('price_rules', { category: el.dataset.c, rank: el.dataset.r }, { rate: v, updated_at: new Date().toISOString(), updated_by: GL.userId() }); n++; } }
      toast(n ? n + '件の掛率を保存しました' : '変更はありません'); viewRates(); }catch(x){ toast(x.message, true); b.disabled = false; } };
}
// ── AIによる鑑定シートの下書き（Gemini アプリで手動／自動連携） ──
function sheetPrompt(a, cat){
  var siteList = SRC.map(function(g){ return g[0] + '（' + g[1] + '）：' + g[2].join('、'); }).join('\n');
  return 'あなたは中古ブランド品・時計・宝飾品の買取店の鑑定担当者です。添付した写真のお品物について、次の手順で鑑定し、最後に指定の JSON だけを出力してください。\n'
    + '品目：' + cat + '\n\n'
    + 'Step1 情報の構造化：ブランド・メーカー名、モデル名、型番、製造年、付属品（' + ACCESSORIES.join('、') + '）の有無、状態ランクの仮定、定価を特定し、鑑定に必要で不足している情報を挙げる。\n'
    + 'Step2 状態ランクの厳格な判定：N=新品、S=未使用、A=美品、B=一般、C=難あり。少しでも懸念があれば低い方を採用。マイナス要因（ニオイ、動作未確認、キズ、汚れなど）を挙げる。\n'
    + 'Step3 価格：①定価（上代・セール等の最低と最高）②中古市場の相場（次の区分とサイトごとの最小〜最高。調べられない場合は null）\n' + siteList + '\n'
    + '③卸値（販売先ごとの相場）と推奨の販売先・手法 ④他社の買取価格（' + OTHERS.join('、') + 'の7社の最低〜最大）。金額はすべて日本円の数値。\n'
    + 'Step4 リスクと真贋：コピー品の特徴として確認すべき点、経年劣化しやすい箇所、真贋の精度（0〜100の数値）、精度を上げるために不足している情報。\n'
    + 'Step5 接客トーク：為替（円安・円高・横ばい）、相場の流れ（上昇・下落・横ばい）、市場の在庫（少ない・多い・ふつう）を判断し、お客様が納得しやすい価格の根拠の説明文を作る。事実と異なる説明や、判断を急かす表現は使わない。\n\n'
    + '守ること：写真や検索で確かめられない値は推測で埋めずに null にする。真贋を断定しない。\n'
    + '出力は次の形の JSON だけ（前後に文章を付けない）：\n'
    + '{"s1":{"brand":"","model":"","ref":"","year":"","accessories":{"保証書・ギャランティカード":null},"rank_guess":"A","retail":null,"missing":[""]},'
    + '"s2":{"rank":"B","negatives":[""],"note":""},'
    + '"s3":{"list":null,"sale_min":null,"sale_max":null,"market":{"dom":[{"site":"","min":null,"max":null}],"intl":[],"major":[],"genauc":[],"flea":[],"shop":[]},"wholesale":[{"channel":"","min":null,"max":null}],"method":"","others":[{"name":"","min":null,"max":null}]},'
    + '"s4":{"points":[""],"aging":[""],"accuracy":null,"missing":[""]},'
    + '"s5":{"fx":"横ばい","trend":"横ばい","stock":"ふつう","script":""}}';
}
function parseAiJson(t){ t = String(t || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, ''); var i = t.indexOf('{'), j = t.lastIndexOf('}'); if(i < 0 || j < i) throw new Error('回答の中に JSON が見つかりません。Gemini の回答をそのまま貼り付けてください'); return JSON.parse(t.slice(i, j + 1)); }
// 写真の付加情報（撮影場所・機種など）を消す（JPEG）。画素は変えない
function stripJpeg(u){ if(u[0] !== 0xff || u[1] !== 0xd8) return u; var out = [0xff, 0xd8], i = 2;
  while(i + 4 <= u.length){ if(u[i] !== 0xff) return u; var m = u[i + 1]; if(m === 0xda){ var a = new Uint8Array(out.length + u.length - i); a.set(out); a.set(u.subarray(i), out.length); return a; }
    var len = (u[i + 2] << 8) | u[i + 3]; if(!((m >= 0xe1 && m <= 0xef) || m === 0xfe)) for(var k = i; k < i + 2 + len; k++) out.push(u[k]); i += 2 + len; }
  return u; }
function safeUrl(u){ u = String(u || ''); return /^https?:\/\//i.test(u) ? u : '#'; }
function importAi(D, x, source){
  var s = function(v){ return v == null ? '' : String(v); };
  var auto = source === 'auto';
  // 出典の扱い：自動鑑定で出典を確かめられた値は「検索で確認」、確かめられない値は計算に使わない。Gemini アプリから貼り付けた値はすべて「AI推定」
  var tag = function(r){ return !auto ? 'AI推定' : r.use != null ? (r.verified ? '実績' : 'AI推定・要確認') : (r.verified ? '検索で確認' : 'AI推定・出典未確認'); };
  var exOf = function(r){ return auto && (r.use != null ? !r.use : (!r.verified || !!r.outlier)); };
  var s1 = x.s1 || {}, s2 = x.s2 || {}, s3 = x.s3 || {}, s4 = x.s4 || {}, s5 = x.s5 || {};
  ['brand','model','ref','year'].forEach(function(k){ if(s1[k]) D.s1[k] = s(s1[k]); });
  if(s1.retail != null) D.s1.retail = s(s1.retail);
  D.s1.aiMissing = (s1.missing || []).map(s).filter(Boolean).slice(0, 30);
  if(s1.evidence) D.s1.aiEvidence = Object.keys(s1.evidence).filter(function(k){ return s1.evidence[k]; }).map(function(k){ var c = (s1.confidence || {})[k]; return ({ brand: 'ブランド', model: 'モデル', ref: '型番', year: '製造年' }[k] || k) + '＝' + s(s1.evidence[k]) + (c != null ? '（確からしさ' + c + '%）' : ''); }).join('／');
  if(s1.privacy) D.s1.aiPrivacy = s(s1.privacy);
  if(/^[NSABC]$/.test(s1.rank_guess || '')) D.s1.rankGuess = s1.rank_guess;
  Object.keys(s1.accessories || {}).forEach(function(k){ var v = s1.accessories[k]; var key = ACCESSORIES.filter(function(a){ return a === k || a.indexOf(k) >= 0 || k.indexOf(a.split('・')[0]) >= 0; })[0]; if(key && (v === true || v === false)) D.s1.acc[key] = v; });
  if(/^[NSABC]$/.test(s2.rank || '') && RANK_ORDER.indexOf(s2.rank) > RANK_ORDER.indexOf(D.s1.rankGuess)) D.s1.rankGuess = s2.rank;
  (s2.negatives || []).forEach(function(n){ var hit = NEGATIVES.filter(function(m){ return String(n).indexOf(m[0].split('（')[0].slice(0, 3)) >= 0; })[0]; if(hit) D.s2.neg[hit[0]] = true; });
  if(s2.note || (s2.negatives || []).length) D.s2.note = [s(s2.note)].concat((s2.negatives || []).map(s)).filter(Boolean).join('／');
  if(s3.list != null) D.s3.list = s(s3.list); if(s3.sale_min != null) D.s3.saleMin = s(s3.sale_min); if(s3.sale_max != null) D.s3.saleMax = s(s3.sale_max);
  SRC.forEach(function(g){ var got = (s3.market || {})[g[0]] || []; if(!got.length) return; var rows = D.s3.market[g[0]] = D.s3.market[g[0]] || g[2].map(function(n){ return { site: n, min: '', max: '', memo: '' }; });
    got.forEach(function(r){ if(r.min == null && r.max == null) return; var row = rows.filter(function(x){ return x.site && r.site && !x.min && !x.max && (x.site.indexOf(String(r.site).slice(0, 3)) >= 0 || String(r.site).indexOf(x.site.slice(0, 3)) >= 0); })[0];
      if(!row){ row = { site: s(r.site), min: '', max: '', memo: '' }; rows.push(row); } row.min = s(r.min); row.max = s(r.max); row.url = r.url || ''; row.memo = tag(r) + (r.note ? '・' + s(r.note) : ''); row.ex = exOf(r); }); });
  if((s3.wholesale || []).length) D.s3.whole = s3.wholesale.map(function(w){ return { ch: s(w.channel), min: s(w.min), max: s(w.max), url: w.url || '' }; });
  if(s3.method) D.s3.method = s(s3.method);
  (s3.others || []).forEach(function(o){ if(o.min == null && o.max == null) return; var n = OTHERS.filter(function(k){ return String(o.name).indexOf(k) >= 0 || k.indexOf(String(o.name)) >= 0; })[0]; if(n) D.s3.others[n] = { min: s(o.min), max: s(o.max), url: o.url || '', memo: tag(o) + (o.note ? '・' + s(o.note) : ''), ex: exOf(o) }; });
  if(s4.accuracy != null) D.s4.accuracy = s(s4.accuracy);
  D.s4.missing = [].concat(s4.missing || [], s4.unverifiable || []).map(s).filter(function(v, i, a){ return v && a.indexOf(v) === i; }).join('\n') || D.s4.missing;
  D.s4.aiOk = (s4.points || []).map(s).filter(Boolean).slice(0, 20); D.s4.aiConcern = (s4.concern || []).map(s).filter(Boolean).slice(0, 20);
  if((s4.aging || []).length) D.s4.aiAging = s4.aging.map(s).filter(Boolean).slice(0, 20);
  if(['円安','円高','横ばい'].indexOf(s5.fx) >= 0) D.s5.fx = s5.fx; if(['上昇','下落','横ばい'].indexOf(s5.trend) >= 0) D.s5.trend = s5.trend; if(['少ない','多い','ふつう'].indexOf(s5.stock) >= 0) D.s5.stock = s5.stock;
  if(s5.script) D.s5.script = s(s5.script); if(s5.basis) D.s5.basis = s(s5.basis);
  D.ai = { source: source, at: new Date().toISOString(), notes: x.notes || [] };
  return D;
}
// ============ 接続の確認 ============
async function viewHealth(){ var my = S.seq;
  var h = await GL.rpc('admin_health', {}); try{ h.ai = await GL.rpc('staff_ai_quota', {}); }catch(e){} if(my !== S.seq) return;
  var C0 = window.GLOVE_CONFIG || {}, n7 = h.notif7 || {}, dv = h.delivery;
  var rows = [
    ['受付データベース', true, '接続できています（' + esc(GL.url.replace(/^https?:\/\//, '')) + '）'],
    ['担当者', h.staff >= 2, h.staff + '名が有効' + (h.staff < 2 ? '。振込は作成者と別の経理担当の承認が必要なため、経理を2名以上登録してください' : '')],
    ['写真の保管庫', h.bucket, h.bucket ? '非公開で作成済み' : '保管庫「intake」がありません。schema.sql を実行し直してください'],
    ['メール通知の送り先', h.notifyUrl, h.notifyUrl ? '設定済み' : '通知先（Google Apps Script）が未設定です。接続手順書の第5章'],
    ['担当者の通知先メール', !!h.staffEmail, esc(h.staffEmail || '未設定')],
    ['メールの届き具合（7日）', dv ? dv.ng === 0 : (n7.sent || 0) > 0 || !(h.notifyUrl), dv ? '成功 ' + dv.ok + '件・失敗 ' + dv.ng + '件' : '送信 ' + (n7.sent || 0) + '件・未設定で送れず ' + (n7.skipped || 0) + '件・失敗 ' + (n7.failed || 0) + '件'],
    ['外部への送信（pg_net）', h.pgNet, h.pgNet ? '使用可能' : 'Supabaseの Database → Extensions で pg_net を有効にしてください'],
    ['毎日の自動処理（再通知・返却予告）', h.cron, h.cron ? '登録済み（毎日10時）' : 'pg_cron を有効にしてから schema.sql を実行し直してください'],
    ['チャットの回答', h.faq > 0, h.faq + '件'],
    ['写真のAI鑑定補助（任意・有料）', true, h.ai ? (h.ai.enabled ? '有効（1日' + h.ai.dailyLimit + '回まで・今月 約' + Math.round(h.ai.monthUsd * 155) + '円／上限 約' + Math.round(h.ai.monthlyCapUsd * 155) + '円）' : '無効（管理者の承認後に有効化）') : '—'],
    ['公開サイトの運用モード', true, (C0.mode === 'live' ? '本番' : '試験運用（実在の情報を入力しない表示）') + '／受付データベース側：' + (h.mode === 'live' ? '本番' : '試験運用')],
    ['試験データ', true, h.trialData + '件（本番へ切り替える前に一括消去します）'],
    ['契約書・規約', h.termsFinal, h.termsFinal ? '確定版' : '「法務確認前の案文」と表示中。弁護士の確認後に切り替えます']
  ];
  $('#main').innerHTML = top('接続の確認', '<button class="btn sub sm" id="hc-test">テストメールを送る</button><button class="btn sub sm" id="hc-re">もう一度確認</button>')
    + '<p class="note">本番の運用に必要な設定が揃っているかを確認します。すべて「○」になれば、受付・通知・自動処理が動きます。</p>'
    + '<div class="card"><div class="tw"><table><tbody>' + rows.map(function(r){ return '<tr><td class="nw">' + (r[1] ? '<span class="pill ok">○</span>' : '<span class="pill bad">✕</span>') + '</td><td class="nw"><b>' + r[0] + '</b></td><td>' + r[2] + '</td></tr>'; }).join('') + '</tbody></table></div></div>'
    + '<p class="note">確認日時 ' + dt(h.at) + '。' + esc(h.staffMfaNote) + '。</p>';
  $('#hc-re').onclick = viewHealth;
  $('#hc-test').onclick = async function(){ try{ await GL.rpc('admin_test_notify', {}); toast('テストメールを送りました。' + (h.staffEmail || '') + ' に届くか確認してください'); }catch(x){ toast(x.message, true); } };
}

// ============ 再販・粗利 ============
var CHANNELS = ['業者間オークション','買取業者・卸','店頭','インターネット販売','その他'];
async function viewResale(){ var my = S.seq;
  var rows = await GL.select('resale_book', { order: 'trade_at.desc', limit: 5000 });
  if(my !== S.seq) return;
  var stock = rows.filter(function(r){ return !r.resale_id; }), sold = rows.filter(function(r){ return r.resale_id; });
  var ym = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }).slice(0, 7), byM = {};
  sold.forEach(function(r){ var m = r.sold_on.slice(0, 7), x = byM[m] = byM[m] || { n: 0, price: 0, fees: 0, cost: 0, profit: 0 }; x.n++; x.price += r.price; x.fees += r.fees; x.cost += r.cost; x.profit += r.profit; });
  var cm = byM[ym] || { n: 0, price: 0, fees: 0, cost: 0, profit: 0 }, sum = function(a, k){ return a.reduce(function(s, r){ return s + (r[k] || 0); }, 0); };
  var rate = function(x){ return x.price ? Math.round(x.profit / x.price * 1000) / 10 + '%' : '—'; };
  $('#main').innerHTML = top('再販・粗利', '<button class="btn sub sm" id="rs-csv">表計算用に保存（CSV）</button>')
    + '<p class="note">買い取った品物（売買契約が成立したもの）の再販を記録します。粗利 ＝ 再販価格 − 販売手数料等 − 買取額。記録は削除できず、変更は操作履歴に残ります。</p>'
    + '<div class="stats"><div class="stat"><b>' + stock.length + '点</b><span>在庫（' + yen(sum(stock, 'cost')) + '）</span></div><div class="stat"><b>' + yen(cm.price) + '</b><span>今月の再販売上（' + cm.n + '点）</span></div><div class="stat"><b>' + yen(cm.profit) + '</b><span>今月の粗利（粗利率 ' + rate(cm) + '）</span></div><div class="stat"><b>' + yen(sum(sold, 'profit')) + '</b><span>累計の粗利</span></div></div>'
    + '<div class="card"><header><h2>月別</h2></header><div class="tw"><table><thead><tr><th>月</th><th class="r">点数</th><th class="r">再販売上</th><th class="r">手数料等</th><th class="r">買取額</th><th class="r">粗利</th><th class="r">粗利率</th></tr></thead><tbody>'
    + (Object.keys(byM).sort().reverse().map(function(m){ var x = byM[m]; return '<tr><td>' + esc(m.replace('-', '年')) + '月</td><td class="r">' + x.n + '</td><td class="r num">' + yen(x.price) + '</td><td class="r num">' + yen(x.fees) + '</td><td class="r num">' + yen(x.cost) + '</td><td class="r num">' + yen(x.profit) + '</td><td class="r">' + rate(x) + '</td></tr>'; }).join('') || '<tr><td colspan="7" class="empty">再販の記録はありません</td></tr>') + '</tbody></table></div></div>'
    + '<div class="card" id="rs-root"><header><h2>品物ごと</h2><label class="chk"><label><input type="checkbox" id="rs-sold">再販済みも表示</label></label></header><div class="tw"><table><thead><tr><th>買取日</th><th>受付番号</th><th>品物</th><th class="r">買取額</th><th>再販</th><th class="r">粗利</th><th></th></tr></thead><tbody id="rs-tb"></tbody></table></div></div>';
  function draw(){
    var show = $('#rs-sold').checked ? rows : stock;
    $('#rs-tb').innerHTML = show.map(function(r){ return '<tr><td>' + dt(r.trade_at).slice(0, 11) + '</td><td class="mono">' + esc(r.receipt_no) + '</td><td>' + esc(r.category) + '<br><small>' + esc(r.description) + '</small></td><td class="r num">' + yen(r.cost) + '</td><td>' + (r.resale_id ? esc(r.sold_on) + '<br><small>' + esc(r.channel) + '　' + yen(r.price) + (r.fees ? '（手数料 ' + yen(r.fees) + '）' : '') + '</small>' : '<span class="pill warn">在庫</span>') + '</td><td class="r num">' + (r.resale_id ? yen(r.profit) : '—') + '</td><td><button class="btn sub sm" data-rs="' + r.item_id + '">' + (r.resale_id ? '修正' : '再販を記録') + '</button></td></tr>'
      + '<tr hidden id="rsf-' + r.item_id + '"><td colspan="7"></td></tr>'; }).join('') || '<tr><td colspan="7" class="empty">' + ($('#rs-sold').checked ? '買い取った品物はありません' : '在庫はありません') + '</td></tr>';
  }
  draw(); $('#rs-sold').onchange = draw;
  $('#rs-root').onclick = function(e){
    var b = e.target.closest('[data-rs]'); if(!b) return; var r = rows.filter(function(x){ return x.item_id === b.dataset.rs; })[0], tr = $('#rsf-' + r.item_id);
    if(!tr.hidden){ tr.hidden = true; return; }
    tr.hidden = false; tr.firstChild.innerHTML = '<form class="f" style="padding:8px 0"><div class="row"><label class="l">販売日<input name="sold_on" type="date" required value="' + esc(r.sold_on || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })) + '"></label><label class="l">販売先の区分<select name="channel">' + CHANNELS.map(function(c){ return '<option' + (r.channel === c ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></label><label class="l">再販価格（円）<input name="price" type="number" min="0" required value="' + (r.price != null ? r.price : '') + '"></label><label class="l">手数料・送料など（円）<input name="fees" type="number" min="0" value="' + (r.fees || 0) + '"></label></div>'
      + '<div class="row"><label class="l">販売先（任意）<input name="buyer_name" maxlength="100" value="' + esc(r.buyer_name || '') + '"></label><label class="l">メモ（任意）<input name="note" maxlength="300" value="' + esc(r.note || '') + '"></label></div><p class="note" style="margin:0">粗利の見込み：<b class="rs-pf">—</b>（買取額 ' + yen(r.cost) + '）</p><div class="btns"><button class="btn sm">保存する</button></div></form>';
    var f = tr.querySelector('form'), pf = function(){ var v = Number(f.price.value || 0) - Number(f.fees.value || 0) - r.cost; f.querySelector('.rs-pf').textContent = f.price.value ? yen(v) : '—'; };
    f.oninput = pf; pf();
    f.onsubmit = async function(ev){ ev.preventDefault(); var d = { sold_on: f.sold_on.value, channel: f.channel.value, price: Number(f.price.value), fees: Number(f.fees.value || 0), buyer_name: f.buyer_name.value.trim() || null, note: f.note.value.trim() || null };
      try{ if(r.resale_id) await GL.update('resales', { id: r.resale_id }, d); else await GL.insert('resales', Object.assign({ item_id: r.item_id }, d)); toast('記録しました'); viewResale(); }catch(x){ toast(x.message, true); } };
  };
  $('#rs-csv').onclick = function(){
    var head = ['買取日','受付番号','品目','品物','買取額','販売日','販売先の区分','販売先','再販価格','手数料等','粗利'];
    var lines = [head].concat(rows.map(function(r){ return [r.trade_at.slice(0, 10), r.receipt_no, r.category, r.description, r.cost, r.sold_on || '', r.channel || '', r.buyer_name || '', r.price != null ? r.price : '', r.fees != null ? r.fees : '', r.profit != null ? r.profit : '']; }));
    var csv = '﻿' + lines.map(function(l){ return l.map(function(v){ v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'g-love-resale-' + ym + '.csv'; a.click();
  };
}

// ============ 自動応答の回答 ============
async function viewFaq(){ var my = S.seq;
  var rows = await GL.select('support_faq', { order: 'sort.asc,id.asc', limit: 500 });
  var cats = await safe(GL.select('support_cat', { order: 'sort.asc', limit: 200 })); var cm = {}; cats.forEach(function(c){ cm[c.key] = c; });
  function catName(k){ var c = cm[k]; if(!c) return '<span class="pill warn">分類なし（選択肢に出ません）</span>'; var pa = c.parent && cm[c.parent]; return esc((pa ? pa.label + ' › ' : '') + c.label); }
  var bots = await safe(GL.select('support_messages', { sender_kind: 'eq.bot', order: 'id.desc', limit: 400 }));
  var miss = bots.filter(function(m){ return m.meta && m.meta.miss && m.meta.q; }).slice(0, 50);
  var used = {}; bots.forEach(function(m){ if(m.meta && m.meta.faq) used[m.meta.faq] = (used[m.meta.faq] || 0) + 1; });
  if(my !== S.seq) return;
  $('#main').innerHTML = top('自動応答', '<button class="btn sm" id="faq-add">回答を追加</button>')
    + '<p class="note">チャットの回答です。お客様は基本的に選択肢（大分類 → 中分類 → 質問）で回答にたどり着きます。どの段階でも「担当者と直接やり取りしたい」を選べます。文章で質問された場合は、「キーワード」が含まれる回答を返します（長い言葉ほど優先）。外部のAIは使っていないため、費用はかかりません。サイトに書いていない約束（買取価格・日数の保証など）は回答に書かないでください。変更は操作履歴に残ります。</p>'
    + '<div id="faq-root"><div class="card"><header><h2>答えられなかった質問（新しい順）</h2></header><div class="in">' + (miss.length ? '<ul class="faq-miss">' + miss.map(function(m){ return '<li><span>' + esc(m.meta.q) + '</span><small>' + dt(m.created_at) + '</small><button class="btn sub sm" data-mq="' + esc(m.meta.q) + '">この質問の回答を作る</button></li>'; }).join('') + '</ul>' : '<p class="empty">ありません</p>') + '</div></div>'
    + '<div id="faq-edit"></div>'
    + '<div class="card"><header><h2>回答の一覧（' + rows.length + '件）</h2></header><div class="tw"><table><thead><tr><th>分類</th><th>質問</th><th>キーワード</th><th>文章での回答回数</th><th>状態</th><th></th></tr></thead><tbody>'
    + rows.map(function(r){ return '<tr><td style="font-size:12px">' + catName(r.cat) + '</td><td>' + esc(r.title) + '</td><td style="font-size:12px">' + esc((r.keywords || []).join('、')) + '</td><td>' + (used[r.id] || 0) + '</td><td>' + (r.active ? '<span class="pill ok">使用中</span>' : '<span class="pill">停止</span>') + '</td><td><button class="btn sub sm" data-fe="' + r.id + '">修正</button></td></tr>'; }).join('')
    + '</tbody></table></div></div>'
    + '<div class="card"><header><h2>分類（大分類・中分類）</h2></header><div class="in"><p class="note">中分類の下に、上の一覧の質問が並びます。停止した分類は選択肢に出ません。</p><div class="tw"><table><thead><tr><th>大分類</th><th>中分類</th><th>並び順</th><th>状態</th><th></th></tr></thead><tbody>'
    + cats.filter(function(c){ return !c.parent; }).map(function(p){ return [p].concat(cats.filter(function(c){ return c.parent === p.key; })).map(function(c){ return '<tr><td>' + (c.parent ? '' : '<b>' + esc(c.label) + '</b>') + '</td><td>' + (c.parent ? esc(c.label) : '') + '</td><td>' + c.sort + '</td><td>' + (c.active ? '<span class="pill ok">使用中</span>' : '<span class="pill">停止</span>') + '</td><td><button class="btn sub sm" data-ce="' + esc(c.key) + '">修正</button></td></tr>'; }).join(''); }).join('')
    + '</tbody></table></div><div class="btns" style="margin-top:10px"><button class="btn sub sm" id="cat-add">分類を追加</button></div><div id="cat-edit"></div></div></div></div>';
  function catForm(c){
    c = c || { key: '', parent: '', label: '', sort: 100, active: true };
    $('#cat-edit').innerHTML = '<form class="f" id="cat-f" style="margin-top:12px"><label class="l">表示名<input name="label" maxlength="40" required value="' + esc(c.label) + '"></label>'
      + '<label class="l">上の分類（空欄なら大分類）<select name="parent"' + (c.key ? ' disabled' : '') + '><option value="">（大分類）</option>' + cats.filter(function(x){ return !x.parent; }).map(function(x){ return '<option value="' + esc(x.key) + '"' + (c.parent === x.key ? ' selected' : '') + '>' + esc(x.label) + '</option>'; }).join('') + '</select></label>'
      + '<div class="btns"><label>並び順 <input name="sort" type="number" value="' + c.sort + '" style="width:80px"></label><label><input type="checkbox" name="active"' + (c.active ? ' checked' : '') + '> 使用する</label><button class="btn sm">保存する</button></div></form>';
    $('#cat-f').onsubmit = async function(e){ e.preventDefault(); var f = e.target, row = { label: f.label.value.trim(), sort: parseInt(f.sort.value, 10) || 100, active: f.active.checked };
      try{ if(c.key) await GL.update('support_cat', { key: c.key }, row); else { row.parent = f.parent.value || null; row.key = (row.parent ? row.parent + '.' : '') + 'c' + Date.now().toString(36); await GL.insert('support_cat', row); } toast('保存しました'); viewFaq(); }catch(x){ toast(x.message, true); } };
  }
  $('#cat-add').onclick = function(){ catForm(); };
  function form(r){
    r = r || { title: '', keywords: [], answer: '', links: [], quick: false, sort: 100, active: true };
    $('#faq-edit').innerHTML = '<div class="card"><header><h2>' + (r.id ? '回答を修正' : '回答を追加') + '</h2></header><form class="f in" id="faq-f">'
      + '<label class="l">質問（お客様に表示する見出し）<input name="title" maxlength="60" required value="' + esc(r.title) + '"></label>'
      + '<label class="l">キーワード（読点「、」で区切る。2文字以上がおすすめ）<input name="keywords" value="' + esc((r.keywords || []).join('、')) + '"></label>'
      + '<label class="l">分類（中分類）<select name="cat"><option value="">（選択肢に表示しない）</option>' + cats.filter(function(c){ return c.parent; }).map(function(c){ return '<option value="' + esc(c.key) + '"' + (r.cat === c.key ? ' selected' : '') + '>' + esc((cm[c.parent] ? cm[c.parent].label + ' › ' : '') + c.label) + '</option>'; }).join('') + '</select></label>'
      + '<label class="l">回答<textarea name="answer" maxlength="1000" required style="min-height:110px">' + esc(r.answer) + '</textarea></label>'
      + '<label class="l">案内するページ（1行に1つ「表示名｜ページ」。例：申込画面へ｜apply）<textarea name="links" style="min-height:60px">' + esc((r.links || []).map(function(l){ return l[0] + '｜' + l[1]; }).join('\n')) + '</textarea></label>'
      + '<div class="btns"><label><input type="checkbox" name="quick"' + (r.quick ? ' checked' : '') + '> 答えられないときの候補に出す</label><label><input type="checkbox" name="active"' + (r.active ? ' checked' : '') + '> 使用する</label><label>並び順 <input name="sort" type="number" value="' + (r.sort || 100) + '" style="width:80px"></label></div>'
      + '<div class="btns"><button class="btn sm">保存する</button><button type="button" class="btn sub sm" id="faq-x">閉じる</button></div></form></div>';
    $('#faq-x').onclick = function(){ $('#faq-edit').innerHTML = ''; };
    $('#faq-f').onsubmit = async function(e){ e.preventDefault(); var f = e.target, b = f.querySelector('button');
      var row = { title: f.title.value.trim(), keywords: f.keywords.value.split(/[、,，\s]+/).map(function(x){ return x.trim(); }).filter(Boolean), answer: f.answer.value.trim(),
        links: f.links.value.split('\n').map(function(x){ var p = x.split(/[｜|]/); return [ (p[0] || '').trim(), (p[1] || '').trim() ]; }).filter(function(p){ return p[0] && p[1]; }),
        quick: f.quick.checked, active: f.active.checked, cat: f.cat.value || null, sort: parseInt(f.sort.value, 10) || 100, updated_at: new Date().toISOString() };
      b.disabled = true;
      try{ if(r.id) await GL.update('support_faq', { id: r.id }, row); else await GL.insert('support_faq', row); toast('保存しました'); viewFaq(); }catch(x){ toast(x.message, true); b.disabled = false; } };
    $('#faq-edit').scrollIntoView({ behavior: 'smooth' }); $('#faq-f').title.focus();
  }
  $('#faq-add').onclick = function(){ form(); };
  $('#faq-root').onclick = function(e){ var b = e.target.closest('[data-fe],[data-mq],[data-ce]'); if(!b) return;
    if(b.dataset.ce){ catForm(cm[b.dataset.ce]); return; }
    if(b.dataset.fe) form(rows.filter(function(r){ return String(r.id) === b.dataset.fe; })[0]);
    else form({ title: '', keywords: [b.dataset.mq], answer: '', links: [], quick: false, sort: 300, active: true }); };
}

// ============ 起動 ============
GL.useStore('gl-admin');
if(!GL.configured){ root.innerHTML = '<div class="login"><div class="box"><b>G-LOVE</b><p>受付システムが未接続です。assets/config.js に接続先を設定してください。</p></div></div>'; return; }
if(GL.session){ start().catch(function(e){ viewLogin(e.message); }); } else viewLogin();
})();
