const fs = require("fs");
const pdf = require("pdf-parse");

const semesterRegex = /(20\d{2}-20\d{2} (Güz|Bahar|Yaz) Dönemi)/g;

const parseTranscript = async () => {
  try {
    // Check if test file exists
    if (!fs.existsSync("test/data/transkript.pdf")) {
      console.log("❌ transkript.pdf not found. Please place your transcript PDF in test/data/ directory.");
      console.log("📝 You can test the parser by uploading a PDF through the web interface at http://localhost:3000/transcript");
      return;
    }

    const dataBuffer = fs.readFileSync("test/data/transkript.pdf");
    const data = await pdf(dataBuffer);
    const text = data.text;

    const semesters = text.split(semesterRegex).filter(x => x.trim() !== "");
    const results = [];

    for (let i = 0; i < semesters.length; i++) {
      if (semesterRegex.test(semesters[i])) {
        const semesterName = semesters[i];
        const courseBlock = semesters[i + 1];

        const courseLines = courseBlock
          .split("\n")
          .map(line => line.trim())
          .filter(line =>
            /^\*?\s*[A-Z]{3}\s+\d{3}[A-Z]?/.test(line)
          );

        courseLines.forEach(line => {
          // Match course code like "* ATA 121" or "BLG 102E" - note there's no space after the code
          const courseCodeMatch = line.match(/^\*?\s*([A-Z]{3}\s+\d{3}[A-Z]?)/);
          // Match course name after the code (no space between code and name)
          const courseNameMatch = line.match(/^\*?\s*[A-Z]{3}\s+\d{3}[A-Z]?(.*?)(?=\s*[A-Z]{2}\s*[A-Z]?\s*$|\s*$)/);
          // Match grade at the end like "CC G" or "AA"
          const gradeMatch = line.match(/\s([A-Z]{2})\s*[A-Z]?\s*$/);

          const courseCode = courseCodeMatch?.[1]?.trim() || "";
          const courseName = courseNameMatch?.[1]?.trim() || "";
          const grade = gradeMatch?.[1]?.trim() || "";

          if (courseCode) {
            results.push({
              semester: semesterName,
              code: courseCode,
              name: courseName,
              grade: grade,
            });
          }
        });
      }
    }

    console.log("✅ Transcript parsed successfully!");
    console.log(`📊 Found ${results.length} courses across ${new Set(results.map(course => course.semester)).size} semesters`);
    console.log("\n📋 Parsed Results:");
    console.log(JSON.stringify(results, null, 2));

    // Save results to file
    fs.writeFileSync("parsed-transcript.json", JSON.stringify(results, null, 2));
    console.log("\n💾 Results saved to parsed-transcript.json");

  } catch (error) {
    console.error("❌ Error parsing transcript:", error.message);
  }
};

console.log("🚀 Testing Transcript Parser...\n");
parseTranscript(); 