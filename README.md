Forsta Translation Bot
========

This repository is based on a Node.js-based Forsta end-to-end-encrypted messaging client.
It allows for autonomous receipt, processing, storage, and/or transmission of messaging 
data to perform some useful task.

This bot is used as a translator for threads. Upon initial setup you associate the bot with a user by 
giving their credentials to the bot. For example, as org administrator you might create a new
user called '@translation.bot' and use them as the bot.
Once the user is associated with the bot, all messages sent to that user will be forwarded
to the bot and subsequently processed.

Once you have assigned a user to the bot you can simply /add that user to your thread
and configure it by @mentioning it. (e.g. @translation.bot language spanish).
Once configured the bot will translate each incoming message to the language using Google Translate to the language of your choice.

Here are a list of commands for the translation bot: 
``` 
help - lists my commands 
language [language] - sets your preferred language to the specified language`
```

Once you have a language configured the translation bot with reply to all messages in the thread
with a translation.

Install Requirements
--------
 * Node.js 8
 * Ruby
   * sass (`gem install sass`)
 * [A Google cloud service account](https://cloud.google.com/translate/docs/quickstart-client-libraries)
 * [Redis](https://redis.io/topics/quickstart)
   

Developer Install
--------
Create a file named .env with the following values:
```
RELAY_STORAGE_BACKING=redis
GOOGLE_PROJECT_ID=[google cloud project id with the translation API enabled]
GOOGLE_APPLICATION_CREDENTIALS=[path to application credentials JSON file]
```

Clone this repository and build:
```
git clone https://github.com/ForstaLabs/translation-bot.git
cd translation-bot
make run
```

Note on Heroku
--------
Deploying to heroku requires that you have valid a application credentials json file for 
the Google Cloud Translation API. However you may not want to check in your credential
file to github. Therefore when deploying to heroku use this buildpack: 

https://elements.heroku.com/buildpacks/elishaterada/heroku-google-application-credentials-buildpack

Usage
--------
Once running, the default port and listening address are `0.0.0.0:4096`.  If
you are running locally you can access the web interface by opening
*http://localhost:4096*.

You can change the listening address by setting `LISTEN_ADDR` to a valid host
address for your server, E.g. something like `localhost` or `127.0.0.1` to only
accept local connections.

The default listening port can be changed by setting `PORT` to any valid
numeric port, e.g. `8000`.

Storage is managed through Forsta
[librelay](https://github.com/ForstaLabs/librelay-node) which currently
supports local filesystem and Redis.  For more information about setting
up custom storage see: https://github.com/ForstaLabs/librelay-node#storage.

The Why &mdash; Decentralized Data Security
--------

What is important to Forsta is that **your messaging data** is only accessible to messaging 
clients that **you are in control** of, whether the client is an app running on 
the phone in your pocket, or a bot that is running on a server in your
datacenter or the compute cloud of your choice. 

Some organizations need to be able perform forensic e-discovery on past 
messages. Others may need to be able to automatically monitor for 
transmission of sensitive information. Or maybe they want something to 
automatically deliver sensitive information, or answer 
help-desk questions and handle after-hours inquires. Or individual users 
might want to be able to securely access their own message histories after 
buying a new phone and reinstalling their messaging client.

There are countless needs like these, and typically they are satisfied using 
**centrally-managed** infrastructure that can receive, store, process, and respond 
to messages as needed. Even systems that have pluggable architectures 
to facilitate outside development of these sorts of capabilities usually rely on a 
centralized approach. Unfortunately, the centralized approach provides a 
tempting, centralized target for outside 
attackers -- and it also requires users to trust that *insiders* won't abuse 
their access to all messages. Forsta is different.

Forsta does not offer anything that depends on centralized receipt, storage, or 
processing of users’ messaging data.  Instead, Forsta makes it trivial for 
*others* to run messaging “bots” to perform these functions. These bots are just 
another kind of messaging client, like the messaging clients running in users’ 
browsers and on their phones. And just like the other messaging clients, Forsta 
bots send and receive end-to-end encrypted messages to do their work **while 
running in a context controlled by the user**.

License
--------
Licensed under the GPLv3: http://www.gnu.org/licenses/gpl-3.0.html

* Copyright 2015-2016 Open Whisper Systems
* Copyright 2017-2018 Forsta Inc.
