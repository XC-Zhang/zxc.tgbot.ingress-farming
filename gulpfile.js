const gulp = require("gulp");

gulp.task("release", function () {
    const tar = require("gulp-tar");
    const gzip = require("gulp-gzip");
    const globs = [
        "./config.js",
        "./index.js",
        "./package.json",
        "./yarn.lock"
    ]
    gulp.src(globs)
        .pipe(tar("release.tar"))
        .pipe(gzip())
        .pipe(gulp.dest("."));
});