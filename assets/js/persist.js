document.addEventListener("alpine:init", () => {
  const storage = {
    get(key) {
      try { const v = localStorage.getItem(key); return v != null ? JSON.parse(v) : undefined; }
      catch (e) { console.warn('persist get failed for', key, e); return undefined; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); }
      catch (e) { console.warn('persist set failed for', key, e); }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch (e) { console.warn('persist remove failed for', key, e); }
      PineconeDB.remove(key);
    },
  };

  const persist = () => {
    let alias;
    return Alpine.interceptor(
      (initialValue, getter, setter, path) => {
        const lookup = alias || path;
        const saved = storage.get(lookup);
        if (saved != null) setter(saved);
        queueMicrotask(() => {
            Alpine.effect(() => { const v = getter(); if (v !== undefined) storage.set(lookup, v); });
        });
        return getter();
      },
      func => { func.as = key => { alias = key; return func; }; }
    );
  };

  Object.defineProperty(Alpine, "$persist", { get: persist });
  Alpine.magic("persist", persist);
});
