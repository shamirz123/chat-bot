const fs = require("fs").promises;
const path = require("path");
const pdfParse = require("pdf-parse");

const CV_PATH = path.join(
  __dirname,
  "..",
  "Web Developer - Shahmeer Zubair.pdf",
);

let cvPromise = null;

function loadCV() {
  if (!cvPromise) {
    cvPromise = fs
      .readFile(CV_PATH)
      .then((buffer) => pdfParse(buffer))
      .then((pdf) => {
        console.log("CV loaded successfully.");
        return pdf.text;
      })
      .catch((err) => {
        console.warn(`CV not found at ${CV_PATH}.`, err.message);
        return "";
      });
  }
  return cvPromise;
}

module.exports = { loadCV, CV_NAME: "Shahmir's CV" };
