document.addEventListener("alpine:init", () => {
  const storage = {
    get(key) {
      try {
        const v = localStorage.getItem(key);
        if (v == null) return undefined;
        return JSON.parse(v);
      } catch (e) {
        console.warn('persist get failed for', key, e);
        try { localStorage.removeItem(key); } catch {}
        return undefined;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        console.warn('persist set failed for', key, e);
      }
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
