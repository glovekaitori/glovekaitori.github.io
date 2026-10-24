(function(){var f=document.getElementById('contactForm');f.addEventListener('submit',async function(e){e.preventDefault();
var err=document.getElementById('c-err');err.textContent='';
if(!f.name.value.trim()||!f.reach.value.trim()||!f.body.value.trim()){err.textContent='すべての項目を入力してください。';return;}
var r=await window.gloveCall('submit_contact',{p:{name:f.name.value,reach:f.reach.value,body:f.body.value,website:f.website.value}});
document.getElementById('c-done').hidden=!r.ok;var fl=document.getElementById('c-fail');fl.hidden=r.ok;
if(!r.ok){fl.querySelector('p').textContent=r.reason==='unconfigured'?'現在、受付システムの接続準備中のため、お問い合わせは送信されていません。':'お問い合わせは送信されていません。'+(r.message||'');}
else{f.hidden=true;}});})();
