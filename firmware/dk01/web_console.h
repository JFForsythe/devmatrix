// Device-served Local Console. Single file, zero external assets, vanilla JS —
// the box is the web server, so this must work with no internet at all.
// Design language mirrors portal/prototype (paper surfaces, rail nav, mono
// chips, dark LED wells) so the device and the prototype tell one story.
#pragma once
#include <pgmspace.h>

static const char CONSOLE_HTML[] PROGMEM = R"HTML(<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>Devmatrix Console</title>
<style>
  :root{
    --paper:#f3f1ea; --srf:#fcfbf8; --srf2:#f6f4ed; --srf3:#eeebe1;
    --well:#12161c; --well-ink:#9fb0c0;
    --line:#ddd9cd; --line2:#c9c4b5;
    --ink:#1c2128; --ink2:#4d5866; --ink3:#5f6b78;
    --acc:#14663e; --acc-soft:rgba(20,102,62,.08);
    --good:#0ca30c; --warn:#fab219; --crit:#d03b3b;
    --sans:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    --mono:ui-monospace,"SFMono-Regular",Menlo,Monaco,Consolas,monospace;
    --r:8px;
  }
  *{box-sizing:border-box;margin:0}
  button{font:inherit;background:none;border:0;cursor:pointer;color:inherit}
  body{font-family:var(--sans);background:var(--paper);color:var(--ink);
       min-height:100vh}
  .shell{display:flex;min-height:100vh}
  .rail{width:218px;flex:none;border-right:1px solid var(--line);
        padding:20px 14px;display:flex;flex-direction:column;gap:22px;
        position:sticky;top:0;height:100vh;background:var(--srf)}
  .brand{display:flex;gap:10px;align-items:center;padding:0 6px}
  .brand svg{flex:none;border-radius:4px}
  .brand b{font:600 12px var(--mono);letter-spacing:.22em}
  .brand span{display:block;font:500 9.5px var(--mono);letter-spacing:.3em;
        color:var(--ink3)}
  nav{display:flex;flex-direction:column;gap:1px}
  nav button{display:flex;align-items:center;gap:9px;text-align:left;
        padding:8px 10px;border-radius:6px;color:var(--ink2);
        font:500 13.5px/1.35 var(--sans)}
  nav button:hover{background:var(--srf2);color:var(--ink)}
  nav button[aria-current="page"]{background:var(--srf3);color:var(--ink)}
  .px{width:4px;height:12px;background:transparent;flex:none}
  nav button[aria-current="page"] .px{background:var(--acc)}
  .foot{margin-top:auto;padding:0 6px}
  .ver{font:400 10px var(--mono);color:var(--ink3);letter-spacing:.06em}
  .main{flex:1;min-width:0;display:flex;flex-direction:column}
  .topbar{display:flex;align-items:center;gap:14px;padding:12px 26px;
        border-bottom:1px solid var(--line);position:sticky;top:0;z-index:5;
        background:color-mix(in srgb,var(--paper) 90%,transparent);
        backdrop-filter:blur(8px)}
  .prompt{font:500 13px var(--mono);color:var(--ink3);white-space:nowrap}
  .prompt b{color:var(--acc);font-weight:600}
  .statuspill{display:flex;align-items:center;gap:8px;
        font:400 12px var(--mono);color:var(--ink2);white-space:nowrap}
  .led{width:7px;height:7px;flex:none;background:var(--good);
        box-shadow:0 0 6px rgba(12,163,12,.6);border:1px solid rgba(0,0,0,.15)}
  .led.off{background:var(--line2);box-shadow:none}
  .spring{flex:1}
  .modechip{font:500 11.5px/1.25 var(--sans);letter-spacing:.03em;
        padding:5px 10px;border-radius:5px;border:1px solid var(--acc);
        color:var(--acc);background:var(--acc-soft);white-space:nowrap}
  .view{display:none;padding:26px;max-width:1180px;width:100%;margin:0 auto}
  .view.active{display:block}
  .vhead{margin-bottom:18px}
  .vhead h1{font:500 23px/1.2 var(--sans);letter-spacing:-.015em}
  .vhead p{color:var(--ink2);font-size:14.5px;line-height:1.55;margin-top:5px;
        max-width:70ch}
  .grid{display:grid;grid-template-columns:repeat(12,1fr);gap:14px}
  .card{grid-column:span 12;background:var(--srf);border:1px solid var(--line);
        border-radius:var(--r);padding:16px 18px;min-width:0}
  .c6{grid-column:span 6}
  h2{font:600 11px var(--mono);text-transform:uppercase;letter-spacing:.14em;
     color:var(--ink3);margin-bottom:12px}
  .tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));
        gap:10px}
  .tile{background:var(--srf2);border:1px solid var(--line);border-radius:6px;
        padding:10px 12px}
  .tile .v{font:600 16px var(--mono);font-variant-numeric:tabular-nums}
  .tile .k{font-size:11px;color:var(--ink3);margin-top:3px}
  input[type=text],input[type=password],select{width:100%;padding:9px 11px;
        font:500 13.5px var(--sans);background:var(--srf);
        border:1px solid var(--line2);border-radius:6px;color:var(--ink);
        outline:none}
  input:focus,select:focus{border-color:var(--acc)}
  .btn{padding:9px 15px;font:600 13px var(--sans);border-radius:6px;
        background:var(--acc);color:#fff}
  .btn:hover{filter:brightness(1.12)}
  .btn.ghost{background:var(--srf);border:1px solid var(--line2);
        color:var(--ink2);font-weight:500}
  .btn.ghost:hover{border-color:var(--acc);color:var(--acc);
        background:var(--acc-soft);filter:none}
  .btn.danger{background:var(--srf);border:1px solid var(--crit);
        color:var(--crit);font-weight:500}
  .btn:disabled{opacity:.45}
  .row{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center}
  .row .grow{flex:1;min-width:120px}
  .chip{font:500 11px var(--mono);padding:3px 9px;border:1px solid var(--line2);
        border-radius:99px;color:var(--ink2);white-space:nowrap}
  .banner{margin:18px 26px 0;background:var(--srf);border:1px solid var(--warn);
        border-left:4px solid var(--warn);border-radius:var(--r);
        padding:14px 16px;max-width:1128px}
  .hide{display:none}
  .well{background:var(--well);border-radius:10px;padding:12px}
  canvas{width:100%;display:block;border-radius:4px;touch-action:none;
        image-rendering:pixelated;background:#000;cursor:crosshair}
  .swatches{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
  .sw{width:24px;height:24px;border-radius:5px;border:2px solid transparent;
      padding:0}
  .sw.sel{border-color:var(--ink)}
  input[type=color]{width:32px;height:28px;border:0;background:none;padding:0;
      cursor:pointer}
  input[type=range]{width:100%;accent-color:var(--acc)}
  .bar{height:8px;background:var(--srf2);border:1px solid var(--line);
       border-radius:99px;overflow:hidden;margin-top:10px}
  .bar i{display:block;height:100%;width:0;background:var(--acc)}
  .stat{font:400 12.5px var(--sans);color:var(--ink3);margin-top:8px;
        min-height:16px}
  .stat.err{color:var(--crit)} .stat.ok{color:var(--acc)}
  pre{background:var(--well);color:var(--well-ink);border-radius:6px;
      padding:11px;font:400 12px/1.5 var(--mono);overflow-x:auto}
  .tokbox{font:400 12px var(--mono);word-break:break-all;color:var(--ink2);
        background:var(--srf2);border:1px dashed var(--line2);border-radius:6px;
        padding:10px;margin-top:10px}
  .note{font-size:12.5px;color:var(--ink3);line-height:1.5;margin-top:8px}
  .alert{background:var(--srf);border:1px solid var(--crit);
        border-left:4px solid var(--crit);border-radius:var(--r);
        padding:12px 14px;font-size:13px;color:var(--ink2);
        grid-column:span 12}
  .alert b{color:var(--crit)}
  @media(max-width:860px){
    .shell{flex-direction:column}
    .rail{width:100%;height:auto;position:static;flex-direction:row;
          align-items:center;padding:10px 14px;gap:12px;overflow-x:auto}
    nav{flex-direction:row}
    .foot{display:none}
    .c6{grid-column:span 12}
    .view{padding:16px}
    .banner{margin:14px 16px 0}
  }
</style></head><body>
<div class="shell">
<aside class="rail">
  <div class="brand">
    <svg width="26" height="16" viewBox="0 0 34 20">
      <rect x="1" y="1" width="4" height="4" fill="#14663e"/>
      <rect x="8" y="1" width="4" height="4" fill="#2a78d6"/>
      <rect x="15" y="1" width="4" height="4" fill="#fab219"/>
      <rect x="1" y="8" width="4" height="4" fill="#2a78d6"/>
      <rect x="8" y="8" width="4" height="4" fill="#d03b3b"/>
      <rect x="22" y="8" width="4" height="4" fill="#14663e"/>
      <rect x="8" y="15" width="4" height="4" fill="#14663e"/>
      <rect x="15" y="15" width="4" height="4" fill="#2a78d6"/>
    </svg>
    <div><b>DEVMATRIX</b><span>LOCAL CONSOLE</span></div>
  </div>
  <nav id="nav">
    <button data-v="dashboard"><i class="px"></i>Dashboard</button>
    <button data-v="paint"><i class="px"></i>Paint</button>
    <button data-v="flights"><i class="px"></i>Flights</button>
    <button data-v="update"><i class="px"></i>Update</button>
    <button data-v="settings"><i class="px"></i>Settings</button>
    <button data-v="api"><i class="px"></i>API</button>
  </nav>
  <div class="foot"><div class="ver" id="verline">fw —</div></div>
</aside>
<div class="main">
  <div class="topbar">
    <span class="prompt"><b id="devprompt">dmx-____</b> &#9656;</span>
    <span class="statuspill"><i class="led off" id="led"></i>
      <span id="pillTxt">connecting&hellip;</span></span>
    <span class="spring"></span>
    <span class="chip" id="slotchip">slot &mdash;</span>
    <span class="modechip">Local Mode</span>
  </div>

  <div class="banner hide" id="pairBanner">
    <b>Pair this browser with your device.</b>
    <div class="note">Tap <b>Pair</b> &mdash; a 6-digit code lights up on the
      panel (white row first, then blue row). Type it here and you're in.</div>
    <div class="row">
      <button class="btn" id="pairStart">Pair</button>
      <input type="text" id="pairCode" class="grow hide" placeholder="123-456"
             inputmode="numeric" maxlength="7" autocomplete="off">
      <button class="btn hide" id="pairGo">Confirm</button>
    </div>
    <div class="stat" id="pairStat"></div>
    <div class="note"><a href="#" id="advTok" style="color:var(--ink3)">Advanced:
      paste a LAN token instead</a></div>
    <div class="row hide" id="tokRow">
      <input type="password" id="tokIn" class="grow" placeholder="LAN token">
      <button class="btn ghost" id="tokSave">Use token</button>
    </div>
  </div>

  <section class="view" id="v-dashboard">
    <div class="vhead"><h1>Dashboard</h1>
      <p>Your device, live on your LAN. No account, no cloud &mdash; this page
         is served by the display itself.</p></div>
    <div class="grid">
      <div class="alert hide" id="bootAlert"><b>Last reboot: <span
        id="bootWhy">?</span>.</b> <span id="bootHint"></span></div>
      <div class="card">
        <h2>Status</h2>
        <div class="tiles">
          <div class="tile"><div class="v" id="t_up">&mdash;</div><div class="k">uptime</div></div>
          <div class="tile"><div class="v" id="t_rssi">&mdash;</div><div class="k">wi-fi signal</div></div>
          <div class="tile"><div class="v" id="t_heap">&mdash;</div><div class="k">free heap</div></div>
          <div class="tile"><div class="v" id="t_hz">&mdash;</div><div class="k">panel refresh</div></div>
          <div class="tile"><div class="v" id="t_ip">&mdash;</div><div class="k">ip address</div></div>
          <div class="tile"><div class="v" id="t_scene">&mdash;</div><div class="k">showing</div></div>
        </div>
      </div>
      <div class="card c6">
        <h2>Say something</h2>
        <input type="text" id="sayText" maxlength="120" placeholder="SHIP IT">
        <div class="row">
          <input type="range" id="saySecs" min="2" max="60" value="10" class="grow">
          <span class="chip"><span id="saySecsV">10</span>s</span>
          <button class="btn" id="sayGo">Send</button>
        </div>
        <div class="stat" id="sayStat"></div>
      </div>
      <div class="card c6">
        <h2>Brightness</h2>
        <input type="range" id="bright" min="10" max="150" value="110">
        <div class="row">
          <span class="chip"><span id="brightV">110</span> / 150</span>
          <button class="btn ghost" id="identify">Identify</button>
        </div>
        <div class="note">Capped at 150: a full-bright white frame can out-draw
          USB-C power and brown-out the board mid-masterpiece.</div>
        <div class="stat" id="brStat"></div>
      </div>
    </div>
  </section>

  <section class="view" id="v-paint">
    <div class="vhead"><h1>Paint</h1>
      <p>64&times;32, straight to the panel. Check <b>live</b> to stream
         strokes as you draw.</p></div>
    <div class="grid"><div class="card">
      <div class="well"><canvas id="pix" width="512" height="256"></canvas></div>
      <div class="row swatches" id="swat"></div>
      <div class="row">
        <button class="btn" id="pxSend">Send to panel</button>
        <label class="chip" style="cursor:pointer">
          <input type="checkbox" id="pxLive" style="accent-color:var(--acc)">
          live</label>
        <button class="btn ghost" id="pxFill">Fill</button>
        <button class="btn ghost" id="pxClear">Clear</button>
        <button class="btn ghost" id="pxClock">Back to clock</button>
      </div>
      <div class="stat" id="pxStat"></div>
    </div></div>
  </section>

  <section class="view" id="v-flights">
    <div class="vhead"><h1>Flights</h1>
      <p>Your antenna, your panel. Point this at your own ADS-B receiver's
         <span style="font-family:var(--mono)">aircraft.json</span> and run the
         companion script &mdash; nearest flights, live.</p></div>
    <div class="grid">
      <div class="card">
        <h2>Receiver</h2>
        <div class="row">
          <input type="text" id="flUrl" class="grow"
                 placeholder="http://&lt;receiver&gt;/data/aircraft.json">
          <button class="btn ghost" id="flScan">Scan my network</button>
        </div>
        <div class="note">The URL is stored on the device only (NVS). It is
          never written to any repository, cloud, or log &mdash; scan finds it,
          or type it in.</div>
        <div class="stat" id="flScanStat"></div>
      </div>
      <div class="card c6">
        <h2>Display</h2>
        <div class="row">
          <input type="range" id="flInt" min="1" max="30" value="1" class="grow">
          <span class="chip">every <span id="flIntV">1</span>s</span>
        </div>
        <div class="row">
          <select id="flView" style="width:auto">
            <option value="list">List view</option>
            <option value="radar">Radar view</option>
          </select>
          <select id="flRows" style="width:auto">
            <option value="1">1 flight</option>
            <option value="2" selected>2 flights</option>
            <option value="3">3 flights</option>
            <option value="4">4 flights</option>
            <option value="5">5 flights</option>
          </select>
          <select id="flFmt" style="width:auto">
            <option value="kts">Speed (kts)</option>
            <option value="alt">Altitude (ft)</option>
          </select>
          <button class="btn" id="flSave">Save</button>
        </div>
        <div class="stat" id="flStat"></div>
      </div>
      <div class="card c6">
        <h2>Run it</h2>
        <div class="note" style="margin:0 0 8px">The script follows these
          settings (re-reads them every few cycles):</div>
        <pre id="flCmd"></pre>
        <div class="row"><button class="btn ghost" id="flCp">Copy with my token</button></div>
      </div>
    </div>
  </section>

  <section class="view" id="v-update">
    <div class="vhead"><h1>Update</h1>
      <p>Over-the-air firmware. Dual app slots plus a UF2 recovery partition
         mean a bad build never bricks the box.</p></div>
    <div class="grid"><div class="card c6">
      <h2>Upload firmware (.bin)</h2>
      <div class="row">
        <input type="file" id="otaFile" accept=".bin" class="grow"
               style="font-size:13px;color:var(--ink3)">
        <button class="btn" id="otaGo">Update</button>
      </div>
      <div class="bar"><i id="otaBar"></i></div>
      <div class="stat" id="otaStat"></div>
      <div class="note">Build one with <span style="font-family:var(--mono)">
        arduino-cli compile</span> &mdash; see firmware/dk01/README.md.</div>
    </div></div>
  </section>

  <section class="view" id="v-settings">
    <div class="vhead"><h1>Settings</h1></div>
    <div class="grid">
      <div class="card c6">
        <h2>Clock timezone</h2>
        <select id="tz">
          <option value="CST6CDT,M3.2.0,M11.1.0">US Central</option>
          <option value="EST5EDT,M3.2.0,M11.1.0">US Eastern</option>
          <option value="MST7MDT,M3.2.0,M11.1.0">US Mountain</option>
          <option value="MST7">Arizona</option>
          <option value="PST8PDT,M3.2.0,M11.1.0">US Pacific</option>
          <option value="UTC0">UTC</option>
        </select>
        <div class="stat" id="setStat"></div>
      </div>
      <div class="card c6">
        <h2>Access</h2>
        <div class="row">
          <button class="btn ghost" id="rotate">Rotate LAN token</button>
          <button class="btn ghost" id="reboot">Reboot</button>
        </div>
        <div id="newTok" class="tokbox hide"></div>
        <div class="row">
          <button class="btn danger" id="wifiReset">Change Wi-Fi&hellip;</button>
          <button class="btn danger" id="facReset">Factory reset&hellip;</button>
        </div>
        <div class="note">Rotating logs out every client; they re-pair with a
          panel code. Factory reset wipes Wi-Fi, token, and settings.</div>
      </div>
    </div>
  </section>

  <section class="view" id="v-api">
    <div class="vhead"><h1>API</h1>
      <p>Everything this Console does is plain HTTP on your LAN. It's your
         box &mdash; script it.</p></div>
    <div class="grid">
      <div class="card">
        <div class="row" style="margin:0 0 6px"><h2 style="margin:0">Push text</h2>
          <button class="btn ghost" id="cp1" style="margin-left:auto">Copy with my token</button></div>
        <pre id="ex1"></pre>
      </div>
      <div class="card">
        <div class="row" style="margin:0 0 6px"><h2 style="margin:0">Read status</h2>
          <button class="btn ghost" id="cp2" style="margin-left:auto">Copy with my token</button></div>
        <pre id="ex2"></pre>
      </div>
      <div class="card"><h2>Routes</h2>
        <div class="note" style="margin:0">GET <b>health</b> (open) &middot;
        GET <b>info</b> &middot; POST <b>display/text</b> &middot;
        POST <b>display/frame</b> (4096 B RGB565 LE, base64) &middot;
        POST <b>display/brightness</b> &middot; POST <b>display/clear</b> &middot;
        POST <b>identify</b> &middot; POST <b>claim/start</b> +
        <b>claim/finish</b> &middot; GET/POST <b>settings</b> &middot;
        POST <b>token/rotate</b> &middot; POST <b>reboot</b> &middot;
        POST <b>wifi/reset</b> &middot; POST <b>factory/reset</b> &middot;
        POST <b>/update</b> (OTA). All under <b>/api/v1</b>, Bearer token,
        <span style="font-family:var(--mono)">Content-Type: application/json</span>.</div>
      </div>
    </div>
  </section>
</div>
</div>
<script>
function $(id){return document.getElementById(id)}
// ---- hash router, same shape as the prototype (#dashboard etc) ----
var VIEWS=['dashboard','paint','flights','update','settings','api'];
function route(){
  var v=(location.hash||'#dashboard').slice(1);
  if(VIEWS.indexOf(v)<0)v='dashboard';
  VIEWS.forEach(function(x){
    $('v-'+x).classList.toggle('active',x===v)});
  Array.prototype.forEach.call(document.querySelectorAll('#nav button'),
    function(b){ if(b.dataset.v===v)b.setAttribute('aria-current','page');
                 else b.removeAttribute('aria-current') });
}
window.addEventListener('hashchange',route);
Array.prototype.forEach.call(document.querySelectorAll('#nav button'),
  function(b){ b.onclick=function(){location.hash='#'+b.dataset.v} });
// ---- token: #t= fragment from setup, localStorage, or pairing ----
if(location.hash.indexOf('#t=')===0){
  localStorage.setItem('dmx_token',location.hash.slice(3));
  history.replaceState(null,'',location.pathname+'#dashboard');
}
route();
function tok(){return localStorage.getItem('dmx_token')||''}
function needTok(){ $('pairBanner').classList.remove('hide') }
function paired(t){
  localStorage.setItem('dmx_token',t);
  $('pairBanner').classList.add('hide'); refresh(); loadFlights();
}
$('pairStart').onclick=function(){
  var self=this;
  fetch('/api/v1/claim/start',{method:'POST'}).then(function(r){return r.json()})
    .then(function(){
      self.textContent='Code is on the panel';
      $('pairCode').classList.remove('hide');
      $('pairGo').classList.remove('hide');
      $('pairCode').focus();
      $('pairStat').textContent='';
    }).catch(function(){
      $('pairStat').textContent='Could not reach the device.';
      $('pairStat').className='stat err';
    });
};
$('pairCode').oninput=function(){
  var d=this.value.replace(/\D/g,'').slice(0,6);
  this.value=d.length>3?d.slice(0,3)+'-'+d.slice(3):d;
};
$('pairGo').onclick=function(){
  fetch('/api/v1/claim/finish',{method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({code:$('pairCode').value.replace(/\D/g,'')})})
  .then(function(r){return r.json()}).then(function(d){
    if(d.token){ paired(d.token); return }
    $('pairStat').textContent=d.error+
      (d.attempts_left?' ('+d.attempts_left+' tries left)':'');
    $('pairStat').className='stat err';
    if(!d.attempts_left){ $('pairStart').textContent='Pair';
      $('pairCode').classList.add('hide');$('pairGo').classList.add('hide') }
  }).catch(function(){});
};
$('advTok').onclick=function(e){e.preventDefault();
  $('tokRow').classList.toggle('hide')};
$('tokSave').onclick=function(){ paired($('tokIn').value.trim()) };
function api(path,opts){
  opts=opts||{}; opts.headers=opts.headers||{};
  opts.headers['Authorization']='Bearer '+tok();
  if(opts.body)opts.headers['Content-Type']='application/json';
  return fetch(path,opts).then(function(r){
    if(r.status===401){needTok();throw new Error('unauthorized')}
    return r.json()});
}
function copyText(t){var ta=document.createElement('textarea');ta.value=t;
  document.body.appendChild(ta);ta.select();
  try{document.execCommand('copy')}catch(e){}
  document.body.removeChild(ta)}
function flash(id,msg,cls){var e=$(id);e.textContent=msg;
  e.className='stat '+(cls||'ok');
  setTimeout(function(){e.textContent='';},4000)}
// ---- status poll ----
function fmtUp(s){ if(s<3600)return Math.floor(s/60)+'m '+(s%60)+'s';
  if(s<86400)return Math.floor(s/3600)+'h '+Math.floor(s%3600/60)+'m';
  return Math.floor(s/86400)+'d '+Math.floor(s%86400/3600)+'h' }
var BOOT_HINTS={
  brownout:'Power could not keep up (usually brightness + bright content on USB power). Brightness is capped to prevent this.',
  crash:'The firmware hit a fatal error. If it repeats, grab the serial log and file an issue.',
  watchdog:'The firmware stalled and the watchdog restarted it.'};
function refresh(){
  if(!tok()){needTok();return}
  api('/api/v1/info').then(function(d){
    $('led').classList.remove('off');
    $('pillTxt').textContent=d.device+' online';
    $('devprompt').textContent=d.mdns?d.mdns.replace('.local',''):d.device;
    $('verline').textContent='fw '+d.fw+' · '+d.slot;
    $('slotchip').textContent='slot '+d.slot;
    $('t_up').textContent=fmtUp(d.uptime_s);
    $('t_rssi').textContent=d.rssi_dbm+' dBm';
    $('t_heap').textContent=Math.round(d.heap_free/1024)+' KB';
    $('t_hz').textContent=d.refresh_hz+' Hz';
    $('t_ip').textContent=d.ip;
    $('t_scene').textContent=d.scene;
    if(d.reset_reason&&BOOT_HINTS[d.reset_reason]){
      $('bootAlert').classList.remove('hide');
      $('bootWhy').textContent=d.reset_reason;
      $('bootHint').textContent=BOOT_HINTS[d.reset_reason];
    }
    if(!brTouched){$('bright').value=d.brightness;
      $('brightV').textContent=d.brightness}
  }).catch(function(){ $('led').classList.add('off');
    $('pillTxt').textContent='offline?' });
}
setInterval(refresh,5000);
// ---- say ----
$('saySecs').oninput=function(){$('saySecsV').textContent=this.value};
$('sayGo').onclick=function(){
  api('/api/v1/display/text',{method:'POST',body:JSON.stringify(
    {text:$('sayText').value||'hi!',duration_s:+$('saySecs').value})})
  .then(function(){flash('sayStat','On the panel!')})
  .catch(function(e){flash('sayStat',e.message,'err')});
};
// ---- brightness ----
var brTouched=false,brTimer=null;
$('bright').oninput=function(){
  brTouched=true;$('brightV').textContent=this.value;
  clearTimeout(brTimer);var v=+this.value;
  brTimer=setTimeout(function(){
    api('/api/v1/display/brightness',{method:'POST',
      body:JSON.stringify({value:v})})
    .then(function(){flash('brStat','Set to '+v);brTouched=false})
    .catch(function(e){flash('brStat',e.message,'err')});
  },250);
};
$('identify').onclick=function(){
  api('/api/v1/identify',{method:'POST'})
  .then(function(){flash('brStat','Look at the panel')})
  .catch(function(e){flash('brStat',e.message,'err')});
};
// ---- painter ----
var W=64,H=32,CELL=8,px=new Array(W*H).fill(0),
    ctx=$('pix').getContext('2d'),color=0x14663e,painting=false,dirty=false;
var PRESETS=[0xffffff,0xd03b3b,0xfab219,0x0ca30c,0x14663e,0x2a78d6,0x8b5cf6,0x000000];
var swEl=$('swat');
PRESETS.forEach(function(c){
  var b=document.createElement('button');b.className='sw'+(c===color?' sel':'');
  b.style.background='#'+('00000'+c.toString(16)).slice(-6);
  if(c===0)b.style.border='2px solid var(--line2)',b.title='eraser';
  b.onclick=function(){color=c;sel(b);pick.value='#'+('00000'+c.toString(16)).slice(-6)};
  swEl.appendChild(b);
});
var pick=document.createElement('input');pick.type='color';pick.value='#14663e';
pick.oninput=function(){color=parseInt(this.value.slice(1),16);sel(null)};
swEl.appendChild(pick);
function sel(b){Array.prototype.forEach.call(document.querySelectorAll('.sw'),
  function(x){x.classList.toggle('sel',x===b)})}
function drawCell(x,y){
  var c=px[y*W+x];
  ctx.fillStyle='#'+('00000'+c.toString(16)).slice(-6);
  ctx.fillRect(x*CELL,y*CELL,CELL,CELL);
  ctx.strokeStyle='rgba(255,255,255,.05)';
  ctx.strokeRect(x*CELL+.5,y*CELL+.5,CELL-1,CELL-1);
}
function repaint(){for(var y=0;y<H;y++)for(var x=0;x<W;x++)drawCell(x,y)}
repaint();
function evCell(e){
  var r=$('pix').getBoundingClientRect();
  var x=Math.floor((e.clientX-r.left)/r.width*W),
      y=Math.floor((e.clientY-r.top)/r.height*H);
  if(x<0||y<0||x>=W||y>=H)return null;return{x:x,y:y};
}
$('pix').addEventListener('pointerdown',function(e){
  painting=true;$('pix').setPointerCapture(e.pointerId);paintAt(e)});
$('pix').addEventListener('pointermove',function(e){if(painting)paintAt(e)});
$('pix').addEventListener('pointerup',function(){
  painting=false;
  if($('pxLive').checked&&dirty)sendFrame(true);
});
function paintAt(e){var c=evCell(e);if(!c)return;
  px[c.y*W+c.x]=color;drawCell(c.x,c.y);dirty=true}
function frameB64(){
  var bytes=new Uint8Array(W*H*2);
  for(var i=0;i<W*H;i++){
    var c=px[i],r=(c>>16)&255,g=(c>>8)&255,b=c&255;
    var v=((r>>3)<<11)|((g>>2)<<5)|(b>>3);
    bytes[i*2]=v&255;bytes[i*2+1]=v>>8;
  }
  var s='';for(var j=0;j<bytes.length;j+=1024)
    s+=String.fromCharCode.apply(null,bytes.subarray(j,j+1024));
  return btoa(s);
}
function sendFrame(quiet){
  api('/api/v1/display/frame',{method:'POST',
    body:JSON.stringify({b64:frameB64()})})
  .then(function(){dirty=false;if(!quiet)flash('pxStat','On the panel!')})
  .catch(function(e){flash('pxStat',e.message,'err')});
}
$('pxSend').onclick=function(){sendFrame(false)};
$('pxFill').onclick=function(){px.fill(color);repaint();dirty=true;
  if($('pxLive').checked)sendFrame(true)};
$('pxClear').onclick=function(){px.fill(0);repaint();dirty=true;
  if($('pxLive').checked)sendFrame(true)};
$('pxClock').onclick=function(){
  api('/api/v1/display/clear',{method:'POST'})
  .then(function(){flash('pxStat','Back to the clock')})
  .catch(function(e){flash('pxStat',e.message,'err')});
};
// ---- OTA ----
$('otaGo').onclick=function(){
  var f=$('otaFile').files[0];
  if(!f){flash('otaStat','Pick a .bin first','err');return}
  var xhr=new XMLHttpRequest();
  xhr.open('POST','/update');
  xhr.setRequestHeader('Authorization','Bearer '+tok());
  xhr.upload.onprogress=function(e){
    if(e.lengthComputable)$('otaBar').style.width=(e.loaded/e.total*100)+'%'};
  xhr.onload=function(){
    var d={};try{d=JSON.parse(xhr.responseText)}catch(e){}
    if(xhr.status===200&&d.ok){
      $('otaStat').textContent='Flashed! Device rebooting…';
      $('otaStat').className='stat ok';
      var tries=0,t=setInterval(function(){
        fetch('/api/v1/health').then(function(r){
          if(r.ok){clearInterval(t);location.reload()}}).catch(function(){});
        if(++tries>40)clearInterval(t);
      },1500);
    } else { flash('otaStat',d.error||('HTTP '+xhr.status),'err');
             $('otaBar').style.width='0' }
  };
  xhr.onerror=function(){flash('otaStat','Upload failed','err')};
  var fd=new FormData();fd.append('firmware',f,f.name);
  $('otaStat').textContent='Uploading…';$('otaStat').className='stat';
  xhr.send(fd);
};
// ---- flights app config ----
function loadFlights(){
  api('/api/v1/apps/flights').then(function(d){
    $('flUrl').value=d.url||'';
    $('flInt').value=d.interval_s;$('flIntV').textContent=d.interval_s;
    $('flRows').value=d.rows;$('flFmt').value=d.format;
    if(d.view)$('flView').value=d.view;
  }).catch(function(){});
}
$('flInt').oninput=function(){$('flIntV').textContent=this.value};
$('flScan').onclick=function(){
  var self=this;self.disabled=true;self.textContent='Scanning…';
  $('flScanStat').textContent='The device is sweeping your LAN for a receiver — ~10s.';
  $('flScanStat').className='stat';
  api('/api/v1/apps/flights/scan',{method:'POST'}).then(function(d){
    self.disabled=false;self.textContent='Scan my network';
    if(d.found){ $('flUrl').value=d.found;
      flash('flScanStat','Found it — hit Save to keep it.'); }
    else flash('flScanStat','No receiver answered — type the URL in.','err');
  }).catch(function(e){ self.disabled=false;self.textContent='Scan my network';
    flash('flScanStat',e.message,'err') });
};
$('flSave').onclick=function(){
  api('/api/v1/apps/flights',{method:'POST',body:JSON.stringify({
    url:$('flUrl').value.trim(),interval_s:+$('flInt').value,
    rows:+$('flRows').value,format:$('flFmt').value,
    view:$('flView').value})})
  .then(function(){flash('flStat','Saved to the device')})
  .catch(function(e){flash('flStat',e.message,'err')});
};
var flCmd="DMX_URL=http://"+(location.host||'dmx-xxxx.local')+
  " DMX_TOKEN=$TOKEN node examples/flights-overhead.mjs";
$('flCmd').textContent=flCmd;
$('flCp').onclick=function(){copyText(flCmd.replace('$TOKEN',tok()));
  this.textContent='Copied!'};
loadFlights();
// ---- settings ----
api('/api/v1/settings').then(function(d){$('tz').value=d.tz}).catch(function(){});
$('tz').onchange=function(){
  api('/api/v1/settings',{method:'POST',body:JSON.stringify({tz:this.value})})
  .then(function(){flash('setStat','Timezone saved')})
  .catch(function(e){flash('setStat',e.message,'err')});
};
$('rotate').onclick=function(){
  api('/api/v1/token/rotate',{method:'POST'}).then(function(d){
    localStorage.setItem('dmx_token',d.token);
    var e=$('newTok');e.textContent='New token (saved in this browser): '+d.token;
    e.classList.remove('hide');
    flash('setStat','Token rotated — other clients must re-pair');
  }).catch(function(e){flash('setStat',e.message,'err')});
};
$('reboot').onclick=function(){
  api('/api/v1/reboot',{method:'POST'}).catch(function(){});
  flash('setStat','Rebooting… back in ~15s');
};
function twoTap(id,label,fn){var armed=false;
  $(id).onclick=function(){
    if(!armed){armed=true;this.textContent='Tap again to confirm';
      var self=this;setTimeout(function(){armed=false;self.textContent=label},3000);
      return}
    fn(); this.textContent=label; armed=false;
  }}
twoTap('wifiReset','Change Wi-Fi…',function(){
  api('/api/v1/wifi/reset',{method:'POST'}).catch(function(){});
  flash('setStat','Rebooting into the DEVMATRIX setup hotspot');
});
twoTap('facReset','Factory reset…',function(){
  api('/api/v1/factory/reset',{method:'POST'}).catch(function(){});
  flash('setStat','Wiped. It boots factory-fresh (setup hotspot, new pairing).');
});
// ---- API examples ----
var host=location.host||'dmx-xxxx.local';
var ex1="curl -X POST http://"+host+"/api/v1/display/text \\\n"+
  "  -H 'Authorization: Bearer $TOKEN' \\\n"+
  "  -H 'Content-Type: application/json' \\\n"+
  "  -d '{\"text\":\"SHIP IT\",\"duration_s\":30}'";
var ex2="curl http://"+host+"/api/v1/info \\\n"+
  "  -H 'Authorization: Bearer $TOKEN'";
$('ex1').textContent=ex1; $('ex2').textContent=ex2;
$('cp1').onclick=function(){copyText(ex1.replace('$TOKEN',tok()));
  this.textContent='Copied!'};
$('cp2').onclick=function(){copyText(ex2.replace('$TOKEN',tok()));
  this.textContent='Copied!'};
refresh();
</script></body></html>
)HTML";
