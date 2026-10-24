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
  }
  form.querySelectorAll('input[name=role]').forEach(function(x){x.addEventListener('change',syncRole)});
  syncRole();

  // 写真（任意）：この端末内で縮小表示するだけ。送信は受付システム接続後
  var pin=document.getElementById('photos'),th=document.getElementById('thumbs'),perr=document.getElementById('photoErr');
  pin.addEventListener('change',function(){
    perr.textContent='';photos=[];th.innerHTML='';
    var fs=Array.prototype.slice.call(pin.files||[]);
    if(fs.length>C.maxPhotos){perr.textContent='写真は'+C.maxPhotos+'枚までです。';fs=fs.slice(0,C.maxPhotos);}
    fs.forEach(function(f){
      if(!/^image\//.test(f.type)){perr.textContent='画像ファイルを選んでください。';return;}
      if(f.size>C.maxPhotoMB*1048576){perr.textContent='1枚あたり'+C.maxPhotoMB+'MBまでです。';return;}
      photos.push(f);var im=document.createElement('img');im.alt='選択した写真';im.src=URL.createObjectURL(f);th.appendChild(im);
    });
  });

  function val(n){var e=form.elements[n];if(!e)return'';if(e.length&&e[0]&&e[0].type==='radio'){var c=form.querySelector('input[name='+n+']:checked');return c?c.value:'';}return (e.value||'').trim();}
  function vals(n){return Array.prototype.map.call(form.querySelectorAll('input[name='+n+']:checked'),function(x){return x.value});}

  function collect(){
    return {
      role:val('role'), name:val('name'), agentOrg:val('agentOrg'), relation:val('relation'),
      tel:val('tel'), email:val('email'), contactWay:val('contactWay'), code:val('code'),
      categories:vals('cat'), summary:val('summary'), qty:val('qty'), photoCount:photos.length,
      pref:val('pref'), city:val('city'), handover:val('handover'), pickupWay:val('pickupWay'),
      wish:val('wish'), note:val('note')
    };
  }
  var labels=[['role','申込者区分'],['name','お名前・法人名'],['agentOrg','ご所属'],['relation','売主様との関係'],['tel','電話番号'],['email','メールアドレス'],['contactWay','ご希望の連絡方法'],['code','紹介コード'],['categories','お品物の種類'],['summary','お品物の概要'],['qty','おおよその点数'],['photoCount','写真'],['pref','集荷希望地（都道府県）'],['city','集荷希望地（市区町村）'],['handover','お品物をお渡しになる方'],['pickupWay','ご希望の集荷方法'],['wish','ご希望の日時'],['note','その他のご要望']];

  function check(d){
    var e={};
    if(!d.role)e.role='申込者区分を選んでください。';
    if(!d.name)e.name='お名前または法人名を入力してください。';
    if(!d.email)e.email='メールアドレスを入力してください（受付番号のお知らせとログインに使います）。';
    else if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email))e.email='メールアドレスの形式をご確認ください。';
    if(d.tel&&!/^[0-9\-+() ]{10,16}$/.test(d.tel))e.tel='電話番号は数字とハイフンで入力してください。';
    if(!d.contactWay)e.contactWay='ご希望の連絡方法を選んでください。';
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
  var STEPKEYS={1:['role','name'],2:['email','tel','contactWay'],3:['cat'],4:['pref','agree']};
  var bar=document.createElement('div');bar.className='wstep';bar.setAttribute('aria-live','polite');form.insertBefore(bar,form.firstChild);
  sets.forEach(function(fs,i){
    var nav=document.createElement('div');nav.className='btns wnav';
    if(i>0){var bk=document.createElement('button');bk.type='button';bk.className='btn ghost';bk.textContent='戻る';bk.onclick=function(){show(step-1);};nav.appendChild(bk);}
    if(i<sets.length-1){var nx=document.createElement('button');nx.type='button';nx.className='btn';nx.textContent='次へ（'+sets[i+1].dataset.title+'）';nx.onclick=function(){next();};nav.appendChild(nx);}
    fs.appendChild(nav);
  });
  function show(n){
    step=Math.max(1,Math.min(sets.length,n));
    sets.forEach(function(fs){fs.hidden=Number(fs.dataset.step)!==step;});
    final.hidden=step!==sets.length;
    bar.innerHTML='<span class="wnum">入力 '+step+' / '+sets.length+'</span><span class="wname">'+sets[step-1].dataset.title+'</span><span class="wbar"><i style="width:'+(step/sets.length*100)+'%"></i></span>';
    window.gloveTop(bar);
    var lg=sets[step-1].querySelector('legend');if(lg&&step>1){lg.setAttribute('tabindex','-1');try{lg.focus({preventScroll:true});}catch(x){lg.focus();}}
  }
  function stepErrors(n,e){var o={};(STEPKEYS[n]||[]).forEach(function(k){if(e[k])o[k]=e[k];});if(n===2&&e.email)o.email=e.email;return o;}
  function next(){
    var e=stepErrors(step,check(collect()));
    if(step===4)delete e.agree;
    form.querySelectorAll('.err').forEach(function(x){x.textContent='';});
    Object.keys(e).forEach(function(k){var t=document.getElementById('err-'+k);if(t)t.textContent=e[k];});
    if(Object.keys(e).length){var f=document.getElementById('err-'+Object.keys(e)[0]);if(f)f.scrollIntoView({block:'center'});return;}
    show(step+1);
  }
  show(1);

  var current=null;
  form.addEventListener('submit',function(ev){
    ev.preventDefault();
    if(step<sets.length){next();return;}
    var d=collect(),e=check(d);showErr(e);
    if(Object.keys(e).length){for(var n=1;n<=sets.length;n++){if(Object.keys(stepErrors(n,e)).length){show(n);showErr(e);break;}}return;}
    if(Object.keys(e).length)return;
    current=d;
    var tb=document.getElementById('confirmBody');tb.innerHTML='';
    labels.forEach(function(p){
      var v=d[p[0]];if(p[0]==='photoCount')v=v?v+'枚（お申込みと同時に送信します）':'なし';
      if(Array.isArray(v))v=v.join('、');
      if(!v&&(p[0]==='agentOrg'||p[0]==='relation')&&d.role==='本人')return;
      var tr=document.createElement('tr'),th=document.createElement('th'),td=document.createElement('td');
      th.textContent=p[1];td.textContent=v||'（未入力）';tr.appendChild(th);tr.appendChild(td);tb.appendChild(tr);
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
      try{sessionStorage.setItem('gl-receipt',r.data.receiptNo);}catch(x){}
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
      b.disabled=false;b.textContent='この内容で申し込む';
      form.reset();th.innerHTML='';photos=[];current=null;show(1);go(3);
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
