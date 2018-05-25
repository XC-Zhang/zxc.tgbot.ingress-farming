const TelegramBot = require("node-telegram-bot-api");
const token = require("./config").telegramBot.token;
const bot = new TelegramBot(token, {
    polling: true
});
