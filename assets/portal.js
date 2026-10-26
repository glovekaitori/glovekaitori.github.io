/* G-LOVE お客様用画面（取引状況・査定結果・契約書類）
   メールアドレスを入れ、届いたメールのボタン（または6桁のコード）でログインする。この端末ではログインを保つ。 */
(function(){
'use strict';
var box = document.getElementById('portal'); if(!box) return;
var VIEW = box.dataset.view, PRE = box.dataset.pre || '../';
var $ = function(s, r){ return (r || document).querySelector(s); };
function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function dt(v){ return v ? new Date(v).toLocaleString('ja-JP', { timeZone:'Asia/Tokyo', year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'; }
function yen(n){ return '¥' + Number(n || 0).toLocaleString('ja-JP'); }
var STATUS = { received:'受付', contacting:'担当者からご連絡', identity_pending:'ご本人確認', pickup_arranging:'集荷の手配', in_transit:'お品物の輸送中',
  goods_received:'お品物を受領', appraising:'査定中', appraisal_notified:'査定結果のご回答待ち', return_scheduled:'返却のご予定をお知らせ済み',
  approved:'ご承認いただきました', partially_approved:'一部ご承認いただきました', declined:'ご辞退を承りました', contracted:'契約が成立しました',
  paid:'お振込みが完了しました', returning:'お品物を返却中', returned:'お品物を返却しました', closed:'お取引完了', cancelled:'お取引は取り消されました' };
var STEP = { received:0, contacting:0, identity_pending:1, pickup_arranging:2, in_transit:2, goods_received:2, appraising:3, appraisal_notified:3, return_scheduled:3,
  approved:4, partially_approved:4, declined:4, contracted:5, paid:6, returning:4, returned:4, closed:6, cancelled:0 };
var STEPS = ['受付','ご本人確認','集荷・受領','査定','ご回答','契約','お振込み'];
var CK = { sale:'売買契約書', mandate:'委任状', nda:'秘密保持契約書', receipt:'受領書' };
var EV = { withdrawn:'契約の前に辞退', nda_requested:'秘密保持契約を希望', mandate_requested:'委任状を作成して署名を依頼', mandate_accepted:'受任者として委任状に署名', identity_submitted:'本人確認の情報を送信', pickup_requested:'集荷を依頼', shipped:'発送', bank_registered:'振込先を登録', return_address:'返却先を確認', appraisal_answered:'査定に回答', contract_signed:'書類に署名', mandate_signed:'委任状に署名', mandate_revoked:'委任を撤回' };

GL.useStore('gl-portal', true);
var cases = [];
function msg(t, bad){ var m = $('#pmsg'); m.className = bad ? 'alert' : 'note'; m.hidden = !t; m.textContent = t || ''; if(t) m.scrollIntoView({ block:'nearest' }); }

// ── ログイン（メールアドレスだけ。メールのボタンを押すとログイン。この端末では次回からログイン不要） ──
function viewLogin(){ var nxb = document.getElementById('nx-bar'); if(nxb) nxb.remove(); document.body.classList.remove('has-nxbar');
  box.innerHTML = '<div id="pmsg" hidden role="status"></div>'
    + '<form class="gate" id="p1" novalidate><p>G-LOVEからのお知らせメールの<b>ボタンを押すと、そのままこの画面が開きます</b>。お手元にお知らせメールがない場合は、お申込みのときの<b>メールアドレス</b>を入れてください。ボタン付きのメールをすぐにお送りします。</p>'
    + '<div class="field"><label for="p-mail">メールアドレス</label><input type="email" id="p-mail" autocomplete="email" required><p class="hint">代理の方は、代理として申し込んだときのメール、または委任状に登録されたメールです。</p></div>'
    + '<div class="btns"><button class="btn" type="submit">ログイン用のメールを受け取る</button></div>'
    + '<p class="hint" style="font-size:.82rem;color:var(--on-dark-mute)">パスワードや受付番号は不要です。一度ログインすると、この端末では次回からログインせずに開けます（共用の端末では、使い終わったら「ログアウト」を押してください）。</p></form>'
    + '<form class="gate" id="p2" hidden novalidate><p id="p2t"></p>'
    + '<details style="margin-top:12px"><summary style="cursor:pointer">ボタンが押せないときは（6桁のコードで入る）</summary><div class="field" style="margin-top:10px"><label for="p-code">メールに記載の6桁の数字</label><input type="text" id="p-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6"></div>'
    + '<div class="btns"><button class="btn" type="submit">ログインする</button></div></details>'
    + '<div class="btns"><button class="btn ghost" type="button" id="p-back">メールアドレスを入れ直す</button></div></form>';
  var mail = '';
  try{ $('#p-mail').value = localStorage.getItem('gl-mail') || ''; }catch(e){}
  if(!GL.configured){ msg('現在、お客様用画面は準備中です。お取引の状況は担当者からご連絡します。', true); $('#p1 button').disabled = true; return; }
  $('#p1').addEventListener('submit', async function(e){
    e.preventDefault(); mail = $('#p-mail').value.trim().toLowerCase();
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return msg('メールアドレスの形式をご確認ください', true);
    var b = this.querySelector('button'); b.disabled = true;
    try{ await GL.sendOtp(mail, location.origin + location.pathname); try{ localStorage.setItem('gl-mail', mail); }catch(e){}
      msg(''); $('#p1').hidden = true; $('#p2').hidden = false;
      $('#p2t').innerHTML = '<b>' + esc(mail) + '</b> にログイン用のメールを送りました。メールを開いて<b>「ログインする」ボタン</b>を押してください。<br><small>届かないときは迷惑メールのフォルダもご確認ください。お申込みのないメールアドレスには、お手続きの画面は表示されません。</small>'; }
    catch(x){ msg(x.message, true); } b.disabled = false;
  });
  $('#p-back').onclick = function(){ $('#p2').hidden = true; $('#p1').hidden = false; msg(''); };
  $('#p2').addEventListener('submit', async function(e){
    e.preventDefault(); var b = this.querySelector('button[type=submit]'); var code = $('#p-code').value.trim();
    if(!/^[0-9]{6}$/.test(code)) return msg('6桁の数字を入力してください', true);
    b.disabled = true;
    try{ await GL.verifyOtp(mail, code); await enter(); }catch(x){ msg(x.message, true); b.disabled = false; }
  });
}
async function enter(){
  try{ await GL.rpc('portal_claim_all', {}); }catch(x){}
  await load();
}

// ── ログイン後 ──
async function load(){
  cases = await GL.rpc('portal_cases', {});
  var tabs = [['status','お手続き'],['result','査定結果'],['documents','契約・書類']];
  box.innerHTML = '<div class="ptabs">' + tabs.map(function(t){ return '<a href="' + PRE + t[0] + '/"' + (t[0] === VIEW ? ' aria-current="page"' : '') + '>' + t[1] + '</a>'; }).join('')
    + '<button class="btn ghost" type="button" id="p-out">ログアウト</button></div><p class="ptab-help">' + ({ status:'金色の太い枠が「次にやること」です。枠の中で入力して送ると、次の手順に進みます（画面の下にも表示されます）。', result:'お品物ごとに「売る」か「返却」を選び、「次へ（内容の確認）」を押してください。契約書を確認し、4つの項目にチェックを入れて署名すると、売買契約まで完了します。', documents:'書類を読み、「同意」にチェックしてから電子署名してください。印刷やPDFでの保存もできます。' })[VIEW] + '</p><div id="pmsg" hidden role="status"></div><div id="pv"></div>';
  $('#p-out').onclick = async function(){ var b = this; if(!b.dataset.sure){ b.dataset.sure = '1'; b.textContent = 'もう一度押すとログアウト'; return; } await GL.signOut(); viewLogin(); msg('ログアウトしました。次は、お知らせメールのボタンから開けます'); };
  if(!cases.length){ $('#pv').innerHTML = '<p class="note">このメールアドレスのお取引は見つかりませんでした。お申込みのときのメールアドレスでログインしてください（代理の方は、委任状に登録されたメールアドレス）。</p>'; return; }
  ({ status: vStatus, result: vResult, documents: vDocs })[VIEW]();
  nextBar();
  if(/^#c-[0-9a-f]{8}$/.test(location.hash)) setTimeout(function(){ var el = document.querySelector(location.hash); if(el) el.scrollIntoView({ block: 'start' }); }, 150);
}
function head(c){ var nx = VIEW !== 'status' ? tasks(c)[0] : null; return '<div class="phd"><p class="eyebrow">受付番号</p><h2 class="no">' + esc(c.receiptNo) + '</h2><p>' + esc(STATUS[c.status] || c.status) + '</p>'
  + (nx && nx.key !== 'info' && nx.key !== 'wait' && !(nx.key === 'link' && nx.href === VIEW) ? '<p class="pnext"><span class="nx-l">次にやること</span><a href="' + PRE + 'status/#c-' + c.id.slice(0, 8) + '">' + esc(nx.title) + '　→ ここから進む</a></p>' : '')
  + (c.actor === 'agent' ? '<p class="pill ' + (c.mandateActive ? 'on' : '') + '">代理の方としてログイン中' + (c.mandateActive ? '' : '（委任は有効になっていません）') + '</p>' : '') + '</div>'; }

// ── 取引ナビ：次にやること ──
var TRIAL = (window.GLOVE_CONFIG || {}).mode !== 'live';
var TRIAL_NOTE = TRIAL ? '<p class="alert" style="margin:0">試験運用中です。実在のお名前・ご住所・口座は入力しないでください。</p>' : '';
var EARLY = ['received','contacting','identity_pending','pickup_arranging','in_transit'];
function canPickup(c){ return c.actor === 'seller' || (c.mandateActive && c.scope && c.scope.pickup); }
function canBank(c){ return c.actor === 'seller' || (c.mandateActive && c.scope && c.scope.sign); }
function expired(ap){ return ap && ap.expiresAt && new Date(ap.expiresAt) < new Date(); }
function canDocs(c){ return c.actor === 'seller' || (c.mandateActive && c.scope && (c.scope.documents || c.scope.sign || c.scope.approve)); }
function unsignedSale(c){ var mine = c.actor === 'seller' ? 'seller' : 'agent'; return (c.contracts || []).filter(function(k){ return k.kind === 'sale' && k.status === 'pending' && !k.signatures.some(function(s){ return s.kind === 'seller' || s.kind === 'agent'; }); })[0]; }
function pendingMandate(c){ return c.actor === 'seller' && (c.mandates || []).some(function(m){ return !m.signedAt && !m.revokedAt; }); }
function idDoneFor(id){ var c = cases.filter(function(x){ return x.id === id; })[0]; return !c || !c.identity || c.identity.done; }
var IDTYPES = [
  ['menkyo', '運転免許証', '裏面に住所の変更などの記載がある場合は、2枚目に裏面もお送りください。'],
  ['mynumber', 'マイナンバーカード', '表面だけをお送りください。裏面（12桁の個人番号）は撮影・送信しないでください。'],
  ['keireki', '運転経歴証明書', '裏面に住所の変更などの記載がある場合は、2枚目に裏面もお送りください。'],
  ['hoken', '健康保険の資格確認書・保険証', '保険者番号と記号・番号の部分は、紙などで隠して撮影してください。お名前・ご住所・生年月日は隠さないでください。'],
  ['zairyu', '在留カード・特別永住者証明書', '裏面に住居地の記載がある場合は、2枚目に裏面もお送りください。'],
  ['passport', 'パスポート（住所の記載があるもの）', '2020年2月以降に発行されたパスポートには住所を書く欄がないため、ご本人確認に使えません。その場合は他の身分証明書をお選びください。'],
  ['other', 'その他の公的な身分証明書', 'お名前・ご住所・生年月日が記載された、公的機関が発行したものをお送りください。']
];
function idTip(v){ var x = IDTYPES.filter(function(y){ return y[0] === v; })[0]; return x ? x[2] : '種類を選ぶと、撮影の注意が表示されます。'; }
document.addEventListener('change', function(e){
  var f = e.target.closest && e.target.closest('form[data-do=identity]'); if(!f) return;
  if(e.target.name === 'idType'){ var tp = f.querySelector('[data-idtip]'); if(tp) tp.textContent = idTip(e.target.value); }
  if(e.target.name === 'idFront' || e.target.name === 'idBack' || e.target.name === 'idType'){
    var s = f.querySelector('[data-idsel]'), ty = f.querySelector('[name=idType]').value, fr = f.querySelector('[name=idFront]').files[0], bk = f.querySelector('[name=idBack]').files[0];
    if(s){ s.hidden = !(fr || bk); s.textContent = '送信の前にご確認ください：' + (fr ? '1枚目（表面）を選択済み。' : '1枚目（表面）がまだです。') + (bk ? '2枚目（裏面）を選択済み。' : '') + (ty === 'mynumber' && bk ? '※マイナンバーカードの裏面（個人番号）は送らないでください。2枚目を外してください。' : '') + ' ' + idTip(ty); }
  }
});
function tasks(c){
  var T = [], st = c.status, idc = c.identity || {}, pr = c.pickupRequest, pk = c.pickup;
  var mm = c.myMandates || [], live = mm.filter(function(m){ return !m.revokedAt && (!m.validUntil || new Date(m.validUntil) > new Date()); });
  var pendingM = live.filter(function(m){ return !m.signedAt; })[0];
  if(c.actor === 'agent' && !live.length) T.push({ key:'mandate', title: mm.length ? '委任状を作り直して、ご本人に署名を依頼する' : '委任状を作成して、ご本人に署名を依頼する', desc: mm.length ? '前の委任は取り消されたか、期限が切れています。続けてお手続きするには、新しい委任状が必要です。' : 'ご本人の代わりにお手続きするには、委任状が必要です。作成するとご本人にメールで署名をお願いします。' });
  if(c.actor === 'agent' && pendingM && !pendingM.accepted) T.push({ key:'link', title:'受任者として委任状に署名する', desc:'担当者が用意した委任状です。内容をご確認のうえ、受任者として署名してください。', href:'documents' });
  if(c.actor === 'agent' && !idc.agentDone && !idc.agentRequested) T.push({ key:'identity', title:'代理の方ご自身の確認情報を送る', desc:'代理の方の本人確認が済むと、委任が有効になります。' });
  if(c.actor === 'agent' && pendingM) T.push({ key:'wait', title:'ご本人の署名をお待ちください', desc:'ご本人に「委任状のご確認」のメールを送りました。届いていない場合は、受付番号 ' + c.receiptNo + ' をお伝えのうえ、お客様用画面の「契約・書類」から署名いただくようご案内ください。' });
  if(c.actor === 'agent' && live.length && !pendingM && !c.mandateActive && (idc.agentRequested || idc.agentDone)) T.push({ key:'wait', title:'委任が有効になるのをお待ちください', desc:'売主ご本人の委任状への署名と、代理の方の本人確認が済むと、お手続きを進められます。' });
  if(pendingMandate(c)) T.push({ key:'link', title:'委任状に署名する', desc:'代理の方に任せる範囲をご確認のうえ、ご本人が署名してください。', href:'documents' });
  if(c.actor === 'seller' && !idc.done && !idc.requested && EARLY.concat(['goods_received','appraising','appraisal_notified','approved','partially_approved']).indexOf(st) >= 0) T.push({ key:'identity', title:'ご本人確認の情報を送る', desc:'古物営業法により、買取の前にご本人確認が必要です。お名前・ご住所などと、身分証明書の画像（表面。裏面は必要な場合のみ）をお送りください。' });
  if(canPickup(c) && !pr && !pk && EARLY.indexOf(st) >= 0) T.push({ key:'pickup', title:'集荷の方法と日時を選ぶ', desc:'梱包キットのお届け、ご自身での発送、直接集荷のご相談からお選びください。' });
  if(canPickup(c) && pr && (pr.method === 'kit' || pr.method === 'self_ship') && !pr.trackingNo && !(pk && pk.receivedAt)) T.push({ key:'tracking', title:'発送したら伝票番号を入力する', desc: pr.method === 'kit' ? '梱包キットが届いたら、お品物を入れて発送し、伝票番号をお知らせください。' : 'お品物を発送したら、伝票番号をお知らせください。到着を確認しやすくなります。' });
  if(c.appraisal && c.appraisal.status === 'notified' && !expired(c.appraisal)) T.push({ key:'link', title:'査定結果を確認して回答する', desc:'お品物ごとに「売る」か「返却」を選び、そのまま契約まで進めます。回答期限は ' + dt(c.appraisal.expiresAt) + ' です。', href:'result' });
  if(unsignedSale(c) && (c.actor === 'seller' || (c.mandateActive && c.scope && c.scope.sign))) T.push({ key:'link', title:'売買契約書に署名する', desc:'内容をご確認のうえ、電子署名してください。署名後にお振込みします。', href:'documents' });
  if(canBank(c) && ['approved','partially_approved','contracted'].indexOf(st) >= 0 && !(c.bank || []).length) T.push({ key:'bank', title:'振込先の口座を登録する', desc:'原則として売主ご本人（法人の場合は法人）名義の口座です。' });
  if(canDocs(c) && (c.hasDeclined || st === 'return_scheduled' || st === 'declined') && !c.returnRequested) T.push({ key:'return', title:'返却先を確認する', desc:'お売りにならなかったお品物を、送料無料でお返しします。' });
  if(!T.length) T.push({ key:'info', title: waitText(c), desc:'担当者が進めています。ご質問は下の「担当者への連絡」からどうぞ。' });
  return T;
}
function waitText(c){
  var st = c.status, pr = c.pickupRequest, pk = c.pickup;
  if(st === 'paid') return 'お振込みが完了しました' + (c.paid ? '（' + yen(c.paid.amount) + '）' : '');
  if(st === 'closed') return 'お取引は完了しました';
  if(st === 'returned') return 'お品物の返却が完了しました';
  if(st === 'returning') return 'お品物を返却しています';
  if(st === 'cancelled') return 'お取引は取り消されました';
  if(st === 'contracted') return 'お振込みの手続きをしています';
  if(st === 'approved' || st === 'partially_approved') return '売買契約書をご用意しています';
  if(st === 'declined' || st === 'return_scheduled') return 'お品物の返却を準備しています';
  if(st === 'appraising' || st === 'goods_received' || (pk && pk.receivedAt)) return 'お品物を受け取り、査定しています';
  if(pr && pr.trackingNo) return 'お品物の到着をお待ちしています';
  if(pr) return '集荷の手配をしています';
  if(c.identity && c.identity.requested && !c.identity.done) return 'ご住所あてに「転送不要」の簡易書留をお送りします。お受け取りください';
  return 'ご連絡をお待ちください';
}
function field(id, label, input, hint){ return '<div class="field"><label for="' + id + '">' + label + '</label>' + input + (hint ? '<p class="hint">' + hint + '</p>' : '') + '</div>'; }
function inp(id, opt){ opt = opt || {}; return '<input type="' + (opt.type || 'text') + '" id="' + id + '" name="' + id.split('-').pop() + '"' + (opt.req ? ' required' : '') + (opt.ac ? ' autocomplete="' + opt.ac + '"' : '') + (opt.mode ? ' inputmode="' + opt.mode + '"' : '') + ' value="' + esc(opt.val || '') + '">'; }
function taskForm(c, t){
  var id = c.id.slice(0, 8), f = '';
  if(t.key === 'identity') f = '<form class="ptask-f" data-do="identity" novalidate>' + TRIAL_NOTE
    + field(id + '-fullName', 'お名前（住民票どおり）', inp(id + '-fullName', { req:1, ac:'name' }))
    + field(id + '-kana', 'フリガナ', inp(id + '-kana', {}))
    + field(id + '-birthdate', '生年月日', inp(id + '-birthdate', { type:'date', req:1, ac:'bday' }), '18歳未満の方からの買取はお受けできません。')
    + field(id + '-occupation', 'ご職業', inp(id + '-occupation', { req:1, ac:'organization-title' }), '例：会社員、自営業、俳優。古物営業法で確認が必要な項目です。')
    + field(id + '-address', 'ご住所（住民票どおり）', inp(id + '-address', { req:1, ac:'street-address' }), 'ご本人確認のための郵便をお送りします。')
    + field(id + '-tel', '電話番号', inp(id + '-tel', { type:'tel', ac:'tel', mode:'tel' }))
    + '<input type="hidden" name="method" value="mibun_copy_kakitome_koza">'
    + field(id + '-idType', '身分証明書の種類', '<select id="' + id + '-idType" name="idType" required><option value="">選んでください</option>' + IDTYPES.map(function(x){ return '<option value="' + x[0] + '">' + x[1] + '</option>'; }).join('') + '</select>')
    + '<div class="field"><span class="lbl">身分証明書の画像</span>'
    + '<div class="pidnote" data-idnote><b>お送りいただく前に</b><ul><li>有効期限内のものをお送りください。</li><li>お名前・ご住所・生年月日がはっきり読めるよう、四隅まで全体を写してください（光の反射・ぼやけにご注意ください）。</li><li>画像の加工や、一部を切り取ることはしないでください（下の「隠す部分」を除きます）。</li></ul><p data-idtip>種類を選ぶと、撮影の注意が表示されます。</p></div>'
    + '<label for="' + id + '-idFront">1枚目（表面）<span class="req">必須</span></label><input type="file" id="' + id + '-idFront" name="idFront" accept="image/*">'
    + '<label for="' + id + '-idBack" style="margin-top:8px;display:block">2枚目（裏面）<span class="opt">任意</span></label><input type="file" id="' + id + '-idBack" name="idBack" accept="image/*"><p class="hint">裏面は、住所の変更などが裏に書かれている場合にお送りください。画像は担当者だけが確認します。</p>'
    + '<p class="alert" data-idsel hidden></p></div>'
    + '<p class="hint">確認の流れ：①画像をお送りいただく → ②ご住所あてに「転送不要」の簡易書留をお送りします（ご本人またはご家族の方がお受け取りください）→ ③届いたことを確認して完了です。買取代金は、確認したお名前と同じ名義の口座にだけお振込みします。</p>'
    + '<div class="btns"><button class="btn" type="submit">確認情報を送る</button></div></form>';
  if(t.key === 'pickup') f = '<form class="ptask-f" data-do="pickup" novalidate>' + TRIAL_NOTE
    + '<div class="field"><span class="lbl">集荷の方法</span><div class="choices"><label><input type="radio" name="method" value="kit" checked>梱包キットを送ってほしい</label><label><input type="radio" name="method" value="self_ship">自分で梱包して送る</label><label><input type="radio" name="method" value="direct">直接集荷を相談したい</label></div><p class="hint">直接集荷は、お品物や場所に応じて個別にご案内します。送料はG-LOVEが負担します。</p></div>'
    + field(id + '-address', 'お届け先・集荷先のご住所', inp(id + '-address', { req:1, ac:'street-address', val: (c.pref || '') + (c.city || '') }))
    + field(id + '-recipient', 'お受取人のお名前', inp(id + '-recipient', { ac:'name' }), 'マネージャーや事務所の方でも構いません。')
    + field(id + '-tel', '当日の連絡先', inp(id + '-tel', { type:'tel', ac:'tel', mode:'tel' }))
    + '<div class="field"><span class="lbl">ご希望の日時（3つまで）</span><div class="pdates">' + [1,2,3].map(function(n){ return '<div class="pdate"><input type="date" name="d' + n + '" min="' + new Date(Date.now() + 864e5).toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }) + '" aria-label="候補日' + n + '"><select name="t' + n + '" aria-label="時間帯' + n + '"><option value="">時間帯</option><option>午前</option><option>12〜14時</option><option>14〜16時</option><option>16〜18時</option><option>18〜21時</option></select></div>'; }).join('') + '</div></div>'
    + field(id + '-note', 'ご要望', '<textarea id="' + id + '-note" name="note" placeholder="例：送り状の差出人名・品名は伏せてほしい"></textarea>')
    + '<div class="btns"><button class="btn" type="submit">この内容で依頼する</button></div></form>';
  if(t.key === 'tracking') f = '<form class="ptask-f" data-do="tracking" novalidate><div class="row2">'
    + field(id + '-carrier', '配送会社', '<select id="' + id + '-carrier" name="carrier"><option>ヤマト運輸</option><option>佐川急便</option><option>日本郵便</option><option>その他</option></select>')
    + field(id + '-trackingNo', '伝票番号', inp(id + '-trackingNo', { req:1, mode:'numeric' })) + '</div>'
    + '<div class="btns"><button class="btn" type="submit">伝票番号を送る</button></div></form>';
  if(t.key === 'bank') f = '<form class="ptask-f" data-do="bank" novalidate>' + TRIAL_NOTE + '<div class="row2">'
    + field(id + '-bankName', '金融機関', inp(id + '-bankName', { req:1 })) + field(id + '-branchName', '支店', inp(id + '-branchName', { req:1 })) + '</div><div class="row2">'
    + field(id + '-accountType', '種別', '<select id="' + id + '-accountType" name="accountType"><option>普通</option><option>当座</option><option>貯蓄</option></select>')
    + field(id + '-accountNumber', '口座番号', inp(id + '-accountNumber', { req:1, mode:'numeric' }), 'ゆうちょ銀行の場合は、振込用の店名（漢数字3桁）と口座番号（7桁）を入力してください。') + '</div>'
    + field(id + '-holderName', '口座名義（カナ）', inp(id + '-holderName', { req:1 }), 'ご本人と名義が異なる場合は、担当者が確認してからお振込みします。')
    + '<div class="btns"><button class="btn" type="submit">口座を登録する</button></div></form>';
  if(t.key === 'return') f = '<form class="ptask-f" data-do="return" novalidate>' + TRIAL_NOTE
    + field(id + '-address', '返却先のご住所', inp(id + '-address', { req:1, ac:'street-address', val: (c.pref || '') + (c.city || '') }))
    + field(id + '-recipient', 'お受取人のお名前', inp(id + '-recipient', { req:1, ac:'name' }))
    + field(id + '-tel', '電話番号', inp(id + '-tel', { type:'tel', ac:'tel', mode:'tel' }))
    + field(id + '-note', 'ご希望の日時・ご要望', '<textarea id="' + id + '-note" name="note"></textarea>')
    + '<div class="btns"><button class="btn" type="submit">返却先を確定する</button></div></form>';
  if(t.key === 'mandate') f = '<form class="ptask-f" data-do="mandate" novalidate>' + TRIAL_NOTE
    + '<div class="row2">' + field(id + '-agentName', '代理の方のお名前（受任者）', inp(id + '-agentName', { req:1, ac:'name', val: c.applicantName || '' })) + field(id + '-agentOrg', 'ご所属（事務所名）', inp(id + '-agentOrg', { ac:'organization', val: c.agentOrg || '' })) + '</div>'
    + '<div class="row2">' + field(id + '-sellerName', '売主ご本人のお名前', inp(id + '-sellerName', { req:1 })) + field(id + '-sellerEmail', '売主ご本人のメールアドレス', inp(id + '-sellerEmail', { type:'email', req:1 }), c.sellerKnown ? '担当者に登録済みのメールアドレスと同じものを入力してください。' : 'このアドレスに署名のお願いをお送りします。') + '</div>'
    + '<div class="field"><span class="lbl">ご本人から任せていただく範囲</span><div class="choices"><label><input type="checkbox" checked disabled>申込・連絡・日程調整（必ず含みます）</label><label><input type="checkbox" name="pickup" value="1" checked>集荷の立会い・お品物の引渡し</label><label><input type="checkbox" name="documents" value="1" checked>書類の閲覧・受取り</label><label><input type="checkbox" name="approve" value="1">査定額の最終承認</label><label><input type="checkbox" name="sign" value="1">売買契約への署名</label></div><p class="hint">査定額の承認と売買契約への署名は、ご本人が明示的に任せる場合だけ選んでください。</p></div>'
    + field(id + '-validUntil', '委任の期限', inp(id + '-validUntil', { type:'date' }), '空欄の場合は、このお取引の完了までになります。')
    + '<div class="pconfirm"><p class="pmeta">作成される委任状の内容</p><pre class="pbody" data-preview></pre></div>'
    + '<label class="choices" style="display:block"><span style="display:inline-flex;gap:10px;align-items:center"><input type="checkbox" name="agree" value="1"> 上記の内容に同意し、受任者として電子署名します</span></label>'
    + '<div class="btns"><button class="btn" type="submit">署名して、ご本人に署名を依頼する</button></div></form>';
  if(t.key === 'link') f = '<div class="btns"><a class="btn" href="' + PRE + t.href + '/">' + esc(t.title) + '</a></div>';
  return f;
}
function mandatePreview(f, c){
  var g = function(n){ var e = f.querySelector('[name=' + n + ']'); return e ? (e.type === 'checkbox' ? e.checked : e.value.trim()) : ''; };
  var sc = ['申込・連絡・日程調整'].concat(g('pickup') ? ['集荷の立会い・商品の引渡し'] : [], g('approve') ? ['査定額の最終承認'] : [], g('documents') ? ['書類の閲覧・受領'] : [], g('sign') ? ['売買契約への署名'] : []);
  var vu = g('validUntil'); vu = vu ? vu.replace(/^(\d+)-(\d+)-(\d+)$/, '$1年$2月$3日') : '本取引の完了まで';
  return '委任状\n\n私（売主）' + (g('sellerName') || '〇〇') + 'は、受付番号 ' + c.receiptNo + ' の取引に関し、次の者を代理人と定め、下記の権限を委任します。\n\n代理人：' + (g('agentName') || '〇〇') + (g('agentOrg') ? '（' + g('agentOrg') + '）' : '') + '\n委任する権限：' + sc.join('、') + '\n期限：' + vu + '\n\n売主はいつでもこの委任を撤回できます。撤回の時点から、代理人は上記の手続きを行えません。\n代理人による操作はすべて記録され、売主が確認できます。\n代理人は、委任された範囲を超えて手続きを行わず、取引で知り得た情報を第三者に開示しません。';
}
// お客様の操作が必要な「次にやること」
var ACT_KEYS = ['mandate','identity','pickup','tracking','bank','return','link','sign','answer'];
// 画面の下に「次にやること」を常に出す（枠が画面の外にあるときだけ）。押すとその枠へ移動する
var nxObs = null;
function nextBar(){
  var old = document.getElementById('nx-bar'); if(old) old.remove(); document.body.classList.remove('has-nxbar'); if(nxObs){ nxObs.disconnect(); nxObs = null; }
  var card = document.querySelector('.pnav.act'), link = document.querySelector('.pnext a'), title = '';
  if(!card && !link){ var hc = (cases || []).filter(function(c){ return ACT_KEYS.indexOf(tasks(c)[0].key) >= 0; })[0];
    if(!hc) return; link = { href: PRE + 'status/#c-' + hc.id.slice(0, 8) }; title = tasks(hc)[0].title; }
  title = title || (card ? card.dataset.nx : link.textContent.replace(/\s*→.*$/, ''));
  var bar = document.createElement('div'); bar.id = 'nx-bar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', '次にやること');
  bar.innerHTML = '<span class="nx-l">次にやること</span><span class="nx-t">' + esc(title) + '</span><button type="button" class="btn">ここから進む</button>';
  bar.querySelector('button').onclick = function(){ if(card){ card.scrollIntoView({ behavior: 'smooth', block: 'start' }); var f = card.querySelector('input,select,textarea,button'); if(f) setTimeout(function(){ try{ f.focus({ preventScroll: true }); }catch(e){} }, 500); } else location.href = link.href; };
  document.body.appendChild(bar); document.body.classList.add('has-nxbar');
  if(card && 'IntersectionObserver' in window){ nxObs = new IntersectionObserver(function(es){ bar.classList.toggle('hide', es[0].isIntersecting); }, { threshold: 0, rootMargin: '0px 0px -180px 0px' }); nxObs.observe(card); }
}
function navCard(c){
  var T = tasks(c), now = T[0], rest = T.slice(1);
  var act = ACT_KEYS.indexOf(now.key) >= 0, cur = STEP[c.status] || 0;
  return '<section class="pnav ' + (act ? 'act' : 'idle') + '" id="nx-' + c.id.slice(0, 8) + '" data-nx="' + esc(now.title) + '" aria-label="次にやること">'
    + '<p class="nx-badge">' + (act ? '次にやること　<span>お客様の操作が必要です</span>' : '現在の状況') + '</p>'
    + '<h3>' + esc(now.title) + '</h3>'
    + '<p class="nx-step">全' + STEPS.length + '段階のうち <b>' + (cur + 1) + '段階目</b>（' + esc(STEPS[cur]) + '）</p>'
    + '<p>' + esc(now.desc) + '</p>' + taskForm(c, now) + '</section>'
    + (rest.length ? '<div class="prest"><p class="pmeta">このあとのお手続き</p><ul>' + rest.map(function(t){ return '<li>' + esc(t.title) + '</li>'; }).join('') + '</ul></div>' : '');
}
function msgBox(c){
  var ms = c.messages || [];
  return '<h3 class="ph3">担当者への連絡</h3><div class="pmsgs">' + (ms.length ? ms.map(function(m){ var who = m.kind === 'staff' ? 'G-LOVE 担当者' : m.mine ? 'あなた' : (m.kind === 'agent' ? '代理の方' : 'ご本人');
    return '<div class="pm ' + (m.kind === 'staff' ? 'staff' : 'me') + '"><p class="pmeta">' + esc(who) + '　' + dt(m.at) + '</p><p>' + esc(m.body) + '</p></div>'; }).join('') : '<p class="pmeta">まだ連絡はありません。</p>') + '</div>'
    + '<form class="ptask-f" data-do="message" novalidate><div class="field"><label for="m-' + c.id.slice(0, 8) + '">メッセージ</label><textarea id="m-' + c.id.slice(0, 8) + '" name="body" maxlength="2000" required placeholder="ご質問・ご要望をどうぞ。担当者からお返事します。"></textarea><p class="hint">お返事が届くと、メールでお知らせします（メールにはメッセージの内容を載せません）。</p></div><div class="btns"><button class="btn ghost" type="submit">送信する</button></div></form>';
}
// 入力済みの内容（申込・本人確認で入れたお名前・ご住所など）を、空欄に自動で入れる
async function prefill(){
  var arts = document.querySelectorAll('[data-case]');
  for(var i = 0; i < arts.length; i++){
    var art = arts[i]; if(!art.querySelector('form[data-do=identity],form[data-do=pickup],form[data-do=bank],form[data-do=return]')) continue;
    var d = null; try{ d = await GL.rpc('portal_prefill', { p_app: art.dataset.case }); }catch(e){ continue; } if(!d) continue;
    var put = function(sel, v){ var el = art.querySelector(sel); if(el && !el.value && v) el.value = v; };
    put('form[data-do=identity] [name=fullName]', d.fullName); put('form[data-do=identity] [name=kana]', d.kana); put('form[data-do=identity] [name=birthdate]', d.birthdate);
    put('form[data-do=identity] [name=occupation]', d.occupation); put('form[data-do=identity] [name=address]', d.address); put('form[data-do=identity] [name=tel]', d.tel);
    var pa = art.querySelector('form[data-do=pickup] [name=address]'); if(pa && d.address && (!pa.value || d.address.indexOf(pa.value) === 0)) pa.value = d.address;
    put('form[data-do=pickup] [name=recipient]', d.fullName); put('form[data-do=pickup] [name=tel]', d.tel);
    if(!d.company) put('form[data-do=bank] [name=holderName]', d.kana);
    if(d.company) put('form[data-do=identity] [name=occupation]', '会社員（' + d.company + '）');
    var ra = art.querySelector('form[data-do=return] [name=address]'); if(ra && d.address && (!ra.value || d.address.indexOf(ra.value) === 0)) ra.value = d.address;
    put('form[data-do=return] [name=recipient]', d.fullName); put('form[data-do=return] [name=tel]', d.tel);
  }
}
function vStatus(){
  var todo = cases.filter(function(c){ var t = tasks(c)[0]; return ['mandate','identity','pickup','tracking','bank','return','link'].indexOf(t.key) >= 0; });
  var summary = cases.length > 1 ? '<div class="psummary"><p class="eyebrow">本日の状況</p><p>対応が必要なお手続き：<b>' + todo.length + '件</b>（全' + cases.length + '件のお取引）</p>' + (todo.length ? '<ul>' + todo.map(function(c){ return '<li><a href="#c-' + c.id.slice(0, 8) + '">' + esc(c.receiptNo) + '</a>　' + esc(tasks(c)[0].title) + '</li>'; }).join('') + '</ul>' : '') + '</div>' : '';
  $('#pv').innerHTML = summary + cases.map(function(c){
    var cur = STEP[c.status] || 0, out = '<article class="pcase" id="c-' + c.id.slice(0, 8) + '" data-case="' + c.id + '">' + head(c);
    out += '<ol class="psteps">' + STEPS.map(function(s, i){ return '<li class="' + (i < cur ? 'done' : i === cur ? 'now' : '') + '"' + (i === cur ? ' aria-current="step"' : '') + '>' + s + '</li>'; }).join('') + '</ol>';
    out += navCard(c);
    var pr = c.pickupRequest, pk = c.pickup;
    if(pr || pk) out += '<h3 class="ph3">集荷・配送</h3><p class="pmeta">' + (pr ? ({ kit:'梱包キットのお届け', self_ship:'ご自身で発送', direct:'直接集荷のご相談' })[pr.method] + (pr.dates && pr.dates.length ? '　ご希望：' + esc(pr.dates.join('／')) : '') + (pr.trackingNo ? '　発送：' + esc(pr.carrier || '') + ' ' + esc(pr.trackingNo) : '') : '') + (pk && pk.receivedAt ? '<br>G-LOVEがお品物を受け取りました（' + dt(pk.receivedAt) + '）' : '') + '</p>';
    if(c.actor === 'agent' && (c.myMandates || []).length) out += '<h3 class="ph3">委任状</h3><ul class="plog">' + c.myMandates.map(function(m){
      var stx = m.revokedAt ? '撤回されました（' + dt(m.revokedAt) + '）' : (m.validUntil && new Date(m.validUntil) < new Date()) ? '期限切れ' : m.active ? '有効' : !m.signedAt ? 'ご本人の署名待ち' : '代理の方の本人確認待ち';
      return '<li><span>' + (m.via === 'agent' ? 'ご自身で作成' : '担当者が作成') + '</span>' + stx + (m.signedAt ? '（ご本人署名 ' + dt(m.signedAt) + '）' : '') + '</li>'; }).join('') + '</ul>';
    if((c.bank || []).length) out += '<h3 class="ph3">振込先</h3><p class="pmeta">' + c.bank.map(function(b){ return esc(b.bank + ' ' + b.branch + ' ' + b.number + ' ' + b.holder); }).join('<br>') + '</p>';
    if(c.mandates && c.mandates.length){
      out += '<h3 class="ph3">代理の方への委任</h3><div class="tbl-wrap"><table class="tbl"><tbody>' + c.mandates.map(function(m){
        var sc = [m.scope.apply && '申込・連絡', m.scope.pickup && '集荷の立会い', m.scope.approve && '査定額の承認', m.scope.documents && '書類の閲覧', m.scope.sign && '契約の署名'].filter(Boolean).join('、');
        var stx = m.revokedAt ? '撤回済み（' + dt(m.revokedAt) + '）' : !m.signedAt ? 'ご署名待ち' : m.active ? '有効' : '代理の方の確認中';
        return '<tr><th>' + esc(m.agentName) + (m.agentOrg ? '<br><small>' + esc(m.agentOrg) + '</small>' : '') + '</th><td>' + esc(sc) + '<br><small>期限：' + (m.validUntil ? dt(m.validUntil) : 'お取引の完了まで') + '　状態：' + stx + '</small>'
          + (!m.revokedAt ? '<div class="btns" style="margin-top:10px"><button class="btn ghost" type="button" data-revoke="' + m.id + '">' + (m.signedAt ? '委任を取り消す' : 'この委任を断る') + '</button></div>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    }
    if(c.events && c.events.length) out += '<h3 class="ph3">お手続きの記録</h3><ul class="plog">' + c.events.map(function(e){ return '<li><span>' + dt(e.at) + '</span>' + (e.actor === 'agent' ? '代理の方が' : 'ご本人が') + esc(EV[e.kind] || e.kind) + '</li>'; }).join('') + '</ul>';
    var hasNda = (c.contracts || []).some(function(k){ return k.kind === 'nda'; }), askedNda = (c.events || []).some(function(e){ return e.kind === 'nda_requested'; });
    if(!hasNda && (c.actor === 'seller' || c.mandateActive)) out += '<div class="pnda"><h3 class="ph3">秘密保持契約</h3><p class="pmeta">G-LOVE（買主・受付担当会社）が、お取引の内容を守ることを約束する契約です。ご希望の場合は、担当者が当社として署名した契約書をお送りします。「契約・書類」で電子署名すると締結されます。</p>'
      + (askedNda ? '<p class="note">ご希望を承りました。契約書のご用意ができしだい、メールでお知らせします。</p>' : '<div class="btns"><button class="btn ghost" type="button" data-nda>秘密保持契約を希望する</button></div>') + '</div>';
    out += msgBox(c);
    return out + '</article>';
  }).join('');
  prefill();
  // 担当者からの返信を数秒ごとに反映（入力中の内容は消さない）
  if(window.__pmTimer) clearInterval(window.__pmTimer);
  window.__pmTimer = setInterval(async function(){
    if(document.hidden || !document.querySelector('.pmsgs')) return;
    for(var i = 0; i < cases.length; i++){
      var c = cases[i], art = document.querySelector('[data-case="' + c.id + '"]'); if(!art) continue;
      try{ var ms = await GL.rpc('portal_messages', { p_app: c.id, p_after: null });
        if(ms.length !== (c.messages || []).length){ c.messages = ms; var box = art.querySelector('.pmsgs');
          box.outerHTML = msgBox(c).split('<form')[0].replace('<h3 class="ph3">担当者への連絡</h3>', '');
          var nb = art.querySelector('.pmsgs'); if(nb) nb.scrollTop = nb.scrollHeight;
          if(ms.length && ms[ms.length - 1].kind === 'staff') msg('担当者から新しい連絡があります。'); } }catch(e){}
    }
  }, 8000);
  document.querySelectorAll('form[data-do=mandate]').forEach(function(f){
    var c = cases.filter(function(x){ return x.id === f.closest('[data-case]').dataset.case; })[0], pv = f.querySelector('[data-preview]');
    var up = function(){ pv.textContent = mandatePreview(f, c); }; up(); f.addEventListener('input', up); f.addEventListener('change', up);
  });
  $('#pv').onclick = async function(e){
    var nb = e.target.closest('[data-nda]');
    if(nb){ nb.disabled = true; try{ await GL.rpc('portal_request_nda', { p_app: nb.closest('[data-case]').dataset.case }); await load(); msg('秘密保持契約のご希望を担当者へお伝えしました。'); }catch(x){ msg(x.message, true); nb.disabled = false; } return; }
    var b = e.target.closest('[data-revoke]'); if(!b) return;
    if(!b.dataset.sure){ b.dataset.sure = '1'; b.textContent = 'もう一度押すと取り消します'; return; }
    b.disabled = true; try{ await GL.rpc('portal_revoke_mandate', { p_mandate: b.dataset.revoke }); await load(); msg('委任を取り消しました。代理の方はこの時点から手続きを行えません。'); }catch(x){ msg(x.message, true); b.disabled = false; }
  };
  $('#pv').onsubmit = async function(e){
    var f = e.target.closest('form[data-do]'); if(!f) return; e.preventDefault();
    var art = f.closest('[data-case]'), app = art.dataset.case, d = {}, btn = f.querySelector('button[type=submit]');
    new FormData(f).forEach(function(v, k){ d[k] = typeof v === 'string' ? v.trim() : v; });
    var call, done;
    try{
      if(f.dataset.do === 'identity'){
        if(!d.fullName || !d.address || !d.birthdate) throw new Error('お名前・生年月日・ご住所を入力してください');
        var fr = d.idFront && d.idFront.size ? d.idFront : null, bk = d.idBack && d.idBack.size ? d.idBack : null, imgs = [fr, bk].filter(Boolean); delete d.idFront; delete d.idBack;
        if(!d.idType) throw new Error('身分証明書の種類を選んでください');
        if(!fr) throw new Error('1枚目（表面）の画像を選んでください');
        if(d.idType === 'mynumber' && bk) throw new Error('マイナンバーカードの裏面（個人番号）は送らないでください。2枚目の画像を外してから送信してください');
        if(imgs.some(function(x){ return x.size > 8388608; })) throw new Error('画像は1枚8MBまでです');
        btn.dataset.t = btn.textContent; btn.disabled = true; btn.textContent = '画像を送っています…';
        d.files = [];
        for(var k = 0; k < imgs.length; k++){
          var ext = (/png/.test(imgs[k].type) ? 'png' : /webp/.test(imgs[k].type) ? 'webp' : /hei/.test(imgs[k].type) ? 'heic' : 'jpg');
          var path = app + '/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + '-' + (k ? 'ura' : 'omote') + '.' + ext;
          await GL.upload('idcopy', path, imgs[k], true); d.files.push(path);
        }
        call = ['portal_submit_identity', { p_app: app, p: d }]; done = 'ご本人確認の情報と身分証明書の画像を受け付けました。ご住所あてに「転送不要」の簡易書留をお送りしますので、お受け取りください。';
      }
      if(f.dataset.do === 'pickup'){ var dates = [1,2,3].map(function(n){ return d['d' + n] ? d['d' + n] + (d['t' + n] ? ' ' + d['t' + n] : '') : ''; }).filter(Boolean); if(!d.address) throw new Error('ご住所を入力してください'); call = ['portal_request_pickup', { p_app: app, p: { method: d.method, address: d.address, recipient: d.recipient, tel: d.tel, dates: dates, note: d.note } }]; done = '集荷のご依頼を受け付けました。担当者から日程を確定してご連絡します。'; }
      if(f.dataset.do === 'tracking'){ call = ['portal_set_tracking', { p_app: app, p: d }]; done = '伝票番号を受け付けました。到着後に査定を始めます。'; }
      if(f.dataset.do === 'bank'){ if(!/^[0-9]{6,8}$/.test(d.accountNumber || '')) throw new Error('口座番号は6〜8桁の数字で入力してください'); call = ['portal_register_bank', { p_app: app, p: d }]; done = '振込先を登録しました。'; }
      if(f.dataset.do === 'return'){ call = ['portal_return_address', { p_app: app, p: d }]; done = '返却先を受け付けました。発送したらお知らせします。'; }
      if(f.dataset.do === 'mandate'){
        if(!d.agree) throw new Error('「同意し、受任者として電子署名します」にチェックを入れてください');
        if(!d.agentName || !d.sellerName || !d.sellerEmail) throw new Error('代理の方のお名前、売主ご本人のお名前とメールアドレスを入力してください');
        call = ['portal_request_mandate', { p_app: app, p: { agentName: d.agentName, agentOrg: d.agentOrg, sellerName: d.sellerName, sellerEmail: d.sellerEmail, pickup: !!d.pickup, documents: !!d.documents, approve: !!d.approve, sign: !!d.sign, validUntil: d.validUntil ? d.validUntil + 'T23:59:59+09:00' : '', agree: true } }];
        done = '委任状に署名し、ご本人へ署名のお願いを送りました。ご本人の署名と、代理の方の本人確認が済むと委任が有効になります。';
      }
      if(f.dataset.do === 'message'){ if(!d.body) throw new Error('メッセージを入力してください'); call = ['portal_send_message', { p_app: app, p_body: d.body }]; done = '担当者へ送信しました。'; }
      btn.disabled = true;
      await GL.rpc(call[0], call[1]); await load(); msg(done);
      var back = document.getElementById('c-' + app.slice(0, 8)); if(back) back.scrollIntoView({ block:'start' });
    }catch(x){ msg(x.message, true); if(btn){ btn.disabled = false; if(btn.dataset.t) btn.textContent = btn.dataset.t; } }
  };
}

var CHECKS = [
  ['items', '売るお品物と金額を確認しました'],
  ['owner', 'お品物は私の所有物（または処分の権限がある物）で、盗品などではありません'],
  ['genuine', 'お品物は真正品です。偽造品などと判明した場合は、受け取った代金を返還します'],
  ['terms', '売買契約書と利用規約に同意します']
];
function vResult(){
  var list = cases.filter(function(c){ return c.appraisal; });
  if(!list.length){ $('#pv').innerHTML = '<p class="note">査定結果はまだありません。お品物を拝見後、ご連絡します。</p>'; return; }
  $('#pv').innerHTML = list.map(function(c){
    var ap = c.appraisal, open = ap.status === 'notified', allowed = c.actor === 'seller' || (c.mandateActive && c.scope && c.scope.approve), exp = open && expired(ap), canAns = open && allowed && !exp;
    var total = ap.lines.reduce(function(s, l){ return s + l.amount; }, 0);
    var sale = (c.contracts || []).filter(function(k){ return k.kind === 'sale'; }).pop();
    var out = '<article class="pcase" data-ap="' + ap.id + '" data-case="' + c.id + '">' + head(c);
    if(sale && sale.status === 'signed') out += '<div class="pdone"><p class="pdone-t">売買契約が成立しました</p><p>成立日時 ' + dt(sale.signedAt) + '。契約書の控えは「契約・書類」でいつでも確認・保存できます。' + (c.bank && c.bank.length ? 'お振込みの準備ができしだい、お知らせします。' : '<b>続けて、振込先の口座をご登録ください。</b>') + '</p><div class="btns">' + (c.bank && c.bank.length ? '' : '<a class="btn" href="' + PRE + 'status/#c-' + c.id.slice(0, 8) + '">振込先を登録する</a>') + '<a class="btn ghost" href="' + PRE + 'documents/">契約書を見る</a></div></div>';
    out += '<p class="note">査定日 ' + dt(ap.notifiedAt) + (open ? '　お品物ごとに「売る」か「返却」をお選びください。ご回答がない場合に、売却したものとして扱うことはありません。' : '') + '</p>'
      + '<div class="tbl-wrap"><table class="tbl presult"><thead><tr><th>お品物</th><th class="r">数量</th><th class="r">査定額</th><th>ご回答</th></tr></thead><tbody>'
      + ap.lines.map(function(l){ return '<tr><td>' + esc(l.category) + '<br><small>' + esc(l.description) + '</small>' + (l.note ? '<br><small>' + esc(l.note) + '</small>' : '') + '</td><td class="r">' + l.quantity + '</td><td class="r num">' + yen(l.amount) + '</td><td>'
        + (l.decision ? (l.decision === 'approve' ? '売る' : '返却') : canAns ? '<div class="choices"><label><input type="radio" name="d-' + l.id + '" value="approve">売る</label><label><input type="radio" name="d-' + l.id + '" value="decline">返却</label></div>' : '—') + '</td></tr>'; }).join('')
      + '<tr class="ptotal"><td colspan="2" class="r">合計</td><td class="r num">' + yen(total) + '</td><td></td></tr></tbody></table></div>';
    if(canAns) out += '<p class="pmeta">回答期限：' + dt(ap.expiresAt) + '</p><div class="btns" style="margin-top:18px"><button class="btn ghost" type="button" data-all="approve">すべて売る</button><button class="btn ghost" type="button" data-all="decline">すべて返却</button></div>'
      + '<div class="btns" style="margin-top:14px"><button class="btn" type="button" data-check>次へ（内容の確認）</button></div><div class="pconfirm" hidden></div>';
    else if(exp) out += '<p class="alert" style="margin-top:16px">査定額の有効期間（' + dt(ap.expiresAt) + 'まで）が過ぎました。売却をご希望の場合は、担当者にご連絡ください。改めて査定額をご案内します。ご返却の場合は「お手続き」で返却先をお知らせください。</p>';
    else if(open) out += '<p class="alert" style="margin-top:16px">査定額の承認は、ご本人または承認を任された代理の方が行えます。</p>';
    else if(!sale && (c.status === 'approved' || c.status === 'partially_approved')) out += '<p class="note" style="margin-top:16px">ご回答いただきました。' + (ap.offer ? 'ご本人確認が済みしだい、売買契約書をご用意します。' : '売買契約書をご用意しますので、「契約・書類」からご署名ください。') + '</p>'
      + (allowed ? '<div class="pnda"><p class="pmeta">売買契約の成立前であれば、辞退してすべてのお品物を送料無料でお返しすることもできます。</p><div class="btns"><button class="btn ghost" type="button" data-withdraw="' + c.id + '">契約の前に辞退する（すべて返却）</button></div></div>' : '');
    else if(!sale) out += '<p class="note" style="margin-top:16px">ご回答いただきました。ありがとうございました。</p>';
    return out + '</article>';
  }).join('');
  $('#pv').onchange = function(e){
    var art = e.target.closest('[data-ap]'); if(!art) return;
    if(e.target.matches('input[type=radio]')){ var pc = art.querySelector('.pconfirm'); if(pc && !pc.hidden){ pc.hidden = true; pc.innerHTML = ''; art.querySelector('[data-check]').hidden = false; } return; }
    if(e.target.matches('[data-allchk]')) art.querySelectorAll('[data-chk]').forEach(function(x){ x.checked = e.target.checked; });
    if(e.target.matches('[data-chk],[data-allchk]')){
      var all = Array.prototype.every.call(art.querySelectorAll('[data-chk]'), function(x){ return x.checked; });
      var m = art.querySelector('[data-allchk]'); if(m) m.checked = all;
      var b = art.querySelector('[data-close]'); if(b) b.disabled = !all;
    }
  };
  $('#pv').onclick = async function(e){
    var wd = e.target.closest('[data-withdraw]');
    if(wd){ if(!wd.dataset.sure){ wd.dataset.sure = '1'; wd.textContent = 'もう一度押すと辞退します（取り消せません）'; return; } wd.disabled = true;
      try{ await GL.rpc('portal_withdraw', { p_app: wd.dataset.withdraw }); await load(); msg('辞退を承りました。お品物は送料無料でお返しします。「お手続き」で返却先をお知らせください。'); }catch(x){ msg(x.message, true); wd.disabled = false; } return; }
    var art = e.target.closest('[data-ap]'); if(!art) return; var apId = art.dataset.ap, t = e.target;
    var c = list.filter(function(x){ return x.appraisal.id === apId; })[0], lines = c.appraisal.lines, pc = art.querySelector('.pconfirm');
    function picks(){ var d = {}, n = 0, ok = 0, sum = 0; lines.forEach(function(l){ var r = art.querySelector('input[name="d-' + l.id + '"]:checked'); if(r){ d[l.id] = r.value; n++; if(r.value === 'approve'){ ok++; sum += l.amount; } } }); return { d: d, n: n, ok: ok, sum: sum }; }
    if(t.dataset.all){ art.querySelectorAll('input[value=' + t.dataset.all + ']').forEach(function(r){ r.checked = true; }); if(pc && !pc.hidden){ pc.hidden = true; art.querySelector('[data-check]').hidden = false; } return; }
    if(t.hasAttribute('data-check')){
      var p = picks(); if(p.n < lines.length) return msg('すべてのお品物について「売る」か「返却」を選んでください', true);
      msg(''); t.disabled = true;
      try{
        var head2 = '<p class="pconf-sum">売る：<b>' + p.ok + '点（' + yen(p.sum) + '）</b>　返却：' + (lines.length - p.ok) + '点</p>';
        if(!p.ok){
          pc.innerHTML = head2 + '<p>すべてのお品物を返却します。お品物は送料無料でお返しします。</p><div class="btns"><button class="btn" type="button" data-send>この内容で回答する</button><button class="btn ghost" type="button" data-cancel>選び直す</button></div>';
        } else {
          var pv = await GL.rpc('portal_sale_preview', { p_appraisal: apId, p_decisions: p.d });
          if(pv.canClose){
            pc.innerHTML = head2 + '<h3 class="ph3">売買契約書</h3><p class="pmeta">下の契約書を確認し、4つの項目にチェックを入れて「売買契約を締結する」を押すと、電子署名により契約が成立します。</p>'
              + '<pre class="pbody pbody-s">' + esc(pv.body) + '</pre><p class="pmeta">文書の確認値：<span class="mono">' + esc(pv.hash.slice(0, 24)) + '…</span>　利用規約：' + esc(pv.terms) + '　<a href="' + PRE + 'terms/">利用規約を読む</a></p>'
              + '<div class="pchecks">' + CHECKS.map(function(k){ return '<label><input type="checkbox" data-chk="' + k[0] + '"><span>' + esc(k[1]) + '</span></label>'; }).join('')
              + '<label class="pchk-all"><input type="checkbox" data-allchk><span>上の4項目すべてに同意する</span></label></div>'
              + '<div class="btns"><button class="btn" type="button" data-close data-hash="' + esc(pv.hash) + '" disabled>売買契約を締結する（電子署名）</button><button class="btn ghost" type="button" data-cancel>選び直す</button></div>'
              + '<p class="pmeta">署名の日時・署名者・文書の確認値を記録します。返却を選んだお品物は、送料無料でお返しします。</p>';
          } else {
            pc.innerHTML = head2 + '<p class="alert">' + esc(pv.reason) + '</p><div class="btns"><button class="btn" type="button" data-send>回答だけ送る</button><button class="btn ghost" type="button" data-cancel>選び直す</button></div>';
          }
        }
        pc.hidden = false; t.hidden = true; pc.scrollIntoView({ block: 'start' });
      }catch(x){ msg(x.message, true); }
      t.disabled = false; return;
    }
    if(t.hasAttribute('data-cancel')){ pc.hidden = true; pc.innerHTML = ''; art.querySelector('[data-check]').hidden = false; return; }
    if(t.hasAttribute('data-send')){
      t.disabled = true;
      try{ var r = await GL.rpc('portal_respond', { p_appraisal: apId, p_decisions: picks().d }); await load(); msg(r === 'declined' ? 'ご回答を承りました。お品物は送料無料でご返却します。' : !idDoneFor(art.dataset.case) ? 'ご回答を承りました。ご本人確認が済みしだい、売買契約書をご用意します（ご本人確認の情報がまだの場合は「お手続き」からお送りください）。' : 'ご回答を承りました。売買契約書をご用意しますので、「契約・書類」からご署名ください。'); }
      catch(x){ msg(x.message, true); t.disabled = false; }
    }
    if(t.hasAttribute('data-close')){
      var ch = {}; art.querySelectorAll('[data-chk]').forEach(function(x){ ch[x.dataset.chk] = x.checked; });
      t.disabled = true; t.textContent = '締結しています…';
      try{ await GL.rpc('portal_accept', { p_appraisal: apId, p_decisions: picks().d, p_hash: t.dataset.hash, p_checks: ch }); await load(); msg('売買契約が成立しました。契約書の控えは「契約・書類」に保存されています。'); }
      catch(x){ msg(x.message, true); t.disabled = false; t.textContent = '売買契約を締結する（電子署名）'; }
    }
  };
}

function vDocs(){
  var any = false;
  $('#pv').innerHTML = cases.map(function(c){
    if(!c.contracts || !c.contracts.length) return '';
    any = true;
    return '<article class="pcase">' + head(c) + c.contracts.map(function(k){
      var mine = c.actor === 'seller' ? 'seller' : 'agent', signed = k.signatures.some(function(s){ return s.kind === mine || (k.kind !== 'mandate' && (s.kind === 'seller' || s.kind === 'agent')); });
      var canSign = k.status === 'pending' && !signed && (k.kind === 'mandate' ? (c.actor === 'seller' || (c.actor === 'agent' && (c.myMandates || []).some(function(m){ return m.id === k.mandateId; }))) : (c.actor === 'seller' || (c.mandateActive && c.scope && c.scope.sign)));
      return '<section class="pdoc" data-k="' + k.id + '" data-case="' + c.id + '"><h3 class="ph3">' + esc(CK[k.kind] || k.title) + '</h3>'
        + '<p class="pmeta">' + esc(k.title) + '　作成 ' + dt(k.createdAt) + '　' + (k.status === 'signed' ? '締結済み ' + dt(k.signedAt) : '署名待ち') + '<br>文書の確認値：<span class="mono">' + esc(k.hash.slice(0, 24)) + '…</span>　' + (k.intact ? '改ざんは検出されていません' : '<strong>改ざんの疑いがあります。担当者にご連絡ください</strong>') + '</p>'
        + '<pre class="pbody">' + esc(k.body) + '</pre>'
        + '<p class="pmeta">署名：' + (k.signatures.map(function(s){ return ({ seller: k.kind === 'mandate' ? '売主（委任者）' : '売主', agent: k.kind === 'mandate' ? '代理人（受任者）' : '代理人', buyer: k.kind === 'nda' ? '当社（G-LOVE）' : '買主（株式会社グローブ）' })[s.kind] + (s.basis === 'offer' ? '（査定通知による申込み）' : '') + ' ' + dt(s.at); }).join('／') || 'まだありません') + '</p>'
        + '<div class="btns no-print"><button class="btn ghost" type="button" data-print>印刷・PDFで保存</button></div>'
        + (canSign && k.intact ? '<div class="psign no-print"><label class="choices" style="display:block"><span style="display:inline-flex;gap:10px;align-items:center"><input type="checkbox" data-agree> 上記の内容を確認し、同意のうえ署名します</span></label><div class="btns"><button class="btn" type="button" data-sign data-hash="' + esc(k.hash) + '" data-kind="' + k.kind + '" data-mandate="' + esc(k.mandateId || '') + '" disabled>' + (k.kind === 'mandate' && c.actor === 'agent' ? '受任者として電子署名する' : '電子署名する') + '</button></div></div>' : '')
        + '</section>'; }).join('') + '</article>';
  }).join('');
  if(!any){ $('#pv').innerHTML = '<p class="note">ご確認いただく書類はまだありません。</p>'; return; }
  $('#pv').onchange = function(e){ if(e.target.matches('[data-agree]')) e.target.closest('.psign').querySelector('[data-sign]').disabled = !e.target.checked; };
  $('#pv').onclick = async function(e){
    var t = e.target, sec = t.closest('.pdoc'); if(!sec) return;
    if(t.hasAttribute('data-print')){ document.querySelectorAll('.pdoc').forEach(function(s){ s.classList.toggle('print-hide', s !== sec); }); try{ window.print(); }catch(x){} return; }
    if(t.hasAttribute('data-sign')){
      t.disabled = true;
      try{
        if(t.dataset.kind === 'mandate') await GL.rpc('portal_sign_mandate', { p_mandate: t.dataset.mandate, p_hash: t.dataset.hash });
        else await GL.rpc('portal_sign', { p_contract: sec.dataset.k, p_hash: t.dataset.hash });
        await load(); msg('署名しました。署名の日時と文書の確認値を記録しました。');
      }catch(x){ msg(x.message, true); t.disabled = false; }
    }
  };
}

// メールのボタンが同じタブで開かれたとき（アドレスの # だけが変わる）
window.addEventListener('hashchange', function(){ var r = GL.fromLink(); if(!r) return; if(r.error){ viewLogin(); msg(r.error, true); } else enter().catch(function(e){ msg(e.message, true); }); });
// 別のタブでログインが済んだら、この画面もそのまま開く（「メールを送りました」の画面で待っている場合）
window.addEventListener('storage', function(e){ if(e.key !== 'gl-portal' || !e.newValue || $('#pv')) return; GL.useStore('gl-portal', true); if(GL.session) enter().catch(function(x){ msg(x.message, true); }); });
var back = GL.configured ? GL.fromLink() : null;
if(back && back.error){ viewLogin(); msg(back.error, true); }
else if(GL.session){ (back ? enter() : load()).catch(function(e){ GL.signOut(); viewLogin(); msg(e.message, true); }); } else viewLogin();
})();
