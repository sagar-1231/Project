"use strict";
(function () {
  var $ = function (s) { return document.querySelector(s); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function rs(n) { return "₹" + (Math.round(n * 100) / 100); }
  function prof() { try { var x = JSON.parse(localStorage.getItem("ak_prof_" + (S.me ? S.me.phone : ""))) || {}; x.addrs = x.addrs || []; x.oaddr = x.oaddr || {}; return x; } catch (e) { return { addrs: [], oaddr: {} }; } }
  function saveProf(x) { try { localStorage.setItem("ak_prof_" + S.me.phone, JSON.stringify(x)); } catch (e) {} }
  function match(i) { return (!vegOnly || i.type !== "egg") && (!q || (i.name + " " + i.desc + " " + i.cat).toLowerCase().indexOf(q.toLowerCase()) >= 0); }
  function feeFor(t, ty) { var s = S.settings; return ty === "delivery" && s.deliveryFee > 0 && !(s.freeAbove > 0 && t >= s.freeAbove) ? s.deliveryFee : 0; }
  function beep() { try { var c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 880; g.gain.value = 0.2; o.start(); setTimeout(function () { o.stop(); c.close(); }, 700); } catch (e) {} }
  function fmtTime(ts) { return new Date(ts).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
  function sameDay(a, b) { return new Date(a).toDateString() === new Date(b).toDateString(); }

  var S = { settings: { name: "Aaru's Kitchen", whatsapp: "", hours: "", address: "" }, menu: [], me: null, devOtp: false, loginMode: "simple" };
  var AD = null;
  var cart = {}, view = "shop", active = "Sab", tab = "orders", modal = null, focusId = null, lastOrder = null, ordersFilter = "all", busy = false;
  var adminOk = false, draft = { name: "", note: "", type: "takeaway", addr: "" };
  var otp = { phone: "", step: "phone", err: "", dev: "" };
  var adm = { err: "" }, mine = null, q = "", vegOnly = false, oq = "";
  var STATUS = { "new": "Naya", prep: "Ban raha hai", done: "Pura hua" };

  /* ---------- network ---------- */
  function api(method, url, body) { return window.localApi(method, url, body); }
  function toast(t) { var el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { el.hidden = true; }, 2800); }
  function loadPublic() {
    return api("GET", "/api/public").then(function (r) {
      if (r.ok) { S.settings = r.data.settings; S.menu = r.data.menu; S.me = r.data.me; adminOk = !!r.data.admin; S.devOtp = !!r.data.devOtp; S.loginMode = r.data.loginMode === "otp" ? "otp" : "simple"; document.title = S.settings.name; }
      else toast(r.data.error || "Menu nahi aa paya");
      return r;
    });
  }
  function loadAdmin() {
    return api("GET", "/api/admin/data").then(function (r) {
      if (r.status === 401) { adminOk = false; view = "shop"; AD = null; return r; }
      if (r.ok) AD = r.data;
      return r;
    });
  }
  function cats() { var c = []; S.menu.forEach(function (i) { if (c.indexOf(i.cat) < 0) c.push(i.cat); }); return c; }
  function ck(id, s) { return id + ":" + (s || "f"); }
  function priceOf(i, s) { return s === "h" && i.half != null ? i.half : i.price; }
  function sizeLabel(i, s) { return i.half != null ? (s === "h" ? " (Half)" : " (Full)") : ""; }
  function cartLines() {
    var l = [];
    S.menu.forEach(function (i) { ["h", "f"].forEach(function (s) { var q = cart[ck(i.id, s)] || 0; if (q && (s === "f" || i.half != null)) l.push({ i: i, s: s, q: q }); }); });
    return l;
  }
  function cartTotals() { var n = 0, t = 0; cartLines().forEach(function (x) { n += x.q; t += x.q * priceOf(x.i, x.s); }); return { n: n, t: t }; }
  function waNumber() { var d = (S.settings.whatsapp || "").replace(/\D/g, ""); if (d.length === 10) d = "91" + d; return d.length >= 11 ? d : ""; }

  /* ---------- shop ---------- */
  function stepper(id, q, s) { return '<span class="stepper"><button data-act="dec" data-id="' + id + '" data-s="' + (s || "f") + '" aria-label="Kam karein">−</button><span>' + q + '</span><button data-act="add" data-id="' + id + '" data-s="' + (s || "f") + '" aria-label="Badhayein">+</button></span>'; }
  function itemAct(i, s) {
    var q = cart[ck(i.id, s)] || 0;
    if (!i.avail) return '<button class="add" disabled>Khatam</button>';
    return q ? stepper(i.id, q, s) : '<button class="add" data-act="add" data-id="' + i.id + '" data-s="' + s + '">Add</button>';
  }
  function shopHTML() {
    var s = S.settings, tt = cartTotals(), cs = cats();
    var h = '<header class="hero full"><div class="wrap"><div class="topline"><span class="kicker">Chinese · Momos · Rolls</span><div class="who">' +
      (S.me ? '<span>Hi, ' + esc(S.me.name || S.me.phone) + '</span><button class="pill" data-act="openMine">Mere orders</button><button class="pill" data-act="logout">Logout</button>' : '<button class="pill" data-act="openLogin">Login</button>') +
      '</div></div><h1 class="brand">' + esc(s.name) + '</h1><p class="sub">Garam, tikha aur taaza. Order karein, WhatsApp pe seedha bhejein.</p><span class="open">' + esc(s.hours) + '</span>' + (s.open === false ? ' <span class="open" style="background:#b3261e;color:#fff">Abhi band hai</span>' : '') + '</div></header>';
    h += '<div class="cats-bar full"><div class="wrap"><div class="cats">' + ["Sab"].concat(cs).map(function (c) { return '<button class="chip" data-act="cat" data-v="' + esc(c) + '" aria-pressed="' + (c === active) + '">' + esc(c) + '</button>'; }).join("") + '</div></div></div>';
    h += '<main class="wrap"><div class="field"><input type="search" id="qIn" placeholder="Dish dhundhein (jaise momos, roll)" value="' + esc(q) + '"></div><div class="cats"><button class="chip" data-act="veg" aria-pressed="' + vegOnly + '">Sirf shakahari</button></div>';
    cs.forEach(function (c) {
      if (active !== "Sab" && active !== c) return;
      var L = S.menu.filter(function (i) { return i.cat === c && match(i); }); if (!L.length) return;
      h += '<h2 class="group">' + esc(c) + '</h2>';
      L.forEach(function (i) {
        var nm = '<div class="nm"><i class="vt ' + (i.type === "egg" ? "egg" : "") + '" title="' + (i.type === "egg" ? "Egg" : "Shakahari") + '"></i>' + esc(i.name) + '</div>';
        if (i.half != null) {
          h += '<div class="item half' + (i.avail ? '' : ' off') + '">' + nm + '<p class="dsc">' + esc(i.desc) + '</p><div class="sizes">' +
            ["h", "f"].map(function (s) { return '<div class="size"><span class="sz"><small>' + (s === "h" ? "Half" : "Full") + '</small><b>' + rs(priceOf(i, s)) + '</b></span>' + itemAct(i, s) + '</div>'; }).join("") + '</div></div>';
        } else {
          h += '<div class="item' + (i.avail ? '' : ' off') + '">' + nm + '<div class="pr">' + rs(i.price) + '</div><p class="dsc">' + esc(i.desc) + '</p><div class="act">' + itemAct(i, "f") + '</div></div>';
        }
      });
    });
    if (!S.menu.length) h += '<p class="empty">Menu abhi khaali hai.</p>'; else if (!S.menu.some(match)) h += '<p class="empty">Kuch nahi mila. Search ya filter badal kar dekhein.</p>';
    h += '<p class="note">Hara nishaan = shakahari, bhura nishaan = anda.</p>';
    h += '<section class="info"><h2>Dukaan ki jaankari</h2><dl><dt>Timing</dt><dd>' + esc(s.hours) + '</dd><dt>Pata</dt><dd>' + esc(s.address) + '</dd><dt>Order</dt><dd>Takeaway aur Delivery</dd></dl></section>';
    h += '<div class="foot"><button class="link" data-act="openAdmin">Admin</button></div></main>';
    if (tt.n) h += '<div class="bar"><button data-act="openCart"><span>' + tt.n + (tt.n === 1 ? ' item' : ' items') + '</span><span>' + rs(tt.t) + ' · Order dekhein</span></button></div>';
    return h;
  }
  function sheet(inner) { return '<div class="scrim" data-act="scrim"><div class="sheet" role="dialog" aria-modal="true">' + inner + '</div></div>'; }
  function modalHTML() {
    var h;
    if (modal === "mine") {
      h = '<h2>Mere orders <button class="x" data-act="closeModal" aria-label="Band karein">×</button></h2>';
      if (!mine) return sheet(h + '<p class="hint">Load ho raha hai...</p>');
      if (mine.err) return sheet(h + '<p class="err">' + esc(mine.err) + '</p>');
      if (!mine.count) return sheet(h + '<p class="hint">Abhi tak koi order nahi hai. Pehla order karke dekhein!</p>');
      h += '<p class="hint">Status apne aap update hota rehta hai. Ab tak <b>' + mine.count + '</b> order, kul <b>' + rs(mine.spent) + '</b>.' + (mine.count > mine.orders.length ? ' Neeche pichle ' + mine.orders.length + ' dikh rahe hain.' : '') + '</p>';
      mine.orders.forEach(function (o) {
        h += '<div class="card"><p><b>' + esc(o.no) + '</b> · ' + fmtTime(o.ts) + ' <span class="badge' + (o.status === "done" ? " done" : "") + '">' + esc(STATUS[o.status] || o.status) + '</span></p>' +
          '<p class="hint">' + (o.type === "delivery" ? "Delivery" + (prof().oaddr[o.no] ? " · " + esc(prof().oaddr[o.no]) : "") : "Takeaway") + '</p>' +
          o.items.map(function (i) { return '<p>' + i.qty + ' × ' + esc(i.name) + ' — ' + rs(i.qty * i.price) + '</p>'; }).join("") + '<p><b>Total: ' + rs(o.total) + '</b></p><button class="btn sm" data-act="reorder" data-no="' + esc(o.no) + '">Dobara order karein</button></div>';
      });
      return sheet(h);
    }
    if (modal === "cart") {
      if (lastOrder) return sheet('<h2>Order mil gaya <button class="x" data-act="closeModal" aria-label="Band karein">×</button></h2><p>Aapka order <b>' + esc(lastOrder.no) + '</b> save ho gaya. Ab WhatsApp kholkar message bhej dein, tabhi dukaan ko order dikhega.</p><a class="btn green" target="_blank" rel="noopener" href="' + esc(lastOrder.url) + '">WhatsApp kholein</a><button class="btn" data-act="closeModal">Theek hai</button>');
      var rows = cartLines().map(function (x) { return '<div class="ln"><span>' + esc(x.i.name + sizeLabel(x.i, x.s)) + '</span>' + stepper(x.i.id, x.q, x.s) + '<b>' + rs(priceOf(x.i, x.s) * x.q) + '</b></div>'; }).join("");
      var tt = cartTotals();
      h = '<h2>Aapka order <button class="x" data-act="closeModal" aria-label="Band karein">×</button></h2>' + (rows || '<p class="empty">Cart khaali hai.</p>');
      if (rows) {
        var fee = feeFor(tt.t, draft.type), st = S.settings;
        if (fee) h += '<div class="ln"><span>Delivery charge</span><b>' + rs(fee) + '</b></div>';
        if (draft.type === "delivery" && st.freeAbove > 0 && tt.t < st.freeAbove) h += '<p class="hint">' + rs(st.freeAbove - tt.t) + ' ka aur order karein, delivery free ho jayegi.</p>';
        if (st.minOrder > tt.t) h += '<p class="err">Kam se kam ' + rs(st.minOrder) + ' ka order chahiye.</p>';
        if (st.open === false) h += '<p class="err">Dukaan abhi band hai, abhi order nahi ho sakta.</p>';
        h += '<div class="total"><span>Total</span><span>' + rs(tt.t + fee) + '</span></div>';
        h += '<div class="field"><label for="cName">Aapka naam</label><input type="text" id="cName" autocomplete="name" maxlength="60" value="' + esc(draft.name || (S.me ? S.me.name || prof().name || "" : "")) + '" data-chg="draft" data-f="name"></div>';
        h += '<div class="field"><label for="cType">Order kaise lenge?</label><select id="cType" data-chg="draft" data-f="type"><option value="takeaway"' + (draft.type === "takeaway" ? " selected" : "") + '>Takeaway (dukaan se le jaunga)</option><option value="delivery"' + (draft.type === "delivery" ? " selected" : "") + '>Delivery (ghar par chahiye)</option></select></div>';
        if (draft.type === "delivery") h += '<div class="field"><label for="cAddr">Delivery ka poora pata</label><textarea id="cAddr" maxlength="300" placeholder="Ghar ka number, gali, mohalla, landmark" data-chg="draft" data-f="addr">' + esc(draft.addr || prof().addrs[0] || "") + '</textarea>' + (prof().addrs.length > 1 ? '<p class="hint">Pichle pate:</p><div class="cats">' + prof().addrs.map(function (a, i) { return '<button type="button" class="chip" data-act="useAddr" data-i="' + i + '">' + esc(a.length > 28 ? a.slice(0, 28) + "…" : a) + '</button>'; }).join("") + '</div>' : '') + '</div>';
        h += '<div class="field"><label for="cNote">Kuch khaas batana ho (optional)</label><textarea id="cNote" maxlength="200" placeholder="Jaise: kam tikha" data-chg="draft" data-f="note">' + esc(draft.note) + '</textarea></div>';
        h += S.me ? '<p class="hint">Mobile: +91 ' + esc(S.me.phone) + '</p><button class="btn green" data-act="placeOrder"' + (busy ? " disabled" : "") + '>' + (busy ? "Bhej rahe hain..." : "Order karein aur WhatsApp pe bhejein") + '</button>' : '<p class="hint">Order bhejne ke liye mobile number se login karna hoga.</p><button class="btn primary" data-act="openLogin">Login karke order karein</button>';
      }
      return sheet(h);
    }
    if (modal === "login") {
      h = '<h2>Login <button class="x" data-act="closeModal" aria-label="Band karein">×</button></h2>';
      if (otp.step === "phone") {
        h += '<div class="field"><label for="phoneIn">Mobile number (10 digit)</label><input type="tel" id="phoneIn" inputmode="numeric" maxlength="10" autocomplete="tel-national" placeholder="98XXXXXXXX" value="' + esc(otp.phone) + '"></div>' +
          (otp.err ? '<p class="err">' + esc(otp.err) + '</p>' : '') + '<button class="btn primary" data-act="sendOtp"' + (busy ? " disabled" : "") + '>' + (busy ? "Ruko..." : S.loginMode === "simple" ? "Aage badhein" : "OTP bhejein") + '</button>';
      } else {
        h += '<p>+91 ' + esc(otp.phone) + ' par 6 digit ka OTP SMS se bheja gaya hai.</p>';
        if (otp.dev) h += '<div class="demo">Testing mode. Aapka OTP<br><b>' + esc(otp.dev) + '</b></div>';
        h += '<div class="field"><label for="otpIn">OTP daalein</label><input type="tel" id="otpIn" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="6 digit"></div>' +
          (otp.err ? '<p class="err">' + esc(otp.err) + '</p>' : '') + '<button class="btn primary" data-act="verifyOtp"' + (busy ? " disabled" : "") + '>Verify karein</button><button class="btn" data-act="resendOtp">OTP dobara bhejein</button><button class="btn" data-act="changeNum">Number badlein</button>';
      }
      return sheet(h);
    }
    if (modal === "admin") return sheet('<h2>Admin login <button class="x" data-act="closeModal" aria-label="Band karein">×</button></h2><div class="field"><label for="admEmail">Admin email</label><input type="email" id="admEmail" autocomplete="username" value="' + esc(adm.email || "") + '"></div><div class="field"><label for="admPass">Password</label><input type="password" id="admPass" autocomplete="current-password"></div>' + (adm.err ? '<p class="err">' + esc(adm.err) + '</p>' : '') + '<button class="btn primary" data-act="admLogin"' + (busy ? " disabled" : "") + '>Login</button>');
    return "";
  }

  /* ---------- admin ---------- */
  function adminHTML() {
    var d = AD, today = d.orders.filter(function (o) { return sameDay(o.ts, Date.now()); });
    var sales = today.reduce(function (a, o) { return a + o.total; }, 0), fresh = d.orders.filter(function (o) { return o.status === "new"; }).length;
    var h = '<div class="adm-head full"><div class="wrap"><h1>Admin · ' + esc(d.settings.name) + '</h1><div class="bar-actions"><button class="btn sm" data-act="toShop">Dukaan dekhein</button><button class="btn sm" data-act="admLogout">Logout</button></div></div></div><div class="wrap">';
    h += '<div class="stats"><div class="stat"><b>' + fresh + '</b><span>Naye orders</span></div><div class="stat"><b>' + today.length + '</b><span>Aaj ke orders</span></div><div class="stat"><b>' + rs(sales) + '</b><span>Aaj ki bikri</span></div><div class="stat"><b>' + d.customers.length + '</b><span>Customers</span></div></div>';
    h += '<div class="tabs full" role="tablist">' + [["orders", "Orders"], ["menu", "Menu"], ["customers", "Customers"], ["qr", "QR"], ["settings", "Settings"]].map(function (t) { return '<button class="tab" role="tab" data-act="tab" data-v="' + t[0] + '" aria-selected="' + (tab === t[0]) + '">' + t[1] + '</button>'; }).join("") + '</div>';
    h += tab === "orders" ? adminOrders() : tab === "menu" ? adminMenu() : tab === "customers" ? adminCustomers() : tab === "qr" ? adminQR() : adminSettings();
    return h + '</div>';
  }
  function adminOrders() {
    var list = AD.orders.slice().sort(function (a, b) { return b.ts - a.ts; }).filter(function (o) { return (ordersFilter === "all" || o.status === ordersFilter) && (!oq || (o.no + " " + o.name + " " + o.phone).toLowerCase().indexOf(oq.toLowerCase()) >= 0); });
    var h = '<div class="field"><input type="search" id="oqIn" placeholder="Order no, naam ya mobile se dhundhein" value="' + esc(oq) + '"></div><div class="row2"><div class="field"><label for="ofilter">Dikhayein</label><select id="ofilter" data-chg="ofilter"><option value="all">Sab orders</option>' + Object.keys(STATUS).map(function (k) { return '<option value="' + k + '"' + (ordersFilter === k ? " selected" : "") + '>' + STATUS[k] + '</option>'; }).join("") + '</select></div><div><button class="btn sm" data-act="exp" data-v="orders">Orders CSV download</button></div></div>';
    if (!list.length) return h + '<p class="empty">Abhi koi order nahi hai.</p>';
    list.forEach(function (o) {
      h += '<div class="card"><div class="ohead"><span>' + esc(o.no) + ' · ' + fmtTime(o.ts) + '</span><span class="badge ' + (o.status === "done" ? "done" : "") + '">' + STATUS[o.status] + '</span></div>' +
        '<div><b>' + esc(o.name) + '</b> · +91 ' + esc(o.phone) + ' · <span class="badge' + (o.type === "delivery" ? '' : ' done') + '">' + (o.type === "delivery" ? "Delivery" : "Takeaway") + '</span></div>' +
        (o.type === "delivery" && o.addr ? '<div>Pata: ' + esc(o.addr) + '</div>' : '') +
        '<div>' + o.items.map(function (i) { return esc(i.qty + " × " + i.name) + " (" + rs(i.qty * i.price) + ")"; }).join("<br>") + '</div>' +
        (o.note ? '<div class="hint">Note: ' + esc(o.note) + '</div>' : '') + (o.fee ? '<div class="hint">Delivery charge: ' + rs(o.fee) + '</div>' : '') +
        '<div class="ohead"><span>Total</span><span>' + rs(o.total) + '</span></div>' +
        '<div class="row2"><div class="field"><label for="st' + o.id + '">Status</label><select id="st' + o.id + '" data-chg="status" data-id="' + o.id + '">' + Object.keys(STATUS).map(function (k) { return '<option value="' + k + '"' + (o.status === k ? " selected" : "") + '>' + STATUS[k] + '</option>'; }).join("") + '</select></div>' +
        '<div class="bar-actions"><a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/91' + esc(o.phone) + '">Customer ko WhatsApp</a><button class="btn sm" data-act="printBill" data-id="' + o.id + '">Print bill</button><button class="btn sm danger" data-act="delOrder" data-id="' + o.id + '">Delete</button></div></div></div>';
    });
    return h;
  }
  function adminMenu() {
    var h = '<div class="card"><h3>Naya item jodein</h3><div class="mrow"><div class="field"><label for="nName">Naam</label><input type="text" id="nName" maxlength="60" placeholder="Jaise: Paneer Roll"></div><div class="field"><label for="nPrice">Rate (₹)</label><input type="number" id="nPrice" min="0" step="1" inputmode="numeric"></div></div>' +
      '<div class="field"><label for="nHalf">Half ka rate (₹). Half nahi hai toh khali chhodein</label><input type="number" id="nHalf" min="0" step="1" inputmode="numeric"></div><div class="row2"><div class="field"><label for="nCat">Category</label><input type="text" id="nCat" maxlength="30" list="catlist" placeholder="Jaise: Rolls"><datalist id="catlist">' + cats().map(function (c) { return '<option value="' + esc(c) + '">'; }).join("") + '</datalist></div><div class="field"><label for="nType">Type</label><select id="nType"><option value="veg">Shakahari</option><option value="egg">Egg</option></select></div></div>' +
      '<div class="field"><label for="nDesc">Chhota vivaran (optional)</label><input type="text" id="nDesc" maxlength="120"></div><button class="btn primary" data-act="addItem">Item jodein</button></div>';
    h += '<p class="hint">Neeche kuch bhi badalne par apne aap save ho jata hai aur customers ko turant dikhta hai.</p>';
    S.menu.forEach(function (i) {
      h += '<div class="card"><div class="mrow"><div class="field"><label for="n' + i.id + '">Naam</label><input type="text" id="n' + i.id + '" maxlength="60" value="' + esc(i.name) + '" data-chg="mf" data-f="name" data-id="' + i.id + '"></div><div class="field"><label for="p' + i.id + '">Rate (₹)</label><input type="number" id="p' + i.id + '" min="0" step="1" inputmode="numeric" value="' + i.price + '" data-chg="mf" data-f="price" data-id="' + i.id + '"></div></div>' +
        '<div class="mrow2"><div class="field"><label for="c' + i.id + '">Category</label><input type="text" id="c' + i.id + '" maxlength="30" list="catlist" value="' + esc(i.cat) + '" data-chg="mf" data-f="cat" data-id="' + i.id + '"></div><div class="field"><label for="t' + i.id + '">Type</label><select id="t' + i.id + '" data-chg="mf" data-f="type" data-id="' + i.id + '"><option value="veg"' + (i.type === "veg" ? " selected" : "") + '>Shakahari</option><option value="egg"' + (i.type === "egg" ? " selected" : "") + '>Egg</option></select></div><div class="field"><label for="h' + i.id + '">Half rate (₹), khali = half nahi</label><input type="number" id="h' + i.id + '" min="0" step="1" inputmode="numeric" value="' + (i.half != null ? i.half : "") + '" data-chg="mf" data-f="half" data-id="' + i.id + '"></div></div>' +
        '<div class="field"><label for="d' + i.id + '">Vivaran</label><input type="text" id="d' + i.id + '" maxlength="120" value="' + esc(i.desc) + '" data-chg="mf" data-f="desc" data-id="' + i.id + '"></div>' +
        '<div class="ohead"><label class="chk"><input type="checkbox" data-chg="mf" data-f="avail" data-id="' + i.id + '"' + (i.avail ? " checked" : "") + '> Abhi available hai</label><button class="btn sm danger" data-act="delItem" data-id="' + i.id + '">Delete</button></div></div>';
    });
    return h;
  }
  function adminCustomers() {
    var list = AD.customers.slice().sort(function (a, b) { return (b.last || 0) - (a.last || 0); });
    var h = '<div class="bar-actions"><button class="btn sm" data-act="exp" data-v="customers">Customers CSV download</button></div>';
    if (!list.length) return h + '<p class="empty">Abhi koi customer nahi hai. Pehla order aane par yahan dikhega.</p>';
    return h + '<div class="card scroll"><table><thead><tr><th>Naam</th><th>Mobile</th><th class="n">Orders</th><th class="n">Kul kharcha</th><th>Pehla login</th><th>Aakhri order</th></tr></thead><tbody>' +
      list.map(function (c) { return '<tr><td>' + esc(c.name || "-") + '</td><td>' + esc(c.phone) + '</td><td class="n">' + c.orders + '</td><td class="n">' + rs(c.spent) + '</td><td>' + fmtTime(c.first) + '</td><td>' + (c.orders ? fmtTime(c.last) : "-") + '</td></tr>'; }).join("") + '</tbody></table></div>';
  }
  function siteUrl() { return location.href.split(/[?#]/)[0]; }
  function adminQR() {
    var url = siteUrl(), warn = (location.protocol === "file:" || /^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname));
    var h = '<div class="card"><h3>Dukaan ka QR</h3><p class="hint">Ye QR customer ko seedha is menu par laata hai. Wo Takeaway ya Delivery chunkar order karta hai. Dukaan ke bahar, pamphlet, bill ya packet par lagayein.</p><dl><dt>Link</dt><dd>' + esc(url) + '</dd></dl>' +
      (warn ? '<p class="err">Ye link sirf aapke wifi ya computer par chalega. Site ko internet par (GitHub Pages, Netlify jaisi hosting par) daalne ke baad yahan se QR banayein.</p>' : '') +
      '<div class="bar-actions"><button class="btn primary sm" data-act="printQr">QR print karein</button></div></div>';
    try { h += '<div class="qrgrid"><div class="qrcard">' + qrSvgString(url) + '<b>Menu dekhein aur order karein</b><small>Delivery aur Takeaway</small><button class="btn sm" data-act="pngQr">PNG download</button></div></div>'; }
    catch (e) { h += '<p class="err">Link bahut lamba hai, QR nahi ban paya.</p>'; }
    return h;
  }
  function adminSettings() {
    var s = AD.settings;
    return '<div class="card"><h3>Dukaan chalu / band</h3><label><input type="checkbox" id="sOpen" data-chg="set" data-f="open"' + (s.open === false ? '' : ' checked') + '> Abhi order le rahe hain (band karne par customers order nahi kar payenge)</label></div>' +
      '<div class="card"><h3>Delivery aur minimum order</h3><div class="field"><label for="sFee">Delivery charge (₹, 0 = free)</label><input type="number" id="sFee" min="0" inputmode="numeric" value="' + (s.deliveryFee || 0) + '" data-chg="set" data-f="deliveryFee"></div><div class="field"><label for="sFree">Itne ₹ ke order par delivery free (0 = kabhi nahi)</label><input type="number" id="sFree" min="0" inputmode="numeric" value="' + (s.freeAbove || 0) + '" data-chg="set" data-f="freeAbove"></div><div class="field"><label for="sMin">Kam se kam order (₹, 0 = koi limit nahi)</label><input type="number" id="sMin" min="0" inputmode="numeric" value="' + (s.minOrder || 0) + '" data-chg="set" data-f="minOrder"></div></div>' +
      '<div class="card"><h3>Dukaan ki jaankari</h3>' +
      '<div class="field"><label for="sName">Dukaan ka naam</label><input type="text" id="sName" maxlength="60" value="' + esc(s.name) + '" data-chg="set" data-f="name"></div>' +
      '<div class="field"><label for="sWa">WhatsApp number (order yahin aayenge)</label><input type="tel" id="sWa" inputmode="numeric" maxlength="13" placeholder="98XXXXXXXX" value="' + esc(s.whatsapp) + '" data-chg="set" data-f="whatsapp"></div>' +
      '<div class="field"><label for="sHours">Timing</label><input type="text" id="sHours" maxlength="120" value="' + esc(s.hours) + '" data-chg="set" data-f="hours"></div>' +
      '<div class="field"><label for="sAddr">Pata</label><input type="text" id="sAddr" maxlength="200" value="' + esc(s.address) + '" data-chg="set" data-f="address"></div></div>' +
      '<div class="card"><h3>Password badlein</h3><div class="field"><label for="pOld">Purana password</label><input type="password" id="pOld" autocomplete="current-password"></div><div class="field"><label for="pNew">Naya password (kam se kam 8 akshar)</label><input type="password" id="pNew" autocomplete="new-password"></div><div class="field"><label for="pNew2">Naya password dobara</label><input type="password" id="pNew2" autocomplete="new-password"></div><button class="btn primary" data-act="chgPass">Password badlein</button></div>' +
      '<div class="card"><h3>Backup</h3><p class="hint">Sara data Supabase mein surakshit hai. Phir bhi kabhi kabhi backup download karke rakhein.</p><div class="bar-actions"><button class="btn sm" data-act="exp" data-v="backup">Backup download</button></div></div>';
  }

  /* ---------- render ---------- */
  function render() {
    var y = window.scrollY;
    $("#app").innerHTML = (view === "admin" && adminOk && AD ? adminHTML() : shopHTML()) + modalHTML();
    if (focusId) { var el = document.getElementById(focusId); if (el) el.focus(); focusId = null; } else window.scrollTo(0, y);
  }
  function changeCart(id, s, d) {
    var k = ck(id, s); cart[k] = Math.max(0, Math.min(50, (cart[k] || 0) + d)); if (!cart[k]) delete cart[k];
    if (!cartTotals().n && modal === "cart") modal = null;
    render();
  }
  function setBusy(v) { busy = v; render(); }

  /* ---------- actions ---------- */
  var A = {
    cat: function (t) { active = t.dataset.v; render(); },
    add: function (t) { changeCart(+t.dataset.id, t.dataset.s || "f", 1); },
    dec: function (t) { changeCart(+t.dataset.id, t.dataset.s || "f", -1); },
    useAddr: function (t) { draft.addr = prof().addrs[+t.dataset.i] || ""; focusId = "cAddr"; render(); },
    veg: function () { vegOnly = !vegOnly; render(); },
    reorder: function (t) {
      var o = mine && mine.orders.find(function (x) { return x.no === t.dataset.no; }), miss = 0; if (!o) return;
      o.items.forEach(function (i) { var m = S.menu.find(function (x) { return x.id === i.id; }), s = i.size === "h" ? "h" : "f";
        if (m && m.avail && (s !== "h" || m.half != null)) cart[ck(m.id, s)] = Math.min(50, (cart[ck(m.id, s)] || 0) + i.qty); else miss++; });
      modal = "cart"; if (miss) toast(miss + " item abhi available nahi hai"); render();
    },
    printBill: function (t) {
      var o = AD.orders.find(function (x) { return x.id === +t.dataset.id; }); if (!o) return;
      var w = window.open("", "_blank", "width=380,height=600"); if (!w) return toast("Popup allow karein");
      w.document.write('<title>' + esc(o.no) + '</title><body style="font:14px monospace;width:300px"><h3 style="text-align:center">' + esc(S.settings.name) + '</h3><p>' + esc(o.no) + ' · ' + fmtTime(o.ts) + '<br>' + esc(o.name) + ' · ' + esc(o.phone) + '<br>' + (o.type === "delivery" ? "DELIVERY: " + esc(o.addr) : "TAKEAWAY") + '</p><hr>' +
        o.items.map(function (i) { return esc(i.qty + " x " + i.name) + " — " + rs(i.qty * i.price); }).join("<br>") + '<hr>' + (o.fee ? "Delivery: " + rs(o.fee) + "<br>" : "") + '<b>Total: ' + rs(o.total) + '</b>' + (o.note ? '<p>Note: ' + esc(o.note) + '</p>' : '') + '<p style="text-align:center">Dhanyavaad!</p><script>onload=function(){print()}<\/script>');
      w.document.close();
    },
    openMine: function () {
      mine = null; modal = "mine"; render();
      api("GET", "/api/myorders").then(function (r) { mine = r.ok ? r.data : { err: r.data.error || "Orders nahi mile." }; if (modal === "mine") render(); });
    },
    openCart: function () { lastOrder = null; modal = "cart"; render(); },
    closeModal: function () { modal = null; lastOrder = null; render(); },
    scrim: function (t, e) { if (e.target === t) A.closeModal(); },
    openLogin: function () { otp = { phone: "", step: "phone", err: "", dev: "" }; modal = "login"; focusId = "phoneIn"; render(); },
    logout: function () { api("POST", "/api/logout").then(function () { S.me = null; draft.name = ""; toast("Logout ho gaya"); render(); }); },
    sendOtp: function () {
      var p = ($("#phoneIn").value || "").replace(/\D/g, ""); otp.phone = p;
      if (!/^[6-9]\d{9}$/.test(p)) { otp.err = "Sahi 10 digit mobile number daalein."; focusId = "phoneIn"; return render(); }
      if (busy) return; setBusy(true);
      if (S.loginMode === "simple") {
        return api("POST", "/api/login/simple", { phone: p }).then(function (r) {
          busy = false;
          if (r.ok) { S.me = r.data.me; modal = cartTotals().n ? "cart" : null; toast("Login ho gaya"); } else { otp.err = r.data.error || "Login nahi hua."; focusId = "phoneIn"; }
          render();
        });
      }
      api("POST", "/api/otp/send", { phone: p }).then(function (r) {
        busy = false;
        if (r.ok) { otp.step = "otp"; otp.err = ""; otp.dev = r.data.devOtp || ""; focusId = "otpIn"; } else { otp.err = r.data.error || "OTP nahi bhej paye."; focusId = "phoneIn"; }
        render();
      });
    },
    resendOtp: function () {
      if (busy) return; setBusy(true);
      api("POST", "/api/otp/send", { phone: otp.phone }).then(function (r) {
        busy = false; if (r.ok) { otp.err = ""; otp.dev = r.data.devOtp || ""; toast("Naya OTP bhej diya"); } else otp.err = r.data.error || "OTP nahi bhej paye.";
        focusId = "otpIn"; render();
      });
    },
    changeNum: function () { otp.step = "phone"; otp.err = ""; focusId = "phoneIn"; render(); },
    verifyOtp: function () {
      var v = ($("#otpIn").value || "").trim();
      if (!/^\d{6}$/.test(v)) { otp.err = "6 digit ka OTP daalein."; focusId = "otpIn"; return render(); }
      if (busy) return; setBusy(true);
      api("POST", "/api/otp/verify", { phone: otp.phone, otp: v }).then(function (r) {
        busy = false;
        if (r.ok) { S.me = r.data.me; modal = cartTotals().n ? "cart" : null; toast("Login ho gaya"); }
        else { otp.err = r.data.error || "OTP galat hai."; if (/dobara|naya|samay/i.test(otp.err)) otp.step = "phone"; focusId = otp.step === "otp" ? "otpIn" : "phoneIn"; }
        render();
      });
    },
    placeOrder: function () {
      if (S.settings.open === false) return toast("Dukaan abhi band hai");
      if (S.settings.minOrder > cartTotals().t) return toast("Kam se kam " + rs(S.settings.minOrder) + " ka order chahiye");
      var name = ($("#cName").value || "").trim(), ty = $("#cType").value === "delivery" ? "delivery" : "takeaway", addr = ty === "delivery" ? ($("#cAddr").value || "").trim() : "", note = ($("#cNote").value || "").trim();
      if (!name) { toast("Apna naam likhein"); $("#cName").focus(); return; }
      if (ty === "delivery" && addr.length < 8) { toast("Delivery ka poora pata likhein"); $("#cAddr").focus(); return; }
      if (busy) return;
      var items = cartLines().map(function (x) { return { id: x.i.id, size: x.s, qty: x.q }; });
      setBusy(true);
      api("POST", "/api/orders", { name: name, type: ty, addr: addr, note: note, items: items }).then(function (r) {
        busy = false;
        if (r.ok) {
          lastOrder = { no: r.data.no, url: r.data.waUrl }; cart = {};
          if (S.me) { var pf = prof(); pf.name = name; if (ty === "delivery") { pf.addrs = [addr].concat(pf.addrs.filter(function (a) { return a !== addr; })).slice(0, 3); pf.oaddr[r.data.no] = addr; var ks = Object.keys(pf.oaddr); if (ks.length > 60) delete pf.oaddr[ks[0]]; } saveProf(pf); } draft = { name: name, note: "", type: "takeaway", addr: "" }; if (S.me) S.me.name = name; render();
          var w = null; try { w = window.open(lastOrder.url, "_blank"); } catch (e) {}
          if (!w) toast("Neeche WhatsApp kholein dabayein");
        } else if (r.status === 401) { S.me = null; modal = "login"; otp = { phone: "", step: "phone", err: "Login ki avadhi khatam. Dobara login karein.", dev: "" }; render(); }
        else { toast(r.data.error || "Order nahi ja saka"); if (r.status === 409) loadPublic().then(render); else render(); }
      });
    },
    openAdmin: function () {
      if (adminOk) { loadAdmin().then(function (r) { if (r.ok) { view = "admin"; tab = "orders"; render(); window.scrollTo(0, 0); } else { adm.err = ""; modal = "admin"; focusId = "admEmail"; render(); } }); return; }
      adm.err = ""; modal = "admin"; focusId = "admEmail"; render();
    },
    admLogin: function () {
      var pw = $("#admPass").value || ""; adm.email = ($("#admEmail").value || "").trim(); if (busy) return; setBusy(true);
      api("POST", "/api/admin/login", { email: adm.email, password: pw }).then(function (r) {
        if (!r.ok) { busy = false; adm.err = r.data.error || "Login nahi hua."; focusId = "admEmail"; return render(); }
        adminOk = true; return loadAdmin().then(function () { busy = false; modal = null; view = "admin"; tab = "orders"; render(); window.scrollTo(0, 0); });
      });
    },
    admLogout: function () { api("POST", "/api/admin/logout").then(function () { adminOk = false; AD = null; view = "shop"; render(); window.scrollTo(0, 0); }); },
    toShop: function () { loadPublic().then(function () { view = "shop"; render(); window.scrollTo(0, 0); }); },
    exp: function (t) { window.exportData(t.dataset.v); },
    tab: function (t) { tab = t.dataset.v; render(); },
    addItem: function () {
      var n = $("#nName").value.trim(), p = parseFloat($("#nPrice").value);
      if (!n || isNaN(p) || p < 0) { toast("Naam aur sahi rate daalein"); return; }
      api("POST", "/api/admin/menu", { name: n, price: p, half: $("#nHalf").value, cat: $("#nCat").value.trim() || "Anya", type: $("#nType").value, desc: $("#nDesc").value.trim() }).then(function (r) {
        if (!r.ok) return toast(r.data.error || "Item nahi jud paya");
        S.menu.push(r.data.item); AD.menu = S.menu; toast("Item jod diya"); render();
      });
    },
    delItem: function (t) {
      var it = S.menu.find(function (i) { return i.id === +t.dataset.id; });
      if (!it || !confirm('"' + it.name + '" delete karein?')) return;
      api("DELETE", "/api/admin/menu/" + it.id).then(function (r) { if (!r.ok) return toast(r.data.error || "Delete nahi hua"); S.menu = S.menu.filter(function (i) { return i.id !== it.id; }); AD.menu = S.menu; render(); });
    },
    delOrder: function (t) {
      if (!confirm("Ye order delete karein?")) return;
      api("DELETE", "/api/admin/orders/" + t.dataset.id).then(function (r) { if (!r.ok) return toast(r.data.error || "Delete nahi hua"); AD.orders = AD.orders.filter(function (o) { return o.id !== +t.dataset.id; }); render(); });
    },
    chgPass: function () {
      var o = $("#pOld").value, n = $("#pNew").value, n2 = $("#pNew2").value;
      if (n.length < 8) return toast("Naya password kam se kam 8 akshar ka ho");
      if (n !== n2) return toast("Dono naye password milte nahi");
      api("POST", "/api/admin/password", { old: o, "new": n }).then(function (r) { if (!r.ok) return toast(r.data.error || "Password nahi badla"); toast("Password badal gaya"); render(); });
    },
    pngQr: function () {
      var q = makeQR(siteUrl()), m = q.size + 8, sc = Math.max(4, Math.floor(480 / m));
      var W = 600, H = m * sc + 230, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
      var x = cv.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, W, H); x.fillStyle = "#111"; x.textAlign = "center";
      var fs = 46; do { x.font = "700 " + fs + "px Mukta, system-ui, sans-serif"; fs -= 2; } while (x.measureText(S.settings.name).width > W - 40 && fs > 18);
      x.fillText(S.settings.name, W / 2, 70);
      var x0 = Math.floor((W - m * sc) / 2), y0 = 100;
      for (var yy = 0; yy < q.size; yy++) for (var xx = 0; xx < q.size; xx++) if (q.modules[yy][xx]) x.fillRect(x0 + (xx + 4) * sc, y0 + (yy + 4) * sc, sc, sc);
      x.font = "700 40px Mukta, system-ui, sans-serif"; x.fillText("Delivery aur Takeaway", W / 2, y0 + m * sc + 50);
      x.font = "400 26px Mukta, system-ui, sans-serif"; x.fillText("Scan karein, menu dekhein, order karein", W / 2, y0 + m * sc + 92);
      cv.toBlob(function (b) { var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "qr-menu.png"; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); });
    },
    printQr: function () {
      $("#printSheet").innerHTML = '<div class="pgrid"><div class="pcard"><h2>' + esc(S.settings.name) + '</h2>' + qrSvgString(siteUrl()) + '<p>Delivery aur Takeaway</p><small>Scan karein, menu dekhein aur order karein</small></div></div>';
      try { window.print(); } catch (e) { toast("Print nahi khul saka. PNG download karke print karein"); }
    }
  };
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-act]"); if (!t) return;
    var f = A[t.dataset.act]; if (f) f(t, e);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal) A.closeModal();
    if (e.key === "Enter" && e.target.tagName === "INPUT") {
      if (e.target.id === "phoneIn") A.sendOtp(); else if (e.target.id === "otpIn") A.verifyOtp(); else if (e.target.id === "admPass" || e.target.id === "admEmail") A.admLogin();
    }
  });
  document.addEventListener("input", function (e) {
    var t = e.target;
    if (t.id === "qIn" || t.id === "oqIn") { if (t.id === "qIn") q = t.value; else oq = t.value; focusId = t.id; render(); var el2 = document.getElementById(t.id); if (el2) el2.setSelectionRange(t.value.length, t.value.length); return; }
    if (t.dataset && t.dataset.chg === "draft" && t.dataset.f !== "type") draft[t.dataset.f] = t.value;
  });
  document.addEventListener("change", function (e) {
    var t = e.target, k = t.dataset && t.dataset.chg; if (!k) return;
    if (k === "draft") { draft[t.dataset.f] = t.value; if (t.dataset.f === "type") render(); }
    else if (k === "ofilter") { ordersFilter = t.value; render(); }
    else if (k === "status") {
      api("PATCH", "/api/admin/orders/" + t.dataset.id, { status: t.value }).then(function (r) {
        if (!r.ok) toast(r.data.error || "Status nahi badla"); else { var o = AD.orders.find(function (x) { return x.id === +t.dataset.id; }); if (o) o.status = t.value; }
        render();
      });
    } else if (k === "mf") {
      var id = +t.dataset.id, f = t.dataset.f, body = {}; body[f] = f === "avail" ? t.checked : t.value;
      api("PATCH", "/api/admin/menu/" + id, body).then(function (r) {
        if (!r.ok) { toast(r.data.error || "Save nahi hua"); return render(); }
        var it = S.menu.find(function (x) { return x.id === id; }); if (it) Object.assign(it, r.data.item); toast("Save ho gaya");
        if (f === "cat") render();
      });
    } else if (k === "set") {
      var b2 = {}; b2[t.dataset.f] = t.type === "checkbox" ? t.checked : t.value;
      api("PUT", "/api/admin/settings", b2).then(function (r) {
        if (!r.ok) { toast(r.data.error || "Save nahi hua"); return loadAdmin().then(render); }
        AD.settings = r.data.settings; S.settings = r.data.settings; document.title = S.settings.name; toast("Save ho gaya");
        if (/^(whatsapp|open)$/.test(t.dataset.f)) render();
      });
    }
  });

  /* naye orders ka pata lagana */
  var known = null;
  setInterval(function () {
    if (view !== "admin" || !adminOk || modal) return;
    var ae = document.activeElement; if (ae && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)) return;
    api("GET", "/api/admin/data").then(function (r) {
      if (!r.ok) { if (r.status === 401) { adminOk = false; AD = null; view = "shop"; render(); } return; }
      var sig = r.data.orders.map(function (o) { return o.id + o.status; }).join(",");
      if (known !== null && r.data.orders.length > AD.orders.length) { toast("Naya order aaya!"); beep(); }
      if (sig !== known) { known = sig; AD = r.data; S.menu = r.data.menu; render(); }
    });
  }, 10000);

  setInterval(function () { if (modal !== "mine" || !S.me) return; api("GET", "/api/myorders").then(function (r) { if (r.ok && modal === "mine") { mine = r.data; render(); } }); }, 15000);
  loadPublic().then(render);
})();
