export interface Poll {
    active: boolean;
    creationTime: Date;
    options: string[];
    title?: string;
    userId: number;
}