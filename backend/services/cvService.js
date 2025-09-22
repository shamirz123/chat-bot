const fs = require("fs").promises;
const pdfParse = require("pdf-parse");

let CV_TEXT = "No CV data available.";

async function loadCV() {
  const pdfPath = "./Mern-stack-shahmeer-zubair.pdf"; 
  try {
    const dataBuffer = await fs.readFile(pdfPath);
    const pdfData = await pdfParse(dataBuffer);
    CV_TEXT = pdfData.text;
    console.log("CV loaded successfully.");
  } catch (err) {
    console.warn(`CV not found at ${pdfPath}.`, err.message);
  }
}

function getCVText() {
  return CV_TEXT;
}

module.exports = { loadCV, getCVText };
