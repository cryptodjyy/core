class Synchronizer extends Observable {
    /**
     * @param {number} [throttleAfter]
     * @param {number} [throttleWait]
     */
    constructor(throttleAfter, throttleWait) {
        super();

        /** @type {Array.<object>} */
        this._queue = [];
        /** @type {boolean} */
        this._working = false;
        /** @type {?number} */
        this._throttleAfter = throttleAfter;
        /** @type {?number} */
        this._throttleWait = throttleWait;
        /** @type {number} */
        this._elapsed = 0;
    }

    /**
     * Push function to the Synchronizer for later, synchronous execution
     * @template T
     * @param {function():T} fn Function to be invoked later by this Synchronizer
     * @returns {Promise.<T>}
     */
    push(fn) {
        return new Promise((resolve, reject) => {
            this._queue.push({fn: fn, resolve: resolve, reject: reject});
            if (!this._working) {
                this.fire('work-start', this);
                this._doWork().catch(Log.w.tag(Synchronizer));
            }
        });
    }

    /**
     * Reject all jobs in the queue and clear it.
     * @returns {void}
     */
    clear() {
        for (const job of this._queue) {
            if (job.reject) job.reject();
        }
        this._queue = [];
    }

    async _doWork() {
        this._working = true;

        while (this._queue.length > 0) {
            const start = Date.now();

            const job = this._queue.shift();
            try {
                const result = await job.fn();
                job.resolve(result);
            } catch (e) {
                if (job.reject) job.reject(e);
            }

            if (this._throttleAfter !== undefined) {
                this._elapsed += Date.now() - start;
                if (this._elapsed >= this._throttleAfter) {
                    this._elapsed = 0;
                    setTimeout(this._doWork.bind(this), this._throttleWait);
                    return;
                }
            }
        }

        this._working = false;
        this._elapsed = 0;
        this.fire('work-end', this);
    }

    /** @type {boolean} */
    get working() {
        return this._working;
    }
}
Class.register(Synchronizer);
