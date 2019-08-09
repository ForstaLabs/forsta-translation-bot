Forsta Translation Bot
========

This repository is built from Forsta's [end-to-end-encrypted messaging bot template](https://github.com/ForstaLabs/forsta-messaging-bot).
The Forsta messaging-bot provides for for autonomous receipt, processing, storage, and
transmission of messaging data in conjunction with the Forsta web messenger and iPhone/Android apps.
Please fork it or one of our several projects based off of it!

This particular bot is used as a translator for threads. Upon initial setup you create a new the bot user named
'translation.bot' and storing their address and authentication token in a database. 
This will cause all messages sent to that user to be forwarded to the bot and subsequently processed.

Once you have assigned a user to the bot you can simply /add that user to your thread
and configure it by @mentioning it. (e.g. @translation.bot language spanish).
Once configured the bot will translate each message on that thread to the language of your choice and reply
to the message with a translation.

Bot commands:
``` 
help - lists my commands 
language [language] - sets your preferred language to the specified language`
```

Once you have a language configured the translation bot with reply to all messages in the thread
with the appropriate translations.

Quick Start 
--------
[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/ForstaLabs/forsta-translation-bot)


Install Requirements
--------
 * [Node.js 8](https://nodejs.org/en/download/)
 * [Ruby](https://www.ruby-lang.org/en/documentation/installation/)
 * [Sass](https://sass-lang.com/install)
 * [A Google cloud service account](https://cloud.google.com/translate/docs/quickstart-client-libraries)
 * [Redis](https://redis.io/topics/quickstart)
   

Developer Install
--------
```
git clone https://github.com/ForstaLabs/forsta-translation-bot.git
cd translation-bot
```
Create a file named .env with the following values:
```
RELAY_STORAGE_BACKING=redis
GOOGLE_PROJECT_ID=[google cloud project id with the translation API enabled]
GOOGLE_APPLICATION_CREDENTIALS=[path to application credentials JSON file]
```
Then run the command 
```
make run
```

Note on deploying to Heroku
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

License
--------
Licensed under the GPLv3: http://www.gnu.org/licenses/gpl-3.0.html

* Copyright 2015-2016 Open Whisper Systems
* Copyright 2017-2018 Forsta Inc.
