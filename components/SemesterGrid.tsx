'use client';

import { useState, useEffect } from 'react';
import CoursePopup from './CoursePopup';

interface Course {
  type: 'course';
  code: string;
}

interface Elective {
  type: 'elective';
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
  plan: SemesterItem[][];
  transcript?: TranscriptItem[];
}

export default function SemesterGrid({ plan, transcript = [] }: SemesterGridProps) {
  const [popupOpen, setPopupOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [isSelectedElective, setIsSelectedElective] = useState(false);
  const [hasWarningIcon, setHasWarningIcon] = useState(false);
  const [coursesData, setCoursesData] = useState<CourseInfo[]>([]);

  // Load courses data from JSON file
  useEffect(() => {
    const loadCoursesData = async () => {
      try {
        const response = await fetch('/courses.json');
        const data = await response.json();
        setCoursesData(data);
      } catch (error) {
        console.error('Error loading courses data:', error);
      }
    };

    loadCoursesData();
  }, []);

  // Function to normalize course codes (remove spaces for comparison)
  const normalizeCourseCode = (code: string): string => {
    return code.replace(/\s+/g, '');
  };

  // Function to check if a prerequisite is satisfied
  const isPrerequisiteSatisfied = (prereqCode: string, minGrade: string): boolean => {
    const normalizedPrereqCode = normalizeCourseCode(prereqCode);
    const courseHistory = transcript.filter(t => normalizeCourseCode(t.code) === normalizedPrereqCode);
    if (courseHistory.length === 0) return false;
    
    const latestGrade = courseHistory[courseHistory.length - 1].grade;
    if (latestGrade === '--') return false; // Currently taken
    
    // Grade comparison logic - based on transcript grades
    const gradeOrder = ['FF', 'FD', 'VF', 'DD', 'DD+', 'DC', 'DC+', 'CC', 'CC+', 'CB', 'CB+', 'BB', 'BB+', 'BA', 'BA+', 'AA', 'BL'];
    const latestGradeIndex = gradeOrder.indexOf(latestGrade);
    const minGradeIndex = gradeOrder.indexOf(minGrade);
    
    return latestGradeIndex >= minGradeIndex;
  };

  // Function to check if a prerequisite group is satisfied (at least one course in group)
  const isPrerequisiteGroupSatisfied = (group: PrerequisiteGroup): boolean => {
    return group.courses.some(prereq => isPrerequisiteSatisfied(prereq.code, prereq.min));
  };

  // Function to get prerequisites for a course
  const getPrerequisites = (code: string): PrerequisiteGroup[] | undefined => {
    const course = coursesData.find(c => c.code === code);
    return course?.prerequisites;
  };

  // Function to get course name from courses.json
  const getCourseNameFromData = (code: string): string | undefined => {
    const course = coursesData.find(c => c.code === code);
    return course?.name;
  };

  // Function to check if a course has unsatisfied prerequisites
  const hasUnsatisfiedPrerequisites = (courseCode: string): boolean => {
    const prerequisites = getPrerequisites(courseCode);
    if (!prerequisites || prerequisites.length === 0) return false;
    
    // Check if any group is not satisfied
    return prerequisites.some(group => !isPrerequisiteGroupSatisfied(group));
  };

    const getItemColor = (item: SemesterItem) => {
    if (item.type === 'elective') {
      // For electives, check if there's an assigned course and use its grade for coloring
      const assignedCourse = getAssignedCourseForElective(item.name);
      if (assignedCourse) {
        const courseHistory = transcript.filter(t => t.code === assignedCourse.code);
        if (courseHistory.length > 0) {
          const latestGrade = courseHistory[courseHistory.length - 1].grade;
          if (latestGrade === '--') {
            return 'bg-blue-500'; // Currently taken
          } else if (['AA', 'BA', 'BA+', 'BB', 'BB+', 'CB', 'CB+', 'CC', 'CC+', 'DC', 'DC+', 'DD', 'DD+', 'BL'].includes(latestGrade)) {
            return 'bg-green-600'; // Passed (including conditional pass)
          } else if (['FD', 'FF', 'VF'].includes(latestGrade)) {
            return 'bg-red-400'; // Failed (more subtle)
          }
        }
      }
      return 'bg-purple-500'; // Default for electives with no assigned course
    }
    
    // For courses, check if they have been taken and their grade
    const courseHistory = transcript.filter(t => t.code === item.code);
    if (courseHistory.length > 0) {
      const latestGrade = courseHistory[courseHistory.length - 1].grade;
      if (latestGrade === '--') {
        return 'bg-blue-500'; // Currently taken
      } else if (['AA', 'BA', 'BA+', 'BB', 'BB+', 'CB', 'CB+', 'CC', 'CC+', 'DC', 'DC+', 'DD', 'DD+', 'BL'].includes(latestGrade)) {
        return 'bg-green-600'; // Passed (including conditional pass)
      } else if (['FD', 'FF', 'VF'].includes(latestGrade)) {
        return 'bg-red-400'; // Failed (more subtle)
      }
    }
    
    return 'bg-purple-500'; // Default for not taken
  };

  const formatCourseCode = (code: string) => {
    return code.replace(/\s+/g, '');
  };



  const handleCourseClick = (courseCode: string, isElective: boolean = false, matchedCourseCode?: string, hasWarning: boolean = false) => {
    setSelectedCourse(courseCode);
    setIsSelectedElective(isElective);
    setHasWarningIcon(hasWarning);
    setPopupOpen(true);
    // Store the matched course code for the popup to use
    if (matchedCourseCode) {
      // We'll pass this information to the popup through the courseName parameter
      const matchedCourse = transcript.find(t => t.code === matchedCourseCode);
      if (matchedCourse) {
        // This will be used in the popup to show the matched course info
        setSelectedCourse(`${courseCode}|${matchedCourseCode}`);
      }
    }
  };

  // Helper function to get the actual course name from transcript
  const getCourseNameFromTranscript = (courseCode: string) => {
    const courseHistory = transcript.filter(t => t.code === courseCode);
    if (courseHistory.length > 0) {
      return courseHistory[courseHistory.length - 1].name;
    }
    return undefined;
  };

  // Helper function to find a course by number part (e.g., "210" in "BLG210")
  const findCourseByNumber = (targetCourseCode: string, planCourseCodes: Set<string>) => {
    const targetNumber = targetCourseCode.replace(/[A-Z]/g, ''); // Extract number part
    return transcript.find(t => {
      const courseNumber = t.code.replace(/[A-Z]/g, ''); // Extract number from transcript course
      // Only match if the transcript course is NOT already in the plan
      return courseNumber === targetNumber && !planCourseCodes.has(t.code);
    });
  };

  // Helper function to get assigned course for elective
  const getAssignedCourseForElective = (electiveName: string) => {
    // Find the elective in the plan to get its options
    let electiveOptions: string[] = [];
    for (const semester of plan) {
      for (const item of semester) {
        if (item.type === 'elective' && item.name === electiveName) {
          electiveOptions = item.options || [];
          break;
        }
      }
      if (electiveOptions.length > 0) break;
    }

    // Get all taken courses that match this elective's options
    const takenCoursesForThisElective = transcript.filter(item => 
      electiveOptions.includes(item.code)
    );

    if (takenCoursesForThisElective.length === 0) {
      return null; // No courses taken for this elective
    }

    // Create a global assignment map to ensure each course is only assigned once
    const globalAssignmentMap = new Map<string, string>(); // courseCode -> electiveName
    
    // First pass: assign courses to electives that have only one option
    for (const semester of plan) {
      for (const item of semester) {
        if (item.type === 'elective') {
          const otherElectiveOptions = item.options || [];
          const takenForOtherElective = transcript.filter(t => otherElectiveOptions.includes(t.code));
          
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
    for (const semester of plan) {
      for (const item of semester) {
        if (item.type === 'elective') {
          const otherElectiveOptions = item.options || [];
          const takenForOtherElective = transcript.filter(t => otherElectiveOptions.includes(t.code));
          
          // If this elective has multiple taken courses, find one that's not assigned
          if (takenForOtherElective.length > 1) {
            const availableCourse = takenForOtherElective.find(course => 
              !globalAssignmentMap.has(course.code)
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
        return transcript.find(t => t.code === courseCode) || null;
      }
    }
    
    return null; // No course assigned to this elective
  };

  // Get all course codes from the plan
  const planCourseCodes = new Set<string>();
  plan.forEach(semester => {
    semester.forEach(item => {
      if (item.type === 'course') {
        planCourseCodes.add(item.code);
      } else if (item.type === 'elective') {
        // Add elective options to the set
        item.options?.forEach(option => planCourseCodes.add(option));
      }
    });
  });

  // Calculate progress metrics
  const calculateProgressMetrics = () => {
    // Group courses by code and get only the last attempt for each course
    const courseGroups = new Map<string, TranscriptItem[]>();
    
    transcript.forEach(course => {
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
          if (semester.includes('Güz')) return 1;
          if (semester.includes('Bahar')) return 2;
          if (semester.includes('Yaz')) return 3;
          return 0;
        };
        
        const yearA = getYear(a.semester);
        const yearB = getYear(b.semester);
        
        if (yearA !== yearB) return yearB - yearA; // Most recent first
        return getSemesterOrder(b.semester) - getSemesterOrder(a.semester);
      });
      
      // Take the first (most recent) attempt
      const lastAttempt = sortedAttempts[0];
      if (lastAttempt.grade && lastAttempt.grade !== '--' && lastAttempt.grade !== 'VF') {
        lastAttempts.push(lastAttempt);
      }
    });

    const completedCourses = lastAttempts;

    // Calculate total credits
    const totalCredits = completedCourses.reduce((sum, course) => {
      return sum + parseFloat(course.credits || '0');
    }, 0);

    // Calculate GPA
    const gradePoints = {
      'AA': 4.0, 'BA': 3.5, 'BB': 3.0, 'CB': 2.5, 'CC': 2.0, 
      'DC': 1.5, 'DD': 1.0, 'FD': 0.5, 'FF': 0.0, 'BL': 0.0
    };

    let totalGradePoints = 0;
    let totalGradedCredits = 0;

    completedCourses.forEach(course => {
      const grade = course.grade;
      const credits = parseFloat(course.credits || '0');
      
      if (gradePoints[grade as keyof typeof gradePoints] !== undefined) {
        totalGradePoints += gradePoints[grade as keyof typeof gradePoints] * credits;
        totalGradedCredits += credits;
      }
    });

    const gpa = totalGradedCredits > 0 ? totalGradePoints / totalGradedCredits : 0;

    // Determine class standing based on credits
    let classStanding = '';
    if (totalCredits < 30) {
      classStanding = '1.sınıf';
    } else if (totalCredits < 60) {
      classStanding = '2.sınıf';
    } else if (totalCredits < 95) {
      classStanding = '3.sınıf';
    } else {
      classStanding = '4.sınıf';
    }

    return {
      totalCredits: Math.round(totalCredits * 10) / 10, // Round to 1 decimal place
      gpa: Math.round(gpa * 100) / 100, // Round to 2 decimal places
      classStanding,
      completedCourses: completedCourses.length
    };
  };

  const progressMetrics = calculateProgressMetrics();

  return (
    <div className="w-full max-w-7xl mx-auto p-6">
            {/* Compact Progress Summary */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Credits:</span>
              <span className="text-lg font-bold text-blue-600">{progressMetrics.totalCredits}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Class:</span>
              <span className="text-lg font-bold text-green-600">{progressMetrics.classStanding}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">GPA:</span>
              <span className="text-lg font-bold text-purple-600">{progressMetrics.gpa}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Courses:</span>
              <span className="text-lg font-bold text-orange-600">{progressMetrics.completedCourses}</span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-500">{progressMetrics.totalCredits}/120</span>
            <div className="w-24 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min((progressMetrics.totalCredits / 120) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-6 mt-10">
        {plan.map((semester, semesterIndex) => (
          <div key={semesterIndex} className="space-y-3">
            <h2 className="text-lg font-semibold text-center text-gray-700 bg-gray-100 py-2 rounded-lg shadow-sm">
              Semester {semesterIndex + 1}
            </h2>
            
            <div className="space-y-2">
              {semester.map((item, itemIndex) => (
                <div key={itemIndex}>
                  {item.type === 'course' ? (
                    (() => {
                      // First check if the exact course code exists in transcript
                      const exactMatch = transcript.find(t => t.code === item.code);
                      
                      // If no exact match, try to find by number part
                      const numberMatch = !exactMatch ? findCourseByNumber(item.code, planCourseCodes) : null;
                      
                      // Determine which course to display
                      const displayCourse = exactMatch || numberMatch;
                      const isNumberMatch = !exactMatch && numberMatch;
                      
                                             return (
                                                  <div 
                           className={`${displayCourse ? getItemColor({ type: 'course', code: displayCourse.code }) : getItemColor(item)} text-white p-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer transform hover:scale-105 relative`}
                           onClick={() => handleCourseClick(item.code, false, displayCourse?.code, Boolean(isNumberMatch))}
                         >
                           <div className="text-sm font-medium text-center">
                             {formatCourseCode(item.code)}
                           </div>
                          {isNumberMatch && (
                            <div className="absolute -top-1 -left-1 bg-orange-500 text-white text-xs font-bold px-1 rounded-full min-w-[20px] text-center">
                              ⚠️
                            </div>
                          )}
                          {(() => {
                            if (displayCourse) {
                              const courseHistory = transcript.filter(t => t.code === displayCourse.code);
                              if (courseHistory.length > 0) {
                                const latestGrade = courseHistory[courseHistory.length - 1].grade;
                                return (
                                  <div className="absolute -top-1 -right-1 bg-white text-gray-800 text-xs font-bold px-1 rounded-full min-w-[20px] text-center">
                                    {latestGrade}
                                  </div>
                                );
                              }
                            }
                            
                            if (hasUnsatisfiedPrerequisites(item.code)) {
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
                                     ) : (
                     (() => {
                       const assignedCourse = getAssignedCourseForElective(item.name);
                       if (assignedCourse) {
                         // Show the assigned course with elective category
                         const courseHistory = transcript.filter(t => t.code === assignedCourse.code);
                         const latestGrade = courseHistory.length > 0 ? courseHistory[courseHistory.length - 1].grade : '';
                         
                         return (
                           <div 
                             className={`${getItemColor({ type: 'course', code: assignedCourse.code })} text-white p-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer transform hover:scale-105 relative`}
                             onClick={() => handleCourseClick(assignedCourse.code, false, undefined, false)}
                           >
                             <div className="text-xs font-medium text-center">
                               {formatCourseCode(assignedCourse.code)}
                             </div>
                             <div className="text-xs text-center mt-1 opacity-75">
                               ({item.category})
                             </div>
                             {latestGrade ? (
                               <div className="absolute -top-1 -right-1 bg-white text-gray-800 text-xs font-bold px-1 rounded-full min-w-[20px] text-center">
                                 {latestGrade}
                               </div>
                             ) : hasUnsatisfiedPrerequisites(assignedCourse.code) ? (
                               <div className="absolute -top-1 -right-1 bg-yellow-500 text-white text-xs font-bold px-1 rounded-full min-w-[20px] text-center">
                                 🔒
                               </div>
                             ) : null}
                           </div>
                         );
                                               } else {
                          // Show elective name if no course is assigned
                          return (
                            <div 
                              className={`${getItemColor(item)} text-white p-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer transform hover:scale-105`}
                              onClick={() => handleCourseClick(item.name, true, undefined, false)}
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
                     })()
                   )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Extra Courses Section - Courses in transcript but not in plan */}
      {(() => {
        // Find courses in transcript that are not in the plan
        const extraCourses = transcript.filter(t => {
          // Check if course is directly in plan
          if (planCourseCodes.has(t.code)) return false;
          
          // Check if course number matches any course in plan
          const courseNumber = t.code.replace(/[A-Z]/g, '');
          const hasNumberMatch = Array.from(planCourseCodes).some(planCode => {
            const planNumber = planCode.replace(/[A-Z]/g, '');
            return planNumber === courseNumber;
          });
          
          return !hasNumberMatch;
        });
        
        if (extraCourses.length === 0) return null;

        return (
          <div className="mt-8 p-6 bg-orange-50 rounded-lg shadow-sm border border-orange-200">
            <h3 className="text-lg font-semibold mb-4 text-orange-800">Extra Courses (Not in Plan)</h3>
            <p className="text-sm text-orange-700 mb-4">
              These courses are in your transcript but not included in your current plan:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {extraCourses.map((course, index) => {
                const courseHistory = transcript.filter(t => t.code === course.code);
                const latestGrade = courseHistory.length > 0 ? courseHistory[courseHistory.length - 1].grade : '';
                
                return (
                  <div 
                    key={index}
                    className={`${getItemColor({ type: 'course', code: course.code })} text-white p-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer transform hover:scale-105 relative`}
                    onClick={() => handleCourseClick(course.code, false, undefined, false)}
                  >
                    <div className="text-sm font-medium text-center">
                      {formatCourseCode(course.code)}
                    </div>
                    <div className="text-xs text-center mt-1 opacity-75">
                      {course.name}
                    </div>
                    {latestGrade && (
                      <div className="absolute -top-1 -right-1 bg-white text-gray-800 text-xs font-bold px-1 rounded-full min-w-[20px] text-center">
                        {latestGrade}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      <div className="mt-8 p-6 bg-gray-50 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold mb-4 text-gray-700">Legend</h3>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-5 h-5 bg-purple-500 rounded shadow-sm"></div>
            <span className="text-sm text-gray-600">Not Taken</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-5 h-5 bg-blue-500 rounded shadow-sm"></div>
            <span className="text-sm text-gray-600">Currently Taken</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-5 h-5 bg-green-600 rounded shadow-sm"></div>
            <span className="text-sm text-gray-600">Passed</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-5 h-5 bg-red-400 rounded shadow-sm"></div>
            <span className="text-sm text-gray-600">Failed</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-5 h-5 bg-yellow-500 rounded shadow-sm flex items-center justify-center text-xs">🔒</div>
            <span className="text-sm text-gray-600">Prerequisites Not Met</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-5 h-5 bg-orange-500 rounded shadow-sm flex items-center justify-center text-xs">⚠️</div>
            <span className="text-sm text-gray-600">Different Course</span>
          </div>
        </div>
      </div>

      {/* Course Popup */}
      <CoursePopup
        isOpen={popupOpen}
        onClose={() => setPopupOpen(false)}
        courseCode={selectedCourse}
        courseName={getCourseNameFromTranscript(selectedCourse)}
        transcript={transcript}
        isElective={isSelectedElective}
        plan={plan}
        hasWarningIcon={hasWarningIcon}
      />
    </div>
  );
} 