import { ObjectId } from "mongodb";
import { PollOptionStyles } from "./PollOptionStyles";
export class PollOption {
    _id?: ObjectId;
    pollId: ObjectId;
    text: string;
    users: number[];
    styles: PollOptionStyles
}