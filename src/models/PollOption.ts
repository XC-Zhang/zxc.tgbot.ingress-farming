import { ObjectId } from "mongodb";
export class PollOption {
    _id?: ObjectId;
    pollId: ObjectId;
    text: string;
    users: number[];
}