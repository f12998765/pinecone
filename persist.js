document.addEventListener('alpine:init', () => {
    let persist = () => {
        let alias
        return Alpine.interceptor((initialValue, getter, setter, path, key) => {
            let lookup = alias || path
            let init = true

            setter(initialValue)

            PineconeDB.get(lookup).then(saved => {
                init = false
                if (saved !== undefined && saved !== null) {
                    setter(saved)
                }
            }).catch(() => { init = false })

            Alpine.effect(() => {
                let v = getter()
                if (init) return
                if (v !== undefined) {
                    PineconeDB.set(lookup, v).catch(() => {})
                }
            })

            return initialValue
        }, func => {
            func.as = key => { alias = key; return func }
        })
    }
    Object.defineProperty(Alpine, '$persist', { get: () => persist() })
    Alpine.magic('persist', persist)
})
