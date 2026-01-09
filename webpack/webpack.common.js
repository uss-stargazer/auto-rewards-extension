const webpack = require("webpack");
const path = require("path");
const fs = require("fs");
const CopyPlugin = require("copy-webpack-plugin");

const SRC_DIR = path.join(__dirname, "..", "src");
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const DIST_JS_DIR = "js";
const OUTPUT_DIR = path.join(__dirname, "..", "dist", DIST_JS_DIR);
const MAINFEST_JSON = path.join(PUBLIC_DIR, "manifest.json");
const EXTENSION_JSON = path.join(SRC_DIR, "assets", "extension.json");

function updateManifestJson(ogManifest, contentScripts, background) {
  ogManifest["content_scripts"] = contentScripts;
  ogManifest["background"] = background;
  fs.writeFileSync(MAINFEST_JSON, JSON.stringify(ogManifest), "utf8");
}

function getEntryObject() {
  const extensionData = JSON.parse(fs.readFileSync(EXTENSION_JSON, "utf8"));

  updateManifestJson(
    extensionData.baseManifestJson,
    extensionData.contentScripts.map((contentScript) => {
      return {
        matches: contentScript.urlMatches,
        js: [
          "vendor.js",
          ...contentScript.scripts.map((script) => `${script.name}.js`),
        ].map((jsfile) => path.posix.join(DIST_JS_DIR, jsfile)),
      };
    }),
    { service_worker: path.posix.join(DIST_JS_DIR, "background.js") }
  );

  return {
    options: path.join(SRC_DIR, extensionData.options),
    sidepanel: path.join(SRC_DIR, extensionData.sidepanel),
    background:
      typeof extensionData.background === "string"
        ? path.join(SRC_DIR, extensionData.background)
        : extensionData.background.map((backgroundScript) =>
            path.join(SRC_DIR, backgroundScript)
          ),
    ...extensionData.contentScripts.reduce(
      (contentScriptsObject, contentScript) => {
        contentScript.scripts.forEach((script) => {
          contentScriptsObject[script.name] = path.join(SRC_DIR, script.path);
        });
        return contentScriptsObject;
      },
      {}
    ),
  };
}

module.exports = {
  entry: getEntryObject(),
  output: {
    path: OUTPUT_DIR,
    filename: "[name].js",
  },
  optimization: {
    splitChunks: {
      name: "vendor",
      chunks(chunk) {
        return chunk.name !== "background";
      },
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
  },
  plugins: [
    new CopyPlugin({
      patterns: [{ from: ".", to: "../", context: "public" }],
      options: {},
    }),
  ],
};
