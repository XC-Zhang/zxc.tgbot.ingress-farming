import * as TelegramBot from "node-telegram-bot-api";
import { MongoClient } from "mongodb";
import { Poll, PollBeingCreated, PollStatus, PollOption } from "./models/index";
import { config } from "./config";
const token = config.telegramBot.token;
const mongoConfig = config.mongodb;
const bot = new TelegramBot(token, {
    polling: true
});
bot.on("inline_query", onInlineQuery);
bot.onText(/\/start/, async message => {
    await createNewPoll(message.from.id);
    await bot.sendMessage(message.chat.id, "You're going to create a poll. Please send me the question:") as TelegramBot.Message;
});
bot.onText(/\/done/, onDone);
bot.onText(/^(?!\/(start|done)).+$/s, onText);
bot.on("callback_query", onCallbackQuery);

async function onInlineQuery(message: TelegramBot.InlineQuery) {
    const client = await MongoClient.connect(mongoConfig.url);
    const polls = await client.db(mongoConfig.dbname).collection<Poll>("polls").find({
        userId: message.from.id,
        active: true
    }).limit(50).sort({ "creationTime": -1 }).toArray();
    const results = polls.map(poll => ({
        id: poll._id.toHexString(),
        type: "article",
        title: poll.title,
        input_message_content: {
            message_text: poll.title
        } as TelegramBot.InputTextMessageContent
    }) as TelegramBot.InlineQueryResultArticle);
    console.debug(`User ${message.from.id} is querying. Found ${results.length} result(s).`);
    await bot.answerInlineQuery(message.id, results, {
        is_personal: true,
        switch_pm_text: "Create a new poll",
        switch_pm_parameter: "create_a_new_poll"
    });
    await client.close();
}

function onReplyToMessage(chatId: number, messageId: number) {
    return new Promise<TelegramBot.Message>((resolve, reject) => {
        const listenerId = bot.onReplyToMessage(chatId, messageId, message => {
            bot.removeReplyListener(listenerId);
            resolve(message);
        });
    });
}

async function createNewPoll(userId: number) {
    const client = await MongoClient.connect(mongoConfig.url);
    const collection = client.db(mongoConfig.dbname).collection<PollBeingCreated>("pollsBeingCreated");
    await collection.findOneAndDelete({ userId });
    const poll: PollBeingCreated = { 
        status: PollStatus.WaitForTitle,
        userId
    };
    await collection.insertOne(poll);
    await client.close();
    return poll;
}

async function onDone(message: TelegramBot.Message) {
    const client = await MongoClient.connect(mongoConfig.url);
    const db = client.db(mongoConfig.dbname);
    const collection = db.collection<PollBeingCreated>("pollsBeingCreated");
    const poll = await collection.findOne({
        userId: message.from.id
    });
    if (poll === null) {
        await bot.sendMessage(message.chat.id, "No poll is being created. Use /start to create one.");
        await client.close();
        return;
    }
    switch (poll.status) {
        case PollStatus.WaitForTitle:
            await client.close();
            await bot.sendMessage(message.chat.id, "Please send me the title before completing the poll: ");
            break;
        case PollStatus.WaitForOptions:
            const count = await db.collection<PollOption>("pollOptions").find({
                pollId: poll._id
            }).count();
            if (count === 0) {
                await client.close();
                await bot.sendMessage(message.chat.id, "Please add one option at least: ");
                break;
            }
            const newPoll: Poll = {
                _id: poll._id,
                active: true,
                creationTime: new Date(),
                title: poll.title,
                userId: poll.userId
            };
            await db.collection<Poll>("polls").insertOne(newPoll);
            await collection.findOneAndDelete({
                _id: poll._id
            });
            await client.close();
            await bot.sendMessage(message.chat.id, "You just created a poll!", {
                reply_markup: {
                    inline_keyboard: [[{
                        text: "Share",
                        switch_inline_query: poll.title
                    }]]
                }
            });
            break;
        default:
            await client.close();
            await bot.sendMessage(message.chat.id, "No poll is being created. Use /start to create one.");
            break;
    }
}

async function onText(message: TelegramBot.Message) {
    const client = await MongoClient.connect(mongoConfig.url);
    const db = client.db(mongoConfig.dbname);
    const collection = db.collection<PollBeingCreated>("pollsBeingCreated");
    const poll = await collection.findOne({
        userId: message.from.id
    });
    if (poll === null) {
        await bot.sendMessage(message.chat.id, "No poll is being created. Use /start to create one.");
        await client.close();
        return;
    }
    switch (poll.status) {
        case PollStatus.WaitForTitle:
            await collection.updateOne({
                _id: poll._id
            }, {
                $set: {
                    title: message.text,
                    status: PollStatus.WaitForOptions
                }
            });
            await client.close();
            await bot.sendMessage(message.chat.id, "Okay. Now send me your vote options: ", {
                reply_to_message_id: message.message_id
            });
            break;
        case PollStatus.WaitForOptions:
            const option: PollOption = {
                pollId: poll._id,
                text: message.text
            };
            await db.collection<PollOption>("pollOptions").insertOne(option);
            await client.close();
            await bot.sendMessage(message.chat.id, "Send me more options or /done to complete: ", {
                reply_to_message_id: message.message_id
            });
            break;
        default:
            await client.close();
            await bot.sendMessage(message.chat.id, "No poll is being created. Use /start to create one.");
            break;
    }
}

async function onCallbackQuery(callbackQuery: TelegramBot.CallbackQuery) {
}