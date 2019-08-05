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
                Please authenticate as an <strong>org administrator</strong> to
                create this new user.
            </div>
            <div class="ui centered grid">
                <div class="ui nine wide column basic segment left aligned b1">
                    <form class="ui huge form enter-tag" :class="{loading: loading}">
                        <div class="field">
                            <label>Forsta Organization Admin Login</label>
                            <div class="ui left icon input">
                                <input v-focus.lazy="true" type="text" v-model='tag' name="tag" placeholder="user:org" autocomplete="off">
                                <i class="at icon"></i>
                            </div>
                        </div>
                        <button class="ui large primary submit button right floated" type="submit">Submit</button>
                        <div class="ui mini error message" />
                    </form>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
util = require('../util');
focus = require('vue-focus');
shared = require('../globalState');

function setup() {
    util.fetch.call(this, '/api/auth/status/v1')
    .then(result => { 
        this.global.onboardStatus = result.theJson.status;
        if (this.global.onboardStatus === 'complete') {
            this.$router.push({name: 'loginTag'});
        }
    });

    $('form.ui.form.enter-tag').form({
        fields: {
            tag: {
                identifier: 'tag',
                rules: [{
                    type: 'regExp',
                    value: /^([\da-z_]([.][\da-z_]|[\da-z_])*):([\da-z_]([.]+[\da-z_]|[\da-z_])*)$/,
                    prompt: 'please enter full @your.name:your.org'
                }]
            }
        },
        onSuccess: (event) => {
            event.preventDefault();
            requestAuth.call(this)
        }
    });
}

function requestAuth() {
    var tag = this.tag;
    this.loading = true;
    util.fetch.call(this, '/api/auth/atlasauth/request/v1/' + tag)
    .then(result => {
        this.loading = false;
        if (result.ok) {
            this.$router.push({ name: 'onboardAuth', params: { tag: this.tag, type: result.theJson.type }});
            return false;
        } else {
            util.addFormErrors('enter-tag', { tag: util.mergeErrors(result.theJson) });
            return false;
        }
    })
    .catch(err => {
        console.log('got an err in requestAuth', err);
        this.loading = false;
    });
    return false;
}

module.exports = {
    data: () => ({
        global: shared.state,
        tag: '',
        loading: false
    }),
    computed: {
        gotoSetPassword: function () {
            return {
                name: 'setPassword',
                query: { forwardTo: this.$route.query.forwardTo }
            };
        }
    },
    mounted: function () {
        setup.call(this)
    },
    methods: {
    },
    directives: {
        focus: focus.focus
    }
}
</script>