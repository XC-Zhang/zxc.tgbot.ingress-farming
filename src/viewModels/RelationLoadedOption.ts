import { TelegramUser } from "../models";

export interface RelationLoadedOption {
    text: string,
    users: TelegramUser[]
}