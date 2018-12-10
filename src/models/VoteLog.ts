import { ObjectId } from "mongodb";
export interface VoteLog {
    _id: ObjectId;
    telegramUserId: number;
    dateTime: Date;
    action: "Vote" | "TakeVote";
    pollOptionId: ObjectId;
}