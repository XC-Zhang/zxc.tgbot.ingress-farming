import { Db, FilterQuery, ObjectId } from "mongodb";
import { Poll, PollOption, TelegramUser } from "../models";
import { innerJoin } from "./ArrayExtensions";
import { RelationLoadedOption } from "../viewModels/RelationLoadedOption";
import { RelationLoadedPoll } from "../viewModels/RelationLoadedPoll";

export class PollQueryService {
    constructor(public db: Db) {
        
    }

    /**
     * Searches for polls created by specified user and returns latest ones.
     * @param active whether to query in active polls of in all polls
     * @param text the poll title to search for
     * @param limit limit the number of polls to return
     */
    async latest(userId: number, active = true, text: string = null, limit = 10) {
        const collection = this.db.collection<Poll>("polls");
        await collection.createIndex({
            title: "text"
        });
        let query: FilterQuery<Poll>;
        if (text) {
            query = {
                userId,
                active,
                $text: {
                    $search: text
                }
            };
        } else {
            query = {
                userId,
                active
            };
        }
        const polls = await collection.find(query).limit(limit).sort({ "creationTime": -1 }).toArray();
        return polls;
    }

    async findOneById(pollId: ObjectId) {
        const poll = await this.db.collection<Poll>("polls").findOne({
            _id: pollId
        });
        const options = await this.db.collection<PollOption>("pollOptions").find({
            pollId
        }).toArray();
        const userIds = await this.db.collection<PollOption>("pollOptions").distinct("users", {
            pollId
        }) as number[];
        const users = await this.db.collection<TelegramUser>("telegramUsers").find({
            _id: { $in: userIds }
        }).toArray();
        return {
            title: poll.title,
            creationTime: poll.creationTime,
            options: options.map(option => ({
                text: option.text,
                users: innerJoin(option.users, users, userId => userId, user => user._id, (a, b) => b)
            } as RelationLoadedOption))
        } as RelationLoadedPoll;
    }
}