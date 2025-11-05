export class TimerUtil  {
    constructor() {
        this.lastMS = Date.now();
    }

    reset() {
        this.lastMS = Date.now();
    }

    hasTimeElapsed(time, reset = false) {
        if (Date.now() - this.lastMS > time) {
            if (reset) this.reset();
            return true;
        }

        return false;
    }

    getLastMS() {
        return this.lastMS;
    }

    setLastMS() {
        this.lastMS = Date.now();
    }

    hasTimeElapsedWithoutReset(time) {
        return Date.now() - this.lastMS > time;
    }

    getTime() {
        return Date.now() - this.lastMS;
    }

    setTime(time) {
        this.lastMS = time;
    }
}