const fs = require("fs");
const pdf = require("pdf-parse");

const debugDetailed = async () => {
  try {
    const dataBuffer = fs.readFileSync("test/data/transkript.pdf");
    const data = await pdf(dataBuffer);
    const text = data.text;

    const semesterRegex = /(20\d{2}-20\d{2} (Güz|Bahar|Yaz) Dönemi)/g;
    const semesters = text.split(semesterRegex).filter(x => x.trim() !== "");

    console.log("🔍 Detailed Analysis:");
    console.log("=".repeat(60));

    for (let i = 0; i < semesters.length; i++) {
      if (semesterRegex.test(semesters[i])) {
        const semesterName = semesters[i];
        const courseBlock = semesters[i + 1];

        console.log(`\n📚 Semester: ${semesterName}`);
        console.log("-".repeat(40));

        if (courseBlock) {
          const lines = courseBlock.split("\n").map(line => line.trim()).filter(line => line.length > 0);
          
          lines.forEach((line, index) => {
            console.log(`Line ${index + 1}: "${line}"`);
            
            // Test our regex patterns
            const hasCourseCode = /^\*?\s*[A-Z]{3}\s+\d{3}[A-Z]?/.test(line);
            const courseCodeMatch = line.match(/^\*?\s*([A-Z]{3}\s+\d{3}[A-Z]?)/);
            const courseNameMatch = line.match(/^\*?\s*[A-Z]{3}\s+\d{3}[A-Z]?\s*(.*?)(?=\s*[A-Z]{2}\s*$|\s*$)/);
            const gradeMatch = line.match(/\s([A-Z]{2})\s*[A-Z]?\s*$/);

            if (hasCourseCode) {
              console.log(`  ✅ Has course code pattern`);
              console.log(`  📝 Course code: "${courseCodeMatch?.[1] || 'NOT FOUND'}"`);
              console.log(`  📖 Course name: "${courseNameMatch?.[1] || 'NOT FOUND'}"`);
              console.log(`  🎯 Grade: "${gradeMatch?.[1] || 'NOT FOUND'}"`);
            } else {
              console.log(`  ❌ No course code pattern`);
            }
          });
        }
      }
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
};

console.log("🔍 Detailed PDF Analysis...\n");
debugDetailed(); 