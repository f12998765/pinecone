document.addEventListener('alpine:init', () => {
    let persist = () => {
        let alias

        return Alpine.interceptor((initialValue, getter, setter, path, key) => {
            let lookup = alias || path

            setter(initialValue)

            PineconeDB.get(lookup).then(saved => {
                if (saved !== undefined && saved !== null) {
                    setter(saved)
                }
            }).catch(() => {})

            Alpine.effect(() => {
                let value = getter()
                if (value !== undefined) {
                    PineconeDB.set(lookup, value).catch(() => {})
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
