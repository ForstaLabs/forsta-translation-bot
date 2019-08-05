const BotAtlasClient = require('../atlas_client');
const csvStringify = require('csv-stringify');
const express = require('express');
const relay = require('librelay');
const jwt = require('jsonwebtoken');
const uuidv4 = require('uuid/v4');


async function genToken(userId) {
    let secret = await relay.storage.get('authentication', 'jwtsecret');
    if (!secret) {
        secret = uuidv4();
        await relay.storage.set('authentication', 'jwtsecret', secret);
    }
    return jwt.sign({ userId }, secret, { algorithm: "HS512", expiresIn: 2*60*60 /* later maybe: "2 days" */ });
}

class APIHandler {

    constructor({server, requireAuth=true}) {
        this.server = server;
        this.router = express.Router();
    }

    asyncRoute(fn, requireAuth=true) {
        if (process.env.API_AUTH_OVERRIDE === 'insecure') requireAuth = false;

        /* Add error handling for async exceptions.  Otherwise the server just hangs
         * the request or subclasses have to do this by hand for each async routine. */
        return (req, res, next) => {
            if (requireAuth) {
                const header = req.get('Authorization');
                const parts = (header || '').split(' ');
                if (!header || parts.length !== 2 || parts[0].toLowerCase() !== 'jwt') {
                    console.log('missing authentication for this bot server request');
                    res.status(401).send({ message: 'forbidden' });
                } else {
                    relay.storage.get('authentication', 'jwtsecret')
                        .then((secret) => {
                            try {
                                const jwtInfo = jwt.verify(parts[1], secret);
                                fn.call(this, req, res, next, jwtInfo.userId).catch(e => {
                                    console.error('Async Route Error:', e);
                                    next();
                                });
                            } catch (err) {
                                console.log('bad authentication for this bot server request', err);
                                res.status(401).send({ message: 'forbidden' });
                            }
                        })
                        .catch(err => {
                            console.log('storage error while checking authentication for this bot server request', err);
                            res.status(401).send({ message: 'forbidden' });
                        });
                }
            } else {
                fn.call(this, req, res, next).catch(e => {
                    console.error('Async Route Error:', e);
                    next();
                });
            }
        };
    }

    async toCSV(data) {
        return await new Promise((resolve, reject) => {
            try {
                csvStringify(data, (e, output) => {
                    if (e) {
                        reject(e);
                    } else {
                        resolve(output);
                    }
                });
            } catch(e) {
                reject(e);
            }
        });
    }
}


class AuthenticationAPIV1 extends APIHandler {

    constructor(options) {
        super(options);
        this.router.get('/status/v1', this.asyncRoute(this.onStatusGet, false));
        this.router.get('/atlasauth/request/v1/:tag', this.asyncRoute(this.onRequestAtlasAuthentication, false));
        this.router.post('/atlasauth/authenticate/v1/:tag', this.asyncRoute(this.onAtlasAuthenticate, false));
        this.router.post('/atlasauth/complete/v1/', this.asyncRoute(this.onComplete, true));
        this.onboarderClient = null;
    }

    async onStatusGet(req, res, next) {
        const registered = await BotAtlasClient.onboardComplete();
        res.status(200).json({
            status: registered ? 'complete' : (BotAtlasClient.onboardingCreatedUser ? 'authenticate-admin' : 'authenticate-user')
        });
    }

    async onRequestAtlasAuthentication(req, res) {
        const tag = req.params.tag;
        if (!tag) {
            res.status(412).json({
                error: 'missing_arg',
                message: 'Missing URL param: tag'
            });
            return;
        }
        try {
            let result = await BotAtlasClient.requestAuthentication(tag);
            res.status(200).json({type: result.type});
        } catch (e) {
            res.status(e.code).json(e.json);
        }
        return;
    }

    async onAtlasAuthenticate(req, res) {
        const tag = req.params.tag;
        if (!tag) {
            res.status(412).json({
                error: 'missing_arg',
                message: 'Missing URL param: tag'
            });
            return;
        }
        const type = req.body.type;
        const value = req.body.value;
        if (!type) {
            res.status(412).json({
                error: 'missing_arg',
                message: 'Missing payload param: type'
            });
            return;
        }
        if (!value) {
            res.status(412).json({
                error: 'missing_arg',
                message: 'Missing payload param: value'
            });
            return;
        }
        try {
            if (type === 'sms') {
                console.log('about to sms auth with', tag, value);
                this.onboarderClient = await BotAtlasClient.authenticateViaCode(tag, value);
                console.log('returned with', this.onboarderClient);
            } else if (type === 'password') {
                console.log('about to password auth with', tag, value);
                this.onboarderClient = await BotAtlasClient.authenticateViaPassword(tag, value);
                console.log('returned with', this.onboarderClient);
            } else if (type === 'totp') {
                const otp = req.body.otp;
                if (!otp) {
                    res.status(412).json({
                        error: 'missing_arg',
                        message: 'Missing payload param: otp'
                    });
                    return;
                }
                console.log('about to password+totp auth with', tag, value, otp);
                this.onboarderClient = await BotAtlasClient.authenticateViaPasswordOtp(tag, value, otp);
                console.log('returned with', this.onboarderClient);
            } else {
                res.status(412).json({
                    error: 'value_error',
                    message: 'Missing payload param: type must be sms or password'
                });
            }
        } catch (e) {
            if (e.code == 429) {
                res.status(403).json({ "non_field_errors": ["Too many requests, please try again later."] });
            } else {
                res.status(e.code).json(e.json || {non_field_errors: ['Internal error, please try again.']});
            }
            return;
        }

        const token = await genToken(await relay.storage.getState("onboardUser"));
        res.status(200).json({ token });
    }

    async onComplete(req, res) {
        const { first_name, last_name, tag_slug } = req.body;
        if (!first_name) {
            res.status(412).json({
                error: 'missing_arg',
                message: 'Missing URL param: first_name'
            });
            return;
        }
        if (!last_name) {
            res.status(412).json({
                error: 'missing_arg',
                message: 'Missing URL param: last_name'
            });
            return;
        }
        if (!tag_slug) {
            res.status(412).json({
                error: 'missing_arg',
                message: 'Missing URL param: tag_slug'
            });
            return;
        }
        try {
            console.log("onboarder client available for .onboard?");
            console.log(this.onboarderClient ? "yes" : "no");
            await BotAtlasClient.onboard(this.onboarderClient, req.body);
        } catch (e) {
            if (e.code === 403) {
                res.status(403).json({non_field_errors: ['Insufficient permission. Need to be an administrator?']});
            } else  {
                res.status(e.code || 500).json({non_field_errors: ['Internal error. (User may already exist)']});
            }
            return;
        }
        await this.server.bot.start(); // it could not have been running without a successful onboard

        res.status(200).json({ok: true});
    }


}

class AdminsAPIV1 extends APIHandler {

    constructor(options) {
        super(options);
        this.router.get('/v1', this.asyncRoute(this.onGetAdministrators));
        this.router.post('/v1', this.asyncRoute(this.onUpdateAdministrators));
    }

    async onGetAdministrators(req, res) {
        try {
            const admins = await this.server.bot.getAdministrators();
            res.status(200).json({ administrators: admins });
            return;
        } catch (e) {
            console.log('problem in get administrators', e);
            res.status(e.statusCode || 500).json(e.info || { message: 'internal error'});
            return;
        }
    }

    async onUpdateAdministrators(req, res, next, userId) {
        const op = req.body.op;
        const id = req.body.id;
        const tag = req.body.tag;

        if (!(op === 'add' && tag || op === 'remove' && id)) {
            res.status(400).json({ non_field_errors: ['must either add tag or remove id'] });
        }

        try {
            const admins = (op === 'add')
                ? await this.server.bot.addAdministrator({addTag: tag, actorUserId: userId})
                : await this.server.bot.removeAdministrator({removeId: id, actorUserId: userId});
            res.status(200).json({ administrators: admins });
            return;
        } catch (e) {
            console.log('problem in update administrators', e);
            res.status(e.statusCode || 500).json(e.info || { message: 'internal error'});
            return;
        }
    }
}


module.exports = {
    APIHandler,
    AdminsAPIV1,
    AuthenticationAPIV1,
};
