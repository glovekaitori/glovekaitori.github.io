/* G-LOVE 「使い方・相談」窓口（全ページ右下）
   ・このページの使い方：今いる画面でできることと、次に進む場所
   ・チャットで相談：基本は選択肢（大分類→中分類→質問→回答）。どの段階でも担当者へ切り替えられる（数秒ごとに自動更新）。相談ごとの合言葉はこのブラウザにだけ保存 */
(function(){
'use strict';
var d = document, page = (d.body && d.body.dataset.page) || 'top';
if(page === 'admin') return;
var PRE = page === 'top' ? '' : '../';
var C = window.GLOVE_CONFIG || {}, LIVE = window.GL && GL.configured, TRIAL = C.mode !== 'live';
function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function tm(v){ return new Date(v).toLocaleTimeString('ja-JP', { timeZone:'Asia/Tokyo', hour:'2-digit', minute:'2-digit' }); }

var HELP = {
  top: ['G-LOVEのトップページです。', ['はじめての方は「はじめて申し込む」から。約3分で受付番号が届きます。', '申込済みの方は「申込済みの方」から、メールアドレスだけでログインします。', 'マネージャー・事務所の方は「マネージャー・事務所の方」で、代理の手続きをご確認ください。'], [['guide','ご利用ガイド'],['apply','申込画面へ'],['status','お手続きへ']]],
  guide: ['立場ごとの手順をまとめたページです。', ['上の「ご本人」「マネージャー・事務所の方」「法人の方」から、あなたの立場を選びます。', '各手順の「あなたがすること」を順に進めてください。手順にあるボタンから、その画面に進めます。'], [['apply','申込画面へ'],['status','お手続きへ']]],
  apply: ['買取のお申込み画面です。4つの画面に分かれています。', ['申込者 → 連絡先 → お品物 → 集荷の順に入力し、「次へ」で進みます。', '紹介コードと写真は任意です。ご住所の番地や身分証は、この段階では不要です。', '最後に内容を確認して「この内容で申し込む」を押すと、受付番号が表示されます。'], [['guide','ご利用ガイド']]],
  status: ['お手続きの画面です。', ['メールアドレスを入れると、ログイン用のメールが届きます。メールの「ログインする」ボタンを押すだけで入れます（この端末では次回から不要）。', 'ログイン後は、いちばん上の枠「次にやること」を順に進めてください。', '担当者への連絡は、画面の下の「担当者への連絡」からもできます。'], [['guide','ご利用ガイド']]],
  result: ['査定結果の画面です。', ['お品物ごとに「売る」か「返却」を選びます。', '「次へ（内容の確認）」を押すと、売買契約書と4つの確認項目が出ます。', '確認項目にチェックを入れて「売買契約を締結する」を押すと、電子署名で契約が成立します。すべて返却の場合は「この内容で回答する」を押します。'], [['status','お手続きへ']]],
  documents: ['契約・書類の画面です。', ['書類の本文を読み、「同意」にチェックすると電子署名のボタンが押せます。', '「印刷・PDFで保存」で控えを残せます。'], [['status','お手続きへ']]],
  agent: ['代理の方（マネージャー・事務所）向けの案内です。', ['代理として申し込み、ログイン後に委任状を作成すると、ご本人に署名のお願いが届きます。', 'ご本人の署名と、代理の方ご自身の本人確認が済むと、任された範囲で手続きできます。'], [['guide#agent','代理の方のガイド'],['apply','申込画面へ']]],
  invite: ['紹介コードの確認画面です。', ['紹介コードがなくてもお申込みいただけます。', 'お持ちの方は、ここで確認してから申込画面に進めます。'], [['apply','申込画面へ']]],
  contact: ['お問い合わせの画面です。', ['すぐに聞きたいことは、この窓口の「チャットで相談」が便利です。', 'お取引の詳細は、ログイン後の「担当者への連絡」からお伺いします。'], [['guide','ご利用ガイド']]]
};
var DEF = ['G-LOVEのご案内ページです。', ['わからないことは「チャットで相談」へ。自動でお答えし、必要なら担当者におつなぎします。', '手順は「ご利用ガイド」にまとめています。'], [['guide','ご利用ガイド'],['apply','申込画面へ'],['status','お手続きへ']]];

// ── 骨組み ──
var btn = d.createElement('button'); btn.type = 'button'; btn.className = 'hp-btn'; btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'hp-panel');
btn.innerHTML = '<span class="hp-dot" aria-hidden="true"></span><span>使い方・相談</span><b class="hp-badge" hidden>新着</b>';
var pn = d.createElement('section'); pn.id = 'hp-panel'; pn.className = 'hp-panel'; pn.hidden = true; pn.setAttribute('role', 'dialog'); pn.setAttribute('aria-label', '使い方・相談');
pn.innerHTML = '<header class="hp-hd"><div class="hp-tabs" role="tablist"><button type="button" role="tab" data-t="help" aria-selected="true">このページの使い方</button><button type="button" role="tab" data-t="chat" aria-selected="false">チャットで相談</button></div><button type="button" class="hp-x" aria-label="閉じる">×</button></header><div class="hp-body" id="hp-help"></div><div class="hp-body" id="hp-chat" hidden></div>';
d.body.appendChild(btn); d.body.appendChild(pn);
var tab = 'help';

var h = HELP[page] || DEF;
pn.querySelector('#hp-help').innerHTML = '<p class="hp-lead">' + esc(h[0]) + '</p><ol class="hp-list">' + h[1].map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>'
  + '<div class="hp-links">' + h[2].map(function(l){ return '<a href="' + PRE + l[0].replace('#', '/#') + (l[0].indexOf('#') < 0 ? '/' : '') + '">' + esc(l[1]) + '</a>'; }).join('') + '</div>'
  + '<button type="button" class="hp-go" data-go="chat">チャットで質問する（自動でお答えします）</button>';

function open(t){ pn.hidden = false; btn.setAttribute('aria-expanded', 'true'); setTab(t || tab); var f = pn.querySelector('[role=tab][aria-selected=true]'); if(f) f.focus(); }
function close(){ pn.hidden = true; btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
function setTab(t){ tab = t; pn.querySelectorAll('[role=tab]').forEach(function(b){ b.setAttribute('aria-selected', b.dataset.t === t ? 'true' : 'false'); });
  pn.querySelector('#hp-help').hidden = t !== 'help'; pn.querySelector('#hp-chat').hidden = t !== 'chat'; if(t === 'chat'){ renderChat(); badge(false); loadMenu(); } }
btn.addEventListener('click', function(){ pn.hidden ? open() : close(); });
pn.querySelector('.hp-x').addEventListener('click', close);
pn.addEventListener('click', function(e){ var t = e.target.closest('[data-t],[data-go]'); if(t) setTab(t.dataset.t || t.dataset.go); });
d.addEventListener('keydown', function(e){ if(e.key === 'Escape' && !pn.hidden) close(); });
// 窓を開いている間は、Tabキーの移動を窓の中に留める
pn.addEventListener('keydown', function(e){ if(e.key !== 'Tab') return; var f = Array.prototype.filter.call(pn.querySelectorAll('button,a[href],input,select,textarea'), function(x){ return !x.disabled && x.offsetParent !== null; }); if(!f.length) return; var a = f[0], z = f[f.length - 1]; if(e.shiftKey && d.activeElement === a){ e.preventDefault(); z.focus(); } else if(!e.shiftKey && d.activeElement === z){ e.preventDefault(); a.focus(); } });
function badge(on){ btn.querySelector('.hp-badge').hidden = !on; }

// ── チャット（基本は選択肢：大分類 → 中分類 → 質問 → 回答。どの段階でも担当者へ切替できる） ──
var S = { token: null, last: 0, msgs: [], online: false, status: 'open', mode: 'auto', menu: null, nav: [{ t: 'top' }], seen: [], typing: false, asking: false, browse: false };
try{ var sv = JSON.parse(sessionStorage.getItem('gl-support') || 'null'); if(sv){ S.token = sv.token; } }catch(e){}
function save(){ try{ sessionStorage.setItem('gl-support', JSON.stringify({ token: S.token })); }catch(e){} }
function href(path){ path = String(path || ''); if(!/^[a-z]{2,20}(#[a-z]{1,20})?$/.test(path)) return '#'; return esc(PRE + path.replace('#', '/#') + (path.indexOf('#') < 0 ? '/' : '')); }
function cur(){ return S.nav[S.nav.length - 1]; }
function catOf(k){ return S.menu && S.menu.cats.filter(function(c){ return c.key === k; })[0]; }
function kids(k){ return S.menu ? S.menu.cats.filter(function(c){ return (c.parent || null) === (k || null); }) : []; }
function faqsIn(k){ return S.menu ? S.menu.faqs.filter(function(f){ return f.cat === k; }) : []; }
function faqById(id){ return S.menu && S.menu.faqs.filter(function(f){ return String(f.id) === String(id); })[0]; }

function stateText(){
  if(S.mode === 'auto') return ['auto', '自動でご案内しています（担当者にもおつなぎできます）'];
  return S.online ? ['on', '担当者が対応しています'] : ['', '担当者は不在です。メッセージを残していただければ、お返事します'];
}
function renderChat(){
  var box = pn.querySelector('#hp-chat');
  if(!LIVE){ box.innerHTML = '<p class="hp-lead">チャットでの相談は準備中です。</p><p class="hp-note">お手数ですが、<a href="' + PRE + 'contact/">お問い合わせ</a>からご連絡ください。</p>'; return; }
  var st = stateText(), staff = S.mode === 'staff', closed = S.status === 'closed';
  box.innerHTML = '<p class="hp-state ' + st[0] + '"><i aria-hidden="true"></i>' + st[1] + '</p>'
    + (TRIAL && !S.token ? '<p class="hp-note bad">試験運用中です。実在のお名前・連絡先は書かないでください。</p>' : '')
    + (S.msgs.length ? '<div class="hp-log" id="hp-log" aria-live="polite"></div>' : '')
    + (closed ? '<p class="hp-note">この相談は終了しました。<button type="button" class="hp-link" id="hp-new">新しく相談を始める</button></p>'
      : (!staff || S.browse ? '<div class="hp-nav" id="hp-nav" aria-live="polite"></div>' : '')
        + (staff ? '<button type="button" class="hp-link hp-sm" id="hp-browse">' + (S.browse ? 'よくある質問を閉じる' : 'よくある質問を見る') + '</button>' : '')
        + (staff || S.typing ? '<form class="hp-f hp-reply" id="hp-say" novalidate><div aria-hidden="true" style="position:absolute;left:-9999px"><input name="website" tabindex="-1" autocomplete="off"></div><label class="sr" for="hp-in">メッセージ</label><textarea id="hp-in" name="body" maxlength="1000" rows="2" placeholder="' + (staff ? '担当者へのメッセージ' : 'ご質問を入力（例：送料はかかりますか）') + '"></textarea>'
          + '<p class="hp-note sm">ご住所・口座などの個人情報は書かないでください。</p><p class="hp-err" role="alert"></p><button type="submit" class="hp-send">送信</button></form>'
          : '<button type="button" class="hp-link hp-sm" id="hp-type">選択肢にない質問は、文章で質問する</button><p class="hp-err" role="alert" id="hp-err0"></p>'));
  drawLog(); drawNav();
}
function opt(label, attr, sub){ return '<button type="button" class="hp-opt" ' + attr + '><span>' + esc(label) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span><i aria-hidden="true">›</i></button>'; }
function handoffBox(){
  if(S.asking) return '<form class="hp-ho" id="hp-ho"><p class="hp-ho-t">担当者におつなぎします</p><label>お呼びする名前（任意・ニックネーム可）<input name="name" maxlength="40" autocomplete="nickname" placeholder="例：花子"></label><div class="hp-ho-b"><button type="submit" class="hp-send">担当者につなぐ</button><button type="button" class="hp-link" id="hp-ho-x">やめる</button></div></form>';
  return '<button type="button" class="hp-ho-btn" id="hp-ho-go"><span aria-hidden="true">☎</span> 担当者と直接やり取りしたい</button>';
}
function drawNav(){
  var el = pn.querySelector('#hp-nav'); if(!el) return;
  if(!S.menu){ el.innerHTML = '<p class="hp-note">選択肢を読み込んでいます…</p>' + (S.mode === 'auto' ? '<div class="hp-ho-w">' + handoffBox() + '</div>' : ''); return; }
  var n = cur(), html = '', crumbs = [];
  S.nav.forEach(function(x){ if(x.t === 'cat'){ var c = catOf(x.key); if(c) crumbs.push(c.label); } });
  if(n.t !== 'top') html += '<p class="hp-crumb">' + ['最初'].concat(crumbs).map(esc).join(' › ') + '</p>';
  if(n.t === 'top'){
    html += '<div class="hp-m bot"><p class="hp-meta">G-LOVE 自動案内</p><p>知りたいことに近いものを選んでください。</p></div>'
      + '<div class="hp-opts">' + kids(null).map(function(c){ return opt(c.label, 'data-cat="' + esc(c.key) + '"', kids(c.key).map(function(x){ return x.label; }).join('・')); }).join('') + '</div>';
  } else if(n.t === 'cat'){
    var ch = kids(n.key), fs = faqsIn(n.key), c = catOf(n.key);
    html += '<p class="hp-q">' + esc(c ? c.label : '') + '</p><div class="hp-opts">'
      + ch.map(function(x){ return opt(x.label, 'data-cat="' + esc(x.key) + '"'); }).join('')
      + fs.map(function(f){ return opt(f.title, 'data-faq="' + f.id + '"'); }).join('') + '</div>';
  } else if(n.t === 'faq'){
    var f = faqById(n.id);
    if(f) html += '<div class="hp-m bot hp-ans"><p class="hp-meta">ご質問</p><p class="hp-q">' + esc(f.title) + '</p><p>' + esc(f.answer) + '</p>'
      + (f.links && f.links.length ? '<div class="hp-links in">' + f.links.map(function(l){ return '<a href="' + href(l[1]) + '">' + esc(l[0]) + '</a>'; }).join('') + '</div>' : '') + '</div>'
      + '<p class="hp-rel">この回答で解決しましたか</p><div class="hp-yn"><button type="button" class="hp-chip" id="hp-yes">解決した</button><button type="button" class="hp-chip" id="hp-no">解決しない</button></div>';
    var others = f ? faqsIn(f.cat).filter(function(x){ return x.id !== f.id; }) : [];
    if(others.length) html += '<p class="hp-rel">同じ分類のほかの質問</p><div class="hp-opts sm">' + others.map(function(x){ return opt(x.title, 'data-faq="' + x.id + '"'); }).join('') + '</div>';
  } else if(n.t === 'solved'){
    html += '<div class="hp-m bot"><p class="hp-meta">G-LOVE 自動案内</p><p>お役に立ててよかったです。ほかにも知りたいことがあれば、最初から選べます。</p></div>';
  } else if(n.t === 'unsolved'){
    html += '<div class="hp-m bot"><p class="hp-meta">G-LOVE 自動案内</p><p>お役に立てず申し訳ありません。担当者が直接お答えします。下の「担当者と直接やり取りしたい」を押してください。ほかの質問を選ぶこともできます。</p></div>';
  }
  if(n.t !== 'top') html += '<div class="hp-navb"><button type="button" class="hp-link" id="hp-back">‹ 戻る</button><button type="button" class="hp-link" id="hp-home">最初に戻る</button></div>';
  if(S.mode === 'auto') html += '<div class="hp-ho-w' + (n.t === 'unsolved' ? ' hl' : '') + '">' + handoffBox() + '</div>';
  el.innerHTML = html;
}
function drawLog(){
  var log = pn.querySelector('#hp-log'); if(!log) return;
  var last = S.msgs[S.msgs.length - 1], html = '';
  S.msgs.forEach(function(m){
    var who = m.kind === 'staff' ? 'G-LOVE 担当者' : m.kind === 'bot' ? 'G-LOVE 自動案内' : 'あなた', x = m.meta || {};
    html += '<div class="hp-m ' + (m.kind === 'visitor' ? 'me' : m.kind) + '"><p class="hp-meta">' + who + '　' + tm(m.at) + '</p><p>' + esc(m.body) + '</p>'
      + (m.kind === 'bot' && x.links && x.links.length ? '<div class="hp-links in">' + x.links.map(function(l){ return '<a href="' + href(l[1]) + '">' + esc(l[0]) + '</a>'; }).join('') + '</div>' : '') + '</div>';
  });
  if(S.mode === 'staff' && last && last.kind === 'visitor') html += '<p class="hp-wait">' + (S.online ? '担当者がお返事を書いています…' : 'お返事をお待ちください。この画面を閉じても、相談は続きます。') + '</p>';
  log.innerHTML = html; log.scrollTop = log.scrollHeight;
}
function go(node){ S.nav.push(node); S.asking = false; drawNav(); var el = pn.querySelector('#hp-nav'); if(el) el.scrollIntoView({ block: 'nearest' }); var b = pn.querySelector('.hp-body:not([hidden])'); if(b && el) b.scrollTop = el.offsetTop - 8; }
async function ask(body, website){
  if(!S.token){
    var r = await GL.rpc('support_open', { p: { body: body, page: page, website: website || '' } }, true);
    S.token = r.token; S.online = r.staffOnline; S.last = 0; S.msgs = []; save();
  } else await GL.rpc('support_send', { p_token: S.token, p_body: body }, true);
  await poll(true); renderChat();
}
function errOut(m){ var e = pn.querySelector('#hp-say .hp-err') || pn.querySelector('#hp-err0'); if(e) e.textContent = m; }
pn.addEventListener('submit', async function(e){
  var f = e.target;
  if(f.id === 'hp-say'){
    e.preventDefault();
    var b = f.querySelector('button[type=submit]'), body = f.body.value.trim(); errOut('');
    if(!body){ errOut('内容を入力してください'); return; }
    b.disabled = true;
    try{ await ask(body, f.website.value); var t = pn.querySelector('#hp-in'); if(t){ t.value = ''; t.focus(); } }catch(x){ errOut(x.message); }
    b.disabled = false;
  } else if(f.id === 'hp-ho'){
    e.preventDefault(); var nm = f.name.value.trim(), bt = f.querySelector('button[type=submit]'); bt.disabled = true;
    var seen = S.seen.length ? '（ご覧になった質問：' + S.seen.slice(-5).join('／') + '）' : '';
    try{
      if(!S.token){ var r = await GL.rpc('support_open', { p: { body: ('担当者と直接やり取りしたい' + seen).slice(0, 1000), name: nm, page: page } }, true); S.token = r.token; S.last = 0; S.msgs = []; save(); }
      else await GL.rpc('support_handoff', { p_token: S.token, p_name: nm || null }, true);
      S.asking = false; S.browse = false; await poll(true); renderChat();
      var t2 = pn.querySelector('#hp-in'); if(t2) t2.focus();
    }catch(x){ bt.disabled = false; errOut(x.message); }
  }
});
pn.addEventListener('click', function(e){
  var t = e.target.closest('button'); if(!t || !pn.contains(t)) return;
  if(t.id === 'hp-new'){ S.token = null; S.msgs = []; S.last = 0; S.status = 'open'; S.mode = 'auto'; S.nav = [{ t: 'top' }]; S.typing = false; save(); renderChat(); return; }
  if(t.id === 'hp-ho-go'){ S.asking = true; drawNav(); var i = pn.querySelector('#hp-ho input'); if(i) i.focus(); return; }
  if(t.id === 'hp-ho-x'){ S.asking = false; drawNav(); return; }
  if(t.id === 'hp-type'){ S.typing = true; renderChat(); var i2 = pn.querySelector('#hp-in'); if(i2) i2.focus(); return; }
  if(t.id === 'hp-browse'){ S.browse = !S.browse; renderChat(); return; }
  if(t.id === 'hp-back'){ if(S.nav.length > 1) S.nav.pop(); while(S.nav.length > 1 && /solved/.test(cur().t)) S.nav.pop(); S.asking = false; drawNav(); return; }
  if(t.id === 'hp-home'){ S.nav = [{ t: 'top' }]; S.asking = false; drawNav(); return; }
  if(t.id === 'hp-yes'){ go({ t: 'solved' }); return; }
  if(t.id === 'hp-no'){ go({ t: 'unsolved' }); return; }
  if(t.dataset.cat){ go({ t: 'cat', key: t.dataset.cat }); return; }
  if(t.dataset.faq){ var f = faqById(t.dataset.faq); if(f && S.seen.indexOf(f.title) < 0) S.seen.push(f.title); go({ t: 'faq', id: t.dataset.faq }); return; }
});
pn.addEventListener('keydown', function(e){ if(e.target.matches('#hp-say textarea') && e.key === 'Enter' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); pn.querySelector('#hp-say').requestSubmit(); } });

var busy = false;
async function loadMenu(){ if(S.menu) return; try{ S.menu = await GL.rpc('support_menu', {}, true); if(!pn.hidden && tab === 'chat') drawNav(); }catch(e){} }
async function poll(force){
  if(!LIVE || (busy && !force)) return; busy = true;
  try{
    if(S.token){
      var r = await GL.rpc('support_fetch', { p_token: S.token, p_after: S.last }, true);
      var news = r.messages || [], before = S.online + S.status + S.mode + (S.msgs.length > 0); S.online = r.staffOnline; S.status = r.status; S.mode = r.mode || 'auto';
      if(news.length){ S.msgs = S.msgs.concat(news); S.last = news[news.length - 1].id; }
      var gotStaff = news.some(function(m){ return m.kind === 'staff'; });
      if(!pn.hidden && tab === 'chat' && !force){ if(before !== S.online + S.status + S.mode + (S.msgs.length > 0)) renderChat(); else if(news.length) drawLog(); }
      else if(gotStaff && (pn.hidden || tab !== 'chat')) badge(true);
    }
  }catch(x){ if(/見つかりません/.test(x.message)){ S.token = null; save(); } }
  busy = false;
}
if(LIVE){
  poll();
  setInterval(function(){ if(d.hidden) return; if(!pn.hidden && tab === 'chat') poll(); }, 4000);
  setInterval(function(){ if(d.hidden) return; if(pn.hidden || tab !== 'chat') poll(); }, 30000);
}
})();

(function(){ var T = /^(INPUT|TEXTAREA|SELECT)$/;
  document.addEventListener('focusin', function(e){ if(T.test(e.target.tagName) && !(e.target.closest && e.target.closest('.hp-panel'))) document.body.classList.add('hp-typing'); });
  document.addEventListener('focusout', function(e){ if(T.test(e.target.tagName)) setTimeout(function(){ var a = document.activeElement; if(!a || !T.test(a.tagName)) document.body.classList.remove('hp-typing'); }, 50); });
})();
