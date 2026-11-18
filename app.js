(function () {
  "use strict";

  var cfg = window.STORE_CONFIG || {};
  var configured = cfg.SUPABASE_URL && cfg.SUPABASE_URL.indexOf("http") === 0 &&
                   cfg.SUPABASE_ANON_KEY && cfg.SUPABASE_ANON_KEY.indexOf("PASTE") === -1;
  var db = configured ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  var app = document.getElementById("app");
  var money = new Intl.NumberFormat("en-AU", { style: "currency", currency: cfg.CURRENCY || "AUD" });
  var state = { products: [], user: null, filter: "All" };

  var DEMO = [
    { id: "d1", name: "Two-person dome tent", category: "Camping", price: 189, stock: 12, description: "Freestanding tent with a full-coverage fly and two vestibules. Pitches in about ten minutes." },
    { id: "d2", name: "Folding camp chair", category: "Camping", price: 39.95, stock: 30, description: "Steel frame, cup holder and side pocket. Holds up to 120 kg and folds into its own bag." },
    { id: "d3", name: "LED camping lantern", category: "Camping", price: 29.5, stock: 40, description: "Rechargeable lantern with three brightness levels and around 20 hours of light on low." },
    { id: "d4", name: "Insulated water bottle 1L", category: "Outdoor", price: 34, stock: 50, description: "Double-wall stainless steel. Keeps water cold for 24 hours in the car or on the trail." },
    { id: "d5", name: "Raised garden bed kit", category: "Garden", price: 79, stock: 15, description: "Galvanised steel bed, 120 x 60 x 30 cm. No tools needed to assemble." },
    { id: "d6", name: "Expandable garden hose 15m", category: "Garden", price: 44.9, stock: 25, description: "Lightweight hose that stretches to 15 m and shrinks back for storage." },
    { id: "d7", name: "Pruning shears", category: "Garden", price: 24.95, stock: 35, description: "Bypass secateurs with a non-stick blade and a safety lock." },
    { id: "d8", name: "Solar path lights (8 pack)", category: "Garden", price: 49, stock: 20, description: "Charge during the day and switch on at dusk. Stake straight into the ground." }
  ];

  var ICONS = {
    Camping: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><path d="M6 54 32 10l26 44Z"/><path d="M32 10v44M24 54l8-16 8 16"/></svg>',
    Outdoor: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><path d="M4 52 24 22l10 14 8-10 18 26Z"/><circle cx="46" cy="14" r="6"/></svg>',
    Garden:  '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M32 58V28"/><path d="M32 34c-12 0-18-8-18-18 10 0 18 6 18 18Z"/><path d="M32 28c0-10 6-18 18-18 0 10-6 18-18 18Z"/></svg>'
  };

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function thumb(p) {
    if (p.image_url) return '<img src="' + esc(p.image_url) + '" alt="' + esc(p.name) + '" loading="lazy">';
    var cat = ICONS[p.category] ? p.category : "Camping";
    return '<div class="placeholder ph-' + cat + '" role="img" aria-label="' + esc(p.name) + '">' + ICONS[cat] + "</div>";
  }
  function findProduct(id) {
    for (var i = 0; i < state.products.length; i++) if (state.products[i].id === id) return state.products[i];
    return null;
  }
  function view(html) { app.innerHTML = html; app.focus(); window.scrollTo(0, 0); }

  // ---------- cart (saved in this browser) ----------
  function getCart() {
    try { return JSON.parse(localStorage.getItem("cart") || "[]"); } catch (e) { return []; }
  }
  function setCart(c) {
    try { localStorage.setItem("cart", JSON.stringify(c)); } catch (e) {}
    updateCartCount();
  }
  function addToCart(id, qty) {
    var c = getCart(), line = c.filter(function (l) { return l.id === id; })[0];
    if (line) line.qty = Math.min(20, line.qty + qty); else c.push({ id: id, qty: qty });
    setCart(c);
  }
  function cartLines() {
    return getCart().map(function (l) { return { p: findProduct(l.id), qty: l.qty }; })
                    .filter(function (l) { return l.p; });
  }
  function cartTotal() {
    return cartLines().reduce(function (s, l) { return s + Number(l.p.price) * l.qty; }, 0);
  }
  function updateCartCount() {
    var n = getCart().reduce(function (s, l) { return s + l.qty; }, 0);
    document.getElementById("cart-count").textContent = n;
  }

  // ---------- data ----------
  function loadProducts() {
    if (!db) { state.products = DEMO; return Promise.resolve(); }
    return db.from("products").select("*").eq("active", true).order("created_at").then(function (r) {
      if (r.error) { showNotice("Products could not load: " + r.error.message); state.products = []; }
      else state.products = r.data;
    });
  }
  function showNotice(text) {
    var n = document.getElementById("notice"); n.textContent = text; n.hidden = false;
  }

  // ---------- pages ----------
  function pageHome() {
    var cats = ["All"].concat(state.products.map(function (p) { return p.category; })
      .filter(function (c, i, a) { return a.indexOf(c) === i; }));
    var list = state.products.filter(function (p) { return state.filter === "All" || p.category === state.filter; });

    view(
      '<section class="hero">' +
        '<svg class="contours" viewBox="0 0 800 400" preserveAspectRatio="none" fill="none" stroke="#fff" stroke-width="1.5">' +
          '<path d="M-20 320C120 260 220 340 360 290S600 200 820 260"/><path d="M-20 280C140 220 230 300 370 250S610 160 820 220"/>' +
          '<path d="M-20 240C150 180 240 260 380 210S620 120 820 180"/><path d="M-20 200C160 140 250 220 390 170S630 80 820 140"/>' +
          '<path d="M-20 160C170 100 260 180 400 130S640 40 820 100"/><path d="M-20 120C180 60 270 140 410 90S650 0 820 60"/>' +
        "</svg>" +
        "<h1>Gear for the backyard and the back country.</h1>" +
        "<p>Tents, lanterns, garden tools and everything in between, shipped to your door anywhere in Australia.</p>" +
        '<a class="btn" href="#products">Browse the range</a>' +
      "</section>" +
      '<div class="shop-head" id="products"><h2>The range</h2><div class="filters" role="group" aria-label="Filter by category">' +
        cats.map(function (c) {
          return '<button class="chip" data-cat="' + esc(c) + '" aria-pressed="' + (c === state.filter) + '">' + esc(c) + "</button>";
        }).join("") +
      "</div></div>" +
      (list.length ? '<div class="grid">' + list.map(function (p) {
        return '<a class="product" href="#/product/' + esc(p.id) + '"><div class="thumb">' + thumb(p) + "</div>" +
          '<div class="meta"><h3>' + esc(p.name) + '</h3><span class="price">' + money.format(p.price) + "</span></div>" +
          '<div class="cat">' + esc(p.category) + "</div></a>";
      }).join("") + "</div>"
        : '<div class="panel empty"><h2>No products yet</h2><p>Add products in Supabase under Table Editor, then products.</p></div>')
    );
    app.querySelectorAll(".chip").forEach(function (b) {
      b.addEventListener("click", function () { state.filter = b.dataset.cat; pageHome(); document.getElementById("products").scrollIntoView(); });
    });
  }

  function pageProduct(id) {
    var p = findProduct(id);
    if (!p) return view('<div class="panel empty"><h2>Product not found</h2><p>It may have been removed.</p><a class="btn" href="#/">Back to the shop</a></div>');
    var qty = 1;
    view(
      '<a class="back" href="#/">Back to the shop</a>' +
      '<div class="detail"><div class="thumb">' + thumb(p) + "</div><div>" +
        '<div class="cat">' + esc(p.category) + "</div><h1>" + esc(p.name) + "</h1>" +
        '<div class="price">' + money.format(p.price) + "</div>" +
        '<p class="desc">' + esc(p.description) + "</p>" +
        '<div class="stock">' + (p.stock > 0 ? p.stock + " in stock" : "Out of stock") + "</div>" +
        '<div class="buy-row"><div class="qty"><button id="minus" aria-label="Decrease quantity">−</button><span id="q">1</span>' +
        '<button id="plus" aria-label="Increase quantity">+</button></div>' +
        '<button class="btn" id="add"' + (p.stock > 0 ? "" : " disabled") + ">Add to cart</button></div>" +
        '<div id="added" class="msg ok" style="margin-top:16px" hidden>Added to cart. <a href="#/cart">View cart</a></div>' +
      "</div></div>"
    );
    var max = Math.min(20, p.stock || 1);
    document.getElementById("minus").onclick = function () { qty = Math.max(1, qty - 1); document.getElementById("q").textContent = qty; };
    document.getElementById("plus").onclick = function () { qty = Math.min(max, qty + 1); document.getElementById("q").textContent = qty; };
    document.getElementById("add").onclick = function () { addToCart(p.id, qty); document.getElementById("added").hidden = false; };
  }

  function pageCart() {
    var lines = cartLines();
    if (!lines.length) return view('<div class="panel empty"><h2>Your cart is empty</h2><p>Find something for your next trip or your garden.</p><a class="btn" href="#/">Go to the shop</a></div>');
    view(
      "<h2>Your cart</h2>" +
      '<div class="cart-layout"><div class="panel">' +
        lines.map(function (l) {
          return '<div class="line"><div class="thumb">' + thumb(l.p) + "</div><div><h3>" + esc(l.p.name) + "</h3>" +
            '<div class="qty"><button data-dec="' + esc(l.p.id) + '" aria-label="Decrease">−</button><span>' + l.qty + "</span>" +
            '<button data-inc="' + esc(l.p.id) + '" aria-label="Increase">+</button></div> ' +
            '<button class="btn-link" data-del="' + esc(l.p.id) + '">Remove</button></div>' +
            "<strong>" + money.format(l.p.price * l.qty) + "</strong></div>";
        }).join("") +
      '</div><div class="panel"><div class="sum-row"><span>Subtotal</span><span>' + money.format(cartTotal()) + "</span></div>" +
        '<div class="sum-row"><span>Shipping</span><span>Calculated after order</span></div>' +
        '<div class="sum-row sum-total"><span>Total</span><span>' + money.format(cartTotal()) + "</span></div>" +
        '<a class="btn" style="width:100%;margin-top:20px" href="#/checkout">Checkout</a></div></div>'
    );
    function change(id, d) {
      var c = getCart().map(function (l) { if (l.id === id) l.qty = Math.max(0, Math.min(20, l.qty + d)); return l; })
                      .filter(function (l) { return l.qty > 0; });
      setCart(c); pageCart();
    }
    app.querySelectorAll("[data-inc]").forEach(function (b) { b.onclick = function () { change(b.dataset.inc, 1); }; });
    app.querySelectorAll("[data-dec]").forEach(function (b) { b.onclick = function () { change(b.dataset.dec, -1); }; });
    app.querySelectorAll("[data-del]").forEach(function (b) { b.onclick = function () { change(b.dataset.del, -99); }; });
  }

  function pageCheckout() {
    if (!cartLines().length) return go("#/cart");
    if (!db) return view('<div class="panel narrow"><h2>Checkout is not connected yet</h2><p>The store owner needs to add the Supabase keys in config.js before orders can be placed.</p></div>');
    if (!state.user) { sessionStorage.setItem("after_login", "#/checkout"); return go("#/account"); }
    view(
      '<div class="panel narrow"><h2 style="margin-bottom:20px">Delivery details</h2><div id="err"></div>' +
      '<form id="co">' +
        '<div class="field"><label for="n">Full name</label><input id="n" required autocomplete="name"></div>' +
        '<div class="field"><label for="ph">Phone</label><input id="ph" required type="tel" autocomplete="tel"></div>' +
        '<div class="field"><label for="ad">Street address</label><input id="ad" required autocomplete="street-address"></div>' +
        '<div class="row-2"><div class="field"><label for="ci">Suburb or city</label><input id="ci" required autocomplete="address-level2"></div>' +
        '<div class="field"><label for="pc">Postcode</label><input id="pc" required inputmode="numeric" pattern="[0-9]{4}" autocomplete="postal-code"></div></div>' +
        '<div class="sum-row sum-total"><span>Total</span><span>' + money.format(cartTotal()) + "</span></div>" +
        '<p style="color:var(--muted);font-size:14px">We will email you payment and shipping details after you place the order.</p>' +
        '<button class="btn" style="width:100%" id="place">Place order</button>' +
      "</form></div>"
    );
    document.getElementById("co").onsubmit = function (e) {
      e.preventDefault();
      var btn = document.getElementById("place"); btn.disabled = true; btn.textContent = "Placing order…";
      db.rpc("place_order", {
        p_items: getCart(),
        p_full_name: val("n"), p_phone: val("ph"), p_address: val("ad"), p_city: val("ci"), p_postcode: val("pc")
      }).then(function (r) {
        if (r.error) {
          document.getElementById("err").innerHTML = '<div class="msg error">' + esc(r.error.message) + "</div>";
          btn.disabled = false; btn.textContent = "Place order"; return;
        }
        setCart([]);
        loadProducts();
        view('<div class="panel narrow empty"><h2>Order placed</h2><p>Your order number is ' + esc(String(r.data).slice(0, 8)) +
             '. We will email you the payment and shipping details.</p><a class="btn" href="#/account">See my orders</a></div>');
      });
    };
  }
  function val(id) { return document.getElementById(id).value.trim(); }

  function pageAccount() {
    if (!db) return view('<div class="panel narrow"><h2>Accounts are not connected yet</h2><p>Add the Supabase keys in config.js to turn on sign in.</p></div>');
    if (state.user) return pageOrders();
    var mode = "in";
    function draw(msgHtml) {
      view(
        '<div class="panel narrow"><div class="tabs" role="tablist">' +
          '<button role="tab" data-m="in" aria-selected="' + (mode === "in") + '">Sign in</button>' +
          '<button role="tab" data-m="up" aria-selected="' + (mode === "up") + '">Create account</button></div>' +
        (msgHtml || "") +
        '<form id="auth"><div class="field"><label for="em">Email</label><input id="em" type="email" required autocomplete="email"></div>' +
        '<div class="field"><label for="pw">Password</label><input id="pw" type="password" required minlength="6" autocomplete="' + (mode === "in" ? "current-password" : "new-password") + '"></div>' +
        '<button class="btn" style="width:100%" id="go">' + (mode === "in" ? "Sign in" : "Create account") + "</button></form></div>"
      );
      app.querySelectorAll("[data-m]").forEach(function (b) { b.onclick = function () { mode = b.dataset.m; draw(); }; });
      document.getElementById("auth").onsubmit = function (e) {
        e.preventDefault();
        var email = val("em"), pw = document.getElementById("pw").value;
        var btn = document.getElementById("go"); btn.disabled = true;
        var req = mode === "in"
          ? db.auth.signInWithPassword({ email: email, password: pw })
          : db.auth.signUp({ email: email, password: pw, options: { emailRedirectTo: location.origin + location.pathname } });
        req.then(function (r) {
          btn.disabled = false;
          if (r.error) return draw('<div class="msg error">' + esc(r.error.message) + "</div>");
          if (mode === "up" && !r.data.session) {
            mode = "in";
            return draw('<div class="msg ok">Check your email and open the confirmation link, then sign in here.</div>');
          }
        });
      };
    }
    draw();
  }

  function pageOrders() {
    view('<div class="panel narrow" style="max-width:640px"><h2>My orders</h2><p style="color:var(--muted)">' + esc(state.user.email) +
         ' · <button class="btn-link" id="out">Sign out</button>' + (state.isAdmin ? ' · <a href="#/admin">Open dashboard</a>' : '') + '</p><div id="orders">Loading…</div></div>');
    document.getElementById("out").onclick = function () { db.auth.signOut(); };
    db.from("orders").select("*").order("created_at", { ascending: false }).then(function (r) {
      var el = document.getElementById("orders"); if (!el) return;
      if (r.error) { el.innerHTML = '<div class="msg error">' + esc(r.error.message) + "</div>"; return; }
      if (!r.data.length) { el.innerHTML = '<p>No orders yet.</p><a class="btn" href="#/">Start shopping</a>'; return; }
      el.innerHTML = r.data.map(function (o) {
        return '<div class="order"><div class="order-top"><span>Order ' + esc(o.id.slice(0, 8)) + '</span><span>' + money.format(o.total) + "</span></div>" +
          "<small>" + new Date(o.created_at).toLocaleDateString("en-AU") + " · " +
          o.items.map(function (i) { return esc(i.qty + " × " + i.name); }).join(", ") + '</small> <span class="status">' + esc(o.status) + "</span></div>";
      }).join("");
    });
  }

  // ---------- admin dashboard ----------
  var STATUSES = ["pending", "paid", "shipped", "delivered", "cancelled"];
  var adminTab = "orders";

  function pageAdmin() {
    if (!db || !state.user) { sessionStorage.setItem("after_login", "#/admin"); return go("#/account"); }
    if (!state.isAdmin) return view('<div class="panel narrow empty"><h2>No access</h2><p>This page is for the store owner.</p><a class="btn" href="#/">Go to the shop</a></div>');
    view(
      '<div class="admin-head"><h2>Dashboard</h2><div class="tabs admin-tabs" role="tablist">' +
        '<button role="tab" data-t="orders" aria-selected="' + (adminTab === "orders") + '">Orders</button>' +
        '<button role="tab" data-t="products" aria-selected="' + (adminTab === "products") + '">Products</button></div></div>' +
      '<div id="admin-body" class="panel">Loading…</div>'
    );
    app.querySelectorAll("[data-t]").forEach(function (b) { b.onclick = function () { adminTab = b.dataset.t; pageAdmin(); }; });
    if (adminTab === "orders") adminOrders(); else adminProducts();
  }

  function adminOrders() {
    var body = document.getElementById("admin-body");
    db.from("orders").select("*").order("created_at", { ascending: false }).then(function (r) {
      if (r.error) { body.innerHTML = '<div class="msg error">' + esc(r.error.message) + "</div>"; return; }
      if (!r.data.length) { body.innerHTML = '<div class="empty"><h2>No orders yet</h2><p>New orders show up here as soon as a customer places one.</p></div>'; return; }
      var pending = r.data.filter(function (o) { return o.status === "pending"; }).length;
      var revenue = r.data.filter(function (o) { return o.status !== "cancelled"; }).reduce(function (s, o) { return s + Number(o.total); }, 0);
      body.innerHTML =
        '<div class="stats"><div><strong>' + r.data.length + '</strong><span>orders</span></div><div><strong>' + pending +
        '</strong><span>waiting</span></div><div><strong>' + money.format(revenue) + "</strong><span>sales</span></div></div>" +
        r.data.map(function (o) {
          return '<div class="order admin-order"><div class="order-top"><span>Order ' + esc(o.id.slice(0, 8)) + " · " +
            new Date(o.created_at).toLocaleString("en-AU") + "</span><span>" + money.format(o.total) + "</span></div>" +
            "<div>" + o.items.map(function (i) { return esc(i.qty + " × " + i.name); }).join("<br>") + "</div>" +
            '<small>' + esc(o.full_name) + " · " + esc(o.phone) + "<br>" + esc(o.address + ", " + o.city + " " + o.postcode) + "</small>" +
            '<label class="status-pick">Status <select data-order="' + esc(o.id) + '">' +
            STATUSES.map(function (s) { return "<option" + (s === o.status ? " selected" : "") + ">" + s + "</option>"; }).join("") +
            "</select></label></div>";
        }).join("");
      body.querySelectorAll("[data-order]").forEach(function (sel) {
        sel.onchange = function () {
          sel.disabled = true;
          db.from("orders").update({ status: sel.value }).eq("id", sel.dataset.order).then(function (u) {
            sel.disabled = false;
            if (u.error) alert("Status was not saved: " + u.error.message);
          });
        };
      });
    });
  }

  function adminProducts() {
    var body = document.getElementById("admin-body");
    db.from("products").select("*").order("created_at").then(function (r) {
      if (r.error) { body.innerHTML = '<div class="msg error">' + esc(r.error.message) + "</div>"; return; }
      body.innerHTML = '<div class="admin-bar"><span>' + r.data.length + ' products</span><button class="btn" id="new-p">Add product</button></div>' +
        r.data.map(function (p) {
          return '<div class="line"><div class="thumb">' + thumb(p) + "</div><div><h3>" + esc(p.name) + "</h3><small>" +
            esc(p.category) + " · " + p.stock + " in stock" + (p.active ? "" : " · hidden") + "</small></div>" +
            '<div class="admin-actions"><strong>' + money.format(p.price) + '</strong><button class="btn-link" data-edit="' + esc(p.id) + '">Edit</button></div></div>';
        }).join("");
      document.getElementById("new-p").onclick = function () { productForm(null); };
      body.querySelectorAll("[data-edit]").forEach(function (b) {
        b.onclick = function () { productForm(r.data.filter(function (p) { return p.id === b.dataset.edit; })[0]); };
      });
    });
  }

  function productForm(p) {
    var isNew = !p; p = p || { name: "", category: "Camping", price: "", stock: 0, description: "", image_url: "", active: true };
    var body = document.getElementById("admin-body");
    body.innerHTML =
      '<h2 style="margin-bottom:20px">' + (isNew ? "Add product" : "Edit product") + '</h2><div id="perr"></div><form id="pf">' +
      '<div class="field"><label for="f-name">Name</label><input id="f-name" required value="' + esc(p.name) + '"></div>' +
      '<div class="row-2"><div class="field"><label for="f-cat">Category</label><input id="f-cat" required list="cats" value="' + esc(p.category) + '">' +
      '<datalist id="cats"><option>Camping</option><option>Outdoor</option><option>Garden</option></datalist></div>' +
      '<div class="field"><label for="f-price">Price (AUD)</label><input id="f-price" required type="number" min="0" step="0.01" value="' + esc(p.price) + '"></div></div>' +
      '<div class="row-2"><div class="field"><label for="f-stock">Stock</label><input id="f-stock" required type="number" min="0" step="1" value="' + esc(p.stock) + '"></div>' +
      '<div class="field"><label class="check"><input id="f-active" type="checkbox"' + (p.active ? " checked" : "") + "> Show in the shop</label></div></div>" +
      '<div class="field"><label for="f-desc">Description</label><textarea id="f-desc" rows="4">' + esc(p.description) + "</textarea></div>" +
      '<div class="field"><label for="f-img">Photo</label>' + (p.image_url ? '<img src="' + esc(p.image_url) + '" alt="" class="preview">' : "") +
      '<input id="f-img" type="file" accept="image/*"></div>' +
      '<div class="buy-row"><button class="btn" id="psave">' + (isNew ? "Add product" : "Save changes") + '</button>' +
      '<button type="button" class="btn btn-quiet" id="pcancel">Cancel</button>' +
      (isNew ? "" : '<button type="button" class="btn-link danger" id="pdel">Delete product</button>') + "</div></form>";
    document.getElementById("pcancel").onclick = adminProducts;
    if (!isNew) document.getElementById("pdel").onclick = function () {
      if (!confirm("Delete " + p.name + "? This cannot be undone. To hide it instead, untick Show in the shop.")) return;
      db.from("products").delete().eq("id", p.id).then(function (r) {
        if (r.error) document.getElementById("perr").innerHTML = '<div class="msg error">' + esc(r.error.message) + "</div>"; else adminProducts();
      });
    };
    document.getElementById("pf").onsubmit = function (e) {
      e.preventDefault();
      var btn = document.getElementById("psave"); btn.disabled = true; btn.textContent = "Saving…";
      var file = document.getElementById("f-img").files[0];
      var fail = function (m) { document.getElementById("perr").innerHTML = '<div class="msg error">' + esc(m) + "</div>"; btn.disabled = false; btn.textContent = isNew ? "Add product" : "Save changes"; };
      var upload = file
        ? db.storage.from("product-images").upload(Date.now() + "-" + file.name.replace(/[^a-zA-Z0-9.]/g, "_"), file).then(function (u) {
            if (u.error) throw new Error("Photo upload failed: " + u.error.message);
            return db.storage.from("product-images").getPublicUrl(u.data.path).data.publicUrl;
          })
        : Promise.resolve(p.image_url || null);
      upload.then(function (url) {
        var row = {
          name: val("f-name"), category: val("f-cat"), price: Number(val("f-price")), stock: parseInt(val("f-stock"), 10) || 0,
          description: val("f-desc"), active: document.getElementById("f-active").checked, image_url: url
        };
        return isNew ? db.from("products").insert(row) : db.from("products").update(row).eq("id", p.id);
      }).then(function (r) {
        if (r.error) return fail(r.error.message);
        loadProducts(); adminProducts();
      }).catch(function (err) { fail(err.message); });
    };
  }

  // ---------- router ----------
  function go(hash) { location.hash = hash; }
  function route() {
    var h = location.hash || "#/";
    if (h === "#products") return;
    var m;
    if ((m = h.match(/^#\/product\/(.+)$/))) return pageProduct(decodeURIComponent(m[1]));
    if (h === "#/cart") return pageCart();
    if (h === "#/checkout") return pageCheckout();
    if (h === "#/account") return pageAccount();
    if (h === "#/admin") return pageAdmin();
    pageHome();
  }
  function setUser(u) {
    state.user = u;
    document.getElementById("account-link").textContent = u ? "My account" : "Sign in";
    state.isAdmin = false;
    document.getElementById("admin-link").hidden = true;
    if (!u || !db) return Promise.resolve();
    return db.from("admins").select("user_id").eq("user_id", u.id).maybeSingle().then(function (r) {
      state.isAdmin = !!(r.data && !r.error);
      document.getElementById("admin-link").hidden = !state.isAdmin;
    });
  }

  // ---------- start ----------
  document.getElementById("brand").textContent = cfg.STORE_NAME || "Mixora Hub";
  document.title = cfg.STORE_NAME || "Mixora Hub";
  document.getElementById("footer-name").textContent = "© " + new Date().getFullYear() + " " + (cfg.STORE_NAME || "Mixora Hub");
  if (!configured) showNotice("Demo mode: these are sample products. Add your Supabase keys in config.js to connect the real store.");
  updateCartCount();

  var ready = db ? db.auth.getSession().then(function (r) { return setUser(r.data.session ? r.data.session.user : null); }) : Promise.resolve();
  ready.then(loadProducts).then(function () {
    window.addEventListener("hashchange", route);
    route();
    if (db) db.auth.onAuthStateChange(function (_e, session) {
      var was = !!state.user;
      if (was === !!session) return;
      setUser(session ? session.user : null).then(function () {
        var next = sessionStorage.getItem("after_login");
        if (state.user && next) { sessionStorage.removeItem("after_login"); go(next); } else route();
      });
    });
  });
})();
