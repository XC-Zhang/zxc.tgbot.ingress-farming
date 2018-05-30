const gulp = require("gulp");

gulp.task("tsc", function () {
    const ts = require("gulp-typescript");
    const project = ts.createProject("tsconfig.json");
    return project.src()
        .pipe(project())
        .js
        .pipe(gulp.dest("dist"));
});

gulp.task("release", function () {
    const tar = require("gulp-tar");
    const gzip = require("gulp-gzip");
    const globs = [
        "./package.json",
        "./yarn.lock",
        "./dist/**"
    ]
    gulp.src(globs, { base: "." })
        .pipe(tar("release.tar"))
        .pipe(gzip())
        .pipe(gulp.dest("."));
});