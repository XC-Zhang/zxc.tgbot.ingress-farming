import { ObjectId } from "mongodb";
export interface Poll {
    _id: ObjectId;
    active: boolean;
    creationTime: Date;
    title: string;
    userId: number;
}