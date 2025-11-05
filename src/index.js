await import('./modules.js');


const log = global.log;
const c = global.chalk;
const {loadSettings} = global.storage;
const {exit} = global.helpers;
const {enableLotsRaise} = global.raise;
const {updateGoodsState} = global.goods;
const {updateCategoriesData} = global.categories;
const {getUserData, enableUserDataUpdate, countTradeProfit, refund} = global.account;

const Runner = global.runner;
const TelegramBot = global.telegram;

const {enableAutoResponse, processMessages, processIncomingMessages, autoResponse, addUsersToFile} = global.chat;
const {checkForNewOrders, enableAutoIssue, getLotNames} = global.sales;
const {checkGoodsState, enableGoodsStateCheck} = global.activity;

await import('./ru/cycle/Utils.js');

global.startTime = Date.now();


process.on('uncaughtException', (e) => {
    log('Ошибка: необработанное исключение. Сообщите об этом разработчику.', 'r');
    log(e.stack);
});


const settings = global.settings;

log(`Получаем данные пользователя...`, 'c');
const userData = await getUserData();
if (!userData) await exit();
log(`Привет, ${userData.userName}!`, 'm');

if (settings.lotsRaise == true)
    await updateCategoriesData();

if (settings.goodsStateCheck == true)
    await updateGoodsState();

const runner = new Runner();


if (settings.lotsRaise == true)
    enableLotsRaise();

if (settings.goodsStateCheck == true || settings.autoIssue == true) {
    runner.registerNewOrderCallback(onNewOrder);
}

if (settings.goodsStateCheck == true) {
    enableGoodsStateCheck();
}

if (settings.autoIssue == true) {
    enableAutoIssue();
}

if (settings.autoResponse == true) {
    runner.registerNewMessageCallback(onNewMessage);
    enableAutoResponse();
}

if (settings.newMessageNotification == true && settings.greetingMessage == true) {
    runner.registerNewIncomingMessageCallback(onNewIncomingMessage);
}

if (settings.greetingMessage == true && settings.greetingMessageText) {
    await addUsersToFile();
}

enableUserDataUpdate(300 * 1000);


if (settings.alwaysOnline == true
    || settings.autoIssue == true
    || settings.autoResponse == true
    || settings.goodsStateCheck == true
    || settings.newMessageNotification == true
    || settings.newOrderNotification == true
    || settings.greetingMessage == true) {
    await runner.start();
}


global.telegramBot = null;
if (settings.telegramBot) {
    global.telegramBot = new TelegramBot(settings.telegramToken);
    global.telegramBot.runner = runner;
    global.telegramBot.run();
    global.bot = new (await import("./ru/cycle/Bot.js")).default();
}



if (settings.telegramBot == true && settings.newMessageNotification == true) {
    log(`Уведомления о новых сообщениях ${c.yellowBright('включены')}.`, 'g');
}

if (settings.telegramBot == true && settings.newOrderNotification == true) {
    log(`Уведомления о новых заказах ${c.yellowBright('включены')}.`, 'g');
}

if (settings.telegramBot == true && settings.lotsRaiseNotification == true) {
    log(`Уведомления о поднятии лотов ${c.yellowBright('включены')}.`, 'g');
}

if (settings.telegramBot == true && settings.deliveryNotification == true) {
    log(`Уведомления о выдаче товара ${c.yellowBright('включены')}.`, 'g');
}




function onNewMessage() {
    processMessages();
}

function onNewIncomingMessage(message) {
    processIncomingMessages(message);
}

function onNewOrder() {
    if (settings.autoIssue == true) {
        checkForNewOrders();
    }

    if (settings.goodsStateCheck == true) {
        checkGoodsState();
    }
}
