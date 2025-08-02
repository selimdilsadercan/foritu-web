const fs = require("fs");
const pdf = require("pdf-parse");

const debugPDF = async () => {
  try {
    const dataBuffer = fs.readFileSync("test/data/transkript.pdf");
    const data = await pdf(dataBuffer);
    const text = data.text;

    console.log("📄 PDF Content Preview:");
    console.log("=".repeat(50));
    console.log(text.substring(0, 2000)); // Show first 2000 characters
    console.log("=".repeat(50));
    
    // Look for semester patterns
    const semesterMatches = text.match(/(20\d{2}-20\d{2} (Güz|Bahar|Yaz) Dönemi)/g);
    console.log("\n🎓 Found semester patterns:", semesterMatches);
    
    // Look for course code patterns
    const courseMatches = text.match(/[A-Z]{3} ?\d{3}[A-Z]?/g);
    console.log("\n📚 Found course codes:", courseMatches?.slice(0, 10)); // Show first 10
    
    // Save full text for inspection
    fs.writeFileSync("debug-pdf-content.txt", text);
    console.log("\n💾 Full PDF content saved to debug-pdf-content.txt");

  } catch (error) {
    console.error("❌ Error reading PDF:", error.message);
  }
};

console.log("🔍 Debugging PDF Content...\n");
debugPDF(); 