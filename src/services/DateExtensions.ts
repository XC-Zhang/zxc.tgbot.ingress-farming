export function toLocalTimezoneString(date: Date) {
    return date.getFullYear() + 
        "-" + (date.getMonth() + 1).toString().padStart(2, "0") + 
        "-" + date.getDate().toString().padStart(2, "0") + 
        " " + date.getHours().toString().padStart(2, "0") + 
        ":" + date.getMinutes().toString().padStart(2, "0") + 
        ":" + date.getSeconds().toString().padStart(2, "0") + 
        "." + (date.getMilliseconds() / 1000).toFixed(3).slice(2, 5) + 
        " " + getTimezoneString(date);
}

export function getTimezoneString(date: Date) {
    const offset = -date.getTimezoneOffset();
    return "UTC" + 
        ["-", " ", "+"][Math.sign(offset) + 1] + 
        Math.trunc(Math.abs(offset) / 60).toString().padStart(2, "0") + 
        ":" + (Math.abs(offset) % 60).toString().padStart(2, "0")
}