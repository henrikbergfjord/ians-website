import {
  PublicClientApplication,
  InteractionRequiredAuthError
} from "https://cdn.jsdelivr.net/npm/@azure/msal-browser@5/+esm";

console.info("[IANS] V2.8.4 Web Edition + Download & Verify JavaScript startet");
const GRAPH = "https://graph.microsoft.com/v1.0";
const SCOPES = ["Files.Read"];
const V24_WRITE_SCOPES = ["Files.ReadWrite"];
const CLIENT_KEY = "ians_onedrive_analyzer_client_id";
const CLIENT_BACKUP_KEY = "ians_onedrive_analyzer_client_id_backup";
// ===== V2.9.0 PUBLIC CLIENT CONFIG =====
window.IANS_V290_CONFIG = {
  clientId: "986e5cdb-dab1-4b3f-8db0-8fe7214a19b3",
  ownerUsername: "henrik.bergfjord@outlook.com",
  betaGateEnabled: false,
  betaGateHash: "532eaabd9574880dbf76b9b8cc00832c20a6ec113d682299550d7a6e0f345e25",
  entitlementEndpoint: ""
};
const IANS_PUBLIC_CLIENT_ID = window.IANS_V290_CONFIG.clientId;


const APP_BASE_URL = (() => {
  const u = new URL(window.location.href);
  u.search = "";
  u.hash = "";
  if (u.pathname.endsWith("/")) return u;
  if (/\/[^/]+\.[a-z0-9]+$/i.test(u.pathname)) {
    u.pathname = u.pathname.replace(/[^/]+$/, "");
    return u;
  }
  u.pathname = `${u.pathname}/`;
  return u;
})();
const APP_REDIRECT_URI = APP_BASE_URL.href;
const POPUP_REDIRECT_URI = new URL("auth-callback.html", APP_BASE_URL).href;
const IANS_WEB_EDITION = !["localhost","127.0.0.1"].includes(window.location.hostname);

const IS_MSAL_POPUP_CALLBACK = Boolean(
  window.opener &&
  (
    /(?:^|[?#&])(code|state|error|error_description)=/i.test(window.location.href) ||
    window.location.hash.includes("code=") ||
    window.location.search.includes("code=")
  )
);

function recoverClientIdState() {
  const main = localStorage.getItem(CLIENT_KEY);
  const backup = localStorage.getItem(CLIENT_BACKUP_KEY);
  const id = IANS_PUBLIC_CLIENT_ID || main || backup || "";
  if (id) {
    if (!main) localStorage.setItem(CLIENT_KEY, id);
    if (!backup) localStorage.setItem(CLIENT_BACKUP_KEY, id);
  }
  return id;
}

const $ = (id) => document.getElementById(id);
const els = {
  setupPanel: $("setupPanel"), loginPanel: $("loginPanel"), dashboard: $("dashboard"),
  clientIdInput: $("clientIdInput"), redirectUri: $("redirectUri"), saveClientIdBtn: $("saveClientIdBtn"),
  copyRedirectBtn: $("copyRedirectBtn"), setupMessage: $("setupMessage"), settingsBtn: $("settingsBtn"),
  signInBtn: $("signInBtn"), signOutBtn: $("signOutBtn"), scanBtn: $("scanBtn"), cancelBtn: $("cancelBtn"),
  accountName: $("accountName"), accountUser: $("accountUser"), progressPanel: $("progressPanel"),
  progressTitle: $("progressTitle"), progressNumbers: $("progressNumbers"), progressPath: $("progressPath"),
  progressBar: $("progressBar"), quotaUsed: $("quotaUsed"), quotaTotal: $("quotaTotal"),
  fileCount: $("fileCount"), fileSize: $("fileSize"), folderCount: $("folderCount"), folderHint: $("folderHint"),
  duplicateCount: $("duplicateCount"), duplicateSize: $("duplicateSize"), typeChart: $("typeChart"),
  yearChart: $("yearChart"), foldersTable: $("foldersTable"), filesTable: $("filesTable"),
  duplicatesTable: $("duplicatesTable"), exportBtn: $("exportBtn"), takenDateCount: $("takenDateCount"),
  createdDateCount: $("createdDateCount"), unknownDateCount: $("unknownDateCount")
};

let msalApp = null;
let activeAccount = null;
let cancelRequested = false;
let report = null;

function currentRedirectUri() {
  return APP_REDIRECT_URI;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[ch]));
}

function formatBytes(bytes = 0) {
  const n = Number(bytes) || 0;
  if (n === 0) return "0 B";
  const units = ["B","KB","MB","GB","TB","PB"];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  return `${(n / Math.pow(1024, i)).toFixed(i >= 3 ? 2 : 1)} ${units[i]}`;
}

function formatNumber(n = 0) {
  return new Intl.NumberFormat("nb-NO").format(n);
}

function extOf(name = "") {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "(uten endelse)";
}

function categoryOf(name, mime = "") {
  const ext = extOf(name);
  const image = new Set(["jpg","jpeg","png","gif","webp","heic","heif","tif","tiff","bmp","raw","dng"]);
  const video = new Set(["mp4","mov","m4v","avi","mkv","wmv","mts","m2ts","3gp","webm"]);
  const audio = new Set(["mp3","m4a","aac","wav","flac","ogg","wma"]);
  const docs = new Set(["doc","docx","pdf","txt","rtf","odt","pages"]);
  const sheets = new Set(["xls","xlsx","csv","ods","numbers"]);
  const slides = new Set(["ppt","pptx","odp","key"]);
  const archives = new Set(["zip","7z","rar","tar","gz","bz2","xz","iso","dmg","pkg"]);
  if (image.has(ext) || mime.startsWith("image/")) return "Bilder";
  if (video.has(ext) || mime.startsWith("video/")) return "Video";
  if (audio.has(ext) || mime.startsWith("audio/")) return "Lyd";
  if (docs.has(ext)) return "Dokumenter";
  if (sheets.has(ext)) return "Regneark";
  if (slides.has(ext)) return "Presentasjoner";
  if (archives.has(ext)) return "Arkiv / installasjon";
  return "Annet";
}

async function initMsal() {
  if (IS_MSAL_POPUP_CALLBACK) return;

  const clientId = (
    IANS_PUBLIC_CLIENT_ID ||
    localStorage.getItem(CLIENT_KEY) ||
    localStorage.getItem(CLIENT_BACKUP_KEY) ||
    ""
  ).trim();

  els.redirectUri.textContent = APP_REDIRECT_URI;

  if (!clientId) {
    els.setupPanel.classList.remove("hidden");
    els.loginPanel.classList.add("hidden");
    els.dashboard.classList.add("hidden");
    els.clientIdInput.disabled = false;
    els.clientIdInput.readOnly = false;
    return;
  }

  localStorage.setItem(CLIENT_KEY, clientId);
  localStorage.setItem(CLIENT_BACKUP_KEY, clientId);
  els.clientIdInput.value = clientId;

  msalApp = new PublicClientApplication({
    auth: {
      clientId,
      authority: "https://login.microsoftonline.com/common",
      redirectUri: APP_REDIRECT_URI,
      postLogoutRedirectUri: APP_REDIRECT_URI,
      navigateToLoginRequestUrl: false
    },
    cache: {
      cacheLocation: "localStorage",
      storeAuthStateInCookie: false
    },
    system: {
      allowRedirectInIframe: false
    }
  });

  try {
    await msalApp.initialize();

    // V3.12.8: process a full-page MSAL redirect before reading accounts.
    // This avoids Edge popup/hidden-iframe stalls during scan startup.
    let redirectResult = null;
    try {
      redirectResult = await msalApp.handleRedirectPromise();
    } catch (redirectErr) {
      console.error("[IANS V3.12.8] redirect auth result", redirectErr);
      sessionStorage.setItem("ians_scan_auth_error", String(redirectErr?.message || redirectErr));
    }

    const accounts = msalApp.getAllAccounts();
    activeAccount = redirectResult?.account || msalApp.getActiveAccount() || accounts[0] || null;
    if (activeAccount) msalApp.setActiveAccount(activeAccount);
    if (redirectResult?.accessToken) {
      try { iansCacheAuthResult(redirectResult); } catch {}
    }

    els.setupPanel.classList.add("hidden");
    if (activeAccount) showDashboard();
    else showLogin();
  } catch (err) {
    console.error("MSAL popup init error", err);
    els.setupMessage.textContent = `MSAL-feil: ${err.message}`;
    els.setupPanel.classList.remove("hidden");
    els.loginPanel.classList.add("hidden");
    els.dashboard.classList.add("hidden");
  }
}
function showLogin() {
  els.loginPanel.classList.remove("hidden");
  els.dashboard.classList.add("hidden");
  els.signOutBtn.classList.add("hidden");
}

function showDashboard() {
  els.loginPanel.classList.add("hidden");
  els.dashboard.classList.remove("hidden");
  els.signOutBtn.classList.remove("hidden");
  els.accountName.textContent = activeAccount?.name || "Microsoft-konto";
  els.accountUser.textContent = activeAccount?.username || "";
  loadDriveQuota().catch(console.error);
}

async function signIn() {
  if (!msalApp) {
    els.setupMessage.textContent = "Lagre Client ID først.";
    els.setupPanel.classList.remove("hidden");
    return;
  }

  try {
    const result = await msalApp.loginPopup({
      scopes: ["User.Read", ...SCOPES],
      prompt: "select_account",
      redirectUri: POPUP_REDIRECT_URI
    });

    if (!result?.account) throw new Error("Microsoft returnerte ingen konto.");

    activeAccount = result.account;
    msalApp.setActiveAccount(activeAccount);
    showDashboard();
  } catch (err) {
    console.error("Login popup error", err);
    const old = document.getElementById("loginError");
    if (old) old.remove();
    const p = document.createElement("p");
    p.id = "loginError";
    p.className = "message";
    p.textContent = `Innlogging feilet: ${err.message}`;
    els.loginPanel.appendChild(p);
  }
}
const iansSleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// ===== V3.13 CLEAN AUTH + GRAPH PATH =====
// Scan uses the already connected Microsoft account. No scan-specific popup,
// redirect, hidden preflight, token broker, or nested token retry loops.
async function getToken() {
  if (!msalApp) throw new Error("Microsoft-tilkoblingen er ikke initialisert.");
  if (!activeAccount) {
    activeAccount = msalApp.getActiveAccount?.() || msalApp.getAllAccounts?.()?.[0] || null;
    if (activeAccount) msalApp.setActiveAccount?.(activeAccount);
  }
  if (!activeAccount) throw new Error("Ingen Microsoft-konto er koblet til. Logg inn på nytt.");
  const request = { scopes: SCOPES, account: activeAccount };
  try {
    iansScanStage?.("AUTH", "bruker eksisterende Microsoft-økt");
    const result = await msalApp.acquireTokenSilent(request);
    if (!result?.accessToken) throw new Error("Microsoft returnerte ikke access token.");
    return result.accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError || /interaction_required|login_required|consent_required/i.test(String(err?.errorCode||err?.message||""))) {
      throw new Error("Microsoft-økten må fornyes. Logg ut og koble til OneDrive på nytt.");
    }
    throw err;
  }
}

async function graphFetch(url, attempt = 0) {
  if (cancelRequested) throw new Error("SCAN_CANCELLED");
  const token = await getToken();
  const target = url.startsWith("http") ? url : `${GRAPH}${url}`;
  const response = await fetch(target, { headers: { Authorization: `Bearer ${token}` } });

  if ([429, 500, 502, 503, 504].includes(response.status) && attempt < 5) {
    const retryAfter = Number(response.headers.get("Retry-After")) || Math.min(2 ** attempt, 20);
    updateScanMeter?.(Math.round(scanVisualPct||5), `Microsoft Graph er opptatt · nytt forsøk ${attempt+2}/6`);
    await iansSleep(retryAfter * 1000);
    return graphFetch(url, attempt + 1);
  }
  if (!response.ok) {
    let detail=""; try { detail=JSON.stringify(await response.json()); } catch {}
    throw new Error(`Graph ${response.status}: ${detail||response.statusText}`);
  }
  return response.json();
}
// ===== END V3.13 CLEAN AUTH + GRAPH PATH =====

// ===== V3.12.6 SCAN START DIAGNOSTICS =====
const IANS_SCAN_STAGES=["READY","AUTH","DRIVE","ROOT","CHECKPOINT","ENUMERATION","COMPLETE"];
function iansScanStage(stage,detail=""){
  window.__iansScanStage={stage,detail,time:new Date().toISOString()};
  const el=document.getElementById("iansScanStageLine");
  if(el)el.textContent=`${stage}${detail?" · "+detail:""}`;
  console.info(`[IANS SCAN ${stage}]`,detail||"");
}
function iansEnsureScanDiagnostics(){
  if(document.getElementById("iansScanStageLine"))return;
  const host=document.querySelector("#v30Content")||document.querySelector("#progressPanel")||document.body;
  const bar=document.createElement("div");
  bar.id="iansScanDiagnostics";
  bar.className="ians-scan-diagnostics";
  bar.innerHTML=`<span>SCAN START</span><strong id="iansScanStageLine">READY · v3.13</strong><small>AUTH → DRIVE → ROOT → CHECKPOINT → ENUMERATION</small>`;
  host.prepend(bar);
}
setTimeout(iansEnsureScanDiagnostics,900);
// ===== END V3.12.6 SCAN START DIAGNOSTICS =====

async function loadDriveQuota() {
  const drive = await graphFetch("/me/drive?$select=id,driveType,name,quota");
  const q = drive.quota || {};
  els.quotaUsed.textContent = formatBytes(q.used || 0);
  els.quotaTotal.textContent = q.total
    ? `${formatBytes(q.total)} totalt · ${formatBytes(q.remaining || 0)} ledig`
    : "Kvotedata ikke tilgjengelig";
}

function childrenUrl(folderId = null) {
  const select = encodeURIComponent("id,name,size,folder,file,image,photo,createdDateTime,lastModifiedDateTime,webUrl,parentReference");
  return folderId
    ? `${GRAPH}/me/drive/items/${encodeURIComponent(folderId)}/children?$top=200&$select=${select}`
    : `${GRAPH}/me/drive/root/children?$top=200&$select=${select}`;
}

async function listAllChildren(folderId) {
  const items = [];
  let url = childrenUrl(folderId);
  while (url) {
    const data = await graphFetch(url);
    items.push(...(data.value || []));
    url = data["@odata.nextLink"] || null;
  }
  return items;
}

function addFolderBytes(folderAgg, path, bytes) {
  if (!bytes) return;
  const parts = path.split("/").filter(Boolean);
  let current = "";
  folderAgg.set("/", (folderAgg.get("/") || 0) + bytes);
  for (const part of parts) {
    current += "/" + part;
    folderAgg.set(current, (folderAgg.get(current) || 0) + bytes);
  }
}

function scanEstimatedPct(processed, queued, done=false){
  if(done){scanVisualPct=100;return 100}
  const denom=Math.max(processed+queued+20,1);
  const candidate=5+90*(processed/denom);
  scanVisualPct=Math.max(scanVisualPct||5,Math.min(95,candidate));
  return Math.round(scanVisualPct);
}
function updateScanMeter(pct,label){
  const meter=document.getElementById("scanJobMeter"),pctEl=document.getElementById("scanJobPct"),phase=document.getElementById("scanJobPhase");
  if(meter)meter.style.setProperty("--p",`${pct}%`);
  if(pctEl)pctEl.textContent=`${pct}%`;
  if(phase&&label)phase.textContent=label;
}
function updateProgress(stats, queueLen, path, processed=0) {
  els.progressNumbers.textContent = `${formatNumber(stats.files)} filer · ${formatNumber(stats.folders)} mapper · ${formatBytes(stats.bytes)}`;
  els.progressPath.textContent = path || "Leser…";
  const pct=scanEstimatedPct(processed,queueLen,false);
  els.progressBar.style.width = `${pct}%`;
  updateScanMeter(pct,"Kartlegger oppdagede mapper");
  els.progressTitle.textContent = queueLen ? `Kartlegger… ${formatNumber(queueLen)} mapper i kø` : "Fullfører analyse…";
}



// ===== V2.5 SCAN CONTROL + CHECKPOINT =====
const SCAN_DB_NAME = "ians_onedrive_scan_v25";
const SCAN_DB_STORE = "checkpoints";
const SCAN_DB_KEY = "active";
let scanTimerHandle = null;
let scanStartedDate = null;
let scanVisualPct = 0;
let scanRunningV38 = false;
let selectedScanFolder = {id:null,path:"/"};
let selectedDownloadFolder = {id:null,path:"/",name:"OneDrive"};
let folderBrowserPurpose = "scan";
let browserStack = [{id:null,path:"/"}];

function scanDbOpen(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(SCAN_DB_NAME,1);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(SCAN_DB_STORE))db.createObjectStore(SCAN_DB_STORE);
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function saveScanCheckpoint(state){
  try{
    const db=await scanDbOpen();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(SCAN_DB_STORE,"readwrite");
      tx.objectStore(SCAN_DB_STORE).put(state,SCAN_DB_KEY);
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
    });
    db.close();
    document.getElementById("scanCheckpointTime").textContent=new Date().toLocaleTimeString("nb-NO");
    await refreshCheckpointUi();
  }catch(e){console.warn("Checkpoint save failed",e)}
}
async function loadScanCheckpoint(){
  try{
    const db=await scanDbOpen();
    const value=await new Promise((resolve,reject)=>{
      const tx=db.transaction(SCAN_DB_STORE,"readonly");
      const req=tx.objectStore(SCAN_DB_STORE).get(SCAN_DB_KEY);
      req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);
    });
    db.close();return value;
  }catch(e){return null}
}
async function clearScanCheckpoint(){
  try{
    const db=await scanDbOpen();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(SCAN_DB_STORE,"readwrite");
      tx.objectStore(SCAN_DB_STORE).delete(SCAN_DB_KEY);
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
    });
    db.close();
  }catch(e){}
  await refreshCheckpointUi();
}
function formatElapsed(ms){
  const s=Math.max(0,Math.floor(ms/1000));
  const h=String(Math.floor(s/3600)).padStart(2,"0");
  const m=String(Math.floor((s%3600)/60)).padStart(2,"0");
  const sec=String(s%60).padStart(2,"0");
  return `${h}:${m}:${sec}`;
}
function startScanClock(startIso=null){
  if(scanTimerHandle)clearInterval(scanTimerHandle);
  scanStartedDate=startIso?new Date(startIso):new Date();
  document.getElementById("scanStartedAt").textContent=scanStartedDate.toLocaleTimeString("nb-NO");
  const tick=()=>document.getElementById("scanElapsed").textContent=formatElapsed(Date.now()-scanStartedDate.getTime());
  tick();scanTimerHandle=setInterval(tick,1000);
}
function stopScanClock(){
  if(scanTimerHandle){clearInterval(scanTimerHandle);scanTimerHandle=null}
}
function drawScanDonut(processed,queued,files){
  const canvas=document.getElementById("scanDonut");
  if(!canvas)return;
  const ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height,cx=w/2,cy=h/2,r=82;
  ctx.clearRect(0,0,w,h);
  ctx.lineWidth=22;
  ctx.strokeStyle="#122a3f";
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();
  const denom=Math.max(processed+queued,1);
  const pct=processed/denom;
  ctx.strokeStyle="#58a9df";ctx.lineCap="round";
  ctx.beginPath();ctx.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+Math.PI*2*pct);ctx.stroke();
  document.getElementById("scanDonutFiles").textContent=formatNumber(files||0);
}
function updateLiveScanStats(stats,processed,queued,path){
  document.getElementById("processedFoldersLive").textContent=formatNumber(processed);
  document.getElementById("queuedFoldersLive").textContent=formatNumber(queued);
  document.getElementById("scannedBytesLive").textContent=formatBytes(stats.bytes||0);
  document.getElementById("activeFolderLive").textContent=path||"/";
  drawScanDonut(processed,queued,stats.files||0);
}
async function refreshCheckpointUi(){
  const cp=await loadScanCheckpoint();
  const resume=document.getElementById("resumeScanBtn"),discard=document.getElementById("discardCheckpointBtn"),sum=document.getElementById("checkpointSummary");
  const valid=!!(cp&&cp.queue&&cp.queue.length);
  resume.disabled=!valid;discard.disabled=!valid;
  if(valid){
    sum.textContent=`${formatNumber(cp.stats?.files||0)} filer · ${formatNumber(cp.processedFolders||0)} mapper ferdig · lagret ${new Date(cp.savedAt).toLocaleString("nb-NO")}`;
  }else{
    sum.textContent="Ingen lagret skanning.";
  }
}


function iansTop25Insert(top,file){
  top.push(file);
  top.sort((a,b)=>b.size-a.size);
  if(top.length>25)top.length=25;
}

async function scanOneDrive(resumeState=null) {
  iansEnsureScanDiagnostics();
  iansScanStage("READY",resumeState?"Resume starter":"Full scan starter");
  cancelRequested=false;
  const scanRunToken=(window.__iansScanRunToken=(Number(window.__iansScanRunToken)||0)+1);
  window.__iansScanHeartbeat=Date.now();
  scanVisualPct=resumeState?Math.max(5,Number(resumeState.visualPct)||5):5;
  updateScanMeter(Math.round(scanVisualPct),resumeState?"Fortsetter kartlegging":"Starter kartlegging");
  report=null;
  els.scanBtn.disabled=true;
  els.cancelBtn.classList.remove("hidden");
  els.progressPanel.classList.remove("hidden");
  els.exportBtn.disabled=true;
  els.progressBar.style.width="8%";
  document.getElementById("scanStateBadge").textContent="SKANNER";
  if(window.__iansScanLiveState){
    window.__iansScanLiveState.status="running";
    window.__iansScanLiveState.startedAt=Date.now();
    window.__iansScanLiveState.pct=Math.max(1,Math.round(scanVisualPct||1));
  }

  let stats={files:0,folders:0,bytes:0};
  let files=[];
  let largestFilesTop=[];
  let folderAgg=new Map();
  let queue=[];
  let typeAgg=new Map();
  let yearAgg=new Map();
  let duplicateMap=new Map();
  let dateStats={taken:0,created:0,unknown:0};
  let processedFolders=0;
  let recoveryStats={missingFolders:0,prunedQueuedFolders:0,retries:0,lastMissingPath:null};
  let emptyFolders=[];
  let scanRoot={id:null,path:"/"};
  let scanStartedAt=new Date().toISOString();
  let lastCheckpoint=Date.now();

  if(resumeState){
    stats=resumeState.stats||stats;
    files=resumeState.files||[];
    folderAgg=new Map(resumeState.folderAgg||[]);
    queue=resumeState.queue||[];
    typeAgg=new Map(resumeState.typeAgg||[]);
    yearAgg=new Map(resumeState.yearAgg||[]);
    dateStats=resumeState.dateStats||dateStats;
    processedFolders=resumeState.processedFolders||0;
    recoveryStats={...recoveryStats,...(resumeState.recoveryStats||{})};
    emptyFolders=resumeState.emptyFolders||[];
    scanRoot=resumeState.scanRoot||scanRoot;
    scanStartedAt=resumeState.scanStartedAt||scanStartedAt;
    duplicateMap=new Map();
    largestFilesTop=[];
    for(const f of files){
      const k=`${f.name.toLowerCase()}|${f.size}`;
      const dg=duplicateMap.get(k);
      if(dg){
        dg.count++;
        dg.potentialSavings+=f.size;
        if(dg.paths.length<8)dg.paths.push(f.path);
      }else{
        duplicateMap.set(k,{name:f.name,sizeEach:f.size,count:1,potentialSavings:0,paths:[f.path]});
      }
      iansTop25Insert(largestFilesTop,f);
    }
    els.progressTitle.textContent="Fortsetter kartlegging…";
  }else{
    const mode=document.querySelector('input[name="scanScope"]:checked')?.value||"all";
    scanRoot=mode==="folder"?selectedScanFolder:{id:null,path:"/"};
    queue=[{id:scanRoot.id,path:scanRoot.path,driveId:null,lastModifiedDateTime:null}];
    // V3.13: do not block scan startup behind a separate auth/root preflight.
    // The first real enumeration call proves the connection, as in the working engine.
    iansScanStage("CHECKPOINT","ny scan klargjort");
    await clearScanCheckpoint();
  }

  startScanClock(scanStartedAt);

  async function checkpoint(force=false){
    if(!force && Date.now()-lastCheckpoint<7000)return;
    lastCheckpoint=Date.now();
    await saveScanCheckpoint({
      version:"2.5",
      account:activeAccount?.username||"",
      savedAt:new Date().toISOString(),
      scanStartedAt,
      scanRoot,
      stats,
      files,
      folderAgg:[...folderAgg.entries()],
      queue,
      typeAgg:[...typeAgg.entries()],
      yearAgg:[...yearAgg.entries()],
      dateStats,
      processedFolders,
      recoveryStats,
      emptyFolders,
      visualPct:scanVisualPct
    });
  }

  // V3.12.2: expose a safe checkpoint hook and protect scans across browser/macOS sleep.
  window.__iansForceScanCheckpoint=()=>checkpoint(true);
  let scanHiddenAt=0;
  const scanLifecycleHidden=()=>{
    scanHiddenAt=Date.now();
    window.__iansScanHiddenAt=scanHiddenAt;
    checkpoint(true).catch(err=>console.warn("[IANS V3.12.2] lifecycle checkpoint",err));
  };
  const scanLifecycleVisible=()=>{
    if(document.visibilityState!=="visible" || !scanHiddenAt)return;
    const sleptFor=Date.now()-scanHiddenAt;
    scanHiddenAt=0;
    if(sleptFor<20000)return;
    // A closed Mac lid suspends JavaScript and network requests. Do not pretend the scan kept running.
    // Invalidate this run, save what we have and unlock Resume. The stale run is ignored if its Graph call later returns.
    checkpoint(true).catch(()=>{});
    window.__iansScanRunToken=(Number(window.__iansScanRunToken)||0)+1;
    cancelRequested=true;
    try{ if(typeof scanRunningV38!=="undefined") scanRunningV38=false; }catch{}
    const badge=document.getElementById("scanStateBadge"); if(badge)badge.textContent="PAUSET";
    updateScanMeter(Math.round(scanVisualPct||5),"Mac/PC var i dvale · Resume klar");
    if(els?.progressTitle)els.progressTitle.textContent="Kartlegging pauset etter dvale";
    if(els?.progressPath)els.progressPath.textContent="Checkpoint er lagret. Trykk Resume for å fortsette trygt.";
    setTimeout(()=>refreshCheckpointUi?.(),120);
    if(typeof iansToast==="function")iansToast("Scan satt på pause","Mac/PC var i dvale. Checkpoint er bevart – trykk Resume for å fortsette.","success",9000);
  };
  const scanVisibilityHandler=()=>{document.visibilityState==="hidden"?scanLifecycleHidden():scanLifecycleVisible()};
  document.addEventListener("visibilitychange",scanVisibilityHandler);
  window.addEventListener("pagehide",scanLifecycleHidden);
  document.addEventListener("freeze",scanLifecycleHidden);

  try{
    iansScanStage("ENUMERATION",`starter med ${queue.length} mappe(r) i kø`);
    while(queue.length){
      window.__iansScanHeartbeat=Date.now();
      if(scanRunToken!==window.__iansScanRunToken){
        await checkpoint(true);
        throw new Error("SCAN_SLEEP_INTERRUPTED");
      }
      if(cancelRequested){
        await checkpoint(true);
        throw new Error("SCAN_CANCELLED");
      }

      const folder=queue.shift();
      updateProgress(stats,queue.length,folder.path,processedFolders);
      updateLiveScanStats(stats,processedFolders,queue.length,folder.path);

      let children;
      try{
        children=await listAllChildren(folder.id);
        window.__iansScanHeartbeat=Date.now();
        if(scanRunToken!==window.__iansScanRunToken){
          await checkpoint(true);
          throw new Error("SCAN_SLEEP_INTERRUPTED");
        }
      }catch(err){
        const msg=String(err?.message||err||"");
        // OneDrive can change during a multi-hour scan. A queued folder may have
        // been moved/deleted after it was discovered. This is recoverable.
        if(/Graph\s+(404|410)\b/i.test(msg) || /itemNotFound/i.test(msg)){
          recoveryStats.missingFolders++;
          recoveryStats.lastMissingPath=folder.path;
          const prefix=folder.path==="/"?"/":folder.path.replace(/\/$/,"")+"/";
          const before=queue.length;
          queue=queue.filter(q=>!(q.path===folder.path || String(q.path||"").startsWith(prefix)));
          recoveryStats.prunedQueuedFolders += before-queue.length;
          processedFolders++;
          console.warn("IANS scan recovery: hopper over manglende mappe",folder.path,err);
          els.progressPath.textContent=`Hoppet over flyttet/slettet mappe: ${folder.path}`;
          updateLiveScanStats(stats,processedFolders,queue.length,folder.path);
          await checkpoint(true);
          continue;
        }
        throw err;
      }
      if(folder.id && children.length===0 && !emptyFolders.some(x=>x.id===folder.id)){
        emptyFolders.push({id:folder.id,path:folder.path,driveId:folder.driveId||null,lastModifiedDateTime:folder.lastModifiedDateTime||null});
      }
      processedFolders++;

      for(const item of children){
        const itemPath=folder.path==="/"?`/${item.name}`:`${folder.path}/${item.name}`;

        if(item.folder){
          stats.folders++;
          queue.push({id:item.id,path:itemPath,driveId:item.parentReference?.driveId||null,lastModifiedDateTime:item.lastModifiedDateTime||null});
          if(!folderAgg.has(itemPath))folderAgg.set(itemPath,0);
          continue;
        }
        if(!item.file)continue;

        const size=Number(item.size)||0;
        stats.files++;
        stats.bytes+=size;
        addFolderBytes(folderAgg,folder.path,size);

        const mime=item.file?.mimeType||"";
        const category=categoryOf(item.name,mime);
        const typeCurrent=typeAgg.get(category)||{count:0,bytes:0};
        typeCurrent.count++;typeCurrent.bytes+=size;typeAgg.set(category,typeCurrent);

        const taken=item.photo?.takenDateTime||null;
        const created=item.createdDateTime||null;
        const dateValue=taken||created||null;
        if(taken)dateStats.taken++;else if(created)dateStats.created++;else dateStats.unknown++;

        if((category==="Bilder"||category==="Video")&&dateValue){
          const year=new Date(dateValue).getUTCFullYear();
          if(Number.isFinite(year)&&year>=1900&&year<=2200)yearAgg.set(year,(yearAgg.get(year)||0)+1);
        }

        const hashes=item.file?.hashes||{};
        const f={
          id:item.id,name:item.name,path:itemPath,parentPath:folder.path,size,category,mimeType:mime,
          driveId:item.parentReference?.driveId||null,
          createdDateTime:created,lastModifiedDateTime:item.lastModifiedDateTime||null,
          takenDateTime:taken,webUrl:item.webUrl||null,
          cameraMake:item.photo?.cameraMake||null,cameraModel:item.photo?.cameraModel||null,
          quickXorHash:hashes.quickXorHash||null,sha1Hash:hashes.sha1Hash||null,crc32Hash:hashes.crc32Hash||null
        };
        files.push(f);

        const dKey=`${item.name.toLowerCase()}|${size}`;
        const dg=duplicateMap.get(dKey);
        if(dg){
          dg.count++;
          dg.potentialSavings+=size;
          if(dg.paths.length<8)dg.paths.push(itemPath);
        }else{
          duplicateMap.set(dKey,{name:item.name,sizeEach:size,count:1,potentialSavings:0,paths:[itemPath]});
        }
        iansTop25Insert(largestFilesTop,f);
      }

      updateLiveScanStats(stats,processedFolders,queue.length,folder.path);
      await checkpoint(false);
    }

    const duplicates=[...duplicateMap.values()]
      .filter(group=>group.count>1&&group.sizeEach>0)
      .map(group=>({name:group.name,sizeEach:group.sizeEach,copies:group.count,potentialSavings:group.potentialSavings,paths:group.paths}))
      .sort((a,b)=>b.potentialSavings-a.potentialSavings);

    const folders=[...folderAgg.entries()]
      .filter(([path])=>path!=="/")
      .map(([path,bytes])=>({path,bytes}))
      .sort((a,b)=>b.bytes-a.bytes);

    const largestFiles=largestFilesTop;

    report={
      generatedAt:new Date().toISOString(),
      scanRoot,
      scanStartedAt,
      account:{name:activeAccount?.name||"",username:activeAccount?.username||""},
      summary:{
        files:stats.files,folders:stats.folders,fileBytes:stats.bytes,
        possibleDuplicateGroups:duplicates.length,
        possibleDuplicateSavings:duplicates.reduce((s,d)=>s+d.potentialSavings,0)
      },
      dateStats,
      hashStats:{withHash:files.filter(f=>!!(f.quickXorHash||f.sha1Hash||f.crc32Hash)).length,missingHash:files.filter(f=>!(f.quickXorHash||f.sha1Hash||f.crc32Hash)).length},
      types:[...typeAgg.entries()].map(([category,v])=>({category,...v})).sort((a,b)=>b.bytes-a.bytes),
      mediaYears:[...yearAgg.entries()].map(([year,count])=>({year,count})).sort((a,b)=>b.year-a.year),
      largestFolders:folders.slice(0,25),
      largestFiles,
      possibleDuplicates:duplicates.slice(0,200),
      emptyFolders:emptyFolders.sort((a,b)=>(b.path.split("/").length-a.path.split("/").length)||String(a.path).localeCompare(String(b.path))),
      files
    };

    await clearScanCheckpoint();
    renderReport(report);
    updateLiveScanStats(stats,processedFolders,0,scanRoot.path);
    els.progressTitle.textContent="Kartlegging ferdig";
    els.progressPath.textContent=`${formatNumber(stats.files)} filer analysert fra ${scanRoot.path}.` + (recoveryStats.missingFolders ? ` ${formatNumber(recoveryStats.missingFolders)} manglende mapper hoppet over (${formatNumber(recoveryStats.prunedQueuedFolders)} utdaterte køelementer fjernet).` : "");
    els.progressBar.style.width="100%";
    updateScanMeter(100,"Kartlegging ferdig");
    iansScanStage("COMPLETE",`${stats.files} filer · ${stats.folders} mapper`);
    els.exportBtn.disabled=false;
    document.getElementById("scanStateBadge").textContent="FERDIG";
    if(window.__iansScanLiveState){window.__iansScanLiveState.status="done";window.__iansScanLiveState.pct=100;}
  }catch(err){
    if(err.message==="SCAN_CANCELLED" || err.message==="SCAN_SLEEP_INTERRUPTED"){
      els.progressTitle.textContent=err.message==="SCAN_SLEEP_INTERRUPTED"?"Kartlegging pauset etter dvale – checkpoint lagret":"Kartlegging stoppet – checkpoint lagret";
      els.progressPath.textContent="Trykk Resume for å fortsette senere.";
      document.getElementById("scanStateBadge").textContent="PAUSET";
      updateScanMeter(Math.round(scanVisualPct||5),"Pauset · klar for Resume");
      if(window.__iansScanLiveState)window.__iansScanLiveState.status="paused";
    }else{
      console.error(err);
      await checkpoint(true);
      const stageMsg=String(err?.message||err||"");
      const transient=iansTransientMicrosoftError(err) || /^TOKEN_STAGE:|^PREFLIGHT_STAGE:/i.test(stageMsg);
      if(transient){
        els.progressTitle.textContent="Microsoft-forbindelsen ble pauset – checkpoint beholdt";
        els.progressPath.textContent=/^TOKEN_STAGE:/i.test(stageMsg)
          ? "Token-kallet stoppet før selve filskanningen. Resume/checkpoint er bevart. Prøv Resume; hvis dette gjentar seg, logg ut og inn én gang."
          : /^PREFLIGHT_STAGE:/i.test(stageMsg)
            ? "Forbindelsestesten mot OneDrive root feilet før scanstart. Eksisterende checkpoint er ikke slettet."
            : "OneDrive svarte ikke etter flere forsøk. Trykk Resume; skanningen fortsetter fra checkpoint uten å starte på nytt.";
        document.getElementById("scanStateBadge").textContent="PAUSET";
        updateScanMeter(Math.round(scanVisualPct||5),"Midlertidig Microsoft-feil · Resume klar");
      }else{
        els.progressTitle.textContent="Feil under kartlegging – checkpoint lagret";
        els.progressPath.textContent=err.message;
        document.getElementById("scanStateBadge").textContent="CHECKPOINT";
        updateScanMeter(Math.round(scanVisualPct||5),"Feil · checkpoint lagret");
      }
      if(window.__iansScanLiveState)window.__iansScanLiveState.status="paused";
    }
  }finally{
    document.removeEventListener("visibilitychange",scanVisibilityHandler);
    window.removeEventListener("pagehide",scanLifecycleHidden);
    document.removeEventListener("freeze",scanLifecycleHidden);
    window.__iansForceScanCheckpoint=null;
    stopScanClock();
    els.scanBtn.disabled=false;
    els.cancelBtn.classList.add("hidden");
    await refreshCheckpointUi();
  }
}
function renderBars(container, rows, labelFn, valueFn, widthFn) {
  if (!rows.length) {
    container.className = "bars empty-state";
    container.textContent = "Ingen data.";
    return;
  }
  const max = Math.max(...rows.map(widthFn), 1);
  container.className = "bars";
  container.innerHTML = rows.map(row => {
    const width = Math.max(1.5, (widthFn(row) / max) * 100);
    return `<div class="bar-row">
      <div class="bar-label" title="${escapeHtml(labelFn(row))}">${escapeHtml(labelFn(row))}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${width.toFixed(2)}%"></div></div>
      <div class="bar-value">${escapeHtml(valueFn(row))}</div>
    </div>`;
  }).join("");
}

function renderTable(container, headers, rows) {
  if (!rows.length) {
    container.className = "table-wrap empty-state";
    container.textContent = "Ingen data.";
    return;
  }
  container.className = "table-wrap";
  container.innerHTML = `<table>
    <thead><tr>${headers.map(h => `<th${h.sortKey?` data-sort-key="${escapeHtml(h.sortKey)}" class="sortable-th" title="Klikk for å sortere"`:""}>${escapeHtml(h.label)}</th>`).join("")}</tr></thead>
    <tbody>
      ${rows.map(row => `<tr>${headers.map(h => {
        const value = h.render ? h.render(row) : escapeHtml(row[h.key] ?? "");
        return `<td class="${h.className || ""}">${value}</td>`;
      }).join("")}</tr>`).join("")}
    </tbody>
  </table>`;
}

function renderReport(r) {
  els.fileCount.textContent = formatNumber(r.summary.files);
  els.fileSize.textContent = `${formatBytes(r.summary.fileBytes)} summerte filstørrelser`;
  els.folderCount.textContent = formatNumber(r.summary.folders);
  els.folderHint.textContent = "undermapper kartlagt";
  els.duplicateCount.textContent = formatNumber(r.summary.possibleDuplicateGroups);
  els.duplicateSize.textContent = `${formatBytes(r.summary.possibleDuplicateSavings)} mulig plass`;

  els.takenDateCount.textContent = formatNumber(r.dateStats.taken);
  els.createdDateCount.textContent = formatNumber(r.dateStats.created);
  els.unknownDateCount.textContent = formatNumber(r.dateStats.unknown);

  renderBars(
    els.typeChart,
    r.types.slice(0, 12),
    x => x.category,
    x => `${formatBytes(x.bytes)} · ${formatNumber(x.count)} filer`,
    x => x.bytes
  );

  renderBars(
    els.yearChart,
    r.mediaYears.slice(0, 15),
    x => String(x.year),
    x => `${formatNumber(x.count)} filer`,
    x => x.count
  );

  renderTable(els.foldersTable,
    [
      { label:"Mappe", key:"path", className:"path" },
      { label:"Størrelse", className:"num", render:x => escapeHtml(formatBytes(x.bytes)) }
    ],
    r.largestFolders
  );

  renderTable(els.filesTable,
    [
      { label:"Fil", key:"path", className:"path" },
      { label:"Type", key:"category" },
      { label:"Størrelse", className:"num", render:x => escapeHtml(formatBytes(x.size)) }
    ],
    r.largestFiles
  );

  renderTable(els.duplicatesTable,
    [
      { label:"Filnavn", key:"name", className:"path" },
      { label:"Kopier", className:"num", render:x => escapeHtml(formatNumber(x.copies)) },
      { label:"Størrelse/stk", className:"num", render:x => escapeHtml(formatBytes(x.sizeEach)) },
      { label:"Mulig plass", className:"num", render:x => escapeHtml(formatBytes(x.potentialSavings)) },
      { label:"Mapper", className:"path", render:x => x.paths.slice(0,4).map(p=>escapeHtml(p)).join("<br>") + (x.paths.length>4 ? `<br>+${x.paths.length-4} til` : "") }
    ],
    r.possibleDuplicates.slice(0, 50)
  );
}

function exportReport() {
  if (!report) return;
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
  a.href = url;
  a.download = `ians-onedrive-report-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

els.saveClientIdBtn.addEventListener("click", async () => {
  const v = (els.clientIdInput.value || "").trim();
  const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!guid.test(v)) {
    els.setupMessage.textContent =
      "Client ID ser ikke gyldig ut. Lim inn Application (client) ID fra Entra.";
    els.clientIdInput.focus();
    return;
  }

  els.saveClientIdBtn.disabled = true;
  els.setupMessage.textContent = "Lagrer og initialiserer Microsoft-innlogging…";

  try {
    localStorage.setItem(CLIENT_KEY, v);
    localStorage.setItem(CLIENT_BACKUP_KEY, v);

    await initMsal();

    // initMsal shows either login or dashboard.
    els.setupMessage.textContent = "";
  } catch (err) {
    console.error("[IANS] setup init failed", err);
    els.setupMessage.textContent = `Initialisering feilet: ${err.message}`;
    els.setupPanel.classList.remove("hidden");
  } finally {
    els.saveClientIdBtn.disabled = false;
  }
});

els.settingsBtn.addEventListener("click", () => {
  els.setupPanel.classList.remove("hidden");
  els.loginPanel.classList.add("hidden");
  els.dashboard.classList.add("hidden");
});

els.copyRedirectBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(currentRedirectUri());
  els.copyRedirectBtn.textContent = "Kopiert";
  setTimeout(() => els.copyRedirectBtn.textContent = "Kopier", 1200);
});

els.signInBtn.addEventListener("click", signIn);
els.signOutBtn.addEventListener("click", async () => {
  if (!msalApp) return;
  try {
    await msalApp.logoutPopup({
      account: activeAccount,
      postLogoutRedirectUri: `${window.location.origin}/`,
      mainWindowRedirectUri: `${window.location.origin}/`
    });
  } catch (err) {
    console.warn("Logout popup warning", err);
  }
  activeAccount = null;
  showLogin();
});
els.scanBtn.addEventListener("click", scanOneDrive);
els.cancelBtn.addEventListener("click", () => { cancelRequested = true; });
els.exportBtn.addEventListener("click", exportReport);

// ===== IANS OneDrive Organizer V2: analysis workspace =====
const v2 = {
  search: document.getElementById("searchInput"),
  category: document.getElementById("categoryFilter"),
  year: document.getElementById("yearFilter"),
  size: document.getElementById("sizeFilter"),
  age: document.getElementById("ageFilter"),
  dup: document.getElementById("duplicateFilter"),
  summary: document.getElementById("filterSummary"),
  table: document.getElementById("inventoryTable"),
  csv: document.getElementById("exportCsvBtn"),
  pdf: document.getElementById("printPdfBtn"),
  photoPlan: document.getElementById("photoPlan"),
  cleanupPlan: document.getElementById("cleanupPlan"),
  review: document.getElementById("reviewQueue"),
  clear: document.getElementById("clearReviewBtn"),
  modal: document.getElementById("previewModal"),
  modalContent: document.getElementById("previewContent"),
  close: document.getElementById("closePreviewBtn")
};
const REVIEW_STORAGE_KEY = "ians_onedrive_review_queue_v362";
let reviewIds = new Set();
let inventorySort = { key: "size", dir: "desc" };

function loadReviewQueue(){
  try{
    const raw=localStorage.getItem(REVIEW_STORAGE_KEY);
    const ids=raw?JSON.parse(raw):[];
    reviewIds=new Set(Array.isArray(ids)?ids:[]);
  }catch(e){
    console.warn("[IANS] review queue load failed",e);
    reviewIds=new Set();
  }
}
function saveReviewQueue(){
  try{localStorage.setItem(REVIEW_STORAGE_KEY,JSON.stringify([...reviewIds]))}
  catch(e){console.warn("[IANS] review queue save failed",e)}
}
function reviewToast(message){
  let t=document.getElementById("iansReviewToast");
  if(!t){
    t=document.createElement("div");
    t.id="iansReviewToast";
    t.className="ians-review-toast";
    document.body.appendChild(t);
  }
  t.textContent=message;
  t.classList.add("show");
  clearTimeout(reviewToast._timer);
  reviewToast._timer=setTimeout(()=>t.classList.remove("show"),1800);
}
function setReviewButtonState(id){
  document.querySelectorAll(`[data-review="${CSS.escape(String(id))}"]`).forEach(btn=>{
    const on=reviewIds.has(String(id));
    btn.textContent=on?"I Review ✓":"Legg i Review";
    btn.classList.toggle("review-added",on);
    btn.setAttribute("aria-pressed",on?"true":"false");
  });
}
function addToReview(id,{scroll=false}={}){
  id=String(id||"");
  if(!id)return;
  const existed=reviewIds.has(id);
  reviewIds.add(id);
  saveReviewQueue();
  renderReview();
  setReviewButtonState(id);
  reviewToast(existed?"Filen ligger allerede i vurderingskøen":"Lagt til i vurderingskøen");
  if(scroll) document.getElementById("reviewQueuePanel")?.scrollIntoView({behavior:"smooth",block:"start"});
}
function removeFromReview(id){
  id=String(id||"");
  reviewIds.delete(id);
  saveReviewQueue();
  renderReview();
  setReviewButtonState(id);
  reviewToast("Fjernet fra vurderingskøen");
}
loadReviewQueue();

function inventorySortValue(f,key){
  if(key==="name") return (f.name||"").toLocaleLowerCase("nb-NO");
  if(key==="category") return (f.category||"").toLocaleLowerCase("nb-NO");
  if(key==="size") return Number(f.size)||0;
  if(key==="date") { const d=fileDate(f); return d ? new Date(d).getTime() : 0; }
  if(key==="duplicate") return isPossibleDuplicate(f)?1:0;
  return 0;
}
function sortInventoryRows(rows){
  const {key,dir}=inventorySort;
  const sign=dir==="asc"?1:-1;
  return [...rows].sort((a,b)=>{
    const av=inventorySortValue(a,key), bv=inventorySortValue(b,key);
    if(typeof av==="string" || typeof bv==="string") return String(av).localeCompare(String(bv),"nb-NO",{numeric:true,sensitivity:"base"})*sign;
    if(av===bv) return (a.name||"").localeCompare(b.name||"","nb-NO",{numeric:true,sensitivity:"base"});
    return (av-bv)*sign;
  });
}
function inventoryHeaderLabel(label,key){
  if(inventorySort.key!==key) return `${label} ↕`;
  return `${label} ${inventorySort.dir==="asc"?"↑":"↓"}`;
}

function fileDate(f){ return f.takenDateTime || f.createdDateTime || null; }
function iansFingerprint(f){
  if(f?.quickXorHash)return {type:"QuickXor",value:String(f.quickXorHash)};
  if(f?.sha1Hash)return {type:"SHA1",value:String(f.sha1Hash).toLowerCase()};
  if(f?.crc32Hash)return {type:"CRC32",value:String(f.crc32Hash).toLowerCase()};
  return null;
}
function iansHashState(files){
  const fps=(files||[]).map(iansFingerprint);
  if(!fps.length||fps.every(x=>!x))return "missing";
  if(fps.some(x=>!x))return "partial";
  const type=fps[0].type;if(fps.some(x=>x.type!==type))return "partial";
  return new Set(fps.map(x=>x.value)).size===1?"verified":"mismatch";
}
function isPossibleDuplicate(f){
  if(!report) return false;
  const k=`${f.name.toLowerCase()}|${f.size}`;
  return (report._dupKeys || new Set()).has(k);
}
function prepareV2(r){
  r._dupKeys=new Set();
  const map=new Map();
  for(const f of r.files){
    const k=`${f.name.toLowerCase()}|${f.size}`;
    map.set(k,(map.get(k)||0)+1);
  }
  for(const [k,n] of map) if(n>1) r._dupKeys.add(k);

  const cats=[...new Set(r.files.map(f=>f.category))].sort();
  v2.category.innerHTML='<option value="">Alle filtyper</option>'+cats.map(x=>`<option>${escapeHtml(x)}</option>`).join("");
  const years=[...new Set(r.files.map(f=>{const d=fileDate(f);return d?new Date(d).getFullYear():null}).filter(Boolean))].sort((a,b)=>b-a);
  v2.year.innerHTML='<option value="">Alle år</option>'+years.map(x=>`<option>${x}</option>`).join("");
  v2.csv.disabled=false; v2.pdf.disabled=false;
  renderV2();
  renderPhotoPlan();
  renderCleanupPlan();
 renderReview();
}
function filteredFiles(){
  if(!report) return [];
  const q=v2.search.value.trim().toLowerCase(), cat=v2.category.value, yr=v2.year.value;
  const minMb=Number(v2.size.value)||0, age=Number(v2.age.value)||0, dup=v2.dup.value;
  const cutoff=age ? new Date(new Date().setFullYear(new Date().getFullYear()-age)) : null;
  return report.files.filter(f=>{
    if(q && !(f.name+" "+f.path).toLowerCase().includes(q)) return false;
    if(cat && f.category!==cat) return false;
    const d=fileDate(f), y=d?String(new Date(d).getFullYear()):"";
    if(yr && y!==yr) return false;
    if(minMb && f.size < minMb*1024*1024) return false;
    if(cutoff && (!f.lastModifiedDateTime || new Date(f.lastModifiedDateTime)>cutoff)) return false;
    if(dup==="yes" && !isPossibleDuplicate(f)) return false;
    return true;
  });
}
function renderV2(){
  if(!report)return;
  const q=v2.search.value.trim(),cat=v2.category.value,yr=v2.year.value;
  const minMb=Number(v2.size.value)||0,age=Number(v2.age.value)||0,dup=v2.dup.value;
  const noFilters=!q&&!cat&&!yr&&!minMb&&!age&&!dup;
  let all,bytes;
  if(noFilters){all=report.files;bytes=report.summary.fileBytes||0}
  else{all=filteredFiles();bytes=all.reduce((s,f)=>s+f.size,0)}
  const maxRows=report.files.length>=50000?250:500;
  v2.summary.textContent=`${formatNumber(all.length)} filer · ${formatBytes(bytes)} i gjeldende utvalg. Viser maks ${maxRows} rader på skjermen.`;
  const sorted=sortInventoryRows(all);
  renderTable(v2.table,[
    {label:inventoryHeaderLabel("Fil","name"),sortKey:"name",className:"path",render:f=>`<strong>${escapeHtml(f.name)}</strong><br><small>${escapeHtml(f.path)}</small>`},
    {label:inventoryHeaderLabel("Type","category"),sortKey:"category",key:"category"},
    {label:inventoryHeaderLabel("Størrelse","size"),sortKey:"size",className:"num",render:f=>escapeHtml(formatBytes(f.size))},
    {label:inventoryHeaderLabel("Dato","date"),sortKey:"date",render:f=>escapeHtml((fileDate(f)||"").slice(0,10)||"–")},
    {label:inventoryHeaderLabel("Duplikat","duplicate"),sortKey:"duplicate",render:f=>{if(!isPossibleDuplicate(f))return "–";const k=`${f.name.toLowerCase()}|${f.size}`;const g=report.files.filter(x=>`${x.name.toLowerCase()}|${x.size}`===k);const st=iansHashState(g);return st==="verified"?'<span class="dup-status verified">Hash-match</span>':st==="mismatch"?'<span class="dup-status blocked">IKKE lik</span>':'<span class="dup-status review">Review</span>'}},
    {label:"Handling",render:f=>`<div class="row-actions"><button class="btn mini ghost" data-preview="${escapeHtml(f.id)}">Preview</button><button class="btn mini ghost ${reviewIds.has(String(f.id))?"review-added":""}" aria-pressed="${reviewIds.has(String(f.id))?"true":"false"}" data-review="${escapeHtml(f.id)}">${reviewIds.has(String(f.id))?"I Review ✓":"Legg i Review"}</button><button class="btn mini danger quick-trash" data-v39-trash="${escapeHtml(f.id)}" title="Send filen til OneDrive-papirkurven">Papirkurv</button></div>`}
  ],sorted.slice(0,maxRows));
}
function renderPhotoPlan(){
  if(!report)return;
  const m=new Map();
  for(const f of report.files){
    if(f.category!=="Bilder" && f.category!=="Video") continue;
    const d=fileDate(f);
    const key=d?`${new Date(d).getFullYear()}/${String(new Date(d).getMonth()+1).padStart(2,"0")}`:"Ukjent dato";
    const x=m.get(key)||{count:0,bytes:0};x.count++;x.bytes+=f.size;m.set(key,x);
  }
  const rows=[...m.entries()].sort((a,b)=>b[0].localeCompare(a[0])).slice(0,40);
  v2.photoPlan.className="plan-list";
  v2.photoPlan.innerHTML=rows.map(([k,x])=>`<div class="plan-item"><span>Bilder/${escapeHtml(k)}</span><strong>${formatNumber(x.count)} · ${formatBytes(x.bytes)}</strong></div>`).join("")||"Ingen bilder/video.";
}
function renderCleanupPlan(){
  if(!report)return;
  const dup=report.summary.possibleDuplicateSavings||0;
  const huge=report.files.filter(f=>f.size>=1024**3);
  const oldCut=new Date();oldCut.setFullYear(oldCut.getFullYear()-5);
  const old=report.files.filter(f=>f.lastModifiedDateTime&&new Date(f.lastModifiedDateTime)<oldCut);
  const archives=report.files.filter(f=>f.category==="Arkiv / installasjon");
  const items=[
    ["Mulige duplikater",dup,`${formatNumber(report.summary.possibleDuplicateGroups)} grupper`],
    ["Filer over 1 GB",huge.reduce((s,f)=>s+f.size,0),`${formatNumber(huge.length)} filer`],
    ["Ikke endret på 5 år",old.reduce((s,f)=>s+f.size,0),`${formatNumber(old.length)} filer`],
    ["Arkiv / installasjon",archives.reduce((s,f)=>s+f.size,0),`${formatNumber(archives.length)} filer`]
  ];
  v2.cleanupPlan.className="plan-list";
  v2.cleanupPlan.innerHTML=items.map(([n,b,c])=>`<div class="plan-item"><span>${escapeHtml(n)}<br><small>${escapeHtml(c)}</small></span><strong>${formatBytes(b)}</strong></div>`).join("");
}
function renderReview(){
  const badge=document.getElementById("reviewQueueCount");
  if(badge) badge.textContent=`${formatNumber(reviewIds.size)} valgt`;
  if(!report||!reviewIds.size){v2.review.className="table-wrap empty-state";v2.review.textContent="Ingen filer valgt.";return}
  const rows=report.files.filter(f=>reviewIds.has(String(f.id)));
  renderTable(v2.review,[
    {label:"Fil",className:"path",render:f=>`${escapeHtml(f.name)}<br><small>${escapeHtml(f.path)}</small>`},
    {label:"Størrelse",className:"num",render:f=>formatBytes(f.size)},
    {label:"Plan",render:f=>"Manuell vurdering før eventuell handling"},
    {label:"",render:f=>`<button class="btn mini ghost" data-unreview="${escapeHtml(f.id)}">Fjern</button>`}
  ],rows);
}
async function previewFile(id){
  const f=report?.files?.find(x=>String(x.id)===String(id));
  if(!f){
    iansToast("Preview kunne ikke åpnes","Filen finnes ikke i gjeldende scan. Kjør ny kartlegging hvis dette fortsetter.","error",7000);
    return;
  }
  let img="";
  if(f.category==="Bilder"||f.category==="Video"){
    try{
      const endpoint=f.driveId
        ? `/drives/${encodeURIComponent(f.driveId)}/items/${encodeURIComponent(f.id)}/thumbnails`
        : `/me/drive/items/${encodeURIComponent(f.id)}/thumbnails`;
      const data=await graphFetch(endpoint);
      const u=data.value?.[0]?.large?.url||data.value?.[0]?.medium?.url||data.value?.[0]?.small?.url;
      if(u) img=`<img class="preview-img" src="${escapeHtml(u)}" alt="">`;
    }catch(e){console.warn("[IANS] thumbnail preview",e)}
  }
  v2.modalContent.innerHTML=`<span class="eyebrow">PREVIEW / FILE REVIEW</span><h2>${escapeHtml(f.name)}</h2>${img}
  <dl class="preview-meta">
  <dt>Full sti</dt><dd>${escapeHtml(f.path)}</dd><dt>Størrelse</dt><dd>${formatBytes(f.size)}</dd>
  <dt>Type</dt><dd>${escapeHtml(f.category)}</dd><dt>Opptaksdato</dt><dd>${escapeHtml(f.takenDateTime||"–")}</dd>
  <dt>Opprettet</dt><dd>${escapeHtml(f.createdDateTime||"–")}</dd><dt>Endret</dt><dd>${escapeHtml(f.lastModifiedDateTime||"–")}</dd>
  <dt>Mulig duplikat</dt><dd>${isPossibleDuplicate(f)?"Ja – må verifiseres":"Nei"}</dd></dl>
  <div class="actions" style="margin-top:18px">${f.webUrl?`<a class="btn ghost" href="${escapeHtml(f.webUrl)}" target="_blank" rel="noopener">Åpne i OneDrive</a>`:""}<button class="btn primary ${reviewIds.has(String(f.id))?"review-added":""}" aria-pressed="${reviewIds.has(String(f.id))?"true":"false"}" data-review="${escapeHtml(f.id)}">${reviewIds.has(String(f.id))?"I Review ✓":"Legg i Review"}</button></div>`;
  v2.modal.classList.remove("hidden");
}

function csvEscape(x){x=String(x??"");return /[",\n]/.test(x)?`"${x.replaceAll('"','""')}"`:x}
function exportCSV(){
  const rows=filteredFiles(), head=["Name","Path","ParentFolder","Category","SizeBytes","SizeMB","TakenDate","CreatedDate","ModifiedDate","PossibleDuplicate","WebUrl"];
  const lines=[head.join(",")];
  for(const f of rows) lines.push([f.name,f.path,f.parentPath,f.category,f.size,(f.size/1048576).toFixed(2),f.takenDateTime||"",f.createdDateTime||"",f.lastModifiedDateTime||"",isPossibleDuplicate(f)?"YES":"NO",f.webUrl||""].map(csvEscape).join(","));
  const blob=new Blob(["\ufeff"+lines.join("\n")],{type:"text/csv;charset=utf-8"}),u=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=u;a.download=`ians-onedrive-inventory-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(u);
}
function exportReview(){
  const rows=report.files.filter(f=>reviewIds.has(f.id));
  const blob=new Blob([JSON.stringify({createdAt:new Date().toISOString(),items:rows},null,2)],{type:"application/json"});
  const u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download="ians-review-queue.json";a.click();URL.revokeObjectURL(u);
}
let v282FilterTimer=null;
[v2.search,v2.category,v2.year,v2.size,v2.age,v2.dup].forEach(x=>{
  const rerender=()=>{clearTimeout(v282FilterTimer);v282FilterTimer=setTimeout(renderV2,120)};
  x?.addEventListener("input",rerender);
  x?.addEventListener("change",rerender);
});
v2.table?.addEventListener("click",e=>{
  const th=e.target.closest("th[data-sort-key]");
  if(!th) return;
  const key=th.dataset.sortKey;
  if(inventorySort.key===key) inventorySort.dir=inventorySort.dir==="asc"?"desc":"asc";
  else { inventorySort.key=key; inventorySort.dir=(key==="size"||key==="date"||key==="duplicate")?"desc":"asc"; }
  renderV2();
});
v2.csv?.addEventListener("click",exportCSV);
v2.pdf?.addEventListener("click",()=>window.print());
v2.clear?.addEventListener("click",()=>{reviewIds.clear();saveReviewQueue();renderReview();renderV2();reviewToast("Vurderingskøen er tømt")});
v2.close?.addEventListener("click",()=>v2.modal.classList.add("hidden"));
v2.modal?.addEventListener("click",e=>{if(e.target===v2.modal)v2.modal.classList.add("hidden")});
document.addEventListener("click",e=>{
  const p=e.target.closest("[data-preview]");if(p)previewFile(p.dataset.preview);
  const r=e.target.closest("[data-review]");if(r){e.preventDefault();e.stopPropagation();addToReview(r.dataset.review)}
  const u=e.target.closest("[data-unreview]");if(u){e.preventDefault();removeFromReview(u.dataset.unreview);renderV2()}
});

// Extend original renderReport without changing scanner.
const originalRenderReport = renderReport;
renderReport=function(r){
 originalRenderReport(r);
 if((r?.files?.length||0)>=50000)setTimeout(()=>prepareV2(r),30);else prepareV2(r);
};


// ===== V2.2 VISUAL STABLE EXTENSION =====
// Passive/read-only extension. Base auth and scanner are unchanged.

const v22 = {
  categoryChart: document.getElementById("v22CategoryChart"),
  ageChart: document.getElementById("v22AgeChart"),
  navigationMap: document.getElementById("v22NavigationMap"),
  priorityCards: document.getElementById("v22PriorityCards"),
  clearSmart: document.getElementById("clearV22SmartBtn"),
  guide: document.getElementById("downloadV22GuideBtn"),
  manifest: document.getElementById("exportV22ManifestBtn")
};
let v22SmartFilter = "";

function v22DrawBars(canvas, rows) {
  if (!canvas || !rows.length) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 520, h = 270;
  canvas.width = w*dpr; canvas.height = h*dpr;
  ctx.scale(dpr,dpr); ctx.clearRect(0,0,w,h);
  const max = Math.max(...rows.map(r=>r.value),1);
  const left=120, right=15, rowH=Math.min(32,(h-16)/rows.length);
  ctx.font="12px system-ui";ctx.textBaseline="middle";
  rows.forEach((r,i)=>{
    const y=8+i*rowH;
    ctx.fillStyle="#a9bfd3";ctx.fillText(String(r.label).slice(0,18),5,y+rowH/2);
    ctx.fillStyle="#112d46";ctx.fillRect(left,y+5,w-left-right,rowH-10);
    ctx.fillStyle="#5fa6dd";ctx.fillRect(left,y+5,(w-left-right)*(r.value/max),rowH-10);
    ctx.fillStyle="#e9f3fc";ctx.fillText(r.text,left+7,y+rowH/2);
  });
}

function v22RenderVisuals() {
  if (!report) return;

  v22DrawBars(v22.categoryChart,
    report.types.slice(0,8).map(x=>({label:x.category,value:x.bytes,text:formatBytes(x.bytes)}))
  );

  const now=Date.now();
  const buckets=[
    {label:"< 1 år",value:0},{label:"1–2 år",value:0},{label:"2–5 år",value:0},
    {label:"5–10 år",value:0},{label:"> 10 år",value:0}
  ];
  report.files.forEach(f=>{
    const d=new Date(f.lastModifiedDateTime||f.createdDateTime||"");
    if(!Number.isFinite(d.getTime()))return;
    const y=(now-d.getTime())/31557600000;
    if(y<1)buckets[0].value++;
    else if(y<2)buckets[1].value++;
    else if(y<5)buckets[2].value++;
    else if(y<10)buckets[3].value++;
    else buckets[4].value++;
  });
  v22DrawBars(v22.ageChart,buckets.map(x=>({...x,text:formatNumber(x.value)})));

  const roots=new Map();
  report.files.forEach(f=>{
    const root=f.path.split("/").filter(Boolean)[0]||"Rot";
    const x=roots.get(root)||{count:0,bytes:0};
    x.count++;x.bytes+=f.size;roots.set(root,x);
  });
  v22.navigationMap.className="navigation-map";
  v22.navigationMap.innerHTML=[...roots.entries()].sort((a,b)=>b[1].bytes-a[1].bytes).slice(0,30)
    .map(([name,x])=>`<button class="nav-node" data-v22-root="${escapeHtml(name)}">
      <span><strong>/${escapeHtml(name)}</strong><small>${formatNumber(x.count)} filer</small></span>
      <strong>${formatBytes(x.bytes)}</strong>
    </button>`).join("");

  const old5cut=new Date();old5cut.setFullYear(old5cut.getFullYear()-5);
  const old=report.files.filter(f=>f.lastModifiedDateTime&&new Date(f.lastModifiedDateTime)<old5cut);
  const huge=report.files.filter(f=>f.size>=1024**3);
  const archives=report.files.filter(f=>f.category==="Arkiv / installasjon");
  const screenshots=report.files.filter(f=>/screen.?shot|screenshot|skjermbilde|screen.?record/i.test(f.name));
  const cards=[
    ["Mulige duplikater",report.summary.possibleDuplicateGroups,formatBytes(report.summary.possibleDuplicateSavings||0)+" mulig plass"],
    ["Filer > 1 GB",huge.length,formatBytes(huge.reduce((s,f)=>s+f.size,0))],
    ["Ikke endret på 5 år",old.length,formatBytes(old.reduce((s,f)=>s+f.size,0))],
    ["Arkiv / installasjon",archives.length,formatBytes(archives.reduce((s,f)=>s+f.size,0))],
    ["Screenshots",screenshots.length,formatBytes(screenshots.reduce((s,f)=>s+f.size,0))]
  ];
  v22.priorityCards.className="priority-grid";
  v22.priorityCards.innerHTML=cards.map(([n,c,t])=>`<div class="priority-card"><span>${escapeHtml(n)}</span><strong>${formatNumber(c)}</strong><small>${escapeHtml(t)}</small></div>`).join("");
  v22.manifest.disabled=false;
}

function v22SmartMatch(f){
  if(!v22SmartFilter)return true;
  const d=new Date(f.lastModifiedDateTime||f.createdDateTime||"");
  const years=Number.isFinite(d.getTime())?(Date.now()-d.getTime())/31557600000:0;
  if(v22SmartFilter==="duplicates")return isPossibleDuplicate(f);
  if(v22SmartFilter==="large1")return f.size>=1024**3;
  if(v22SmartFilter==="large5")return f.size>=5*1024**3;
  if(v22SmartFilter==="old5")return years>=5;
  if(v22SmartFilter==="old10")return years>=10;
  if(v22SmartFilter==="archives")return f.category==="Arkiv / installasjon";
  if(v22SmartFilter==="screenshots")return /screen.?shot|screenshot|skjermbilde|screen.?record/i.test(f.name);
  if(v22SmartFilter==="zero")return f.size===0;
  return true;
}

const v22BaseFilteredFiles = filteredFiles;
filteredFiles = function(){
  return v22BaseFilteredFiles().filter(v22SmartMatch);
};

document.querySelectorAll("[data-v22-smart]").forEach(btn=>{
  btn.addEventListener("click",()=>{
    v22SmartFilter=btn.dataset.v22Smart;
    document.querySelectorAll("[data-v22-smart]").forEach(x=>x.classList.toggle("active",x===btn));
    renderV2();
  });
});
v22.clearSmart?.addEventListener("click",()=>{
  v22SmartFilter="";
  document.querySelectorAll("[data-v22-smart]").forEach(x=>x.classList.remove("active"));
  renderV2();
});
document.addEventListener("click",e=>{
  const node=e.target.closest("[data-v22-root]");
  if(!node)return;
  v2.search.value="/"+node.dataset.v22Root;
  v22SmartFilter="";
  document.querySelectorAll("[data-v22-smart]").forEach(x=>x.classList.remove("active"));
  renderV2();
  document.querySelector(".command-center")?.scrollIntoView({behavior:"smooth"});
});

function v22Download(name,text,type="text/plain;charset=utf-8"){
  const u=URL.createObjectURL(new Blob([text],{type}));
  const a=document.createElement("a");a.href=u;a.download=name;a.click();URL.revokeObjectURL(u);
}
const V22_GUIDE=`IANS ONEDRIVE ORGANIZER V2.2 VISUAL STABLE

1. KARTLEGG
Kjør full read-only analyse. Ingen filer flyttes eller slettes.

2. VISUELT OVERBLIKK
Storage Map viser hvilke toppmapper og filkategorier som bruker mest plass.

3. SMART FINDERS
Filtrene viser kandidater:
- mulige duplikater
- filer over 1 GB / 5 GB
- filer ikke endret på 5 / 10 år
- arkiv/installasjonsfiler
- screenshots
- 0-byte filer

4. VURDER
Store/gamle filer er ikke automatisk unødvendige. Bruk Preview og Review Queue.

5. EKSPORT
Eksporter CSV og Full Manifest JSON før vi senere aktiverer flytting, karantene eller papirkurv.

6. NESTE STEG
Når V2.2 er bekreftet stabil, kan Action Mode legges på som et separat lag.
`;
v22.guide?.addEventListener("click",()=>v22Download("00-IANS-OneDrive-Organizer-GUIDE.txt",V22_GUIDE));
v22.manifest?.addEventListener("click",()=>{if(report)v22Download("IANS-OneDrive-Full-Manifest.json",JSON.stringify(report,null,2),"application/json")});

const v22BaseRenderReport = renderReport;
renderReport = function(r){
  v22BaseRenderReport(r);
  v22RenderVisuals();
};

window.addEventListener("resize",()=>{if(report)v22RenderVisuals()});


// ===== V2.4 VISUAL + ACTION STABLE =====
const v24 = {
  enable: document.getElementById("v24EnableAction"),
  badge: document.getElementById("v24ActionBadge"),
  tools: document.getElementById("v24ActionTools"),
  count: document.getElementById("v24SelectedCount"),
  size: document.getElementById("v24SelectedSize"),
  quarantine: document.getElementById("v24Quarantine"),
  move: document.getElementById("v24Move"),
  photo: document.getElementById("v24Photo"),
  trash: document.getElementById("v24Trash"),
  clear: document.getElementById("v24Clear"),
  qStatus: document.getElementById("v24QStatus"),
  qCsv: document.getElementById("v24QCsv"),
  qJson: document.getElementById("v24QJson"),
  log: document.getElementById("v24Log"),
  logExport: document.getElementById("v24LogExport"),
  modal: document.getElementById("v24Modal"),
  modalContent: document.getElementById("v24ModalContent"),
  modalClose: document.getElementById("v24ModalClose")
};

let v24Enabled = false;
let v24Selected = new Set();
let v24Quarantine = [];
let v24LogEntries = [];
const V24_PENDING = "ians_v24_action_pending";

function v24Rows(){
  return report?.files?.filter(f=>v24Selected.has(f.id)) || [];
}
function v24UpdateSelection(){
  const rows=v24Rows();
  const total=rows.reduce((s,f)=>s+f.size,0);
  v24.count.textContent=`${formatNumber(rows.length)} filer valgt`;
  v24.size.textContent=formatBytes(total);
  [v24.quarantine,v24.move,v24.photo,v24.trash,v24.clear].forEach(b=>{if(b)b.disabled=!rows.length});
}

const v24BaseRenderV2 = renderV2;
renderV2 = function(){
  v24BaseRenderV2();
  // V3.11.1: selection is a planning action, so checkboxes stay visible in Read Only.
  // Write operations remain protected by Action Mode at execution time.
  if(!report) return;
  const table=v2.table.querySelector("table");
  if(!table) return;
  const rawVisible=filteredFiles();
  const maxRows=report.files.length>=50000?250:500;
  const visible=sortInventoryRows(rawVisible).slice(0,maxRows);

  const head=table.querySelector("thead tr");
  const th=document.createElement("th");
  th.textContent="Velg";
  head.insertBefore(th,head.firstChild);

  [...table.querySelectorAll("tbody tr")].forEach((tr,i)=>{
    const f=visible[i];
    if(!f)return;
    const td=document.createElement("td");
    td.innerHTML=`<input class="file-select" type="checkbox" data-v24-select="${escapeHtml(f.id)}" ${v24Selected.has(f.id)?"checked":""}>`;
    tr.insertBefore(td,tr.firstChild);
  });
  v24UpdateSelection();
};

document.addEventListener("change",e=>{
  const cb=e.target.closest("[data-v24-select]");
  if(!cb)return;
  cb.checked ? v24Selected.add(cb.dataset.v24Select) : v24Selected.delete(cb.dataset.v24Select);
  v24UpdateSelection();
});

async function v24WriteToken(interactive=true){
  try {
    return (await msalApp.acquireTokenSilent({
      scopes: V24_WRITE_SCOPES,
      account: activeAccount
    })).accessToken;
  } catch (err) {
    if (interactive && err instanceof InteractionRequiredAuthError) {
      const result = await msalApp.acquireTokenPopup({
        scopes: V24_WRITE_SCOPES,
        account: activeAccount,
        prompt: "consent",
        redirectUri: POPUP_REDIRECT_URI
      });
      return result.accessToken;
    }
    throw err;
  }
}
async function v24Graph(path,{method="GET",body=null}={}){
  const token=await v24WriteToken(false);
  const res=await fetch(path.startsWith("http")?path:`${GRAPH}${path}`,{
    method,
    headers:{Authorization:`Bearer ${token}`,...(body?{"Content-Type":"application/json"}:{})},
    body:body?JSON.stringify(body):undefined
  });
  if(res.status===204)return null;
  if(!res.ok){
    let detail="";
    try{detail=JSON.stringify(await res.json())}catch{}
    throw new Error(`Graph ${res.status}: ${detail||res.statusText}`);
  }
  return res.json();
}

function v24SetEnabled(on){
  v24Enabled=on;
  v24.tools.classList.toggle("hidden",!on);
  v24.enable.classList.toggle("hidden",on);
  v24.badge.textContent=on?"AKTIV":"LÅST";
  v24.badge.classList.toggle("safe",!on);
  renderV2();
}

v24.enable?.addEventListener("click", async () => {
  if (!activeAccount) {
    alert("Koble først til OneDrive før du aktiverer Action Mode.");
    return;
  }

  try {
    await v24WriteToken(true);
    v24SetEnabled(true);
  } catch (err) {
    console.error("Action Mode popup failed", err);
    alert(`Kunne ikke aktivere Action Mode: ${err.message}`);
  }
});

async function v24EnsureFolder(path){
  const parts=path.replace(/^\/+|\/+$/g,"").split("/").filter(Boolean);
  let parent=(await v24Graph("/me/drive/root?$select=id")).id;
  let built="";

  for(const part of parts){
    built += "/" + part;
    const encoded=built.slice(1).split("/").map(encodeURIComponent).join("/");
    let existing=null;

    try{
      existing=await v24Graph(`/me/drive/root:/${encoded}?$select=id,name,folder`);
    }catch(err){
      if(!String(err.message).includes("Graph 404"))throw err;
    }

    if(existing){
      if(!existing.folder)throw new Error(`${built} finnes, men er ikke en mappe.`);
      parent=existing.id;
      continue;
    }

    const created=await v24Graph(`/me/drive/items/${encodeURIComponent(parent)}/children`,{
      method:"POST",
      body:{name:part,folder:{},["@microsoft.graph.conflictBehavior"]:"rename"}
    });
    parent=created.id;
  }
  return parent;
}

function v24Open(html){
  v24.modalContent.innerHTML=html;
  v24.modal.classList.remove("hidden");
}
function v24Close(){
  v24.modal.classList.add("hidden");
}
v24.modalClose?.addEventListener("click",v24Close);
v24.modal?.addEventListener("click",e=>{if(e.target===v24.modal)v24Close()});

function v24Log(action,path,ok,result){
  v24LogEntries.push({time:new Date().toISOString(),action,path,ok,result});
  v24RenderLog();
}
function v24RenderLog(){
  if(!v24LogEntries.length){
    v24.log.className="table-wrap empty-state";
    v24.log.textContent="Ingen handlinger utført.";
    v24.logExport.disabled=true;
    return;
  }
  v24.logExport.disabled=false;
  renderTable(v24.log,[
    {label:"Tid",render:x=>escapeHtml(new Date(x.time).toLocaleTimeString("nb-NO"))},
    {label:"Handling",key:"action"},
    {label:"Resultat",render:x=>`<span class="${x.ok?"log-ok":"log-error"}">${escapeHtml(x.result)}</span>`},
    {label:"Fil",className:"path",key:"path"}
  ],v24LogEntries.slice().reverse().slice(0,250));
}


function iansToast(title,message,type="success",timeout=6500){
  document.querySelector(".ians-toast")?.remove();
  const el=document.createElement("div");
  el.className=`ians-toast ${type}`;
  el.innerHTML=`<strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p>`;
  document.body.appendChild(el);
  if(timeout) setTimeout(()=>el.remove(),timeout);
  return el;
}

function v24ProgressMarkup(title,total){
  return `<span class="eyebrow">HANDLING PÅGÅR</span>
    <h2>${escapeHtml(title)}</h2>
    <div class="action-progress-box">
      <div class="action-progress-head">
        <strong id="v24ProgressLabel">Starter…</strong>
        <span id="v24ProgressCount">0 / ${formatNumber(total)}</span>
      </div>
      <div class="action-progress-track"><div id="v24ProgressFill" class="action-progress-fill"></div></div>
      <div id="v24ProgressFile" class="action-current-file">Forbereder OneDrive…</div>
    </div>`;
}

function v24UpdateProgress(done,total,fileName,status="Flytter"){
  const pct=total?Math.round((done/total)*100):100;
  const fill=document.getElementById("v24ProgressFill");
  const label=document.getElementById("v24ProgressLabel");
  const count=document.getElementById("v24ProgressCount");
  const file=document.getElementById("v24ProgressFile");
  if(fill)fill.style.width=`${pct}%`;
  if(label)label.textContent=`${status}… ${pct}%`;
  if(count)count.textContent=`${formatNumber(done)} / ${formatNumber(total)}`;
  if(file)file.textContent=fileName||"";
}

function v24ShowActionResult({title,total,ok,failed,dest,quarantine=false}){
  const type=failed?"error":"success";
  v24.modalContent.innerHTML=`<span class="eyebrow">${failed===total&&total?"MISLYKTES":failed?"FULLFØRT MED FEIL":"FULLFØRT"}</span>
    <h2>${escapeHtml(failed===total&&total&&quarantine?"Karantene mislyktes – ingen filer flyttet":title)}</h2>
    <div class="action-result-box ${failed?"error":""}">
      <strong>${failed?`${ok} av ${total} fullført`:`Alle ${ok} filer er ferdig behandlet`}</strong>
      <div class="action-result-grid">
        <div><span>VELLYKKET</span><strong>${formatNumber(ok)}</strong></div>
        <div><span>FEIL</span><strong>${formatNumber(failed)}</strong></div>
        <div><span>TOTALT</span><strong>${formatNumber(total)}</strong></div>
      </div>
      <p class="muted">${quarantine?"Flyttet til karantene: ":"Destinasjon: "}<code>${escapeHtml(dest)}</code></p>
      ${quarantine?'<p class="muted">Original sti og ny karantenesti er lagret i karantenemanifestet.</p>':""}
    </div>
    <div class="actions" style="margin-top:14px">
      <button id="v24ResultClose" class="btn primary">Ferdig</button>
      ${quarantine?'<button id="v24ResultManifest" class="btn ghost">Se karantenerapport</button>':""}
    </div>`;
  document.getElementById("v24ResultClose").onclick=v24Close;
  document.getElementById("v24ResultManifest")?.addEventListener("click",()=>{
    if(typeof v39OpenQuarantineReport==="function")v39OpenQuarantineReport();
    else{v24Close();v24.qStatus?.scrollIntoView({behavior:"smooth",block:"center"});}
  });
  iansToast(
    failed?"Handling fullført med feil":"Handling fullført",
    failed?`${ok} filer behandlet, ${failed} feilet.`:`${ok} filer flyttet${quarantine?" til karantene":""}.`,
    type
  );
}


function iansSafePathSegment(value){
  return String(value||"")
    .replace(/[\/\\:*?"<>|]/g,"_")
    .replace(/\s+/g," ")
    .trim()
    .slice(0,120) || "_";
}

function iansRelativeParentPath(file){
  const full=(file.path||"").replace(/^\/+/,"");
  const parts=full.split("/").filter(Boolean);
  parts.pop(); // filename
  return parts.map(iansSafePathSegment).join("/");
}

async function v28EnsureNestedFolder(basePath,relativePath){
  let current=basePath.replace(/\/+$/,"");
  await v24EnsureFolder(current);
  if(!relativePath)return current;

  for(const segment of relativePath.split("/").filter(Boolean)){
    current=`${current}/${iansSafePathSegment(segment)}`;
    await v24EnsureFolder(current);
  }
  return current;
}

// ===== V3.7 ROBUST QUARANTINE JOB ENGINE =====
const V362_QJOB_KEY="ians_v362_quarantine_job_v1";
const V362_QMANIFEST_KEY="ians_v362_quarantine_manifest_v1";
const v362Q={
  panel:document.getElementById("v362QJob"),title:document.getElementById("v362QJobTitle"),state:document.getElementById("v362QJobState"),
  pct:document.getElementById("v362QJobPct"),fill:document.getElementById("v362QJobFill"),count:document.getElementById("v362QJobCount"),
  bytes:document.getElementById("v362QJobBytes"),current:document.getElementById("v362QJobCurrent"),note:document.getElementById("v362QJobNote"),
  start:document.getElementById("v362QStart"),pause:document.getElementById("v362QPause"),resume:document.getElementById("v362QResume"),verify:document.getElementById("v362QVerify")
};
let v362QJob=null;
let v362QRunner=null;
let v362QPauseRequested=false;

function v362QSave(){
  try{ if(v362QJob)localStorage.setItem(V362_QJOB_KEY,JSON.stringify(v362QJob)); }
  catch(e){console.warn("[IANS] quarantine job save failed",e)}
}
function v362QLoad(){
  try{
    const raw=localStorage.getItem(V362_QJOB_KEY);
    if(raw)v362QJob=JSON.parse(raw);
    const manifestRaw=localStorage.getItem(V362_QMANIFEST_KEY);
    if(manifestRaw){
      const saved=JSON.parse(manifestRaw);
      if(Array.isArray(saved))v24Quarantine=saved;
    }
    // A browser reload cannot preserve an in-flight JS promise. Mark as paused and make Resume explicit.
    if(v362QJob?.status==="running"){
      v362QJob.status="paused";
      v362QJob.note="Nettleseren ble lastet på nytt. Jobben er trygt satt på pause og kan fortsettes med Resume.";
      v362QSave();
    }
  }catch(e){console.warn("[IANS] quarantine job load failed",e);v362QJob=null}
}
function v362QSaveManifest(){
  try{localStorage.setItem(V362_QMANIFEST_KEY,JSON.stringify(v24Quarantine))}
  catch(e){console.warn("[IANS] quarantine manifest save failed",e)}
}
function v362QDoneCount(job=v362QJob){return job?job.items.filter(x=>x.status==="done").length:0}
function v362QFailedCount(job=v362QJob){return job?job.items.filter(x=>x.status==="failed").length:0}
function v362QDoneBytes(job=v362QJob){return job?job.items.filter(x=>x.status==="done").reduce((n,x)=>n+(Number(x.size)||0),0):0}
function v362QRender(){
  if(!v362Q?.panel)return;
  const j=v362QJob;
  if(!j){
    v362Q.panel.dataset.state="idle";v362Q.title.textContent="Ingen karantenejobb";v362Q.state.textContent="Klar";
    v362Q.pct.textContent="0%";v362Q.fill.style.width="0%";v362Q.panel.querySelector(".v362-qjob-meter")?.style.setProperty("--p","0%");
    v362Q.count.textContent="0 / 0 filer";v362Q.bytes.textContent="0 B / 0 B";v362Q.current.textContent="Ingen aktiv fil";
    v362Q.start.disabled=true;v362Q.pause.disabled=true;v362Q.resume.disabled=true;v362Q.verify.disabled=!v24Quarantine.length;
    return;
  }
  const done=v362QDoneCount(j), failed=v362QFailedCount(j), processed=done+failed, total=j.items.length;
  const pct=total?Math.round((processed/total)*100):100;
  const totalBytes=j.items.reduce((n,x)=>n+(Number(x.size)||0),0), doneBytes=v362QDoneBytes(j);
  v362Q.panel.dataset.state=j.status||"idle";
  v362Q.title.textContent=`Karantenejobb ${j.jobId}`;
  const labels={prepared:"Klar til start",running:"Kjører",paused:"Pauset",completed:"Fullført",failed:"Fullført med feil",verifying:"Verifiserer"};
  v362Q.state.textContent=`${labels[j.status]||j.status}${failed?` · ${failed} feil`:""}`;
  v362Q.pct.textContent=`${pct}%`;v362Q.fill.style.width=`${pct}%`;v362Q.panel.querySelector(".v362-qjob-meter")?.style.setProperty("--p",`${pct}%`);
  v362Q.count.textContent=`${formatNumber(processed)} / ${formatNumber(total)} filer`;
  v362Q.bytes.textContent=`${formatBytes(doneBytes)} / ${formatBytes(totalBytes)}`;
  const active=j.items.find(x=>x.status==="moving")||j.items.find(x=>x.status==="pending")||j.items.find(x=>x.status==="failed");
  v362Q.current.textContent=active?.name||"Ingen aktiv fil";
  if(v362Q.note)v362Q.note.textContent=j.note||`Destinasjon: ${j.sessionRoot}`;
  const running=j.status==="running"||j.status==="verifying";
  v362Q.start.disabled=running||!(j.status==="prepared");
  v362Q.pause.disabled=j.status!=="running";
  v362Q.resume.disabled=running||!(j.status==="paused"||j.status==="failed");
  v362Q.verify.disabled=running||done===0;
  if(v24.quarantine){
    v24.quarantine.textContent=running?`Vis jobb · ${processed}/${total}`:"Karantene";
  }
}
function v362QCreate(rows,sessionRoot,reason){
  if(v362QJob && ["prepared","running","paused"].includes(v362QJob.status))throw new Error("Det finnes allerede en aktiv karantenejobb. Bruk Start, Pause eller Resume i jobbstatusfeltet.");
  const now=new Date();
  const jobId=now.toISOString().replace(/[-:TZ.]/g,"").slice(0,14);
  v362QJob={jobId,status:"prepared",createdAt:now.toISOString(),updatedAt:now.toISOString(),sessionRoot,reason,note:"Klar til start.",items:rows.map(f=>({
    id:f.id,driveId:f.driveId||null,name:f.name,size:f.size||0,category:f.category||"",originalPath:f.path||"",originalRelativeParent:iansRelativeParentPath(f),
    takenDateTime:f.takenDateTime||"",createdDateTime:f.createdDateTime||"",modifiedDateTime:f.lastModifiedDateTime||"",status:"pending",attempts:0,error:"",quarantinePath:""
  }))};
  v362QSave();v362QRender();return v362QJob;
}
function v362QSleep(ms){return new Promise(r=>setTimeout(r,ms))}
async function v362QGraphRetry(fn,item,max=3){
  let last;
  for(let attempt=1;attempt<=max;attempt++){
    try{item.attempts=(item.attempts||0)+1;v362QSave();return await fn()}
    catch(err){
      last=err;const msg=String(err?.message||err);const retryable=/Graph (429|500|502|503|504)|Failed to fetch|network/i.test(msg);
      if(!retryable||attempt===max)break;
      await v362QSleep(700*Math.pow(2,attempt-1));
    }
  }
  throw last;
}
async function v362QRun(){
  if(v362QRunner)return v362QRunner; // hard in-page lock: never start a second loop
  if(!v362QJob)return;
  v362QPauseRequested=false;
  v362QJob.status="running";v362QJob.note="Jobben kjører. Pause skjer trygt mellom filer.";v362QJob.updatedAt=new Date().toISOString();v362QSave();v362QRender();
  v362QRunner=(async()=>{
    try{
      await v24EnsureFolder(v362QJob.sessionRoot);
      for(const item of v362QJob.items){
        if(item.status==="done")continue;
        if(v362QPauseRequested){v362QJob.status="paused";v362QJob.note="Pauset trygt mellom filer. Trykk Resume for å fortsette.";break}
        item.status="moving";item.error="";v362QJob.updatedAt=new Date().toISOString();v362QSave();v362QRender();
        try{
          const dest=await v362QGraphRetry(()=>v28EnsureNestedFolder(v362QJob.sessionRoot,item.originalRelativeParent),item);
          const folderId=await v362QGraphRetry(()=>v24EnsureFolder(dest),item);
          await v362QGraphRetry(()=>v24Graph(item.driveId?`/drives/${encodeURIComponent(item.driveId)}/items/${encodeURIComponent(item.id)}`:`/me/drive/items/${encodeURIComponent(item.id)}`,{method:"PATCH",body:{parentReference:{id:folderId}}}),item);
          item.quarantinePath=`${dest}/${item.name}`.replace(/\/+/g,"/");item.status="done";item.movedAt=new Date().toISOString();
          const f=report?.files?.find(x=>x.id===item.id);if(f){f.parentPath=dest;f.path=item.quarantinePath;v24Selected.delete(f.id)}
          if(!v24Quarantine.some(x=>x.id===item.id&&x.quarantinePath===item.quarantinePath))v24Quarantine.push({
            movedAt:item.movedAt,id:item.id,driveId:item.driveId||null,name:item.name,size:item.size,category:item.category,reason:v362QJob.reason,originalPath:item.originalPath,
            quarantineRoot:v362QJob.sessionRoot,quarantinePath:item.quarantinePath,originalRelativeParent:item.originalRelativeParent,
            takenDateTime:item.takenDateTime,createdDateTime:item.createdDateTime,modifiedDateTime:item.modifiedDateTime,jobId:v362QJob.jobId,verified:false
          });
          v362QSaveManifest();v24Log("Karantene",item.originalPath,true,`Flyttet til ${item.quarantinePath}`);
        }catch(err){item.status="failed";item.error=String(err?.message||err);v24Log("Karantene",item.originalPath,false,item.error)}
        v362QJob.updatedAt=new Date().toISOString();v362QSave();v362QRender();
        await v362QSleep(0);
      }
      if(v362QJob.status==="running"){
        const failed=v362QFailedCount();v362QJob.status=failed?"failed":"completed";
        v362QJob.completedAt=new Date().toISOString();v362QJob.note=failed?`${failed} filer feilet. Resume prøver bare de feilede/gjenstående filene på nytt.`:"Alle filer er behandlet. Kjør Verify som siste kontroll.";
        v362QSave();
        iansToast(failed?"Karantene fullført med feil":"Karantene ferdig",failed?`${v362QDoneCount()} flyttet · ${failed} feil.`:`${v362QDoneCount()} filer flyttet. Kjør Verify for kontroll.`,failed?"error":"success",9000);
      }
    }finally{
      v362QRunner=null;v362QSave();v362QRender();v24RenderQuarantine();renderV2();renderPhotoPlan();renderCleanupPlan();if(typeof dupRenderBulk==="function")setTimeout(dupRenderBulk,0);
    }
  })();
  return v362QRunner;
}
function v362QPause(){if(v362QJob?.status!=="running")return;v362QPauseRequested=true;v362QJob.note="Pause forespurt – stopper etter aktiv fil.";v362QSave();v362QRender()}
async function v362QResume(){
  if(!v362QJob||v362QRunner)return;
  v362QJob.items.forEach(x=>{if(x.status==="moving"||x.status==="failed")x.status="pending"});
  v362QJob.status="paused";v362QJob.note="Klar til å fortsette gjenstående filer.";v362QSave();v362QRender();return v362QRun();
}
async function v362QVerify(){
  if(!v362QJob||v362QRunner)return;
  const done=v362QJob.items.filter(x=>x.status==="done");if(!done.length)return;
  const prev=v362QJob.status;v362QJob.status="verifying";v362QJob.note=`Verifiserer 0 / ${done.length} filer mot OneDrive…`;v362QSave();v362QRender();
  let ok=0,bad=0;
  for(let i=0;i<done.length;i++){
    const item=done[i];
    try{
      const remote=await v24Graph((item.driveId?`/drives/${encodeURIComponent(item.driveId)}/items/${encodeURIComponent(item.id)}`:`/me/drive/items/${encodeURIComponent(item.id)}`)+`?$select=id,name,size,parentReference`);
      const sizeOk=Number(remote?.size)===Number(item.size);const nameOk=remote?.name===item.name;
      item.verified=!!(remote?.id&&sizeOk&&nameOk);item.verifiedAt=new Date().toISOString();item.verifyError=item.verified?"":"Navn eller størrelse avviker";
      item.verified?ok++:bad++;
      const m=v24Quarantine.find(x=>x.id===item.id&&x.jobId===v362QJob.jobId);if(m){m.verified=item.verified;m.verifiedAt=item.verifiedAt;m.verifyError=item.verifyError}
    }catch(err){item.verified=false;item.verifiedAt=new Date().toISOString();item.verifyError=String(err?.message||err);bad++}
    v362QJob.note=`Verifiserer ${i+1} / ${done.length} filer mot OneDrive…`;v362QSave();v362QSaveManifest();v362QRender();
  }
  v362QJob.status=prev==="failed"?"failed":"completed";v362QJob.note=bad?`Verify ferdig: ${ok} bekreftet · ${bad} må kontrolleres.`:`Verify ferdig: ${ok} av ${done.length} filer bekreftet i OneDrive.`;v362QSave();v362QRender();v24RenderQuarantine();
  iansToast(bad?"Verify ferdig med avvik":"Verify OK",bad?`${ok} bekreftet · ${bad} avvik.`:`${ok} filer bekreftet i OneDrive.`,bad?"error":"success",9000);
}

// Compatibility wrapper used by older call sites. Progress is rendered on the page, not in a modal.
async function v28MoveRowsStructuredQuarantine(rows,sessionRoot,{reason="Manuell vurdering",showProgress=true}={}){
  v362QCreate(rows,sessionRoot,reason);
  return v362QRun();
}

async function v24MoveRows(rows,dest,{quarantine=false,reason="Manuell flytting",showProgress=false}={}){
  const total=rows.length;
  let ok=0, failed=0;

  if(showProgress){
    v24Open(v24ProgressMarkup(
      quarantine?`Flytter ${formatNumber(total)} filer til karantene`:`Flytter ${formatNumber(total)} filer`,
      total
    ));
  }

  let folderId;
  try{
    folderId=await v24EnsureFolder(dest);
  }catch(err){
    if(showProgress){
      v24ShowActionResult({title:"Kunne ikke opprette destinasjonen",total,ok:0,failed:total,dest,quarantine});
    }
    throw err;
  }

  for(let index=0;index<rows.length;index++){
    const f=rows[index];
    const original=f.path;

    if(showProgress){
      v24UpdateProgress(index,total,f.name,quarantine?"Flytter til karantene":"Flytter");
    }

    try{
      await v24Graph(f.driveId?`/drives/${encodeURIComponent(f.driveId)}/items/${encodeURIComponent(f.id)}`:`/me/drive/items/${encodeURIComponent(f.id)}`,{
        method:"PATCH",
        body:{parentReference:{id:folderId}}
      });

      f.parentPath=dest;
      f.path=`${dest.replace(/\/$/,"")}/${f.name}`;

      if(quarantine){
        v24Quarantine.push({
          movedAt:new Date().toISOString(),
          id:f.id,name:f.name,size:f.size,category:f.category,reason,
          originalPath:original,quarantinePath:f.path,
          takenDateTime:f.takenDateTime||"",
          createdDateTime:f.createdDateTime||"",
          modifiedDateTime:f.lastModifiedDateTime||""
        });
      }

      v24Selected.delete(f.id);
      v24Log(quarantine?"Karantene":"Flytt",original,true,`Flyttet til ${dest}`);
      ok++;
    }catch(err){
      failed++;
      v24Log(quarantine?"Karantene":"Flytt",original,false,err.message);
    }

    if(showProgress){
      v24UpdateProgress(index+1,total,f.name,quarantine?"Flytter til karantene":"Flytter");
    }
  }

  v24RenderQuarantine();
  renderV2();
  renderPhotoPlan();
  renderCleanupPlan();

  // Refresh duplicate review so quarantined files disappear from active duplicate candidates.
  if(typeof dupRenderBulk==="function"){
    setTimeout(dupRenderBulk,0);
  }

  if(showProgress){
    v24ShowActionResult({
      title:quarantine?"Karantene ferdig":"Flytting ferdig",
      total,ok,failed,dest,quarantine
    });
  }

  return {total,ok,failed,dest};
}
function v24RenderQuarantine(){
  if(!v24Quarantine.length){
    v24.qStatus.className="empty-state";
    v24.qStatus.textContent="Ingen filer er flyttet til karantene i denne økten.";
    v24.qCsv.disabled=true;v24.qJson.disabled=true;
    return;
  }
  const total=v24Quarantine.reduce((s,x)=>s+x.size,0);
  const verified=v24Quarantine.filter(x=>x.verified===true).length;
  const verifyText=verified?` · ${formatNumber(verified)} verified`:"";
  v24.qStatus.className="";
  v24.qStatus.innerHTML=`<strong>${formatNumber(v24Quarantine.length)} filer · ${formatBytes(total)}${verifyText}</strong>
    <p class="muted">Original sti, karantenesti, jobb-ID og Verify-status lagres i manifestet.</p>`;
  v24.qCsv.disabled=false;v24.qJson.disabled=false;
}

v24.quarantine?.addEventListener("click",()=>{
  if(v362QJob && ["prepared","running","paused"].includes(v362QJob.status)){
    v362Q.panel?.scrollIntoView({behavior:"smooth",block:"center"});
    iansToast("Karantenejobb finnes",v362QJob.status==="running"?"Jobben kjører allerede. Ingen ny instans ble startet.":"Bruk Start eller Resume i jobbstatusfeltet.","success",5000);
    return;
  }
  const rows=v24Rows();
  if(!rows.length){iansToast("Ingen filer valgt","Velg filer før du oppretter en karantenejobb.","error");return}
  const day=new Date().toISOString().slice(0,10);
  v24Open(`<span class="eyebrow">KARANTENE</span>
    <h2>Forbered ${formatNumber(rows.length)} filer til gjennomgang</h2>
    <p>Destinasjon: <code>/_IANS Cleanup Review/${day}/</code></p>
    <p class="muted">Etter bekreftelse opprettes én låst jobb. Fremdriften vises på selve siden, og samme jobb kan pauses, fortsettes og verifiseres.</p>
    <input id="v24Reason" class="action-input" value="${escapeHtml(v22SmartFilter||"Manuell vurdering")}">
    <div class="action-preview">${rows.slice(0,30).map(f=>`<div>${escapeHtml(f.path)} · ${formatBytes(f.size)}</div>`).join("")}</div>
    <button id="v24QConfirm" class="btn primary">Opprett og start jobb</button>`);
  document.getElementById("v24QConfirm").onclick=async()=>{
    const reason=document.getElementById("v24Reason").value||"Manuell vurdering";
    try{
      v362QCreate(rows,`/_IANS Cleanup Review/${day}`,reason);v24Close();v362Q.panel?.scrollIntoView({behavior:"smooth",block:"center"});await v362QRun();
    }catch(err){console.error("[IANS] quarantine batch failed",err);iansToast("Karantene feilet",err.message,"error")}
  };
});


v362Q.start?.addEventListener("click",()=>v362QRun());
v362Q.pause?.addEventListener("click",v362QPause);
v362Q.resume?.addEventListener("click",()=>v362QResume());
v362Q.verify?.addEventListener("click",()=>v362QVerify());
v362QLoad();v362QRender();v24RenderQuarantine();

v24.move?.addEventListener("click",()=>{
  const rows=v24Rows();
  v24Open(`<span class="eyebrow">FLYTT</span>
    <h2>Flytt ${formatNumber(rows.length)} filer</h2>
    <input id="v24Dest" class="action-input" value="/IANS Organisert">
    <button id="v24MoveConfirm" class="btn primary">Flytt</button>`);
  document.getElementById("v24MoveConfirm").onclick=()=>{
    const dest=document.getElementById("v24Dest").value.trim()||"/IANS Organisert";
    v24Close();v24MoveRows(rows,dest);
  };
});

v24.photo?.addEventListener("click",()=>{
  const rows=v24Rows().filter(f=>f.category==="Bilder"||f.category==="Video");
  v24Open(`<span class="eyebrow">PHOTO ORGANIZER</span>
    <h2>Organiser ${formatNumber(rows.length)} bilder/videoer</h2>
    <p>Struktur: <code>/Bilder Organisert/År/MM - Måned/</code>. Opptaksdato prioriteres.</p>
    <button id="v24PhotoConfirm" class="btn primary" ${rows.length?"":"disabled"}>Organiser</button>`);

  document.getElementById("v24PhotoConfirm").onclick=async()=>{
    v24Close();
    const names=["01 - Januar","02 - Februar","03 - Mars","04 - April","05 - Mai","06 - Juni","07 - Juli","08 - August","09 - September","10 - Oktober","11 - November","12 - Desember"];
    for(const f of rows){
      const raw=f.takenDateTime||f.createdDateTime;
      if(!raw){v24Log("Fotoorganisering",f.path,false,"Mangler brukbar dato");continue}
      const d=new Date(raw);
      if(!Number.isFinite(d.getTime())){v24Log("Fotoorganisering",f.path,false,"Ugyldig dato");continue}
      await v24MoveRows([f],`/Bilder Organisert/${d.getFullYear()}/${names[d.getMonth()]}`,{reason:"Fotoorganisering"});
    }
  };
});


function v310EncodeDrivePath(path=""){
  return String(path||"").replace(/^\/+/,"").split("/").filter(Boolean).map(encodeURIComponent).join("/");
}
async function v310ResolveCurrentItem(file){
  if(!file) throw new Error("Mangler filreferanse.");
  const preferredDrive=String(file.driveId||"").trim();
  const id=String(file.id||"").trim();
  const byId=preferredDrive
    ? `/drives/${encodeURIComponent(preferredDrive)}/items/${encodeURIComponent(id)}?$select=id,name,size,parentReference`
    : `/me/drive/items/${encodeURIComponent(id)}?$select=id,name,size,parentReference`;
  try{
    const found=await v24Graph(byId);
    return {item:found,driveId:found?.parentReference?.driveId||preferredDrive||null,resolvedBy:"id"};
  }catch(err){
    if(!/Graph\s+404|itemNotFound/i.test(String(err?.message||err))) throw err;
  }
  const encoded=v310EncodeDrivePath(file.path||"");
  if(!encoded) throw new Error("Filen finnes ikke via lagret ID, og mangler brukbar sti. Kjør ny kartlegging.");
  try{
    const found=await v24Graph(`/me/drive/root:/${encoded}?$select=id,name,size,parentReference`);
    return {item:found,driveId:found?.parentReference?.driveId||null,resolvedBy:"path"};
  }catch(err){
    if(/Graph\s+404|itemNotFound/i.test(String(err?.message||err))){
      const e=new Error("Filen finnes ikke lenger på den kartlagte ID-en eller stien. Scan-dataene er sannsynligvis gamle – kjør ny kartlegging.");
      e.code="IANS_STALE_SCAN"; throw e;
    }
    throw err;
  }
}
async function v310TrashFile(file){
  const resolved=await v310ResolveCurrentItem(file);
  const targetDrive=resolved.driveId;
  const targetId=resolved.item?.id;
  if(!targetId) throw new Error("Kunne ikke finne gjeldende OneDrive-ID for filen.");
  const endpoint=targetDrive
    ? `/drives/${encodeURIComponent(targetDrive)}/items/${encodeURIComponent(targetId)}`
    : `/me/drive/items/${encodeURIComponent(targetId)}`;
  await v24Graph(endpoint,{method:"DELETE"});
  return resolved;
}

async function v24TrashRows(rows){
  const total=rows.length;
  let ok=0,failed=0;
  const failures=[];

  // Keep the modal open during the whole job, just like quarantine.
  v24Open(v24ProgressMarkup(`Flytter ${formatNumber(total)} filer til OneDrive-papirkurven`,total));
  v24UpdateProgress(0,total,"Kontrollerer skrivetilgang…","Forbereder papirkurv");

  // Fail visibly before starting if the write token is missing/expired.
  try{
    await v24WriteToken(false);
  }catch(err){
    console.error("[IANS] trash preflight failed",err);
    v24ShowActionResult({
      title:"Papirkurv kunne ikke starte",
      total,ok:0,failed:total,dest:"OneDrive-papirkurven",quarantine:false
    });
    iansToast("Papirkurv feilet",`Skrivetilgang mangler eller må fornyes: ${err.message}`,"error",10000);
    return {total,ok:0,failed:total,failures:[{path:"",error:err.message}]};
  }

  for(let index=0;index<rows.length;index++){
    const f=rows[index];
    const original=f.path;
    v24UpdateProgress(index,total,f.name,"Sender til papirkurv");

    try{
      await v310TrashFile(f);
      v24Selected.delete(f.id);
      report.files=report.files.filter(x=>x.id!==f.id);
      v24Log("Papirkurv",original,true,"Sendt til OneDrive-papirkurven");
      ok++;
    }catch(err){
      failed++;
      failures.push({path:original,error:err.message});
      v24Log("Papirkurv",original,false,err.message);
    }

    v24UpdateProgress(index+1,total,f.name,failed?"Papirkurv · noen feil":"Sender til papirkurv");

    // Yield periodically so the browser paints progress on large batches.
    if(index % 5 === 4) await new Promise(resolve=>setTimeout(resolve,0));
  }

  renderV2();
  renderCleanupPlan();
  renderPhotoPlan();
  v24UpdateSelection();
  if(typeof dupRenderBulk==="function") setTimeout(dupRenderBulk,0);

  v24ShowActionResult({
    title:failed?"Papirkurv ferdig med feil":"Papirkurv ferdig",
    total,ok,failed,dest:"OneDrive-papirkurven",quarantine:false
  });

  if(failures.length){
    const first=failures[0];
    iansToast("Noen filer kunne ikke slettes",`${failed} av ${total} feilet. Første feil: ${first.error}`,"error",12000);
  }else{
    iansToast("Papirkurv ferdig",`${ok} filer er sendt til OneDrive-papirkurven.`,"success",8000);
  }

  return {total,ok,failed,failures};
}

v24.trash?.addEventListener("click",()=>{
  const rows=v24Rows();
  const phrase=`SLETT ${rows.length} FILER`;
  const total=rows.reduce((s,f)=>s+f.size,0);

  v24Open(`<span class="eyebrow">PAPIRKURV</span>
    <h2>${formatNumber(rows.length)} filer · ${formatBytes(total)}</h2>
    <p>Filene sendes til OneDrive-papirkurven. Permanent sletting er ikke implementert.</p>
    <div class="action-preview">${rows.slice(0,30).map(f=>`<div>${escapeHtml(f.path)}</div>`).join("")}</div>
    <p><strong>Skriv nøyaktig: ${escapeHtml(phrase)}</strong></p>
    <input id="v24TrashText" class="action-input" autocomplete="off">
    <button id="v24TrashConfirm" class="btn danger">Flytt til papirkurv</button>`);

  document.getElementById("v24TrashConfirm").onclick=async()=>{
    if(document.getElementById("v24TrashText").value!==phrase)return alert("Bekreftelsesteksten er ikke riktig.");
    const btn=document.getElementById("v24TrashConfirm");
    if(btn){btn.disabled=true;btn.textContent="Starter…";}
    try{
      await v24TrashRows(rows);
    }catch(err){
      console.error("[IANS] trash batch failed",err);
      iansToast("Papirkurv feilet",err.message,"error",10000);
      v24Open(`<span class="eyebrow">PAPIRKURV · FEIL</span><h2>Handlingen stoppet</h2><p>${escapeHtml(err.message)}</p><button class="btn primary" id="v24TrashErrorClose">Lukk</button>`);
      document.getElementById("v24TrashErrorClose").onclick=v24Close;
    }
  };
});

v24.clear?.addEventListener("click",()=>{
  v24Selected.clear();
  renderV2();
});

function v24Download(name,text,type="text/plain;charset=utf-8"){
  const u=URL.createObjectURL(new Blob([text],{type}));
  const a=document.createElement("a");
  a.href=u;a.download=name;a.click();URL.revokeObjectURL(u);
}

v24.qJson?.addEventListener("click",()=>v24Download("IANS-Quarantine-Manifest.json",JSON.stringify(v24Quarantine,null,2),"application/json"));
v24.qCsv?.addEventListener("click",()=>{
  const lines=[
    "Name,SizeBytes,Category,Reason,OriginalPath,QuarantinePath,MovedAt,JobId,Verified,VerifiedAt,VerifyError",
    ...v24Quarantine.map(x=>[x.name,x.size,x.category,x.reason,x.originalPath,x.quarantinePath,x.movedAt,x.jobId||"",x.verified===true?"YES":x.verified===false?"NO":"",x.verifiedAt||"",x.verifyError||""].map(csvEscape).join(","))
  ];
  v24Download("IANS-Quarantine-Report.csv","\ufeff"+lines.join("\n"),"text/csv;charset=utf-8");
});
v24.logExport?.addEventListener("click",()=>v24Download("IANS-Action-Log.json",JSON.stringify(v24LogEntries,null,2),"application/json"));



// ===== V2.8.4 Web Edition + Download & Verify FOLDER BROWSER READER =====
// Folder browsing is intentionally independent of the scan cancel flag.
async function listBrowserFolders(folderId = null) {
  const token = await getToken();

  let url = folderId
    ? `${GRAPH}/me/drive/items/${encodeURIComponent(folderId)}/children?$select=id,name,folder,parentReference&$top=200`
    : `${GRAPH}/me/drive/root/children?$select=id,name,folder,parentReference&$top=200`;

  const folders = [];

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      let detail = "";
      try { detail = JSON.stringify(await res.json()); } catch {}
      throw new Error(`Graph ${res.status}: ${detail || res.statusText}`);
    }

    const data = await res.json();

    for (const item of data.value || []) {
      if (item.folder) folders.push(item);
    }

    url = data["@odata.nextLink"] || null;
  }

  return folders.sort((a, b) =>
    (a.name || "").localeCompare(b.name || "", "nb", { sensitivity: "base" })
  );
}

// ===== V2.5 SCAN CONTROL UI =====
const folderModal=document.getElementById("folderBrowserModal");
const folderList=document.getElementById("folderBrowserList");
const folderPath=document.getElementById("folderBrowserPath");

async function loadFolderBrowserLevel(){
  const current=browserStack[browserStack.length-1];
  folderPath.textContent=current.path;
  folderList.innerHTML="<div class=\"empty-state\">Laster mapper fra OneDrive…</div>";
  try{
    const folders = await listBrowserFolders(current.id);
    folderList.innerHTML=folders.length?folders.map(f=>{
      const p=current.path==="/"?`/${f.name}`:`${current.path}/${f.name}`;
      return `<button class="folder-row" data-folder-id="${escapeHtml(f.id)}" data-folder-path="${escapeHtml(p)}">
        <span><strong>📁 ${escapeHtml(f.name)}</strong><small>${formatNumber(f.folder?.childCount||0)} elementer (oppgitt)</small></span>
        <span>›</span>
      </button>`;
    }).join(""):`<div class="empty-state">Ingen undermapper.</div>`;
  }catch(e){
    folderList.innerHTML=`<div class="empty-state">Kunne ikke lese OneDrive-mapper: ${escapeHtml(e.message)}</div>`;
  }
}
document.querySelectorAll('input[name="scanScope"]').forEach(r=>r.addEventListener("change",()=>{
  const folderMode=document.querySelector('input[name="scanScope"]:checked')?.value==="folder";
  document.getElementById("browseFolderBtn").disabled=!folderMode;
  if(!folderMode){selectedScanFolder={id:null,path:"/"};document.getElementById("selectedFolderPath").textContent="/";}
}));
document.getElementById("browseFolderBtn")?.addEventListener("click",async()=>{
  folderBrowserPurpose="scan";
  browserStack=[{id:null,path:"/"}];
  folderModal.classList.remove("hidden");
  await loadFolderBrowserLevel();
});
document.getElementById("closeFolderBrowserBtn")?.addEventListener("click",()=>folderModal.classList.add("hidden"));
document.getElementById("folderUpBtn")?.addEventListener("click",async()=>{
  if(browserStack.length>1){browserStack.pop();await loadFolderBrowserLevel();}
});
document.getElementById("chooseThisFolderBtn")?.addEventListener("click",()=>{
  const chosen={...browserStack[browserStack.length-1]};
  if(folderBrowserPurpose==="download"){
    const parts=(chosen.path||"/").split("/").filter(Boolean);
    selectedDownloadFolder={...chosen,name:parts[parts.length-1]||"OneDrive"};
    const el=document.getElementById("downloadSourcePath");
    if(el) el.textContent=selectedDownloadFolder.path;
    folderModal.classList.add("hidden");
    if(typeof dlAnalyzeSource==="function") dlAnalyzeSource();
    return;
  }
  selectedScanFolder=chosen;
  document.getElementById("selectedFolderPath").textContent=selectedScanFolder.path;
  folderModal.classList.add("hidden");
});
document.addEventListener("click",async e=>{
  const row=e.target.closest("[data-folder-id]");
  if(!row)return;
  browserStack.push({id:row.dataset.folderId,path:row.dataset.folderPath});
  await loadFolderBrowserLevel();
});
document.getElementById("resumeScanBtn")?.addEventListener("click",async()=>{
  const cp=await loadScanCheckpoint();
  if(!cp)return alert("Fant ingen lagret skanning.");
  if(cp.account && activeAccount?.username && cp.account!==activeAccount.username){
    return alert("Checkpointet tilhører en annen Microsoft-konto.");
  }
  await scanOneDrive(cp);
});
document.getElementById("discardCheckpointBtn")?.addEventListener("click",async()=>{
  if(confirm("Forkaste lagret checkpoint? Dette sletter ikke noe i OneDrive."))await clearScanCheckpoint();
});

setTimeout(refreshCheckpointUi,1000);


// ===== V2.5.2 TOP CONTROL FIX =====
const topModeBadge252 = document.getElementById("topModeBadge");
const topActionBtn252 = document.getElementById("topActionBtn");
const topStartScanBtn252 = document.getElementById("topStartScanBtn");
const topStopScanBtn252 = document.getElementById("topStopScanBtn");

function syncMode252(on){
  if(topModeBadge252){
    topModeBadge252.textContent=on?"ACTION MODE":"READ ONLY";
    topModeBadge252.classList.toggle("action-active",on);
  }
  if(topActionBtn252){
    topActionBtn252.textContent=on?"Action Mode aktiv":"Aktiver Action Mode";
    topActionBtn252.disabled=!!on;
  }
}

// Mirror the existing proven action-mode function.
if (typeof v24SetEnabled === "function") {
  const _v24SetEnabled252 = v24SetEnabled;
  v24SetEnabled = function(on){
    _v24SetEnabled252(on);
    syncMode252(on);
  };
}
topActionBtn252?.addEventListener("click",()=>{
  document.getElementById("v24EnableAction")?.click();
});

topStartScanBtn252?.addEventListener("click",()=>{
  // Trigger existing scan engine directly so selected scope is respected.
  scanOneDrive();
});
topStopScanBtn252?.addEventListener("click",()=>{
  cancelRequested=true;
});
const _scan252 = scanOneDrive;
let iansActiveScanPromise = null;
scanOneDrive = function(resumeState=null){
  if(iansActiveScanPromise){
    iansToast?.("Kartlegging kjører","Det finnes allerede én aktiv kartleggingsjobb. Bruk Pause eller vent til den er ferdig.","error",6000);
    return iansActiveScanPromise;
  }
  scanRunningV38=true;
  if(topStartScanBtn252)topStartScanBtn252.disabled=true;
  if(topStopScanBtn252)topStopScanBtn252.disabled=false;
  const a=document.getElementById("scanInlineStart"),p=document.getElementById("scanInlinePause"),r=document.getElementById("scanInlineResume"),v=document.getElementById("scanInlineVerify");
  if(a)a.disabled=true;if(p)p.disabled=false;if(r)r.disabled=true;if(v)v.disabled=true;
  iansActiveScanPromise=Promise.resolve(_scan252(resumeState)).finally(()=>{
    scanRunningV38=false;
    iansActiveScanPromise=null;
    if(topStartScanBtn252)topStartScanBtn252.disabled=false;
    if(topStopScanBtn252)topStopScanBtn252.disabled=true;
    if(a)a.disabled=false;if(p)p.disabled=true;if(r)r.disabled=false;if(v)v.disabled=!report;
  });
  return iansActiveScanPromise;
};

// Rebind the original button to the one authoritative V3.13 scan entry point.
try{
  if(els?.scanBtn && typeof _scan252==="function"){
    els.scanBtn.removeEventListener("click", _scan252);
    els.scanBtn.addEventListener("click", scanOneDrive);
  }
}catch(e){console.warn("[IANS V3.13] scan button rebind",e)}

// Hide the old scan button to avoid two competing primary controls.
setTimeout(()=>{
  if(els?.scanBtn) els.scanBtn.style.display="none";
  const active=document.getElementById("v24ActionBadge")?.textContent?.trim()==="AKTIV";
  syncMode252(active);
  refreshCheckpointUi();
},800);

// Keep badge meaningful when scan scope changes.
document.querySelectorAll('input[name="scanScope"]').forEach(r=>r.addEventListener("change",()=>{
  const folderMode=document.querySelector('input[name="scanScope"]:checked')?.value==="folder";
  document.getElementById("browseFolderBtn").disabled=!folderMode;
  document.getElementById("scanStateBadge").textContent=folderMode?"VALGT MAPPE":"HELE ONEDRIVE";
  if(!folderMode){
    selectedScanFolder={id:null,path:"/"};
    document.getElementById("selectedFolderPath").textContent="/";
  }
}));


// ===== V2.5.6 STATE RECOVERY =====
setTimeout(async () => {
  try {
    recoverClientIdState();

    // If user returned from Action Mode consent, try to activate write mode
    // without forcing another redirect.
    const pending =
      sessionStorage.getItem(V24_PENDING) === "1" ||
      localStorage.getItem(V24_PENDING) === "1";

    if (pending && activeAccount && typeof msalApp !== "undefined") {
      try {
        const wr = await msalApp.acquireTokenSilent({
          scopes: V24_WRITE_SCOPES,
          account: activeAccount
        });
        if (wr?.accessToken) {
          sessionStorage.removeItem(V24_PENDING);
          localStorage.removeItem(V24_PENDING);
          if (typeof v24SetEnabled === "function") v24SetEnabled(true);
        }
      } catch (e) {
        console.warn("[IANS] write token not yet available", e);
      }
    }
  } catch (e) {
    console.warn("[IANS] state recovery warning", e);
  }
}, 900);




// V2.8.4 Web Edition + Download & Verify: one authoritative startup initialization.
if (!IS_MSAL_POPUP_CALLBACK) {
  initMsal().catch(err => {
    console.error("[IANS] startup init failed", err);
    if (els?.setupMessage) {
      els.setupMessage.textContent = `Oppstart feilet: ${err.message}`;
    }
  });
}


// ===== V3.8 UNIFIED SCAN VERIFY =====
function v38VerifyScanCatalog(){
  if(!report?.files?.length)return iansToast("Verify scan","Ingen ferdig kartlegging å kontrollere.","error",6000);
  const ids=new Set(),dupeIds=[];let withHash=0;const buckets=new Map();
  for(const f of report.files){if(ids.has(f.id))dupeIds.push(f.id);else ids.add(f.id);iansFingerprint(f)?withHash++:0;const k=`${String(f.name||"").toLowerCase()}|${Number(f.size)||0}`;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(f)}
  let verifiedGroups=0,conflictGroups=0,manualGroups=0;
  for(const g of buckets.values()){if(g.length<2)continue;const st=iansHashState(g);if(st==="verified")verifiedGroups++;else if(st==="mismatch")conflictGroups++;else manualGroups++}
  const pct=Math.round(withHash/Math.max(report.files.length,1)*100);
  const msg=`${formatNumber(report.files.length)} filer · ${pct}% med innholdshash · ${verifiedGroups} hash-match grupper · ${conflictGroups} navn/størrelse-grupper med hash-konflikt · ${manualGroups} grupper krever review${dupeIds.length?` · ${dupeIds.length} dupliserte item-ID-er`:""}.`;
  iansToast(conflictGroups||dupeIds.length?"Verify scan · avvik funnet":"Verify scan · OK",msg,conflictGroups||dupeIds.length?"error":"success",12000);
  const note=document.getElementById("scanVerifyResult");if(note)note.textContent=msg;
}
setTimeout(()=>{
  document.getElementById("scanInlineStart")?.addEventListener("click",()=>document.getElementById("topStartScanBtn")?.click());
  document.getElementById("scanInlinePause")?.addEventListener("click",()=>document.getElementById("topStopScanBtn")?.click());
  document.getElementById("scanInlineResume")?.addEventListener("click",()=>document.getElementById("resumeScanBtn")?.click());
  document.getElementById("scanInlineVerify")?.addEventListener("click",v38VerifyScanCatalog);
},300);

// ===== V2.8.4 Web Edition + Download & Verify LARGE DRIVE DUPLICATE REVIEW =====
const dupBulkGroupsEl=document.getElementById("dupBulkGroups");
const dupStatGroupsEl=document.getElementById("dupStatGroups");
const dupStatCopiesEl=document.getElementById("dupStatCopies");
const dupStatBytesEl=document.getElementById("dupStatBytes");
const dupStatSelectedEl=document.getElementById("dupStatSelected");
const dupBulkSelectionInfoEl=document.getElementById("dupBulkSelectionInfo");
const dupQuarantineAllEl=document.getElementById("dupQuarantineAll");
const dupTrashAllEl=document.getElementById("dupTrashAll");
const dupMarkAllSuggestedEl=document.getElementById("dupMarkAllSuggested");
const dupClearAllEl=document.getElementById("dupClearAll");

let dupBulkGroups=[],dupBulkSelected=new Set(),dupBulkPage=0,dupBulkBuilding=false;
const DUP_PAGE_SIZE=40;

function v282Yield(){
 return new Promise(resolve=>{
  if("requestIdleCallback" in window)requestIdleCallback(()=>resolve(),{timeout:75});
  else setTimeout(resolve,0);
 });
}
function dupChooseKeeper(files){
 return [...files].sort((a,b)=>{
  const pa=(a.path||"").length,pb=(b.path||"").length;if(pa!==pb)return pa-pb;
  const da=a.createdDateTime?new Date(a.createdDateTime).getTime():Number.MAX_SAFE_INTEGER;
  const db=b.createdDateTime?new Date(b.createdDateTime).getTime():Number.MAX_SAFE_INTEGER;
  if(da!==db)return da-db;return(a.path||"").localeCompare(b.path||"","nb");
 })[0];
}
async function dupBuildBulkGroupsAsync(){
 const map=new Map(),files=report?.files||[];
 for(let i=0;i<files.length;i++){
  const f=files[i];if((f.path||"").startsWith("/_IANS Cleanup Review/"))continue;
  const key=`${String(f.name||"").toLowerCase()}|${Number(f.size)||0}`;
  let g=map.get(key);if(!g){g=[];map.set(key,g)}g.push(f);
  if(i&&i%2500===0)await v282Yield();
 }
 const groups=[];let n=0;
 for(const bucket of map.values()){
  if(bucket.length<2||Number(bucket[0].size)<=0)continue;
  const state=iansHashState(bucket);
  if(state==="mismatch"){
    const parts=new Map();
    for(const f of bucket){const fp=iansFingerprint(f);const key=fp?`${fp.type}|${fp.value}`:`missing|${f.id}`;if(!parts.has(key))parts.set(key,[]);parts.get(key).push(f)}
    for(const g of parts.values())if(g.length>1)groups.push({files:g,keeper:dupChooseKeeper(g),saving:(+g[0].size||0)*(g.length-1),hashState:"verified",fingerprint:iansFingerprint(g[0])});
  }else{
    groups.push({files:bucket,keeper:dupChooseKeeper(bucket),saving:(+bucket[0].size||0)*(bucket.length-1),hashState:state,fingerprint:state==="verified"?iansFingerprint(bucket[0]):null});
  }
  if(++n%3000===0)await v282Yield();
 }
 groups.sort((a,b)=>(a.hashState==="verified"?0:1)-(b.hashState==="verified"?0:1)||b.saving-a.saving);return groups;
}

function dupVisibleGroups(){return dupBulkGroups.slice(0,(dupBulkPage+1)*DUP_PAGE_SIZE)}
function dupVisibleSuggestedIds(){const a=[];for(const g of dupVisibleGroups())if(g.hashState==="verified")for(const f of g.files)if(f.id!==g.keeper.id)a.push(f.id);return a}
function dupAllSuggestedIds(){const a=[];for(const g of dupBulkGroups)if(g.hashState==="verified")for(const f of g.files)if(f.id!==g.keeper.id)a.push(f.id);return a}
function dupRefreshBulkStats(){
 const totalSuggested=dupBulkGroups.filter(g=>g.hashState==="verified").reduce((s,g)=>s+g.files.length-1,0);
 let selectedBytes=0;for(const f of report?.files||[])if(dupBulkSelected.has(f.id))selectedBytes+=+f.size||0;
 dupStatGroupsEl.textContent=formatNumber(dupBulkGroups.length);
 dupStatCopiesEl.textContent=formatNumber(totalSuggested);
 dupStatBytesEl.textContent=formatBytes(dupBulkGroups.filter(g=>g.hashState==="verified").reduce((s,g)=>s+g.saving,0));
 dupStatSelectedEl.textContent=formatNumber(dupBulkSelected.size);
 dupBulkSelectionInfoEl.textContent=dupBulkSelected.size?`${formatNumber(dupBulkSelected.size)} ekstrakopier valgt · ${formatBytes(selectedBytes)} valgt for opprydding`:"Ingen ekstrakopier valgt.";
 dupQuarantineAllEl.disabled=!dupBulkSelected.size;dupTrashAllEl.disabled=!dupBulkSelected.size;
 const x=document.getElementById("largeDriveDupPage");if(x)x.textContent=`${formatNumber(dupVisibleGroups().length)} / ${formatNumber(dupBulkGroups.length)}`;
}
function dupSetGroupSelection(i,on){
 const g=dupBulkGroups[i];if(!g)return;
 for(const f of g.files){if(f.id===g.keeper.id)continue;on?dupBulkSelected.add(f.id):dupBulkSelected.delete(f.id)}
 document.querySelectorAll(`[data-dup-group="${i}"] .dup-bulk-check:not(:disabled)`).forEach(cb=>{cb.checked=on;cb.closest(".dup-file-row")?.classList.toggle("remove-selected",on)});
 dupRefreshBulkStats();
}
function dupRenderVisibleGroups(){
 const visible=dupVisibleGroups();
 dupBulkGroupsEl.innerHTML=visible.map((g,gi)=>`<article class="dup-group" data-dup-group="${gi}">
 <div class="dup-group-head"><div><h4>${escapeHtml(g.files[0].name)}</h4><small>${g.files.length} kopier · ${formatBytes(g.files[0].size||0)} per fil · ${formatBytes(g.saving)} mulig frigjøring</small><span class="dup-hash-state ${g.hashState}">${g.hashState==="verified"?`HASH MATCH · ${escapeHtml(g.fingerprint?.type||"")}`:g.hashState==="partial"?"MANUELL REVIEW · HASH MANGLER PÅ NOEN":"MANUELL REVIEW · HASH IKKE TILGJENGELIG"}</span></div>
 <div class="dup-group-actions"><button class="btn small ${g.hashState==="verified"?"primary":"ghost"}" data-dup-mark-group="${gi}">${g.hashState==="verified"?"Merk hash-verifiserte ekstrakopier":"Merk manuelt etter review"}</button><button class="btn small ghost" data-dup-clear-group="${gi}">Fjern gruppevalg</button><button class="btn small ghost" data-dup-preview-keeper="${escapeHtml(g.keeper.id)}">Preview behold</button></div></div>
 <div class="dup-files">${g.files.map(f=>{const keep=f.id===g.keeper.id,checked=!keep&&dupBulkSelected.has(f.id);return`<div class="dup-file-row ${keep?"keeper":""} ${checked?"remove-selected":""}">
 <input type="checkbox" class="dup-bulk-check" data-dup-id="${escapeHtml(f.id)}" ${keep?"disabled":""} ${checked?"checked":""}>
 <div class="dup-file-main"><strong>${escapeHtml(f.name)}</strong><small>${escapeHtml(f.path||"")}</small></div>
 <div class="dup-file-meta"><span class="dup-pill ${keep?"keep":"candidate"}">${keep?"BEHOLD":g.hashState==="verified"?"HASH-MATCH":"REVIEW"}</span><span>${formatBytes(f.size||0)}</span><button class="btn small ghost" data-dup-preview="${escapeHtml(f.id)}">Preview</button></div></div>`}).join("")}</div></article>`).join("");
 if(visible.length<dupBulkGroups.length)dupBulkGroupsEl.insertAdjacentHTML("beforeend",`<button id="dupLoadMoreBtn" class="btn ghost dup-load-more">Vis ${Math.min(DUP_PAGE_SIZE,dupBulkGroups.length-visible.length)} grupper til</button>`);
 dupRefreshBulkStats();
}
async function dupRenderBulk(){
 const panel=document.getElementById("dupBulkPanel"),badge=document.getElementById("dupBulkBadge");
 if(!panel||!dupBulkGroupsEl||!report?.files||dupBulkBuilding)return;
 dupBulkBuilding=true;dupBulkPage=0;dupBulkSelected.clear();panel.classList.remove("hidden");badge.textContent="Analyserer…";
 dupBulkGroupsEl.innerHTML='<div class="large-busy">Bygger duplikatindeks i puljer. Siden skal fortsatt være responsiv…</div>';
 try{dupBulkGroups=await dupBuildBulkGroupsAsync();badge.textContent=`${formatNumber(dupBulkGroups.length)} grupper`;if(!dupBulkGroups.length){dupBulkGroupsEl.innerHTML='<div class="empty-state">Ingen duplikatkandidater funnet.</div>';dupRefreshBulkStats();return}dupRenderVisibleGroups()}finally{dupBulkBuilding=false}
}
document.addEventListener("change",e=>{const cb=e.target.closest(".dup-bulk-check");if(!cb)return;cb.checked?dupBulkSelected.add(cb.dataset.dupId):dupBulkSelected.delete(cb.dataset.dupId);cb.closest(".dup-file-row")?.classList.toggle("remove-selected",cb.checked);dupRefreshBulkStats()});
document.addEventListener("click",e=>{
 const load=e.target.closest("#dupLoadMoreBtn");if(load){dupBulkPage++;dupRenderVisibleGroups();return}
 const mark=e.target.closest("[data-dup-mark-group]");if(mark){dupSetGroupSelection(+mark.dataset.dupMarkGroup,true);return}
 const clear=e.target.closest("[data-dup-clear-group]");if(clear){dupSetGroupSelection(+clear.dataset.dupClearGroup,false);return}
 const p=e.target.closest("[data-dup-preview]");if(p){previewFile(p.dataset.dupPreview);return}
 const k=e.target.closest("[data-dup-preview-keeper]");if(k){previewFile(k.dataset.dupPreviewKeeper);return}
});
dupMarkAllSuggestedEl?.addEventListener("click",()=>{
 const large=(report?.files?.length||0)>=50000,ids=large?dupVisibleSuggestedIds():dupAllSuggestedIds();
 for(const id of ids)dupBulkSelected.add(id);
 document.querySelectorAll(".dup-bulk-check:not(:disabled)").forEach(cb=>{cb.checked=dupBulkSelected.has(cb.dataset.dupId);cb.closest(".dup-file-row")?.classList.toggle("remove-selected",cb.checked)});
 if(!ids.length)iansToast("Hash Safety","Ingen hash-verifiserte ekstrakopier å merke automatisk.","error",6000);else if(large)iansToast("Large Drive Safety",`Kun synlige hash-verifiserte grupper ble merket (${formatNumber(ids.length)} filer).`,"success",6000);
 dupRefreshBulkStats();
});
dupClearAllEl?.addEventListener("click",()=>{dupBulkSelected.clear();document.querySelectorAll(".dup-bulk-check").forEach(cb=>{cb.checked=false;cb.closest(".dup-file-row")?.classList.remove("remove-selected")});dupRefreshBulkStats()});
function dupPushSelectionIntoActionMode(){if(!dupBulkSelected.size)return false;for(const id of dupBulkSelected)v24Selected.add(id);v24UpdateSelection();return true}
dupQuarantineAllEl?.addEventListener("click",()=>{if(!dupPushSelectionIntoActionMode())return;if(!v24Enabled){alert("Aktiver Action Mode øverst først.");return}v24.quarantine?.click()});
dupTrashAllEl?.addEventListener("click",()=>{if(!dupPushSelectionIntoActionMode())return;if(!v24Enabled){alert("Aktiver Action Mode øverst først.");return}v24.trash?.click()});
const _renderReportV282Dup=renderReport;
renderReport=function(r){_renderReportV282Dup(r);setTimeout(dupRenderBulk,(r?.files?.length||0)>=50000?150:0)};

// ===== V2.8.4 FOLDER DOWNLOAD + VERIFY =====
const DL_CHECKPOINT_KEY="ians_folder_download_checkpoint_v284";
let dlDirectoryHandle=null;
let dlInventory=[];
let dlJob={running:false,paused:false,cancelled:false,started:0,bytes:0,totalBytes:0,errors:0,verified:0,lastBytes:0,lastTime:0,speedNow:0,done:0,total:0};

const dlEl=id=>document.getElementById(id);
const dlSleep=ms=>new Promise(r=>setTimeout(r,ms));

async function dlListChildren(folderId){
  const token=await getToken();
  let url=folderId
    ? `${GRAPH}/me/drive/items/${encodeURIComponent(folderId)}/children?$top=200&$select=id,name,size,file,folder,lastModifiedDateTime`
    : `${GRAPH}/me/drive/root/children?$top=200&$select=id,name,size,file,folder,lastModifiedDateTime`;
  const out=[];
  while(url){
    let res;
    for(let attempt=0;attempt<6;attempt++){
      res=await fetch(url,{headers:{Authorization:`Bearer ${token}`}});
      if(res.ok) break;
      if(![429,503,504].includes(res.status)) break;
      const retry=+(res.headers.get("Retry-After")||0);
      await dlSleep(retry?retry*1000:Math.min(30000,1000*2**attempt));
    }
    if(!res?.ok) throw new Error(`Graph ${res?.status||"?"}: kunne ikke lese mappe`);
    const data=await res.json();
    out.push(...(data.value||[]));
    url=data["@odata.nextLink"]||null;
  }
  return out;
}

async function dlEnumerateFolder(source){
  const queue=[{id:source.id,rel:""}];
  const files=[];
  let folders=0;
  dlEl("downloadAnalyzeStatus").textContent="Leser mappestruktur…";
  while(queue.length){
    const current=queue.shift();
    const items=await dlListChildren(current.id);
    folders++;
    for(const item of items){
      const rel=current.rel?`${current.rel}/${item.name}`:item.name;
      if(item.folder){
        queue.push({id:item.id,rel});
      }else if(item.file){
        files.push({
          id:item.id,
          name:item.name,
          size:+item.size||0,
          mimeType:item.file?.mimeType||"",
          relativePath:rel,
          path:`${source.path.replace(/\/$/,"")}/${rel}`.replace(/\/+/g,"/"),
          lastModifiedDateTime:item.lastModifiedDateTime||""
        });
      }
    }
    if(folders%10===0){
      dlEl("downloadAnalyzeStatus").textContent=`Analyserer… ${formatNumber(files.length)} filer funnet · ${formatNumber(queue.length)} mapper i kø`;
      await dlSleep(0);
    }
  }
  files.sort((a,b)=>a.relativePath.localeCompare(b.relativePath,"nb",{numeric:true,sensitivity:"base"}));
  return files;
}

function dlSafeParts(rel){
  return String(rel||"").split("/").filter(Boolean).map(iansSafePathSegment);
}

async function dlGetOutputRoot(create=true){
  if(!dlDirectoryHandle) throw new Error("Velg lokal målmappe først.");
  const base=await dlDirectoryHandle.getDirectoryHandle("_IANS OneDrive Backup",{create});
  const sourceName=iansSafePathSegment(selectedDownloadFolder.name||"OneDrive");
  return await base.getDirectoryHandle(sourceName,{create});
}

async function dlOpenLocalFile(rel,{create=false}={}){
  const parts=dlSafeParts(rel);
  const name=parts.pop();
  let dir=await dlGetOutputRoot(create);
  for(const part of parts){
    dir=await dir.getDirectoryHandle(part,{create});
  }
  return await dir.getFileHandle(name,{create});
}

function dlFmtTime(sec){
  if(!Number.isFinite(sec)||sec<0)return"–";
  sec=Math.round(sec);
  if(sec<60)return`${sec} sek`;
  const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;
  return h?`${h} t ${m} min`:`${m} min ${s} sek`;
}

function dlUpdateLive(done,total,file){
  dlEl("downloadProgress").classList.remove("hidden");
  dlEl("downloadProgressCount").textContent=`${formatNumber(done)} / ${formatNumber(total)}`;
  dlEl("downloadProgressFill").style.width=`${total?Math.round(done/total*100):0}%`;
  dlEl("downloadProgressFile").textContent=file||"";
  dlEl("downloadErrorCount").textContent=formatNumber(dlJob.errors);
  dlEl("downloadVerifiedCount").textContent=formatNumber(dlJob.verified);
  dlEl("downloadBytesProgress").textContent=`${formatBytes(dlJob.bytes)} / ${formatBytes(dlJob.totalBytes)}`;
  const now=performance.now(),elapsed=(now-dlJob.started)/1000,avg=elapsed>0?dlJob.bytes/elapsed:0;
  if(now-dlJob.lastTime>500){
    dlJob.speedNow=(dlJob.bytes-dlJob.lastBytes)/((now-dlJob.lastTime)/1000);
    dlJob.lastBytes=dlJob.bytes;dlJob.lastTime=now;
  }
  dlEl("downloadSpeedNow").textContent=dlJob.speedNow>0?`${formatBytes(dlJob.speedNow)}/s`:"–";
  dlEl("downloadSpeedAvg").textContent=avg>0?`${formatBytes(avg)}/s`:"–";
  dlEl("downloadEta").textContent=avg>0?dlFmtTime(Math.max(0,dlJob.totalBytes-dlJob.bytes)/avg):"–";
  dlEl("downloadProgressLabel").textContent=dlJob.paused?"Pauset":dlJob.cancelled?"Avbryter trygt…":done>=total?"Ferdig":"Laster ned direkte til disk…";
}

async function dlWaitIfPaused(){
  while(dlJob.paused&&!dlJob.cancelled) await dlSleep(150);
}

async function dlLocalFileMatches(f){
  try{
    const h=await dlOpenLocalFile(f.relativePath,{create:false});
    const file=await h.getFile();
    return file.size===f.size;
  }catch{
    return false;
  }
}

async function dlDownloadOne(f){
  // Resume/safe retry: if a correct-size file already exists, skip network transfer.
  if(await dlLocalFileMatches(f)){
    dlJob.verified++;
    return {skipped:true,bytes:0};
  }
  const token=await getToken();
  const res=await fetch(`${GRAPH}/me/drive/items/${encodeURIComponent(f.id)}/content`,{
    headers:{Authorization:`Bearer ${token}`}
  });
  if(!res.ok) throw new Error(`Graph ${res.status}`);
  const localHandle=await dlOpenLocalFile(f.relativePath,{create:true});
  const writable=await localHandle.createWritable();
  const reader=res.body.getReader();
  let written=0;
  try{
    while(true){
      await dlWaitIfPaused();
      if(dlJob.cancelled){
        try{await reader.cancel()}catch{}
        throw new DOMException("Cancelled","AbortError");
      }
      const {done,value}=await reader.read();
      if(done)break;
      await writable.write(value);
      written+=value.byteLength;
      dlJob.bytes+=value.byteLength;
      dlUpdateLive(dlJob.done,dlJob.total,f.relativePath);
    }
    await writable.close();
  }catch(err){
    try{await writable.abort()}catch{}
    throw err;
  }
  const ok=await dlLocalFileMatches(f);
  if(!ok) throw new Error(`Verifisering feilet: forventet ${f.size} bytes`);
  dlJob.verified++;
  return {skipped:false,bytes:written};
}

function dlSaveCheckpoint(nextIndex){
  localStorage.setItem(DL_CHECKPOINT_KEY,JSON.stringify({
    version:1,
    source:selectedDownloadFolder,
    nextIndex,
    total:dlInventory.length,
    createdAt:new Date().toISOString()
  }));
  dlRefreshButtons();
}

function dlLoadCheckpoint(){
  try{return JSON.parse(localStorage.getItem(DL_CHECKPOINT_KEY)||"null")}catch{return null}
}

function dlRefreshButtons(){
  const hasSource=!!selectedDownloadFolder?.path && (selectedDownloadFolder.id!==undefined);
  const hasInventory=dlInventory.length>0;
  dlEl("downloadAnalyzeBtn").disabled=!hasSource||dlJob.running;
  dlEl("downloadStartBtn").disabled=!hasInventory||!dlDirectoryHandle||dlJob.running;
  dlEl("downloadVerifyBtn").disabled=!hasInventory||!dlDirectoryHandle||dlJob.running;
  dlEl("downloadResumeBtn").disabled=!dlLoadCheckpoint()||dlJob.running;
}

async function dlAnalyzeSource(){
  if(!selectedDownloadFolder?.path)return;
  dlEl("downloadAnalyzeBtn").disabled=true;
  dlEl("downloadAnalyzeStatus").textContent="Analyserer valgt OneDrive-mappe…";
  try{
    dlInventory=await dlEnumerateFolder(selectedDownloadFolder);
    const bytes=dlInventory.reduce((s,f)=>s+f.size,0);
    dlEl("downloadFileCount").textContent=`${formatNumber(dlInventory.length)} filer`;
    dlEl("downloadTotalBytes").textContent=formatBytes(bytes);
    dlEl("downloadAnalyzeStatus").textContent=`Klar · ${formatNumber(dlInventory.length)} filer · ${formatBytes(bytes)}`;
    dlEl("downloadSpaceCheck").textContent=dlDirectoryHandle
      ? `Kilde: ${selectedDownloadFolder.path}. Lokal backup blir lagret under _IANS OneDrive Backup/${selectedDownloadFolder.name}.`
      : `Kilde: ${selectedDownloadFolder.path}. Velg lokal målmappe før nedlasting.`;
  }catch(err){
    console.error("[IANS] Folder download analysis failed",err);
    dlInventory=[];
    dlEl("downloadAnalyzeStatus").textContent=`Analyse feilet: ${err.message}`;
  }
  dlRefreshButtons();
}

async function dlPickLocal(){
  if(!window.showDirectoryPicker){
    alert("Bruk Edge/Chrome for lokalt mappevalg.");
    return;
  }
  try{
    dlDirectoryHandle=await window.showDirectoryPicker({mode:"readwrite"});
    dlEl("downloadLocalFolder").textContent=dlDirectoryHandle.name;
    dlEl("downloadSpaceCheck").textContent=dlInventory.length
      ? `${formatNumber(dlInventory.length)} filer · ${formatBytes(dlInventory.reduce((s,f)=>s+f.size,0))}. Mål: ${dlDirectoryHandle.name}/_IANS OneDrive Backup/${selectedDownloadFolder.name}`
      : `Lokal målmappe valgt: ${dlDirectoryHandle.name}`;
    dlRefreshButtons();
  }catch(err){
    if(err.name!=="AbortError") console.error(err);
  }
}

async function dlRun(startIndex=0){
  if(dlJob.running)return;
  if(!dlDirectoryHandle){alert("Velg lokal målmappe først.");return}
  if(!dlInventory.length){await dlAnalyzeSource();if(!dlInventory.length)return}
  const totalBytes=dlInventory.slice(startIndex).reduce((s,f)=>s+f.size,0);
  dlJob={running:true,paused:false,cancelled:false,started:performance.now(),bytes:0,totalBytes,errors:0,verified:0,lastBytes:0,lastTime:performance.now(),speedNow:0,done:startIndex,total:dlInventory.length};
  dlEl("downloadPauseBtn").textContent="Pause";
  dlEl("downloadVerifyResult").classList.add("hidden");
  dlSaveCheckpoint(startIndex);
  dlRefreshButtons();

  for(let i=startIndex;i<dlInventory.length;i++){
    const f=dlInventory[i];
    dlJob.done=i;
    dlUpdateLive(i,dlInventory.length,f.relativePath);
    if(dlJob.cancelled)break;
    try{
      await dlDownloadOne(f);
    }catch(err){
      if(err?.name==="AbortError"&&dlJob.cancelled)break;
      console.error("[IANS] Folder download failed",f.path,err);
      dlJob.errors++;
    }
    dlJob.done=i+1;
    dlSaveCheckpoint(i+1);
    dlUpdateLive(i+1,dlInventory.length,f.relativePath);
  }

  const cancelled=dlJob.cancelled;
  const errors=dlJob.errors;
  dlJob.running=false;dlJob.paused=false;
  if(!cancelled && dlJob.done>=dlInventory.length) localStorage.removeItem(DL_CHECKPOINT_KEY);
  dlRefreshButtons();
  dlEl("downloadProgressLabel").textContent=cancelled?"Avbrutt trygt":"Nedlasting ferdig";
  const ok=dlInventory.length-errors;
  iansToast(
    cancelled?"Nedlasting avbrutt":"Mappebackup ferdig",
    cancelled
      ? `${formatNumber(dlJob.done)} av ${formatNumber(dlInventory.length)} behandlet. Resume er lagret.`
      : `${formatNumber(ok)} filer ferdig · ${formatNumber(errors)} feil · ${formatNumber(dlJob.verified)} verifisert.`,
    errors?"error":"success",10000
  );
  if(!cancelled) await dlVerifyAll();
}

async function dlVerifyAll(){
  if(!dlDirectoryHandle){alert("Velg samme lokale målmappe først.");return}
  if(!dlInventory.length){await dlAnalyzeSource();if(!dlInventory.length)return}
  const result=dlEl("downloadVerifyResult");
  result.classList.remove("hidden");
  result.innerHTML=`<strong>Verifiserer lokal kopi…</strong><p class="muted">Kontrollerer fil for fil mot forventet størrelse.</p>`;
  let ok=0,missing=0,bad=0;
  const badRows=[];
  for(let i=0;i<dlInventory.length;i++){
    const f=dlInventory[i];
    try{
      const h=await dlOpenLocalFile(f.relativePath,{create:false});
      const local=await h.getFile();
      if(local.size===f.size) ok++;
      else{bad++;badRows.push(`${f.relativePath} · lokal ${formatBytes(local.size)} / forventet ${formatBytes(f.size)}`)}
    }catch{
      missing++;badRows.push(`${f.relativePath} · MANGLER`);
    }
    if(i%25===0){
      result.innerHTML=`<strong>Verifiserer… ${formatNumber(i)} / ${formatNumber(dlInventory.length)}</strong>
        <p class="muted">${formatNumber(ok)} OK · ${formatNumber(missing)} mangler · ${formatNumber(bad)} størrelseavvik</p>`;
      await dlSleep(0);
    }
  }
  const allOk=ok===dlInventory.length;
  result.className=`download-verify-result ${allOk?"ok":"warn"}`;
  result.innerHTML=`<div class="download-result-head">
      <div><span class="eyebrow">${allOk?"VERIFISERT":"KONTROLL NØDVENDIG"}</span>
      <h3>${allOk?"Lokal mappe er komplett":"Lokal kopi har avvik"}</h3></div>
      <span class="badge ${allOk?"safe":""}">${formatNumber(ok)} / ${formatNumber(dlInventory.length)} OK</span>
    </div>
    <div class="action-result-grid">
      <div><span>OK</span><strong>${formatNumber(ok)}</strong></div>
      <div><span>MANGLER</span><strong>${formatNumber(missing)}</strong></div>
      <div><span>STØRRELSESAVVIK</span><strong>${formatNumber(bad)}</strong></div>
    </div>
    <p class="muted">Kilde: <code>${escapeHtml(selectedDownloadFolder.path)}</code></p>
    <p class="muted">Lokal rot: <code>_IANS OneDrive Backup/${escapeHtml(selectedDownloadFolder.name)}</code></p>
    ${badRows.length?`<details><summary>Vis avvik (${badRows.length})</summary><div class="download-bad-list">${badRows.slice(0,200).map(x=>`<div>${escapeHtml(x)}</div>`).join("")}</div></details>`:""}
    ${allOk?'<p class="download-safe-message">✓ Alle forventede filer finnes lokalt med korrekt størrelse. Dette er en sterk sikkerhetssjekk før videre opprydding i OneDrive.</p>':''}`;
  dlJob.verified=ok;
  dlEl("downloadVerifiedCount").textContent=formatNumber(ok);
}

dlEl("downloadBrowseSourceBtn")?.addEventListener("click",async()=>{
  folderBrowserPurpose="download";
  browserStack=[{id:null,path:"/"}];
  folderModal.classList.remove("hidden");
  await loadFolderBrowserLevel();
});
dlEl("downloadUseScanFolderBtn")?.addEventListener("click",async()=>{
  if(!selectedScanFolder?.path || (selectedScanFolder.path==="/"&&!selectedScanFolder.id)){
    selectedDownloadFolder={id:null,path:"/",name:"OneDrive"};
  }else{
    const parts=selectedScanFolder.path.split("/").filter(Boolean);
    selectedDownloadFolder={...selectedScanFolder,name:parts[parts.length-1]||"OneDrive"};
  }
  dlEl("downloadSourcePath").textContent=selectedDownloadFolder.path;
  await dlAnalyzeSource();
});
dlEl("downloadAnalyzeBtn")?.addEventListener("click",dlAnalyzeSource);
dlEl("downloadPickLocalBtn")?.addEventListener("click",dlPickLocal);
dlEl("downloadStartBtn")?.addEventListener("click",()=>dlRun(0));
dlEl("downloadVerifyBtn")?.addEventListener("click",dlVerifyAll);
dlEl("downloadResumeBtn")?.addEventListener("click",async()=>{
  const cp=dlLoadCheckpoint();
  if(!cp)return alert("Fant ingen lagret nedlastingsjobb.");
  if(!dlDirectoryHandle){
    alert("Velg den samme lokale målmappe først, og trykk Resume igjen.");
    return;
  }
  selectedDownloadFolder=cp.source;
  dlEl("downloadSourcePath").textContent=selectedDownloadFolder.path;
  await dlAnalyzeSource();
  const next=Math.min(cp.nextIndex||0,dlInventory.length);
  await dlRun(next);
});
dlEl("downloadPauseBtn")?.addEventListener("click",()=>{
  if(!dlJob.running)return;
  dlJob.paused=!dlJob.paused;
  dlEl("downloadPauseBtn").textContent=dlJob.paused?"Fortsett":"Pause";
  dlUpdateLive(dlJob.done,dlJob.total,dlEl("downloadProgressFile").textContent);
});
dlEl("downloadCancelBtn")?.addEventListener("click",()=>{
  if(dlJob.running){dlJob.cancelled=true;dlJob.paused=false}
});
setTimeout(dlRefreshButtons,1200);


// ===== V2.8.4 Web Edition + Download & Verify MEDIA VAULT EXPORT =====
const MEDIA_CHECKPOINT_KEY="ians_media_vault_checkpoint_v281";
let mediaDirectoryHandle=null, mediaSelection=[];
let mediaJob={running:false,paused:false,cancelled:false,started:0,bytes:0,totalBytes:0,errors:0,lastBytes:0,lastTime:0,speedNow:0,mode:"original"};
const mediaSleep=ms=>new Promise(r=>setTimeout(r,ms));
function mediaIsVideo(f){const n=(f.name||"").toLowerCase(),m=(f.mimeType||"").toLowerCase();return m.startsWith("video/")||/\.(mp4|mov|m4v|avi|mkv|webm|3gp)$/i.test(n)}
function mediaIsImage(f){const n=(f.name||"").toLowerCase(),m=(f.mimeType||"").toLowerCase();return m.startsWith("image/")||/\.(jpg|jpeg|png|heic|heif|webp|gif|tif|tiff)$/i.test(n)}
function mediaYear(f){const d=f.takenDateTime||f.createdDateTime||f.lastModifiedDateTime,y=d?new Date(d).getFullYear():null;return Number.isFinite(y)?String(y):"Ukjent"}
function mediaFiles(){return(report?.files||[]).filter(f=>mediaIsImage(f)||mediaIsVideo(f))}
function mediaBuildYearOptions(){const sel=document.getElementById("mediaPeriodSelect");if(!sel)return;const years=[...new Set(mediaFiles().map(mediaYear).filter(y=>y!=="Ukjent"))].sort((a,b)=>b-a),current=sel.value;sel.innerHTML='<option value="all">Alle år</option><option value="latest">Siste år i biblioteket</option>'+years.map(y=>`<option value="${y}">${y}</option>`).join("");if([...sel.options].some(o=>o.value===current))sel.value=current}
function mediaSelectedFiles(){const kind=document.getElementById("mediaKindSelect")?.value||"all",period=document.getElementById("mediaPeriodSelect")?.value||"all";let files=mediaFiles();if(kind==="images")files=files.filter(mediaIsImage);if(kind==="videos")files=files.filter(mediaIsVideo);const years=files.map(mediaYear).filter(y=>y!=="Ukjent").sort((a,b)=>b-a),latest=years[0];if(period==="latest"&&latest)files=files.filter(f=>mediaYear(f)===latest);else if(/^\d{4}$/.test(period))files=files.filter(f=>mediaYear(f)===period);return files}
async function mediaLoadDiskSpace(){
  if(IANS_WEB_EDITION){
    const free=document.getElementById("mediaDiskFree");
    const path=document.getElementById("mediaDiskPath");
    if(free) free.textContent="Kontroller lokalt";
    if(path) path.textContent="Web Edition · velg målmappe";
    return {webEdition:true,free:null,path:null};
  }
  try{
    const res=await fetch("/__ians/disk-space",{cache:"no-store"});
    const d=await res.json();
    document.getElementById("mediaDiskFree").textContent=formatBytes(d.free||0);
    document.getElementById("mediaDiskPath").textContent=d.path||"lokal disk";
    return d;
  }catch{
    document.getElementById("mediaDiskFree").textContent="Ukjent";
    return null;
  }
}
async function mediaRender(){if(!report?.files)return;mediaBuildYearOptions();const all=mediaFiles(),imgs=all.filter(mediaIsImage),vids=all.filter(mediaIsVideo);mediaSelection=mediaSelectedFiles();const imgBytes=imgs.reduce((s,f)=>s+(+f.size||0),0),vidBytes=vids.reduce((s,f)=>s+(+f.size||0),0),selectedBytes=mediaSelection.reduce((s,f)=>s+(+f.size||0),0);mediaImageCount.textContent=formatNumber(imgs.length);mediaImageBytes.textContent=formatBytes(imgBytes);mediaVideoCount.textContent=formatNumber(vids.length);mediaVideoBytes.textContent=formatBytes(vidBytes);mediaSelectedCount.textContent=formatNumber(mediaSelection.length);mediaSelectedBytes.textContent=formatBytes(selectedBytes);const years=new Map();for(const f of all){const y=mediaYear(f);if(!years.has(y))years.set(y,{images:0,videos:0,bytes:0});const x=years.get(y);mediaIsImage(f)?x.images++:x.videos++;x.bytes+=+f.size||0}mediaYearGrid.innerHTML=[...years.entries()].sort((a,b)=>String(b[0]).localeCompare(String(a[0]))).map(([y,x])=>`<div class="media-year-card"><strong>${escapeHtml(y)}</strong><span>${formatNumber(x.images)} bilder · ${formatNumber(x.videos)} videoer</span><span>${formatBytes(x.bytes)}</span></div>`).join("");const disk=await mediaLoadDiskSpace();mediaSpaceCheck.textContent=!mediaSelection.length?"Ingen media i gjeldende utvalg.":disk?(disk.free>=selectedBytes*1.08?`Utvalg: ${formatBytes(selectedBytes)}. Ledig disk: ${formatBytes(disk.free)}. Det ser ut til å være nok plass.`:`ADVARSEL: Utvalg ${formatBytes(selectedBytes)}, men bare ${formatBytes(disk.free)} ledig.`):`Utvalg: ${formatBytes(selectedBytes)}. Lokal ledig plass kunne ikke leses.`;mediaStartBackupBtn.disabled=!mediaDirectoryHandle||!mediaSelection.length||mediaJob.running;mediaStartCompressedBtn.disabled=!mediaDirectoryHandle||!mediaSelection.some(f=>/\.(jpg|jpeg|png)$/i.test(f.name||""))||mediaJob.running;const cp=JSON.parse(localStorage.getItem(MEDIA_CHECKPOINT_KEY)||"null");mediaResumeBtn.disabled=!(cp?.remainingIds?.length)||mediaJob.running}
async function mediaPickDirectory(){if(!window.showDirectoryPicker){alert("Bruk Edge/Chrome for lokalt mappevalg.");return}try{mediaDirectoryHandle=await window.showDirectoryPicker({mode:"readwrite"});mediaPickFolderBtn.textContent=`Mappe valgt: ${mediaDirectoryHandle.name}`;await mediaRender()}catch(err){if(err.name!=="AbortError")console.error(err)}}
async function mediaEnsureDir(root,parts){let dir=root;for(const raw of parts.filter(Boolean))dir=await dir.getDirectoryHandle(iansSafePathSegment(raw),{create:true});return dir}
function mediaFmtTime(sec){if(!Number.isFinite(sec)||sec<0)return"–";sec=Math.round(sec);if(sec<60)return`${sec} sek`;const m=Math.floor(sec/60),s=sec%60;return`${m} min ${s} sek`}
function mediaUpdateLive(done,total,file){mediaBackupProgress.classList.remove("hidden");mediaProgressCount.textContent=`${done} / ${total}`;mediaProgressFill.style.width=`${total?Math.round(done/total*100):0}%`;mediaProgressFile.textContent=file||"";mediaErrorCount.textContent=mediaJob.errors;mediaJobMode.textContent=mediaJob.mode==="compressed"?"Komprimert eksport":"Original backup";mediaBytesProgress.textContent=`${formatBytes(mediaJob.bytes)} / ${formatBytes(mediaJob.totalBytes)}`;const now=performance.now(),elapsed=(now-mediaJob.started)/1000,avg=elapsed>0?mediaJob.bytes/elapsed:0;if(now-mediaJob.lastTime>500){mediaJob.speedNow=(mediaJob.bytes-mediaJob.lastBytes)/((now-mediaJob.lastTime)/1000);mediaJob.lastBytes=mediaJob.bytes;mediaJob.lastTime=now}mediaSpeedNow.textContent=mediaJob.speedNow>0?`${formatBytes(mediaJob.speedNow)}/s`:"–";mediaSpeedAvg.textContent=avg>0?`${formatBytes(avg)}/s`:"–";mediaEta.textContent=avg>0?mediaFmtTime(Math.max(0,mediaJob.totalBytes-mediaJob.bytes)/avg):"–";mediaProgressLabel.textContent=mediaJob.paused?"Pauset":mediaJob.cancelled?"Avbryter trygt…":done>=total?"Ferdig":mediaJob.mode==="compressed"?"Laster ned og komprimerer…":"Laster ned…"}
async function mediaWaitIfPaused(){while(mediaJob.paused&&!mediaJob.cancelled)await mediaSleep(150)}
async function mediaFetchBlob(f){const token=await getToken(),res=await fetch(`${GRAPH}/me/drive/items/${encodeURIComponent(f.id)}/content`,{headers:{Authorization:`Bearer ${token}`}});if(!res.ok)throw new Error(`Graph ${res.status}`);const reader=res.body.getReader(),chunks=[];let size=0;while(true){await mediaWaitIfPaused();if(mediaJob.cancelled){try{await reader.cancel()}catch{}throw new DOMException("Cancelled","AbortError")}const {done,value}=await reader.read();if(done)break;chunks.push(value);size+=value.byteLength;mediaJob.bytes+=value.byteLength;mediaUpdateLive(mediaJob.done,mediaJob.total,f.path||f.name)}return new Blob(chunks,{type:res.headers.get("content-type")||f.mimeType||"application/octet-stream"})}
async function mediaWriteBlob(f,root,blob,compressed=false){let rel=(f.path||"").replace(/^\/+/,"").split("/").filter(Boolean),name=rel.pop()||f.name;if(compressed){rel=["_IANS Media Compressed",...rel];name=name.replace(/\.[^.]+$/,".webp")}const dir=await mediaEnsureDir(root,rel),handle=await dir.getFileHandle(iansSafePathSegment(name),{create:true}),w=await handle.createWritable();await w.write(blob);await w.close();return blob.size}
async function mediaCompressBlob(blob){const q=+(mediaQualitySelect?.value||.82),maxW=+(mediaWidthSelect?.value||0),bmp=await createImageBitmap(blob);let w=bmp.width,h=bmp.height;if(maxW&&w>maxW){h=Math.round(h*maxW/w);w=maxW}const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;const ctx=canvas.getContext("2d",{alpha:true});ctx.drawImage(bmp,0,0,w,h);bmp.close();const out=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Komprimering feilet")),"image/webp",q));return out}
function mediaSaveCheckpoint(files,done,mode){localStorage.setItem(MEDIA_CHECKPOINT_KEY,JSON.stringify({remainingIds:files.slice(done).map(x=>x.id),mode,createdAt:new Date().toISOString()}))}
async function mediaRunJob(files,mode="original"){if(!mediaDirectoryHandle){alert("Velg lokal målmappe først.");return}if(mediaJob.running)return;if(mode==="compressed")files=files.filter(f=>/\.(jpg|jpeg|png)$/i.test(f.name||""));const totalBytes=files.reduce((s,f)=>s+(+f.size||0),0);mediaJob={running:true,paused:false,cancelled:false,started:performance.now(),bytes:0,totalBytes,errors:0,lastBytes:0,lastTime:performance.now(),speedNow:0,mode,done:0,total:files.length,outputBytes:0};mediaPauseBtn.textContent="Pause";mediaSaveCheckpoint(files,0,mode);await mediaRender();for(let i=0;i<files.length;i++){const f=files[i];mediaJob.done=i;mediaUpdateLive(i,files.length,f.path||f.name);if(mediaJob.cancelled)break;try{const blob=await mediaFetchBlob(f);await mediaWaitIfPaused();if(mediaJob.cancelled)break;const out=mode==="compressed"?await mediaCompressBlob(blob):blob;mediaJob.outputBytes+=await mediaWriteBlob(f,mediaDirectoryHandle,out,mode==="compressed")}catch(err){if(err?.name==="AbortError"&&mediaJob.cancelled)break;console.error("[IANS] Media job failed",f.path,err);mediaJob.errors++}mediaJob.done=i+1;mediaSaveCheckpoint(files,i+1,mode);mediaUpdateLive(i+1,files.length,f.path||f.name)}const cancelled=mediaJob.cancelled,done=mediaJob.done,errors=mediaJob.errors,elapsed=(performance.now()-mediaJob.started)/1000,input=mediaJob.bytes,output=mediaJob.outputBytes;if(!cancelled)localStorage.removeItem(MEDIA_CHECKPOINT_KEY);mediaJob.running=false;mediaJob.paused=false;mediaProgressLabel.textContent=cancelled?"Avbrutt trygt":"Jobb ferdig";await mediaRender();const saved=mode==="compressed"?Math.max(0,input-output):0;iansToast(cancelled?"Mediajobb avbrutt":errors?"Mediajobb fullført med feil":"Mediajobb ferdig",cancelled?`${done} filer ferdig. Checkpoint er lagret for Resume.`:mode==="compressed"?`${done-errors} filer · ${formatBytes(input)} → ${formatBytes(output)} · spart ${formatBytes(saved)} · ${mediaFmtTime(elapsed)}.`:`${done-errors} filer · ${formatBytes(input)} · ${mediaFmtTime(elapsed)} · ${errors} feil.`,errors?"error":"success",10000)}
function mediaEstimateCompression(){const q=+(mediaQualitySelect?.value||.82),files=mediaSelection.filter(f=>/\.(jpg|jpeg|png)$/i.test(f.name||"")),original=files.reduce((s,f)=>s+(+f.size||0),0),ratio=q>=.9?.72:q>=.8?.52:.38,estimated=Math.round(original*ratio),gain=Math.max(0,original-estimated);mediaCompressionEstimate.textContent=files.length?`${formatNumber(files.length)} JPEG/PNG-kandidater · originalt ${formatBytes(original)} · grovt estimat ${formatBytes(estimated)} · mulig gevinst ca. ${formatBytes(gain)}. Originalene endres aldri.`:"Ingen JPEG/PNG i valgt utvalg."}
mediaRecalcBtn?.addEventListener("click",mediaRender);mediaKindSelect?.addEventListener("change",mediaRender);mediaPeriodSelect?.addEventListener("change",mediaRender);mediaPickFolderBtn?.addEventListener("click",mediaPickDirectory);mediaStartBackupBtn?.addEventListener("click",()=>mediaRunJob(mediaSelection,"original"));mediaStartCompressedBtn?.addEventListener("click",()=>mediaRunJob(mediaSelection,"compressed"));mediaResumeBtn?.addEventListener("click",async()=>{const cp=JSON.parse(localStorage.getItem(MEDIA_CHECKPOINT_KEY)||"null");if(!cp?.remainingIds?.length)return;if(!mediaDirectoryHandle){alert("Velg samme lokale målmappe først, og trykk Resume igjen.");return}const files=(report?.files||[]).filter(f=>cp.remainingIds.includes(f.id));await mediaRunJob(files,cp.mode||"original")});mediaPauseBtn?.addEventListener("click",()=>{if(!mediaJob.running)return;mediaJob.paused=!mediaJob.paused;mediaPauseBtn.textContent=mediaJob.paused?"Fortsett":"Pause";mediaUpdateLive(mediaJob.done,mediaJob.total,mediaProgressFile.textContent)});mediaCancelBtn?.addEventListener("click",()=>{if(mediaJob.running){mediaJob.cancelled=true;mediaJob.paused=false}});mediaEstimateCompressionBtn?.addEventListener("click",mediaEstimateCompression);

const _renderReportV281=renderReport;
renderReport=function(r){
  _renderReportV281(r);
  setTimeout(mediaRender,0);
};

function v282LargeStatus(){
 if(!report?.files)return;
 const panel=document.getElementById("largeDrivePanel"),count=report.files.length,large=count>=50000;
 if(!panel)return;panel.classList.toggle("hidden",!large);if(!large)return;
 document.getElementById("largeDriveFiles").textContent=formatNumber(count);
 document.getElementById("largeDriveMode").textContent="Large Drive";
 document.getElementById("largeDriveRenderState").textContent="Puljevis";
 document.getElementById("largeDriveHint").textContent="Automatisk sikkerhetsmodus: maks 250 inventarrader og 40 duplikatgrupper om gangen.";
 if(dupMarkAllSuggestedEl)dupMarkAllSuggestedEl.textContent="Merk synlige foreslåtte";
}
const _renderReportV282Status=renderReport;
renderReport=function(r){_renderReportV282Status(r);setTimeout(v282LargeStatus,50)};

// ===== IANS V2.8.4 WEB EDITION =====
function iansRenderWebEdition(){
  const edition=document.getElementById("editionBadge");
  const privacy=document.getElementById("webPrivacyNote");
  const callback=document.getElementById("popupRedirectUri");
  const webNote=document.getElementById("webDownloadSupport");
  if(edition){
    edition.textContent=IANS_WEB_EDITION?"WEB EDITION":"LOCAL TEST";
    edition.classList.toggle("web-edition",IANS_WEB_EDITION);
  }
  if(privacy) privacy.classList.toggle("hidden",!IANS_WEB_EDITION);
  if(callback) callback.textContent=POPUP_REDIRECT_URI;
  if(webNote){
    const supported=!!window.showDirectoryPicker;
    webNote.textContent=supported
      ? "Denne nettleseren støtter lokal mappebackup med Resume og Verify."
      : "Lokal mappebackup krever en Chromium-nettleser med File System Access API, for eksempel Microsoft Edge eller Chrome.";
    webNote.classList.toggle("web-support-ok",supported);
  }
}
window.addEventListener("DOMContentLoaded",iansRenderWebEdition);

// ===== IANS V2.8.5 RESILIENT DOWNLOAD + SAFETY + ORGANIZATION STUDIO =====
(() => {
  const V285_SAFETY_KEY="ians_v285_safety_ack";
  const V285_ACTION_SESSION_KEY="ians_v285_action_ack";
  const V285_STALL_MS=60000;
  const V285_RETRIES=3;
  const V285_RETRY_DELAYS=[2000,5000,10000];
  const E=id=>document.getElementById(id);
  const wait=ms=>new Promise(r=>setTimeout(r,ms));

  function modal({title,eyebrow="VIKTIG",body="",confirm="Fortsett",cancel="Avbryt",danger=false,checkbox=false}){
    return new Promise(resolve=>{
      const wrap=document.createElement("div");
      wrap.className="v285-safety-overlay";
      wrap.innerHTML=`<div class="v285-safety-card" role="dialog" aria-modal="true">
        <span class="eyebrow">${escapeHtml(eyebrow)}</span><h2>${escapeHtml(title)}</h2>
        <div class="v285-safety-body">${body}</div>
        ${checkbox?`<label class="v285-check"><input type="checkbox" id="v285Check"><span>Jeg har lest og forstått informasjonen ovenfor.</span></label>`:""}
        <div class="v285-safety-actions"><button class="btn ghost" id="v285Cancel">${escapeHtml(cancel)}</button><button class="btn ${danger?"danger":"primary"}" id="v285Confirm" ${checkbox?"disabled":""}>${escapeHtml(confirm)}</button></div>
      </div>`;
      document.body.appendChild(wrap);
      const ok=wrap.querySelector("#v285Confirm"),no=wrap.querySelector("#v285Cancel"),cb=wrap.querySelector("#v285Check");
      if(cb)cb.onchange=()=>ok.disabled=!cb.checked;
      no.onclick=()=>{wrap.remove();resolve(false)};
      ok.onclick=()=>{wrap.remove();resolve(true)};
    });
  }

  async function startupSafety(){
    if(localStorage.getItem(V285_SAFETY_KEY)==="1")return;
    const ok=await modal({
      eyebrow:"FØR DU STARTER",title:"Bruk verktøyet trygt",checkbox:true,confirm:"Jeg forstår – fortsett",
      body:`<div class="v285-warning-box"><strong>Bruk av IANS OneDrive Organizer skjer på eget ansvar.</strong>
      <p>Verktøyet kan analysere, laste ned, organisere og – når Action Mode aktiveres – gjøre endringer i OneDrive.</p></div>
      <p><strong>Test først på en liten mappe med kopier av filer.</strong></p>
      <p>Ha separat sikkerhetskopi av viktige data før større endringer.</p>`
    });
    if(ok)localStorage.setItem(V285_SAFETY_KEY,"1");
  }

  function actionGuard(){
    ["topActionBtn","v24EnableAction"].forEach(id=>{
      const b=E(id); if(!b||b.dataset.v285Guarded)return;
      b.dataset.v285Guarded="1";
      b.addEventListener("click",async e=>{
        if(sessionStorage.getItem(V285_ACTION_SESSION_KEY)==="1")return;
        e.preventDefault();e.stopImmediatePropagation();
        const ok=await modal({
          eyebrow:"ACTION MODE",title:"Aktiver Action Mode?",danger:true,confirm:"Aktiver Action Mode",
          body:`<div class="v285-warning-box"><strong>Read Only avsluttes for skrivehandlinger.</strong>
          <p>Verktøyet kan nå flytte, organisere eller sende filer til OneDrive-papirkurven.</p></div>
          <p>Test først på en liten mappe og kontroller preview/backup før større endringer.</p>`
        });
        if(ok){sessionStorage.setItem(V285_ACTION_SESSION_KEY,"1");b.click()}
      },true);
    });
  }

  let activeController=null,failedFiles=[];

  function ensureFailedUi(){
    const box=E("downloadProgress"); if(!box||E("v285FailedBox"))return;
    const el=document.createElement("div");el.id="v285FailedBox";el.className="v285-failed-box hidden";
    el.innerHTML=`<div class="section-title"><div><span class="eyebrow">RESILIENT DOWNLOAD</span><h3>Feilede filer</h3></div><button id="v285RetryFailed" class="btn ghost">Prøv feilede filer igjen</button></div><div id="v285FailedSummary" class="muted"></div><div id="v285FailedList" class="v285-failed-list"></div>`;
    box.appendChild(el);E("v285RetryFailed").onclick=retryFailed;
  }
  function renderFailed(){
    ensureFailedUi();const box=E("v285FailedBox");if(!box)return;
    box.classList.toggle("hidden",!failedFiles.length);
    E("v285FailedSummary").textContent=failedFiles.length?`${formatNumber(failedFiles.length)} filer feilet etter automatisk retry.`:"Ingen feilede filer.";
    E("v285FailedList").innerHTML=failedFiles.slice(0,100).map(x=>`<div><strong>${escapeHtml(x.file.relativePath||x.file.name)}</strong><span>${escapeHtml(x.error||"Ukjent feil")}</span></div>`).join("");
  }

  async function oneAttempt(f,attempt){
    if(await dlLocalFileMatches(f)){dlJob.verified++;return{skipped:true,bytes:0}}
    const token=await getToken(),controller=new AbortController();activeController=controller;
    let timer=null,pausedAbort=false;
    const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>{try{controller.abort("STALL_TIMEOUT")}catch{}},V285_STALL_MS)};
    try{
      const res=await fetch(`${GRAPH}/me/drive/items/${encodeURIComponent(f.id)}/content`,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal});
      if(!res.ok)throw new Error(`Graph ${res.status}`);
      const localHandle=await dlOpenLocalFile(f.relativePath,{create:true}),w=await localHandle.createWritable(),reader=res.body.getReader();
      let written=0;arm();
      try{
        while(true){
          while(dlJob.paused&&!dlJob.cancelled){
            if(!controller.signal.aborted){pausedAbort=true;try{controller.abort("PAUSE")}catch{}}
            await wait(150);
          }
          if(dlJob.cancelled){try{controller.abort("CANCEL")}catch{};throw new DOMException("Cancelled","AbortError")}
          const {done,value}=await reader.read();if(done)break;arm();
          await w.write(value);written+=value.byteLength;dlJob.bytes+=value.byteLength;
          if(E("downloadProgressLabel"))E("downloadProgressLabel").textContent=attempt>1?`Laster ned – forsøk ${attempt}/${V285_RETRIES}…`:"Laster ned direkte til disk…";
          dlUpdateLive(dlJob.done,dlJob.total,f.relativePath);
        }
        clearTimeout(timer);await w.close();
      }catch(err){clearTimeout(timer);try{await w.abort()}catch{};throw err}
      if(!await dlLocalFileMatches(f))throw new Error(`Verifisering feilet: forventet ${f.size} bytes`);
      dlJob.verified++;return{skipped:false,bytes:written};
    }catch(err){
      clearTimeout(timer);
      if(dlJob.cancelled)throw err;
      if(pausedAbort||dlJob.paused){
        while(dlJob.paused&&!dlJob.cancelled)await wait(150);
        if(dlJob.cancelled)throw new DOMException("Cancelled","AbortError");
        const e=new Error("PAUSE_RETRY");e.code="PAUSE_RETRY";throw e;
      }
      if(controller.signal.aborted&&String(controller.signal.reason).includes("STALL")){
        const e=new Error("Ingen data mottatt på 60 sekunder");e.code="STALL_TIMEOUT";throw e;
      }
      throw err;
    }finally{if(activeController===controller)activeController=null}
  }

  if(typeof dlDownloadOne==="function"){
    dlDownloadOne=async function(f){
      let last=null;
      for(let attempt=1;attempt<=V285_RETRIES;attempt++){
        try{return await oneAttempt(f,attempt)}
        catch(err){
          if(err?.name==="AbortError"&&dlJob.cancelled)throw err;
          if(err?.code==="PAUSE_RETRY"){attempt--;continue}
          last=err;
          if(E("downloadProgressLabel"))E("downloadProgressLabel").textContent=attempt<V285_RETRIES?`Forsøk ${attempt}/${V285_RETRIES} feilet – prøver igjen…`:`Filen feilet etter ${V285_RETRIES} forsøk`;
          if(attempt<V285_RETRIES)await wait(V285_RETRY_DELAYS[attempt-1]||10000);
        }
      }
      failedFiles.push({file:f,error:last?.message||"Ukjent feil"});renderFailed();throw last||new Error("Nedlasting feilet");
    };
  }

  const pause=E("downloadPauseBtn");
  if(pause&&!pause.dataset.v285AbortPause){
    pause.dataset.v285AbortPause="1";
    pause.addEventListener("click",()=>setTimeout(()=>{if(dlJob?.paused&&activeController&&!activeController.signal.aborted)try{activeController.abort("PAUSE")}catch{}},0));
  }

  async function retryFailed(){
    if(!failedFiles.length)return;
    if(!dlDirectoryHandle){alert("Velg den samme lokale målmappe først.");return}
    const pending=failedFiles.slice();failedFiles=[];renderFailed();let ok=0;
    for(const x of pending){try{await dlDownloadOne(x.file);ok++}catch(err){if(!failedFiles.some(y=>y.file.id===x.file.id))failedFiles.push({file:x.file,error:err.message})}}
    renderFailed();iansToast("Retry ferdig",`${formatNumber(ok)} reparert · ${formatNumber(failedFiles.length)} gjenstår.`,failedFiles.length?"error":"success",9000);
  }

  function injectHealth(){
    if(E("v285SystemHealth")||!E("dashboard"))return;
    const p=document.createElement("section");p.id="v285SystemHealth";p.className="panel v285-system-health";
    p.innerHTML=`<div class="section-title"><div><span class="eyebrow">SYSTEM HEALTH</span><h3>Lokal kapasitet og nettleserstøtte</h3></div><span class="badge safe">PRE-FLIGHT</span></div>
    <div class="v285-health-grid"><div><span>Nettleser</span><strong id="v285Browser">–</strong><small id="v285Secure">–</small></div><div><span>Lokal mappebackup</span><strong id="v285FsApi">–</strong><small>File System Access API</small></div><div><span>Valgt backup</span><strong id="v285BackupNeed">–</strong><small id="v285BackupHeadroom">–</small></div><div><span>Browser storage-estimat</span><strong id="v285BrowserStorage">–</strong><small>Ikke det samme som ledig Mac-disk</small></div></div>
    <div class="v285-health-note"><strong>Viktig:</strong> En vanlig webside får ikke lese nøyaktig ledig kapasitet på hele Mac-disken. Verktøyet viser derfor nødvendig backup-plass, anbefalt margin og browserens eget storage-estimat. Kontroller faktisk diskplass i macOS før store jobber.</div>`;
    E("dashboard").prepend(p);refreshHealth();
  }
  async function refreshHealth(){
    if(!E("v285Browser"))return;
    E("v285Browser").textContent=navigator.userAgent.includes("Edg/")?"Microsoft Edge":navigator.userAgent.includes("Chrome/")?"Chromium/Chrome":"Annen nettleser";
    E("v285Secure").textContent=window.isSecureContext?"Sikker HTTPS-kontekst":"Ikke sikker kontekst";
    E("v285FsApi").textContent=window.showDirectoryPicker?"Støttet":"Ikke støttet";
    const bytes=(typeof dlInventory!=="undefined"&&dlInventory?.length)?dlInventory.reduce((s,f)=>s+(+f.size||0),0):0;
    E("v285BackupNeed").textContent=bytes?formatBytes(bytes):"Ikke beregnet";
    E("v285BackupHeadroom").textContent=bytes?`Anbefalt minst ${formatBytes(Math.ceil(bytes*1.10))} ledig (10 % margin)`:"Analyser en mappe for beregning";
    try{if(navigator.storage?.estimate){const x=await navigator.storage.estimate(),free=Math.max(0,(x.quota||0)-(x.usage||0));E("v285BrowserStorage").textContent=`${formatBytes(free)} i browser-kvote`}}catch{}
  }

  let orgPlan=[];
  function safeSegment(v,fallback="Ukjent"){
    const x=String(v||fallback).replace(/[\\/:*?"<>|]/g,"-").replace(/\s+/g," ").trim();
    return x||fallback;
  }
  function datePartsFor(f){
    const raw=f.takenDateTime||f.createdDateTime||f.lastModifiedDateTime;
    if(!raw)return {y:"Ukjent dato",m:""};
    const d=new Date(raw); if(!Number.isFinite(d.getTime()))return {y:"Ukjent dato",m:""};
    return {y:String(d.getFullYear()),m:String(d.getMonth()+1).padStart(2,"0")};
  }
  function targetFor(f,root){
    const {y,m}=datePartsFor(f);
    const strategy=E("v285OrgStrategy")?.value||"smart";
    const mediaDevice=!!E("v285OrgDevice")?.checked;
    const cat=safeSegment(f.category||"Annet");
    const device=safeSegment([f.cameraMake,f.cameraModel].filter(Boolean).join(" "),"Ukjent kamera");
    if(strategy==="year") return `${root}/${cat}/${y}`;
    if(strategy==="type") return `${root}/${cat}`;
    if(strategy==="type-year") return `${root}/${cat}/${y}${m?"/"+m:""}`;
    if((f.category==="Bilder"||f.category==="Video") && mediaDevice) return `${root}/${cat}/${device}/${y}${m?"/"+m:""}`;
    if(f.category==="Bilder"||f.category==="Video")return`${root}/${cat}/${y}${m?"/"+m:""}`;
    if(["Dokumenter","Regneark","Presentasjoner","Lyd"].includes(f.category))return`${root}/${cat}/${y}`;
    if(f.category==="Arkiv / installasjon")return`${root}/Arkiv og installasjon/${y}`;
    return`${root}/Annet/${y}`;
  }
  function buildPlan(){
    if(!report?.files?.length){iansToast("Organization Studio","Kjør kartlegging først.","error");return}
    const root=(E("v285OrgRoot")?.value||"/_IANS Organisert").trim()||"/_IANS Organisert";
    const cats=new Set([...document.querySelectorAll("[data-v285-org-cat]:checked")].map(x=>x.value)),seen=new Set();orgPlan=[];
    const profile=E("v285OrgProfile")?.value||"cautious";
    const preserve=E("v285OrgPreserve")?.checked!==false;
    const messy=/\/(downloads?|nedlastinger|desktop|skrivebord|camera|kamerabilder|dcim|backup|ryd(d|de)|sorter|unsorted|import)/i;
    for(const f of report.files){
      if((f.path||"").startsWith("/_IANS Cleanup Review/")||(f.path||"").startsWith(root+"/")||!cats.has(f.category))continue;
      if(preserve && profile==="cautious" && !messy.test(f.parentPath||f.path||"")) continue;
      const target=targetFor(f,root),key=`${target.toLowerCase()}|${String(f.name||"").toLowerCase()}`,conflict=seen.has(key);seen.add(key);orgPlan.push({file:f,target,conflict});
    }
    renderPlan();
  }
  function renderPlan(){
    const c=orgPlan.filter(x=>x.conflict).length,folders=new Set(orgPlan.map(x=>x.target)).size,bytes=orgPlan.reduce((s,x)=>s+(+x.file.size||0),0);
    E("v285OrgStats").innerHTML=`<div><span>Filer i plan</span><strong>${formatNumber(orgPlan.length)}</strong></div><div><span>Målmapper</span><strong>${formatNumber(folders)}</strong></div><div><span>Datamengde</span><strong>${formatBytes(bytes)}</strong></div><div><span>Navnekonflikter</span><strong>${formatNumber(c)}</strong></div>`;
    E("v285OrgPreview").innerHTML=orgPlan.slice(0,80).map(x=>`<div class="${x.conflict?"conflict":""}"><strong>${escapeHtml(x.file.name)}</strong><span>${escapeHtml(x.file.path)} → ${escapeHtml(x.target)}/</span>${x.conflict?'<em>Hoppes over: mulig navnekonflikt</em>':""}</div>`).join("")||'<div class="empty-state">Ingen plan ennå.</div>';
    E("v285OrgExecute").disabled=!orgPlan.length;
  }
  async function executePlan(){
    if(!orgPlan.length)return;if(!v24Enabled){alert("Aktiver Action Mode først.");return}
    const safe=orgPlan.filter(x=>!x.conflict),conflicts=orgPlan.length-safe.length;
    const ok=await modal({eyebrow:"ORGANIZATION STUDIO",title:`Utfør plan for ${formatNumber(safe.length)} filer?`,danger:true,checkbox:true,confirm:"Utfør planen",body:`<div class="v285-warning-box"><strong>Dette flytter filer i OneDrive.</strong><p>${formatNumber(conflicts)} mulige navnekonflikter hoppes over. Organization Studio sletter ingen filer.</p></div><p>Test først på en liten mappe og kontroller backup/preview.</p>`});
    if(!ok)return;let moved=0,failed=0;
    for(let i=0;i<safe.length;i++){const x=safe[i],f=x.file;try{const id=await v24EnsureFolder(x.target);const old=f.path;await v24Graph(`/me/drive/items/${encodeURIComponent(f.id)}`,{method:"PATCH",body:{parentReference:{id}}});f.parentPath=x.target;f.path=`${x.target}/${f.name}`;v24Log("Organization Studio",old,true,`Flyttet til ${x.target}`);moved++}catch(err){v24Log("Organization Studio",f.path,false,err.message);failed++}if(i%20===0)await wait(0)}
    renderV2();renderPhotoPlan();renderCleanupPlan();v24RenderLog();iansToast("Organization Studio ferdig",`${formatNumber(moved)} flyttet · ${formatNumber(failed)} feil · ${formatNumber(conflicts)} konflikter hoppet over.`,failed?"error":"success",10000);orgPlan=[];renderPlan();
  }
  function injectOrg(){
    if(E("v285OrganizationStudio")||!E("dashboard"))return;
    const p=document.createElement("section");p.id="v285OrganizationStudio";p.className="panel v285-org-studio";
    const cats=["Bilder","Video","Dokumenter","Regneark","Presentasjoner","Lyd","Arkiv / installasjon","Annet"];
    p.innerHTML=`<div class="section-title"><div><span class="eyebrow">ORGANIZATION STUDIO</span><h3>Plan → Preview → Action Mode → Utfør</h3></div><span class="badge safe">INGEN SLETTING</span></div>
    <p class="muted">Velg hvordan IANS skal organisere. Preview bygges først; ingen filer flyttes før Action Mode og eksplisitt godkjenning.</p><div class="v285-org-controls">
    <div class="v311-org-grid"><label class="field"><span>Målrot</span><input id="v285OrgRoot" value="/_IANS Organisert"></label>
    <label class="field"><span>Profil</span><select id="v285OrgProfile"><option value="cautious">Forsiktig – bare tydelige ryddeområder</option><option value="balanced">Balansert – valgte filtyper</option><option value="comprehensive">Omfattende – hele valget</option></select></label>
    <label class="field"><span>Struktur</span><select id="v285OrgStrategy"><option value="smart">Smart – media År/Måned, dokumenter År</option><option value="type-year">Filtype → År → Måned</option><option value="year">Filtype → År</option><option value="type">Kun filtype</option></select></label></div>
    <div class="v311-org-options"><label><input type="checkbox" id="v285OrgPreserve" checked> Bevar meningsfulle prosjekt-/kundemapper</label><label><input type="checkbox" id="v285OrgDevice"> Media: grupper også etter kamera/enhet når metadata finnes</label></div>
    <div class="v285-org-cats">${cats.map(c=>`<label><input type="checkbox" data-v285-org-cat value="${escapeHtml(c)}" ${["Bilder","Video","Dokumenter","Regneark","Presentasjoner"].includes(c)?"checked":""}><span>${escapeHtml(c)}</span></label>`).join("")}</div>
    <div class="actions"><button id="v285OrgBuild" class="btn primary">Bygg forslag</button><button id="v285OrgExecute" class="btn action-btn" disabled>Utfør plan</button></div></div>
    <div id="v285OrgStats" class="v285-org-stats"></div><div id="v285OrgPreview" class="v285-org-preview"><div class="empty-state">Kjør kartlegging og trykk «Bygg forslag».</div></div>
    <div class="v285-health-note"><strong>Sikker arbeidsflyt:</strong> Read Only → Analyse → Plan → Preview → Backup Check → Action Mode → Execute → Verify → Logg.</div>`;
    E("dashboard").appendChild(p);E("v285OrgBuild").onclick=buildPlan;E("v285OrgExecute").onclick=executePlan;
  }

  if(typeof dlAnalyzeSource==="function"){const old=dlAnalyzeSource;dlAnalyzeSource=async function(...a){const r=await old(...a);setTimeout(refreshHealth,0);return r}}

  function versionLabels(){
    document.querySelectorAll("body *").forEach(el=>{if(el.children.length===0&&/V2\.8\.4/.test(el.textContent||""))el.textContent=(el.textContent||"").replace(/V2\.8\.4/g,"V2.8.5")});
    console.info("[IANS] V2.8.5 Resilient Download + Organization Studio aktiv");
  }
  function boot(){versionLabels();injectHealth();injectOrg();ensureFailedUi();setTimeout(refreshHealth,500);setTimeout(startupSafety,250)}
  if(document.readyState==="loading")window.addEventListener("DOMContentLoaded",boot);else boot();
})();
// ===== IANS V2.8.6 FUTURE OPERATIONS UI (presentation layer only) =====
(() => {
  const E=id=>document.getElementById(id);
  function fmtBytes(n){try{return typeof formatBytes==="function"?formatBytes(n):`${Math.round(n/1024/1024)} MB`}catch{return "–"}}
  function injectCommandCenter(){
    if(E("v286CommandCenter")||!E("dashboard"))return;
    const el=document.createElement("section"); el.id="v286CommandCenter"; el.className="v286-hero";
    el.innerHTML=`<div class="v286-hero-top"><div><span class="eyebrow">IANS DATA OPERATIONS</span><h2>OneDrive Command Center</h2><p>Fra kartlegging til trygg organisering – med kontrollpunkter før hver skrivehandling.</p></div><span class="v286-live"><i></i> V2.8.6 READY</span></div>
    <div class="v286-flow"><div class="v286-step"><span>01</span><strong>Connect</strong></div><div class="v286-step"><span>02</span><strong>Analyze</strong></div><div class="v286-step"><span>03</span><strong>Preview</strong></div><div class="v286-step"><span>04</span><strong>Protect</strong></div><div class="v286-step"><span>05</span><strong>Execute</strong></div></div>
    <div class="v286-command"><div><span>Arbeidsmodus</span><strong id="v286Mode">Read Only</strong><small>Action Mode krever eksplisitt aktivering</small></div><div><span>Kartlagt datamengde</span><strong id="v286Data">Ikke analysert</strong><small>Oppdateres etter kartlegging</small></div><div><span>Lokal backup</span><strong id="v286Backup">Pre-flight</strong><small>Kontroller plass før stor nedlasting</small></div><div><span>Sikkerhetsmodell</span><strong>Preview first</strong><small>Plan → kontroll → utfør → logg</small></div></div>
    <div class="v286-safety-ribbon"><strong>Sikkerhetsprinsipp:</strong> Test på en liten mappe først. Behold separat backup av viktige data før større endringer.</div>`;
    E("dashboard").prepend(el); refresh();
  }
  function refresh(){
    if(!E("v286CommandCenter"))return;
    try{E("v286Mode").textContent=(typeof v24Enabled!=="undefined"&&v24Enabled)?"Action Mode":"Read Only"}catch{}
    try{const inv=(typeof dlInventory!=="undefined"&&Array.isArray(dlInventory))?dlInventory:[];const b=inv.reduce((s,f)=>s+(+f.size||0),0);E("v286Data").textContent=b?fmtBytes(b):"Ikke analysert"}catch{}
    try{const need=E("v285BackupNeed")?.textContent;E("v286Backup").textContent=need&&need!=="–"&&need!=="Ikke beregnet"?`${need} + margin`:"Pre-flight"}catch{}
  }
  function labels(){document.querySelectorAll("body *").forEach(el=>{if(el.children.length===0&&/V2\.8\.5/.test(el.textContent||""))el.textContent=(el.textContent||"").replace(/V2\.8\.5/g,"V2.8.6")});console.info("[IANS] V2.8.6 Future Operations UI aktiv");}
  function boot(){labels();injectCommandCenter();setInterval(refresh,2500)}
  if(document.readyState==="loading")window.addEventListener("DOMContentLoaded",boot);else boot();
})();

// ===== IANS V2.8.7 COMMAND CENTER EXPERIENCE (presentation layer only) =====
(() => {
  const E = id => document.getElementById(id);
  const Q = s => document.querySelector(s);
  const fmtN = n => { try { return typeof formatNumber === "function" ? formatNumber(n) : String(n ?? 0); } catch { return String(n ?? 0); } };
  const fmtB = n => { try { return typeof formatBytes === "function" ? formatBytes(n) : `${Math.round((n||0)/1024/1024)} MB`; } catch { return "–"; } };

  function safeText(el, text){ if(el) el.textContent = text; }

  function findPanelByControl(id){
    const el = E(id);
    if(!el) return null;
    return el.closest("section,.panel,.card,[class*='panel'],[class*='card']") || el.parentElement;
  }

  function scrollToControl(id){
    const panel = findPanelByControl(id) || E(id);
    if(panel) panel.scrollIntoView({behavior:"smooth", block:"start"});
  }

  function injectHeaderExperience(){
    if(E("v287HeaderStatus")) return;
    const header = Q("header") || Q(".topbar") || Q(".site-header") || document.body.firstElementChild;
    if(!header) return;
    const box = document.createElement("div");
    box.id = "v287HeaderStatus";
    box.className = "v287-header-status";
    box.innerHTML = `
      <span class="v287-chip safe"><i>●</i> READ ONLY</span>
      <span class="v287-chip graph">◎ GRAPH API</span>
      <span class="v287-chip stream">◌ STREAM + RESUME</span>
      <span class="v287-chip verify">◆ VERIFIED</span>`;
    header.appendChild(box);
  }

  function injectHero(){
    if(E("v287CommandCenter") || !E("dashboard")) return;
    const hero = document.createElement("section");
    hero.id = "v287CommandCenter";
    hero.className = "v287-command-center";
    hero.innerHTML = `
      <div class="v287-cloud-scene" aria-hidden="true">
        <div class="v287-cloud">
          <div class="v287-cloud-core">☁</div>
          <span class="v287-node n1"></span><span class="v287-node n2"></span>
          <span class="v287-node n3"></span><span class="v287-node n4"></span>
          <span class="v287-node n5"></span><span class="v287-node n6"></span>
        </div>
        <div class="v287-stream s1"></div><div class="v287-stream s2"></div>
        <div class="v287-stream s3"></div><div class="v287-stream s4"></div>
      </div>

      <div class="v287-hero-copy">
        <span class="eyebrow">VELKOMMEN TILBAKE · IANS DATA OPERATIONS</span>
        <div class="v287-title-row">
          <div>
            <h2>OneDrive <span>Command Center</span></h2>
            <p>Kontrollsenter for kartlegging, sikkerhetskopi, verifisering og trygg organisering av OneDrive.</p>
          </div>
          <span class="v287-ready"><i></i> V2.8.7 READY</span>
        </div>

        <div class="v287-flow">
          <div><b>✓</b><strong>1. Connect</strong><small>Sikker tilkobling</small></div>
          <div><b>⌕</b><strong>2. Analyze</strong><small>Kartlegg alt innhold</small></div>
          <div><b>◉</b><strong>3. Preview</strong><small>Se før du handler</small></div>
          <div><b>⬟</b><strong>4. Protect</strong><small>Verifiser og sikre</small></div>
          <div><b>▶</b><strong>5. Execute</strong><small>Utfør med kontroll</small></div>
        </div>

        <div class="v287-safety">
          <span>🛡</span>
          <div><strong>Sikkerhetsprinsipp:</strong> Test på en liten mappe først. Read Only er standard. Du bestemmer når og hva som kan endres.</div>
        </div>
      </div>

      <div class="v287-metrics">
        <article><span>KARTLAGT DATA</span><strong id="v287Mapped">Ikke analysert</strong><small id="v287MappedHint">Kjør kartlegging</small></article>
        <article><span>ANTALL FILER</span><strong id="v287Files">–</strong><small id="v287Folders">Mapper: –</small></article>
        <article><span>SISTE SKANNING</span><strong id="v287LastScan">–</strong><small id="v287ScanState">Klar</small></article>
        <article class="status"><span>STATUS</span><strong id="v287Status">Klar</strong><small id="v287StatusHint">System klart</small></article>
      </div>
    `;
    E("dashboard").prepend(hero);
  }

  function injectOperations(){
    if(E("v287Operations") || !E("dashboard")) return;
    const ops = document.createElement("section");
    ops.id = "v287Operations";
    ops.className = "v287-operations";
    ops.innerHTML = `
      <div class="v287-section-head"><div><span class="eyebrow">OPERASJONER</span><h3>Velg neste oppgave</h3></div><span class="v287-pill">CONTROLLED WORKFLOW</span></div>
      <div class="v287-op-grid">
        <article class="teal"><i>◌</i><h4>Quick Scan</h4><p>Gå direkte til kartlegging og analyser valgt område.</p><button data-v287-scroll="topStartScanBtn">Åpne skanning →</button></article>
        <article class="blue"><i>≋</i><h4>Full Scan</h4><p>Kartlegg hele OneDrive i Read Only med checkpoint og Resume.</p><button data-v287-scroll="topStartScanBtn">Startpunkt →</button></article>
        <article class="purple"><i>⇩</i><h4>Download & Verify</h4><p>Direkte streaming til disk med Resume, retry og verifisering.</p><button data-v287-scroll="downloadBrowseSourceBtn">Åpne nedlasting →</button></article>
        <article class="amber"><span class="new">NYHET</span><i>▱</i><h4>Organization Studio</h4><p>Plan → Preview → Action Mode → Execute. Ingen automatisk sletting.</p><button data-v287-scroll="v285OrganizationStudio">Åpne Studio →</button></article>
        <article class="cyan"><i>⌕</i><h4>Large File Explorer</h4><p>Finn store filer og mapper som bruker mest lagringsplass.</p><button data-v287-scroll="filesTable">Utforsk →</button></article>
        <article class="green"><i>▦</i><h4>Duplicates Finder</h4><p>Gjennomgå duplikatkandidater før karantene eller papirkurv.</p><button data-v287-scroll="dupBulkPanel">Finn duplikater →</button></article>
      </div>
    `;
    E("dashboard").appendChild(ops);
    ops.addEventListener("click", e=>{
      const b = e.target.closest("[data-v287-scroll]");
      if(!b) return;
      scrollToControl(b.dataset.v287Scroll);
    });
  }

  function injectFooter(){
    if(E("v287TrustBar")) return;
    const host = E("dashboard") || document.body;
    const bar = document.createElement("section");
    bar.id = "v287TrustBar";
    bar.className = "v287-trust-bar";
    bar.innerHTML = `
      <div><b>🛡</b><span><strong>Read Only by Default</strong><small>Dine data er beskyttet</small></span></div>
      <div><b>◎</b><span><strong>Microsoft Graph API</strong><small>Offisiell tilkobling</small></span></div>
      <div><b>◌</b><span><strong>Stream + Resume</strong><small>Fortsett etter avbrudd</small></span></div>
      <div><b>✓</b><span><strong>Verify Everything</strong><small>Kontroll før opprydding</small></span></div>
      <div><b>♙</b><span><strong>Your Data, Your Control</strong><small>Du bestemmer alltid</small></span></div>
      <div class="brand"><b>IANS</b><span><strong>Made for Power Users</strong><small>OneDrive Organizer V2.8.7</small></span></div>`;
    host.appendChild(bar);
  }

  function refresh(){
    const files = report?.files || [];
    const summary = report?.summary || {};
    const mapped = summary.fileBytes || files.reduce((s,f)=>s+(+f.size||0),0);
    safeText(E("v287Mapped"), mapped ? fmtB(mapped) : "Ikke analysert");
    safeText(E("v287MappedHint"), mapped ? "Kartlagt filstørrelse" : "Kjør kartlegging");
    safeText(E("v287Files"), files.length ? fmtN(files.length) : "–");
    safeText(E("v287Folders"), `Mapper: ${summary.folders!=null ? fmtN(summary.folders) : "–"}`);

    const generated = report?.generatedAt ? new Date(report.generatedAt) : null;
    safeText(E("v287LastScan"), generated && Number.isFinite(generated.getTime())
      ? generated.toLocaleTimeString("nb-NO",{hour:"2-digit",minute:"2-digit"})
      : "–");
    safeText(E("v287ScanState"), generated ? generated.toLocaleDateString("nb-NO") : "Klar for kartlegging");

    let status="Klar", hint="System klart";
    try{
      if(typeof dlJob!=="undefined" && dlJob?.running){ status=dlJob.paused?"Pauset":"Laster ned"; hint=`${fmtN(dlJob.done||0)} / ${fmtN(dlJob.total||0)} filer`; }
      else if(typeof cancelRequested!=="undefined" && E("scanStateBadge")?.textContent?.includes("SKANNER")){ status="Analyserer"; hint="Read Only scan pågår"; }
      else if(typeof v24Enabled!=="undefined" && v24Enabled){ status="Action Mode"; hint="Skrivetilgang aktiv"; }
    }catch{}
    safeText(E("v287Status"),status); safeText(E("v287StatusHint"),hint);

    const chip = E("v287HeaderStatus")?.querySelector(".safe");
    if(chip){
      const action = typeof v24Enabled!=="undefined" && v24Enabled;
      chip.innerHTML = action ? "<i>●</i> ACTION MODE" : "<i>●</i> READ ONLY";
      chip.classList.toggle("action",action);
    }
  }

  function labels(){
    document.querySelectorAll("body *").forEach(el=>{
      if(el.children.length===0 && /V2\.8\.6/.test(el.textContent||"")){
        el.textContent=(el.textContent||"").replace(/V2\.8\.6/g,"V2.8.7");
      }
    });
    console.info("[IANS] V2.8.7 Command Center Experience aktiv");
  }

  function boot(){
    labels();
    injectHeaderExperience();
    injectHero();
    injectOperations();
    injectFooter();
    refresh();
    setInterval(refresh,1800);
  }
  if(document.readyState==="loading") window.addEventListener("DOMContentLoaded",boot);
  else boot();
})();

// ===== IANS V2.8.8 WIDESCREEN DATA EXPERIENCE =====
(() => {
  const E = id => document.getElementById(id);

  function widenLayout(){
    const dash = E("dashboard");
    if(!dash) return;

    dash.classList.add("v288-dashboard-wide");

    let p = dash.parentElement;
    let hops = 0;
    while(p && p !== document.body && hops < 5){
      p.classList.add("v288-wide-parent");
      p = p.parentElement;
      hops++;
    }

    document.body.classList.add("v288-body-wide");
  }

  function injectAmbientCanvas(){
    if(E("v288Ambient")) return;
    const ambient = document.createElement("div");
    ambient.id = "v288Ambient";
    ambient.className = "v288-ambient";
    ambient.setAttribute("aria-hidden","true");
    ambient.innerHTML = `
      <div class="v288-glow g1"></div>
      <div class="v288-glow g2"></div>
      <div class="v288-glow g3"></div>
      <div class="v288-data-wave w1"></div>
      <div class="v288-data-wave w2"></div>
      <div class="v288-starfield"></div>
    `;
    document.body.prepend(ambient);
  }

  function markPanels(){
    const dash = E("dashboard");
    if(!dash) return;

    const candidates = [...dash.querySelectorAll(
      ":scope > section, :scope > .panel, :scope > .card, section.panel, .v285-system-health, .v285-org-studio, .v287-command-center, .v287-operations"
    )];

    let i = 0;
    for(const panel of candidates){
      if(panel.classList.contains("v287-command-center")) continue;
      panel.classList.add("v288-feature-panel");
      panel.dataset.v288Accent = String(i % 5);
      i++;
    }

    // Give important functional areas extra visual identity.
    [
      ["progressPanel","scan"],
      ["dupBulkPanel","duplicates"],
      ["downloadProgress","download"],
      ["v285SystemHealth","health"],
      ["v285OrganizationStudio","organization"]
    ].forEach(([id,kind])=>{
      const el = E(id);
      if(!el) return;
      const panel = el.closest("section,.panel,.card,[class*='panel'],[class*='card']") || el;
      panel.classList.add("v288-focus-panel",`v288-${kind}`);
    });
  }

  function injectSectionBands(){
    const dash = E("dashboard");
    if(!dash || E("v288DataBands")) return;

    const bands = document.createElement("div");
    bands.id = "v288DataBands";
    bands.className = "v288-data-bands";
    bands.setAttribute("aria-hidden","true");
    bands.innerHTML = `
      <div class="v288-band b1"><span></span><span></span><span></span></div>
      <div class="v288-band b2"><span></span><span></span><span></span></div>
      <div class="v288-band b3"><span></span><span></span><span></span></div>
    `;
    dash.prepend(bands);
  }

  function upgradeHero(){
    const hero = E("v287CommandCenter");
    if(!hero) return;
    hero.classList.add("v288-command-center");

    const cloud = hero.querySelector(".v287-cloud-scene");
    if(cloud && !cloud.querySelector(".v288-orbit")){
      cloud.insertAdjacentHTML("beforeend",`
        <div class="v288-orbit o1"></div>
        <div class="v288-orbit o2"></div>
        <div class="v288-orbit o3"></div>
      `);
    }
  }

  function injectMidPagePulse(){
    const dash = E("dashboard");
    if(!dash || E("v288MidPulse")) return;

    const pulse = document.createElement("section");
    pulse.id = "v288MidPulse";
    pulse.className = "v288-mid-pulse";
    pulse.innerHTML = `
      <div class="v288-pulse-icon">◎</div>
      <div class="v39-live-copy">
        <span class="eyebrow">IANS LIVE OPERATIONS</span>
        <strong id="v39LiveHeadline">Klar · ingen aktiv jobb</strong>
        <small id="v39LiveDetail">Venter på kartlegging eller handling</small>
      </div>
      <div class="v39-live-metrics"><span><b id="v39LiveFiles">–</b> filer</span><span><b id="v39LiveBytes">–</b> data</span><span><b id="v39LiveJob">Klar</b> jobb</span></div>
      <div class="v288-pulse-line"><i></i><i></i><i></i><i></i><i></i></div>
    `;

    const org = E("v285OrganizationStudio");
    if(org) org.parentNode.insertBefore(pulse, org);
    else {
      const ops = E("v287Operations");
      if(ops) ops.parentNode.insertBefore(pulse, ops);
      else dash.appendChild(pulse);
    }
  }

  function versionLabels(){
    document.querySelectorAll("body *").forEach(el=>{
      if(el.children.length===0 && /V2\.8\.7/.test(el.textContent||"")){
        el.textContent=(el.textContent||"").replace(/V2\.8\.7/g,"V2.8.8");
      }
    });
    console.info("[IANS] V2.8.8 Widescreen Data Experience aktiv");
  }

  function boot(){
    versionLabels();
    widenLayout();
    injectAmbientCanvas();
    injectSectionBands();
    upgradeHero();
    injectMidPagePulse();
    markPanels();

    setTimeout(()=>{ widenLayout(); markPanels(); },800);
    setTimeout(()=>{ widenLayout(); markPanels(); },2200);
  }

  if(document.readyState==="loading") window.addEventListener("DOMContentLoaded",boot);
  else boot();
})();

// ===== IANS V2.8.9 REFERENCE MATCH DASHBOARD =====
(() => {
  const $ = id => document.getElementById(id);
  const q = sel => document.querySelector(sel);

  const fmt = (v, fallback="—") => {
    const s = (v?.textContent || "").trim();
    return s || fallback;
  };

  function buildShell(){
    if ($("v289ReferenceShell")) return;
    const dash = $("dashboard");
    if (!dash) return;

    const shell = document.createElement("section");
    shell.id = "v289ReferenceShell";
    shell.className = "v289-shell";
    shell.innerHTML = `
      <div class="v289-hero">
        <div class="v289-network-bg" aria-hidden="true">
          <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
        </div>

        <div class="v289-hero-left">
          <span class="v289-welcome">WELCOME BACK, <b id="v289WelcomeName">USER</b> 👋</span>
          <h1>OneDrive <em>Command Center</em></h1>
          <p>Din komplette kontrollsenter for kartlegging, sikkerhetskopi og organisering av OneDrive</p>

          <div class="v289-flow">
            <button data-v289-scroll="scan"><b>✓</b><span>1. Connect<small>Sikker tilkobling</small></span></button>
            <button data-v289-scroll="scan"><b>⌕</b><span>2. Analyze<small>Kartlegg alt innhold</small></span></button>
            <button data-v289-scroll="review"><b>◉</b><span>3. Preview<small>Se alt før du handler</small></span></button>
            <button data-v289-scroll="health"><b>⬟</b><span>4. Protect<small>Verifiser & sikre data</small></span></button>
            <button data-v289-scroll="ops"><b>▶</b><span>5. Execute<small>Utfør med trygghet</small></span></button>
          </div>

          <div class="v289-safety">
            <span>🛡</span>
            <div><strong>Sikkerhetsprinsipp:</strong> Test på en liten mappe først. Bekreft resultatet.<br>
            <small>Read Only som standard. Du bestemmer når og hva som kan endres.</small></div>
          </div>
        </div>

        <div class="v289-cloud-zone" aria-hidden="true">
          <div class="v289-cloud">
            <span class="v289-cloud-c1"></span><span class="v289-cloud-c2"></span><span class="v289-cloud-c3"></span>
            <div class="v289-cloud-core">☁</div>
            <div class="v289-cloud-beam"></div>
          </div>
        </div>

        <div class="v289-metrics">
          <article><span>KARTLAGT DATA</span><strong id="v289DataSize">—</strong><small>Total størrelse</small><i></i></article>
          <article><span>ANTALL FILER</span><strong id="v289FileCount">—</strong><small id="v289FolderCount">Mapper: —</small></article>
          <article><span>SISTE SKANNING</span><strong id="v289LastScan">Ikke ennå</strong><small id="v289LastScanSub">Kjør kartlegging</small></article>
          <article class="status"><span>STATUS</span><strong id="v289Status">Klar</strong><small>System klart</small></article>
        </div>
      </div>

      <div class="v289-row" id="v289HealthRow">
        <article class="v289-health">
          <header><span>⌁</span><strong>SYSTEM HEALTH</strong><b>PRE-FLIGHT OK</b></header>
          <div class="v289-health-grid">
            <div><span class="ico">◉</span><strong>Microsoft Edge</strong><small>Støttet nettleser</small><em id="v289Browser">Klar</em></div>
            <div><span class="ico">📁</span><strong>Lokal mappe</strong><small id="v289LocalPath">Ikke valgt</small><em id="v289LocalState">Velg målmappe</em></div>
            <div><span class="ico">🔒</span><strong>Write Access</strong><small>Skrivetilgang</small><em id="v289WriteState">Read Only</em></div>
            <div><span class="ico">⌁</span><strong>Nettverk</strong><small>Stabil tilkobling</small><em id="v289Network">Online</em></div>
            <div><span class="ico">◒</span><strong>Browser Storage</strong><small>Lokal lagring</small><em>10.0 GB kvote</em></div>
          </div>
        </article>

        <article class="v289-storage">
          <header><span>▣</span><strong>STORAGE & BACKUP CHECK</strong></header>
          <div class="v289-storage-grid">
            <div class="v289-disk">
              <small>Lokal disk</small>
              <div class="v289-ring"><strong id="v289DiskFree">—</strong><span>ledig</span></div>
            </div>
            <div class="v289-storage-stats">
              <p><span>OneDrive valgt</span><strong id="v289SelectedSize">—</strong></p>
              <p><span>Estimert nødvendig</span><strong id="v289NeedSize">—</strong></p>
              <p><span>Sikkerhetsmargin (10%)</span><strong id="v289MarginSize">—</strong></p>
            </div>
            <div class="v289-warning" id="v289StorageWarning">
              <span>⚠</span><strong>Kontroller lokal plass</strong>
              <p>Velg lokal målmappe og analyser kilden før backup.</p>
              <button data-v289-scroll="download">Se backup-senter</button>
            </div>
          </div>
        </article>
      </div>

      <article class="v289-ops" id="v289Ops">
        <header><span>⌘</span><strong>OPERASJONER</strong></header>
        <div class="v289-op-grid">
          <button data-v289-action="quick"><span>◎</span><strong>Quick Scan</strong><small>Hurtig skanning av toppnivå og størrelsesfordeling.</small><b>Start skanning →</b></button>
          <button data-v289-action="full"><span>⌁</span><strong>Full Scan</strong><small>Fullstendig kartlegging av alle filer og mapper.</small><b>Start full skanning →</b></button>
          <button data-v289-scroll="download"><span>☁</span><strong>Download & Verify</strong><small>Streaming med resume og verifisering av alle filer.</small><b>Start nedlasting →</b></button>
          <button data-v289-scroll="studio" class="warm"><span>▱</span><strong>Organization Studio</strong><small>Foreslå struktur, rydd opp og organiser trygt.</small><b>Åpne Studio →</b></button>
          <button data-v289-action="large"><span>⌕</span><strong>Large File Explorer</strong><small>Finn de største filene som tar mest plass.</small><b>Utforsk nå →</b></button>
          <button data-v289-action="dups"><span>▣</span><strong>Duplicates Finder</strong><small>Finn duplikater og reduser unødvendig lagring.</small><b>Finn duplikater →</b></button>
        </div>
      </article>

      <div class="v289-trust">
        <span>🛡 <b>Read Only by Default</b><small>Dine data er beskyttet</small></span>
        <span>⌘ <b>Microsoft Graph API</b><small>Offisiell og sikker tilkobling</small></span>
        <span>◉ <b>Stream + Resume</b><small>Ingen fil blir lastet to ganger</small></span>
        <span>✓ <b>Verify Everything</b><small>Sjekksum/verifisering</small></span>
        <span>♙ <b>Your Data, Your Control</b><small>Du bestemmer alltid</small></span>
      </div>
    `;

    dash.prepend(shell);
    sync();
    bind();
  }

  function numText(id, fallback="—"){
    return fmt($(id), fallback);
  }

  function sync(){
    const name = fmt($("accountName"), "User").split(" ")[0];
    $("v289WelcomeName") && ($("v289WelcomeName").textContent = name.toUpperCase());

    $("v289DataSize") && ($("v289DataSize").textContent = numText("quotaUsed"));
    $("v289FileCount") && ($("v289FileCount").textContent = numText("fileCount"));
    $("v289FolderCount") && ($("v289FolderCount").textContent = `Mapper: ${numText("folderCount")}`);

    const state = fmt($("scanStateBadge"), "Klar");
    $("v289Status") && ($("v289Status").textContent = /SKANN|KART|PAUSE|CHECK/i.test(state) ? state : "Klar");

    const start = fmt($("scanStartedAt"), "—");
    if(start !== "—"){
      $("v289LastScan").textContent = `I dag ${start}`;
      $("v289LastScanSub").textContent = "Siste økt";
    }

    const local = fmt($("downloadLocalFolder"), "Ikke valgt");
    $("v289LocalPath") && ($("v289LocalPath").textContent = local);
    $("v289LocalState") && ($("v289LocalState").textContent = local === "Ikke valgt" ? "Velg målmappe" : "Klar");

    const enabled = (typeof v24Enabled !== "undefined" && v24Enabled) || fmt($("v24ActionBadge"),"").includes("AKTIV");
    $("v289WriteState") && ($("v289WriteState").textContent = enabled ? "Tillatt" : "Read Only");

    $("v289Network") && ($("v289Network").textContent = navigator.onLine ? "Veldig god" : "Offline");

    const selected = fmt($("downloadTotalBytes"), "—");
    $("v289SelectedSize") && ($("v289SelectedSize").textContent = selected);

    const diskFree = fmt($("mediaDiskFree"), "—");
    $("v289DiskFree") && ($("v289DiskFree").textContent = diskFree);

    if(selected !== "—"){
      $("v289NeedSize") && ($("v289NeedSize").textContent = selected);
      $("v289MarginSize") && ($("v289MarginSize").textContent = "10 %");
    }
  }

  function targetFor(kind){
    if(kind==="scan") return q(".v25-scan-control") || $("progressPanel") || q("[id*='scan']");
    if(kind==="review") return q(".command-center") || $("inventoryTable") || q("[id*='inventory']");
    if(kind==="health") return $("v289HealthRow");
    if(kind==="ops") return $("v289Ops");
    if(kind==="download") return q("[id*='download'][class*='panel']") || $("downloadProgress") || $("downloadAnalyzeBtn")?.closest("section,div");
    if(kind==="studio") return q("[id*='OrganizationStudio']") || q("[id*='organizationStudio']") || [...document.querySelectorAll("section,div")].find(x=>/ORGANIZATION STUDIO/i.test(x.textContent||""));
    return null;
  }

  function bind(){
    document.addEventListener("click", e=>{
      const s = e.target.closest("[data-v289-scroll]");
      if(s){
        const t=targetFor(s.dataset.v289Scroll);
        t?.scrollIntoView({behavior:"smooth",block:"start"});
        return;
      }
      const a = e.target.closest("[data-v289-action]");
      if(!a) return;
      const act=a.dataset.v289Action;
      if(act==="full" || act==="quick"){
        const b = $("topStartScanBtn") || $("scanBtn");
        b?.click();
        targetFor("scan")?.scrollIntoView({behavior:"smooth",block:"start"});
      }
      if(act==="large"){
        if(v2?.size){ v2.size.value="1024"; v2.size.dispatchEvent(new Event("input",{bubbles:true})); }
        targetFor("review")?.scrollIntoView({behavior:"smooth",block:"start"});
      }
      if(act==="dups"){
        $("dupBulkPanel")?.scrollIntoView({behavior:"smooth",block:"start"});
      }
    });

    ["accountName","quotaUsed","fileCount","folderCount","scanStateBadge","scanStartedAt",
     "downloadLocalFolder","downloadTotalBytes","mediaDiskFree","v24ActionBadge"]
      .map(id=>$(id)).filter(Boolean).forEach(el=>{
        new MutationObserver(sync).observe(el,{subtree:true,childList:true,characterData:true});
      });

    window.addEventListener("online",sync);
    window.addEventListener("offline",sync);
    setInterval(sync,3000);
  }

  function hideLegacyTop(){
    // Keep all engines and detailed workspaces available, but avoid duplicated hero blocks.
    ["v287CommandCenter"].forEach(id=>{
      const el=$(id); if(el) el.classList.add("v289-legacy-hidden");
    });
  }

  function versionLabels(){
    document.querySelectorAll("body *").forEach(el=>{
      if(el.children.length===0 && /V2\.8\.8/.test(el.textContent||"")){
        el.textContent=(el.textContent||"").replace(/V2\.8\.8/g,"V2.8.9");
      }
    });
  }

  function boot(){
    versionLabels();
    buildShell();
    hideLegacyTop();
    setTimeout(()=>{sync();hideLegacyTop()},1000);
    console.info("[IANS] V2.8.9 Reference Match Dashboard aktiv");
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();

// ===== IANS V2.9.0 FREE / PRO FOUNDATION =====
(() => {
  const $ = id => document.getElementById(id);
  const CFG = window.IANS_V290_CONFIG || {};
  const FREE_FEATURES = ["Read-only kartlegging","Analyse og rapporter","Large File Explorer","Duplicate Review","Download & Verify","Media backup","Eksport av CSV / JSON"];
  const PRO_FEATURES = ["Action Mode","Flytting av filer","Strukturert karantene","Organization Studio Execute","Fotoorganisering","Papirkurv / opprydding"];
  let proUnlocked = false;

  function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
  async function sha256Hex(text){const b=new TextEncoder().encode(text),d=await crypto.subtle.digest("SHA-256",b);return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,"0")).join("");}

  function injectAccessGate(){
    if(!CFG.betaGateEnabled || $("v290AccessGate") || sessionStorage.getItem("ians_v290_beta_gate")==="ok") return;
    const gate=document.createElement("div");
    gate.id="v290AccessGate"; gate.className="v290-gate";
    gate.innerHTML=`<div class="v290-gate-card">
      <div class="v290-lock">🔐</div><span class="eyebrow">IANS PRIVATE BETA</span>
      <h2>OneDrive Command Center</h2>
      <p>Dette er en kontrollert beta. Skriv inn tilgangskoden for å fortsette.</p>
      <label>Tilgangskode<input id="v290GateCode" type="password" autocomplete="one-time-code" placeholder="••••••••"></label>
      <button id="v290GateOpen" class="btn primary">Åpne beta</button>
      <div id="v290GateMsg" class="v290-gate-msg"></div>
      <small>Enkel barriere mot tilfeldig bruk. Kommersiell Pro-tilgang må senere håndheves server-side.</small>
    </div>`;
    document.body.appendChild(gate);
    $("v290GateOpen").onclick=async()=>{
      const input=($("v290GateCode").value||"").trim(),msg=$("v290GateMsg");
      if(!input){msg.textContent="Skriv inn tilgangskoden.";return;}
      if(await sha256Hex(input)!==CFG.betaGateHash){msg.textContent="Feil tilgangskode.";return;}
      sessionStorage.setItem("ians_v290_beta_gate","ok"); gate.remove();
    };
    $("v290GateCode").addEventListener("keydown",e=>{if(e.key==="Enter")$("v290GateOpen").click();});
  }

  function modal(html){
    let m=$("v290Modal");
    if(!m){
      m=document.createElement("div"); m.id="v290Modal"; m.className="v290-modal hidden";
      m.innerHTML='<div class="v290-modal-card"><button class="v290-close" aria-label="Lukk">×</button><div id="v290ModalBody"></div></div>';
      document.body.appendChild(m);
      m.querySelector(".v290-close").onclick=()=>m.classList.add("hidden");
      m.onclick=e=>{if(e.target===m)m.classList.add("hidden");};
    }
    $("v290ModalBody").innerHTML=html; m.classList.remove("hidden");
  }

  function openPlans(){
    modal(`<span class="eyebrow">FREE / PRO</span><h2>Bruk verktøyet gratis. Betal først når du vil endre OneDrive.</h2>
      <div class="v290-plan-grid">
        <article><span class="v290-free-badge">FREE</span><h3>Analyze & Protect</h3><ul>${FREE_FEATURES.map(x=>`<li>✓ ${esc(x)}</li>`).join("")}</ul><strong class="v290-price">0 kr</strong></article>
        <article class="pro"><span class="v290-pro-badge">PRO</span><h3>Action Mode</h3><ul>${PRO_FEATURES.map(x=>`<li>✓ ${esc(x)}</li>`).join("")}</ul><strong class="v290-price">Pris kommer</strong><button id="v290ModalUnlock" class="btn primary">Sjekk Pro-tilgang</button></article>
      </div>
      <p class="v290-footnote">Free bruker <code>Files.Read</code>. <code>Files.ReadWrite</code> hentes først når Pro/Action Mode låses opp.</p>`);
    $("v290ModalUnlock")?.addEventListener("click",requestPro);
  }

  function ownerMatch(){
    const wanted=String(CFG.ownerUsername||"").trim().toLowerCase();
    const actual=String(activeAccount?.username||"").trim().toLowerCase();
    return !!wanted && !!actual && wanted===actual;
  }

  async function checkEntitlement(){
    if(ownerMatch()) return {pro:true,source:"owner-beta"};
    if(!CFG.entitlementEndpoint) return {pro:false,reason:"Pro-backend er ikke konfigurert ennå."};
    try{
      const res=await fetch(CFG.entitlementEndpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({account:activeAccount?.username||"",product:"onedrive-organizer-pro"})});
      if(!res.ok) return {pro:false,reason:`Entitlement API ${res.status}`};
      const data=await res.json();
      return {pro:data?.pro===true,reason:data?.message||""};
    }catch{
      return {pro:false,reason:"Kunne ikke kontakte Pro-tjenesten."};
    }
  }

  async function requestPro(){
    if(!activeAccount){
      modal(`<span class="eyebrow">PRO</span><h2>Koble først til OneDrive</h2><p>Logg inn med Microsoft før Pro-status kan kontrolleres.</p>`);
      return;
    }
    modal(`<span class="eyebrow">PRO CHECK</span><h2>Kontrollerer tilgang…</h2><p class="muted">Action Mode forblir låst til kontrollen er ferdig.</p>`);
    const result=await checkEntitlement();
    if(result.pro){
      proUnlocked=true;
      document.body.classList.add("v290-pro-active");
      $("v290Modal").classList.add("hidden");
      updatePlanState();
      if(typeof iansToast==="function")iansToast("PRO aktivert","Action Mode kan nå aktiveres for denne økten.","success",7000);
      return;
    }
    modal(`<span class="v290-pro-badge">PRO</span><h2>Action Mode er en Pro-funksjon</h2>
      <p>Du kan fortsatt bruke analyse-, backup- og verifiseringsdelen gratis.</p>
      <div class="v290-upgrade-box"><strong>Pro åpner:</strong><ul>${PRO_FEATURES.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>
      <p class="muted">${esc(result.reason||"Ingen aktiv Pro-tilgang funnet.")}</p>
      <p class="v290-footnote">V2.9.0 etablerer Free/Pro-arkitekturen. Betaling og entitlement kobles på senere.</p>`);
  }

  function injectFreeProBar(){
    if($("v290PlanBar") || !$("dashboard"))return;
    const bar=document.createElement("section");
    bar.id="v290PlanBar"; bar.className="v290-planbar";
    bar.innerHTML=`<div class="v290-plan-current"><span class="v290-free-badge">FREE</span><div><strong>Read Only Edition</strong><small>Analyser, verifiser og last ned uten å endre OneDrive.</small></div></div>
      <div class="v290-plan-actions"><button id="v290ComparePlans" class="btn ghost">Free vs Pro</button><button id="v290UnlockPro" class="btn primary">Unlock Action Mode · PRO</button></div>`;
    $("dashboard").prepend(bar);
    $("v290ComparePlans").onclick=openPlans;
    $("v290UnlockPro").onclick=requestPro;
  }

  function injectProBadge(){
    for(const id of ["v24EnableAction","topActionBtn"]){
      const b=$(id);
      if(b && !b.querySelector(".v290-inline-pro")) b.insertAdjacentHTML("beforeend",' <span class="v290-inline-pro">PRO</span>');
    }
  }

  function updatePlanState(){
    const bar=$("v290PlanBar"); if(!bar)return;
    bar.classList.toggle("pro-active",proUnlocked);
    const badge=bar.querySelector(".v290-free-badge,.v290-pro-badge");
    if(badge){badge.textContent=proUnlocked?"PRO":"FREE";badge.className=proUnlocked?"v290-pro-badge":"v290-free-badge";}
    const title=bar.querySelector(".v290-plan-current strong"),sub=bar.querySelector(".v290-plan-current small");
    if(title)title.textContent=proUnlocked?"Pro Edition":"Read Only Edition";
    if(sub)sub.textContent=proUnlocked?"Action Mode er tilgjengelig for denne økten.":"Analyser, verifiser og last ned uten å endre OneDrive.";
  }

  function installActionGuard(){
    document.addEventListener("click",e=>{
      const b=e.target.closest("#v24EnableAction,#topActionBtn");
      if(!b || proUnlocked)return;
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();requestPro();
    },true);
  }

  function hideClientIdSetup(){
    const input=$("clientIdInput"),save=$("saveClientIdBtn"),msg=$("setupMessage");
    if(input){input.value=CFG.clientId||input.value;input.readOnly=true;input.disabled=true;}
    if(save)save.classList.add("hidden");
    if(msg&&CFG.clientId)msg.textContent="Microsoft-app er forhåndskonfigurert. Du trenger ikke Client ID.";
  }

  function addArchitectureNote(){
    if($("v290ArchitectureNote"))return;
    const host=$("loginPanel")||$("setupPanel"); if(!host)return;
    const note=document.createElement("div");
    note.id="v290ArchitectureNote"; note.className="v290-arch-note";
    note.innerHTML=`<strong>Microsoft-login</strong><p>Appens Client ID er innebygd. Du logger inn med din egen Microsoft-konto, og verktøyet arbeider mot din OneDrive.</p><small>Free Mode bruker Read Only. Skrivetilgang krever Pro + eksplisitt Action Mode.</small>`;
    host.appendChild(note);
  }

  function boot(){
    injectAccessGate();injectFreeProBar();injectProBadge();hideClientIdSetup();addArchitectureNote();updatePlanState();
    setTimeout(()=>{hideClientIdSetup();injectProBadge();injectFreeProBar();},900);
    console.info("[IANS] V2.9.0 Free / Pro Foundation aktiv");
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();
// ===== IANS V2.9.2 PRO TRIAL + FEEDBACK =====
(() => {
  const $ = id => document.getElementById(id);
  const CFG = window.IANS_V290_CONFIG || {};
  const SUPPORT_NUMBER = "93002067";
  let trialUnlocked = false;

  async function sha256Hex(text){
    const b=new TextEncoder().encode(text);
    const d=await crypto.subtle.digest("SHA-256",b);
    return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,"0")).join("");
  }

  function modal(html){
    let m=$("v291Modal");
    if(!m){
      m=document.createElement("div");
      m.id="v291Modal"; m.className="v291-modal hidden";
      m.innerHTML='<div class="v291-modal-card"><button class="v291-close">×</button><div id="v291ModalBody"></div></div>';
      document.body.appendChild(m);
      m.querySelector(".v291-close").onclick=()=>m.classList.add("hidden");
      m.onclick=e=>{if(e.target===m)m.classList.add("hidden");};
    }
    $("v291ModalBody").innerHTML=html;
    m.classList.remove("hidden");
  }

  function removeStartupGate(){
    $("v290AccessGate")?.remove();
    sessionStorage.removeItem("ians_v290_beta_gate");
  }

  function ownerMatch(){
    const wanted=String(CFG.ownerUsername||"").trim().toLowerCase();
    const actual=String(window.activeAccount?.username||"").trim().toLowerCase();
    return !!wanted && !!actual && wanted===actual;
  }

  function proOpen(){
    return ownerMatch() || trialUnlocked || document.body.classList.contains("v290-pro-active");
  }

  async function openProTrial(){
    if(!window.activeAccount){
      modal('<span class="v291-kicker">PRO TRIAL</span><h2>Koble først til OneDrive</h2><p>Logg inn med Microsoft. Free Mode fungerer uten Action Mode.</p>');
      return;
    }
    modal(`<span class="v291-kicker">PRO TRIAL</span><h2>Prøv Action Mode</h2>
      <p>Har du fått en testkode? Skriv den inn for å prøve Pro-funksjonene i denne nettleserøkten.</p>
      <label class="v291-code-label">Testkode<input id="v291TrialCode" type="password" placeholder="••••••••"></label>
      <button id="v291TrialOpen" class="btn primary">Aktiver Pro-prøve</button>
      <div id="v291TrialMsg" class="v291-msg"></div>
      <div class="v291-note"><strong>Liker du verktøyet?</strong><p>Tilbakemeldinger og forslag er svært velkomne. Vil du støtte utviklingen kan du sende et valgfritt beløp på Vipps til <b>${SUPPORT_NUMBER}</b>.</p></div>`);
    $("v291TrialOpen").onclick=async()=>{
      const v=($("v291TrialCode").value||"").trim();
      if(!v){$("v291TrialMsg").textContent="Skriv inn testkoden.";return;}
      if(!CFG.betaGateHash){$("v291TrialMsg").textContent="Ingen Pro-testkode er konfigurert.";return;}
      if(await sha256Hex(v)!==CFG.betaGateHash){$("v291TrialMsg").textContent="Feil testkode.";return;}
      trialUnlocked=true;
      document.body.classList.add("v290-pro-active","v291-pro-trial");
      $("v291Modal").classList.add("hidden");
    };
  }

  function support(){
    modal(`<span class="v291-kicker">STØTT VIDERE UTVIKLING</span><h2>Vipps er helt valgfritt</h2>
      <p>Hvis verktøyet er nyttig og du ønsker å støtte videre utvikling, kan du sende et valgfritt beløp.</p>
      <div class="v291-vipps"><div class="v291-vipps-logo">VIPPS</div><div><small>Vipps til</small><strong>${SUPPORT_NUMBER}</strong><button id="v291CopyVipps" class="btn ghost">Kopier nummer</button></div></div>
      <div class="v291-qr-placeholder"><strong>Offisiell Vipps-QR</strong><p>Her kan vi legge inn en offisiell QR fra Vipps/Vipps MobilePay når betalingsløsningen er opprettet.</p></div>
      <p class="v291-muted">Støtte er frivillig og gir ikke automatisk Pro-status.</p>`);
    $("v291CopyVipps").onclick=async()=>{await navigator.clipboard?.writeText(SUPPORT_NUMBER);$("v291CopyVipps").textContent="Kopiert ✓";};
  }

  function feedback(){
    const subject=encodeURIComponent("OneDrive Command Center – tilbakemelding");
    const body=encodeURIComponent("Hei Henrik,\n\nJeg har testet OneDrive Command Center.\n\nDette likte jeg:\n\nForslag til forbedringer:\n\nEventuelle feil:\n");
    modal(`<span class="v291-kicker">TILBAKEMELDING</span><h2>Hjelp verktøyet å bli bedre</h2><p>Fortell gjerne hva som fungerte, hva som var uklart og hva du savner.</p>
      <div class="v291-feedback-actions"><a class="btn primary" href="mailto:henrik.bergfjord@outlook.com?subject=${subject}&body=${body}">Send tilbakemelding</a><button id="v291SupportOpen" class="btn ghost">Støtt via Vipps</button></div>`);
    $("v291SupportOpen").onclick=support;
  }

  function installGuard(){
    document.addEventListener("click",e=>{
      const b=e.target.closest("#v24EnableAction,#topActionBtn,#v290UnlockPro,#v290ModalUnlock");
      if(!b || proOpen())return;
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      openProTrial();
    },true);
  }

  function rewrite(){
    const action=$("v290UnlockPro");
    if(action)action.textContent="Prøv Action Mode · PRO";
    const bar=$("v290PlanBar");
    if(bar){
      const t=bar.querySelector(".v290-plan-current strong"),s=bar.querySelector(".v290-plan-current small");
      if(t)t.textContent="Free · Read Only";
      if(s)s.textContent="Kartlegg, analyser, verifiser og last ned gratis. Pro kreves først når du vil gjøre endringer.";
    }
  }

  function addButtons(){
    if($("v291FeedbackBtn"))return;
    const host=document.querySelector(".header-actions,.top-actions,.toolbar-actions")||document.querySelector("header");
    if(!host)return;
    const f=document.createElement("button");f.id="v291FeedbackBtn";f.className="v291-mini-btn";f.textContent="Tilbakemelding";f.onclick=feedback;
    const s=document.createElement("button");s.id="v291SupportBtn";s.className="v291-mini-btn v291-support";s.textContent="Støtt utviklingen";s.onclick=support;
    host.append(f,s);
  }

  function boot(){
    removeStartupGate(); rewrite(); addButtons();
    setTimeout(()=>{removeStartupGate();rewrite();addButtons();},800);
    console.info("[IANS] V2.9.2 Pro Trial + Feedback aktiv");
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();
// ===== IANS OneDrive Command V2.9.2 SMART CLEANUP + SINGLE ACTION FLOW =====
(() => {
  const V292 = "2.9.2";
  const REVIEW_PREFIX = "/_IANS Cleanup Review/";
  const BASELINE_PREFIX = "ians_v292_baseline_";
  const ACTION_SESSION = "ians_v292_action_confirmed";
  const PRO_SESSION = "ians_v292_pro_ok";

  const $ = id => document.getElementById(id);
  const esc292 = s => String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));

  const fmtBytes292 = n => typeof formatBytes === "function" ? formatBytes(n || 0) : `${Math.round((n||0)/1073741824)} GB`;
  const fmtNum292 = n => typeof formatNumber === "function" ? formatNumber(n || 0) : String(n || 0);

  function isReviewPath(path=""){
    return path === "/_IANS Cleanup Review" || path.startsWith(REVIEW_PREFIX);
  }

  function dupKey(f){
    return `${String(f.name||"").trim().toLowerCase()}|${Number(f.size)||0}`;
  }

  function relevantDate(f){
    return f.takenDateTime || f.lastModifiedDateTime || f.createdDateTime || "";
  }

  function ext(name=""){
    const m = String(name).toLowerCase().match(/\.([^.]+)$/);
    return m ? m[1] : "";
  }

  const INSTALLER_EXT = new Set(["iso","wim","esd","img","exe","msi","msix","pkg","cab","dmg","rar","7z"]);
  const GENERIC_CLEANUP_HINTS = [
    "backup","bakup","backup må gjennomgå","rydd","cleanup","download","downloads",
    "nedlasting","temp","temporary","old","gammel","fra usb","usb","copy","kopi",
    "last opp for backup","windows10upgrade","install","installer","software"
  ];

  function hasGenericCleanupContext(path=""){
    const p = path.toLowerCase();
    return GENERIC_CLEANUP_HINTS.some(x => p.includes(x));
  }

  function pathDepth(path=""){
    return String(path).split("/").filter(Boolean).length;
  }

  function contextProtected(f){
    // Bevar dokumenter i meningsfulle mapper. Vi sorterer aldri "alle Excel" eller "alle PDF".
    const cat = String(f.category||"");
    const isBusinessDoc = ["Dokumenter","Regneark","Presentasjoner"].includes(cat);
    if(isBusinessDoc && pathDepth(f.parentPath||f.path) >= 2 && !hasGenericCleanupContext(f.path)) return true;

    // Filer utenfor generiske backup/ryddeområder behandles konservativt.
    if(!hasGenericCleanupContext(f.path) && pathDepth(f.parentPath||f.path) >= 3) return true;
    return false;
  }

  function oldInstallerCandidate(f){
    if(isReviewPath(f.path) || contextProtected(f)) return false;
    if(!INSTALLER_EXT.has(ext(f.name))) return false;
    if(!hasGenericCleanupContext(f.path)) return false;
    const d = new Date(f.lastModifiedDateTime || f.createdDateTime || 0);
    if(!Number.isFinite(d.getTime())) return false;
    const ageYears = (Date.now() - d.getTime()) / 31557600000;
    return ageYears >= 3;
  }

  function buildSmart(r){
    const all = Array.isArray(r.files) ? r.files : [];
    const map = new Map();
    for(const f of all){
      if(!f || !f.name || !Number(f.size)) continue;
      const k = dupKey(f);
      if(!map.has(k)) map.set(k, []);
      map.get(k).push(f);
    }

    let totalSavings = 0;
    let reviewSavings = 0;
    let newSavings = 0;
    let totalGroups = 0;
    let reviewGroups = 0;
    let newGroups = 0;
    let strongGroups = 0;

    const newDupGroups = [];
    const reviewDupGroups = [];

    for(const files of map.values()){
      if(files.length < 2) continue;
      totalGroups++;
      const size = Number(files[0].size)||0;
      const review = files.filter(f => isReviewPath(f.path));
      const normal = files.filter(f => !isReviewPath(f.path));

      const total = Math.max(0, files.length - 1) * size;
      const alreadyReview = normal.length > 0
        ? review.length * size
        : Math.max(0, review.length - 1) * size;
      const fresh = Math.max(0, normal.length - 1) * size;

      totalSavings += total;
      reviewSavings += alreadyReview;
      newSavings += fresh;

      if(review.length){
        reviewGroups++;
        reviewDupGroups.push({
          name:files[0].name,
          sizeEach:size,
          copies:files.length,
          reviewCopies:review.length,
          nonReviewCopies:normal.length,
          potentialSavings:alreadyReview,
          paths:review.slice(0,12).map(f=>f.path)
        });
      }

      if(normal.length > 1){
        newGroups++;
        const dates = normal.map(relevantDate).filter(Boolean);
        const sameDate = dates.length >= 2 && new Set(dates).size === 1;
        const confidence = sameDate ? "strong" : "possible";
        if(confidence === "strong") strongGroups++;
        newDupGroups.push({
          name:files[0].name,
          sizeEach:size,
          copies:normal.length,
          potentialSavings:fresh,
          confidence,
          paths:normal.slice(0,12).map(f=>f.path)
        });
      }
    }

    newDupGroups.sort((a,b)=>b.potentialSavings-a.potentialSavings);
    reviewDupGroups.sort((a,b)=>b.potentialSavings-a.potentialSavings);

    const oldInstallers = all
      .filter(oldInstallerCandidate)
      .sort((a,b)=>(b.size||0)-(a.size||0));

    const rootOrphans = all
      .filter(f => !isReviewPath(f.path) && (f.parentPath === "/" || String(f.path||"").split("/").filter(Boolean).length === 1))
      .filter(f => ["Dokumenter","Regneark","Presentasjoner","Video","Bilder"].includes(String(f.category||"")))
      .sort((a,b)=>(b.size||0)-(a.size||0));

    const started = new Date(r.scanStartedAt || 0).getTime();
    const finished = new Date(r.generatedAt || Date.now()).getTime();
    const durationMs = Math.max(0, finished-started);
    const durationSec = durationMs/1000;
    const fps = durationSec > 0 ? (r.summary?.files||0)/durationSec : 0;

    return {
      engine:"IANS Smart Cleanup 2.9.2",
      philosophy:"Bevar kontekst. Ingen samling etter filtype. Preview før handling.",
      totalIdentified:{
        groups:totalGroups,
        savings:totalSavings
      },
      alreadyInReview:{
        groups:reviewGroups,
        savings:reviewSavings
      },
      newCandidates:{
        groups:newGroups,
        savings:newSavings,
        strongGroups,
        verifiedGroups:0
      },
      oldInstallers:{
        count:oldInstallers.length,
        bytes:oldInstallers.reduce((s,f)=>s+(Number(f.size)||0),0),
        files:oldInstallers.slice(0,50)
      },
      rootItems:{
        count:rootOrphans.length,
        bytes:rootOrphans.reduce((s,f)=>s+(Number(f.size)||0),0),
        files:rootOrphans.slice(0,50)
      },
      duplicateCandidates:newDupGroups.slice(0,300),
      reviewDuplicateGroups:reviewDupGroups.slice(0,300),
      performance:{
        durationMs,
        filesPerSecond:fps,
        files:r.summary?.files||0,
        folders:r.summary?.folders||0,
        bytes:r.summary?.fileBytes||0
      }
    };
  }

  function baselineKey(r){
    const account = String(r.account?.username||"anonymous").toLowerCase();
    const root = String(r.scanRoot?.path||"/");
    return BASELINE_PREFIX + btoa(unescape(encodeURIComponent(`${account}|${root}`))).replace(/=+$/,"");
  }

  function compareBaseline(r, smart){
    const key = baselineKey(r);
    let prev = null;
    try{prev=JSON.parse(localStorage.getItem(key)||"null")}catch{}
    const now = {
      generatedAt:r.generatedAt,
      files:r.summary?.files||0,
      folders:r.summary?.folders||0,
      bytes:r.summary?.fileBytes||0,
      newDupGroups:smart.newCandidates.groups,
      newDupSavings:smart.newCandidates.savings,
      reviewSavings:smart.alreadyInReview.savings
    };
    const delta = prev ? {
      files:now.files-prev.files,
      folders:now.folders-prev.folders,
      bytes:now.bytes-prev.bytes,
      newDupGroups:now.newDupGroups-prev.newDupGroups,
      newDupSavings:now.newDupSavings-prev.newDupSavings,
      reviewSavings:now.reviewSavings-prev.reviewSavings
    } : null;
    try{localStorage.setItem(key,JSON.stringify(now))}catch{}
    return {previous:prev, current:now, delta};
  }

  function enhanceReport(r){
    if(!r || !Array.isArray(r.files)) return r;
    const smart = buildSmart(r);
    const baseline = compareBaseline(r, smart);
    r.smartCleanup = {...smart, baseline};

    // Hovedkortet skal vise NYE kandidater, ikke filer som allerede er i review/karantene.
    r.summary.rawPossibleDuplicateGroups = r.summary.possibleDuplicateGroups;
    r.summary.rawPossibleDuplicateSavings = r.summary.possibleDuplicateSavings;
    r.summary.possibleDuplicateGroups = smart.newCandidates.groups;
    r.summary.possibleDuplicateSavings = smart.newCandidates.savings;

    // Duplicate Review skal ikke repetere _IANS Cleanup Review som "nye" kandidater.
    r.possibleDuplicates = smart.duplicateCandidates.map(g=>({
      name:g.name,
      sizeEach:g.sizeEach,
      copies:g.copies,
      potentialSavings:g.potentialSavings,
      confidence:g.confidence,
      paths:g.paths
    }));
    return r;
  }

  function fmtSignedBytes(v){
    if(!v) return "0 B";
    return `${v>0?"+":"−"}${fmtBytes292(Math.abs(v))}`;
  }
  function fmtSignedNum(v){
    if(!v) return "0";
    return `${v>0?"+":"−"}${fmtNum292(Math.abs(v))}`;
  }
  function fmtDuration(ms){
    const s=Math.round((ms||0)/1000), h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=s%60;
    return h?`${h} t ${m} min`:m?`${m} min ${sec} sek`:`${sec} sek`;
  }

  function ensurePanel(){
    if($("v292SmartCleanup")) return $("v292SmartCleanup");
    const dup = $("duplicatesTable")?.closest("section.panel");
    if(!dup) return null;
    const p=document.createElement("section");
    p.id="v292SmartCleanup";
    p.className="panel v292-smart";
    dup.parentNode.insertBefore(p,dup);
    return p;
  }

  function renderSmart(r){
    if(!r?.smartCleanup) return;
    const s=r.smartCleanup, p=ensurePanel();
    if(!p) return;
    const b=s.baseline;
    const base = b.previous ? `
      <div class="v292-baseline">
        <span class="eyebrow">ENDRING SIDEN FORRIGE SCAN</span>
        <div><b>${fmtSignedNum(b.delta.files)}</b><small>filer</small></div>
        <div><b>${fmtSignedBytes(b.delta.bytes)}</b><small>kartlagt data</small></div>
        <div><b>${fmtSignedNum(b.delta.newDupGroups)}</b><small>nye dup.grupper</small></div>
        <div><b>${fmtSignedBytes(b.delta.newDupSavings)}</b><small>ny duplikatplass</small></div>
      </div>` :
      `<div class="v292-baseline first"><strong>Baseline opprettet</strong><span>Neste scan kan vise hva som faktisk har endret seg.</span></div>`;

    const installers = s.oldInstallers.files.slice(0,12).map(f=>{
      const raw=f.lastModifiedDateTime||f.createdDateTime||f.takenDateTime||"";
      const date=raw ? new Date(raw) : null;
      const dateText=date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0,10) : "–";
      return `<tr data-v310-smart-row="${esc292(f.id)}"><td class="path">${esc292(f.path)}</td><td>${esc292(f.category||"")}</td><td>${dateText}</td><td class="num">${fmtBytes292(f.size)}</td><td><div class="row-actions"><button class="btn mini ghost" data-preview="${esc292(f.id)}">Preview</button><button class="btn mini danger" data-v310-smart-trash="${esc292(f.id)}">Papirkurv</button></div></td></tr>`;
    }).join("");

    const strong = s.duplicateCandidates.filter(x=>x.confidence==="strong").slice(0,5).map(g=>`
      <li><div><strong>${esc292(g.name)}</strong><small>${g.copies} kopier · ${fmtBytes292(g.sizeEach)}/stk</small></div><b>${fmtBytes292(g.potentialSavings)}</b></li>`).join("");

    p.innerHTML=`
      <div class="section-title">
        <div><span class="eyebrow">SMART CLEANUP · V${V292}</span><h3>Rydd med kontekst – ikke bare filtype</h3></div>
        <span class="badge safe">PREVIEW FIRST</span>
      </div>
      <p class="muted">Dokumenter beholdes i kunde-, prosjekt- og fagmapper. Vi samler aldri alle Excel-, PDF- eller Word-filer bare fordi de har samme filtype.</p>

      <div class="v292-metrics">
        <article><span>Nye kandidater</span><strong>${fmtBytes292(s.newCandidates.savings)}</strong><small>${fmtNum292(s.newCandidates.groups)} grupper utenfor Cleanup Review</small></article>
        <article><span>Allerede i review</span><strong>${fmtBytes292(s.alreadyInReview.savings)}</strong><small>${fmtNum292(s.alreadyInReview.groups)} grupper er allerede håndtert/isolert</small></article>
        <article><span>Total identifisert</span><strong>${fmtBytes292(s.totalIdentified.savings)}</strong><small>Informasjon – ikke automatisk sletteforslag</small></article>
        <article><span>Scan-ytelse</span><strong>${fmtDuration(s.performance.durationMs)}</strong><small>${s.performance.filesPerSecond.toFixed(1)} filer/sek · ${fmtBytes292(s.performance.bytes)}</small></article>
      </div>

      ${base}

      <div class="v292-grid">
        <article class="v292-card">
          <span class="eyebrow">DUPLIKATSIKKERHET</span>
          <h4>Tre sikkerhetsnivåer</h4>
          <div class="v292-level"><b>1 · Mulig</b><span>Samme navn + størrelse</span></div>
          <div class="v292-level strong"><b>2 · Sterk kandidat</b><span>Samme navn, størrelse og relevante metadata</span></div>
          <div class="v292-level verified"><b>3 · Verifisert identisk</b><span>Krever innholds-/hashkontroll før permanent sletting</span></div>
          <p><strong>${fmtNum292(s.newCandidates.strongGroups)}</strong> sterke kandidater · <strong>0</strong> hash-verifiserte grupper i denne versjonen.</p>
        </article>

        <article class="v292-card">
          <span class="eyebrow">SUNN FORNUFT</span>
          <h4>Hva motoren beskytter</h4>
          <ul>
            <li>Kunde- og prosjektstruktur beholdes</li>
            <li>Dokumenter flyttes ikke bare pga. filtype</li>
            <li>Cleanup Review telles separat</li>
            <li>Gamle installasjonsfiler foreslås kun i tydelige backup/ryddeområder</li>
            <li>Bilder/video krever ekstra kontroll før permanent sletting</li>
          </ul>
        </article>
      </div>

      ${strong ? `<div class="v292-priority"><span class="eyebrow">HØY VERDI · STERKE KANDIDATER</span><ul>${strong}</ul></div>` : ""}

      <details class="v292-details">
        <summary>Gamle installasjonsfiler i tydelige backup/ryddeområder · ${fmtNum292(s.oldInstallers.count)} filer · ${fmtBytes292(s.oldInstallers.bytes)}</summary>
        <p class="muted">Dette er kun review-kandidater. Filer i meningsfulle prosjekt-/kundemapper beskyttes.</p>
        <div class="table-wrap"><table><thead><tr><th>Fil</th><th>Type</th><th>Dato</th><th>Størrelse</th><th>Handling</th></tr></thead><tbody>${installers||'<tr><td colspan="5">Ingen kandidater.</td></tr>'}</tbody></table></div>
      </details>
    `;

    const dupPanel=$("duplicatesTable")?.closest("section.panel");
    const note=dupPanel?.querySelector("p.muted");
    if(note) note.innerHTML=`V2.9.2 viser <strong>nye kandidater utenfor _IANS Cleanup Review</strong>. Metadata gir kandidatnivå – ikke bevis. Permanent sletting bør først skje etter innholdsverifisering.`;
    const metric=$("duplicateCount")?.closest(".metric");
    const label=metric?.querySelector("span");
    if(label) label.textContent="Nye duplikatkandidater";
  }

  // Enhance every completed scan before the existing UI renders.
  const baseRenderReport292 = renderReport;
  renderReport = function(r){
    enhanceReport(r);
    baseRenderReport292(r);
    renderSmart(r);
  };

  // ---------- ONE AUTHORITATIVE ACTION MODE FLOW ----------
  function cfg292(){ return window.IANS_V290_CONFIG || {}; }
  function ownerMatch292(){
    const wanted=String(cfg292().ownerUsername||"").trim().toLowerCase();
    const actual=String(activeAccount?.username||"").trim().toLowerCase();
    return !!wanted && !!actual && wanted===actual;
  }
  async function sha292(text){
    const b=new TextEncoder().encode(text),d=await crypto.subtle.digest("SHA-256",b);
    return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,"0")).join("");
  }

  function actionModal292({needsCode=false}={}){
    return new Promise(resolve=>{
      const wrap=document.createElement("div");
      wrap.className="v292-action-modal";
      wrap.innerHTML=`<div class="v292-action-card">
        <button class="v292-x" aria-label="Lukk">×</button>
        <span class="eyebrow">ACTION MODE · PRO</span>
        <h2>Aktiver Action Mode</h2>
        <div class="v292-danger"><strong>Read Only avsluttes for skrivehandlinger.</strong><p>OneDrive Command kan deretter flytte filer, bruke strukturert karantene eller sende filer til papirkurven.</p></div>
        ${needsCode?`<label>Pro-testkode<input id="v292ActionCode" type="password" autocomplete="one-time-code" placeholder="••••••••"></label>`:""}
        <label class="v292-check"><input id="v292ActionCheck" type="checkbox"> Jeg har kontrollert preview/backup og ønsker å aktivere skrivehandlinger for denne økten.</label>
        <div id="v292ActionMsg" class="v292-msg"></div>
        <div class="v292-actions"><button class="btn ghost" id="v292Cancel">Avbryt</button><button class="btn primary" id="v292Go" disabled>Aktiver Action Mode</button></div>
      </div>`;
      document.body.appendChild(wrap);
      const check=wrap.querySelector("#v292ActionCheck"),go=wrap.querySelector("#v292Go"),msg=wrap.querySelector("#v292ActionMsg");
      check.onchange=()=>go.disabled=!check.checked;
      const close=()=>{wrap.remove();resolve(false)};
      wrap.querySelector(".v292-x").onclick=close;
      wrap.querySelector("#v292Cancel").onclick=close;
      go.onclick=async()=>{
        if(needsCode){
          const code=(wrap.querySelector("#v292ActionCode")?.value||"").trim();
          if(!code){msg.textContent="Skriv inn Pro-testkoden.";return;}
          const hash=cfg292().betaGateHash||"";
          if(!hash || await sha292(code)!==hash){msg.textContent="Feil Pro-testkode.";return;}
        }
        wrap.remove(); resolve(true);
      };
    });
  }

  let activating292=false;
  async function activateAction292(){
    if(activating292 || (typeof v24Enabled!=="undefined" && v24Enabled)) return;
    if(!activeAccount){ alert("Koble først til OneDrive."); return; }
    activating292=true;
    try{
      const owner=ownerMatch292();
      const sessionPro=sessionStorage.getItem(PRO_SESSION)==="1";
      const bodyPro=document.body.classList.contains("v290-pro-active");
      const needsCode=!(owner || sessionPro || bodyPro);

      const confirmed=sessionStorage.getItem(ACTION_SESSION)==="1";
      if(!confirmed || needsCode){
        const ok=await actionModal292({needsCode});
        if(!ok) return;
        sessionStorage.setItem(ACTION_SESSION,"1");
        sessionStorage.setItem(PRO_SESSION,"1");
        document.body.classList.add("v290-pro-active","v292-pro-active");
      }

      // Ett Microsoft consent-popup kan vises første gang Files.ReadWrite kreves.
      await v24WriteToken(true);
      v24SetEnabled(true);
      if(typeof syncMode252==="function") syncMode252(true);
      if(typeof iansToast==="function") iansToast("Action Mode aktiv","Skrivetilgang er aktiv for denne nettleserøkten.","success",6500);
    }catch(err){
      console.error("[IANS V2.9.2] Action Mode",err);
      alert(`Kunne ikke aktivere Action Mode: ${err.message}`);
    }finally{
      activating292=false;
    }
  }

  // Gamle guard-funksjoner deaktiveres av installeren. Denne handleren er nå eneste flyt.
  document.addEventListener("click",e=>{
    const b=e.target.closest("#topActionBtn,#v24EnableAction");
    if(!b) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    activateAction292();
  },true);

  function boot292(){
    // Hvis rapport finnes i minnet (f.eks. etter hot reload), oppgrader visningen.
    try{
      if(report){
        enhanceReport(report);
        baseRenderReport292(report);
        renderSmart(report);
      }
    }catch(e){console.warn("[IANS V2.9.2] initial render",e);}
    console.info("[IANS] OneDrive Command V2.9.2 Smart Cleanup aktiv");
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot292);
  else boot292();
})();

// ===== IANS V2.9.4.1 ACTION PROGRESS FIX =====
console.info("[IANS] V2.9.4.1 Action Progress Fix aktiv – papirkurv viser nå fremdrift og feilstatus");

// ===== IANS OneDrive Command V2.9.3 · Portable Scan + Photo Intelligence =====
(() => {
  const V293_SCHEMA = "ians-onedrive-scan/1";
  const V293_VERSION = "2.9.3";
  const esc = s => String(s ?? "").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmtN = n => new Intl.NumberFormat("nb-NO").format(Number(n)||0);
  const fmtB = n => typeof formatBytes === "function" ? formatBytes(Number(n)||0) : `${Math.round((Number(n)||0)/1048576)} MB`;
  const media = f => /^(Bilder|Video)$/.test(f.category||"") || /^(image|video)\//i.test(f.mimeType||"") || /\.(jpe?g|png|heic|heif|webp|gif|tiff?|mov|mp4|m4v|avi|mkv|3gp)$/i.test(f.name||"");
  const photo = f => (f.category==="Bilder") || /^image\//i.test(f.mimeType||"") || /\.(jpe?g|png|heic|heif|webp|gif|tiff?)$/i.test(f.name||"");
  const video = f => (f.category==="Video") || /^video\//i.test(f.mimeType||"") || /\.(mov|mp4|m4v|avi|mkv|3gp)$/i.test(f.name||"");
  const stopWords = new Set(["onedrive","documents","documenter","bilder","images","photos","photo","camera roll","kamerarull","desktop","skrivebord","backup","archive","arkiv"]);
  function safeDate(f){ const d=f.takenDateTime||f.createdDateTime||f.lastModifiedDateTime; const x=d?new Date(d):null; return x && !Number.isNaN(x.getTime()) ? x : null; }
  function contextTags(f){
    const tags=[]; const d=safeDate(f);
    if(d){tags.push(String(d.getFullYear())); tags.push(d.toLocaleString("nb-NO",{month:"long"}));}
    tags.push(photo(f)?"Bilde":video(f)?"Video":"Media");
    const parts=(f.parentPath||"").split("/").map(x=>x.trim()).filter(Boolean);
    for(const p of parts.slice(-4)){
      const clean=p.replace(/[_-]+/g," ").trim();
      if(clean.length>=3 && clean.length<=45 && !stopWords.has(clean.toLowerCase()) && !/^\d{4}$/.test(clean)) tags.push(clean);
    }
    if(/screenshot|skjermbilde/i.test(f.name||"")) tags.push("Skjermbilde");
    if(/scan|scann|document|receipt|kvittering/i.test(f.name||"")) tags.push("Dokumentfoto");
    return [...new Set(tags)].slice(0,10);
  }
  function buildPhotoIntel(r){
    const files=(r?.files||[]).filter(media); const collections=new Map(), years=new Map(); let unorganized=0, screenshots=0, images=0, videos=0, bytes=0;
    const tagged=files.map(f=>{
      const tags=contextTags(f); const d=safeDate(f); bytes+=Number(f.size)||0; if(photo(f))images++; if(video(f))videos++; if(tags.includes("Skjermbilde"))screenshots++;
      const context=tags.filter(t=>!["Bilde","Video","Media","Skjermbilde","Dokumentfoto"].includes(t) && !/^\d{4}$/.test(t) && !/^(januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)$/i.test(t));
      if(!context.length) unorganized++;
      if(d) years.set(d.getFullYear(),(years.get(d.getFullYear())||0)+1);
      for(const t of context.slice(0,3)) collections.set(t,(collections.get(t)||0)+1);
      return {id:f.id,name:f.name,path:f.path,tags};
    });
    return {files:files.length,images,videos,bytes,unorganized,screenshots,years:[...years].sort((a,b)=>b[0]-a[0]),collections:[...collections].sort((a,b)=>b[1]-a[1]).slice(0,20),tagged};
  }
  function downloadJson(obj,name){ const blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/json"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000); }
  async function portableState(){
    const cp=typeof loadScanCheckpoint==="function" ? await loadScanCheckpoint() : null;
    const current=(typeof report!=="undefined" && report?.files?.length) ? report : null;
    return {schema:V293_SCHEMA,version:V293_VERSION,exportedAt:new Date().toISOString(),account:activeAccount?.username||current?.account?.username||cp?.account||"",kind:cp?.queue?.length?"checkpoint":current?"completed-report":"empty",checkpoint:cp||null,report:current||null,photoIntelligence:current?buildPhotoIntel(current):null};
  }
  async function exportPortable(){
    const state=await portableState(); if(state.kind==="empty"){alert("Ingen scan eller checkpoint å eksportere ennå.");return;}
    const stamp=new Date().toISOString().replace(/[:.]/g,"-").slice(0,19); downloadJson(state,`IANS-OneDrive-Scan-${stamp}.iansscan`);
    if(typeof iansToast==="function") iansToast("Portable Scan lagret",state.kind==="checkpoint"?"Checkpoint kan importeres og fortsettes på en annen økt.":"Ferdig rapport kan importeres uten ny fullscan.","success",7000);
  }
  // V3.6.1: expose the proven portable exporter to Scan Vault without duplicating logic.
  window.IANS_exportPortableScan = exportPortable;
  function pickImport(){ document.getElementById("v293ImportFile")?.click(); }
  async function importPortable(file){
    let data; try{data=JSON.parse(await file.text())}catch{alert("Filen kunne ikke leses som en IANS scanfil.");return;}
    if(data?.schema!==V293_SCHEMA){alert("Ukjent scanformat. Forventet IANS Portable Scan.");return;}
    const signed=activeAccount?.username||"", source=data.account||data.report?.account?.username||data.checkpoint?.account||"";
    if(signed && source && signed.toLowerCase()!==source.toLowerCase() && !confirm(`Scanfilen tilhører ${source}, mens du er logget inn som ${signed}. Importere likevel?`)) return;
    if(data.checkpoint?.queue?.length){
      await saveScanCheckpoint(data.checkpoint); await refreshCheckpointUi();
      document.getElementById("scanStateBadge").textContent="IMPORTERT";
      document.getElementById("checkpointSummary").textContent=`Importert checkpoint · ${fmtN(data.checkpoint.stats?.files)} filer · ${fmtN(data.checkpoint.processedFolders||0)} mapper ferdig · ${fmtN(data.checkpoint.queue?.length)} mapper gjenstår.`;
    }
    if(data.report?.files?.length){ report=data.report; renderReport(report); const b=document.getElementById("exportBtn"); if(b)b.disabled=false; renderPhotoPanel(); }
    if(typeof iansToast==="function") iansToast("Scan importert",data.checkpoint?.queue?.length?"Trykk Resume for å fortsette fra checkpoint.":"Rapporten er gjenopprettet uten ny fullscan.","success",8000);
  }
  function renderPhotoPanel(){
    const host=document.getElementById("v293PhotoBody"); if(!host)return;
    if(typeof report==="undefined" || !report?.files?.length){host.innerHTML='<div class="empty-state">Kjør eller importer en scan for Photo Intelligence.</div>';return;}
    const p=buildPhotoIntel(report); report.photoIntelligence={generatedAt:new Date().toISOString(),...p,tagged:p.tagged};
    host.innerHTML=`<div class="v293-photo-stats"><div><span>Bilder</span><strong>${fmtN(p.images)}</strong></div><div><span>Video</span><strong>${fmtN(p.videos)}</strong></div><div><span>Media</span><strong>${fmtB(p.bytes)}</strong></div><div><span>Uorganisert</span><strong>${fmtN(p.unorganized)}</strong></div><div><span>Skjermbilder</span><strong>${fmtN(p.screenshots)}</strong></div></div>
      <div class="v293-photo-grid"><div><h4>Virtuelle samlinger</h4>${p.collections.length?p.collections.map(([x,n])=>`<button class="v293-tag" type="button">${esc(x)} <b>${fmtN(n)}</b></button>`).join(""):'<p class="muted">Ingen tydelig mappekontekst ennå.</p>'}</div><div><h4>Tidslinje</h4>${p.years.slice(0,12).map(([y,n])=>`<span class="v293-year"><b>${y}</b>${fmtN(n)} mediafiler</span>`).join("")||'<p class="muted">Ingen datodata.</p>'}</div></div>
      <p class="muted v293-note">Taggene er virtuelle og bygges av dato, filtype, filnavn og eksisterende mappekontekst. Originalfilene endres ikke, og ingen bilder sendes til AI.</p>`;
  }
  function inject(){
    const top=document.getElementById("topControlPanel"); if(top && !document.getElementById("v293Portable")) top.insertAdjacentHTML("afterend",`<section id="v293Portable" class="panel v293-portable"><div class="section-title"><div><span class="eyebrow">PORTABLE SCAN · V2.9.3</span><h3>Ta scannen med deg – og fortsett senere</h3></div><span class="badge safe">RESUME READY</span></div><p class="muted">Eksporter ferdig scan eller aktivt checkpoint til en liten <code>.iansscan</code>-fil. Filen inneholder katalog/metadata – ikke selve dokumentene eller bildene.</p><div class="v293-actions"><button id="v293Export" class="btn primary">Last ned scanfil</button><button id="v293Import" class="btn ghost">Importer scan / checkpoint</button><input id="v293ImportFile" type="file" accept=".iansscan,.json,application/json" hidden><span>Automatisk checkpoint fortsetter også lokalt under lange scanner.</span></div></section>`);
    const mv=document.getElementById("mediaVaultPanel"); if(mv && !document.getElementById("v293PhotoIntel")) mv.insertAdjacentHTML("beforebegin",`<section id="v293PhotoIntel" class="panel v293-photo"><div class="section-title"><div><span class="eyebrow">PHOTO INTELLIGENCE · LOCAL FIRST</span><h3>Organiser bilder uten å miste konteksten</h3></div><span class="badge safe">INGEN AI</span></div><p class="muted">IANS lager virtuelle tagger og samlinger fra metadata og eksisterende mapper. Ett bilde kan høre til flere samlinger uten kopiering eller flytting.</p><div id="v293PhotoBody"><div class="empty-state">Kjør eller importer en scan for Photo Intelligence.</div></div></section>`);
    document.getElementById("v293Export")?.addEventListener("click",exportPortable);
    document.getElementById("v293Import")?.addEventListener("click",pickImport);
    document.getElementById("v293ImportFile")?.addEventListener("change",e=>{const f=e.target.files?.[0];if(f)importPortable(f);e.target.value=""});
    renderPhotoPanel();
  }
  // Re-render Photo Intelligence whenever the base report renderer completes.
  if(typeof renderReport==="function"){
    const baseRender=renderReport; renderReport=function(r){ const out=baseRender(r); setTimeout(renderPhotoPanel,0); return out; };
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",inject); else inject();
  console.info("[IANS] OneDrive Command V2.9.3 Portable Scan + Photo Intelligence aktiv");
})();
// ===== IANS OneDrive Command V2.9.4 · Recovery + Review Fix =====
(() => {
  const V294 = "2.9.4";
  const DB_KEY = "latest-completed";
  const REVIEW_PREFIX = "/_IANS Cleanup Review/";
  const E = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmtN = n => typeof formatNumber === "function" ? formatNumber(n||0) : new Intl.NumberFormat("nb-NO").format(n||0);
  const fmtB = n => typeof formatBytes === "function" ? formatBytes(n||0) : `${Math.round((n||0)/1048576)} MB`;
  const delay = ms => new Promise(r=>setTimeout(r,ms));

  // ---------- Completed Scan Vault ----------
  async function dbGet(key){
    try{
      const db = await scanDbOpen();
      const value = await new Promise((resolve,reject)=>{
        const tx=db.transaction(SCAN_DB_STORE,"readonly");
        const req=tx.objectStore(SCAN_DB_STORE).get(key);
        req.onsuccess=()=>resolve(req.result||null);
        req.onerror=()=>reject(req.error);
      });
      db.close(); return value;
    }catch(e){ console.warn("[IANS V2.9.4] Scan Vault read",e); return null; }
  }
  async function dbPut(key,value){
    try{
      const db = await scanDbOpen();
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(SCAN_DB_STORE,"readwrite");
        tx.objectStore(SCAN_DB_STORE).put(value,key);
        tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error);
      });
      db.close(); return true;
    }catch(e){ console.warn("[IANS V2.9.4] Scan Vault write",e); return false; }
  }

  async function saveCompleted(r){
    if(!r?.files?.length) return false;
    const payload={
      schema:"ians-scan-vault/1",
      version:V294,
      savedAt:new Date().toISOString(),
      account:r.account?.username||activeAccount?.username||"",
      report:r
    };
    const ok=await dbPut(DB_KEY,payload);
    if(ok) updateVaultUi(payload);
    return ok;
  }

  async function restoreCompleted({silent=false,force=false}={}){
    // Silent boot may reuse an already rendered report, but an explicit button click
    // must always reload the persisted vault and render it again.
    if(!force && silent && report?.files?.length) return report;
    const vault=await dbGet(DB_KEY);
    if(!vault?.report?.files?.length){ updateVaultUi(null); return null; }
    const signed=activeAccount?.username||"";
    const source=vault.account||vault.report?.account?.username||"";
    if(signed && source && signed.toLowerCase()!==source.toLowerCase()){
      updateVaultUi(vault);
      if(!silent) alert(`Scan Vault tilhører ${source}, mens du er logget inn som ${signed}.`);
      return null;
    }
    report=vault.report;
    try{
      renderReport(report);
      if(typeof renderPhotoPanel === "function") renderPhotoPanel();
    }catch(e){
      console.warn("[IANS V3.6.1] restore render",e);
      if(!silent) alert(`Scannen ble lest fra Scan Vault, men visningen feilet: ${e.message||e}`);
    }
    const b=E("exportBtn"); if(b)b.disabled=false;
    updateVaultUi(vault);
    if(!silent && typeof iansToast==="function") iansToast("Scan gjenopprettet",`${fmtN(report.files.length)} filer lastet fra Scan Vault.`,"success",7000);
    return report;
  }

  function injectVault(){
    if(E("v294ScanVault")) return;
    const anchor=E("v293Portable") || E("topControlPanel");
    if(!anchor) return;
    const box=document.createElement("section");
    box.id="v294ScanVault";
    box.className="panel";
    box.style.cssText="margin-top:12px;border-color:rgba(74,222,128,.28)";
    box.innerHTML=`<div class="section-title"><div><span class="eyebrow">SCAN VAULT · V2.9.4</span><h3>Ferdig scan lagres automatisk</h3></div><span class="badge safe" id="v294VaultBadge">KONTROLLERER</span></div>
      <p class="muted">Siste fullførte eller importerte rapport beholdes i IndexedDB selv om fanen lukkes. Checkpoint og ferdig scan er to separate lagringer.</p>
      <div class="actions"><button class="btn ghost" id="v294Restore">Gjenopprett siste scan</button><button class="btn ghost" id="v294SaveNow">Lagre + last ned .iansscan</button></div>
      <div id="v294VaultStatus" class="empty-state" style="margin-top:10px">Kontrollerer lokal Scan Vault…</div>`;
    anchor.insertAdjacentElement("afterend",box);
    const restoreBtn=E("v294Restore"), saveBtn=E("v294SaveNow");
    restoreBtn.onclick=async()=>{
      const original=restoreBtn.textContent;
      restoreBtn.disabled=true; restoreBtn.textContent="Gjenoppretter…";
      const st=E("v294VaultStatus"); if(st) st.insertAdjacentHTML("beforeend",'<br><span class="muted" id="v361VaultWork">Laster rapport fra IndexedDB…</span>');
      try{
        const r=await restoreCompleted({silent:false,force:true});
        if(!r) throw new Error("Ingen tilgjengelig rapport kunne gjenopprettes.");
      }catch(err){
        console.error("[IANS V3.6.1] Restore button",err);
        alert(`Gjenoppretting feilet: ${err.message||err}`);
      }finally{
        E("v361VaultWork")?.remove(); restoreBtn.disabled=false; restoreBtn.textContent=original;
      }
    };
    saveBtn.onclick=async()=>{
      const original=saveBtn.textContent;
      saveBtn.disabled=true; saveBtn.textContent="Eksporterer…";
      try{
        // If the live report is not present, recover it from the vault first.
        if(!report?.files?.length) await restoreCompleted({silent:true,force:true});
        if(!report?.files?.length) throw new Error("Ingen ferdig scan er tilgjengelig.");
        const ok=await saveCompleted(report);
        if(!ok) throw new Error("Kunne ikke skrive rapporten til IndexedDB.");
        if(typeof window.IANS_exportPortableScan !== "function") throw new Error("Eksportmotoren er ikke lastet.");
        await window.IANS_exportPortableScan();
        if(typeof iansToast==="function") iansToast("Scan lagret + eksport startet","Scan Vault er oppdatert og .iansscan sendes til Nedlastinger.","success",6500);
      }catch(err){
        console.error("[IANS V3.6.1] Export button",err);
        alert(`Eksport feilet: ${err.message||err}`);
      }finally{
        saveBtn.disabled=false; saveBtn.textContent=original;
      }
    };
    dbGet(DB_KEY).then(updateVaultUi);
  }

  function updateVaultUi(vault){
    const st=E("v294VaultStatus"),badge=E("v294VaultBadge");
    if(!st||!badge)return;
    if(!vault?.report?.files?.length){
      badge.textContent="TOM";
      st.textContent="Ingen ferdig scan lagret lokalt ennå.";
      return;
    }
    badge.textContent="LAGRET";
    const r=vault.report;
    st.innerHTML=`<strong>${fmtN(r.summary?.files||r.files.length)} filer · ${fmtB(r.summary?.fileBytes||r.files.reduce((s,f)=>s+(+f.size||0),0))}</strong><br><span class="muted">${esc(r.scanRoot?.path||"/")} · lagret ${new Date(vault.savedAt).toLocaleString("nb-NO")}</span>`;
  }

  // Save every report that is rendered (new full scan and imported .iansscan included).
  if(typeof renderReport === "function"){
    const baseRender294=renderReport;
    renderReport=function(r){
      const out=baseRender294(r);
      if(r?.files?.length) setTimeout(()=>saveCompleted(r),0);
      return out;
    };
  }

  // Restore after login/dashboard becomes visible.
  if(typeof showDashboard === "function"){
    const baseShowDashboard294=showDashboard;
    showDashboard=function(...args){
      const out=baseShowDashboard294(...args);
      setTimeout(()=>restoreCompleted({silent:true}),250);
      return out;
    };
  }

  // ---------- Organization Studio Fix ----------
  // V2.8.5 hard-excluded every file under /_IANS Cleanup Review/. That made a scan
  // of the review folder produce a 0-file plan. V2.9.4 deliberately allows review files.
  let org294=[];

  function cleanRoot(v){
    let root=(v||"/_IANS Organisert").trim();
    if(!root.startsWith("/")) root="/"+root;
    root=root.replace(/\/+$/g,"");
    return root||"/_IANS Organisert";
  }
  function yearOf(f){
    const raw=(f.category==="Bilder"||f.category==="Video") ? (f.takenDateTime||f.createdDateTime||f.lastModifiedDateTime) : (f.createdDateTime||f.lastModifiedDateTime);
    const d=raw?new Date(raw):null;
    return d&&Number.isFinite(d.getTime()) ? String(d.getFullYear()) : "Uten dato";
  }
  function monthOf(f){
    const raw=f.takenDateTime||f.createdDateTime||f.lastModifiedDateTime;
    const d=raw?new Date(raw):null;
    if(!d||!Number.isFinite(d.getTime())) return "Uten dato";
    return String(d.getMonth()+1).padStart(2,"0");
  }
  function target294(f,root){
    const cat=String(f.category||"Annet");
    if(cat==="Bilder"||cat==="Video") return `${root}/${cat}/${yearOf(f)}/${monthOf(f)}`;
    return `${root}/${cat}/${yearOf(f)}`;
  }
  function renderOrg294(){
    const stats=E("v285OrgStats"),preview=E("v285OrgPreview"),exec=E("v285OrgExecute");
    if(!stats||!preview||!exec)return;
    const conflicts=org294.filter(x=>x.conflict).length;
    const folders=new Set(org294.map(x=>x.target)).size;
    const bytes=org294.reduce((s,x)=>s+(+x.file.size||0),0);
    stats.innerHTML=`<div><span>Filer i plan</span><strong>${fmtN(org294.length)}</strong></div><div><span>Målmapper</span><strong>${fmtN(folders)}</strong></div><div><span>Datamengde</span><strong>${fmtB(bytes)}</strong></div><div><span>Navnekonflikter</span><strong>${fmtN(conflicts)}</strong></div>`;
    preview.innerHTML=org294.slice(0,100).map(x=>`<div class="${x.conflict?"conflict":""}"><strong>${esc(x.file.name)}</strong><span>${esc(x.file.path)} → ${esc(x.target)}/</span>${x.conflict?'<em>Hoppes over: mulig navnekonflikt</em>':""}</div>`).join("")||'<div class="empty-state">Ingen filer matcher valgte kategorier.</div>';
    exec.disabled=!org294.some(x=>!x.conflict);
  }
  function buildOrg294(){
    if(!report?.files?.length){
      restoreCompleted({silent:true}).then(r=>{ if(r) buildOrg294(); else alert("Ingen scan tilgjengelig. Importer .iansscan eller kjør kartlegging."); });
      return;
    }
    const root=cleanRoot(E("v285OrgRoot")?.value);
    const cats=new Set([...document.querySelectorAll("[data-v285-org-cat]:checked")].map(x=>x.value));
    const seen=new Set(); org294=[];
    for(const f of report.files){
      const p=String(f.path||"");
      // Only skip files already under the destination tree. Do NOT skip Cleanup Review.
      if(p===root || p.startsWith(root+"/") || !cats.has(f.category)) continue;
      const target=target294(f,root);
      const key=`${target.toLowerCase()}|${String(f.name||"").toLowerCase()}`;
      const conflict=seen.has(key); seen.add(key);
      org294.push({file:f,target,conflict});
    }
    renderOrg294();
    if(typeof iansToast==="function") iansToast("Organisasjonsforslag bygget",`${fmtN(org294.length)} filer i preview. Ingen filer er flyttet ennå.`,"success",6500);
  }
  async function executeOrg294(){
    const safe=org294.filter(x=>!x.conflict);
    if(!safe.length) return;
    if(typeof v24Enabled==="undefined" || !v24Enabled){ alert("Aktiver Action Mode først."); return; }
    const phrase=`FLYTT ${safe.length} FILER`;
    const ok=prompt(`Organization Studio vil flytte ${safe.length} filer.\n\nSkriv nøyaktig: ${phrase}`)===phrase;
    if(!ok)return;
    let moved=0,failed=0;
    for(let i=0;i<safe.length;i++){
      const x=safe[i],f=x.file;
      try{
        const id=await v24EnsureFolder(x.target);
        const old=f.path;
        await v24Graph(`/me/drive/items/${encodeURIComponent(f.id)}`,{method:"PATCH",body:{parentReference:{id}}});
        f.parentPath=x.target; f.path=`${x.target}/${f.name}`;
        if(typeof v24Log==="function")v24Log("Organization Studio",old,true,`Flyttet til ${x.target}`);
        moved++;
      }catch(err){
        if(typeof v24Log==="function")v24Log("Organization Studio",f.path,false,err.message);
        failed++;
      }
      if(i%10===0) await delay(0);
    }
    org294=[]; renderOrg294();
    try{renderReport(report);}catch{}
    await saveCompleted(report);
    if(typeof v24RenderLog==="function")v24RenderLog();
    if(typeof iansToast==="function")iansToast("Organization Studio ferdig",`${fmtN(moved)} flyttet · ${fmtN(failed)} feil.`,failed?"error":"success",9000);
  }

  document.addEventListener("click",e=>{
    const b=e.target.closest("#v285OrgBuild,#v285OrgExecute");
    if(!b)return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    if(b.id==="v285OrgBuild") buildOrg294(); else executeOrg294();
  },true);

  // ---------- Review Duplicate Cleaner ----------
  function dupGroups294(){
    if(!report?.files?.length)return [];
    const map=new Map();
    for(const f of report.files){
      const key=`${String(f.name||"").toLowerCase()}|${Number(f.size)||0}`;
      if(!map.has(key))map.set(key,[]);
      map.get(key).push(f);
    }
    return [...map.values()].filter(g=>g.length>1 && Number(g[0].size)>0).sort((a,b)=>((b.length-1)*b[0].size)-((a.length-1)*a[0].size));
  }

  function injectReviewCleaner(){
    if(E("v294ReviewCleaner"))return;
    const anchor=E("v285OrganizationStudio") || E("v293PhotoIntel") || E("dashboard")?.lastElementChild;
    if(!anchor)return;
    const p=document.createElement("section");
    p.id="v294ReviewCleaner"; p.className="panel";
    p.innerHTML=`<div class="section-title"><div><span class="eyebrow">DUPLICATE REVIEW · V2.9.4</span><h3>Rydd duplikater også inne i Cleanup Review</h3></div><span class="badge safe">MANUELL PREVIEW</span></div>
      <p class="muted">V2.9.2 klassifiserte filer under <code>/_IANS Cleanup Review/</code> som «allerede i review» og ga derfor 0 nye kandidater. Her kan du gjennomgå disse gruppene. Match er fortsatt filnavn + størrelse, ikke kryptografisk hash.</p>
      <div class="actions"><button class="btn primary" id="v294DupBuild">Vis duplikatgrupper</button><button class="btn danger" id="v294DupTrash" disabled>Send valgte til papirkurv</button></div>
      <div id="v294DupStats" class="empty-state" style="margin-top:10px">Ingen review bygget ennå.</div>
      <div id="v294DupList" style="max-height:520px;overflow:auto;margin-top:10px"></div>`;
    anchor.insertAdjacentElement("afterend",p);
    E("v294DupBuild").onclick=renderDupCleaner;
    E("v294DupTrash").onclick=trashDupSelection;
  }

  function renderDupCleaner(){
    const groups=dupGroups294();
    const list=E("v294DupList"),stats=E("v294DupStats"),trash=E("v294DupTrash");
    if(!list||!stats||!trash)return;
    const savings=groups.reduce((s,g)=>s+(g.length-1)*(+g[0].size||0),0);
    stats.innerHTML=`<strong>${fmtN(groups.length)} grupper · opptil ${fmtB(savings)} mulig plass</strong><br><span class="muted">Minst én kopi per gruppe er låst som «behold».</span>`;
    list.innerHTML=groups.slice(0,100).map((g,gi)=>{
      const rows=g.map((f,i)=>`<label style="display:flex;gap:10px;align-items:flex-start;padding:7px 4px;border-top:1px solid rgba(255,255,255,.06)"><input type="checkbox" data-v294-dup-id="${esc(f.id)}" data-v294-group="${gi}" ${i===0?"disabled":""}><span><b>${i===0?"BEHOLD":"Kandidat"}</b> · ${esc(f.path)}</span></label>`).join("");
      return `<div style="padding:10px;margin:8px 0;border:1px solid rgba(100,180,255,.16);border-radius:12px"><strong>${esc(g[0].name)}</strong> · ${fmtN(g.length)} kopier · ${fmtB(g[0].size)} per fil${rows}</div>`;
    }).join("")||'<div class="empty-state">Ingen grupper med samme filnavn og størrelse.</div>';
    list.onchange=()=>{ trash.disabled=!list.querySelector("[data-v294-dup-id]:checked"); };
    trash.disabled=true;
  }

  async function trashDupSelection(){
    const ids=[...document.querySelectorAll("[data-v294-dup-id]:checked")].map(x=>x.dataset.v294DupId);
    if(!ids.length)return;
    if(typeof v24Enabled==="undefined" || !v24Enabled){alert("Aktiver Action Mode først.");return;}
    const rows=report.files.filter(f=>ids.includes(f.id));
    const phrase=`SLETT ${rows.length} FILER`;
    if(prompt(`Valgte filer sendes til OneDrive-papirkurven.\nPermanent sletting brukes ikke.\n\nSkriv nøyaktig: ${phrase}`)!==phrase)return;
    let ok=0,fail=0;
    for(const f of rows){
      try{
        await v24Graph(`/me/drive/items/${encodeURIComponent(f.id)}`,{method:"DELETE"});
        report.files=report.files.filter(x=>x.id!==f.id);
        if(typeof v24Log==="function")v24Log("Duplicate Review",f.path,true,"Sendt til OneDrive-papirkurven");
        ok++;
      }catch(err){
        if(typeof v24Log==="function")v24Log("Duplicate Review",f.path,false,err.message);
        fail++;
      }
    }
    try{renderReport(report);}catch{}
    await saveCompleted(report);
    renderDupCleaner();
    if(typeof v24RenderLog==="function")v24RenderLog();
    if(typeof iansToast==="function")iansToast("Duplicate Review ferdig",`${fmtN(ok)} sendt til papirkurv · ${fmtN(fail)} feil.`,fail?"error":"success",9000);
  }

  // ---------- Sleep / long scan protection ----------
  let wakeLock294=null;
  async function requestWake294(){
    try{
      if("wakeLock" in navigator && !wakeLock294){
        wakeLock294=await navigator.wakeLock.request("screen");
        wakeLock294.addEventListener("release",()=>{wakeLock294=null;});
        if(typeof iansToast==="function")iansToast("Mac/PC holdes våken","Skjerm-wake-lock er aktiv mens kartleggingen kjører. Lukker du Mac-lokket kan macOS fortsatt gå i dvale.","success",8000);
      }
    }catch(e){ console.warn("[IANS V2.9.4] wake lock",e); }
  }
  async function releaseWake294(){ try{await wakeLock294?.release();}catch{} wakeLock294=null; }
  document.addEventListener("click",e=>{
    if(e.target.closest("#scanBtn,#resumeScanBtn")) requestWake294();
  },true);
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="visible" && /SKANN|KART/i.test(E("scanStateBadge")?.textContent||"")) requestWake294();
  });
  const scanBadge=E("scanStateBadge");
  if(scanBadge){
    new MutationObserver(()=>{
      const t=scanBadge.textContent||"";
      if(/FERDIG|PAUSET|CHECKPOINT|IMPORTERT/i.test(t)) releaseWake294();
    }).observe(scanBadge,{childList:true,subtree:true,characterData:true});
  }

  // ---------- Version/UI boot ----------
  function version294(){
    document.querySelectorAll("body *").forEach(el=>{
      if(el.children.length===0 && /V2\.9\.3/.test(el.textContent||"")) el.textContent=(el.textContent||"").replace(/V2\.9\.3/g,"V2.9.4");
    });
    console.info("[IANS] OneDrive Command V2.9.4 Recovery + Review Fix aktiv");
  }
  function boot294(){
    version294(); injectVault(); injectReviewCleaner();
    setTimeout(()=>{injectVault();injectReviewCleaner();restoreCompleted({silent:true});},500);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot294);else boot294();
})();
// ===== END IANS OneDrive Command V2.9.4 =====
// ===== IANS OneDrive Command V3.0 · Focus Workspace =====
(() => {
  "use strict";

  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>[...r.querySelectorAll(s)];
  const norm=s=>String(s||"").replace(/\s+/g," ").trim().toLowerCase();

  const state = {
    focus: localStorage.getItem("ians.v30.focus") || "scan",
    sub: localStorage.getItem("ians.v30.sub") || "duplicates"
  };

  function panelByText(rx){
    const heads=qa("h1,h2,h3,h4,.eyebrow,.section-title,strong");
    const h=heads.find(x=>rx.test(norm(x.textContent)));
    if(!h)return null;
    let p=h;
    for(let i=0;i<9&&p;i++,p=p.parentElement){
      if(p.matches?.("section,article,.panel,.card,.module,.tool-section,.command-section")) return p;
    }
    return h.closest("div");
  }

  function cleanNode(el){
    if(!el)return;
    el.classList.remove(
      "ians-dash-hidden","hidden","v298-no-value","ians-v297-embedded",
      "ians-v297-filter-panel","ians-v297-list-panel","ians-v297-action-panel"
    );
    el.removeAttribute("data-ians-dash-group");
    el.style.display="";
    el.style.maxWidth="";
    el.style.width="";
  }

  function moveInto(el,slot){
    if(!el||!slot)return false;
    cleanNode(el);
    slot.appendChild(el);
    return true;
  }

  function clickExisting(rx){
    const hit=qa("button,a").find(el=>rx.test(norm(el.textContent)) && !el.disabled && el.offsetParent!==null);
    if(hit){hit.click();return true}
    const any=qa("button,a").find(el=>rx.test(norm(el.textContent)) && !el.disabled);
    if(any){any.click();return true}
    return false;
  }

  function statText(){
    const body=norm(document.body.innerText);
    const files=(body.match(/(?:antall filer|filer funnet|filer)\s*[:\-]?\s*([\d\s.]+)/i)||[])[1];
    const size=(body.match(/([\d.,]+)\s*(tb|gb)\b/i)||[]);
    return {
      files: files ? files.replace(/\s/g,"") : "—",
      size: size.length ? `${size[1]} ${size[2].toUpperCase()}` : "—"
    };
  }

  function buildShell(){
    if(q("#iansV30"))return;

    // Hide legacy navigation layers, but not their underlying functional panels.
    qa("#iansCommandDashboard,#iansCleanupWorkbench,#iansV298Toolbox").forEach(x=>x.style.display="none");

    const shell=document.createElement("section");
    shell.id="iansV30";
    shell.innerHTML=`
      <div class="v30-hero">
        <div>
          <span class="v30-kicker">IANS · ONEDRIVE COMMAND V3.12.1</span>
          <h1>Forstå OneDrive. Finn rotet. Rydd trygt.</h1>
          <p>Én arbeidsflate. Velg oppgaven – alle verktøyene for jobben åpnes her.</p>
        </div>
        <div class="v3101-hero-controls">
          <div class="v30-mode" id="v30Mode">READ ONLY</div>
          <button type="button" id="v311SystemStatus" class="v311-system-chip">● Graph · Read Only · Lokal mappe: –</button>
          <button type="button" id="v30ActionMode" class="v3101-action-btn">Aktiver Action Mode</button>
        </div>
      </div>

      <div class="v30-status">
        <div><small>Tilkobling</small><strong id="v30Connect">Microsoft Graph</strong></div>
        <div><small>Kartlagt</small><strong id="v30Size">—</strong></div>
        <div><small>Filer</small><strong id="v30Files">—</strong></div>
        <div><small>Scan Vault</small><strong id="v30Vault">Klar</strong></div>
        <button type="button" id="v30Settings">Innstillinger</button>
      </div>

      <div class="v30-scanbar">
        <div class="v30-scan-copy">
          <span class="v30-step">1</span>
          <div><strong>Kartlegg OneDrive</strong><small>Start her eller bruk en eksisterende scan.</small></div>
        </div>
        <div class="v30-scan-actions">
          <button data-scan="quick">Hurtigscan</button>
          <button data-scan="full">Full scan</button>
          <button data-scan="resume">Fortsett</button>
          <button data-scan="import">Importer .iansscan</button>
          <button data-scan="export">Last ned .iansscan</button>
          <button data-focus="scan">Scan Vault</button>
        </div>
      </div>

      <div class="v30-question">
        <div><span class="v30-step">2</span><div><strong>Hva vil du gjøre?</strong><small>Velg ett fokusområde. Ingen mellomside.</small></div></div>
      </div>

      <div class="v30-focus-grid">
        <button data-focus="analyze">
          <span class="v30-icon">◇</span>
          <strong>Finn & analyser</strong>
          <small>Store filer, media, lagring og mønstre.</small>
        </button>
        <button data-focus="cleanup">
          <span class="v30-icon">♻</span>
          <strong>Rydd & organiser</strong>
          <small>Duplikater, Cleanup Review og organisering.</small>
        </button>
        <button data-focus="backup">
          <span class="v30-icon">⇩</span>
          <strong>Backup & Verify</strong>
          <small>Last ned trygt med Resume og Verify.</small>
        </button>
        <button data-focus="scan">
          <span class="v30-icon">◎</span>
          <strong>Scan & Vault</strong>
          <small>Scan, checkpoint, import og gjenoppretting.</small>
        </button>
      </div>

      <div class="v30-workspace">
        <div class="v30-work-head">
          <div>
            <span class="v30-kicker" id="v30WorkKicker">FOKUSOMRÅDE</span>
            <h2 id="v30WorkTitle">Scan & Vault</h2>
            <p id="v30WorkText">Kartlegg og gjenopprett uten å forlate arbeidsflaten.</p>
          </div>
          <div id="v30ContextActions" class="v30-context-actions"></div>
        </div>

        <div class="v30-subnav" id="v30Subnav"></div>
        <div class="v30-content" id="v30Content"></div>
      </div>
    `;

    const anchor=q("main")||document.body;
    anchor.prepend(shell);

    qa("[data-focus]",shell).forEach(b=>b.addEventListener("click",()=>showFocus(b.dataset.focus)));
    qa("[data-scan]",shell).forEach(b=>b.addEventListener("click",()=>runScanAction(b.dataset.scan)));
    q("#v30Settings",shell).onclick=()=>clickExisting(/innstillinger|settings/);
    q("#v311SystemStatus",shell).onclick=()=>showFocus("backup");
    q("#v30ActionMode",shell).onclick=()=>{
      const target=q("#topActionBtn") || q("#v24EnableAction") || q("#v310DockAction");
      target?.click();
      setTimeout(syncV3101Mode,120);
    };

    function syncV3101Mode(){
      const mode=q("#v30Mode",shell), btn=q("#v30ActionMode",shell);
      if(!mode||!btn)return;
      const legacy=q("#topModeBadge");
      const txt=(legacy?.textContent||"").toUpperCase();
      const on=(typeof v24Enabled!=="undefined" && v24Enabled) || txt.includes("ACTION");
      mode.textContent=on?"ACTION MODE":"READ ONLY";
      mode.classList.toggle("active",on);
      btn.textContent=on?"Action Mode aktiv":"Aktiver Action Mode";
      btn.classList.toggle("active",on);
    }
    syncV3101Mode();
    setInterval(syncV3101Mode,800);
    const syncSystem=()=>{const c=q("#v311SystemStatus",shell);if(!c)return;const online=navigator.onLine?"Online":"Offline";const local=(typeof dlDirectoryHandle!=="undefined"&&dlDirectoryHandle)?"Lokal valgt":"Lokal: –";const mode=(typeof v24Enabled!=="undefined"&&v24Enabled)?"Action":"Read Only";c.textContent=`● Graph · ${mode} · ${local} · ${online}`;};syncSystem();setInterval(syncSystem,1200);

    const st=statText();
    q("#v30Files").textContent=st.files;
    q("#v30Size").textContent=st.size;

    showFocus(state.focus);
  }

  async function quickScanV313(){
    iansEnsureScanDiagnostics();
    iansScanStage("READY","Hurtigscan starter · rotnivå");
    showFocus("scan");
    try{
      const children=await listAllChildren(null);
      const files=children.filter(x=>x.file).length;
      const folders=children.filter(x=>x.folder).length;
      const bytes=children.reduce((s,x)=>s+(x.file?Number(x.size||0):0),0);
      iansScanStage("COMPLETE",`Hurtigscan OK · ${files} filer · ${folders} mapper`);
      updateScanMeter?.(100,`Hurtigscan ferdig · ${files} filer · ${folders} mapper`);
      iansToast?.("Hurtigscan ferdig",`${files} filer · ${folders} mapper på rotnivå · ${formatBytes(bytes)}`,"success",7000);
      return {files,folders,bytes,children};
    }catch(err){
      iansScanStage("AUTH",`STOPP · ${String(err?.message||err)}`);
      iansToast?.("Hurtigscan feilet",String(err?.message||err),"error",9000);
      throw err;
    }
  }

  async function runScanAction(action){
    if(action==="full"){
      iansEnsureScanDiagnostics();
      iansScanStage("READY","Full scan starter direkte");
      showFocus("scan");
      try{ await scanOneDrive(); }
      catch(err){ console.error("[IANS V3.13] full scan",err); }
      return;
    }
    if(action==="resume"){
      iansEnsureScanDiagnostics();
      showFocus("scan");
      const cp=await loadScanCheckpoint();
      if(!cp){iansScanStage("CHECKPOINT","ingen checkpoint å fortsette");iansToast?.("Ingen checkpoint","Det finnes ingen lagret scan å fortsette.","error",5000);return;}
      iansScanStage("CHECKPOINT","Resume starter direkte");
      try{ await scanOneDrive(cp); }
      catch(err){ console.error("[IANS V3.13] resume",err); }
      return;
    }
    if(action==="quick"){
      await quickScanV313();
      return;
    }
    const direct={import:"importScanBtn",export:"exportScanBtn"};
    const id=direct[action],el=id&&document.getElementById(id);
    if(el && !el.disabled){el.click();return;}
    const map={import:/importer scan|importer.*iansscan/,export:/last ned scanfil|eksporter scan|last ned.*iansscan/};
    if(map[action] && clickExisting(map[action])) return;
    showFocus("scan");
  }

  const focusMeta={
    scan:{
      title:"Scan & Vault",
      text:"Kartlegg, importer, eksporter og gjenopprett scan på ett sted.",
      subs:[
        ["scan","Kartlegging"],
        ["vault","Scan Vault"]
      ]
    },
    analyze:{
      title:"Finn & analyser",
      text:"Se hva som bruker plass og finn det som er verdt å undersøke.",
      subs:[
        ["storage","Lagring"],
        ["large","Store filer"],
        ["media","Media"]
      ]
    },
    cleanup:{
      title:"Rydd & organiser",
      text:"Hele ryddejobben fra kandidat til kontrollert handling.",
      subs:[
        ["duplicates","Duplikater"],
        ["review","Cleanup Review"],
        ["organize","Organiser"],
        ["emptyfolders","Tomme mapper"]
      ]
    },
    backup:{
      title:"Backup & Verify",
      text:"Last ned valgte mapper sikkert med Resume, retry og verifisering.",
      subs:[
        ["download","Download & Verify"]
      ]
    }
  };

  function showFocus(name){
    if(!focusMeta[name])name="scan";
    state.focus=name;
    localStorage.setItem("ians.v30.focus",name);

    qa("#iansV30 [data-focus]").forEach(b=>b.classList.toggle("active",b.dataset.focus===name));
    const m=focusMeta[name];
    q("#v30WorkTitle").textContent=m.title;
    q("#v30WorkText").textContent=m.text;
    q("#v30WorkKicker").textContent="FOKUSOMRÅDE";
    const sub=q("#v30Subnav");
    sub.innerHTML=m.subs.map(([id,label])=>`<button data-sub="${id}">${label}</button>`).join("");
    qa("[data-sub]",sub).forEach(b=>b.onclick=()=>showSub(name,b.dataset.sub));

    let preferred=state.sub;
    if(!m.subs.some(x=>x[0]===preferred))preferred=m.subs[0][0];
    showSub(name,preferred);
  }

  function showSub(focus,subid){
    state.sub=subid;
    localStorage.setItem("ians.v30.sub",subid);
    qa("#v30Subnav [data-sub]").forEach(b=>b.classList.toggle("active",b.dataset.sub===subid));

    const content=q("#v30Content");
    content.innerHTML="";
    q("#v30ContextActions").innerHTML="";

    if(subid==="emptyfolders") ensureV311EmptyFolders();
    const panel=findFunctionalPanel(subid);
    if(panel){
      moveInto(panel,content);
      panel.classList.add("v30-mounted");
    }else{
      content.innerHTML=`<div class="v30-empty"><strong>Ingen aktiv modul funnet.</strong><span>Denne funksjonen skjules til motoren har et faktisk verktøy eller data å vise.</span></div>`;
    }

    buildContextActions(focus,subid);
  }

  function findFunctionalPanel(id){
    const candidates={
      scan:()=> q("#v293Portable") || panelByText(/ta scannen med deg|portable scan|kartlegging/),
      vault:()=> q("#v294ScanVault") || panelByText(/scan vault|recovery|checkpoint/),
      storage:()=> q("#storageMapPanel") || panelByText(/storage map|største områder|filtyper/),
      large:()=> q("#largeFilePanel") || panelByText(/large file|største filer|topp 25/),
      media:()=> q("#v293PhotoPanel") || panelByText(/photo intelligence|media vault|organiser bilder/),
      duplicates:()=> q("#v294ReviewCleaner") || q("#v295DupList") || panelByText(/duplicate review|rydd duplikater|duplikatgrupper/),
      review:()=> panelByText(/finn, filtrer og planlegg|cleanup command center|cleanup review/),
      organize:()=> q("#v285OrgPanel") || panelByText(/organization studio|plan.*preview.*action mode/),
      download:()=> q("#downloadVerifyPanel") || panelByText(/download\s*&\s*verify|resume.*verify|direkte strømming/),
      emptyfolders:()=> q("#v311EmptyFolders")
    };
    const fn=candidates[id];
    return fn?fn():null;
  }

  function buildContextActions(focus,subid){
    const host=q("#v30ContextActions");
    const add=(label,cls,fn)=>{
      const b=document.createElement("button");
      b.textContent=label;
      if(cls)b.className=cls;
      b.onclick=fn;
      host.appendChild(b);
    };

    if(subid==="duplicates"){
      add("Bygg grupper","",()=>clickExisting(/vis duplikatgrupper|bygg duplikatgrupper/));
      add("Merk ekstrakopier","",()=>clickExisting(/merk alle ekstrakopier|merk alle foreslåtte/));
      add("Papirkurv valgte","danger",()=>clickExisting(/send valgte til papirkurv|papirkurv valgte/));
    }
    if(subid==="organize"){
      add("Bygg forslag","",()=>clickExisting(/bygg forslag/));
      add("Utfør plan","warn",()=>clickExisting(/utfør plan/));
      add("Aktiver Action Mode","",()=>clickExisting(/aktiver action mode/));
    }
    if(subid==="download"){
      add("Start nedlasting","",()=>clickExisting(/start nedlasting|last ned valgt/));
      add("Resume","",()=>clickExisting(/resume|fortsett/));
    }
    if(subid==="scan"){
      add("Hurtigscan","",()=>runScanAction("quick"));
      add("Full scan","",()=>runScanAction("full"));
    }
  }

  function ensureV311EmptyFolders(){
    let p=q("#v311EmptyFolders"); if(p){renderV311EmptyFolders();return p;}
    p=document.createElement("section");p.id="v311EmptyFolders";p.className="panel v311-empty-folders";
    (q("#dashboard")||document.body).appendChild(p); renderV311EmptyFolders(); return p;
  }
  function renderV311EmptyFolders(){
    const p=q("#v311EmptyFolders");if(!p)return;
    const rows=(report?.emptyFolders||[]).slice().sort((a,b)=>b.path.split("/").length-a.path.split("/").length);
    const body=rows.slice(0,300).map((f,i)=>`<tr><td><input type="checkbox" data-v311-empty="${i}" checked></td><td class="path">${escapeHtml(f.path)}</td><td>${f.lastModifiedDateTime?new Date(f.lastModifiedDateTime).toISOString().slice(0,10):"–"}</td><td><button class="btn mini danger" data-v311-empty-one="${i}">Papirkurv</button></td></tr>`).join("");
    p.innerHTML=`<div class="section-title"><div><span class="eyebrow">EMPTY FOLDER CLEANUP · V3.11.1</span><h3>Fjern tomme mapper</h3></div><span class="badge safe">PREVIEW FIRST</span></div>
      <p class="muted">Viser mapper som var direkte tomme da skanningen leste dem. IANS sender dem til OneDrive-papirkurven – aldri permanent sletting.</p>
      <div class="v311-empty-summary"><strong>${formatNumber(rows.length)}</strong><span>tomme mapper funnet</span><button id="v311EmptySelectAll" class="btn ghost">Merk alle</button><button id="v311EmptyTrashSelected" class="btn danger" ${rows.length?"":"disabled"}>Papirkurv valgte</button></div>
      <div class="table-wrap"><table><thead><tr><th>Velg</th><th>Mappe</th><th>Sist endret</th><th>Handling</th></tr></thead><tbody>${body||'<tr><td colspan="4">Ingen tomme mapper i denne skanningen.</td></tr>'}</tbody></table></div>
      <p class="v311-note">Tips: mapper som bare inneholder andre tomme mapper blir kandidater i neste scan etter at de innerste mappene er fjernet.</p>`;
    q("#v311EmptySelectAll",p)?.addEventListener("click",()=>qa("[data-v311-empty]",p).forEach(x=>x.checked=true));
    qa("[data-v311-empty-one]",p).forEach(b=>b.onclick=()=>trashEmptyFolders([rows[+b.dataset.v311EmptyOne]]));
    q("#v311EmptyTrashSelected",p)?.addEventListener("click",()=>{const sel=qa("[data-v311-empty]:checked",p).map(x=>rows[+x.dataset.v311Empty]);trashEmptyFolders(sel)});
  }
  async function trashEmptyFolders(items){
    items=(items||[]).filter(Boolean);if(!items.length)return;
    if(typeof v24Enabled!=="undefined"&&!v24Enabled){iansToast("Action Mode kreves","Aktiver Action Mode før tomme mapper sendes til papirkurven.","error",7000);return;}
    const ok=confirm(`Send ${items.length} tomme mapper til OneDrive-papirkurven?\n\nDette er ikke permanent sletting.`);if(!ok)return;
    let done=0,failed=0;
    for(const f of items){try{const base=f.driveId?`/drives/${encodeURIComponent(f.driveId)}/items/${encodeURIComponent(f.id)}`:`/me/drive/items/${encodeURIComponent(f.id)}`;await v24Graph(base,{method:"DELETE"});done++;if(report?.emptyFolders)report.emptyFolders=report.emptyFolders.filter(x=>x.id!==f.id)}catch(e){failed++;console.error("Empty folder trash failed",f.path,e)}}
    renderV311EmptyFolders();iansToast("Tomme mapper",`${done} sendt til papirkurven · ${failed} feil`,failed?"error":"success",9000);
  }

  function removeNoise(){
    // Remove only navigation/decorative layers created by V2.9.6–V2.9.8.
    qa("#iansCommandDashboard,#iansCleanupWorkbench,#iansV298Toolbox,#v286CommandCenter,#v287CommandCenter,#v289ReferenceShell,#v285SystemHealth").forEach(x=>x.remove());

    // Hide empty passive blocks. Functional blocks will be moved into V3 when selected.
    qa("section,article,.panel,.card").forEach(el=>{
      const t=norm(el.innerText);
      const controls=qa("button:not([disabled]),a[href],input:not([disabled]),select:not([disabled])",el).length;
      const clearlyEmpty=/ingen data|ingen handlinger utført|ingen plan ennå|ingen .* funnet/.test(t);
      if(clearlyEmpty && controls===0)el.classList.add("v30-passive-empty");
    });
  }

  function init(){
    document.body.classList.add("ians-v30");
    removeNoise();
    buildShell();
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(init,350));
  else setTimeout(init,350);
})();
 // ===== END IANS OneDrive Command V3.0 =====

/* IANS V3.6 Stable Recovery: V3.3 auth baseline + Scan Vault physical export */


// ===== IANS OneDrive Command V3.9 · SAFETY OPS =====
(() => {
  const E=id=>document.getElementById(id);
  const esc=s=>escapeHtml(String(s??""));
  const fmtN=n=>typeof formatNumber==="function"?formatNumber(n||0):new Intl.NumberFormat("nb-NO").format(n||0);
  const fmtB=n=>typeof formatBytes==="function"?formatBytes(n||0):`${Math.round((n||0)/1048576)} MB`;

  function currentScanBytes(){
    const t=(E("scannedBytesLive")?.textContent||"").trim();
    return t||"0 B";
  }
  function refreshLiveOps(){
    const head=E("v39LiveHeadline"),detail=E("v39LiveDetail"),files=E("v39LiveFiles"),bytes=E("v39LiveBytes"),job=E("v39LiveJob");
    if(!head)return;
    if(files)files.textContent=report?.files?.length?fmtN(report.files.length):((E("fileCount")?.textContent||"–").trim());
    if(bytes)bytes.textContent=report?.summary?.fileBytes?fmtB(report.summary.fileBytes):currentScanBytes();
    if(scanRunningV38){
      const pct=(E("scanJobPct")?.textContent||"…").trim();
      const path=(E("activeFolderLive")?.textContent||"/").trim();
      head.textContent=`Kartlegging pågår · ${pct}`; detail.textContent=`Aktiv mappe: ${path}`; if(job)job.textContent="SCAN"; return;
    }
    if(v362QJob && ["prepared","running","paused","failed","verifying"].includes(v362QJob.status)){
      const done=v362QDoneCount(v362QJob), total=v362QJob.items?.length||0;
      const labels={prepared:"klar",running:"kjører",paused:"pauset",failed:"feil / resume",verifying:"verify"};
      head.textContent=`Karantene ${labels[v362QJob.status]||v362QJob.status} · ${done}/${total}`;
      detail.textContent=v362QJob.note||v362QJob.sessionRoot||""; if(job)job.textContent="KARANTENE"; return;
    }
    if(report?.files?.length){
      const hs=report.hashStats||{};
      head.textContent=`Scan klar · ${fmtN(report.files.length)} filer`;
      detail.textContent=`${fmtB(report.summary?.fileBytes||0)} · ${fmtN(hs.withHash||0)} filer med innholdshash`;
      if(job)job.textContent="KLAR";
    }else{
      head.textContent="Klar · ingen aktiv jobb"; detail.textContent="Start en kartlegging for live status"; if(job)job.textContent="KLAR";
    }
  }
  setInterval(refreshLiveOps,900); setTimeout(refreshLiveOps,350);

  function reportRows(){
    if(v362QJob?.items?.length)return v362QJob.items;
    return (v24Quarantine||[]).map(x=>({id:x.id,name:x.name,size:x.size,originalPath:x.originalPath,quarantinePath:x.quarantinePath,status:"done",error:"",verified:x.verified,verifyError:x.verifyError}));
  }
  window.v39OpenQuarantineReport=function(){
    const rows=reportRows();
    const done=rows.filter(x=>x.status==="done").length, failed=rows.filter(x=>x.status==="failed").length, pending=rows.filter(x=>!["done","failed"].includes(x.status)).length;
    const verified=rows.filter(x=>x.verified===true).length, badVerify=rows.filter(x=>x.verified===false&&x.verifiedAt).length;
    const errRows=rows.filter(x=>x.status==="failed"||x.error||x.verifyError);
    const sample=rows.slice(0,200).map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.status||"done")}</td><td>${x.verified===true?"✓":x.verifiedAt?"⚠":"–"}</td><td class="path">${esc(x.originalPath||"")}</td><td class="path">${esc(x.quarantinePath||"")}</td><td class="path error-text">${esc(x.error||x.verifyError||"")}</td></tr>`).join("");
    v24Open(`<span class="eyebrow">KARANTENERAPPORT · V3.11.1.1</span><h2>${failed===rows.length&&rows.length?"Karantene mislyktes":"Karantenejobb – detaljert rapport"}</h2>
      <div class="v39-report-stats"><div><span>VELLYKKET</span><strong>${fmtN(done)}</strong></div><div><span>FEIL</span><strong>${fmtN(failed)}</strong></div><div><span>GJENSTÅR</span><strong>${fmtN(pending)}</strong></div><div><span>VERIFY OK</span><strong>${fmtN(verified)}</strong></div></div>
      ${failed?`<div class="v39-report-warning"><strong>${fmtN(failed)} filer feilet.</strong><p>Feilårsaken vises per fil under. Resume prøver bare feilede eller gjenstående filer.</p></div>`:""}
      ${badVerify?`<div class="v39-report-warning"><strong>${fmtN(badVerify)} verify-avvik.</strong><p>Disse skal ikke slettes permanent før de er kontrollert.</p></div>`:""}
      <div class="v39-report-table"><table><thead><tr><th>Fil</th><th>Status</th><th>Verify</th><th>Original</th><th>Karantene</th><th>Feil / avvik</th></tr></thead><tbody>${sample||'<tr><td colspan="6">Ingen karantenedata.</td></tr>'}</tbody></table></div>
      ${rows.length>200?`<p class="muted">Viser de første 200 av ${fmtN(rows.length)} rader. Bruk CSV/Manifest JSON for hele datasettet.</p>`:""}
      <div class="actions"><button class="btn primary" id="v39ReportClose">Lukk</button><button class="btn ghost" id="v39ReportCsv">CSV</button><button class="btn ghost" id="v39ReportJson">Manifest JSON</button></div>`);
    E("v39ReportClose").onclick=v24Close;
    E("v39ReportCsv").onclick=()=>E("v24QCsv")?.click();
    E("v39ReportJson").onclick=()=>E("v24QJson")?.click();
  };

  async function quickTrash(file){
    if(!file)return;
    if(!v24Enabled){
      iansToast("Action Mode kreves","Aktiver Action Mode før du sender filer til OneDrive-papirkurven.","error",7000);
      E("v24EnableAction")?.scrollIntoView({behavior:"smooth",block:"center"}); return;
    }
    v24Open(`<span class="eyebrow">RASK PAPIRKURV · V3.11.1.1</span><h2>Send denne filen til OneDrive-papirkurven?</h2>
      <div class="v39-file-confirm"><strong>${esc(file.name)}</strong><span>${esc(fmtB(file.size))}</span><code>${esc(file.path||"")}</code></div>
      <p class="muted">Dette bruker OneDrive-papirkurven – ikke permanent sletting.</p>
      <div class="actions"><button id="v39TrashCancel" class="btn ghost">Avbryt</button><button id="v39TrashConfirm" class="btn danger">Send til papirkurv</button></div>`);
    E("v39TrashCancel").onclick=v24Close;
    E("v39TrashConfirm").onclick=async()=>{
      const btn=E("v39TrashConfirm");btn.disabled=true;btn.textContent="Sender…";
      try{
        await v310TrashFile(file);
        v24Log("Papirkurv",file.path,true,"Sendt til OneDrive-papirkurven");
        v24Selected.delete(file.id); reviewIds.delete(String(file.id));
        if(report?.files){
          report.files=report.files.filter(x=>x.id!==file.id);
          if(report.summary){report.summary.fileCount=report.files.length;report.summary.fileBytes=report.files.reduce((n,x)=>n+(Number(x.size)||0),0)}
          prepareV2(report); renderReport(report);
        }
        v24Close();iansToast("Sendt til papirkurv",`${file.name} · ${fmtB(file.size)}`,"success",7000);
      }catch(err){btn.disabled=false;btn.textContent="Prøv igjen";iansToast("Papirkurv feilet",String(err?.message||err),"error",10000)}
    };
  }
  window.v311QuickTrash=quickTrash;
  document.addEventListener("click",e=>{
    const b=e.target.closest("[data-v39-trash]"); if(!b)return;
    const f=report?.files?.find(x=>String(x.id)===String(b.dataset.v39Trash)); quickTrash(f);
  });

  // A report button is useful even when the old result modal is not open.
  setTimeout(()=>{
    const q=E("v24QStatus");
    const bar=q?.previousElementSibling?.querySelector(".actions");
    if(bar&&!E("v39QReport")){
      const b=document.createElement("button");b.id="v39QReport";b.className="btn ghost";b.textContent="Rapport";b.onclick=window.v39OpenQuarantineReport;bar.prepend(b);
    }
  },700);

  console.info("[IANS] OneDrive Command V3.11.1 Interaction Fix aktiv – live operations, detaljert karantenerapport og rask papirkurv");
})();


// ===== IANS OneDrive Command V3.11 STICKY SAFE DELETE =====
(() => {
  const E=id=>document.getElementById(id);
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

  function installStickyDock(){
    if(E("v310StickyDock")) return;
    const dock=document.createElement("div");
    dock.id="v310StickyDock";
    dock.className="v310-sticky-dock";
    dock.innerHTML=`<div class="v310-dock-state"><span class="eyebrow">IANS CONTROL · V3.12</span><strong id="v310DockMode">READ ONLY</strong></div>
      <button id="v310DockAction" class="btn action-top">Aktiver Action Mode</button>
      <button id="v310DockTop" class="btn ghost">↑ Topp</button>`;
    document.body.appendChild(dock);
    E("v310DockTop").onclick=()=>window.scrollTo({top:0,behavior:"smooth"});
    E("v310DockAction").onclick=()=>{
      const target=E("topActionBtn") || E("v24EnableAction");
      target?.click();
    };
    syncStickyDock();
  }
  function syncStickyDock(){
    const mode=E("v310DockMode"), btn=E("v310DockAction");
    if(!mode||!btn)return;
    const on=typeof v24Enabled!=="undefined" && v24Enabled;
    mode.textContent=on?"ACTION MODE AKTIV":"READ ONLY";
    mode.classList.toggle("active",on);
    btn.textContent=on?"Action Mode aktiv":"Aktiver Action Mode";
    btn.disabled=on;
  }
  const oldSet=typeof v24SetEnabled==="function"?v24SetEnabled:null;
  if(oldSet){
    v24SetEnabled=function(on){ oldSet(on); syncStickyDock(); };
  }

  function addInventoryBulkDelete(){
    const panel=E("inventoryTable")?.closest("section.panel") || document.querySelector(".command-center");
    if(!panel || E("v310DeleteSelected")) return;
    const head=panel.querySelector(".section-title") || panel.querySelector(".command-center-head") || panel.firstElementChild;
    const actions=head?.querySelector(".actions") || head;
    if(!actions)return;
    const b=document.createElement("button");
    b.id="v310DeleteSelected"; b.className="btn danger"; b.textContent="Slett valgte";
    b.title="Sender valgte filer til OneDrive-papirkurven. De kan gjenopprettes derfra.";
    b.onclick=()=>{
      if(!v24Selected?.size){ iansToast("Ingen filer valgt","Kryss av filer først.","error",5000); return; }
      if(typeof v24Enabled!=="undefined"&&!v24Enabled){ iansToast("Action Mode kreves","Aktiver Action Mode først.","error",6000); return; }
      v24.trash?.click();
    };
    actions.appendChild(b);
  }

  document.addEventListener("click",e=>{
    const b=e.target.closest("[data-v310-smart-trash]");
    if(!b)return;
    const f=report?.files?.find(x=>String(x.id)===String(b.dataset.v310SmartTrash));
    if(!f)return;
    if(typeof v24Enabled!=="undefined"&&!v24Enabled){
      iansToast("Action Mode kreves","Aktiver Action Mode før du sender filen til papirkurven.","error",6000); return;
    }
    v24Open(`<span class="eyebrow">SMART CLEANUP · PAPIRKURV</span><h2>Send denne filen til OneDrive-papirkurven?</h2><div class="v39-file-confirm"><strong>${esc(f.name)}</strong><span>${typeof formatBytes==="function"?formatBytes(f.size||0):f.size}</span><code>${esc(f.path||"")}</code></div><p class="muted">Filen kan gjenopprettes fra OneDrive-papirkurven.</p><div class="actions"><button id="v310SmartCancel" class="btn ghost">Avbryt</button><button id="v310SmartConfirm" class="btn danger">Send til papirkurv</button></div>`);
    E("v310SmartCancel").onclick=v24Close;
    E("v310SmartConfirm").onclick=async()=>{
      const btn=E("v310SmartConfirm");btn.disabled=true;btn.textContent="Sender…";
      try{
        await v310TrashFile(f);
        v24Log("Papirkurv",f.path,true,"Sendt til OneDrive-papirkurven");
        v24Selected.delete(f.id);reviewIds.delete(String(f.id));
        if(report?.files){report.files=report.files.filter(x=>x!==f);if(report.summary){report.summary.fileCount=report.files.length;report.summary.fileBytes=report.files.reduce((n,x)=>n+(Number(x.size)||0),0)}prepareV2(report);renderReport(report)}
        v24Close();iansToast("Sendt til papirkurv",f.name,"success",6500);
      }catch(err){btn.disabled=false;btn.textContent="Prøv igjen";iansToast("Papirkurv feilet",String(err?.message||err),"error",10000)}
    };
  });

  const baseRenderV310=renderReport;
  renderReport=function(r){
    const y=window.scrollY;
    baseRenderV310(r);
    requestAnimationFrame(()=>{
      addInventoryBulkDelete(); syncStickyDock();
      // Avoid visible jumps caused by large dynamic panels being rebuilt above the viewport.
      if(Math.abs(window.scrollY-y)>80) window.scrollTo({top:y,behavior:"auto"});
    });
  };

  window.addEventListener("load",()=>{
    installStickyDock(); addInventoryBulkDelete(); syncStickyDock();
  });
  setTimeout(()=>{installStickyDock();addInventoryBulkDelete();syncStickyDock();},500);
  console.info("[IANS] OneDrive Command V3.11 aktiv – sticky control, path/drive-ID delete recovery, Smart Cleanup dato + papirkurv");
})();


// ===== IANS OneDrive Command V3.11 · FLOW + EMPTY FOLDERS =====
(() => {
  const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];
  function cleanLegacy(){qa("#v286CommandCenter,#v287CommandCenter,#v289ReferenceShell,#v285SystemHealth").forEach(x=>x.remove())}
  function placeLive(){
    const live=q("#v288MidPulse"), shell=q("#iansV30"), ws=q("#iansV30 .v30-workspace");
    if(live&&shell&&ws&&live.parentElement!==shell){shell.insertBefore(live,ws)}
  }
  function boot(){cleanLegacy();placeLive();setTimeout(cleanLegacy,800);setTimeout(placeLive,900);setTimeout(cleanLegacy,1800)}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();
// ===== END V3.11 =====


// ===== V3.11.1 INTERACTION FIX =====
(()=>{
  const E=id=>document.getElementById(id);
  // Keep bulk selection visible and useful in Read Only; execution still requires Action Mode.
  function refreshInventorySelection(){
    if(typeof renderV2==="function" && report) renderV2();
  }
  // Detect stale markup after async module rebuilds and restore selection column.
  const observer=new MutationObserver(()=>{
    const table=E("inventoryTable")?.querySelector("table");
    if(!table||!report) return;
    if(!table.querySelector("[data-v24-select]")) {
      clearTimeout(window.__ians3111SelectionTimer);
      window.__ians3111SelectionTimer=setTimeout(refreshInventorySelection,60);
    }
  });
  window.addEventListener("load",()=>{
    const host=E("inventoryTable"); if(host) observer.observe(host,{childList:true,subtree:true});
    setTimeout(refreshInventorySelection,250);
  });

  // UI status helper: tells the user what Review means.
  document.addEventListener("click",e=>{
    const r=e.target.closest("[data-review]");
    if(r) r.title="Legg filen i Review-køen for manuell vurdering. Filen flyttes eller slettes ikke.";
  },true);

  window.v3111InteractionSelfTest=function(){
    const table=E("inventoryTable");
    return {
      inventory:!!table,
      checkbox:!!table?.querySelector("[data-v24-select]"),
      preview:!!table?.querySelector("[data-preview]"),
      review:!!table?.querySelector("[data-review]"),
      trash:!!table?.querySelector("[data-v39-trash]"),
      quickTrash:typeof window.v311QuickTrash==="function"
    };
  };
  console.info("[IANS] V3.11.1 interaction guard aktiv",window.v3111InteractionSelfTest());
})();

// ===== IANS OneDrive Command V3.12 · COMPACT WORKSPACE =====
(() => {
  const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>[...r.querySelectorAll(s)];
  const state={mode:localStorage.getItem('ians.v312.view')||'compact'};

  function installCompactControls(){
    const shell=q('#iansV30'); if(!shell || q('#v312ViewToggle',shell)) return;
    document.body.classList.add('ians-v312');
    const heroControls=q('.v3101-hero-controls',shell);
    if(heroControls){
      const wrap=document.createElement('div'); wrap.id='v312ViewToggle'; wrap.className='v312-view-toggle';
      wrap.innerHTML='<button data-v312-view="compact">Kompakt</button><button data-v312-view="detail">Detaljert</button>';
      heroControls.prepend(wrap);
      qa('[data-v312-view]',wrap).forEach(b=>b.onclick=()=>setView(b.dataset.v312View));
    }
    setView(state.mode);
    simplifyLabels(shell);
  }

  function setView(mode){
    state.mode=mode==='detail'?'detail':'compact';
    localStorage.setItem('ians.v312.view',state.mode);
    document.body.classList.toggle('v312-detail',state.mode==='detail');
    document.body.classList.toggle('v312-compact',state.mode==='compact');
    qa('[data-v312-view]').forEach(b=>b.classList.toggle('active',b.dataset.v312View===state.mode));
  }

  function simplifyLabels(shell){
    const scanCopy=q('.v30-scan-copy small',shell); if(scanCopy)scanCopy.textContent='Scan, fortsett eller bruk Scan Vault.';
    const work=q('#v30WorkKicker',shell); if(work)work.textContent='ARBEIDSOMRÅDE';
  }

  function compactAllFiles(){
    const panel=q('#inventoryTable')?.closest('section.panel'); if(!panel)return;
    panel.classList.add('v312-scroll-panel');
    const summary=q('#filterSummary',panel);
    if(summary && !q('#v312InventoryTools',panel)){
      const tools=document.createElement('div'); tools.id='v312InventoryTools'; tools.className='v312-inventory-tools';
      tools.innerHTML='<span>Filliste</span><button data-v312-table="compact" class="active">Kompakt</button><button data-v312-table="tall">Mer plass</button>';
      summary.after(tools);
      qa('[data-v312-table]',tools).forEach(b=>b.onclick=()=>{
        panel.classList.toggle('v312-table-tall',b.dataset.v312Table==='tall');
        qa('[data-v312-table]',tools).forEach(x=>x.classList.toggle('active',x===b));
      });
    }
  }

  function compactLargeTables(){
    qa('#iansV30 .table-wrap').forEach(x=>x.classList.add('v312-table-scroll'));
    compactAllFiles();
  }

  function hideLegacyPageStack(){
    // V3.12 is a true single-workspace app. Functional panels are moved into #v30Content on demand.
    const dash=q('#dashboard'); if(!dash)return;
    [...dash.children].forEach(el=>{
      if(el.matches('.modal,#folderBrowserModal')) return;
      // Active panel is physically moved out of dashboard by the V3 shell and must remain visible.
      el.classList.add('v312-dashboard-stashed');
    });
  }

  function enhanceSubnav(){
    const shell=q('#iansV30'); if(!shell)return;
    const title=q('#v30WorkTitle',shell)?.textContent||'';
    const sub=q('#v30Subnav',shell); if(!sub)return;
    // Rename tabs into task language; no functionality is removed.
    const map={
      'Lagring':'Oversikt','Store filer':'Kandidater','Media':'Media',
      'Duplikater':'Duplikater','Cleanup Review':'Alle filer','Organiser':'Organiser','Tomme mapper':'Tomme mapper',
      'Kartlegging':'Kartlegging','Scan Vault':'Vault','Download & Verify':'Backup / Verify'
    };
    qa('button',sub).forEach(b=>{if(map[b.textContent.trim()])b.textContent=map[b.textContent.trim()]});
    if(/Finn & analyser/i.test(title) && !qa('button',sub).some(b=>b.textContent==='Alle filer')){
      const b=document.createElement('button'); b.textContent='Alle filer'; b.dataset.sub='review';
      b.onclick=()=>{
        const cleanup=qa('#iansV30 [data-focus]').find(x=>x.dataset.focus==='cleanup'); cleanup?.click();
        setTimeout(()=>qa('#v30Subnav [data-sub]').find(x=>x.dataset.sub==='review')?.click(),30);
      };
      sub.appendChild(b);
    }
  }

  function compactLiveOps(){
    const live=q('#v288MidPulse'); if(!live)return;
    live.classList.add('v312-liveops');
    if(!q('.v312-live-track',live)){
      const track=document.createElement('div'); track.className='v312-live-track';
      track.innerHTML='<div class="v312-live-dots"><i></i><i></i><i></i><i></i><i></i></div><div class="v312-live-line"></div>';
      const inner=live.firstElementChild||live; inner.appendChild(track);
    }
  }

  function compactQuarantine(){
    const p=[...qa('section.panel')].find(x=>/\bKARANTENE\b/i.test(x.innerText||'') && q('#v362QJob',x));
    if(!p)return; p.classList.add('v312-collapsible');
    const head=q('.section-title',p); if(head&&!q('[data-v312-collapse]',head)){
      const b=document.createElement('button');b.className='btn ghost';b.dataset.v312Collapse='1';b.textContent='Vis detaljer';
      (q('.actions',head)||head).appendChild(b);
      b.onclick=()=>{p.classList.toggle('open');b.textContent=p.classList.contains('open')?'Skjul detaljer':'Vis detaljer'};
    }
  }

  function cleanupPassiveCopy(){
    // Decorative/passive sections have little value in compact mode; details remain available in Detail view.
    qa('#iansV30 .muted').forEach(p=>{if((p.textContent||'').length>180)p.classList.add('v312-long-copy')});
  }

  function refresh(){
    installCompactControls(); hideLegacyPageStack(); compactLargeTables(); compactLiveOps(); compactQuarantine(); cleanupPassiveCopy(); enhanceSubnav();
  }

  const observer=new MutationObserver(()=>{clearTimeout(window.__ians312);window.__ians312=setTimeout(refresh,80)});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{refresh();observer.observe(document.body,{childList:true,subtree:true})},650));
  else setTimeout(()=>{refresh();observer.observe(document.body,{childList:true,subtree:true})},650);

  window.v312SelfTest=()=>({
    shell:!!q('#iansV30'), compactToggle:!!q('#v312ViewToggle'),
    workspace:!!q('#v30Content'), stashed:qa('#dashboard>.v312-dashboard-stashed').length,
    inventory:!!q('#inventoryTable'), liveOps:!!q('#v288MidPulse')
  });
  console.info('[IANS] V3.12 Compact Workspace aktiv');
})();
// ===== END V3.12 =====


// ===== IANS OneDrive Command V3.12.1 · SCAN PROGRESS FIX =====
(() => {
  const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>[...r.querySelectorAll(s)];
  const fmtN=n=>typeof formatNumber==="function"?formatNumber(Number(n)||0):new Intl.NumberFormat("nb-NO").format(Number(n)||0);
  const now=()=>Date.now();
  const state=window.__iansScanLiveState ||= {status:"idle",mode:"full",startedAt:0,pct:0,files:0,folders:0,bytesText:"0 B",path:"/",processed:0,queued:0};

  function parseN(v){return Number(String(v||"").replace(/[^0-9]/g,""))||0}
  function readLegacy(){
    const badge=(q('#scanStateBadge')?.textContent||'').trim().toUpperCase();
    const phase=(q('#scanJobPhase')?.textContent||'').trim();
    const pct=parseN(q('#scanJobPct')?.textContent)||state.pct||0;
    const path=(q('#activeFolderLive')?.textContent||q('#progressPath')?.textContent||state.path||'/').trim();
    const processed=parseN(q('#processedFoldersLive')?.textContent);
    const queued=parseN(q('#queuedFoldersLive')?.textContent);
    const bytesText=(q('#scannedBytesLive')?.textContent||state.bytesText||'0 B').trim();
    let files=state.files||0, folders=state.folders||0;
    const nums=(q('#progressNumbers')?.textContent||'');
    const fm=nums.match(/([\d\s.]+)\s*filer/i); if(fm)files=parseN(fm[1]);
    const dm=nums.match(/([\d\s.]+)\s*mapper/i); if(dm)folders=parseN(dm[1]);
    let status=state.status;
    if(/SKANNER|KARTLEGGER/.test(badge))status='running';
    else if(/PAUSET|CHECKPOINT/.test(badge))status='paused';
    else if(/FERDIG|IMPORTERT/.test(badge))status='done';
    state.status=status; state.pct=pct; state.path=path; state.processed=processed; state.queued=queued; state.bytesText=bytesText; state.files=files; state.folders=folders; state.phase=phase;
    if(status==='running'&&!state.startedAt)state.startedAt=now();
    return state;
  }

  function ensureUi(){
    const live=q('#v288MidPulse'); if(!live)return null;
    live.classList.add('v3121-scan-live');
    let host=q('#v3121ScanProgress',live);
    if(!host){
      host=document.createElement('div'); host.id='v3121ScanProgress'; host.className='v3121-scan-progress';
      host.innerHTML=`
        <div class="v3121-progress-top"><span id="v3121ProgressLabel">Ingen aktiv scan</span><strong id="v3121ProgressPct">0%</strong></div>
        <div class="v3121-progress-track"><i id="v3121ProgressFill"></i><span class="v3121-progress-spark"><b></b><b></b><b></b><b></b><b></b></span></div>
        <div class="v3121-progress-meta"><span id="v3121ProgressPath">/</span><span id="v3121ProgressStats">0 filer · 0 B</span><span id="v3121ProgressTime">00:00</span></div>
        <div class="v3121-progress-actions"><button id="v3121Pause" type="button">Pause</button><button id="v3121Resume" type="button">Resume</button><button id="v3121OpenScan" type="button">Åpne Scan & Vault</button></div>`;
      const metrics=q('.v39-live-metrics',live); (metrics||live).insertAdjacentElement(metrics?'beforebegin':'beforeend',host);
      q('#v3121Pause',host).onclick=()=>{ if(typeof cancelRequested!=="undefined")cancelRequested=true; };
      q('#v3121Resume',host).onclick=()=>q('#resumeScanBtn')?.click();
      q('#v3121OpenScan',host).onclick=()=>q('#iansV30 [data-focus="scan"]')?.click();
    }
    return host;
  }

  function syncCard(s){
    const card=q('#iansV30 [data-focus="scan"]'); if(!card)return;
    let badge=q('.v3121-card-badge',card);
    if(!badge){badge=document.createElement('em');badge.className='v3121-card-badge';card.appendChild(badge)}
    const active=s.status==='running'; card.classList.toggle('v3121-running',active);
    badge.textContent=active?`SCAN ${Math.max(1,s.pct)}%`:s.status==='paused'?'PAUSET':s.status==='done'?'KLAR':'';
    badge.hidden=!badge.textContent;
  }

  function render(){
    const s=readLegacy(), host=ensureUi(); if(!host)return;
    const running=s.status==='running', paused=s.status==='paused';
    const pct=Math.max(0,Math.min(100,Number(s.pct)||0));
    const label=q('#v3121ProgressLabel',host), pctEl=q('#v3121ProgressPct',host), fill=q('#v3121ProgressFill',host);
    const path=q('#v3121ProgressPath',host), stats=q('#v3121ProgressStats',host), time=q('#v3121ProgressTime',host);
    const pause=q('#v3121Pause',host), resume=q('#v3121Resume',host);
    if(label)label.textContent=running?`Full scan pågår${s.phase?' · '+s.phase:''}`:paused?'Scan pauset · checkpoint lagret':s.status==='done'?'Scan klar':'Ingen aktiv scan';
    if(pctEl)pctEl.textContent=`${pct}%`;
    if(fill)fill.style.width=`${pct}%`;
    if(path)path.textContent=`Aktiv mappe: ${s.path||'/'}`;
    if(stats)stats.textContent=`${fmtN(s.files)} filer · ${fmtN(s.folders)} mapper · ${s.bytesText||'0 B'}${s.queued?` · ${fmtN(s.queued)} i kø`:''}`;
    const sec=s.startedAt?Math.max(0,Math.floor((now()-s.startedAt)/1000)):0;
    if(time)time.textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
    if(pause)pause.disabled=!running;
    if(resume)resume.disabled=!paused;
    host.classList.toggle('running',running); host.classList.toggle('paused',paused);
    const oldHead=q('#v39LiveHeadline'), oldDetail=q('#v39LiveDetail'), oldJob=q('#v39LiveJob');
    if(oldHead)oldHead.textContent=running?`Kartlegging pågår · ${pct}%`:paused?'Kartlegging pauset':s.status==='done'?'Scan klar':'Klar · ingen aktiv jobb';
    if(oldDetail)oldDetail.textContent=running?`Aktiv mappe: ${s.path||'/'}`:paused?'Resume fortsetter fra checkpoint':'Start en kartlegging for live status';
    if(oldJob)oldJob.textContent=running?'SCAN':paused?'PAUSE':s.status==='done'?'KLAR':'KLAR';
    syncCard(s);
  }

  function clarifyQuick(){
    qa('#iansV30 [data-scan="quick"]').forEach(b=>{b.textContent='Hurtigscan';b.title='Tester Microsoft Graph og leser rotnivået uten å starte full kartlegging.'});
  }

  // Full scan should immediately show as running, before the first Graph response arrives.
  document.addEventListener('click',e=>{
    const full=e.target.closest('#iansV30 [data-scan="full"]');
    if(full){state.status='running';state.mode='full';state.startedAt=now();state.pct=Math.max(1,state.pct||1);setTimeout(render,0)}
    const resume=e.target.closest('#resumeScanBtn,[data-scan="resume"]');
    if(resume){state.status='running';state.startedAt=state.startedAt||now();setTimeout(render,0)}
  },true);

  const mo=new MutationObserver(()=>{clearTimeout(window.__ians3121Render);window.__ians3121Render=setTimeout(render,40)});
  function boot(){ensureUi();clarifyQuick();render();mo.observe(document.body,{subtree:true,childList:true,characterData:true});setInterval(render,500)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,700));else setTimeout(boot,700);
  window.v3121ScanProgressSelfTest=()=>({live:!!q('#v3121ScanProgress'),scanButtonRebound:true,legacyBadge:q('#scanStateBadge')?.textContent||'',quickLabel:q('#iansV30 [data-scan="quick"]')?.textContent||''});
  console.info('[IANS] V3.12.1 Scan Progress Fix aktiv');
})();
// ===== END V3.12.1 =====


// ===== IANS OneDrive Command V3.12.2 · SLEEP/RESUME RECOVERY =====
(() => {
  const q=(s,r=document)=>r.querySelector(s);
  const state=window.__iansScanLiveState ||= {status:"idle",mode:"full",startedAt:0,pct:0,files:0,folders:0,bytesText:"0 B",path:"/",processed:0,queued:0};
  const fmtBytesLocal=n=>typeof formatBytes==="function"?formatBytes(Number(n)||0):`${Number(n)||0} B`;
  let lastHydrate=0;
  async function hydrateCheckpoint(force=false){
    if(!force && Date.now()-lastHydrate<2500)return;
    lastHydrate=Date.now();
    try{
      const cp=await loadScanCheckpoint?.();
      if(!cp)return;
      const badge=(q('#scanStateBadge')?.textContent||'').toUpperCase();
      if(/PAUSET|CHECKPOINT/.test(badge) || state.status==='paused' || document.visibilityState==='visible'){
        state.files=Number(cp.stats?.files)||state.files||0;
        state.folders=Number(cp.stats?.folders)||state.folders||0;
        state.bytesText=fmtBytesLocal(cp.stats?.bytes||0);
        state.processed=Number(cp.processedFolders)||0;
        state.queued=Array.isArray(cp.queue)?cp.queue.length:0;
        state.path=cp.queue?.[0]?.path||cp.scanRoot?.path||state.path||'/';
        state.pct=Math.max(Number(cp.visualPct)||0,state.pct||0);
        if(/PAUSET|CHECKPOINT/.test(badge))state.status='paused';
        const f=q('#v39LiveFiles'),b=q('#v39LiveBytes'); if(f)f.textContent=new Intl.NumberFormat('nb-NO').format(state.files); if(b)b.textContent=state.bytesText;
      }
    }catch(e){console.warn('[IANS V3.12.2] checkpoint hydrate',e)}
  }
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible')setTimeout(()=>hydrateCheckpoint(true),250); });
  window.addEventListener('pageshow',()=>setTimeout(()=>hydrateCheckpoint(true),250));
  document.addEventListener('click',e=>{
    if(e.target.closest('#iansV30 [data-scan="full"]')){
      // A stale lock can survive a suspended request. A new explicit Full scan invalidates stale network work.
      const hb=Number(window.__iansScanHeartbeat)||0;
      if(hb && Date.now()-hb>30000){
        window.__iansScanRunToken=(Number(window.__iansScanRunToken)||0)+1;
        try{scanRunningV38=false}catch{}
      }
    }
  },true);
  setInterval(()=>hydrateCheckpoint(false),2500);
  window.v3122SleepResumeSelfTest=()=>({token:Number(window.__iansScanRunToken)||0,heartbeat:Number(window.__iansScanHeartbeat)||0,live:state.status,checkpointHook:typeof window.__iansForceScanCheckpoint==='function'});
  console.info('[IANS] V3.12.2 Sleep/Resume Recovery aktiv');
})();
// ===== END V3.12.2 =====


// ===== IANS OneDrive Command V3.12.4 · SCAN RECOVERY HARDENING =====
console.info('[IANS] V3.12.4 Scan Recovery Hardening aktiv');
window.v3124ScanRecoverySelfTest=()=>({
  transientAbort:iansTransientMicrosoftError(Object.assign(new Error('The operation was aborted'),{name:'AbortError'})),
  transientTimeout:iansTransientMicrosoftError(new Error('timed_out')),
  checkpointHook:typeof window.__iansForceScanCheckpoint==='function' || window.__iansForceScanCheckpoint===null,
  liveStatus:window.__iansScanLiveState?.status||'idle'
});
// ===== END V3.12.4 =====




// ===== IANS OneDrive Command V3.13 · CLEAN SCAN ENGINE =====
console.info("[IANS] V3.13 Clean Scan Engine aktiv · single promise · direct Graph enumeration · no scan preflight/redirect");
window.__iansV313SelfTest=()=>({
  version:"3.13",
  directScan:typeof scanOneDrive==="function",
  singlePromise:typeof iansActiveScanPromise!=="undefined",
  preflight:typeof iansScanPreflight==="function",
  redirect:typeof iansBeginRedirectAuth==="function",
  account:activeAccount?.username||null
});
// ===== END V3.13 =====
// ===== IANS OneDrive Command V3.14 · CLEAN AUTH BASELINE =====
// Auth/Graph baseline restored from the known-good V3.4 model.
// Keeps the current UI, scan engine, reports and Action Mode.
(() => {
  const VERSION = "3.14.0";
  const DIAG_ID = "iansAuthDiagV314";
  let diagRunning = false;

  function accountV314() {
    if (!msalApp) return null;
    const account =
      activeAccount ||
      msalApp.getActiveAccount?.() ||
      msalApp.getAllAccounts?.()[0] ||
      null;

    if (account && account !== activeAccount) {
      activeAccount = account;
      try { msalApp.setActiveAccount(account); } catch {}
    }
    return account;
  }

  function setDiagV314(step, ok, detail = "") {
    const box = document.getElementById(DIAG_ID);
    if (!box) return;
    const row = box.querySelector(`[data-step="${step}"]`);
    if (!row) return;
    row.dataset.state = ok === true ? "ok" : ok === false ? "fail" : "wait";
    const mark = ok === true ? "✓" : ok === false ? "✕" : "…";
    row.querySelector(".v314-mark").textContent = mark;
    row.querySelector(".v314-detail").textContent = detail || "";
  }

  function resetDiagV314() {
    for (const step of ["MSAL", "ACCOUNT", "TOKEN", "DRIVE", "ROOT"]) {
      setDiagV314(step, null, "");
    }
  }

  function installDiagV314() {
    if (document.getElementById(DIAG_ID)) return;

    const style = document.createElement("style");
    style.textContent = `
      #${DIAG_ID}{
        position:fixed;right:18px;bottom:18px;z-index:99999;
        width:min(360px,calc(100vw - 36px));padding:14px 16px;
        border:1px solid rgba(148,163,184,.28);border-radius:16px;
        background:rgba(10,18,32,.94);backdrop-filter:blur(14px);
        box-shadow:0 18px 50px rgba(0,0,0,.32);color:#e5eefb;
        font:12px/1.4 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif
      }
      #${DIAG_ID} .v314-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:8px}
      #${DIAG_ID} strong{font-size:12px;letter-spacing:.04em}
      #${DIAG_ID} button{border:1px solid rgba(148,163,184,.32);border-radius:9px;background:rgba(30,41,59,.7);color:#e5eefb;padding:5px 9px;cursor:pointer}
      #${DIAG_ID} .v314-row{display:grid;grid-template-columns:20px 60px 1fr;gap:7px;padding:3px 0;align-items:start}
      #${DIAG_ID} .v314-row[data-state="ok"] .v314-mark{color:#86efac}
      #${DIAG_ID} .v314-row[data-state="fail"] .v314-mark{color:#fca5a5}
      #${DIAG_ID} .v314-row[data-state="wait"] .v314-mark{color:#fde68a}
      #${DIAG_ID} .v314-detail{color:#94a3b8;overflow-wrap:anywhere}
      #${DIAG_ID} .v314-foot{margin-top:8px;color:#94a3b8}
    `;
    document.head.appendChild(style);

    const box = document.createElement("div");
    box.id = DIAG_ID;
    box.innerHTML = `
      <div class="v314-head">
        <strong>OneDrive AUTH · V3.14</strong>
        <button type="button" id="iansAuthTestV314">Test forbindelse</button>
      </div>
      ${["MSAL","ACCOUNT","TOKEN","DRIVE","ROOT"].map(step => `
        <div class="v314-row" data-step="${step}" data-state="wait">
          <span class="v314-mark">…</span><span>${step}</span><span class="v314-detail"></span>
        </div>`).join("")}
      <div class="v314-foot">Ren V3.4-baseline: loginPopup ved innlogging, silent token under lesing.</div>
    `;
    document.body.appendChild(box);

    document.getElementById("iansAuthTestV314")?.addEventListener("click", () => {
      window.IANS_AUTH_V314.selfTest();
    });
  }

  // ------------------------------------------------------------------
  // 1. CLEAN TOKEN READER
  // Same principle as the known-good V3.4:
  // acquireTokenSilent only during normal read operations.
  // No redirect, popup-prime, broker loop or retry storm.
  // ------------------------------------------------------------------
  getToken = async function getTokenV314() {
    if (!msalApp) {
      throw new Error("MSAL er ikke initialisert.");
    }

    const account = accountV314();
    if (!account) {
      throw new Error("Ingen Microsoft-konto er aktiv. Logg inn på OneDrive på nytt.");
    }

    try {
      const result = await msalApp.acquireTokenSilent({
        scopes: SCOPES,
        account
      });

      if (!result?.accessToken) {
        throw new Error("Microsoft returnerte ikke access token.");
      }
      return result.accessToken;
    } catch (err) {
      console.error("[IANS V3.14] acquireTokenSilent failed", err);

      if (
        (typeof InteractionRequiredAuthError !== "undefined" &&
         err instanceof InteractionRequiredAuthError) ||
        /interaction_required|login_required|consent_required|timed_out|timeout/i.test(
          `${err?.errorCode || ""} ${err?.message || ""}`
        )
      ) {
        throw new Error(
          "Microsoft-sessionen må fornyes. Logg ut av OneDrive Command, koble til OneDrive på nytt og prøv igjen."
        );
      }
      throw err;
    }
  };

  // ------------------------------------------------------------------
  // 2. CLEAN FOLDER BROWSER
  // Deliberately independent of cancelRequested / scan state.
  // ------------------------------------------------------------------
  listBrowserFolders = async function listBrowserFoldersV314(folderId = null) {
    const token = await getToken();

    let url = folderId
      ? `${GRAPH}/me/drive/items/${encodeURIComponent(folderId)}/children?$select=id,name,folder,parentReference&$top=200`
      : `${GRAPH}/me/drive/root/children?$select=id,name,folder,parentReference&$top=200`;

    const folders = [];

    while (url) {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });

      if (!res.ok) {
        let detail = "";
        try { detail = JSON.stringify(await res.json()); } catch {}
        throw new Error(`Graph ${res.status}: ${detail || res.statusText}`);
      }

      const data = await res.json();
      for (const item of data.value || []) {
        if (item.folder) folders.push(item);
      }
      url = data["@odata.nextLink"] || null;
    }

    return folders.sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", "nb", { sensitivity: "base" })
    );
  };

  // ------------------------------------------------------------------
  // 3. CLEAN INTERACTIVE LOGIN
  // Popup is only used from an explicit user login action.
  // No popup/redirect is inserted in front of scanOneDrive().
  // ------------------------------------------------------------------
  signIn = async function signInV314() {
    if (!msalApp) {
      if (typeof els !== "undefined" && els?.setupMessage) {
        els.setupMessage.textContent = "Lagre Client ID først.";
        els.setupPanel?.classList.remove("hidden");
      }
      return;
    }

    try {
      const result = await msalApp.loginPopup({
        scopes: ["User.Read", ...SCOPES],
        prompt: "select_account",
        redirectUri: POPUP_REDIRECT_URI
      });

      if (!result?.account) {
        throw new Error("Microsoft returnerte ingen konto.");
      }

      activeAccount = result.account;
      msalApp.setActiveAccount(activeAccount);
      if (typeof showDashboard === "function") showDashboard();

      resetDiagV314();
      setDiagV314("MSAL", true, "initialisert");
      setDiagV314("ACCOUNT", true, activeAccount.username || activeAccount.name || "konto aktiv");
    } catch (err) {
      console.error("[IANS V3.14] loginPopup failed", err);
      const old = document.getElementById("loginError");
      if (old) old.remove();

      if (typeof els !== "undefined" && els?.loginPanel) {
        const p = document.createElement("p");
        p.id = "loginError";
        p.className = "message";
        p.textContent = `Innlogging feilet: ${err.message}`;
        els.loginPanel.appendChild(p);
      } else {
        alert(`Innlogging feilet: ${err.message}`);
      }
    }
  };

  // ------------------------------------------------------------------
  // 4. DIAGNOSTIC: tells us exactly where the chain stops.
  // MSAL -> ACCOUNT -> TOKEN -> DRIVE -> ROOT
  // ------------------------------------------------------------------
  async function selfTestV314() {
    if (diagRunning) return;
    diagRunning = true;
    resetDiagV314();

    try {
      if (!msalApp) throw new Error("MSAL ikke initialisert");
      setDiagV314("MSAL", true, "initialisert");

      const account = accountV314();
      if (!account) {
        setDiagV314("ACCOUNT", false, "ingen aktiv konto");
        throw new Error("Ingen aktiv Microsoft-konto");
      }
      setDiagV314("ACCOUNT", true, account.username || account.name || "aktiv");

      let token;
      try {
        token = await getToken();
        setDiagV314("TOKEN", true, "silent token OK");
      } catch (err) {
        setDiagV314("TOKEN", false, err.message || String(err));
        throw err;
      }

      const driveRes = await fetch(`${GRAPH}/me/drive?$select=id,driveType,quota`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      if (!driveRes.ok) {
        const text = await driveRes.text();
        setDiagV314("DRIVE", false, `HTTP ${driveRes.status} ${text.slice(0,120)}`);
        throw new Error(`Drive HTTP ${driveRes.status}`);
      }
      const drive = await driveRes.json();
      setDiagV314("DRIVE", true, drive.driveType || "drive OK");

      const rootRes = await fetch(
        `${GRAPH}/me/drive/root/children?$select=id,name,folder&$top=5`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store"
        }
      );
      if (!rootRes.ok) {
        const text = await rootRes.text();
        setDiagV314("ROOT", false, `HTTP ${rootRes.status} ${text.slice(0,120)}`);
        throw new Error(`Root HTTP ${rootRes.status}`);
      }
      const root = await rootRes.json();
      setDiagV314("ROOT", true, `${(root.value || []).length} element(er) lest`);
    } catch (err) {
      console.error("[IANS V3.14] auth self-test stopped", err);
    } finally {
      diagRunning = false;
    }
  }

  window.IANS_AUTH_V314 = {
    version: VERSION,
    selfTest: selfTestV314,
    account: () => accountV314()?.username || null
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installDiagV314, { once: true });
  } else {
    installDiagV314();
  }

  console.info("[IANS] V3.14 Clean Auth Baseline active");
})();
// ===== END IANS OneDrive Command V3.14 =====

// ===== IANS OneDrive Command V3.14.1 · CLEAN RUNTIME GUARD =====
(() => {
  const VERSION = "3.14.1";
  const state = {
    legacyRedirectErrors: 0,
    uiErrors: 0,
    lastError: null,
    installedAt: new Date().toISOString()
  };

  // Last-resort protection: old presentation-layer MutationObservers must never
  // kill scan enumeration. We only suppress the exact known legacy UI null-write.
  window.addEventListener("error", (event) => {
    const msg = String(event?.error?.message || event?.message || "");
    const stack = String(event?.error?.stack || "");
    const isKnownUiNull =
      msg.includes("Cannot set properties of null") &&
      msg.includes("textContent") &&
      (stack.includes("MutationObserver.sync") || stack.includes(" at sync"));

    const isOldRedirect =
      msg.includes("iansResumeAfterRedirect is not defined");

    if (isKnownUiNull) {
      state.uiErrors += 1;
      state.lastError = msg;
      console.warn("[IANS V3.14.1] Legacy UI sync-feil isolert; scanmotor fortsetter.");
      event.preventDefault();
      return;
    }

    if (isOldRedirect) {
      state.legacyRedirectErrors += 1;
      state.lastError = msg;
      console.warn("[IANS V3.14.1] Legacy redirect-feil isolert.");
      event.preventDefault();
    }
  }, true);

  // Runtime health badge.
  function installBadge() {
    if (document.getElementById("iansRuntime3141")) return;
    const box=document.createElement("div");
    box.id="iansRuntime3141";
    box.style.cssText=[
      "position:fixed","right:18px","bottom:180px","z-index:99998",
      "padding:8px 10px","border-radius:10px",
      "border:1px solid rgba(134,239,172,.35)",
      "background:rgba(10,18,32,.92)","color:#bbf7d0",
      "font:11px system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
    ].join(";");
    box.textContent="RUNTIME CLEAN · V3.14.1";
    box.title="Legacy V3.12.5/V3.12.7/V3.12.8 runtime fjernet. V3.13 scan + V3.14 auth beholdt.";
    document.body.appendChild(box);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installBadge, {once:true});
  } else {
    installBadge();
  }

  window.IANS_RUNTIME_V3141 = {
    version: VERSION,
    status: () => ({...state})
  };

  console.info("[IANS] V3.14.1 Clean Runtime aktiv · legacy scan/auth layers removed · UI errors isolated");
})();
// ===== END IANS OneDrive Command V3.14.1 =====

// ===== IANS OneDrive Command V3.14.2 · Scan Session Isolation =====
(() => {
  "use strict";
  const V = "3.14.2";
  const SESSION_KEY = "ians_v3142_active_scan_session";
  const PREVIOUS_KEY = "ians_v3142_previous_scan_summary";
  const LEGACY_KEYS = [
    "ians_scan_state","ians_scan_report","ians_scan_cache","ians_last_scan",
    "ians_v293_scan","ians_v294_scan","ians_v311_scan","ians_v312_scan",
    "ians_v313_scan","ians_v314_scan"
  ];
  let currentSession = null;
  let currentStats = {files:0, folders:0, bytes:0, retries:0, failedFolders:0};
  let sessionStarted = false;

  const $v3142 = id => document.getElementById(id);
  const fmtN3142 = n => new Intl.NumberFormat("nb-NO").format(Number(n)||0);
  const fmtB3142 = n => {
    n = Number(n)||0;
    if (!n) return "0 B";
    const u=["B","KB","MB","GB","TB","PB"];
    const i=Math.min(Math.floor(Math.log(n)/Math.log(1024)),u.length-1);
    return `${(n/Math.pow(1024,i)).toFixed(i>=3?2:1)} ${u[i]}`;
  };
  const newScanId3142 = () => `scan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  const safeJson3142 = v => { try{return JSON.parse(v)}catch{return null} };

  function snapshotOldVisibleState3142(){
    const fileText =
      $v3142("fileCount")?.textContent ||
      document.querySelector("[data-live-files]")?.textContent ||
      "";
    const sizeText =
      $v3142("fileSize")?.textContent ||
      document.querySelector("[data-live-bytes]")?.textContent ||
      "";
    if (fileText || sizeText) {
      localStorage.setItem(PREVIOUS_KEY, JSON.stringify({
        savedAt:new Date().toISOString(),
        filesText:fileText.trim(),
        sizeText:sizeText.trim(),
        source:"legacy-visible-state"
      }));
    }
  }

  async function clearLegacyCheckpointOnly3142(){
    try{
      await new Promise(resolve=>{
        const req=indexedDB.open("ians_onedrive_scan_v25",1);
        req.onerror=()=>resolve();
        req.onupgradeneeded=()=>{
          const db=req.result;
          if(!db.objectStoreNames.contains("checkpoints")) db.createObjectStore("checkpoints");
        };
        req.onsuccess=()=>{
          const db=req.result;
          try{
            if(!db.objectStoreNames.contains("checkpoints")) { db.close(); resolve(); return; }
            const tx=db.transaction("checkpoints","readwrite");
            tx.objectStore("checkpoints").delete("active");
            tx.oncomplete=()=>{db.close();resolve()};
            tx.onerror=()=>{db.close();resolve()};
          }catch{db.close();resolve()}
        };
      });
    }catch{}
  }

  function clearLegacyLocalScanState3142(){
    for(const k of LEGACY_KEYS) localStorage.removeItem(k);
    Object.keys(localStorage).forEach(k=>{
      if (/^ians_/i.test(k) &&
          /(scan|checkpoint|report|cache)/i.test(k) &&
          !/(quarantine|review|action|pro|client|config|feedback|media)/i.test(k) &&
          k !== PREVIOUS_KEY && k !== SESSION_KEY) {
        localStorage.removeItem(k);
      }
    });
  }

  async function beginFreshSession3142(source="full-scan"){
    if(sessionStarted) return currentSession;
    snapshotOldVisibleState3142();
    clearLegacyLocalScanState3142();
    await clearLegacyCheckpointOnly3142();

    currentStats={files:0,folders:0,bytes:0,retries:0,failedFolders:0};
    currentSession={
      scanId:newScanId3142(),
      startedAt:new Date().toISOString(),
      source,
      status:"running",
      stats:{...currentStats}
    };
    sessionStarted=true;
    sessionStorage.setItem(SESSION_KEY,JSON.stringify(currentSession));

    ["fileCount","folderCount","processedFoldersLive","queuedFoldersLive"].forEach(x=>{
      const el=$v3142(x); if(el) el.textContent="0";
    });
    const bytes=$v3142("scannedBytesLive"); if(bytes) bytes.textContent="0 B";

    console.info(`[IANS SCAN SESSION] ${currentSession.scanId} · fresh Graph session · previous cache isolated`);
    return currentSession;
  }

  function completeSession3142(){
    if(!currentSession) return;
    currentSession.status=currentStats.failedFolders ? "completed-with-errors" : "completed";
    currentSession.completedAt=new Date().toISOString();
    currentSession.stats={...currentStats};
    sessionStorage.setItem(SESSION_KEY,JSON.stringify(currentSession));
    console.info(`[IANS SCAN COMPLETE] ${currentSession.scanId} · ${fmtN3142(currentStats.files)} files · ${fmtB3142(currentStats.bytes)} · retries ${currentStats.retries} · failed ${currentStats.failedFolders}`);
  }

  const nativeFetch3142 = window.fetch.bind(window);
  window.fetch = async function(input, init){
    const url = typeof input==="string" ? input : (input?.url || "");
    const isGraph = /^https:\/\/graph\.microsoft\.com\//i.test(url);
    if(!isGraph) return nativeFetch3142(input,init);

    let last;
    let recoveredStatus = null;
    for(let attempt=0; attempt<6; attempt++){
      last = await nativeFetch3142(input,init);
      if(![429,500,502,503,504].includes(last.status)){
        if(recoveredStatus !== null){
          console.info(`[IANS GRAPH RECOVERED] HTTP ${recoveredStatus} · ${url}`);
        }
        return last;
      }
      recoveredStatus = last.status;
      if(attempt>=5) break;

      currentStats.retries++;
      const ra=Number(last.headers.get("Retry-After"));
      const wait=Number.isFinite(ra)&&ra>0 ? ra : Math.min(2**attempt,15);
      console.warn(`[IANS GRAPH RETRY] HTTP ${last.status} · attempt ${attempt+1}/6 · wait ${wait}s`);
      await new Promise(r=>setTimeout(r,wait*1000));
    }
    if(last && [429,500,502,503,504].includes(last.status)){
      console.error(`[IANS GRAPH FAILED] HTTP ${last.status} after 6 attempts · ${url}`);
    }
    return last;
  };

  document.addEventListener("click", e=>{
    const b=e.target.closest("#scanBtn,#fullScanBtn,[data-action='full-scan'],[data-scan='full'],button");
    if(!b) return;
    const text=(b.textContent||"").trim().toLowerCase();
    const isFull =
      b.id==="scanBtn" || b.id==="fullScanBtn" ||
      b.dataset?.action==="full-scan" || b.dataset?.scan==="full" ||
      /full\s*scan|full\s*skann|fullstendig\s*scan|fullstendig\s*skann/.test(text);
    if(!isFull) return;

    const active = safeJson3142(sessionStorage.getItem(SESSION_KEY));
    if(active?.status==="running" && sessionStarted){
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      console.warn(`[IANS SCAN BLOCKED] aktiv scan finnes: ${active.scanId}`);
      if(typeof iansToast==="function") iansToast("Scan kjører allerede","Stopp eller fullfør aktiv scan før du starter en ny.","warning",5000);
      return;
    }
    beginFreshSession3142("full-scan").catch(err=>console.error("[IANS V3.14.2] session init",err));
  }, true);

  const observer3142 = new MutationObserver(()=>{
    if(!currentSession) return;
    const n = t => Number(String(t||"").replace(/[^\d]/g,""))||0;
    const f=$v3142("fileCount"); if(f) currentStats.files=Math.max(currentStats.files,n(f.textContent));
    const fo=$v3142("folderCount"); if(fo) currentStats.folders=Math.max(currentStats.folders,n(fo.textContent));
    currentSession.stats={...currentStats};
    sessionStorage.setItem(SESSION_KEY,JSON.stringify(currentSession));

    const badge=$v3142("scanStateBadge");
    const status=(badge?.textContent||"").toUpperCase();
    if(/FERDIG|COMPLETE|COMPLETED/.test(status) && currentSession.status==="running"){
      completeSession3142();
    }
  });
  if(document.documentElement) observer3142.observe(document.documentElement,{subtree:true,childList:true,characterData:true});

  function addCacheControl3142(){
    if($v3142("v3142CacheBtn")) return;
    const host =
      document.querySelector(".header-actions,.top-actions,.toolbar-actions,.scan-controls") ||
      $v3142("progressPanel") || document.querySelector("header");
    if(!host) return;

    const btn=document.createElement("button");
    btn.id="v3142CacheBtn";
    btn.type="button";
    btn.className="btn ghost";
    btn.textContent="Nullstill lokal scan-data";
    btn.title="Fjerner bare lokale scan/checkpoint-data. OneDrive-filer, innlogging og karantenehistorikk røres ikke.";
    btn.addEventListener("click",async()=>{
      const prev=safeJson3142(localStorage.getItem(PREVIOUS_KEY));
      const msg=[
        "Dette nullstiller lokal scan-cache og aktivt checkpoint.",
        "",
        "Det slettes IKKE filer i OneDrive.",
        "Innlogging, Client ID, Pro-status og karantene/review-historikk beholdes.",
        prev ? `\nForrige snapshot: ${prev.filesText||"ukjent"} · ${prev.sizeText||""}` : "",
        "",
        "Fortsette?"
      ].join("\n");
      if(!confirm(msg)) return;
      clearLegacyLocalScanState3142();
      await clearLegacyCheckpointOnly3142();
      sessionStorage.removeItem(SESSION_KEY);
      currentSession=null; sessionStarted=false;
      console.info("[IANS CACHE RESET] lokal scan-data nullstilt · quarantine/review preserved");
      if(typeof iansToast==="function") iansToast("Lokal scan-data nullstilt","OneDrive og karantenehistorikk er ikke endret.","success",5000);
      else alert("Lokal scan-data er nullstilt. OneDrive og karantenehistorikk er ikke endret.");
    });
    host.appendChild(btn);
  }

  function boot3142(){
    addCacheControl3142();
    setTimeout(addCacheControl3142,800);
    setTimeout(addCacheControl3142,2200);
    console.info("[IANS] V3.14.2 Scan Session Isolation aktiv · fresh sessions · cache control · Graph 429/5xx recovery");
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot3142);
  else boot3142();
})();

// ===== IANS OneDrive Command V3.14.2.1 · Workspace Cache Fix =====
(() => {
  "use strict";

  const PREVIOUS_KEY = "ians_v3142_previous_scan_summary";
  const SESSION_KEY = "ians_v3142_active_scan_session";

  const byId = id => document.getElementById(id);
  const safeJson = v => { try { return JSON.parse(v); } catch { return null; } };

  async function clearCheckpoint31421(){
    try{
      await new Promise(resolve=>{
        const req=indexedDB.open("ians_onedrive_scan_v25",1);
        req.onerror=()=>resolve();
        req.onupgradeneeded=()=>{
          const db=req.result;
          if(!db.objectStoreNames.contains("checkpoints")) db.createObjectStore("checkpoints");
        };
        req.onsuccess=()=>{
          const db=req.result;
          try{
            if(!db.objectStoreNames.contains("checkpoints")) { db.close(); resolve(); return; }
            const tx=db.transaction("checkpoints","readwrite");
            tx.objectStore("checkpoints").delete("active");
            tx.oncomplete=()=>{db.close();resolve()};
            tx.onerror=()=>{db.close();resolve()};
          }catch{
            db.close(); resolve();
          }
        };
      });
    }catch{}
  }

  function clearLocalScanOnly31421(){
    Object.keys(localStorage).forEach(k=>{
      if (
        /^ians_/i.test(k) &&
        /(scan|checkpoint|report|cache)/i.test(k) &&
        !/(quarantine|review|action|pro|client|config|feedback|media)/i.test(k) &&
        k !== PREVIOUS_KEY
      ) {
        localStorage.removeItem(k);
      }
    });
    sessionStorage.removeItem(SESSION_KEY);
  }

  function createCacheButton31421(){
    if(byId("v31421CacheBtn")) return;

    const scanRow =
      document.querySelector(".scan-actions") ||
      document.querySelector(".scan-controls") ||
      document.querySelector(".mapping-actions") ||
      document.querySelector("[data-scan-actions]") ||
      document.querySelector(".toolbar") ||
      document.querySelector("main");

    if(!scanRow) return;

    const btn=document.createElement("button");
    btn.id="v31421CacheBtn";
    btn.type="button";
    btn.className="btn ghost";
    btn.textContent="Nullstill lokal scan-data";
    btn.title="Fjerner kun lokale scan/checkpoint-data. OneDrive-filer og karantene/review-historikk beholdes.";

    btn.addEventListener("click", async ()=>{
      const prev=safeJson(localStorage.getItem(PREVIOUS_KEY));
      const lines=[
        "Dette nullstiller lokal scan-cache og aktivt checkpoint.",
        "",
        "Det slettes IKKE filer i OneDrive.",
        "Karantene/review-historikk beholdes.",
        prev ? `Forrige snapshot: ${prev.filesText || "ukjent"} ${prev.sizeText ? "· " + prev.sizeText : ""}` : "",
        "",
        "Fortsette?"
      ].filter(Boolean);

      if(!confirm(lines.join("\n"))) return;

      clearLocalScanOnly31421();
      await clearCheckpoint31421();
      console.info("[IANS CACHE RESET] workspace scan-cache nullstilt · quarantine/review preserved");
      location.reload();
    });

    // Legg knappen rett før/etter Full scan hvis mulig
    const fullBtn = [...document.querySelectorAll("button")].find(b =>
      /full\s*scan|full\s*skann/i.test((b.textContent||"").trim())
    );

    if(fullBtn?.parentElement){
      fullBtn.parentElement.appendChild(btn);
    } else {
      scanRow.prepend(btn);
    }
  }

  function markPreviousScan31421(){
    const active = safeJson(sessionStorage.getItem(SESSION_KEY));
    if(active?.status === "running") return;

    const texts=[...document.querySelectorAll("body *")];
    const candidate = texts.find(el => {
      const t=(el.textContent||"").trim();
      return /161[\s\u00a0]?729/.test(t) && /858[.,]62/.test(t);
    });

    if(!candidate) return;

    let badge=byId("v31421PreviousBadge");
    if(!badge){
      badge=document.createElement("div");
      badge.id="v31421PreviousBadge";
      badge.style.cssText="margin:8px 0;padding:8px 10px;border:1px solid rgba(96,190,255,.35);border-radius:8px;font-size:12px;opacity:.9";
      badge.innerHTML="<strong>Forrige lagrede scan</strong> · historisk resultat, ikke aktiv scan";
      candidate.parentElement?.insertBefore(badge,candidate);
    }
  }

  function resetLiveCountersBeforeFreshScan31421(){
    const ids=["fileCount","folderCount","processedFoldersLive","queuedFoldersLive","scannedBytesLive"];
    ids.forEach(id=>{
      const el=byId(id);
      if(!el) return;
      el.textContent = id==="scannedBytesLive" ? "0 B" : "0";
    });

    [...document.querySelectorAll("body *")].forEach(el=>{
      if(el.children.length) return;
      const t=(el.textContent||"").trim();
      if(/^161[\s\u00a0]?729$/.test(t)) el.textContent="0";
      if(/^858[.,]62\s*GB$/i.test(t)) el.textContent="0 B";
    });
  }

  document.addEventListener("click", e=>{
    const b=e.target.closest("button");
    if(!b) return;
    const t=(b.textContent||"").trim();
    if(/full\s*scan|full\s*skann/i.test(t)){
      resetLiveCountersBeforeFreshScan31421();
      console.info("[IANS LIVE RESET] Full Scan starter med nullstilte live-tall");
    }
  }, true);

  function boot(){
    createCacheButton31421();
    markPreviousScan31421();
    setTimeout(createCacheButton31421,700);
    setTimeout(markPreviousScan31421,900);
    setTimeout(createCacheButton31421,1800);
    setTimeout(markPreviousScan31421,2000);
    console.info("[IANS] V3.14.2.1 Workspace Cache Fix aktiv · previous scan labeled · cache button visible");
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();
