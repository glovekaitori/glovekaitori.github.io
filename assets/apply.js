(function(){
  var C=window.GLOVE_CONFIG||{};
  var form=document.getElementById('applyForm');
  if(!form) return;
  var vInput=document.getElementById('view-input'),vConfirm=document.getElementById('view-confirm'),
      vDone=document.getElementById('view-done'),vFail=document.getElementById('view-fail');
  var steps=document.querySelectorAll('.progress li');
  var photos=[];

  // 紹介コードの引継ぎ（招待確認ページから）
  try{var q=new URLSearchParams(location.search).get('code'); if(q) form.code.value=q.slice(0,32);}catch(e){}

  // 代理人・法人担当者のときだけ表示する項目
  function syncRole(){
    var r=form.querySelector('input[name=role]:checked');
    document.getElementById('agentBox').hidden=!(r&&r.value!=='本人');
    if(typeof renumber==='function')renumber();
  }
  form.querySelectorAll('input[name=role]').forEach(function(x){x.addEventListener('change',syncRole)});

  // 写真（任意）：何回かに分けて選べる。1枚ずつ外せる。お申込みと同時に送信
  var pin=document.getElementById('photos'),th=document.getElementById('thumbs'),perr=document.getElementById('photoErr'),pcount=document.getElementById('photoCount');
  function drawPhotos(){
    th.innerHTML='';
    photos.forEach(function(f,i){
      var w=document.createElement('span');w.className='thumb';
      var im=document.createElement('img');im.alt='選んだ写真'+(i+1);im.src=URL.createObjectURL(f);w.appendChild(im);
      var x=document.createElement('button');x.type='button';x.className='thumb-x';x.setAttribute('aria-label','この写真を外す');x.textContent='×';
      x.onclick=function(){photos.splice(i,1);drawPhotos();};w.appendChild(x);th.appendChild(w);
    });
    pcount.hidden=!photos.length;pcount.textContent=photos.length?'選んだ写真：'+photos.length+'枚（あと'+Math.max(0,C.maxPhotos-photos.length)+'枚まで追加できます）':'';
    var nb=form.querySelector('[data-none=photos]');if(nb&&photos.length){nb.checked=false;}
    document.querySelector('.photo-drop .pd-main').textContent=photos.length?'写真を追加する':'写真を撮る・選ぶ';
  }
  pin.addEventListener('change',function(){
    perr.textContent='';
    Array.prototype.slice.call(pin.files||[]).forEach(function(f){
      if(photos.length>=C.maxPhotos){perr.textContent='写真は'+C.maxPhotos+'枚までです。';return;}
      if(!/^image\//.test(f.type)){perr.textContent='画像ファイルを選んでください。';return;}
      if(f.size>C.maxPhotoMB*1048576){perr.textContent='1枚あたり'+C.maxPhotoMB+'MBまでです。';return;}
      photos.push(f);
    });
    pin.value='';drawPhotos();
  });

  // 任意の項目：「なし」にチェックすると入力欄を閉じる。入力を始めるとチェックを外す
  form.querySelectorAll('[data-none]').forEach(function(cb){
    var k=cb.dataset.none,inp=document.getElementById(k);
    cb.addEventListener('change',function(){
      if(k==='photos'){if(cb.checked){photos=[];drawPhotos();cb.checked=true;}}
      else if(inp){if(cb.checked)inp.value='';inp.disabled=cb.checked;}
      var er=document.getElementById('err-'+k);if(er&&cb.checked)er.textContent='';
    });
    if(inp&&k!=='photos')inp.addEventListener('input',function(){if(inp.value.trim())cb.checked=false;});
  });
  function isNone(k){var cb=form.querySelector('[data-none='+k+']');return !!(cb&&cb.checked);}

  // 項目に通し番号を付ける（表示されている項目だけ）
  function renumber(){
    var n=0;
    form.querySelectorAll('fieldset[data-step] .field').forEach(function(f){
      var box=f.closest('#agentBox');var vis=!(box&&box.hidden);
      var lb=f.querySelector(':scope > label[for], :scope > .lbl');if(!lb)return;
      var no=lb.querySelector('.fno');
      if(!vis){if(no)no.remove();return;}
      n++;if(!no){no=document.createElement('span');no.className='fno';lb.insertBefore(no,lb.firstChild);}
      no.textContent=n;
    });
  }

  function val(n){var e=form.elements[n];if(!e)return'';if(e.length&&e[0]&&e[0].type==='radio'){var c=form.querySelector('input[name='+n+']:checked');return c?c.value:'';}return (e.value||'').trim();}
  function vals(n){return Array.prototype.map.call(form.querySelectorAll('input[name='+n+']:checked'),function(x){return x.value});}

  function collect(){
    return {
      role:val('role'), name:val('name'), agentOrg:val('agentOrg'), relation:val('relation'),
      tel:val('tel'), email:val('email'), contactWay:val('contactWay'), code:val('code'),
      categories:vals('cat'), summary:val('summary'), qty:val('qty'), photoCount:photos.length,
      pref:val('pref'), city:val('city'), handover:val('handover'), pickupWay:val('pickupWay'),
      wish:val('wish'), note:((QUICK&&QUICK.on&&QUICK.mark)?QUICK.mark+(val('note')?'\n'+val('note'):''):val('note'))
    };
  }
  var labels=[['photoCount','写真'],['categories','お品物の種類'],['summary','お品物の概要'],['qty','おおよその点数'],['role','申込者区分'],['name','お名前・法人名'],['agentOrg','ご所属'],['relation','売主様との関係'],['email','メールアドレス'],['contactWay','ご希望の連絡方法'],['tel','電話番号'],['code','紹介コード'],['pref','集荷希望地（都道府県）'],['city','集荷希望地（市区町村）'],['handover','お品物をお渡しになる方'],['pickupWay','ご希望の集荷方法'],['wish','ご希望の日時'],['note','その他のご要望']];

  function check(d){
    var e={};
    if(!d.role)e.role='申込者区分を選んでください。';
    if(!d.name)e.name='お名前または法人名を入力してください。';
    if(!d.email)e.email='メールアドレスを入力してください（受付番号のお知らせとログインに使います）。';
    else if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email))e.email='メールアドレスの形式をご確認ください。';
    if(d.tel&&!/^[0-9\-+() ]{10,16}$/.test(d.tel))e.tel='電話番号は数字とハイフンで入力してください。';
    if(!d.contactWay)e.contactWay='ご希望の連絡方法を選んでください。';
    if((d.contactWay==='電話'||d.contactWay==='ショートメッセージ')&&!d.tel)e.tel='「'+d.contactWay+'」でのご連絡には、電話番号が必要です。';
    if(!d.qty)e.qty='おおよその点数を選んでください（わからない場合は「わからない」）。';
    if(!d.handover)e.handover='お品物をお渡しになる方を選んでください（決まっていない場合は「未定」）。';
    if(!d.pickupWay)e.pickupWay='ご希望の集荷方法を選んでください（迷う場合は「相談して決めたい」）。';
    var NONE={photos:['写真を選ぶか、「写真は送らない」','photoCount'],summary:['概要を入力するか、「わからない・書かない」','summary'],agentOrg:['ご所属を入力するか、「なし・書かない」','agentOrg'],relation:['ご関係を入力するか、「書かない」','relation'],tel:['電話番号を入力するか、「電話番号は伝えない」','tel'],code:['紹介コードを入力するか、「紹介コードなし」','code'],city:['市区町村を入力するか、「書かない」','city'],wish:['ご希望を入力するか、「特になし」','wish'],note:['ご要望を入力するか、「特になし」','note']};
    Object.keys(NONE).forEach(function(k){
      if((k==='agentOrg'||k==='relation')&&d.role==='本人')return;
      if(e[k])return;
      var v=d[NONE[k][1]];if(!v&&!isNone(k))e[k]=NONE[k][0]+'にチェックしてください。';
    });
    if(!d.categories.length)e.cat='お品物の種類を1つ以上選んでください。';
    if(!d.pref)e.pref='集荷希望地の都道府県を選んでください。';
    if(!form.adult.checked)e.agree='売主が18歳以上であることをご確認ください。';
    else if(!form.noAntisocial.checked)e.agree='反社会的勢力に当たらないことをご確認ください。';
    else if(!form.agree.checked)e.agree='利用規約と個人情報の取扱いへの同意が必要です。';
    return e;
  }
  function showErr(e){
    form.querySelectorAll('.err').forEach(function(x){x.textContent=''});
    Object.keys(e).forEach(function(k){var t=document.getElementById('err-'+k);if(t)t.textContent=e[k];var inp=document.getElementById(k);if(inp)inp.setAttribute('aria-invalid','true');});
    var f=Object.keys(e)[0];if(f){var t=document.getElementById('err-'+f);if(t)t.scrollIntoView({block:'center'});var fi=document.getElementById(f)||document.querySelector('[name='+f+']');if(fi&&fi.focus)try{fi.focus({preventScroll:true});}catch(x){}}
  }
  function go(n){
    [vInput,vConfirm,vDone,vFail].forEach(function(v){v.hidden=true});
    ({1:vInput,2:vConfirm,3:vDone,4:vFail})[n].hidden=false;
    steps.forEach(function(s,i){s.classList.toggle('done',i<Math.min(n,3)-1);s.toggleAttribute('aria-current',false);if(i===Math.min(n,3)-1)s.setAttribute('aria-current','step');});
    window.gloveTop(document.querySelector('.progress'));
  }

  // ── 4段階の入力（1画面に1つずつ） ──
  var sets=Array.prototype.slice.call(form.querySelectorAll('fieldset[data-step]')),final=form.querySelector('[data-final]'),step=1;
  var STEPKEYS={1:['photos','cat','summary','qty'],2:['role','name','agentOrg','relation'],3:['email','contactWay','tel','code'],4:['pref','city','handover','pickupWay','wish','note','agree']};
  var bar=document.createElement('div');bar.className='wstep';bar.setAttribute('aria-live','polite');form.insertBefore(bar,form.firstChild);
  sets.forEach(function(fs,i){
    var nav=document.createElement('div');nav.className='btns wnav';
    if(i>0){var bk=document.createElement('button');bk.type='button';bk.className='btn ghost';bk.textContent='戻る';bk.onclick=function(){show(step-1);};nav.appendChild(bk);}
    if(i<sets.length-1){var nx=document.createElement('button');nx.type='button';nx.className='btn';nx.textContent='次へ（'+sets[i+1].dataset.title+'）';nx.onclick=function(){next();};nav.appendChild(nx);}
    // 最後の画面の「戻る」は、いちばん下の「入力内容を確認する」の横に置く
    if(i===sets.length-1){var fb=final.querySelector('.btns');if(fb&&nav.firstChild)fb.insertBefore(nav.firstChild,fb.firstChild);return;}
    fs.appendChild(nav);
  });
  var QUICK=null; // リピーターのかんたんお申込み（前回の内容）
  function show(n){
    if(QUICK&&QUICK.on&&n>1&&n<sets.length) n=(step===1?sets.length:1);
    step=Math.max(1,Math.min(sets.length,n));
    var qs=document.getElementById('quickSum'); if(qs) qs.hidden=!(QUICK&&QUICK.on&&step===sets.length);
    sets.forEach(function(fs){fs.hidden=Number(fs.dataset.step)!==step;});
    final.hidden=step!==sets.length;
    bar.innerHTML='<span class="wnum">入力 '+step+' / '+sets.length+'</span><span class="wname">'+sets[step-1].dataset.title+'</span><span class="wbar"><i style="width:'+(step/sets.length*100)+'%"></i></span>';
    window.gloveTop(bar);
    var lg=sets[step-1].querySelector('legend');if(lg&&step>1){lg.setAttribute('tabindex','-1');try{lg.focus({preventScroll:true});}catch(x){lg.focus();}}
  }
  function stepErrors(n,e){var o={};(STEPKEYS[n]||[]).forEach(function(k){if(e[k])o[k]=e[k];});if(n===3&&e.email)o.email=e.email;return o;}
  function next(){
    var e=stepErrors(step,check(collect()));
    if(step===4)delete e.agree;
    form.querySelectorAll('.err').forEach(function(x){x.textContent='';});
    Object.keys(e).forEach(function(k){var t=document.getElementById('err-'+k);if(t)t.textContent=e[k];});
    if(Object.keys(e).length){var f=document.getElementById('err-'+Object.keys(e)[0]);if(f)f.scrollIntoView({block:'center'});return;}
    show(step+1);
  }
  syncRole();renumber();
  show(1);

  // ── リピーターのお客様：前回のお申込みの内容を使って、入力を省略する ──
  //   この端末でお手続き画面にログインしている場合だけ。お品物（1/4）を入れたら、すぐ最後（集荷・同意）へ進む
  (async function(){
    var saved=null; try{saved=localStorage.getItem('gl-portal');}catch(e){}
    if(!saved||!window.GL||!GL.configured) return;
    var r=null; try{ GL.useStore('gl-portal',true); if(!GL.session) return; r=await GL.rpc('portal_repeat_info',{}); }catch(e){ return; }
    if(!r||!r.name) return;
    var setV=function(n,v){ v=v==null?'':String(v); var els=form.querySelectorAll('[name='+n+']'); if(!els.length) return;
      if(els[0].type==='radio'){ els.forEach(function(x){ x.checked=(x.value===v); }); }
      else { els[0].disabled=false; els[0].value=v; }
      var none=form.querySelector('[data-none='+n+']'); if(none){ none.checked=!v; none.dispatchEvent(new Event('change',{bubbles:true})); } };
    var apply_=function(){ ['role','name','agentOrg','relation','email','tel','contactWay','pref','city','handover','pickupWay'].forEach(function(k){ setV(k,r[k]); }); if(!form.code.value) setV('code',''); syncRole(); renumber(); };
    var d0=r.createdAt?new Date(r.createdAt).toLocaleDateString('ja-JP',{timeZone:'Asia/Tokyo'}):'';
    var box=document.createElement('div'); box.className='quick-box';
    box.innerHTML='<p class="quick-h">おかえりなさいませ。<b>'+esc_(r.name)+'</b> 様</p><p>前回のお申込み（受付番号 '+esc_(r.receiptNo)+'・'+d0+'）の「お申込みの方・ご連絡先・集荷先」を使って、入力を省略できます。<br>お品物の写真と種類を入れたら、すぐ最後の確認へ進みます。</p><label class="quick-sw"><input type="checkbox" id="quickOn" checked> 前回の内容を使う（かんたんお申込み）</label>';
    form.insertBefore(box, bar.nextSibling);
    var sum=document.createElement('div'); sum.id='quickSum'; sum.className='quick-sum'; sum.hidden=true;
    var last=sets[sets.length-1]; last.insertBefore(sum,last.firstChild);
    var drawSum=function(){ var d=collect(); sum.innerHTML='<p class="quick-h">前回と同じ内容で申し込みます</p><dl><dt>お申込みの方</dt><dd>'+esc_(d.name)+'（'+esc_(d.role)+'）'+(d.agentOrg?'　'+esc_(d.agentOrg):'')+'</dd><dt>ご連絡先</dt><dd>'+esc_(d.email)+(d.tel?'／'+esc_(d.tel):'')+'（'+esc_(d.contactWay)+'）</dd></dl><button type="button" class="btn ghost" id="quickEdit">お申込みの方・ご連絡先を変更する</button>';
      document.getElementById('quickEdit').onclick=function(){ QUICK.on=false; document.getElementById('quickOn').checked=false; show(2); }; };
    QUICK={on:true,info:r};
    apply_(); drawSum();
    var nt=form.elements.note; QUICK.mark='【リピーター：前回 '+r.receiptNo+'】';
    document.getElementById('quickOn').onchange=function(e){ QUICK.on=e.target.checked; if(QUICK.on){ apply_(); drawSum(); } };
    form.addEventListener('input',function(){ if(QUICK.on&&step===sets.length) drawSum(); });
    // 1/4 の「次へ」を「最後の確認へ」に
    var nb=sets[0].querySelector('.wnav .btn:not(.ghost)'); if(nb){ QUICK.nbText=nb.textContent; var sync=function(){ nb.textContent=QUICK.on?'次へ（前回の内容で、最後の確認へ）':QUICK.nbText; }; sync(); document.getElementById('quickOn').addEventListener('change',sync); }
  })();
  function esc_(t){return String(t==null?'':t).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}

  var current=null;
  form.addEventListener('submit',function(ev){
    ev.preventDefault();
    if(step<sets.length){next();return;}
    var d=collect(),e=check(d);showErr(e);
    if(Object.keys(e).length){for(var n=1;n<=sets.length;n++){if(Object.keys(stepErrors(n,e)).length){if(QUICK&&QUICK.on&&n>1&&n<sets.length){QUICK.on=false;var qo=document.getElementById('quickOn');if(qo)qo.checked=false;}show(n);showErr(e);break;}}return;}
    if(Object.keys(e).length)return;
    current=d;
    var tb=document.getElementById('confirmBody');tb.innerHTML='';
    labels.forEach(function(p){
      var v=d[p[0]];if(p[0]==='photoCount')v=v?v+'枚（お申込みと同時に送信します）':'なし';
      if(Array.isArray(v))v=v.join('、');
      if(!v&&(p[0]==='agentOrg'||p[0]==='relation')&&d.role==='本人')return;
      var tr=document.createElement('tr'),th=document.createElement('th'),td=document.createElement('td');
      th.textContent=p[1];td.textContent=v||(isNone(p[0]==='photoCount'?'photos':p[0])?'なし':'（未入力）');tr.appendChild(th);tr.appendChild(td);tb.appendChild(tr);
    });
    go(2);
  });
  document.getElementById('backBtn').addEventListener('click',function(){go(1);show(sets.length);});
  document.getElementById('sendBtn').addEventListener('click',async function(){
    var b=this;b.disabled=true;b.textContent='送信しています';
    var payload=Object.assign({},current,{agree:true,adult:true,noAntisocial:true,website:form.website.value});
    delete payload.photoCount;
    var r=await window.gloveCall('submit_application',{p:payload});
    if(r.ok&&r.data&&r.data.receiptNo){
      document.getElementById('receiptNo').textContent=r.data.receiptNo;
      try{sessionStorage.setItem('gl-receipt',r.data.receiptNo);if(current.email)localStorage.setItem('gl-mail',String(current.email).trim().toLowerCase());}catch(x){}
      var pn=document.getElementById('photoNote');pn.textContent='';
      if(photos.length){
        b.textContent='写真を送信しています';var okN=0;
        for(var i=0;i<photos.length;i++){
          var f=photos[i],ext=((f.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z]/g,''))||'jpg';
          if(!/^(jpg|jpeg|png|webp|heic)$/.test(ext))ext='jpg';
          try{await GL.upload('intake',r.data.uploadToken+'/'+(i+1)+'-'+Date.now()+'.'+ext,f);okN++;}catch(e){}
        }
        pn.textContent=okN===photos.length?'写真'+okN+'枚も受け付けました。':'写真'+(photos.length-okN)+'枚は送信できませんでした。担当者から別の方法をご案内します。';
      }
      // この端末だけ、ログインなしでお手続き画面に入れるようにする（見られるのは、いま申し込んだ案件だけ）
      var direct=false;
      if(r.data.claimToken){
        b.textContent='お手続き画面を準備しています';
        try{ GL.useStore('gl-portal',true); if(!GL.session) await GL.signInAnon(); await GL.rpc('portal_claim_token',{p_receipt:r.data.receiptNo,p_token:r.data.claimToken}); direct=true; }catch(e){ direct=false; }
      }
      document.getElementById('doneDirect').hidden=!direct; document.getElementById('doneMail').hidden=direct;
      b.disabled=false;b.textContent='この内容で申し込む';
      form.reset();form.querySelectorAll('input:disabled,textarea:disabled').forEach(function(x){x.disabled=false;});photos=[];drawPhotos();current=null;show(1);go(3);
    }else{
      b.disabled=false;b.textContent='この内容で申し込む';
      document.getElementById('failReason').textContent=
        r.reason==='unconfigured'?'現在、受付システムの接続準備中のため、お申込みは送信されていません。':
        r.reason==='network'?'通信に失敗したため、お申込みは送信されていません。電波の状況をご確認のうえ、再度お試しください。':
        'お申込みは送信されていません。'+(r.message||'');
      go(4);
    }
  });
  document.getElementById('retryBtn').addEventListener('click',function(){go(2)});
})();
