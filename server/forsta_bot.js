'use strict';

const BotAtlasClient = require('./atlas_client');
const cache = require('./cache');
const relay = require('librelay');
const uuid4 = require("uuid/v4");
const moment = require("moment");
const words = require("./authwords");
const Translate = require('@google-cloud/translate');
const isoConv = require('iso-language-converter');

const AUTH_FAIL_THRESHOLD = 10;
const projectId = 'translation-bot-1530120584152';

class ForstaBot {

    async start() {
        this.ourId = await relay.storage.getState('addr');
        if (!this.ourId) {
            console.warn("bot is not yet registered");
            return;
        }
        console.info("Starting message receiver for:", this.ourId);
        this.atlas = await BotAtlasClient.factory();
        this.getUsers = cache.ttl(60, this.atlas.getUsers.bind(this.atlas));
        this.resolveTags = cache.ttl(60, this.atlas.resolveTags.bind(this.atlas));
        this.msgReceiver = await relay.MessageReceiver.factory();
        this.msgReceiver.addEventListener('keychange', this.onKeyChange.bind(this));
        this.msgReceiver.addEventListener('message', ev => this.onMessage(ev), null);
        this.msgReceiver.addEventListener('error', this.onError.bind(this));        
        this.msgSender = await relay.MessageSender.factory();
        await this.msgReceiver.connect();

        this.translate = new Translate({ projectId: projectId });
    }

    stop() {
        if (this.msgReceiver) {
            console.warn("Stopping message receiver");
            this.msgReceiver.close();
            this.msgReceiver = null;
        }
    }

    async restart() {
        this.stop();
        await this.start();
    }

    async onKeyChange(ev) {
        console.warn("Auto-accepting new identity key for:", ev.addr);
        await ev.accept();
    }

    onError(e) {
        console.error('Message Error', e, e.stack);
    }

    fqTag(user) { 
        return `@${user.tag.slug}:${user.org.slug}`; 
    }

    fqName(user) { 
        return [user.first_name, user.middle_name, user.last_name].map(s => (s || '').trim()).filter(s => !!s).join(' '); 
    }

    fqLabel(user) { 
        return `${this.fqTag(user)} (${this.fqName(user)})`; 
    }

    /*------------------------------ 
        START TRANSLATION BOT LOGIC 
    --------------------------------*/
    async onMessage(ev) {
        const msg = this.getMsg(ev);
        if (!msg) {
            console.error("Received unsupported message:", msg);
            return;
        }

        const msgText = msg.data.body[0].value;
        const senderId = msg.sender.userId;
        const threadId = msg.threadId;
        const msgId = msg.messageId;
        const mentions = msg.data.mentions || [];
        const dist = await this.resolveTags(msg.distribution.expression); 
        const language = await relay.storage.get(msg.sender.userId, 'language');  
        
        if (mentions.filter(m => { return m === this.ourId; }).length > 0) {
            await this.respondToCommand(dist, threadId, msgId, msgText, senderId);
        } else if (!language) {
            await this.respondToDetection(dist, threadId, msgId, msgText);
        } else {
            await this.translateByUser(dist, threadId, msgId, msgText, senderId);
        }
    }

    async getCommandReply(command, dist, language, threadId, sender) {
        const replies = {
            help: `Here are a list of my commands: \nhelp - lists my commands \ninfo - provides a summary of what I do \nlanguage [language] - sets your preferred language to the specified language`,
            info: `Hello! I'm a translation bot. When you add me to a conversation, I will translate other people's messages into your preferred language. To set your preferred language, simply mention me in a message, followed by language [language], where [language] is the language code of your preferred language (e.g. 'en').`,
            language: `Okay. I have set your preferred language to ${language}`
        };
        const translation = await this.translate.translate(replies[command], language);
        return translation[0];
    }

    async getDetectionReply(dist, threadId, msgText) {
        let detection = await this.translate.detect(msgText);
        detection = detection[0];
        let isoCode = detection.language || 'en';
        let language = isoConv(isoCode);
        const reply = `Hello I am the translate bot! I have detected you are speaking in ${language}.
        Use the command @translate.bot language ${language} and I will translate each message for you!`;
        return {reply: reply, language: isoCode};
    }

    getMsg(ev) {
        const message = ev.data.message;
        const msgEnvelope = JSON.parse(message.body);
        let msg;
        for (const x of msgEnvelope) {
            if (x.version === 1) {
                msg = x;
                break;
            }
        }  
        return msg;                
    }

    async getSenderLanguage(command, sender, msgText) {
        if(command === 'language') {
            let language = msgText.split(' ')[2];
            if(language.length > 3) {
                language = language.charAt(0).toUpperCase() + language.slice(1);
                language = isoConv(language);
            }
            await relay.storage.set(sender, 'language', language);
        }
        return await relay.storage.get(sender, 'language') || 'en';  
    }

    async respondToCommand(dist, threadId, messageId, messageText, sender) {     
        const command = messageText.split(' ')[1];  
        const language = await this.getSenderLanguage(command, sender, messageText); 
        const reply = await this.getCommandReply(command, dist, language, threadId, sender);
        await this.msgSender.send({
            distribution: dist,
            threadId: threadId,
            messageRef: messageId,
            html: `${ reply }`,
            text: reply
        });
    }

    async respondToDetection(dist, threadId, messageId, message) {
        const response = await this.getDetectionReply(dist, threadId, message);
        const translation = await this.translate.translate(response.reply, response.language);
        const reply = translation[0];
        await this.msgSender.send({
            distribution: dist, 
            threadId: threadId,
            messageRef: messageId,
            html: `${reply}`, 
            text: reply
        });   
    }

    async translateByUser(dist, threadId, messageId, messageText, sender) {
        const users = await this.getUsers(dist.userids);
        for(const user of users) {                        
            const language = await relay.storage.get(user.id, 'language') || 'en';        
            const translation = await this.translate.translate(messageText, language);
            const reply = translation[0];               
            await this.msgSender.send({
                distribution: dist,
                threadId: threadId,
                messageRef: messageId,
                html: `${ reply }`,
                text: reply
            });
        }
    }
    /*------------------------------ 
        END TRANSLATION BOT LOGIC 
    --------------------------------*/

    forgetStaleNotificationThreads() {
        let tooOld = new Date();
        tooOld.setDate(tooOld.getDate() - 7);

        Object.keys(this.notificationThread).forEach(n => {
            if (this.notificationThread[n].flaggedEntry.received < tooOld) {
                delete this.notificationThread[n];
            }
        });
        console.log('stale notification threads removed. currently tracking:', Object.assign({}, this.notificationThread));
    }

    async incrementAuthFailCount() {
        let fails = await relay.storage.get('authentication', 'fails', {count: 0, since: new Date()});
        fails.count++;

        if (fails.count >= AUTH_FAIL_THRESHOLD) {
            await this.broadcastNotice({
                note: `SECURITY ALERT!\n\n${fails.count} failed login attempts (last successful login was ${moment(fails.since).fromNow()})`
            });
        }

        await relay.storage.set('authentication', 'fails', fails);
    }

    async resetAuthFailCount() {
        await relay.storage.set('authentication', 'fails', {count: 0, since: new Date()});
    }

    async getSoloAuthThreadId() {
        let id = await relay.storage.get('authentication', 'soloThreadId');
        if (!id) {
            id = uuid4();
            relay.storage.set('authentication', 'soloThreadId', id);
        }

        return id;
    }

    async getGroupAuthThreadId() {
        let id = await relay.storage.get('authentication', 'groupThreadId');
        if (!id) {
            id = uuid4();
            relay.storage.set('authentication', 'groupThreadId', id);
        }

        return id;
    }

    genAuthCode(expirationMinutes) {
        const code = `${words.adjective()} ${words.noun()}`;
        const expires = new Date();
        expires.setMinutes(expires.getMinutes() + expirationMinutes);
        return { code, expires };
    }

    removeExpiredAuthCodes(pending) {
        const now = new Date();

        Object.keys(pending).forEach(uid => {
            pending[uid].expires = new Date(pending[uid].expires);
            if (pending[uid].expires < now) {
                delete pending[uid];
            }
        });

        return pending;
    }

    async sendAuthCode(tag) {
        tag = (tag && tag[0] === '@') ? tag : '@' + tag;
        const resolved = await this.resolveTags(tag);
        if (resolved.userids.length === 1 && resolved.warnings.length === 0) {
            const uid = resolved.userids[0];
            const adminIds = await relay.storage.get('authentication', 'adminIds');
            if (!adminIds.includes(uid)) {
                throw { statusCode: 403, info: { tag: ['not an authorized user'] } }; 
            }

            const auth = this.genAuthCode(1);
            console.log(auth, resolved);
            this.msgSender.send({
                distribution: resolved,
                threadTitle: 'Message Bot Login',
                threadId: await this.getGroupAuthThreadId(),
                text: `codewords: ${auth.code}\n(valid for one minute)`
            });
            const pending = await relay.storage.get('authentication', 'pending', {});
            pending[uid] = auth;
            await relay.storage.set('authentication', 'pending', pending);
            
            return resolved.userids[0];
        } else {
            throw { statusCode: 400, info: { tag: ['not a recognized tag, please try again'] } }; 
        }
    }

    async validateAuthCode(userId, code) {
        console.log(userId, code);
        let pending = await relay.storage.get('authentication', 'pending', {});
        pending = this.removeExpiredAuthCodes(pending);
        const auth = pending[userId];
        if (!auth) {
            throw { statusCode: 403, info: { code: ['no authentication pending, please start over'] } }; 
        }
        if (auth.code != code) {
            this.incrementAuthFailCount();
            await relay.util.sleep(.5); // throttle guessers
            throw { statusCode: 403, info: { code: ['incorrect codewords, please try again'] } }; 
        }

        delete pending[userId];
        relay.storage.set('authentication', 'pending', pending);

        await this.broadcastNotice({note: 'LOGIN', actorUserId: userId, listAll: false});
        await this.resetAuthFailCount();
        return true;
    }

    async getAdministrators() {
        const adminIds = await relay.storage.get('authentication', 'adminIds', []);
        const adminUsers = await this.getUsers(adminIds);
        const admins = adminUsers.map(u => {
            return {
                id: u.id,
                label: this.fqLabel(u)
            };
        });
        return admins;
    }

    async broadcastNotice({note, actorUserId, listAll=true}) {
        const adminIds = await relay.storage.get('authentication', 'adminIds', []);
        let added = false;
        if (actorUserId && !adminIds.includes(actorUserId)) {
            adminIds.push(actorUserId);
            added = true;
        }
        const adminUsers = await this.getUsers(adminIds);
        const actor = adminUsers.find(u => u.id === actorUserId);
        const actorLabel = actor ? this.fqLabel(actor) : '<unknown>';
        const expression = adminUsers.map(u => this.fqTag(u)).join(' + ');
        const distribution = await this.resolveTags(expression);

        const adminList = adminUsers.filter(u => !(added && u.id === actorUserId)).map(u => this.fqLabel(u)).join('\n');

        let fullMessage = note;
        fullMessage += actorUserId ? `\n\nPerformed by ${actorLabel}` : '';
        fullMessage += listAll ? `\n\nCurrent authorized users:\n${adminList}` : '';
        fullMessage = fullMessage.replace(/<<([^>]*)>>/g, (_, id) => {
            const user = adminUsers.find(x => x.id === id);
            return this.fqLabel(user);
        });

        this.msgSender.send({
            distribution,
            threadTitle: 'Compliance Alerts',
            threadId: await this.getSoloAuthThreadId(),
            text: fullMessage
        });
    }

    async addAdministrator({addTag, actorUserId}) {
        const tag = (addTag && addTag[0] === '@') ? addTag : '@' + addTag;
        const resolved = await this.resolveTags(tag);
        if (resolved.userids.length === 1 && resolved.warnings.length === 0) {
            const uid = resolved.userids[0];
            const adminIds = await relay.storage.get('authentication', 'adminIds');
            if (!adminIds.includes(uid)) {
                adminIds.push(uid);
                await relay.storage.set('authentication', 'adminIds', adminIds);
            }
            await this.broadcastNotice({note: `ADDED <<${uid}>> to authorized users`, actorUserId});
            return this.getAdministrators();
        }
        throw { statusCode: 400, info: { tag: ['not a recognized tag, please try again'] } }; 
    }

    async removeAdministrator({removeId, actorUserId}) {
        const adminIds = await relay.storage.get('authentication', 'adminIds', []);
        const idx = adminIds.indexOf(removeId);

        if (idx < 0) {
            throw { statusCode: 400, info: { id: ['administrator id not found'] } };
        }
        adminIds.splice(idx, 1);
        await this.broadcastNotice({note: `REMOVING <<${removeId}>> from authorized users`, actorUserId});
        await relay.storage.set('authentication', 'adminIds', adminIds);

        return this.getAdministrators();
    }
}

module.exports = ForstaBot;