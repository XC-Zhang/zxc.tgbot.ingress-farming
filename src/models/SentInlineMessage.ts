import { ObjectId } from "bson";

export interface SentInlineMessage {
    pollId: ObjectId,
    inlineMessageId: string
}