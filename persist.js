document.addEventListener('alpine:init', () => {
    let persist = () => {
        let alias
        return Alpine.interceptor((initialValue, getter, setter, path, key) => {
            let lookup = alias || path
            let effectCount = 0
            let pending = false
            let init = true

            setter(initialValue)

            PineconeDB.get(lookup).then(saved => {
                init = false
                if (pending) {
                    PineconeDB.set(lookup, getter()).catch(() => {})
                } else if (saved !== undefined && saved !== null) {
                    setter(saved)
                }
            }).catch(() => { init = false })

            Alpine.effect(() => {
                effectCount++
                let v = getter()
                if (init) {
                    if (effectCount > 1) pending = true
                    return
                }
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
