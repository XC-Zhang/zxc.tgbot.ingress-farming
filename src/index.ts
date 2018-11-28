import * as TelegramBot from "node-telegram-bot-api";
import { MongoClient, ObjectId, MongoError, MongoClientOptions } from "mongodb";
import { Poll, PollBeingCreated, PollStatus, PollOption, SentInlineMessage, TelegramUser } from "./models/index";
import { config } from "./config";
import { PollOptionTextFormatter } from "./services/PollOptionTextFormatter";
import { PollQueryService } from "./services/PollQueryService";
import { DetailPollOptionStyles } from "./models/PollOptionStyles";
import { toLocalTimezoneString } from "./services/DateExtensions";
const token = config.telegramBot.token;
const mongoConfig = config.mongodb;
const bot = new TelegramBot(token, {
    polling: true
});
MongoClient.connect(mongoConfig.url, <MongoClientOptions>{ useNewUrlParser: true }).then(client => {
    bot.on("inline_query", onInlineQuery);
    bot.onText(/\/start/, async message => {
        await createNewPoll(message.from.id);
        await bot.sendMessage(message.chat.id, "You're going to create a poll. Please send me the question:") as TelegramBot.Message;
    });
    bot.onText(/\/done/, onDone);
    bot.onText(/\/details/, onDetails);
    bot.onText(/^(?!\/(start|done|details)).+$/s, onText);
    bot.on("chosen_inline_result", onChosenInlineResult);
    bot.on("callback_query", onCallbackQuery);
    
    async function onInlineQuery(message: TelegramBot.InlineQuery) {
        const database = client.db(mongoConfig.dbname);
        const polls = await new PollQueryService(database).latest(message.from.id, true, message.query);
        const results = polls.map(poll => ({
            id: poll._id.toHexString(),
            type: "article",
            title: poll.title,
            input_message_content: {
                message_text: poll.title
            } as TelegramBot.InputTextMessageContent,
            reply_markup: {
                inline_keyboard: [[{
                    text: "Loading options...",
                    callback_data: "Loading options..."
                }]]
            }
        }) as TelegramBot.InlineQueryResultArticle);
        console.debug(`User ${message.from.id} is querying. Found ${results.length} result(s).`);
        await bot.answerInlineQuery(message.id, results, {
            is_personal: true,
            switch_pm_text: "Create a new poll",
            switch_pm_parameter: "create_a_new_poll"
        });
    }
    
    async function createNewPoll(userId: number) {
        const collection = client.db(mongoConfig.dbname).collection<PollBeingCreated>("pollsBeingCreated");
        await collection.findOneAndDelete({ userId });
        const poll: PollBeingCreated = { 
            status: PollStatus.WaitForTitle,
            userId
        };
        await collection.insertOne(poll);
        return poll;
    }
    
    async function onDone(message: TelegramBot.Message) {
        const db = client.db(mongoConfig.dbname);
        const collection = db.collection<PollBeingCreated>("pollsBeingCreated");
        const poll = await collection.findOne({
            userId: message.from.id
        });
        if (poll === null) {
            await bot.sendMessage(message.chat.id, "No poll is being created. Use /start to create one.");
            return;
        }
        switch (poll.status) {
            case PollStatus.WaitForTitle:
                await bot.sendMessage(message.chat.id, "Please send me the title before completing the poll: ");
                break;
            case PollStatus.WaitForOptions:
                const count = await db.collection<PollOption>("pollOptions").find({
                    pollId: poll._id
                }).count();
                if (count === 0) {
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
                await bot.sendMessage(message.chat.id, "No poll is being created. Use /start to create one.");
                break;
        }
    }
    
    async function onDetails(message: TelegramBot.Message) {
        const database = client.db(mongoConfig.dbname);
        const polls = await new PollQueryService(database).latest(message.from.id);
        await bot.sendMessage(message.chat.id, "Please choose one of the polls: ", {
            reply_markup: {
                inline_keyboard: polls.map(poll => ([{
                    text: poll.title,
                    callback_data: `onDetails:${poll._id.toHexString()}`
                } as TelegramBot.InlineKeyboardButton]))
            }
        });
    }

    async function onText(message: TelegramBot.Message) {
        const db = client.db(mongoConfig.dbname);
        const collection = db.collection<PollBeingCreated>("pollsBeingCreated");
        const poll = await collection.findOne({
            userId: message.from.id
        });
        if (poll === null) {
            await bot.sendMessage(message.chat.id, "No poll is being created. Use /start to create one.");
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
                await bot.sendMessage(message.chat.id, "Okay. Now send me your vote options. \r\nStyling syntax: `>[-][threshold] `. \r\n`[-]` for displaying users in one line. \r\n`[threshold]` for limiting users displayed. \r\nYou may add them at the start of the option text.", {
                    reply_to_message_id: message.message_id,
                    parse_mode: "Markdown"
                });
                break;
            case PollStatus.WaitForOptions:
                const option: PollOption = {
                    pollId: poll._id,
                    users: [],
                    ...PollOptionTextFormatter.deserialize(message.text)
                };
                await db.collection<PollOption>("pollOptions").insertOne(option);
                await bot.sendMessage(message.chat.id, "Send me more options or /done to complete: ", {
                    reply_to_message_id: message.message_id
                });
                break;
            default:
                await bot.sendMessage(message.chat.id, "No poll is being created. Use /start to create one.");
                break;
        }
    }
    
    async function onChosenInlineResult(chosenInlineResult: TelegramBot.ChosenInlineResult) {
        const id = ObjectId.createFromHexString(chosenInlineResult.result_id);
        const db = client.db(mongoConfig.dbname);
        const poll = await db.collection<Poll>("polls").findOne({
            _id: id
        });
        if (poll === null) {
            return;
        }
        await db.collection<SentInlineMessage>("sentInlineMessages").insertOne({
            pollId: id,
            inlineMessageId: chosenInlineResult.inline_message_id
        } as SentInlineMessage);
        const options = await db.collection<PollOption>("pollOptions").find({
            pollId: id
        }).toArray();
        const userIds = await db.collection<PollOption>("pollOptions").distinct("users", {
            pollId: id
        }) as number[];
        const users = await db.collection<TelegramUser>("telegramUsers").find({
            _id: { $in: userIds }
        }).toArray();
        await editInlineMessage(poll, options, users, chosenInlineResult.inline_message_id);
    }
    
    async function onCallbackQuery(callbackQuery: TelegramBot.CallbackQuery) {
        const exec = /^(onDetails:)?([0-9a-fA-F]{24})$/.exec(callbackQuery.data);
        if (exec === null) {
            await bot.answerCallbackQuery(callbackQuery.id);
            return;
        }
        const objectId = ObjectId.createFromHexString(exec[2]);
        if (exec[1]) {
            // callback query from /details
            await answerDetailsCallbackQuery(objectId, callbackQuery);
        } else {
            // callback query from choosing poll option
            await answerChoosingPollOptionCallbackQuery(objectId, callbackQuery);
        }
    }

    async function answerDetailsCallbackQuery(pollId: ObjectId, callbackQuery: TelegramBot.CallbackQuery) {
        await bot.answerCallbackQuery(callbackQuery.id);
        const database = client.db(mongoConfig.dbname);
        const poll = await new PollQueryService(database).findOneById(pollId);
        const optionText = poll.options.map(option => PollOptionTextFormatter.serialize(option.text, DetailPollOptionStyles, option.users));
        const pollText = [
            "This is a snapshot of the poll.",
            "",
            `Title: ${poll.title}`,
            "",
            `Created at: ${toLocalTimezoneString(poll.creationTime)}`,
            "",
            ...optionText
        ].join("\r\n");
        await bot.editMessageText(pollText, {
            chat_id: callbackQuery.message.chat.id,
            message_id: callbackQuery.message.message_id
        });
    }

    async function answerChoosingPollOptionCallbackQuery(optionId: ObjectId, callbackQuery: TelegramBot.CallbackQuery) {
        const db = client.db(mongoConfig.dbname);
        const optionCollection = db.collection<PollOption>("pollOptions");
        const option = await optionCollection.findOne({
            _id: optionId
        });
        if (option === null) {
            await bot.answerCallbackQuery(callbackQuery.id);
            return;
        }
        const messages = await db.collection<SentInlineMessage>("sentInlineMessages").find({
            pollId: option.pollId
        }).toArray();
        if (messages.every(message => message.inlineMessageId !== callbackQuery.inline_message_id)) {
            await bot.answerCallbackQuery(callbackQuery.id);
            return;
        }
        const poll = await db.collection<Poll>("polls").findOne({
            _id: option.pollId
        });
        if (poll === null) {
            await bot.answerCallbackQuery(callbackQuery.id);
            return;
        }
        await db.collection<TelegramUser>("telegramUsers").updateOne({
            _id: callbackQuery.from.id
        }, {
            $set: { 
                firstName: callbackQuery.from.first_name,
                lastName: callbackQuery.from.last_name
            }
        }, {
            upsert: true
        });
        if (option.users.indexOf(callbackQuery.from.id) === -1) {
            // User voted
            await optionCollection.updateOne({
                _id: option._id
            }, {
                $addToSet: { users: callbackQuery.from.id }
            });
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: `You voted for ${option.text}`
            });
        } else {
            // User took the vote.
            await optionCollection.updateOne({
                _id: option._id
            }, {
                $pull: { users: callbackQuery.from.id }
            });
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: `You took the vote for ${option.text} back`
            });
        }
        const options = await optionCollection.find({ 
            pollId: option.pollId 
        }).toArray();
        const userIds = await optionCollection.distinct("users", {
            pollId: option.pollId
        }) as number[];
        const users = await db.collection<TelegramUser>("telegramUsers").find({
            _id: { $in: userIds }
        }).toArray();
        // Update all sent inline messages.
        await Promise.all(messages.map(message => editInlineMessage(poll, options, users, message.inlineMessageId).catch(reason => {
            if (/MESSAGE_ID_INVALID/.test(reason.message)) {
                // Message has been deleted from the telegram server.
                // Removing the message from out database.
                console.debug(`Received MESSAGE_ID_INVALID from telegram server. Removing corresponding database record. Poll ${message.pollId}; Inline Message ${message.inlineMessageId}`);
                return db.collection<SentInlineMessage>("sentInlineMessages").deleteOne({
                    pollId: message.pollId,
                    inlineMessageId: message.inlineMessageId
                });
            } else if (reason.message === "ETELEGRAM: 400 Bad Request: message is not modified") {
                console.info(reason.message);
            } else {
                console.error(reason);
            }
        })));
    }
}, (error: MongoError) => {
    console.error(error);
});

function escapeHTML(html: string) {
    return html
        .replace(/</, "&lt;")
        .replace(/>/, "&gt;")
        .replace(/&/, "&amp;");
}
    
function getPollText(poll: Poll, options: PollOption[], users: TelegramUser[]) {
    return [
        escapeHTML(poll.title), 
        "", 
        ...options.map(option => {
            const joinedUsers = innerJoin(option.users, users, userId => userId, user => user._id, (a, b) => b);
            return PollOptionTextFormatter.serialize(option.text, option.styles, joinedUsers);
        })
    ].join("\r\n");
}

function innerJoin<TOuter, TInner, TKey, TResult>(outer: TOuter[], inner: TInner[], outerKeySelector: (outer: TOuter) => TKey, innerKeySelector: (inner: TInner) => TKey, resultSelector: (a: TOuter, b: TInner) => TResult) {
    const index = inner.reduce((map, current) => map.set(innerKeySelector(current), current), new Map<TKey, TInner>());
    return outer.map(element => resultSelector(element, index.get(outerKeySelector(element))));
}

function editInlineMessage(poll: Poll, options: PollOption[], users: TelegramUser[], inlineMessageId: string) {
    return bot.editMessageText(getPollText(poll, options, users), {
        inline_message_id: inlineMessageId,
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: options.map(option => [{
                text: `(${option.users.length}) ${option.text}`,
                callback_data: option._id.toHexString()
            } as TelegramBot.InlineKeyboardButton])
        }
    });
}
