let order = null;

import { refund, review } from "../../account.js";
import { sendMessage } from "../../chat.js";

class Order {
    constructor(id, username, buyerId, count, goodName = null) {
        this.id = id;
        this.username = username;
        this.buyerId = buyerId;
        this.count = count;
        this.goodName = goodName;
        this.createdAt = Date.now();
        this.timeoutId = null;
        this.question = false;
        this.applied = false;
        this.promptSent = false;
        this.done = false;
    }

    async sendMessage(msg) {
        await sendMessage(this.buyerId, msg, true);
    }

    static isNull() {
        return order === null || order === undefined;
    }

    static getCurrent() {
        return order;
    }
    static isCurrent(orderObj) {
        const cur = Order.getCurrent();
        return cur && orderObj && cur.id === orderObj.id;
    }
    static setCurrent(order1) {
        order = order1;
    }

    is(id, username) {
        return this.id === id && this.username === username;
    }

    async refund() {
        await refund(this.id);
    }

    static addWaiting(orderObj) {
        waitingOrders.push(orderObj);
        return waitingOrders.length;
    }

    static clearTimeoutSafe(orderObj) {
        if (orderObj && orderObj.timeoutId) {
            clearTimeout(orderObj.timeoutId);
            orderObj.timeoutId = null;
        }
    }

    static nextWaiting() {
        return waitingOrders.shift();
    }
    static getWaiting() {
        return waitingOrders;
    }
    static async notifyQueue() {
        for (let i = 0; i < waitingOrders.length; i++) {
            const o = waitingOrders[i];
            await sendMessage(o.buyerId, `Ваша позиция в очереди: ${i + 1}`, true);
        }
    }

    async review(text = '') {
        await review(this.id, text);
    }
}

const waitingOrders = [];

export { Order };