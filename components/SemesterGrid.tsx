"use client";

import { useMemo } from "react";

interface Course {
  type: "course";
  code: string;
}

interface Elective {
  type: "elective";
  name: string;
  category: string;
  options: string[];
}

type SemesterItem = Course | Elective;

interface TranscriptItem {
  semester: string;
  code: string;
  name: string;
  credits: string;
  grade: string;
}

interface PrerequisiteCourse {
  code: string;
  min: string;
}

interface PrerequisiteGroup {
  group: number;
  courses: PrerequisiteCourse[];
}

interface CourseInfo {
  code: string;
  name: string;
  credits?: string;
  prerequisites?: PrerequisiteGroup[];
}

interface SemesterGridProps {
  selectedPlan: SemesterItem[][];
  transcript: TranscriptItem[];
  selectedSemester: string | null;
  coursesData: CourseInfo[];
  courseMappings: Record<string, string[]>;
  onCourseClick: (
    courseCode: string,
    isElective: boolean,
    matchedCourseCode?: string,
    hasWarning?: boolean
  ) => void;
}

export default function SemesterGrid({
  selectedPlan,
  transcript,
  selectedSemester,
  coursesData,
  courseMappings,
  onCourseClick,
}: SemesterGridProps) {
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

  const filteredTranscript = useMemo(
    () => getTranscriptUpToSelected(),
    [transcript, selectedSemester]
  );

  // Get all course codes from the plan
  const planCourseCodes = useMemo(() => {
    const codes = new Set<string>();
    selectedPlan.forEach((semester: SemesterItem[]) => {
      semester.forEach((item: SemesterItem) => {
        if (item.type === "course") {
          codes.add(item.code);
        } else if (item.type === "elective") {
          // Add elective options to the set
          item.options?.forEach((option: string) => codes.add(option));
        }
      });
    });
    return codes;
  }, [selectedPlan]);

  // Helper function to format course code
  const formatCourseCode = (code: string) => {
    return code.replace(/\s+/g, "");
  };

  // Helper function to get effective grade for a course based on selected semester
  const getEffectiveGrade = (courseCode: string): string => {
    const courseHistory = filteredTranscript.filter(
      (t: TranscriptItem) => t.code === courseCode
    );
    if (courseHistory.length === 0) return "";

    const latestAttempt = courseHistory[courseHistory.length - 1];
    const latestGrade = latestAttempt.grade;

    // If the latest grade has an asterisk (planned grade), return it as is for display
    // but treat it as completed for logic purposes
    if (latestGrade.endsWith("*")) {
      return latestGrade; // Return with asterisk for display
    }

    // If the latest grade is not "--", return it as is
    if (latestGrade !== "--") return latestGrade;

    // If the latest grade is "--" (planned), check if we're viewing a semester after it
    if (selectedSemester && latestAttempt.semester !== selectedSemester) {
      // Compare semesters to see if selected semester is after the planned semester
      const plannedSemester = latestAttempt.semester;

      // Extract year and semester order for comparison
      const getSemesterOrder = (semester: string) => {
        const yearMatch = semester.match(/(\d{4})/);
        if (!yearMatch) return 0;
        const year = parseInt(yearMatch[1]);

        let semesterOrder = 1; // Güz
        if (semester.includes("Bahar")) semesterOrder = 2;
        else if (semester.includes("Yaz")) semesterOrder = 3;

        return year * 10 + semesterOrder;
      };

      const plannedOrder = getSemesterOrder(plannedSemester);
      const selectedOrder = getSemesterOrder(selectedSemester);

      // If selected semester is after the planned semester, show as passed with "?"
      if (selectedOrder > plannedOrder) {
        return "?"; // Passed (assumed)
      }
    }

    return latestGrade; // Return "--" if still in the same or earlier semester
  };

  // Function to check if a prerequisite is satisfied
  const isPrerequisiteSatisfied = (
    prereqCode: string,
    minGrade: string
  ): boolean => {
    // First check for exact match (with and without spaces)
    let courseHistory = filteredTranscript.filter(
      (t: TranscriptItem) => t.code === prereqCode
    );

    // If no exact match, also check with spaces removed
    if (courseHistory.length === 0) {
      const prereqCodeNoSpaces = prereqCode.replace(/\s+/g, "");
      courseHistory = filteredTranscript.filter(
        (t: TranscriptItem) => t.code.replace(/\s+/g, "") === prereqCodeNoSpaces
      );
    }

    // If no exact match, try to find equivalent course using course mappings
    if (courseHistory.length === 0) {
      // Check if the target course has explicit mappings in course-mappings.json
      const alternatives = courseMappings[prereqCode] || [];

      // Look for any of the alternative courses in the available courses
      for (const alternativeCode of alternatives) {
        const equivalentMatch = filteredTranscript.find(
          (t: TranscriptItem) => t.code === alternativeCode
        );
        if (equivalentMatch) {
          courseHistory = filteredTranscript.filter(
            (t: TranscriptItem) => t.code === equivalentMatch.code
          );
          break;
        }
      }
    }

    if (courseHistory.length === 0) return false;

    // Get the latest attempt for this prerequisite course
    const latestAttempt = courseHistory[courseHistory.length - 1];
    const latestGrade = latestAttempt.grade;

    // If the latest grade is not "--", use it directly
    if (latestGrade !== "--") {
      // Handle asterisk grades by removing the asterisk for comparison
      let gradeForComparison = latestGrade;
      if (latestGrade.endsWith("*")) {
        gradeForComparison = latestGrade.replace("*", "");
      }

      // Grade comparison logic - based on transcript grades
      const gradeOrder = [
        "FF",
        "FD",
        "VF",
        "DD",
        "DD+",
        "DC",
        "DC+",
        "CC",
        "CC+",
        "CB",
        "CB+",
        "BB",
        "BB+",
        "BA",
        "BA+",
        "AA",
        "BL",
      ];
      const latestGradeIndex = gradeOrder.indexOf(gradeForComparison);
      const minGradeIndex = gradeOrder.indexOf(minGrade);

      return latestGradeIndex >= minGradeIndex;
    }

    // If the latest grade is "--" (planned), check if we're viewing a semester after it
    if (selectedSemester && latestAttempt.semester !== selectedSemester) {
      // For planned courses, we need to check if the selected semester comes after the planned semester
      const plannedSemester = latestAttempt.semester;

      // If the planned semester is from the plan (e.g., "Semester 1"), we need to compare differently
      if (plannedSemester.startsWith("Semester ")) {
        // Extract semester number from plan
        const planSemesterNum = parseInt(
          plannedSemester.replace("Semester ", "")
        );

        // Extract semester number from selected semester
        const selectedSemesterNum = parseInt(
          selectedSemester.replace(/[^0-9]/g, "")
        );

        // If selected semester is after the planned semester, consider it as passed
        if (selectedSemesterNum > planSemesterNum) {
          // Grade comparison logic for planned courses (assumed pass)
          const gradeOrder = [
            "FF",
            "FD",
            "VF",
            "DD",
            "DD+",
            "DC",
            "DC+",
            "CC",
            "CC+",
            "CB",
            "CB+",
            "BB",
            "BB+",
            "BA",
            "BA+",
            "AA",
            "BL",
          ];
          const minGradeIndex = gradeOrder.indexOf(minGrade);

          // Planned courses are considered as passing with "CC" grade
          const assumedGradeIndex = gradeOrder.indexOf("CC");

          return assumedGradeIndex >= minGradeIndex;
        }
      } else {
        // For regular transcript semesters, use the existing logic
        const getSemesterOrder = (semester: string) => {
          const yearMatch = semester.match(/(\d{4})/);
          if (!yearMatch) return 0;
          const year = parseInt(yearMatch[1]);

          let semesterOrder = 1; // Güz
          if (semester.includes("Bahar")) semesterOrder = 2;
          else if (semester.includes("Yaz")) semesterOrder = 3;

          return year * 10 + semesterOrder;
        };

        const plannedOrder = getSemesterOrder(plannedSemester);
        const selectedOrder = getSemesterOrder(selectedSemester);

        // If selected semester is after the planned semester, consider it as passed
        if (selectedOrder > plannedOrder) {
          // Grade comparison logic for "?" grade (assumed pass)
          const gradeOrder = [
            "FF",
            "FD",
            "VF",
            "DD",
            "DD+",
            "DC",
            "DC+",
            "CC",
            "CC+",
            "CB",
            "CB+",
            "BB",
            "BB+",
            "BA",
            "BA+",
            "AA",
            "BL",
          ];
          const minGradeIndex = gradeOrder.indexOf(minGrade);

          // "?" grade is considered as a passing grade, so it should satisfy most prerequisites
          // We'll treat it as equivalent to "CC" (minimum passing grade)
          const assumedGradeIndex = gradeOrder.indexOf("CC");

          return assumedGradeIndex >= minGradeIndex;
        }
      }
    }

    return false; // Currently taken or not yet taken
  };

  // Function to check if a prerequisite group is satisfied (at least one course in group)
  const isPrerequisiteGroupSatisfied = (group: PrerequisiteGroup): boolean => {
    return group.courses.some((prereq) =>
      isPrerequisiteSatisfied(prereq.code, prereq.min)
    );
  };

  // Function to get prerequisites for a course
  const getPrerequisites = (code: string): PrerequisiteGroup[] | undefined => {
    const course = coursesData.find((c) => c.code === code);
    return course?.prerequisites;
  };

  // Function to check if a course has unsatisfied prerequisites
  const hasUnsatisfiedPrerequisites = (courseCode: string): boolean => {
    const prerequisites = getPrerequisites(courseCode);
    if (!prerequisites || prerequisites.length === 0) return false;

    // Check if any group is not satisfied
    return prerequisites.some((group) => !isPrerequisiteGroupSatisfied(group));
  };

  // Helper function to find a course using course mappings and E suffix matching
  const findCourseByMapping = (
    targetCourseCode: string,
    planCourseCodes: Set<string>
  ) => {
    // First, check if there's an exact match
    const exactMatch = filteredTranscript.find(
      (t: TranscriptItem) => t.code === targetCourseCode
    );
    if (exactMatch) return exactMatch;

    // Check course mappings from course-mappings.json
    const mappedCourses = courseMappings[targetCourseCode] || [];
    for (const mappedCourse of mappedCourses) {
      const mappedMatch = filteredTranscript.find(
        (t: TranscriptItem) =>
          t.code === mappedCourse && !planCourseCodes.has(t.code)
      );
      if (mappedMatch) return mappedMatch;
    }

    // Check reverse mappings (if target course is in the mapped courses)
    for (const [mappedCode, alternatives] of Object.entries(courseMappings)) {
      if (alternatives.includes(targetCourseCode)) {
        const reverseMatch = filteredTranscript.find(
          (t: TranscriptItem) =>
            t.code === mappedCode && !planCourseCodes.has(t.code)
        );
        if (reverseMatch) return reverseMatch;
      }
    }

    // Check space-normalized mappings (remove spaces for comparison)
    const targetCodeNoSpaces = targetCourseCode.replace(/\s+/g, "");
    for (const [mappedCode, alternatives] of Object.entries(courseMappings)) {
      const mappedCodeNoSpaces = mappedCode.replace(/\s+/g, "");
      if (mappedCodeNoSpaces === targetCodeNoSpaces) {
        for (const alternative of alternatives) {
          const alternativeMatch = filteredTranscript.find(
            (t: TranscriptItem) =>
              t.code === alternative && !planCourseCodes.has(t.code)
          );
          if (alternativeMatch) return alternativeMatch;
        }
      }
    }

    // Check E suffix matching (e.g., BLG210E matches BLG210 and vice versa)
    const hasE = targetCourseCode.endsWith("E");
    const baseCode = hasE ? targetCourseCode.slice(0, -1) : targetCourseCode;
    const eCode = hasE ? targetCourseCode : targetCourseCode + "E";

    // Try matching with E suffix
    const eMatch = filteredTranscript.find(
      (t: TranscriptItem) => t.code === eCode && !planCourseCodes.has(t.code)
    );
    if (eMatch) return eMatch;

    // Try matching without E suffix
    const baseMatch = filteredTranscript.find(
      (t: TranscriptItem) => t.code === baseCode && !planCourseCodes.has(t.code)
    );
    if (baseMatch) return baseMatch;

    // If no mapping found, return null
    return null;
  };

  // Helper function to get assigned course for elective
  const getAssignedCourseForElective = (electiveName: string) => {
    // Find the elective in the plan to get its options
    let electiveOptions: string[] = [];
    for (const semester of selectedPlan) {
      for (const item of semester) {
        if (item.type === "elective" && item.name === electiveName) {
          electiveOptions = item.options || [];
          break;
        }
      }
      if (electiveOptions.length > 0) break;
    }

    // Get all taken courses that match this elective's options
    const takenCoursesForThisElective = filteredTranscript.filter(
      (item: TranscriptItem) => electiveOptions.includes(item.code)
    );

    if (takenCoursesForThisElective.length === 0) {
      return null; // No courses taken for this elective
    }

    // Create a global assignment map to ensure each course is only assigned once
    const globalAssignmentMap = new Map<string, string>(); // courseCode -> electiveName

    // First pass: assign courses to electives that have only one option
    for (const semester of selectedPlan) {
      for (const item of semester) {
        if (item.type === "elective") {
          const otherElectiveOptions = item.options || [];
          const takenForOtherElective = filteredTranscript.filter(
            (t: TranscriptItem) => otherElectiveOptions.includes(t.code)
          );

          // If this elective has exactly one taken course, assign it
          if (takenForOtherElective.length === 1) {
            const courseCode = takenForOtherElective[0].code;
            if (!globalAssignmentMap.has(courseCode)) {
              globalAssignmentMap.set(courseCode, item.name);
            }
          }
        }
      }
    }

    // Second pass: for electives with multiple options, assign the first available course
    for (const semester of selectedPlan) {
      for (const item of semester) {
        if (item.type === "elective") {
          const otherElectiveOptions = item.options || [];
          const takenForOtherElective = filteredTranscript.filter(
            (t: TranscriptItem) => otherElectiveOptions.includes(t.code)
          );

          // If this elective has multiple taken courses, find one that's not assigned
          if (takenForOtherElective.length > 1) {
            const availableCourse = takenForOtherElective.find(
              (course: TranscriptItem) => !globalAssignmentMap.has(course.code)
            );
            if (availableCourse) {
              globalAssignmentMap.set(availableCourse.code, item.name);
            }
          }
        }
      }
    }

    // Check if any course is assigned to this specific elective
    for (const [courseCode, assignedElectiveName] of globalAssignmentMap) {
      if (assignedElectiveName === electiveName) {
        return (
          filteredTranscript.find(
            (t: TranscriptItem) => t.code === courseCode
          ) || null
        );
      }
    }

    return null; // No course assigned to this elective
  };

  const getItemColor = (item: SemesterItem) => {
    if (item.type === "elective") {
      // For electives, check if there's an assigned course and use its grade for coloring
      const assignedCourse = getAssignedCourseForElective(item.name);
      if (assignedCourse) {
        const courseHistory = filteredTranscript.filter(
          (t: TranscriptItem) => t.code === assignedCourse.code
        );
        if (courseHistory.length > 0) {
          const effectiveGrade = getEffectiveGrade(assignedCourse.code);
          if (effectiveGrade === "--") {
            return "bg-blue-500"; // Currently taken
          } else if (effectiveGrade === "?") {
            return "bg-green-600"; // Passed (assumed)
          } else if (effectiveGrade.endsWith("*")) {
            // Check if this star grade is from the current semester
            const latestAttempt = courseHistory[courseHistory.length - 1];
            if (latestAttempt.semester === selectedSemester) {
              return "bg-blue-500"; // Currently taken (star grade in current semester)
            } else {
              return "bg-green-600"; // Passed (star grade from past semester)
            }
          } else {
            // Handle regular grades
            if (
              [
                "AA",
                "BA",
                "BA+",
                "BB",
                "BB+",
                "CB",
                "CB+",
                "CC",
                "CC+",
                "DC",
                "DC+",
                "DD",
                "DD+",
                "BL",
              ].includes(effectiveGrade)
            ) {
              return "bg-green-600"; // Passed (including conditional pass)
            } else if (["FD", "FF", "VF"].includes(effectiveGrade)) {
              return "bg-red-400"; // Failed (more subtle)
            }
          }
        }
      }
      return "bg-purple-500"; // Default for electives with no assigned course
    }

    // For courses, check if they have been taken and their grade
    const courseHistory = filteredTranscript.filter(
      (t: TranscriptItem) => t.code === item.code
    );
    if (courseHistory.length > 0) {
      const effectiveGrade = getEffectiveGrade(item.code);
      if (effectiveGrade === "--") {
        return "bg-blue-500"; // Currently taken
      } else if (effectiveGrade === "?") {
        return "bg-green-600"; // Passed (assumed)
      } else if (effectiveGrade.endsWith("*")) {
        // Check if this star grade is from the current semester
        const latestAttempt = courseHistory[courseHistory.length - 1];
        if (latestAttempt.semester === selectedSemester) {
          return "bg-blue-500"; // Currently taken (star grade in current semester)
        } else {
          return "bg-green-600"; // Passed (star grade from past semester)
        }
      } else {
        // Handle regular grades
        if (
          [
            "AA",
            "BA",
            "BA+",
            "BB",
            "BB+",
            "CB",
            "CB+",
            "CC",
            "CC+",
            "DC",
            "DC+",
            "DD",
            "DD+",
            "BL",
          ].includes(effectiveGrade)
        ) {
          return "bg-green-600"; // Passed (including conditional pass)
        } else if (["FD", "FF", "VF"].includes(effectiveGrade)) {
          return "bg-red-400"; // Failed (more subtle)
        }
      }
    }

    return "bg-purple-500"; // Default for not taken
  };

  return (
    <div className="w-full max-w-7xl mx-auto ">
      <div className="flex overflow-x-auto xl:overflow-x-visible gap-4 xl:gap-6 pb-4 xl:pb-0">
        <div className="flex xl:grid xl:grid-cols-8 gap-4 xl:gap-6 min-w-max xl:min-w-0 xl:w-full">
          {Array.isArray(selectedPlan) &&
            selectedPlan.map(
              (semester: SemesterItem[], semesterIndex: number) => (
                <div
                  key={semesterIndex}
                  className="space-y-3 w-32 xl:w-auto flex-shrink-0"
                >
                  <h2 className="text-lg font-semibold text-center text-gray-700 bg-gray-100 py-2 rounded-lg shadow-sm">
                    Semester {semesterIndex + 1}
                  </h2>

                  <div className="space-y-2">
                    {Array.isArray(semester) &&
                      semester.map((item: SemesterItem, itemIndex: number) => (
                        <div key={itemIndex}>
                          {item.type === "course"
                            ? (() => {
                                // First check if the exact course code exists in filtered transcript
                                const exactMatch = filteredTranscript.find(
                                  (t: TranscriptItem) => t.code === item.code
                                );

                                // If no exact match, try to find by course mappings and E suffix
                                const mappedMatch = !exactMatch
                                  ? findCourseByMapping(
                                      item.code,
                                      planCourseCodes
                                    )
                                  : null;

                                // Determine which course to display
                                const displayCourse = exactMatch || mappedMatch;
                                const isMappedMatch =
                                  !exactMatch && mappedMatch;

                                return (
                                  <div
                                    className={`${
                                      displayCourse
                                        ? getItemColor({
                                            type: "course",
                                            code: displayCourse.code,
                                          })
                                        : getItemColor(item)
                                    } text-white p-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer transform hover:scale-105 relative`}
                                    onClick={() =>
                                      onCourseClick(
                                        item.code,
                                        false,
                                        displayCourse?.code,
                                        Boolean(isMappedMatch)
                                      )
                                    }
                                  >
                                    <div className="text-sm font-medium text-center">
                                      {formatCourseCode(item.code)}
                                    </div>
                                    {isMappedMatch && (
                                      <div className="absolute -top-1 -left-1 bg-orange-500 text-white text-xs font-bold px-1 rounded-full min-w-[20px] text-center">
                                        ⚠️
                                      </div>
                                    )}
                                    {(() => {
                                      if (displayCourse) {
                                        const effectiveGrade =
                                          getEffectiveGrade(displayCourse.code);
                                        if (effectiveGrade) {
                                          return (
                                            <div className="absolute -top-1 -right-1 bg-white text-gray-800 text-xs font-bold px-1 rounded-full min-w-[20px] text-center">
                                              {effectiveGrade}
                                            </div>
                                          );
                                        }
                                      }

                                      if (
                                        hasUnsatisfiedPrerequisites(item.code)
                                      ) {
                                        return (
                                          <div className="absolute -top-1 -right-1 bg-yellow-500 text-white text-xs font-bold px-1 rounded-full min-w-[20px] text-center">
                                            🔒
                                          </div>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </div>
                                );
                              })()
                            : (() => {
                                const assignedCourse =
                                  getAssignedCourseForElective(item.name);
                                if (assignedCourse) {
                                  // Show the assigned course with elective category
                                  const courseHistory =
                                    filteredTranscript.filter(
                                      (t: TranscriptItem) =>
                                        t.code === assignedCourse.code
                                    );
                                  const latestGrade =
                                    courseHistory.length > 0
                                      ? courseHistory[courseHistory.length - 1]
                                          .grade
                                      : "";

                                  return (
                                    <div
                                      className={`${getItemColor({
                                        type: "course",
                                        code: assignedCourse.code,
                                      })} text-white p-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer transform hover:scale-105 relative`}
                                      onClick={() =>
                                        onCourseClick(
                                          assignedCourse.code,
                                          false,
                                          undefined,
                                          false
                                        )
                                      }
                                    >
                                      <div className="text-xs font-medium text-center">
                                        {formatCourseCode(assignedCourse.code)}
                                      </div>
                                      <div className="text-xs text-center mt-1 opacity-75">
                                        ({item.category})
                                      </div>
                                      {(() => {
                                        const effectiveGrade =
                                          getEffectiveGrade(
                                            assignedCourse.code
                                          );
                                        if (effectiveGrade) {
                                          return (
                                            <div className="absolute -top-1 -right-1 bg-white text-gray-800 text-xs font-bold px-1 rounded-full min-w-[20px] text-center">
                                              {effectiveGrade}
                                            </div>
                                          );
                                        } else if (
                                          hasUnsatisfiedPrerequisites(
                                            assignedCourse.code
                                          )
                                        ) {
                                          return (
                                            <div className="absolute -top-1 -right-1 bg-yellow-500 text-white text-xs font-bold px-1 rounded-full min-w-[20px] text-center">
                                              🔒
                                            </div>
                                          );
                                        }
                                        return null;
                                      })()}
                                    </div>
                                  );
                                } else {
                                  // Show elective name if no course is assigned
                                  return (
                                    <div
                                      className={`${getItemColor(
                                        item
                                      )} text-white p-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer transform hover:scale-105`}
                                      onClick={() =>
                                        onCourseClick(
                                          item.name,
                                          true,
                                          undefined,
                                          false
                                        )
                                      }
                                    >
                                      <div className="text-xs font-medium text-center">
                                        {item.name}
                                      </div>
                                      <div className="text-xs text-center mt-1 opacity-75">
                                        ({item.category})
                                      </div>
                                    </div>
                                  );
                                }
                              })()}
                        </div>
                      ))}
                  </div>
                </div>
              )
            )}
        </div>
      </div>
    </div>
  );
}
