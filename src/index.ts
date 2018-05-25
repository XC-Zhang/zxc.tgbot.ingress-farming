import * as TelegramBot from "node-telegram-bot-api";
import { MongoClient } from "mongodb";
import { Poll } from "./models/index";
import { config } from "./config";
const token = config.telegramBot.token;
const mongoConfig = config.mongodb;
const bot = new TelegramBot(token, {
    polling: true
});
bot.on("inline_query", onInlineQuery);
bot.onText(/\/start/, async message => {
    let sentMessage = await bot.sendMessage(message.chat.id, "Please send me the question:", {
        reply_markup: {
            force_reply: true
        }
    }) as TelegramBot.Message;
    const poll: Poll = {
        userId: message.from.id,
        active: true,
        creationTime: new Date(),
        options: []
    };
    poll.title = (await onReplyToMessage(message.chat.id, sentMessage.message_id)).text;
    sentMessage = await bot.sendMessage(message.chat.id, "Okay. Now send me your vote options: ", {
        reply_markup: {
            force_reply: true
        }
    }) as TelegramBot.Message;
    poll.options.push((await onReplyToMessage(message.chat.id, sentMessage.message_id)).text);
});


async function onInlineQuery(message: TelegramBot.InlineQuery) {
    const client = await MongoClient.connect(mongoConfig.url);
    const polls = await client.db(mongoConfig.dbname).collection<Poll>("polls").find({
        userId: message.from.id,
        active: true
    }).limit(50).sort({ "creationTime": -1 }).toArray();
    const results = polls.map(poll => ({
        title: poll.title
    }) as TelegramBot.InlineQueryResultArticle);
    console.debug(`User ${message.from.id} is querying. Found ${results.length} result(s).`);
    await bot.answerInlineQuery(message.id, results, {
        is_personal: true,
        switch_pm_text: "Create a new poll",
        switch_pm_parameter: "create_a_new_poll"
    });
}

function onReplyToMessage(chatId: number, messageId: number) {
    return new Promise<TelegramBot.Message>((resolve, reject) => {
        const listenerId = bot.onReplyToMessage(chatId, messageId, message => {
            bot.removeReplyListener(listenerId);
            resolve(message);
        });
    });
}