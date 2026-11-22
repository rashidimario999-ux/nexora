(function () {
  function addLive(list) {
    list.forEach(function (x) {
      var id = 1000 + Number(x.id);
      if (P.some(function (p) { return p.id === id; })) return;
      P.push({
        id: id,
        n: x.name,
        p: Number(x.price),
        o: 0,
        d: 0,
        r: 0,
        k: 'New',
        a: 'phone',
        c: 'Fashion'
      });
    });
  }

  async function load() {
    try {
      var res = await fetch('/api/products');
      var data = await res.json();
      if (data.ok && data.products.length) {
        addLive(data.products);
        all();
      }
    } catch (e) {}
  }

  new MutationObserver(function () {
    document.querySelectorAll('.off').forEach(function (e) {
      if (e.textContent === '-0%') e.remove();
    });
    document.querySelectorAll('.pr s').forEach(function (e) {
      if (e.textContent === '$0') e.remove();
    });
  }).observe(document.body, { childList: true, subtree: true });

  load();
})();
