// Setup-hotspot captive portal page. Single file, zero external assets —
// it must render inside phone captive-portal webviews with no internet.
#pragma once
#include <pgmspace.h>

static const char SETUP_HTML[] PROGMEM = R"HTML(<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Devmatrix setup</title>
<style>
  :root{--bg:#0b0f17;--card:#131a26;--line:#223046;--text:#e8eef7;
        --dim:#8fa1b8;--accent:#2dd4a7;--accent2:#38bdf8;--warn:#fbbf24;
        --err:#f87171}
  *{box-sizing:border-box;margin:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
       background:radial-gradient(1200px 600px at 50% -10%,#14243c,var(--bg));
       color:var(--text);min-height:100vh;display:flex;align-items:center;
       justify-content:center;padding:20px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:16px;
        padding:28px 24px;width:100%;max-width:430px;
        box-shadow:0 20px 60px rgba(0,0,0,.5)}
  .logo{display:flex;align-items:center;gap:12px;margin-bottom:6px}
  .logo svg{border-radius:6px}
  h1{font-size:22px;font-weight:700}
  h1 span{color:var(--accent)}
  .sub{color:var(--dim);font-size:14px;margin:6px 0 22px}
  .sub b{color:var(--text);font-weight:600}
  h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;
     color:var(--dim);margin:18px 0 10px}
  .nets{border:1px solid var(--line);border-radius:12px;overflow:hidden;
        max-height:260px;overflow-y:auto}
  .net{display:flex;align-items:center;gap:10px;width:100%;text-align:left;
       padding:13px 14px;background:none;border:0;border-bottom:1px solid var(--line);
       color:var(--text);font-size:15px;cursor:pointer}
  .net:last-child{border-bottom:0}
  .net:active,.net.sel{background:#1a2434}
  .net .bars{margin-left:auto;color:var(--accent);font-size:13px;letter-spacing:1px}
  .net .lock{color:var(--dim);font-size:12px}
  .muted{color:var(--dim);font-size:14px;padding:16px;text-align:center}
  .row{margin-top:14px}
  input[type=password],input[type=text]{width:100%;padding:13px 14px;font-size:16px;
       background:#0d1420;border:1px solid var(--line);border-radius:10px;
       color:var(--text);outline:none}
  input:focus{border-color:var(--accent2)}
  .btn{width:100%;margin-top:16px;padding:14px;font-size:16px;font-weight:700;
       background:linear-gradient(135deg,var(--accent),#1fb08a);border:0;
       border-radius:10px;color:#04120d;cursor:pointer}
  .btn:disabled{opacity:.5}
  .btn.ghost{background:none;border:1px solid var(--line);color:var(--dim);
       font-weight:500}
  .spin{width:22px;height:22px;border:3px solid var(--line);
        border-top-color:var(--accent);border-radius:50%;margin:0 auto 12px;
        animation:r 1s linear infinite}
  @keyframes r{to{transform:rotate(360deg)}}
  .center{text-align:center;padding:10px 0}
  .big{font-size:40px;margin-bottom:8px}
  .err{color:var(--err);font-size:14px;margin-top:12px;text-align:center}
  .note{color:var(--dim);font-size:13px;line-height:1.5;margin-top:10px}
  .note b{color:var(--warn)}
  a{color:var(--accent2)}
  .linkbox{background:#0d1420;border:1px solid var(--line);border-radius:10px;
           padding:12px;font-size:15px;margin:10px 0;word-break:break-all}
  .hide{display:none}
</style></head><body>
<div class="card">
  <div class="logo">
    <svg width="34" height="20" viewBox="0 0 34 20">
      <rect x="1"  y="1"  width="4" height="4" fill="#2dd4a7"/>
      <rect x="8"  y="1"  width="4" height="4" fill="#38bdf8"/>
      <rect x="15" y="1"  width="4" height="4" fill="#fbbf24"/>
      <rect x="1"  y="8"  width="4" height="4" fill="#38bdf8"/>
      <rect x="8"  y="8"  width="4" height="4" fill="#f87171"/>
      <rect x="22" y="8"  width="4" height="4" fill="#2dd4a7"/>
      <rect x="8"  y="15" width="4" height="4" fill="#2dd4a7"/>
      <rect x="15" y="15" width="4" height="4" fill="#38bdf8"/>
      <rect x="29" y="15" width="4" height="4" fill="#fbbf24"/>
    </svg>
    <h1>Devmatrix <span id="dev">setup</span></h1>
  </div>
  <p class="sub">Let's get your display on Wi-Fi. Pick your network below
     and I'll join it.</p>

  <div id="stepPick">
    <h2>Your networks</h2>
    <div class="nets" id="nets"><div class="muted">Scanning…</div></div>
    <button class="btn ghost" id="rescan">Scan again</button>
    <div class="row hide" id="passRow">
      <h2>Password for <span id="pickName" style="color:var(--text)"></span></h2>
      <input type="password" id="pass" placeholder="Wi-Fi password"
             autocomplete="off">
    </div>
    <button class="btn hide" id="join">Connect</button>
    <div class="err hide" id="joinErr"></div>
  </div>

  <div id="stepJoining" class="center hide">
    <div class="spin"></div>
    <div>Joining <b id="joiningName"></b>…</div>
    <div class="note">Watch the panel — it shows WIFI OK! when it's in.</div>
  </div>

  <div id="stepDone" class="hide">
    <div class="center"><div class="big">&#10003;</div>
      <div style="font-size:20px;font-weight:700">Connected!</div></div>
    <h2>Your Console</h2>
    <div class="linkbox" id="consoleUrl"></div>
    <p class="note">This phone signs in automatically when you open the
       Console. Any other device can pair itself later with a short code
       shown right on the panel — <b>nothing to write down</b>.</p>
    <button class="btn" id="finish">Finish &mdash; restart onto my Wi-Fi</button>
  </div>

  <div id="stepBye" class="hide">
    <div class="center"><div class="big">&#128075;</div>
      <div style="font-size:20px;font-weight:700">Restarting…</div></div>
    <p class="note">Reconnect your phone to <b id="homeSsid"></b> (usually
       automatic once this hotspot disappears), then open your Console:</p>
    <div class="linkbox"><a id="goLink" href="#"></a></div>
    <p class="note">That link carries your token, so the Console signs itself
       in on first open.</p>
  </div>
</div>
<script>
var sel=null, selOpen=false, joined=null, poll=null;
function $(id){return document.getElementById(id)}
function show(id){['stepPick','stepJoining','stepDone','stepBye'].forEach(
  function(s){ $(s).classList.toggle('hide', s!==id) })}
function bars(rssi){ var n=rssi>-55?4:rssi>-65?3:rssi>-75?2:1;
  return '▂▄▆█'.slice(0,n) }
function loadNets(){
  fetch('/setup/scan').then(function(r){return r.json()}).then(function(d){
    if(d.scanning){ setTimeout(loadNets,1200); return }
    var seen={}, list=(d.networks||[]).filter(function(n){
      if(!n.ssid||seen[n.ssid])return false; seen[n.ssid]=1; return true });
    list.sort(function(a,b){return b.rssi-a.rssi});
    var el=$('nets'); el.innerHTML='';
    if(!list.length){ el.innerHTML='<div class="muted">Nothing found — scan again?</div>'; return }
    list.forEach(function(n){
      var b=document.createElement('button'); b.className='net';
      b.innerHTML='<span>'+n.ssid.replace(/</g,'&lt;')+'</span>'+
        (n.open?'':'<span class="lock">&#128274;</span>')+
        '<span class="bars">'+bars(n.rssi)+'</span>';
      b.onclick=function(){
        sel=n.ssid; selOpen=n.open;
        Array.prototype.forEach.call(document.querySelectorAll('.net'),
          function(x){x.classList.remove('sel')});
        b.classList.add('sel');
        $('pickName').textContent=n.ssid;
        $('passRow').classList.toggle('hide', n.open);
        $('join').classList.remove('hide');
        $('joinErr').classList.add('hide');
      };
      el.appendChild(b);
    });
  }).catch(function(){ setTimeout(loadNets,1500) });
}
$('rescan').onclick=function(){
  $('nets').innerHTML='<div class="muted">Scanning…</div>';
  fetch('/setup/scan?rescan=1').then(function(){setTimeout(loadNets,2500)});
};
$('join').onclick=function(){
  if(!sel)return;
  $('joiningName').textContent=sel; show('stepJoining');
  fetch('/setup/join',{method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ssid:sel,pass:selOpen?'':$('pass').value})})
    .then(function(){ poll=setInterval(checkJoin,1500) })
    .catch(function(){ fail('Could not reach the device.') });
};
function fail(msg){ clearInterval(poll); show('stepPick');
  var e=$('joinErr'); e.textContent=msg; e.classList.remove('hide') }
function checkJoin(){
  fetch('/setup/status').then(function(r){return r.json()}).then(function(d){
    if(d.state==='joined'){ clearInterval(poll); joined=d;
      $('consoleUrl').textContent='http://'+d.mdns+'/  (or http://'+d.ip+'/)';
      show('stepDone');
    } else if(d.state==='failed'){
      fail('Couldn’t join “'+sel+'” — check the password and try again.');
    }
  }).catch(function(){});
}
$('finish').onclick=function(){
  $('homeSsid').textContent=sel||'your Wi-Fi';
  var url='http://'+joined.mdns+'/#t='+joined.token;
  var a=$('goLink'); a.textContent=url; a.href=url;
  show('stepBye');
  fetch('/setup/done',{method:'POST'}).catch(function(){});
};
fetch('/api/v1/health').then(function(r){return r.json()})
  .then(function(d){ $('dev').textContent=d.device }).catch(function(){});
loadNets();
</script></body></html>
)HTML";
