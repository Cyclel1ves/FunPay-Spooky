
const fetch = global.node_fetch;
const dns = global.dns;
const https = global.https;
const proxy = global.https_proxy_agent;
const {exit, sleep} = global.helpers;
const log = global.log;


const settings = global.settings;
let retriesErrCounter = 0;


dns.setServers([
    "77.88.8.8",
    "77.88.8.1"
]);


if (settings.proxy.useProxy) {
    if (!settings.proxy.type || !settings.proxy.host) {
        log(`Неверные данные прокси!`, 'r');
        await exit();
    }

    log(`Для обработки запросов используется ${settings.proxy.type} прокси: ${settings.proxy.host}`, 'g');
}

async function staticLookup(hostname, _, cb) {
    try {
        const ips = await dns.resolve(hostname);

        if (ips.length === 0) {
            throw new Error(`Unable to resolve ${hostname}`);
        }

        cb(null, ips[0], 4);
    } catch (err) {
        log(`Ошибка при получении IP адреса: ${err}`, 'r');
    }
}

function staticDnsAgent() {
    return new https.Agent({lookup: staticLookup});
}


export default async function fetch_(url, options, delay = 0, retries = 20) {
    try {
        let tries = 1;
        if (retriesErrCounter > 5) {
            log(`Превышен максимальный лимит безуспешных попыток запросов!`, 'r');
            await exit();
        }

        
        if (!options) options = {};
        if (!options.headers) options.headers = {};
        if (!options.headers['User-Agent']) options.headers['User-Agent'] = settings.userAgent;

        
        if (settings.proxy.useProxy) {
            let proxyString = '';

            if (settings.proxy.login || settings.proxy.pass) {
                proxyString = `${settings.proxy.type}://${settings.proxy.login}:${settings.proxy.pass}@${settings.proxy.host}:${settings.proxy.port}`;
            } else {
                proxyString = `${settings.proxy.type}://${settings.proxy.host}:${settings.proxy.port}`;
            }

            options.agent = new proxy(proxyString);
        } else {
        }

        
        await sleep(delay);

        
        let res = await fetch(url, options);

        
        while (!res.ok) {
            if (tries > retries) {
                retriesErrCounter++;
                log(`Превышено количество попыток запроса.`);
                log(`Request:`);
                log(options);
                log(`Response:`);
                log(res);
                break;
            }
            ;
            await sleep(2000);
            res = await fetch(url, options);
            tries++;
        }

        retriesErrCounter = 0;
        return res;
    } catch (err) {
        log(`Ошибка при запросе (нет доступа к интернету / funpay): ${err}`);
    }
}