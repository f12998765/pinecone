document.addEventListener("alpine:init", () => {
  const storage = {
    get(key) {
      try { const v = localStorage.getItem(key); return v != null ? JSON.parse(v) : undefined; }
      catch { return undefined; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch {}
      PineconeDB.remove(key).catch(() => {});
    },
  };

  const persist = () => {
    let alias;
    return Alpine.interceptor(
      (initialValue, getter, setter, path) => {
        const lookup = alias || path;
        const saved = storage.get(lookup);
        if (saved != null) setter(saved);
        Alpine.effect(() => { const v = getter(); if (v !== undefined) storage.set(lookup, v); });
        return initialValue;
      },
      func => { func.as = key => { alias = key; return func; }; }
    );
  };

  Object.defineProperty(Alpine, "$persist", { get: persist });
  Alpine.magic("persist", persist);
});
