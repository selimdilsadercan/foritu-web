"use client";

import { useMemo } from "react";

interface TranscriptItem {
  semester: string;
  code: string;
  name: string;
  credits: string;
  grade: string;
}

interface ProgressStatsProps {
  transcript: TranscriptItem[];
  selectedSemester: string | null;
  selectedPlan: any[];
  coursesData: any[];
}

export default function ProgressStats({
  transcript,
  selectedSemester,
  selectedPlan,
  coursesData,
}: ProgressStatsProps) {
  // Get transcript data up to the selected semester
  const getTranscriptUpToSelected = () => {
    if (!selectedSemester) return [];

    // Get all unique semesters from transcript and sort them
    const semesters = [...new Set(transcript.map((item) => item.semester))];
    const sortedSemesters = semesters.sort((a, b) => {
      const getYear = (semester: string) => {
        const yearMatch = semester.match(/(\d{4})/);
        return yearMatch ? parseInt(yearMatch[1]) : 0;
      };

      const getSemesterOrder = (semester: string) => {
        if (semester.includes("Fall")) return 1;
        if (semester.includes("Spring")) return 2;
        if (semester.includes("Summer")) return 3;
        return 0;
      };

      const yearA = getYear(a);
      const yearB = getYear(b);

      if (yearA !== yearB) return yearA - yearB;

      return getSemesterOrder(a) - getSemesterOrder(b);
    });

    // Find the index of the selected semester
    const selectedIndex = sortedSemesters.indexOf(selectedSemester);
    if (selectedIndex === -1) return [];

    // Get semesters up to and including the selected semester
    const semestersUpToSelected = sortedSemesters.slice(0, selectedIndex + 1);

    // Return all transcript items from semesters up to the selected semester
    return transcript.filter((item) =>
      semestersUpToSelected.includes(item.semester)
    );
  };

  // Calculate progress metrics
  const calculateProgressMetrics = () => {
    const filteredTranscript = getTranscriptUpToSelected();
    
    // Group courses by code and get only the last attempt for each course
    const courseGroups = new Map<string, TranscriptItem[]>();

    filteredTranscript.forEach((course: TranscriptItem) => {
      if (!courseGroups.has(course.code)) {
        courseGroups.set(course.code, []);
      }
      courseGroups.get(course.code)!.push(course);
    });

    // Get the last attempt for each course (most recent semester)
    const lastAttempts: TranscriptItem[] = [];
    courseGroups.forEach((attempts, courseCode) => {
      // Sort attempts by semester to get the most recent
      const sortedAttempts = attempts.sort((a, b) => {
        const getYear = (semester: string) => {
          const yearMatch = semester.match(/(\d{4})/);
          return yearMatch ? parseInt(yearMatch[1]) : 0;
        };

        const getSemesterOrder = (semester: string) => {
          if (semester.includes("Güz")) return 1;
          if (semester.includes("Bahar")) return 2;
          if (semester.includes("Yaz")) return 3;
          return 0;
        };

        const yearA = getYear(a.semester);
        const yearB = getYear(b.semester);

        if (yearA !== yearB) return yearB - yearA; // Most recent first
        return getSemesterOrder(b.semester) - getSemesterOrder(a.semester);
      });

      // Take the first (most recent) attempt
      const lastAttempt = sortedAttempts[0];
      if (lastAttempt.grade) {
        lastAttempts.push(lastAttempt);
      }
    });

    const completedCourses = lastAttempts;

    // Define passing grades
    const passingGrades = [
      "AA",
      "BA+",
      "BA",
      "BB+",
      "BB",
      "CB+",
      "CB",
      "CC+",
      "CC",
      "DC+",
      "DC",
      "DD+",
      "DD",
      "BL",
    ];

    // Helper functions for semester comparison
    const getYear = (semester: string) => {
      const yearMatch = semester.match(/(\d{4})/);
      return yearMatch ? parseInt(yearMatch[1]) : 0;
    };

    const getSemesterOrder = (semester: string) => {
      if (semester.includes("Güz")) return 1;
      if (semester.includes("Bahar")) return 2;
      if (semester.includes("Yaz")) return 3;
      return 0;
    };

    // Filter for passed courses only, including those with "?" effective grade and asterisk grades
    const passedCourses = completedCourses.filter((course) => {
      let grade = course.grade;

      // Handle asterisk grades by removing the asterisk for comparison
      if (grade.endsWith("*")) {
        grade = grade.replace("*", "");
      }

      // Check if the grade is directly passing
      if (passingGrades.includes(grade)) {
        return true;
      }

      // Check if the grade is "--" but should be considered as "?" (passed) based on selected semester
      if (
        course.grade === "--" &&
        selectedSemester &&
        course.semester !== selectedSemester
      ) {
        const plannedOrder =
          getYear(course.semester) * 10 + getSemesterOrder(course.semester);
        const selectedOrder =
          getYear(selectedSemester) * 10 + getSemesterOrder(selectedSemester);

        // If selected semester is after the planned semester, consider it as passed
        if (selectedOrder > plannedOrder) {
          return true;
        }
        return false;
      }

      return false;
    });

    // If we're viewing a planned semester, include planned courses from previous semesters
    let totalCredits = passedCourses.reduce((sum, course) => {
      return sum + parseFloat(course.credits || "0");
    }, 0);

    // Calculate GPA
    const gradePoints = {
      AA: 4.0,
      "BA+": 3.75,
      BA: 3.5,
      "BB+": 3.25,
      BB: 3.0,
      "CB+": 2.75,
      CB: 2.5,
      "CC+": 2.25,
      CC: 2.0,
      "DC+": 1.75,
      DC: 1.5,
      "DD+": 1.25,
      DD: 1.0,
      FD: 0.5,
      FF: 0.0,
      VF: 0.0,
      BL: 0.0,
    };

    let totalGradePoints = 0;
    let totalGradedCredits = 0;

    completedCourses.forEach((course: TranscriptItem) => {
      let grade = course.grade;
      const credits = parseFloat(course.credits || "0");

      // Handle asterisk grades (planned grades) by removing the asterisk
      if (grade.endsWith("*")) {
        grade = grade.replace("*", "");
      }

      if (gradePoints[grade as keyof typeof gradePoints] !== undefined) {
        totalGradePoints +=
          gradePoints[grade as keyof typeof gradePoints] * credits;
        totalGradedCredits += credits;
      }
    });

    const gpa =
      totalGradedCredits > 0 ? totalGradePoints / totalGradedCredits : 0;

    // Determine class standing based on credits
    let classStanding = "";
    if (totalCredits < 30) {
      classStanding = "1.sınıf";
    } else if (totalCredits < 60) {
      classStanding = "2.sınıf";
    } else if (totalCredits < 95) {
      classStanding = "3.sınıf";
    } else {
      classStanding = "4.sınıf";
    }

    return {
      totalCredits: Math.round(totalCredits * 10) / 10, // Round to 1 decimal place
      gpa: Math.round(gpa * 100) / 100, // Round to 2 decimal places
      classStanding,
      completedCourses: passedCourses.length,
    };
  };

  const progressMetrics = useMemo(
    () => calculateProgressMetrics(),
    [transcript, selectedSemester, selectedPlan, coursesData]
  );

  return (
    <div className="w-full max-w-7xl mx-auto p-4 lg:p-6">
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Credits:</span>
              <span className="text-lg font-bold text-blue-600">
                {progressMetrics.totalCredits}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Class:</span>
              <span className="text-lg font-bold text-green-600">
                {progressMetrics.classStanding}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">GPA:</span>
              <span className="text-lg font-bold text-purple-600">{progressMetrics.gpa}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Courses:</span>
              <span className="text-lg font-bold text-orange-600">
                {progressMetrics.completedCourses}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-500">{progressMetrics.totalCredits}/120</span>
            <div className="w-24 bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min((progressMetrics.totalCredits / 120) * 100, 100)}%`,
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
