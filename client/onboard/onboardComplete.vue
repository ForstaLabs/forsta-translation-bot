<style>
</style>

<template>
    <div class="ui main text container" style="margin-top: 80px;">
        <div class="ui container center aligned">
            <div class="ui basic segment huge">
                <h1>
                    <i class="circular icon add user"></i>
                    Create Bot User
                </h1>
                This bot will send and receive messages autonomously <br />
                as a <strong>new</strong> Forsta user you create.
                <br /><br />
                Enter the name you would like to use for the bot.
            </div>
            <div class="ui centered grid">
                <div class="ui nine wide column basic segment left aligned t0 b1">
                    <form v-on:submit.prevent="submit" class="ui huge form" :class="{loading: loading}">
                        <div class="field">
                            <label>Username</label>
                            <div class="ui left icon input">
                                <input 
                                    v-focus.lazy="true" 
                                    type="text" 
                                    name="username" 
                                    placeholder="username" 
                                    autocomplete="off" 
                                    v-model="username"
                                >
                                <i class="lock icon"></i>
                            </div>
                        </div>
                        <div class="field">
                            <label>Tag</label>
                            <div class="ui left icon input">
                                <input
                                    type="text"
                                    name="secret"
                                    placeholder="user.tag"
                                    autocomplete="off"
                                    v-model="tag">
                                <i class="lock icon"></i>
                            </div>
                        </div>
                        <button class="ui large primary submit button right floated" type="submit">Submit</button>
                        <sui-message size="small" negative v-if="error" :content="error" />
                    </form>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
util = require('../util');
shared = require('../globalState');
focus = require('vue-focus');

module.exports = {
    data: () => ({
        tag: '', 
        username: '', 
        loading: false,
        error: '',
        global: shared.state
    }),
    methods: {
        submit () {
            var value = this.secret;
            var otp = this.otp;
            this.loading = true;
            const options = { 
                method: 'POST', 
                body: {
                    tag_slug: this.tag, 
                    first_name: this.username.split(" ")[0],
                    last_name: this.username.split(" ")[1] || ""
                }
            };
            util.fetch.call(this, '/api/auth/atlasauth/complete/v1/', options)
            .then(result => {
                this.loading = false;
                if (result.ok) {
                    this.global.onboardStatus = 'complete';
                    this.$router.push({ name: 'dashboard' });
                    return false;
                } else {
                    this.error = util.mergeErrors(result.theJson) || 'Internal error, please try again.';
                    setTimeout(() => this.error = "", 2000);
                    return false;
                }
            })
            .catch(err => {
                this.error = util.mergeErrors(result.theJson) || 'Internal error, please try again.';
                this.loading = false;
            });
            return false;
        }
    },
    watch: {
        username() {
            const first = this.username.split(/(\s+)/)[0].toLowerCase();
            const last = (this.username.split(/(\s+)/)[2] || '').toLowerCase();
            this.tag = first + (last ? "." + last : "");
        },
    },
    directives: {
        focus: focus.focus
    }
}
</script>