(function(){var f=document.getElementById('inviteForm');f.addEventListener('submit',async function(e){e.preventDefault();
var c=f.code.value.trim().toUpperCase(),err=document.getElementById('i-err');err.textContent='';
document.getElementById('i-ok').hidden=true;document.getElementById('i-pending').hidden=true;
if(!/^[A-Z0-9-]{4,32}$/.test(c)){err.textContent='紹介コードは4文字以上の英数字で入力してください。';return;}
var r=await window.gloveCall('check_invite',{p_code:c});
var q='?code='+encodeURIComponent(c);
if(r.ok&&r.data===true){document.getElementById('i-next').href='../apply/'+q;document.getElementById('i-ok').hidden=false;}
else if(r.reason==='unconfigured'){document.getElementById('i-go').href='../apply/'+q;document.getElementById('i-pending').hidden=false;}
else if(r.ok){err.textContent='この紹介コードは確認できませんでした。入力内容をご確認ください。コードなしでもお申込みいただけます。';}
else{err.textContent='通信に失敗しました。時間をおいて再度お試しください。';}});})();
