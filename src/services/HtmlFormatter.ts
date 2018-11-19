export class HtmlFormatter {
    static escapeHtml(html: string) {
        return html
            .replace(/</, "&lt;")
            .replace(/>/, "&gt;")
            .replace(/&/, "&amp;");
    }
}