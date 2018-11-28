import { RelationLoadedOption } from "./RelationLoadedOption";

export interface RelationLoadedPoll {
    title: string,
    creationTime: Date,
    options: RelationLoadedOption[]
}