const fs = require("fs");
const pdf = require("pdf-parse");

const simpleParse = async () => {
  try {
    const dataBuffer = fs.readFileSync("test/data/transkript.pdf");
    const data = await pdf(dataBuffer);
    const text = data.text;

    console.log("🔍 Simple Parser Analysis:");
    console.log("=".repeat(50));

    // Find all semester headers
    const semesterMatches = text.match(/(20\d{2}-20\d{2} (Güz|Bahar|Yaz) Dönemi)/g);
    console.log("🎓 Found semesters:", semesterMatches);

    // Find all course lines
    const coursePattern = /^\*?\s*[A-Z]{3}\s+\d{3}[A-Z]?/gm;
    const courseMatches = text.match(coursePattern);
    console.log("📚 Found course lines:", courseMatches?.length || 0);

    // Parse each course line
    const results = [];
    const lines = text.split('\n');
    
    let currentSemester = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if this is a semester header
      const semesterMatch = line.match(/(20\d{2}-20\d{2} (Güz|Bahar|Yaz) Dönemi)/);
      if (semesterMatch) {
        currentSemester = semesterMatch[0];
        console.log(`\n📅 Found semester: ${currentSemester}`);
        continue;
      }
      
      // Check if this is a course line
      if (/^\*?\s*[A-Z]{3}\s+\d{3}[A-Z]?/.test(line)) {
        console.log(`\n📖 Processing course line: "${line}"`);
        
        // Match course code like "* ATA 121" or "BLG 102E"
        const courseCodeMatch = line.match(/^\*?\s*([A-Z]{3}\s+\d{3}[A-Z]?)/);
        // Match course name after the code (no space between code and name)
        const courseNameMatch = line.match(/^\*?\s*[A-Z]{3}\s+\d{3}[A-Z]?(.*?)(?=\s*[A-Z]{2}\s*[A-Z]?\s*$|\s*$)/);
        // Match grade at the end like "CC G" or "AA"
        const gradeMatch = line.match(/\s([A-Z]{2})\s*[A-Z]?\s*$/);

        const courseCode = courseCodeMatch?.[1]?.trim() || "";
        const courseName = courseNameMatch?.[1]?.trim() || "";
        const grade = gradeMatch?.[1]?.trim() || "";

        console.log(`  📝 Course code: "${courseCode}"`);
        console.log(`  📖 Course name: "${courseName}"`);
        console.log(`  🎯 Grade: "${grade}"`);

        if (courseCode && currentSemester) {
          results.push({
            semester: currentSemester,
            code: courseCode,
            name: courseName,
            grade: grade,
          });
        }
      }
    }

    console.log("\n✅ Parsing completed!");
    console.log(`📊 Found ${results.length} courses`);
    console.log("\n📋 Results:");
    console.log(JSON.stringify(results, null, 2));

    // Save results
    fs.writeFileSync("parsed-transcript.json", JSON.stringify(results, null, 2));
    console.log("\n💾 Results saved to parsed-transcript.json");

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
};

console.log("🚀 Simple Transcript Parser...\n");
simpleParse(); 