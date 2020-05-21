import gulp from "gulp";
import yargs from "yargs";
// dodatni paket gulp-sass
import sass from "gulp-sass";
// dodatni paket za minifikaciju
import cleanCSS from "gulp-clean-css";
// dodatni paket da bi mogli da postavimo if pitalicu
import gulpif from "gulp-if";
// dodatni paket za pravljenje source maps
import soucemaps from "gulp-sourcemaps";
// dodatni paket za kompresiju slika
import imagemin from "gulp-imagemin";
// dodatni paket za brisanje DIST foldera
import del from "del";
// dodatni paket da mogu da se spoje JS fajlovi
import webpack from "webpack-stream";
// dodatni paket za bundle vise js fajlova sa webpack
import named from "vinyl-named";
// paket za kontrolu pretrazivaca
import bsync from "browser-sync";
// paket za zipovanje
import zip from "gulp-zip";
// paket za zamenu stringova
import replace from "gulp-replace";

import info from "./package.json";
/**
 * ovo prepisi u svesku
 * 1
 * npm install --save-dev browser-sync
 * browsersynk paket kako bi mogli da kontrolisemo nas pretrazivac
 * ideja je da svaki put kada posmatramo fajlove za izmenu  - watch
 * i kada se nesto promeni da se i pretrazivac refreshuje
 *
 * 2
 * novi task koji ce da nam bundluje temu i napravi zip
 * npm install gulp-zip --save-dev
 *
 * 3
 * stavimo neki dummy prefix za sve funkcije i dumi name za textdomain
 * a onda cemo sa gulp taskom da ih generisemo
 * npm install gulp-replace --save-dev
 * ovo proveri na nekom kompu
 */
// pravimo mini server
const server = bsync.create();
const PRODUCTION = yargs.argv.prod;

const paths = {
  styles: {
    src: ["src/assets/scss/bundle.scss", "src/assets/scss/admin.scss"],
    dest: "dist/assets/css"
  },
  images: {
    src: ["src/assets/images/**/*{jpg,jpeg,png,svg,gif}"],
    dest: "dist/assets/images"
  },
  scripts: {
    src: ["src/assets/js/bundle.js", "src/assets/js/admin.js"],
    dest: "dist/assets/js"
  },
  package: {
    src: [
      "**/*",
      "!.vscode",
      "!node_modules{,/**}",
      "!packaged{,/**}",
      "!src{,/**}",
      "!.babelrc",
      "!.gitignore",
      "!gulpfile.babel.js",
      "!package.json",
      "!package-lock.js"
    ],
    dest: "packaged"
  },
  other: {
    src: [
      "src/assets/**/*",
      "!src/assets/{images,js,scss}",
      "!src/assets/{images,js,scss}/**/*"
    ],
    dest: "dist/assets"
  }
};
// pravimo task za startovanje servera
export const serve = done => {
  server.init({
    proxy: "localhost:8119/tema"
    // link ka xamp serveru i projektu na kojem radimo
    // browsersync ce ovo promeniti na neku svoju sa portom 3000
  });
  done();
};
// pravimo task za refresh browsera
export const reload = done => {
  server.reload();
  done();
};
// pri pokretanju bilo koje funkcije brisemo DIST folder
export const clean = () => del(["dist"]);
// od scss pravimo minified css i dodajemo sourcemap
export const styles = () => {
  return gulp
    .src(paths.styles.src)
    .pipe(gulpif(!PRODUCTION, soucemaps.init())) // ne u produkciji
    .pipe(sass().on("error", sass.logError))
    .pipe(gulpif(PRODUCTION, cleanCSS({ compatibility: "ie8" }))) // u produkciji
    .pipe(gulpif(!PRODUCTION, soucemaps.write())) // ne u produkciji
    .pipe(gulp.dest(paths.styles.dest))
    .pipe(server.stream()); // ovo je kao da smo pokrenuli reload kod watch na styles, ali bolje je
  // menja ga bez refresh, samo doda promene -- provericu ovo
};

// kompresujemo slike u produkciji
export const images = () => {
  return gulp
    .src(paths.images.src)
    .pipe(gulpif(PRODUCTION, imagemin())) // u produkciji
    .pipe(gulp.dest(paths.images.dest));
};

// kopiramo stvari iz nekog foldera u drugi
export const copy = () => {
  return gulp.src(paths.other.src).pipe(gulp.dest(paths.other.dest));
};

// bundlujemo skripte
export const scripts = () => {
  return (
    gulp
      .src(paths.scripts.src)
      .pipe(named())
      .pipe(
        webpack({
          module: {
            rules: [
              {
                test: /\.js$/,
                use: {
                  loader: "babel-loader",
                  options: {
                    presets: ["@babel/preset-env"]
                  }
                }
              }
            ]
          },
          output: {
            filename: "[name].js"
          },
          externals: {
            jquery: "jQuery"
          },
          devtool: !PRODUCTION ? "inline-source-map" : false,
          mode: PRODUCTION ? "production" : "development" //add this
        })
      )
      //.pipe(gulpif(PRODUCTION, uglify())) // ovo ne moramo jer webpack sada vec ima ovu opciju u sebi
      .pipe(gulp.dest(paths.scripts.dest))
  );
};

// task za zipovanje konacne teme
export const compress = () => {
  return gulp
    .src(paths.package.src)
    .pipe(replace("_themename", info.name))
    .pipe(zip(info.name + ".zip"))
    .pipe(gulp.dest(paths.package.dest));
};

export const watch = () => {
  // gulp.watch("src/assets/scss/**/*.scss", gulp.series(styles, reload));
  // gore smo upotrebili drugi nacin
  gulp.watch("src/assets/scss/**/*.scss", styles);
  gulp.watch("src/assets/js/**/*.js", gulp.series(scripts, reload));
  gulp.watch("**/*.php", reload);
  gulp.watch(paths.images.src, gulp.series(images, reload));
  gulp.watch(paths.other.src, gulp.series(copy, reload));
};
// bild za dvelopment , ovde zelimo i da posmatramo promene
export const buildDev = gulp.series(
  clean,
  gulp.parallel(styles, scripts, images, copy),
  serve,
  watch
);
// funkcija za bild naseg DIST foldera
// serijalizujemo pokretanje sa gulp.series, gde redjamo redom kako da se funkcije izvrsavaju
// kada zelimo da se neki taskovi pokrenu u isto vreme smestamo ih u okviru gulp.parallel fje

export const build = gulp.series(
  clean,
  gulp.parallel(styles, scripts, images, copy)
);

export const bundle = gulp.series(build, compress);

export default buildDev;
