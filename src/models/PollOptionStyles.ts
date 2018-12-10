export const CollapseSeperator = ", ";
export const ExpandingSeperator = "\r\n- ";

export interface PollOptionStyles {
    collapseThreshold: number;
    seperator: string;
    includeUserId?: boolean;
}

export const DefaultPollOptionStyles: PollOptionStyles = {
    collapseThreshold: 10,
    seperator: CollapseSeperator
}

export const DetailPollOptionStyles: PollOptionStyles = {
    collapseThreshold: 0,
    seperator: ExpandingSeperator,
    includeUserId: true
}