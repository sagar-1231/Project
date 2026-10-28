"use strict";
/* Browser se seedha Supabase se baat karta hai. app.js ko lagta hai ye ek server hai. */
(function () {
  var C = window.APP_CONFIG || {}, URL = String(C.supabaseUrl || "").replace(/\/+$/, ""), KEY = C.supabaseAnonKey || "";
  var TK = "ak_tok", RF = "ak_ref", EM = "ak_em", ME = "ak_me", settingsCache = { name: "Aaru's Kitchen", whatsapp: "", hours: "", address: "" };
  function ok(d) { return { ok: true, status: 200, data: d || { ok: true } }; }
  function bad(s, m) { return { ok: false, status: s, data: { error: m } }; }
  function tok() { return sessionStorage.getItem(TK); }
  function setTok(d, em) { sessionStorage.setItem(TK, d.access_token); if (d.refresh_token) sessionStorage.setItem(RF, d.refresh_token); if (em) sessionStorage.setItem(EM, em); }
  function clearTok() { sessionStorage.removeItem(TK); sessionStorage.removeItem(RF); sessionStorage.removeItem(EM); }
  function me() { try { return JSON.parse(localStorage.getItem(ME)); } catch (e) { return null; } }
  function msg(r) { var d = r.data || {}; return d.message || d.msg || d.error_description || d.error || "Server se jud nahi paye. Dobara koshish karein."; }
  function raw(method, path, body, prefer) {
    var h = { apikey: KEY, "Content-Type": "application/json" }; if (tok() || /^eyJ/.test(KEY)) h.Authorization = "Bearer " + (tok() || KEY); if (prefer) h.Prefer = prefer;
    return fetch(URL + path, { method: method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }).then(function (r) {
      return r.text().then(function (t) { var d = null; try { d = t ? JSON.parse(t) : null; } catch (e) {} return { ok: r.ok, status: r.status, data: d }; });
    }).catch(function () { return { ok: false, status: 0, data: { error: "Internet ya server se jud nahi paye. Dobara koshish karein." } }; });
  }
  function refresh() {
    var rt = sessionStorage.getItem(RF); if (!rt) return Promise.resolve(false);
    return fetch(URL + "/auth/v1/token?grant_type=refresh_token", { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: rt }) })
      .then(function (r) { return r.json(); }).then(function (d) { if (d.access_token) { setTok(d); return true; } clearTok(); return false; }).catch(function () { return false; });
  }
  function rest(method, path, body, prefer) {
    return raw(method, path, body, prefer).then(function (r) { return r.status === 401 && tok() ? refresh().then(function (g) { return g ? raw(method, path, body, prefer) : r; }) : r; });
  }
  function fail(r) { return bad(/Menu badal|available nahi|half nahi/.test(msg(r)) ? 409 : (r.status === 401 ? 401 : r.status || 400), msg(r)); }
  function toItem(r) { return { id: r.id, name: r.name, cat: r.cat, price: +r.price, half: r.half == null ? null : +r.half, type: r.type, desc: r.descr || "", avail: !!r.avail }; }
  function toOrder(r) { return { id: r.id, no: r.no, ts: +r.ts, name: r.name, phone: r.phone, type: r.type, addr: r.addr || "", note: r.note || "", items: r.items || [], total: +r.total, status: r.status }; }
  function money(n) { return Math.round(n * 100) / 100; }
  function str(v, n) { return String(v == null ? "" : v).trim().slice(0, n); }
  function fields(b, row) {
    if ("name" in b) { var n = str(b.name, 60); if (!n) return "Naam likhein."; row.name = n; }
    if ("price" in b) { var p = parseFloat(b.price); if (isNaN(p) || p < 0) return "Sahi rate daalein."; row.price = money(p); }
    if ("half" in b) { if (b.half === "" || b.half == null) row.half = null; else { var h = parseFloat(b.half); if (isNaN(h) || h < 0) return "Sahi half rate daalein."; row.half = money(h); } }
    if ("cat" in b) row.cat = str(b.cat, 30) || "Anya";
    if ("type" in b) row.type = b.type === "egg" ? "egg" : "veg";
    if ("desc" in b) row.descr = str(b.desc, 120);
    if ("avail" in b) row.avail = !!b.avail;
    return null;
  }
  function loadSettings() { return rest("GET", "/rest/v1/settings?select=*&id=eq.1").then(function (r) { if (r.ok && r.data && r.data[0]) { var s = r.data[0]; settingsCache = { name: s.name, whatsapp: s.whatsapp || "", hours: s.hours || "", address: s.address || "" }; } return r; }); }
  function custs(orders) {
    var m = {}; orders.forEach(function (o) { var c = m[o.phone] || (m[o.phone] = { phone: o.phone, name: o.name, orders: 0, spent: 0, first: o.ts, last: o.ts }); c.name = o.name; c.orders++; c.spent = money(c.spent + o.total); c.first = Math.min(c.first, o.ts); c.last = Math.max(c.last, o.ts); });
    return Object.keys(m).map(function (k) { return m[k]; });
  }
  function adminData() {
    return Promise.all([loadSettings(), rest("GET", "/rest/v1/menu?select=*&order=id"), rest("GET", "/rest/v1/orders?select=*&order=ts.asc")]).then(function (a) {
      for (var i = 0; i < 3; i++) if (!a[i].ok) return fail(a[i]);
      var orders = a[2].data.map(toOrder); return ok({ settings: settingsCache, menu: a[1].data.map(toItem), orders: orders, customers: custs(orders) });
    });
  }
  function csvCell(v) { var s = String(v == null ? "" : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }
  function download(name, text, type) { var a = document.createElement("a"); a.href = URL_.createObjectURL(new Blob([text], { type: type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL_.revokeObjectURL(a.href); a.remove(); }, 500); }
  var URL_ = window.URL;
  window.exportData = function (what) {
    adminData().then(function (r) {
      if (!r.ok) return; var d = r.data, day = new Date().toISOString().slice(0, 10);
      var tbl = function (rows) { return "\ufeff" + rows.map(function (x) { return x.map(csvCell).join(","); }).join("\r\n"); };
      if (what === "orders") download("orders-" + day + ".csv", tbl([["Order", "Time", "Naam", "Mobile", "Type", "Pata", "Items", "Total", "Status", "Note"]].concat(d.orders.map(function (o) { return [o.no, new Date(o.ts).toLocaleString("en-IN"), o.name, o.phone, o.type, o.addr, o.items.map(function (i) { return i.qty + " x " + i.name; }).join("; "), o.total, o.status, o.note]; }))), "text/csv");
      else if (what === "customers") download("customers-" + day + ".csv", tbl([["Naam", "Mobile", "Orders", "Kul kharcha"]].concat(d.customers.map(function (c) { return [c.name, c.phone, c.orders, c.spent]; }))), "text/csv");
      else download("backup-" + day + ".json", JSON.stringify(d, null, 1), "application/json");
    });
  };
  window.localApi = function (method, url, b) {
    b = b || {}; var m;
    if (!URL || !KEY) return Promise.resolve(bad(0, "config.js mein Supabase URL aur key bharein (README dekhein)."));
    if (url === "/api/public") return Promise.all([loadSettings(), rest("GET", "/rest/v1/menu?select=*&order=id")]).then(function (a) {
      if (!a[1].ok) return fail(a[1]); return ok({ settings: settingsCache, menu: a[1].data.map(toItem), me: me(), admin: !!tok(), devOtp: false, loginMode: "simple" }); });
    if (url === "/api/login/simple") {
      var p = String(b.phone || "").replace(/\D/g, ""); if (!/^[6-9]\d{9}$/.test(p)) return Promise.resolve(bad(400, "Sahi 10 digit mobile number daalein."));
      var old = me(), u = { phone: p, name: old && old.phone === p ? old.name : "" }; localStorage.setItem(ME, JSON.stringify(u)); return Promise.resolve(ok({ me: u }));
    }
    if (url === "/api/logout") { localStorage.removeItem(ME); return Promise.resolve(ok()); }
    if (url === "/api/orders") {
      var u2 = me(); if (!u2) return Promise.resolve(bad(401, "Login karein."));
      return rest("POST", "/rest/v1/rpc/place_order", { p_name: b.name, p_phone: u2.phone, p_type: b.type, p_addr: b.addr || "", p_note: b.note || "", p_items: b.items }).then(function (r) {
        if (!r.ok) return fail(r); var o = r.data, s = settingsCache, type = b.type === "delivery" ? "delivery" : "takeaway", name = String(b.name).trim();
        u2.name = name; localStorage.setItem(ME, JSON.stringify(u2));
        var text = "*Naya order - " + s.name + "*\nOrder no: " + o.no + "\nNaam: " + name + "\nMobile: " + u2.phone + "\n" + (type === "delivery" ? "*Delivery*\nPata: " + String(b.addr).trim() : "*Takeaway*") + "\n\n" +
          o.items.map(function (i) { return i.qty + " x " + i.name + " = ₹" + money(i.qty * i.price); }).join("\n") + "\n\n*Total: ₹" + money(o.total) + "*" + (b.note ? "\nNote: " + String(b.note).trim() : "");
        var d = String(s.whatsapp || "").replace(/\D/g, ""); if (d.length === 10) d = "91" + d;
        return ok({ ok: true, no: o.no, total: o.total, waUrl: "https://wa.me/" + d + "?text=" + encodeURIComponent(text) });
      });
    }
    if (url === "/api/admin/login") {
      var em = String(b.email || "").trim();
      return fetch(URL + "/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: em, password: b.password }) })
        .then(function (r) { return r.json().then(function (d) { if (!r.ok || !d.access_token) return bad(401, "Email ya password galat hai."); setTok(d, em); return ok(); }); })
        .catch(function () { return bad(0, "Internet ya server se jud nahi paye."); });
    }
    if (url === "/api/admin/logout") { clearTok(); return Promise.resolve(ok()); }
    if (!tok()) return Promise.resolve(bad(401, "Admin login chahiye."));
    if (url === "/api/admin/data") return adminData().then(function (r) { if (r.status === 401) clearTok(); return r; });
    if (url === "/api/admin/password") {
      return fetch(URL + "/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: sessionStorage.getItem(EM), password: b.old }) })
        .then(function (r) { if (!r.ok) return bad(401, "Purana password galat hai."); return rest("PUT", "/auth/v1/user", { password: b["new"] }).then(function (x) { return x.ok ? ok() : fail(x); }); })
        .catch(function () { return bad(0, "Internet ya server se jud nahi paye."); });
    }
    if (url === "/api/admin/settings") {
      var row = {}; ["name", "whatsapp", "hours", "address"].forEach(function (k) { if (k in b) row[k] = str(b[k], k === "address" ? 200 : k === "hours" ? 120 : k === "whatsapp" ? 13 : 60); });
      if ("name" in row && !row.name) return Promise.resolve(bad(400, "Dukaan ka naam likhein."));
      return rest("PATCH", "/rest/v1/settings?id=eq.1", row, "return=representation").then(function (r) { if (!r.ok) return fail(r); settingsCache = Object.assign({}, settingsCache, row); return ok({ settings: settingsCache }); });
    }
    if (url === "/api/admin/menu" && method === "POST") {
      var nr = { avail: true, type: "veg", cat: "Anya", descr: "" }, er = fields(b, nr); if (er || !nr.name || nr.price == null) return Promise.resolve(bad(400, er || "Naam aur rate daalein."));
      return rest("POST", "/rest/v1/menu", nr, "return=representation").then(function (r) { return r.ok ? ok({ item: toItem(r.data[0]) }) : fail(r); });
    }
    if ((m = url.match(/^\/api\/admin\/menu\/(\d+)$/))) {
      if (method === "DELETE") return rest("DELETE", "/rest/v1/menu?id=eq." + m[1]).then(function (r) { return r.ok ? ok() : fail(r); });
      var up = {}, e2 = fields(b, up); if (e2) return Promise.resolve(bad(400, e2));
      return rest("PATCH", "/rest/v1/menu?id=eq." + m[1], up, "return=representation").then(function (r) { return r.ok && r.data[0] ? ok({ item: toItem(r.data[0]) }) : fail(r.ok ? { data: { message: "Item nahi mila." }, status: 404 } : r); });
    }
    if ((m = url.match(/^\/api\/admin\/orders\/(\d+)$/))) {
      if (method === "DELETE") return rest("DELETE", "/rest/v1/orders?id=eq." + m[1]).then(function (r) { return r.ok ? ok() : fail(r); });
      if (["new", "prep", "done"].indexOf(b.status) < 0) return Promise.resolve(bad(400, "Galat status."));
      return rest("PATCH", "/rest/v1/orders?id=eq." + m[1], { status: b.status }).then(function (r) { return r.ok ? ok() : fail(r); });
    }
    return Promise.resolve(bad(404, "Nahi mila."));
  };
})();
