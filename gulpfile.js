const gulp = require("gulp");

gulp.task("tsc", function () {
    const ts = require("gulp-typescript");
    const sourcemaps = require("gulp-sourcemaps");
    const project = ts.createProject("tsconfig.json");
    return project.src()
        .pipe(sourcemaps.init())
        .pipe(project())
        .js
        .pipe(sourcemaps.write(".", {
            includeContent: false,
            sourceRoot: "../src"
        }))
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