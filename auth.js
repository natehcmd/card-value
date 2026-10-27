"use strict";
/* Accounts: Supabase Auth does the hard parts (password hashing, email confirmation, rate limits,
   2-step codes). On top of that, your saved numbers are encrypted in this browser before upload,
   with a key made from your password. The server only ever stores ciphertext. */
(function(){
  const cfg = window.AUTH_CONFIG || {};
  const btn = document.getElementById("authbtn"), box = document.getElementById("auth");
  if(!btn || !box) return;
  if(!cfg.url || !cfg.anonKey || !window.supabase || !window.supabase.createClient) return;   // off until configured
  const sb = window.supabase.createClient(cfg.url, cfg.anonKey, {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, flowType:"pkce"}});
  btn.hidden = false;

  const A = {user:null, key:null, salt:null, step:"creds", tab:"in", msg:"", err:"", busy:false, fails:0, lockUntil:0, status:"", pw:null, factor:null, enroll:null, factors:[]};
  const te = new TextEncoder(), td = new TextDecoder();
  const $a = id => document.getElementById(id);
  const e2 = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  /* ---- crypto: PBKDF2 (600k) -> AES-256-GCM, bound to the user id ---- */
  const b64 = buf => { const a = new Uint8Array(buf); let s = ""; for(let i=0;i<a.length;i+=8192) s += String.fromCharCode.apply(null, a.subarray(i,i+8192)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function deriveKey(password, salt){
    const base = await crypto.subtle.importKey("raw", te.encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({name:"PBKDF2", salt, iterations:600000, hash:"SHA-256"}, base, {name:"AES-GCM", length:256}, false, ["encrypt","decrypt"]);
  }
  async function seal(key, obj, uid){
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({name:"AES-GCM", iv, additionalData:te.encode(uid)}, key, te.encode(JSON.stringify(obj)));
    return {iv:b64(iv), ct:b64(ct)};
  }
  async function unseal(key, iv, ct, uid){
    const pt = await crypto.subtle.decrypt({name:"AES-GCM", iv:unb64(iv), additionalData:te.encode(uid)}, key, unb64(ct));
    return JSON.parse(td.decode(pt));
  }

  /* ---- password rules: 12+ characters, not obviously guessable, not in a known breach (k-anonymity: only 5 hash characters leave the browser) ---- */
  async function pwned(pw){
    try{
      const h = await crypto.subtle.digest("SHA-1", te.encode(pw));
      const hex = [...new Uint8Array(h)].map(x => x.toString(16).padStart(2,"0")).join("").toUpperCase();
      const r = await fetch("https://api.pwnedpasswords.com/range/"+hex.slice(0,5), {headers:{"Add-Padding":"true"}});
      if(!r.ok) return null;
      const t = await r.text();
      return t.split("\n").some(l => l.startsWith(hex.slice(5)+":") && parseInt(l.split(":")[1],10) > 0);
    }catch(e){ return null; }
  }
  function pwProblem(pw, email){
    if(pw.length < 12) return "Use at least 12 characters.";
    const classes = [/[a-z]/,/[A-Z]/,/[0-9]/,/[^A-Za-z0-9]/].filter(r => r.test(pw)).length;
    if(pw.length < 16 && classes < 3) return "Mix upper and lower case, numbers or symbols, or make it 16+ characters long.";
    const local = (email||"").split("@")[0].toLowerCase();
    if(local.length >= 4 && pw.toLowerCase().includes(local)) return "Don't put your email name in your password.";
    if(/^(.)\1+$/.test(pw) || /(password|qwerty|123456|letmein)/i.test(pw)) return "That password is too easy to guess.";
    return "";
  }

  /* ---- what gets saved: your numbers and values, not UI state ---- */
  function snapshot(){ const {pins, view, tsort, f, ...rest} = S; return JSON.parse(JSON.stringify(rest)); }
  function applySnapshot(o){
    A.applying = true;
    try{ merge(S, o); }finally{ A.applying = false; }
    try{ localStorage.setItem("cardvalue.v1", JSON.stringify(S)); }catch(e){}
    if($a("scale")){ $a("scale").value = Math.round(S.scale*100); if($a("feemax")) $a("feemax").value = S.feeMax; updateControls(); }
    buildPanelKeepOpen(); render();
  }
  let timer = null;
  window.onSaved = function(){
    if(!A.user || !A.key || A.applying) return;
    clearTimeout(timer); A.status = "Saving…"; renderBtn(); timer = setTimeout(cloudSave, 1500);
  };
  async function cloudSave(){
    if(!A.user || !A.key) return;
    try{
      const {iv, ct} = await seal(A.key, snapshot(), A.user.id);
      const {error} = await sb.from("profiles").upsert({user_id:A.user.id, salt:A.salt, iv, ciphertext:ct, version:1, updated_at:new Date().toISOString()});
      A.status = error ? "Couldn't save" : "Saved";
    }catch(e){ A.status = "Couldn't save"; }
    renderBtn(); if(!box.hidden && A.step==="account") draw();
  }
  /* returns "ok" or "locked" (profile was locked with another password) */
  async function openProfile(password){
    const {data:row, error} = await sb.from("profiles").select("salt,iv,ciphertext").eq("user_id", A.user.id).maybeSingle();
    if(error) throw new Error("load");
    if(row){
      const key = await deriveKey(password, unb64(row.salt));
      let obj; try{ obj = await unseal(key, row.iv, row.ciphertext, A.user.id); }catch(e){ return "locked"; }
      A.key = key; A.salt = row.salt; applySnapshot(obj); A.status = "Saved"; return "ok";
    }
    await freshProfile(password); return "ok";
  }
  async function freshProfile(password){
    const salt = crypto.getRandomValues(new Uint8Array(16));
    A.salt = b64(salt); A.key = await deriveKey(password, salt); await cloudSave();
  }

  /* ---- UI ---- */
  function renderBtn(){
    if(!A.user) btn.textContent = "Sign in";
    else if(!A.key) btn.textContent = "Unlock my saved numbers";
    else btn.textContent = "Account" + (A.status ? " · " + A.status : "");
  }
  function openAuth(step){ A.step = step || (A.user ? (A.key ? "account" : "unlock") : "creds"); A.err = ""; A.msg = ""; box.hidden = false; draw(); const f = box.querySelector("input"); if(f) f.focus(); }
  function closeAuth(){ box.hidden = true; A.pw = null; A.enroll = null; }
  const shell = (title, inner) => `<div class="wbox" style="max-width:460px"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px"><h2 id="authtitle" style="margin:0">${title}</h2><button class="btn" data-a="close">Close</button></div>${A.err?`<p role="alert" style="color:var(--bad);margin:0 0 10px">${e2(A.err)}</p>`:""}${A.msg?`<p role="status" style="color:var(--accent);margin:0 0 10px">${e2(A.msg)}</p>`:""}${inner}</div>`;
  const field = (id,label,type,auto,extra="") => `<label class="field">${label}<input id="${id}" type="${type}" autocomplete="${auto}" spellcheck="false" autocapitalize="off" ${type==="email"&&A.email?`value="${e2(A.email)}"`:""} ${extra}></label>`;
  function draw(){
    const wait = Math.max(0, Math.ceil((A.lockUntil - Date.now())/1000));
    const dis = A.busy || wait ? "disabled" : "";
    let h = "";
    if(A.step === "creds"){
      const up = A.tab === "up";
      h = shell(up ? "Create an account" : "Sign in", `
        <div class="seg" style="grid-template-columns:1fr 1fr;margin-bottom:12px" role="group"><button data-a="tab-in" aria-pressed="${!up}">Sign in</button><button data-a="tab-up" aria-pressed="${up}">Create account</button></div>
        <form id="authform" novalidate style="display:grid;gap:10px">
          ${field("a-email","Email","email","email","required")}
          ${field("a-pw","Password","password",up?"new-password":"current-password","required minlength=12")}
          ${up?field("a-pw2","Confirm password","password","new-password","required"):""}
          ${up?`<p class="d" style="margin:0;color:var(--muted);font-size:12.5px">At least 12 characters. It is checked against known data breaches without sending your password anywhere. Your saved numbers are encrypted in your browser with a key made from this password. <b>If you forget it and reset it, your saved numbers can't be recovered</b>; you would just enter them again.</p>`:""}
          <button class="btn primary" type="submit" ${dis}>${wait?`Wait ${wait}s`:(A.busy?"Working…":(up?"Create account":"Sign in"))}</button>
          ${up?"":`<button class="btn" type="button" data-a="forgot">Forgot password</button>`}
        </form>`);
    } else if(A.step === "mfa"){
      h = shell("Enter your 6-digit code", `<form id="mfaform" novalidate style="display:grid;gap:10px"><p class="d" style="margin:0;color:var(--muted)">Open your authenticator app and type the current code for Card Value.</p>
        ${field("a-code","Code","text","one-time-code",'inputmode="numeric" maxlength="6" pattern="[0-9]*" required')}<button class="btn primary" type="submit" ${dis}>${A.busy?"Working…":"Verify"}</button></form>`);
    } else if(A.step === "unlock"){
      h = shell("Unlock your saved numbers", `<form id="authform" novalidate style="display:grid;gap:10px"><p class="d" style="margin:0;color:var(--muted)">You're signed in as <b>${e2(A.user&&A.user.email)}</b>. Your numbers are encrypted, so enter your password to open them.</p>
        <input type="hidden" id="a-email" value="${e2(A.user&&A.user.email)}">${field("a-pw","Password","password","current-password","required")}
        <button class="btn primary" type="submit" ${dis}>${wait?`Wait ${wait}s`:(A.busy?"Working…":"Unlock")}</button><button class="btn" type="button" data-a="signout">Sign out</button></form>`);
    } else if(A.step === "sent"){
      h = shell("Check your email", `<p>If that address can be used, we sent a confirmation link. Open it on this device, then come back and sign in.</p><button class="btn primary" data-a="tab-in">Back to sign in</button>`);
    } else if(A.step === "forgot"){
      h = shell("Reset your password", `<form id="forgotform" novalidate style="display:grid;gap:10px"><p class="d" style="margin:0;color:var(--muted)">We will email a reset link. Because your saved numbers are encrypted with your password, <b>resetting it replaces them</b> with whatever is on screen when you finish.</p>
        ${field("a-email","Email","email","email","required")}<button class="btn primary" type="submit" ${dis}>Send reset link</button><button class="btn" type="button" data-a="tab-in">Back</button></form>`);
    } else if(A.step === "recovery"){
      h = shell("Choose a new password", `<form id="recform" novalidate style="display:grid;gap:10px"><p class="d" style="margin:0;color:var(--muted)">Your previously saved numbers can't be opened with a new password, so they will be replaced by what is on screen now.</p>
        ${field("a-pw","New password","password","new-password","required minlength=12")}${field("a-pw2","Confirm new password","password","new-password","required")}<button class="btn primary" type="submit" ${dis}>Save new password</button></form>`);
    } else if(A.step === "account"){
      const has = A.factors.length > 0;
      h = shell("Your account", `<p style="margin:0 0 4px">Signed in as <b>${e2(A.user&&A.user.email)}</b></p>
        <p class="d" style="margin:0 0 12px;color:var(--muted)">${e2(A.status||"")} Your numbers are encrypted in this browser before they are saved. ${has?"2-step verification is on.":"Turn on 2-step verification for the strongest protection."}</p>
        <div style="display:grid;gap:8px">
          ${has?`<button class="btn" data-a="mfa-off">Turn off 2-step verification</button>`:`<button class="btn primary" data-a="mfa-on">Turn on 2-step verification</button>`}
          <button class="btn" data-a="signout">Sign out</button>
          <form id="delform" style="display:grid;gap:8px;margin-top:10px;border-top:1px solid var(--line);padding-top:12px"><b style="color:var(--bad)">Delete my account and saved numbers</b><p class="d" style="margin:0;color:var(--muted);font-size:13px">This can't be undone. Type DELETE to confirm.</p><input id="a-del" type="text" autocomplete="off" spellcheck="false"><button class="btn" type="submit">Delete everything</button></form>
        </div>`);
    } else if(A.step === "enroll"){
      const en = A.enroll;
      h = shell("Turn on 2-step verification", `<form id="enrollform" novalidate style="display:grid;gap:10px"><p class="d" style="margin:0;color:var(--muted)">Scan this with an authenticator app (1Password, Google Authenticator, Authy), then type the 6-digit code it shows.</p>
        ${en?`<img alt="QR code for your authenticator app" src="${e2(en.qr)}" width="180" height="180" style="background:#fff;padding:8px;border-radius:8px;justify-self:center"><p class="d" style="margin:0;font-size:12.5px;color:var(--muted);word-break:break-all">Can't scan? Enter this key: <b>${e2(en.secret)}</b></p>`:""}
        ${field("a-code","Code","text","one-time-code",'inputmode="numeric" maxlength="6" pattern="[0-9]*" required')}<button class="btn primary" type="submit" ${dis}>${A.busy?"Working…":"Turn on"}</button><button class="btn" type="button" data-a="acct">Cancel</button></form>`);
    }
    box.innerHTML = h;
    if(wait){ setTimeout(()=>{ if(!box.hidden) draw(); }, 1000); }
  }
  const val = id => ($a(id) ? $a(id).value : "");
  const fail = () => { A.fails++; A.lockUntil = Date.now() + Math.min(60000, 1000 * Math.pow(2, Math.min(A.fails, 6))); };
  const lockedNow = () => Date.now() < A.lockUntil;
  async function loadFactors(){ try{ const {data} = await sb.auth.mfa.listFactors(); A.factors = (data && data.totp || []).filter(f => f.status === "verified"); }catch(e){ A.factors = []; } }
  async function finish(password){
    const r = await openProfile(password);
    if(r === "locked"){ A.step = "unlock"; A.err = "Your saved numbers were locked with a different password. Sign out and reset, or enter the password you used when you saved them."; return false; }
    await loadFactors(); renderBtn(); closeAuth(); return true;
  }
  async function signIn(email, password){
    const {data, error} = await sb.auth.signInWithPassword({email, password});
    if(error || !data || !data.user){ fail(); throw new Error("Email or password is wrong, or the email isn't confirmed yet."); }
    A.user = data.user; A.fails = 0;
    const {data:aal} = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if(aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2"){
      const {data:fs} = await sb.auth.mfa.listFactors(); const f = fs && fs.totp && fs.totp.find(x => x.status === "verified");
      if(f){ A.pw = password; A.factor = f.id; A.step = "mfa"; return "mfa"; }
    }
    return finish(password);
  }
  box.addEventListener("submit", async e => {
    e.preventDefault(); if(A.busy) return;
    const id = e.target.id; A.err = ""; A.msg = "";
    const V = {email:val("a-email").trim(), pw:val("a-pw"), pw2:val("a-pw2"), code:val("a-code").replace(/\s/g,""), del:val("a-del").trim()};
    if(V.email) A.email = V.email;
    try{
      if(lockedNow()){ draw(); return; }
      A.busy = true; draw();
      if(id === "authform"){
        const email = V.email, pw = V.pw;
        if(!email || !pw) throw new Error("Enter your email and password.");
        if(A.step === "creds" && A.tab === "up"){
          const p = pwProblem(pw, email); if(p) throw new Error(p);
          if(pw !== V.pw2) throw new Error("The two passwords don't match.");
          const leaked = await pwned(pw); if(leaked) throw new Error("That password appears in a known data breach. Pick a different one.");
          const {error} = await sb.auth.signUp({email, password:pw, options:{emailRedirectTo:location.origin+location.pathname}});
          if(error && /rate|too many/i.test(error.message||"")) throw new Error("Too many attempts. Try again in a few minutes.");
          A.step = "sent";
        } else {
          const r = await signIn(email, pw); if(r === "mfa") A.err = "";
        }
      } else if(id === "mfaform"){
        const code = V.code;
        const {data:ch, error:e1} = await sb.auth.mfa.challenge({factorId:A.factor}); if(e1) throw new Error("Couldn't start verification. Try again.");
        const {error:e2_} = await sb.auth.mfa.verify({factorId:A.factor, challengeId:ch.id, code});
        if(e2_){ fail(); throw new Error("That code didn't work."); }
        const pw = A.pw; A.pw = null; A.fails = 0; await finish(pw);
      } else if(id === "forgotform"){
        const email = V.email; if(!email) throw new Error("Enter your email.");
        await sb.auth.resetPasswordForEmail(email, {redirectTo:location.origin+location.pathname});
        A.step = "creds"; A.tab = "in"; A.msg = "If that address has an account, a reset link is on its way.";
      } else if(id === "recform"){
        const pw = V.pw; const p = pwProblem(pw, A.user && A.user.email); if(p) throw new Error(p);
        if(pw !== V.pw2) throw new Error("The two passwords don't match.");
        if(await pwned(pw)) throw new Error("That password appears in a known data breach. Pick a different one.");
        const {error} = await sb.auth.updateUser({password:pw}); if(error) throw new Error("Couldn't change the password. Try the link again.");
        await freshProfile(pw); await loadFactors(); renderBtn(); closeAuth();
      } else if(id === "enrollform"){
        const code = V.code;
        const {data:ch, error:e1} = await sb.auth.mfa.challenge({factorId:A.enroll.id}); if(e1) throw new Error("Couldn't start verification.");
        const {error} = await sb.auth.mfa.verify({factorId:A.enroll.id, challengeId:ch.id, code}); if(error) throw new Error("That code didn't work.");
        A.enroll = null; await loadFactors(); A.step = "account"; A.msg = "2-step verification is on.";
      } else if(id === "delform"){
        if(V.del !== "DELETE") throw new Error("Type DELETE exactly to confirm.");
        const {error} = await sb.rpc("delete_my_account"); if(error) throw new Error("Couldn't delete the account. Try again.");
        await sb.auth.signOut(); A.user = null; A.key = null; try{ localStorage.removeItem("cardvalue.v1"); }catch(x){} location.reload(); return;
      }
    }catch(err){ A.err = err.message || "Something went wrong."; }
    A.busy = false; if(!box.hidden) draw();
  });
  box.addEventListener("click", async e => {
    if(e.target === box){ closeAuth(); return; }
    const b = e.target.closest("button[data-a]"); if(!b) return;
    const a = b.dataset.a; A.err = ""; A.msg = "";
    if(a === "close") closeAuth();
    else if(a === "tab-in"){ A.step = "creds"; A.tab = "in"; draw(); }
    else if(a === "tab-up"){ A.step = "creds"; A.tab = "up"; draw(); }
    else if(a === "forgot"){ A.step = "forgot"; draw(); }
    else if(a === "acct"){ A.step = "account"; A.enroll = null; draw(); }
    else if(a === "signout"){ try{ await sb.auth.signOut(); }catch(x){} A.user = null; A.key = null; A.status = ""; try{ localStorage.removeItem("cardvalue.v1"); }catch(x){} location.reload(); }
    else if(a === "mfa-on"){
      const {data, error} = await sb.auth.mfa.enroll({factorType:"totp", friendlyName:"Card Value "+new Date().toISOString().slice(0,10)});
      if(error){ A.err = "Couldn't start setup. Try again."; draw(); return; }
      A.enroll = {id:data.id, qr:data.totp.qr_code, secret:data.totp.secret}; A.step = "enroll"; draw();
    }
    else if(a === "mfa-off"){
      const f = A.factors[0]; if(!f) return;
      const {error} = await sb.auth.mfa.unenroll({factorId:f.id});
      A.err = error ? "Couldn't turn it off. Sign in again with your code, then retry." : ""; await loadFactors(); draw();
    }
  });
  btn.addEventListener("click", () => openAuth());
  document.addEventListener("keydown", e => { if(e.key === "Escape" && !box.hidden) closeAuth(); });

  sb.auth.onAuthStateChange((event, session) => {
    if(event === "PASSWORD_RECOVERY"){ A.user = session && session.user; A.step = "recovery"; box.hidden = false; draw(); return; }
    if(event === "SIGNED_OUT"){ A.user = null; A.key = null; renderBtn(); }
  });
  sb.auth.getSession().then(({data}) => { if(data && data.session){ A.user = data.session.user; renderBtn(); loadFactors(); } else renderBtn(); });
  renderBtn();
})();
