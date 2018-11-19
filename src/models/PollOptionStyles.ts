export const CollapseSeperator = ", ";
export const ExpandingSeperator = "\r\n- ";

export interface PollOptionStyles {
    collapseThreshold: number;
    seperator: string;
}

export const DefaultPollOptionStyles: PollOptionStyles = {
    collapseThreshold: 10,
    seperator: CollapseSeperator
}