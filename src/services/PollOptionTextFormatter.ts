import { PollOptionStyles, DefaultPollOptionStyles, ExpandingSeperator } from "../models/PollOptionStyles";
import { HtmlFormatter } from "./HtmlFormatter";
import { TelegramUser } from "../models";

// const StyleControlStartChar = ">";
// const StyleControlSeperatorChar = "-";
// const regex = new RegExp(`^${StyleControlStartChar}(${StyleControlSeperatorChar}?)(\\d+)\\s`);
const regex = /^>(-?)(\d+?)\s/;

export class PollOptionTextFormatter {
    static deserialize(text: string) {
        const matches = regex.exec(text);
        if (matches !== null) {
            const styles: PollOptionStyles = {
                collapseThreshold: matches[2] === "" ? DefaultPollOptionStyles.collapseThreshold : parseInt(matches[2]),
                seperator: matches[1] === "" ? ExpandingSeperator : DefaultPollOptionStyles.seperator
            };
            return {
                text: text.replace(regex, ""),
                styles
            };
        } else {
            return {
                text,
                styles: DefaultPollOptionStyles
            };
        }
    }
    static serialize(text: string, styles: PollOptionStyles, users: TelegramUser[]) {
        if (styles === undefined || styles === null) {
            styles = DefaultPollOptionStyles;
        }
        text = `(${users.length}) ${HtmlFormatter.escapeHtml(text)}`;
        if (users.length >= 8) {
            text = `${String.fromCodePoint(0x1F31F)} <strong>${text}</strong>`;
        }
        const parts = [
            text,
            ""
        ];
        if (users.length > 0) {
            const sliceEnd = styles.collapseThreshold === 0 ? users.length : styles.collapseThreshold;
            const slicedUsers = users.slice(0, sliceEnd);
            const usernames = slicedUsers.map(function (user) {
                return `${HtmlFormatter.escapeHtml(user.firstName)} ${user.lastName ? HtmlFormatter.escapeHtml(user.lastName) : ""} ${styles.includeUserId ? '(' + getInlineMentionOfAUser(user) + ')' : ""}`;
            }).join(`<b>${styles.seperator}</b>`);
            parts.splice(1, 0, `- ${usernames}`);
            if (users.length > sliceEnd) {
                parts.splice(2, 0, `- and ${users.length - sliceEnd} more...`);
            }
        }
        return parts.join("\r\n");
    }
}

function getInlineMentionOfAUser(user: TelegramUser) {
    return `<a href="tg://user?id=${user._id}">${user._id.toString()}</a>`;
}