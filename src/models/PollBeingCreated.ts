import { ObjectId } from "mongodb";

export interface PollBeingCreated {
    _id?: ObjectId;
    status: PollStatus;
    title?: string;
    userId: number;
}

export const enum PollStatus {
    WaitForTitle = 0,
    WaitForOptions = 1,
    Created = 2
}