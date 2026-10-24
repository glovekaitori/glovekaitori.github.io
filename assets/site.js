(function(){
  var d=document, root=d.documentElement;
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ページを開いたら必ずいちばん上から（埋め込み表示でも効くよう、要素側から位置を合わせる）
  //   ・#付きのリンクは、その見出しの位置へ　・「戻る」で戻ったときは、元の位置のまま
  window.gloveTop=function(el){
    try{(el||d.body).scrollIntoView({block:'start',behavior:'instant'});}catch(e){(el||d.body).scrollIntoView(true);}
    if(!el) window.scrollTo(0,0);
  };
  try{if('scrollRestoration' in history) history.scrollRestoration='manual';}catch(e){}
  var nav0=(performance.getEntriesByType&&performance.getEntriesByType('navigation')[0])||{};
  if(nav0.type!=='back_forward'){
    var toStart=function(){var h=location.hash&&location.hash.length>1?d.getElementById(decodeURIComponent(location.hash.slice(1))):null; window.gloveTop(h);};
    toStart(); window.addEventListener('load',function(){setTimeout(toStart,0);},{once:true});
  }

  // メニュー
  var btn=d.getElementById('menuBtn'), nav=d.getElementById('gnav');
  if(btn&&nav){btn.addEventListener('click',function(){
    var o=nav.classList.toggle('open');btn.setAttribute('aria-expanded',o?'true':'false');
  });}

  // ヘッダー：少し下がったら帯を締める
  var hd=d.querySelector('.hd');
  if(hd){var on=function(){hd.classList.toggle('scrolled',window.scrollY>24)};on();window.addEventListener('scroll',on,{passive:true});}

  // 出現演出（表示済みの状態から少し動くだけ。見えない状態では待たない）
  if(!reduce&&'IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}})},{rootMargin:'0px 0px -8% 0px'});
    d.querySelectorAll('.rv').forEach(function(el){
      var r=el.getBoundingClientRect();
      if(r.top<innerHeight){el.classList.add('in');}else{el.classList.add('rv-wait');io.observe(el);}
    });
  }

  // 開幕（トップのみ・1回のみ・押せば飛ばせる）
  var op=d.getElementById('opening');
  if(op){
    var seen=false;try{seen=sessionStorage.getItem('glove-op')==='1';}catch(e){}
    if(reduce||seen){op.remove();}
    else{
      try{sessionStorage.setItem('glove-op','1');}catch(e){}
      op.hidden=false;root.classList.add('op-run');
      var end=function(){op.classList.add('out');root.classList.remove('op-run');setTimeout(function(){op.remove()},900);};
      var tm=setTimeout(end,2600);
      op.addEventListener('click',function(){clearTimeout(tm);end();});
    }
  }
})();

/* 受付状況の表示：接続済みなら「受付中」 */
(function(){
  var el=document.getElementById('sysState');
  var C=window.GLOVE_CONFIG||{},trial=C.mode!=='live';
  if(el&&window.GL&&GL.configured){
    el.textContent=trial?'試験運用中':'受付中';var n=document.getElementById('sysNote');
    if(n){if(trial)n.textContent='（実在のお名前・連絡先は入力しないでください）';else n.remove();}
  }
  if(window.GL&&GL.configured&&trial){document.querySelectorAll('[data-trial]').forEach(function(x){x.hidden=false;});}
})();

/* 公開フォームの送信（未ログインで呼べる関数のみ）。接続先が無ければ必ず失敗として扱う */
window.gloveCall=async function(fn,args){
  if(!window.GL||!GL.configured) return {ok:false,reason:'unconfigured'};
  try{ return {ok:true,data:await GL.rpc(fn,args,true)}; }
  catch(e){ return {ok:false,reason:e.code||'error',message:e.message}; }
};
