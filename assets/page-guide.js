(function(){var tabs=document.querySelectorAll('.gtabs [data-g]');
function show(k){tabs.forEach(function(t){var on=t.dataset.g===k;t.setAttribute('aria-selected',on?'true':'false');document.getElementById('g-'+t.dataset.g).hidden=!on;});}
tabs.forEach(function(t){t.addEventListener('click',function(){show(t.dataset.g);try{history.replaceState(null,'','#'+t.dataset.g);}catch(e){}});});
var h=(location.hash||'').slice(1);if(['self','agent','corp'].indexOf(h)>=0)show(h);})();
