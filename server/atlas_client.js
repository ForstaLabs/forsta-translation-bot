const relay = require("librelay");

class BotAtlasClient extends relay.AtlasClient {

    async fetch(urn, options){
        return super.fetch(urn, options);
    }

    static get userAuthTokenDescription() {
        return 'translation bot';
    }

    static async onboard(onboardClient, botUserInfo) {
        let creatorUser = await onboardClient.fetch(
            "/v1/user/" + onboardClient.userId + "/"
        );
        const creator = `@${creatorUser.tag.slug}:${creatorUser.org.slug}`;
        console.info(`Bot onboarding performed by: ${creator}`);
        await relay.storage.set('authentication', 'adminIds', [creatorUser.id]);
        await relay.storage.putState("onboardUser", creatorUser.id);
        let botUser = null;
        try {
            botUser = await onboardClient.fetch("/v1/user/", {
                method: "POST",
                json: Object.assign({}, botUserInfo, { phone: creatorUser.phone, email: creatorUser.email, user_type: "BOT" })
            });
            console.log(botUser);
            console.info(
                `Created new bot user @${botUser.tag.slug}:${botUser.org.slug} <${botUser.id}>`
            );
            //live chat bot requires admin priveledges to retrieve ephemeral token for embed
            const result = await onboardClient.fetch("/v1/userauthtoken/", {
                method: "POST",
                json: { userid: botUser.id, description: this.userAuthTokenDescription }
            });
            console.info(
                `Created UserAuthToken for bot user @${botUser.tag.slug}:${
                botUser.org.slug
                }`
            );
            await relay.storage.putState("botUser", botUser.id);
            await relay.storage.putState("botUserAuthToken", result.token);
        } catch (e) {
            console.log(e);
            console.error("error during creation of bot user", e);
            throw e;
        }
        const atlasClient = await this.factory();

        try {
            console.log('trying to registerDevice');
            const something = await relay.registerDevice({
                name: `Bot (created by ${creator})`.substring(0, 49),
                atlasClient: atlasClient
            });
            const result = await Promise.race([Promise.all(['done', something.done]), Promise.all(['timeout', relay.util.sleep(15)])]);
            if (result[0] === 'timeout') throw 'registerDevice timed out';
            console.log("registerDevice success");
        } catch (e) {
            console.log("registerDevice didn't work out, trying registerAccount instead");
            await relay.registerAccount({
                name: `Bot (created by ${creator})`.substring(0, 49),
                atlasClient: atlasClient
            });
            console.log("registerAccount success");
        }

        return atlasClient;
    }

    static async onboardComplete() {
        return !!await relay.storage.getState("addr");
    }

    static async factory() {
        const userAuthToken = await relay.storage.getState("botUserAuthToken");
        const client = await this.authenticateViaToken(userAuthToken);
        client.maintainJWT(
            false,
            this.authenticateViaToken.bind(this, userAuthToken)
        );
        return client;
    }
}

module.exports = BotAtlasClient;