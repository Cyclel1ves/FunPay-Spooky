
import {sleep} from "./helpers.js";
import {Order} from "./ru/cycle/Utils.js";
import {getOrder, review} from "./account.js";

const fetch = global.fetch;
const c = global.chalk;
const log = global.log;
const parseDOM = global.DOMParser;
const {load, getConst, updateFile} = global.storage;
const {getRandomTag} = global.activity;


const settings = global.settings;
const autoRespData = await load('data/configs/autoResponse.json');

let isAutoRespBusy = false;

function enableAutoResponse() {
    log(`Автоответ запущен.`, 'g');
}

async function processMessages() {
    if (isAutoRespBusy) return;
    isAutoRespBusy = true;
    let result = false;

    try {
        const chats = await getChatBookmarks();
        for (let j = 0; j < chats.length; j++) {
            const chat = chats[j];

            

            
            for (let i = 0; i < autoRespData.length; i++) {
                if (autoRespData[i].command && chat.message.toLowerCase() == autoRespData[i].command.toLowerCase()) {
                    log(`Команда: ${c.yellowBright(autoRespData[i].command)} для пользователя ${c.yellowBright(chat.userName)}.`);
                    let smRes = await sendMessage(chat.node, autoRespData[i].response);
                    if (smRes)
                        log(`Ответ на команду отправлен.`, `g`);
                    break;
                }

                




            }

            

            if (settings.autoIssueTestCommand == true && chat.message.includes("!автовыдача")) {
                const goodName = chat.message.split(`&quot;`)[1];

                if (!goodName) {
                    log(`Команда: ${c.yellowBright('!автовыдача')} для пользователя ${c.yellowBright(chat.userName)}: товар не указан.`, `c`);
                    let smRes = await sendMessage(chat.node, `Товар не указан. Укажите название предложения в кавычках (").`);
                    if (smRes)
                        log(`Ответ на команду отправлен.`, `g`);
                    break;
                }

                log(`Команда: ${c.yellowBright('!автовыдача')} для пользователя ${c.yellowBright(chat.userName)}:`);
                const {issueGood} = global.sales;
                let issueResult = await issueGood(chat.node, chat.userName, goodName, 'node');

                if (!issueResult) {
                    let smRes = await sendMessage(chat.node, `Товара "${goodName}" нет в списке автовыдачи`);
                    if (smRes)
                        log(`Ответ на команду отправлен.`, `g`);
                    break;
                }

                if (issueResult == 'notInStock') {
                    let smRes = await sendMessage(chat.node, `Товар закончился`);
                    if (smRes)
                        log(`Ответ на команду отправлен.`, `g`);
                    break;
                }
            }
        }
    } catch (err) {
        log(`Ошибка при автоответе: ${err}`, 'r');
        isAutoRespBusy = false;
    }

    isAutoRespBusy = false;
    return result;
}

async function processIncomingMessages(message) {
    
    if (message && typeof message.content === 'string') {
        try { message.content = message.content.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').trim(); } catch {}
    }
    
    if (global.telegramBot && settings.newMessageNotification) {
        if (settings.watermark) {
            if (!message.content.includes(settings.watermark)) {
                global.telegramBot.sendNewMessageNotification(message);
            }
        } else {
            global.telegramBot.sendNewMessageNotification(message);
        }
    }

    if (isSystemMessage(message.content) && message.content.includes('написал отзыв к заказу')) {
        const orderId = message.content
            .split(' ')[6] 
            .replace(/[#.]/g, ''); 

        const order = await getOrder(orderId);

        const reviewText = global.settings.reviewText
            .replaceAll('{newLine}', '\n')
            .replace('{orderName}', order.orderName || 'Неизвестный товар')
            .replace('{buyerName}', order.username || 'Неизвестный покупатель')
            .replace('{orderCount}', order.count || '0')
            .replace('{orderPrice}', order.priceStr || '0 ₽');

        await review(orderId, reviewText);
    }

    if (message.content.toLowerCase() === '/инфо' || message.content.toLowerCase() === '/info') {
        await sendMessage(message.node, 'Информация о боте:');
        return;
    } else if (message.content.toLowerCase() === '/баланс' || message.content.toLowerCase() === 'баланс' || message.content.toLowerCase() === 'balance' || message.content.toLowerCase() === '/balance') {
        await sendMessage(message.node, `Баланс ${global.bot.balance}$`);
        return;
    }

    if (message.content.includes(`Продавец ${global.appData.userName} вернул`)) {
        const orderId = message.content.split(' ')[8].replaceAll('.', '');

        if (Order.getCurrent() && Order.getCurrent().id === orderId) {
            Order.setCurrent(null);
            log(`Очистил заказ под айди ${orderId}`, 'c');
            if (global.processQueue) await global.processQueue();
        }
    }

    if (!isSystemMessage(message.content) && !message.content.includes('[💵]')) {
        if (Order.getCurrent()) {
            const bot = global.bot;
            const order = Order.getCurrent();

            const _msgUser = (message.user||'').trim().toLowerCase();
                const _orderUser = (order.username||'').trim().toLowerCase();
                if (_orderUser && _msgUser && _orderUser === _msgUser) {
                if (!order.question) {
                    const nick = message.content.trim();

                    
                    if (!/^[A-Za-z0-9_]{3,16}$/.test(nick)) {
                        await sendMessage(
                            message.node,
                            '❌ Неверный ник. Ник должен состоять из 3–16 символов (латинские буквы, цифры, подчёркивание) и без пробелов. Попробуйте ещё раз.'
                        );
                        return;  
                    }

                    bot.givingUser = nick;
                    order.applied = false;
                }

                if (order.question) {
                    const content = message.content.toLowerCase();

                    if (content.includes('да') || content.includes('lf') || content.includes('+') || content.includes('yes') || content.includes('da')) {
                        order.applied = true;
                        bot.mustGive = order.count * 1000000;

                        if (bot.balance < bot.mustGive) {
                            if (this.withdrawed) return;

                            order.sendMessage(`У бота не хватает денег! Возвращаю... (Баланс бота: ${bot.balance}, надо выдать ${bot.mustGive})`);
                            await order.refund();
                            Order.setCurrent(null);
                            log('У бота не хватает денег, возвращаю деньги!');
                            return;
                        }

                        order.sendMessage(`Хорошо. Зайдите на ${global.settings.bot.anarchy} анархию и бот вам сразу отправит деньги. Если вы находились на данной анархии, перезайдите.`);

                        if (!bot.withdrawed) {            
            bot.withdrawed = false;
}

                        bot.onGiveAction = async () => {
                            order.sendMessage(`Успешно перевёл вам ${bot.mustGive} валюты!`);
                            await sleep(1500);
                            order.sendMessage(`Подтвердите заказ и напишите отзыв если вам все понравилось!`);
                            Order.setCurrent(null);
                            bot.mustGive = 0;
                            bot.withdrawed = false;

                            if (global.processQueue) await global.processQueue();
                        }
                    } else if (content.includes('нет') || content.includes('ytn') || content.includes('-') || content.includes('net') || content.includes('no')) {            
bot.withdrawed = false;
                        order.question = false;
                        order.applied = false;
                        await sendMessage(message.node, 'Хорошо. Напишите свой ник на сервере.');
                    } else {
                        await sendMessage(message.node, `Выдавать валюту на ник "${bot.givingUser}"? (Да/Нет)`);
                    }

                    return;
                }

                if (!order.applied && !order.question) {
                    await sendMessage(message.node, `Выдавать валюту на ник "${bot.givingUser}"? (Да/Нет)`);
                    order.question = true;
                }
            }
        }
    }

    
    const newChatUsers = await load('data/other/newChatUsers.json');

    if (!newChatUsers.includes(message.user)) {
        newChatUsers.push(message.user);

        let msg = settings.greetingMessageText;
        msg = msg.replace('{name}', message.user);

        await updateFile(newChatUsers, 'data/other/newChatUsers.json');

        if (!isSystemMessage(message.content)) {
            let smRes = await sendMessage(message.node, msg);
            if (smRes)
                log(`Приветственное сообщение отправлено пользователю ${c.yellowBright(message.user)}.`, `g`);
        }
    }
}

function getUser(username) {
    for (const user of global.activeGives)
        if (user.user === username)
            return user;

    return null;
}

function includes(username) {
    for (const user of global.activeGives) {
        if (user.user === username)
            return true;
    }

    return false;
}

function removeUser(username) {
    global.activeGives = global.activeGives.filter(user => user.user !== username);
}

async function getMessages(senderId) {
    let result = false;
    try {
        const url = `${getConst('api')}/chat/history?node=users-${global.appData.id}-${senderId}&last_message=1000000000`;
        const headers = {
            "cookie": `golden_key=${settings.golden_key}`,
            "x-requested-with": "XMLHttpRequest"
        };

        const options = {
            method: 'GET',
            headers: headers
        }

        const resp = await fetch(url, options);
        result = await resp.json();
    } catch (err) {
        log(`Ошибка при получении сообщений: ${err}`, 'r');
    }
    return result;
}

async function getLastMessageId(senderId) {
    let lastMessageId = -1;
    try {
        let chat = await getMessages(senderId);
        if (!chat) return lastMessageId;
        chat = chat['chat'];
        if (!chat) return lastMessageId;

        const messages = chat.messages;
        lastMessageId = messages[messages.length - 1].id;
    } catch (err) {
        log(`Ошибка при получении id сообщения: ${err}`, 'r');
    }

    return lastMessageId;
}

async function readChat(nodeId) {
    let result = false;

    try {
        const url = `${getConst('api')}/chat/?node=${nodeId}`;
        const headers = {
            "cookie": `golden_key=${settings.golden_key}`,
            "x-requested-with": "XMLHttpRequest"
        };

        const options = {
            method: 'GET',
            headers: headers
        }

        result = await fetch(url, options);
    } catch (e) {
        log(`Ошибка при попытке прочитать чат ${nodeId}`, 'r');
        console.log(e);
    }

    return result;
}

async function sendMessage(node, message, customNode = false) {
    if (!message || message == undefined || !node || node == undefined) return;

    let result = false;

    try {
        let newNode = node;
        const url = `${getConst('api')}/runner/`;
        const headers = {
            "accept": "*/*",
            "cookie": `golden_key=${settings.golden_key}; PHPSESSID=${global.appData.sessid}`,
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "x-requested-with": "XMLHttpRequest"
        };

        if (customNode) {
            if (newNode > global.appData.id) {
                newNode = `users-${global.appData.id}-${node}`;
            } else {
                newNode = `users-${node}-${global.appData.id}`;
            }
        }

        const reqMessage = `[💵]${message}`;
        const request = {
            "action": "chat_message",
            "data": {
                "node": newNode,
                "last_message": -1,
                "content": reqMessage
            }
        };

        const params = new URLSearchParams();
        params.append('objects', '');
        params.append('request', JSON.stringify(request));
        params.append('csrf_token', global.appData.csrfToken);

        const options = {
            method: 'POST',
            body: params,
            headers: headers
        };

        const resp = await fetch(url, options);
        const json = await resp.json();

        if (json.response && json.response.error == null) {
            log(`Сообщение отправлено, чат node ${c.yellowBright(newNode)}.`, 'g');
            result = json;
        } else {
            log(`Не удалось отправить сообщение, node: "${newNode}", сообщение: "${reqMessage}"`, 'r');
            log(`Запрос:`);
            log(options);
            log(`Ответ:`);
            log(json);
            result = false;
        }
    } catch (err) {
        log(`Ошибка при отправке сообщения: ${err}`, 'r');
    }
    return result;
}

async function getNodeByUserName(userName) {
    let node = null;

    try {
        const bookmarks = await getChatBookmarks();
        if (!bookmarks) return null;

        for (let i = 0; i < bookmarks.length; i++) {
            const chat = bookmarks[i];

            if (chat.userName == userName) {
                node = chat.node;
                break;
            }
        }
    } catch (err) {
        log(`Ошибка при получении node: ${err}`, 'e');
    }

    return node;
}

async function getChatBookmarks() {
    let result = [];
    try {
        const url = `${getConst('api')}/runner/`;
        const headers = {
            "accept": "*/*",
            "cookie": `golden_key=${settings.golden_key}; PHPSESSID=${global.appData.sessid}`,
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "x-requested-with": "XMLHttpRequest"
        };

        const chat_bookmarks = {
            "type": "chat_bookmarks",
            "id": `${global.appData.id}`,
            "tag": `${getRandomTag()}`,
            "data": false
        };

        const objects = [chat_bookmarks];
        const params = new URLSearchParams();
        params.append('objects', JSON.stringify(objects));
        params.append('request', false);
        params.append('csrf_token', global.appData.csrfToken);

        const options = {
            method: 'POST',
            body: params,
            headers: headers
        };

        const resp = await fetch(url, options);
        const json = await resp.json();

        const html = json.objects[0].data.html;

        const doc = parseDOM(html);
        const chats = doc.querySelectorAll(".contact-item");

        for (let i = 0; i < chats.length; i++) {
            const chat = chats[i];

            let userName = chat.querySelector('.media-user-name').innerHTML;
            let message = chat.querySelector('.contact-item-message').innerHTML;
            let time = chat.querySelector('.contact-item-time').innerHTML;
            let node = chat.getAttribute('data-id');
            let isUnread = chat.getAttribute('class').includes('unread');

            result.push({
                userName: userName,
                message: message,
                time: time,
                node: node,
                isUnread: isUnread
            });
        }

        return result;
    } catch (err) {
        log(`Ошибка при получении списка сообщений: ${err}`, 'e');
    }
}

async function addUsersToFile() {
    try {
        const bookmarks = await getChatBookmarks();
        if (!bookmarks) return;

        let users = await load('data/other/newChatUsers.json');
        for (let i = 0; i < bookmarks.length; i++) {
            const chat = bookmarks[i];
            if (!users.includes(chat.userName))
                users.push(chat.userName);
        }

        await updateFile(users, 'data/other/newChatUsers.json');
    } catch (err) {
        log(`Ошибка при получении списка пользователей: ${err}`, 'e');
    }
}

function isSystemMessage(message) {
    if (!message) return false;

    return !!(message.includes('Покупатель') || message.includes('The buyer'));
}

export {
    getMessages,
    sendMessage,
    getChatBookmarks,
    processMessages,
    processIncomingMessages,
    addUsersToFile,
    enableAutoResponse,
    getLastMessageId,
    getNodeByUserName,

    removeUser
};
