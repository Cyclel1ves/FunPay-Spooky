
const fetch = global.fetch;
const log = global.log;
const { exit } = global.helpers;
const parseDOM = global.DOMParser;
const { getConst } = global.storage;


const config = global.settings;
const headers = { "cookie": `golden_key=${config.golden_key};`};

if(!global.appData || !global.appData.id) {
    global.appData = await getUserData();
    if(!global.appData) await exit();
}

async function countTradeProfit() {
    let result = 0;
    let ordersCount = 0;
    try {
        let first = true;
        let continueId;
        while(1) {
            let method, data;
            if(!first) {
                method = 'POST';
                data = `${encodeURI('continue')}=${encodeURI(continueId)}`;
                headers["content-type"] = 'application/x-www-form-urlencoded';
                headers["x-requested-with"] = 'XMLHttpRequest';
            } else {
                first = false;
                method = 'GET';
            }

            const options = {
                method: method,
                body: data,
                headers: headers
            };

            const resp = await fetch(`${getConst('api')}/orders/trade`, options);
            const body = await resp.text();

            const doc = parseDOM(body);
            const items = doc.querySelectorAll(".tc-item");
            const order = items[0].querySelector(".tc-order").innerHTML;

            items.forEach(item => {
                const status = item.querySelector(".tc-status").innerHTML;
                if(status == `Закрыт`) {
                    let price = item.querySelector(".tc-price").childNodes[0].data;
                    price = Number(price);
                    if(isNaN(price)) return;
                    result += price;
                    ordersCount++;
                }
            });
            log(`Продажи: ${ordersCount}. Заработок: ${result.toFixed(2)} ₽. Средний чек: ${(result / ordersCount).toFixed(2)} ₽.`);

            const continueEl = doc.querySelector(".dyn-table-form");
            if (continueEl == null) {
                break;
            }

            continueId = continueEl.querySelector('input').getAttribute('value');
        }
    } catch (err) {
        log(`Ошибка при подсчёте профита: ${err}`, 'r');
    }
    return result;
}

function enableUserDataUpdate(timeout) {
    setInterval(getUserData, timeout);
    
}

async function getUserData() {
    let result = false;
    try {
        const options = {
            method: 'GET',
            headers: headers
        };

        const resp = await fetch(getConst('api'), options);
        const body = await resp.text();

        const doc = parseDOM(body);
        const appData = JSON.parse(doc.querySelector("body").getAttribute('data-app-data'));

        if(!doc.querySelector(".user-link-name")) {
            log(`Неверный golden_key.`, 'r');
            return false;
        }

        const userName = doc.querySelector(".user-link-name").innerHTML;
        const balanceEl = doc.querySelector(".badge-balance");
        const salesEl = doc.querySelector(".badge-trade");
        const timestamp = Date.now();

        let balance = 0;
        let sales = 0;

        if(balanceEl && balanceEl != null) balance = balanceEl.innerHTML;
        if(salesEl && salesEl != null) sales = salesEl.innerHTML;

        let setCookie = "";
        resp.headers.forEach((val, key) => {
            if(key == "set-cookie") {
                setCookie = val;
                return;
            }
        });

        const PHPSESSID = setCookie.split(';')[0].split('=')[1];

        if(appData.userId && appData.userId != 0) {
            result = {
                id: appData.userId,
                csrfToken: appData["csrf-token"],
                sessid: PHPSESSID,
                userName: userName,
                balance: balance,
                sales: sales,
                lastUpdate: timestamp
            };

            global.appData = result;
        } else {
            log(`Необходимо авторизоваться.`);
        }
    } catch (err) {
        log(`Ошибка при получении данных аккаунта: ${err}`, 'r');
    }
    return result;
}

async function refund(orderId) {
    try {
        const params = new URLSearchParams();

        params.append('csrf_token', global.appData.csrfToken);
        params.append('id', orderId);

        const headers = {
            "accept": "*/*",
            "cookie": `golden_key=${settings.golden_key}; PHPSESSID=${global.appData.sessid}`,
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "x-requested-with": "XMLHttpRequest"
        };

        const options = {
            method: 'POST',
            body: params,
            headers: headers
        };

        const url = `${getConst('api')}/orders/refund`;

        const resp = await fetch(url, options);
        const json = await resp.json();

        if (json.error) {
            global.telegramBot.sendMessage(`Не удалось вернуть деньги по заказу: ${orderId}. ${json.msg}`);
        } else {
            global.telegramBot.sendMessage(`Успешно вернул деньги по заказу: ${orderId}`);
        }

        
    } catch (e) {
        log(`Ошибка в ходе возврата денег: ${e}`);
    }
}

async function review(orderId, text) {
    try {
        const params = new URLSearchParams();

        params.append('csrf_token', global.appData.csrfToken);
        params.append('orderId', orderId);
        params.append('text', text);
        params.append('rating', 5);
        params.append('authorId', global.appData.id);

        const headers = {
            "accept": "*/*",
            "cookie": `golden_key=${settings.golden_key}; PHPSESSID=${global.appData.sessid}`,
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "x-requested-with": "XMLHttpRequest"
        };

        const options = {
            method: 'POST',
            body: params,
            headers: headers
        };

        await fetch(`${getConst('api')}/orders/review`, options);
    } catch (e) {
        log(`Ошибка в ходе попытки оставить отзыв: ${e}`, 'r');
    }
}

async function getOrder(orderId) {
    const order = {};
    try {
        const headers = {
            "accept": "*/*",
            "cookie": `golden_key=${settings.golden_key}; PHPSESSID=${global.appData.sessid}`,
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "x-requested-with": "XMLHttpRequest"
        };

        const options = {
            method: 'GET',
            headers: headers
        };

        const response = await fetch(`https://funpay.com/orders/${orderId.replaceAll('#', '')}/`, options);
        const html = await response.text();
        const parsed = parseDOM(html);

        const h5s = parsed.querySelectorAll('h5');

        const usernameEl = parsed.querySelector('.media-user-name');
        order.username = usernameEl.querySelector('a').innerHTML;

        for (const h1 of h5s) {
            const closest = h1.closest('div');
            const inner = h1.innerHTML;
            if (inner === 'Краткое описание') {
                order.orderName = closest.querySelector('div').innerHTML;
            } else if (inner === 'Сумма') {
                const divIn = closest.querySelector('div');
                order.priceStr = divIn.querySelector('span').innerHTML + ' ' + divIn.querySelector('strong').innerHTML;
            } else if (inner === 'Количество') {
                order.count = closest.querySelector('div').innerHTML;
            }
        }

        return order;
    } catch (e) {
        log(`Ошибка в ходе получения заказа ${orderId}: ${e}`);
    }

    return order;
}

export { headers, getUserData, countTradeProfit, enableUserDataUpdate, refund, review, getOrder };