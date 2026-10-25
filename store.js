"use strict";
/* ====== CONFIG: yahan apni dukaan ki jaankari likhein (sabhi customers ko yahi dikhegi) ====== */
var CONFIG = {
  name: "Aaru's Kitchen",
  whatsapp: "",  /* 10 digit WhatsApp number, jaise "9876543210" */
  hours: "Roz shaam 4:00 baje se raat 11:00 baje tak",
  address: "Apna pata yahan likhein",
  /* [naam, category, full rate, veg/egg, vivaran, half rate (optional)] */
  menu: [
    ["Veg Chowmein", "Noodles & Rice", 60, "veg", "Sabzi aur sauce ke saath, garam-garam", 40],
    ["Veg Fried Rice", "Noodles & Rice", 70, "veg", "Khile hue chawal, sabzi aur soya sauce", 45],
    ["Veg Manchurian", "Starters", 80, "veg", "Gravy ya dry, aapki pasand", 50],
    ["Veg Roll", "Rolls", 40, "veg", "Paneer-sabzi stuffing, tikha chutney"],
    ["Egg Roll", "Rolls", 50, "egg", "Double egg, pyaaz aur sauce"],
    ["Steamed Veg Momos (6 pcs)", "Momos", 50, "veg", "Bhaap mein bane, laal chutney ke saath"],
    ["Fried Veg Momos (6 pcs)", "Momos", 60, "veg", "Kurkure fried, mayo ke saath"],
    ["French Fries", "Snacks", 50, "veg", "Namak aur peri-peri masala"]
  ]
};
/* ====== Local "server": data browser ke localStorage mein rehta hai ====== */
(function () {
  var KEY = "ak_db_v1", SES = "ak_admin", ME = "ak_me";
  function seed() {
    return { settings: { name: CONFIG.name, whatsapp: CONFIG.whatsapp, hours: CONFIG.hours, address: CONFIG.address },
      menu: CONFIG.menu.map(function (r, i) { return { id: i + 1, name: r[0], cat: r[1], price: r[2], type: r[3], desc: r[4], half: r[5] == null ? null : r[5], avail: true }; }),
      orders: [], customers: {}, seq: 1, mid: CONFIG.menu.length + 1, adminHash: null };
  }
  var db;
  try { db = Object.assign(seed(), JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { db = seed(); }
  /* dukaan ki jaankari hamesha CONFIG se, jab tak admin ne is device par badli na ho */
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }
  function ok(d) { return { ok: true, status: 200, data: d || { ok: true } }; }
  function bad(s, m) { return { ok: false, status: s, data: { error: m } }; }
  function isAdmin() { return sessionStorage.getItem(SES) === "1"; }
  function me() { try { return JSON.parse(localStorage.getItem(ME)); } catch (e) { return null; } }
  function money(n) { return Math.round(n * 100) / 100; }
  function rs(n) { return "₹" + money(n); }
  function hash(pw) {
    var enc = new TextEncoder().encode("ak:" + pw);
    if (window.crypto && crypto.subtle) return crypto.subtle.digest("SHA-256", enc).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); });
    var h = 5381; for (var i = 0; i < enc.length; i++) h = ((h * 33) ^ enc[i]) >>> 0; return Promise.resolve("w" + h);
  }
  function str(v, n) { return String(v == null ? "" : v).trim().slice(0, n); }
  function mfields(b, it) {
    if ("name" in b) { var n = str(b.name, 60); if (!n) return "Naam likhein."; it.name = n; }
    if ("price" in b) { var p = parseFloat(b.price); if (isNaN(p) || p < 0) return "Sahi rate daalein."; it.price = money(p); }
    if ("half" in b) { if (b.half === "" || b.half == null) it.half = null; else { var h = parseFloat(b.half); if (isNaN(h) || h < 0) return "Sahi half rate daalein."; it.half = money(h); } }
    if ("cat" in b) it.cat = str(b.cat, 30) || "Anya";
    if ("type" in b) it.type = b.type === "egg" ? "egg" : "veg";
    if ("desc" in b) it.desc = str(b.desc, 120);
    if ("avail" in b) it.avail = !!b.avail;
    return null;
  }
  function csvCell(v) { var s = String(v == null ? "" : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }
  function download(name, text, type) {
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  window.exportData = function (what) {
    if (!isAdmin()) return;
    var d = new Date().toISOString().slice(0, 10);
    if (what === "orders") download("orders-" + d + ".csv", "\ufeff" + [["Order", "Time", "Naam", "Mobile", "Type", "Pata", "Items", "Total", "Status", "Note"]].concat(db.orders.map(function (o) {
      return [o.no, new Date(o.ts).toLocaleString("en-IN"), o.name, o.phone, o.type, o.addr, o.items.map(function (i) { return i.qty + " x " + i.name; }).join("; "), o.total, o.status, o.note]; })).map(function (r) { return r.map(csvCell).join(","); }).join("\r\n"), "text/csv");
    else if (what === "customers") download("customers-" + d + ".csv", "\ufeff" + [["Naam", "Mobile", "Orders", "Kul kharcha"]].concat(Object.keys(db.customers).map(function (k) { var c = db.customers[k]; return [c.name, c.phone, c.orders, c.spent]; })).map(function (r) { return r.map(csvCell).join(","); }).join("\r\n"), "text/csv");
    else download("backup-" + d + ".json", JSON.stringify(db, null, 1), "application/json");
  };
  window.localApi = function (method, url, b) {
    b = b || {}; var m;
    if (url === "/api/public") return Promise.resolve(ok({ settings: db.settings, menu: db.menu, me: me(), admin: isAdmin(), devOtp: false, loginMode: "simple" }));
    if (url === "/api/login/simple") {
      var p = String(b.phone || "").replace(/\D/g, ""); if (!/^[6-9]\d{9}$/.test(p)) return Promise.resolve(bad(400, "Sahi 10 digit mobile number daalein."));
      var c = db.customers[p] || (db.customers[p] = { phone: p, first: Date.now(), orders: 0, spent: 0, name: "" }); save();
      var u = { phone: p, name: c.name || "" }; localStorage.setItem(ME, JSON.stringify(u)); return Promise.resolve(ok({ me: u }));
    }
    if (url === "/api/logout") { localStorage.removeItem(ME); return Promise.resolve(ok()); }
    if (url === "/api/orders") {
      var u2 = me(); if (!u2) return Promise.resolve(bad(401, "Login karein."));
      var name = str(b.name, 60), type = b.type === "delivery" ? "delivery" : "takeaway", addr = type === "delivery" ? str(b.addr, 300) : "", note = str(b.note, 200);
      if (!name) return Promise.resolve(bad(400, "Apna naam likhein."));
      if (type === "delivery" && addr.length < 8) return Promise.resolve(bad(400, "Delivery ka poora pata likhein."));
      if (!Array.isArray(b.items) || !b.items.length) return Promise.resolve(bad(400, "Cart khaali hai."));
      var items = [], total = 0;
      for (var k = 0; k < b.items.length; k++) {
        var it = b.items[k], mi = db.menu.find(function (x) { return x.id === it.id; }), q = Math.min(50, Math.max(1, +it.qty | 0)), sz = it.size === "h" ? "h" : "f";
        if (!mi) return Promise.resolve(bad(409, "Menu badal gaya hai. Page dobara kholein."));
        if (!mi.avail) return Promise.resolve(bad(409, mi.name + " abhi available nahi hai."));
        var hh = mi.half != null; if (sz === "h" && !hh) return Promise.resolve(bad(409, mi.name + " mein half nahi hai."));
        var pr = sz === "h" ? mi.half : mi.price; items.push({ id: mi.id, name: mi.name + (hh ? (sz === "h" ? " (Half)" : " (Full)") : ""), size: sz, qty: q, price: pr }); total += q * pr;
      }
      total = money(total);
      var o = { id: db.seq, no: "AK-" + String(db.seq).padStart(4, "0"), ts: Date.now(), name: name, phone: u2.phone, items: items, total: total, note: note, type: type, addr: addr, status: "new" };
      db.seq++; db.orders.push(o);
      var cu = db.customers[u2.phone] || (db.customers[u2.phone] = { phone: u2.phone, first: Date.now(), orders: 0, spent: 0 });
      cu.name = name; cu.last = o.ts; cu.orders++; cu.spent = money(cu.spent + total); save();
      u2.name = name; localStorage.setItem(ME, JSON.stringify(u2));
      var msg = "*Naya order - " + db.settings.name + "*\nOrder no: " + o.no + "\nNaam: " + name + "\nMobile: " + o.phone + "\n" + (type === "delivery" ? "*Delivery*\nPata: " + addr : "*Takeaway*") + "\n\n" +
        items.map(function (i) { return i.qty + " x " + i.name + " = " + rs(i.qty * i.price); }).join("\n") + "\n\n*Total: " + rs(total) + "*" + (note ? "\nNote: " + note : "");
      var d = String(db.settings.whatsapp || "").replace(/\D/g, ""); if (d.length === 10) d = "91" + d;
      return Promise.resolve(ok({ ok: true, no: o.no, total: total, waUrl: "https://wa.me/" + d + "?text=" + encodeURIComponent(msg) }));
    }
    if (url === "/api/admin/login") {
      return hash(String(b.password || "")).then(function (h) {
        if (!db.adminHash) { if (String(b.password || "").length < 6) return bad(400, "Pehli baar: apna naya admin password (kam se kam 6 akshar) daalein."); db.adminHash = h; save(); }
        else if (h !== db.adminHash) return bad(401, "Password galat hai.");
        sessionStorage.setItem(SES, "1"); return ok();
      });
    }
    if (url === "/api/admin/logout") { sessionStorage.removeItem(SES); return Promise.resolve(ok()); }
    if (!isAdmin()) return Promise.resolve(bad(401, "Admin login chahiye."));
    if (url === "/api/admin/data") return Promise.resolve(ok({ settings: db.settings, menu: db.menu, orders: db.orders, customers: Object.keys(db.customers).map(function (k) { return db.customers[k]; }) }));
    if (url === "/api/admin/password") return hash(String(b.old || "")).then(function (h) {
      if (h !== db.adminHash) return bad(401, "Purana password galat hai."); return hash(String(b["new"])).then(function (n) { db.adminHash = n; save(); return ok(); }); });
    if (url === "/api/admin/settings") {
      if ("name" in b) db.settings.name = str(b.name, 60) || db.settings.name; if ("whatsapp" in b) db.settings.whatsapp = str(b.whatsapp, 13);
      if ("hours" in b) db.settings.hours = str(b.hours, 120); if ("address" in b) db.settings.address = str(b.address, 200); save(); return Promise.resolve(ok({ settings: db.settings }));
    }
    if (url === "/api/admin/menu" && method === "POST") {
      var ni = { id: db.mid++, avail: true, half: null, type: "veg", cat: "Anya", desc: "" }, er = mfields(b, ni);
      if (er || !ni.name) return Promise.resolve(bad(400, er || "Naam likhein.")); db.menu.push(ni); save(); return Promise.resolve(ok({ item: ni }));
    }
    if ((m = url.match(/^\/api\/admin\/menu\/(\d+)$/))) {
      var ix = db.menu.findIndex(function (x) { return x.id === +m[1]; }); if (ix < 0) return Promise.resolve(bad(404, "Item nahi mila."));
      if (method === "DELETE") { db.menu.splice(ix, 1); save(); return Promise.resolve(ok()); }
      var e2 = mfields(b, db.menu[ix]); if (e2) return Promise.resolve(bad(400, e2)); save(); return Promise.resolve(ok({ item: db.menu[ix] }));
    }
    if ((m = url.match(/^\/api\/admin\/orders\/(\d+)$/))) {
      var oi = db.orders.findIndex(function (x) { return x.id === +m[1]; }); if (oi < 0) return Promise.resolve(bad(404, "Order nahi mila."));
      if (method === "DELETE") db.orders.splice(oi, 1); else if (["new", "prep", "done"].indexOf(b.status) >= 0) db.orders[oi].status = b.status; save(); return Promise.resolve(ok());
    }
    return Promise.resolve(bad(404, "Nahi mila."));
  };
})();
