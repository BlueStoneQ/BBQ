class Sampling {
    constructor() {
        this.instance = null;
    }
}

Sampling.getSigngleInstance= () => {
    if (this.instance) return this.instance;
    this.instance = new Sampling();
    return this.instance;
}

const { getSigngleInstance } = Sampling;

export default Sampling
export {
    getSigngleInstance
}