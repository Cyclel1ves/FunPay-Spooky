import * as mc from 'mineflayer';
import * as fs from "node:fs";
import * as path from "node:path";
import { data } from "./maps.js";

import pkg from 'jimp';
import { TimerUtil } from "./TimerUtil.js";
import { Order } from "./Utils.js";

const Jimp = pkg;

class Bot {
    constructor() {
        this.username = global.settings.bot.username;

        this.create();

        this._solved = false;
        this._mapData = {};
        this._mapBuffers = [];

        this.mustGive = 0;
        this.onGiveAction = () => {
        };

        this.timers = [new TimerUtil(), new TimerUtil(), new TimerUtil()];
        this.anarchy = null;
        this.captcha = true;
        this.anarchy = null;
        this.payMessage = '';
        this.balance = 0;
        this.withdrawed = false;

        this.waitingFor = new Map();
        
        this._flyingTicker = null;
        this._mimicTimeouts = [];
        this._mimicActive = false;
    }

    startVanillaMimicTimers() {
        if (this._mimicActive) return;
        this.mimic?.stop();
        this._mimicActive = true;

        const jitter = Math.floor(Math.random() * 30);
        const schedule = (fn, delay) => {
            const t = setTimeout(() => {
                this._mimicTimeouts = this._mimicTimeouts.filter((id) => id !== t);
                try { fn(); } catch (e) { }
            }, delay);
            this._mimicTimeouts.push(t);
        };

        const sendArm = (hand) => {
            if (!this.bot?._client || this.bot._client.ended) return;
            try { this.bot._client.write('arm_animation', { hand }); } catch (err) {}
        };

        const sendFlying = () => {
            if (!this.bot?._client || this.bot._client.ended) return;
            const onGround = !!this.bot.entity?.onGround;
            try { this.bot._client.write('flying', { onGround }); } catch (err) {}
        };

        schedule(() => sendArm(0), 280 + jitter);
        schedule(() => sendArm(1), 320 + jitter);

        schedule(sendFlying, 420 + jitter);
        schedule(sendFlying, 480 + jitter);
        schedule(sendFlying, 540 + jitter);

        const flyingInterval = 760 + Math.floor(Math.random() * 80);
        this._flyingTicker = setInterval(sendFlying, flyingInterval);
    }

    stopVanillaMimicTimers() {
        for (const t of this._mimicTimeouts) clearTimeout(t);
        this._mimicTimeouts = [];
        if (this._flyingTicker !== null) {
            clearInterval(this._flyingTicker);
            this._flyingTicker = null;
        }
        this._mimicActive = false;
    }

    
    attachVanillaMimic() {
        if (this.mimic) return; 

        const state = { timeouts: [], flyingTicker: null, active: false };

        const stop = () => {
            for (const t of state.timeouts) clearTimeout(t);
            state.timeouts.length = 0;
            if (state.flyingTicker) { clearInterval(state.flyingTicker); state.flyingTicker = null; }
            state.active = false; try { global.log?.('[vanilla-mimic] stop'); } catch {}
        };

        const schedule = (fn, delay) => {
            const t = setTimeout(() => {
                const idx = state.timeouts.indexOf(t);
                if (idx !== -1) state.timeouts.splice(idx, 1);
                try { fn(); } catch {}
            }, delay);
            state.timeouts.push(t);
        };

        const sendArm = (hand) => {
            const client = this.bot?._client;
            if (!client || client.ended) return;
            try { client.write('arm_animation', { hand }); } catch {}
        };

        const sendFlying = () => {
            const client = this.bot?._client;
            if (!client || client.ended) return;
            const onGround = !!this.bot.entity?.onGround;
            try { client.write('flying', { onGround }); } catch {}
        };

        const start = () => {
            if (state.active) return;
            stop();
            state.active = true; try { global.log?.('[vanilla-mimic] start'); } catch {}

            const jitter = Math.floor(Math.random() * 30);
            schedule(() => sendArm(0), 280 + jitter);
            schedule(() => sendArm(1), 320 + jitter);
            schedule(sendFlying, 420 + jitter);
            schedule(sendFlying, 480 + jitter);
            schedule(sendFlying, 540 + jitter);

            const flyingInterval = 760 + Math.floor(Math.random() * 80);
            state.flyingTicker = setInterval(sendFlying, flyingInterval);
        };

        this.mimic = { start, stop };
    }
    

    
    maybeStopMimicOnAuth(rawMsg) {
        try {
            if (!rawMsg) return;
            const stripColor = (s) => s.replace(/§./g, '').replace(/\u00A7./g, '');
            const norm = (s) => stripColor(String(s))
                .toLowerCase()
                .replace(/[!.,:;\-]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            const msg = norm(rawMsg);
            
            if (msg.includes('успешная авторизация приятной игры')) {
                this.mimic?.stop?.();
                global.log?.('[vanilla-mimic] stopped on auth success (exact)');
                return;
            }
            
            const ok = /успешн.*авторизац.*приятн.*игр/.test(msg);
            if (ok) {
                this.mimic?.stop?.();
                global.log?.('[vanilla-mimic] stopped on auth success (fuzzy)');
            }
        } catch {}
    }

    create() {
        this.bot = mc.createBot({
            username: this.username,
            host: 'SpookyTime.net',
            port: 25565,
            version: '1.18.2',
            hideErrors: true
        });

        this.attachVanillaMimic();

        this.bot.on('login', () => {
            setTimeout(() => { this.mimic?.start?.(); }, 200);
        });

        this.bot.once('spawn', () => { this.mimic?.start?.(); });

        
        
        try {
            const AUTH_OK = 'Успешная авторизация! Приятной игры!';
            this.bot.on('message', (msg) => {
				
                try {
                    const raw = msg?.toString?.() ?? '';
                    const plain = typeof msg?.getText === 'function'
                        ? msg.getText().replace(/\u00A7./g, '')
                        : raw;
                    if (raw.includes(AUTH_OK) || plain.includes(AUTH_OK)) {
                        this.mimic?.stop();
                    }
                } catch {}
            });
            this.bot.on('chat', (_username, message) => {
                try {
                    if (typeof message === 'string' && message.includes(AUTH_OK)) {
                        this.mimic?.stop();
                    }
                } catch {}
            });
        } catch {}

        this.bot.on("entityUpdate", (entity) => {
	    if (!entity || typeof entity.yaw !== 'number') return;
            if (entity.displayName === "Item Frame") {
                const radianDifference = this.bot.entity.yaw - entity.yaw;

                let degreeDifference = radianDifference * (180 / Math.PI);

                if (degreeDifference !== 180 && degreeDifference !== -180) return;

                
                
                
                
                
                
                
                
                

                
                
                
                
                
                
                

                entity.metadata.forEach((itemData) => {
                    
                    if (itemData && itemData.nbtData) {
                        const {x, y, z} = entity.position;
                        const mapId = itemData.nbtData.value.map.value;

                        
                        const rotation = 360 - entity.metadata[8] * 90;
                        this._mapData[`${x},${y},${z}`] = {mapId, rotation};
                        const task = this.waitingFor.get(mapId);
                        if (task) {
                            task(rotation, `${x},${y},${z}`);
                            this.waitingFor.delete(mapId);
                        }
                    }
                });
            }
        });

        this.bot.on('physicsTick', async () => {
            if (this.timers[0].hasTimeElapsed(5000, true) && !this.anarchy && !this.captcha) {
                this.sendMessage(`/an${global.settings.bot.anarchy}`);
                this.anarchy = global.settings.bot.anarchy;
            }

            if (this.timers[1].hasTimeElapsed(3500, true) && !this.captcha) {
                this.bot.chat('/money');
            }
        });

        this.bot.on('playerJoined', (player) => {
            if (!this.givingUser) return;

            const order = Order.getCurrent();
            if (!order) return;

            if (((player.username || '').trim().toLowerCase() === (this.givingUser || '').trim().toLowerCase())) {

                if (order.applied) {
                    this.sendMessage(`/pay ${this.givingUser} ${this.mustGive}`);
                }
            }
        });

        this.bot.on('messagestr', async msg => {
            if (global.settings.bot.chatActive === 1)
                global.telegramBot.sendMessage(`${this.username}: ${msg}`);

            this.maybeStopMimicOnAuth(msg);

            if (msg.includes('Успешная авторизация! Приятной игры!')) { this.mimic?.stop?.(); }

            const m = msg.match(/\[\$\]\s*Ваш баланс:\s*\$([\d,]+)/);
            if (m) {
                this.balance = parseFloat(m[1].replaceAll(',', ''));
            }

            if (msg.includes('BotFilter')) {
                this.captcha = true;
            }

            if (msg.includes('** ! Внимание !')) {
                this.captcha = false;
            }

            if (msg.includes('Данной команды не существует!')) {
                this.anarchy = null;
                this.sendMessage('/hub');
            }

            
            
            const _plainOnce = msg.replace(/[\u00A7][0-9A-FK-ORa-fk-or]/g, '');
            if (_plainOnce.includes('Напишите команду еще раз, чтобы отправить деньги') && this.givingUser && this.mustGive > 0) {
                this.sendMessage(`/pay ${this.givingUser} ${this.mustGive}`);
            }

            const lowerMsg = msg.toLowerCase();
            const prefix = '[$] '; 
            const suffix = `игроку ${this.givingUser}`.toLowerCase();

            
const stripColors = (s) => s.replace(/[\u00A7][0-9A-FK-ORa-fk-or]/g, '');
const escapeRegExp = (s = '') => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
if (this.givingUser) {
            const plain = stripColors(msg);
            const successRe = new RegExp('\\$[\\d\\s,\\.]+' + '\\s*отправлено\\s+игроку\\s+' + escapeRegExp(this.givingUser) + '\\b', 'i');
            
            if (successRe.test(plain) || (lowerMsg.startsWith(prefix) && lowerMsg.endsWith(suffix))) {
            
                            this.payMessage = msg;
                            this.onGiveAction();
                        }
            }
        });

        this.bot._client.on("map", (packet) => {
            const mapId = packet.itemDamage;
            this.waitingFor.set(mapId, async (rotation, cords) => {
                if (typeof packet.data != "undefined" && packet.data) {
                    this._mapBuffers[mapId] = data(packet.data).toBlobSync();
                    setTimeout(() => this.solveMaps(), 1000)
                }
            });
        });

        this.bot.on('end', reason => {
            console.log(`${this.username} Ended: ${reason}`);
            this._mapBuffers = [];
            this._mapData = {};
            this._solved = false;
            this.create();
        });

        this.bot.on('kicked', reason => {
            console.log(`${this.username} Kicked: ${reason}`);
            this.mimic?.stop();
        });
    }

    sendMessage(msg) {
        this.bot.chat(msg);
        global.log(`[BOT SEND]: ${msg}`, 'r');
    }

    async clickSlot(id, button, clickType = 0) {
        await this.bot.clickWindow(id, button, clickType)
            .then(() => {
                global.log(`Кликнул на ${id} слот!`);
            })
            .catch(e => {
            });
    }

    isLogged() {
        return this.bot !== null;
    }

    async solveMaps() {
        if (!this._solved) {
            this._solved = true;
            try {
                const mapSize = 128;

                if (this._mapBuffers.length > 8000) return;

                const imageWidth = mapSize * 4;
                const imageHeight = mapSize * 3;

                const image = await new Jimp(imageWidth, imageHeight);

                const sortedCoordinates = Object.keys(this._mapData).sort((a, b) => {
                    const [ax, ay, az] = a.split(",").map(coord => parseInt(coord.trim(), 10));
                    const [bx, by, bz] = b.split(",").map(coord => parseInt(coord.trim(), 10));

                    if (az !== bz) {
                        return az - bz;
                    } else if (ay !== by) {
                        return ay - by;
                    } else {
                        return ax - bx;
                    }
                });

                let allZeq = true;
                const firstZ = sortedCoordinates[0].split(",").map(coord => parseInt(coord.trim(), 10))[2];

                for (const coord of sortedCoordinates) {
                    const [x, y, z] = coord.split(",").map(coord => parseInt(coord.trim(), 10));

                    if (z !== firstZ) {
                        allZeq = false;
                        break;
                    }
                }

                for (let i = 0; i < sortedCoordinates.length; i++) {
                    const [x, y, z] = sortedCoordinates[i]
                        .split(",")
                        .map((coord) => parseInt(coord));
                    const {mapId, rotation} = this._mapData[sortedCoordinates[i]];
                    let xIndex, yIndex;

                    if (z === 7) {
                        xIndex = 2 - (x - 4);
                        yIndex = 1 - (y - 252);
                    } else if (z === 1) {
                        if (x >= 4) {
                            console.log('PON');
                            xIndex = x - 4;
                        } else {
                            xIndex = 2 - (x - 3);
                        }

                        yIndex = 1 - (y - 252);
                    } else {
                        if (allZeq) {
                            console.log('Z EQUALS');
                            xIndex = x - 5;
                            yIndex = z - 3;
                        } else {
                            if (x === 2) {
                                xIndex = 1 - (z - 4);
                            } else if (x === 8) {
                                xIndex = z - 3;
                            } else {
                                xIndex = x;
                            }
                            yIndex = 1 - (y - 252);
                        }
                    }

                    const mapImage = await Jimp.read(this._mapBuffers[mapId]);
                    mapImage.rotate(rotation, false);
                    image.blit(mapImage, xIndex * mapSize, yIndex * mapSize);
                }

                const resultBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);

                

                const resultPath = path.join(
                    process.cwd(),
                    `./result_${this.username}.jpg`,
                );

                fs.writeFileSync(resultPath, resultBuffer);
                console.log(resultPath);

                setTimeout(() => {
                    global.telegramBot.sendPhoto(resultPath);
                }, 2000);
            } catch (e) {
                console.log(e);
            }
        }
    }
}

export default Bot;