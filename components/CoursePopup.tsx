'use client';

import { useEffect, useState } from 'react';

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

interface CoursePopupProps {
  isOpen: boolean;
  onClose: () => void;
  courseCode: string;
  courseName?: string;
  transcript: TranscriptItem[];
  isElective?: boolean;
  plan?: any[][];
  hasWarningIcon?: boolean;
  onAddCourse?: (courseCode?: string) => void;
  onDeleteAttempt?: (courseCode: string, semester: string) => void;
  selectedSemester?: string | null;
}

export default function CoursePopup({ isOpen, onClose, courseCode, courseName: providedCourseName, transcript, isElective = false, plan = [], hasWarningIcon = false, onAddCourse, onDeleteAttempt, selectedSemester }: CoursePopupProps) {
  const [selectedElectiveCourse, setSelectedElectiveCourse] = useState<string>('');
  const [selectedElectiveCourseCode, setSelectedElectiveCourseCode] = useState<string>('');
  const [coursesData, setCoursesData] = useState<CourseInfo[]>([]);
  const [courseMappings, setCourseMappings] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  
  // Parse courseCode to handle matched courses (format: "PLANCODE|MATCHEDCODE")
  const [planCourseCode, matchedCourseCode] = courseCode.includes('|') ? courseCode.split('|') : [courseCode, null];
  
  const getGradeColor = (grade: string) => {
    if (!grade || grade === '') return 'text-gray-400';
    if (grade === 'AA' || grade === 'BA' || grade === 'BB' || grade === 'BL') return 'text-green-600 font-semibold';
    if (grade === 'CB' || grade === 'CB+' || grade === 'CC') return 'text-blue-600 font-semibold';
    if (grade === 'DC' || grade === 'DC+' || grade === 'DD') return 'text-yellow-600 font-semibold';
    if (grade === 'FD' || grade === 'FF' || grade === 'VF') return 'text-red-600 font-semibold';
    return 'text-gray-600';
  };

  const getGradeStatus = (grade: string) => {
    if (!grade || grade === '') return 'In Progress';
    if (grade === 'AA' || grade === 'BA' || grade === 'BB' || grade === 'CB' || grade === 'CB+' || grade === 'CC' || grade === 'BL') return 'Passed';
    if (grade === 'DC' || grade === 'DC+' || grade === 'DD') return 'Conditional Pass';
    if (grade === 'FD' || grade === 'FF' || grade === 'VF') return 'Failed';
    return 'Unknown';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Passed': return 'text-green-600';
      case 'Conditional Pass': return 'text-yellow-600';
      case 'Failed': return 'text-red-600';
      case 'Withdrawn': return 'text-gray-500';
      case 'In Progress': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };
  
  // Close popup when clicking outside
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Load courses data and course mappings from JSON files
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Load courses data
        const coursesResponse = await fetch('/courses.json');
        const coursesData = await coursesResponse.json();
        setCoursesData(coursesData);
        
        // Load course mappings
        const mappingsResponse = await fetch('/course-mappings.json');
        const mappingsData = await mappingsResponse.json();
        setCourseMappings(mappingsData);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  // Function to get course name from courses.json
  const getCourseNameFromData = (code: string): string | undefined => {
    const course = coursesData.find(c => c.code === code);
    return course?.name;
  };

  // Function to get prerequisites for a course
  const getPrerequisites = (code: string): PrerequisiteGroup[] | undefined => {
    const course = coursesData.find(c => c.code === code);
    return course?.prerequisites;
  };



  // Helper function to find equivalent courses using exact match and course mappings JSON
  const findEquivalentCourse = (targetCourseCode: string, allPrerequisiteCodes: string[] = []) => {
    // First, check for exact match (with and without spaces)
    const exactMatch = transcript.find(t => t.code === targetCourseCode);
    if (exactMatch) {
      return exactMatch;
    }
    
    // Also check for exact match with spaces removed
    const targetCodeNoSpaces = targetCourseCode.replace(/\s+/g, '');
    const exactMatchNoSpaces = transcript.find(t => t.code.replace(/\s+/g, '') === targetCodeNoSpaces);
    if (exactMatchNoSpaces) {
      return exactMatchNoSpaces;
    }
    
    // Then, check if the target course has explicit mappings in course-mappings.json
    const alternatives = courseMappings[targetCourseCode] || [];
    
    // Look for any of the alternative courses in the transcript
    for (const alternativeCode of alternatives) {
      const match = transcript.find(t => t.code === alternativeCode);
      if (match) {
        // Check if this alternative is in the prerequisite list
        if (allPrerequisiteCodes.includes(alternativeCode)) {
          continue;
        }
        return match;
      }
    }
    
    return null;
  };

  // Function to check if a prerequisite is satisfied
  const isPrerequisiteSatisfied = (prereqCode: string, minGrade: string, courseCodeForPrereqs?: string): boolean => {
    // Get all prerequisite codes from the current prerequisite group to avoid matching with them
    const allPrerequisiteCodes = courseCodeForPrereqs ? getPrerequisites(courseCodeForPrereqs)?.flatMap(group => 
      group.courses.map(course => course.code)
    ) || [] : [];
    
    // Use findEquivalentCourse which handles both exact match and course mappings
    const equivalentMatch = findEquivalentCourse(prereqCode, allPrerequisiteCodes);
    let courseHistory: TranscriptItem[] = [];
    
    if (equivalentMatch) {
      courseHistory = transcript.filter(t => t.code === equivalentMatch.code);
    }
    
    if (courseHistory.length === 0) return false;
    
    const latestAttempt = courseHistory[courseHistory.length - 1];
    const latestGrade = latestAttempt.grade;
    
    // If the latest grade is not "--", use it directly
    if (latestGrade !== '--') {
      // Grade comparison logic - based on transcript grades
      const gradeOrder = ['FF', 'FD', 'VF', 'DD', 'DD+', 'DC', 'DC+', 'CC', 'CC+', 'CB', 'CB+', 'BB', 'BB+', 'BA', 'BA+', 'AA', 'BL'];
      const latestGradeIndex = gradeOrder.indexOf(latestGrade);
      const minGradeIndex = gradeOrder.indexOf(minGrade);
      
      return latestGradeIndex >= minGradeIndex;
    }
    
    // If the latest grade is "--" (planned), check if we're viewing a semester after it
    if (selectedSemester && latestAttempt.semester !== selectedSemester) {
      // For planned courses, we need to check if the selected semester comes after the planned semester
      const plannedSemester = latestAttempt.semester;
      
      // If the planned semester is from the plan (e.g., "Semester 1"), we need to compare differently
      if (plannedSemester.startsWith('Semester ')) {
        // Extract semester number from plan
        const planSemesterNum = parseInt(plannedSemester.replace('Semester ', ''));
        
        // Extract semester number from selected semester
        const selectedSemesterNum = parseInt(selectedSemester.replace(/[^0-9]/g, ''));
        
        // If selected semester is after the planned semester, consider it as passed
        if (selectedSemesterNum > planSemesterNum) {
          // Grade comparison logic for planned courses (assumed pass)
          const gradeOrder = ['FF', 'FD', 'VF', 'DD', 'DD+', 'DC', 'DC+', 'CC', 'CC+', 'CB', 'CB+', 'BB', 'BB+', 'BA', 'BA+', 'AA', 'BL'];
          const minGradeIndex = gradeOrder.indexOf(minGrade);
          
          // Planned courses are considered as passing with "CC" grade
          const assumedGradeIndex = gradeOrder.indexOf('CC');
          
          return assumedGradeIndex >= minGradeIndex;
        }
      } else {
        // For regular transcript semesters, use the existing logic
        const getSemesterOrder = (semester: string) => {
          const yearMatch = semester.match(/(\d{4})/);
          if (!yearMatch) return 0;
          const year = parseInt(yearMatch[1]);
          
          let semesterOrder = 1; // Güz
          if (semester.includes('Bahar')) semesterOrder = 2;
          else if (semester.includes('Yaz')) semesterOrder = 3;
          
          return year * 10 + semesterOrder;
        };
        
        const plannedOrder = getSemesterOrder(plannedSemester);
        const selectedOrder = getSemesterOrder(selectedSemester);
        
        // If selected semester is after the planned semester, consider it as passed
        if (selectedOrder > plannedOrder) {
          // Grade comparison logic for "?" grade (assumed pass)
          const gradeOrder = ['FF', 'FD', 'VF', 'DD', 'DD+', 'DC', 'DC+', 'CC', 'CC+', 'CB', 'CB+', 'BB', 'BB+', 'BA', 'BA+', 'AA', 'BL'];
          const minGradeIndex = gradeOrder.indexOf(minGrade);
          
          // "?" grade is considered as a passing grade, so it should satisfy most prerequisites
          // We'll treat it as equivalent to "CC" (minimum passing grade)
          const assumedGradeIndex = gradeOrder.indexOf('CC');
          
          return assumedGradeIndex >= minGradeIndex;
        }
      }
    }
    
    return false; // Currently taken or not yet taken
  };

  // Function to check if a prerequisite group is satisfied (at least one course in group)
  const isPrerequisiteGroupSatisfied = (group: PrerequisiteGroup): boolean => {
    return group.courses.some(prereq => isPrerequisiteSatisfied(prereq.code, prereq.min, planCourseCode));
  };

  // Function to get the status text for a prerequisite
  const getPrerequisiteStatus = (prereqCode: string): string => {
    // Use findEquivalentCourse which handles both exact match and course mappings
    const equivalentMatch = findEquivalentCourse(prereqCode);
    let courseHistory: TranscriptItem[] = [];
    let matchedCourseCode = prereqCode;
    
    if (equivalentMatch) {
      courseHistory = transcript.filter(t => t.code === equivalentMatch.code);
      matchedCourseCode = equivalentMatch.code;
    }
    
    if (courseHistory.length === 0) return 'Not taken';
    
    const latestGrade = courseHistory[courseHistory.length - 1].grade;
    if (latestGrade === '--') return 'Planned to pass';
    
    // Check if it's a passing grade
    const passingGrades = ['AA', 'BA', 'BA+', 'BB', 'BB+', 'CB', 'CB+', 'CC', 'CC+', 'DD', 'DD+', 'DC', 'DC+', 'BL'];
    if (passingGrades.includes(latestGrade)) {
      return latestGrade;
    } else {
      return 'Failed';
    }
  };

  if (!isOpen) return null;
  
  // For elective courses, we need to show a course selector first
  if (isElective) {
    // Find the elective course in the plan to get its options
    let electiveOptions: string[] = [];
    for (const semester of plan) {
      for (const item of semester) {
        if (item.type === 'elective' && item.name === courseCode) {
          electiveOptions = item.options || [];
          break;
        }
      }
      if (electiveOptions.length > 0) break;
    }
    
    // Get all elective assignments to see which courses are already assigned
    const assignedCourses = new Set<string>();
    for (const semester of plan) {
      for (const item of semester) {
        if (item.type === 'elective' && item.name !== courseCode) {
          // Check if any courses from this elective are already taken
          const otherElectiveOptions = item.options || [];
          const takenCourses = transcript.filter(t => otherElectiveOptions.includes(t.code));
          takenCourses.forEach(course => assignedCourses.add(course.code));
        }
      }
    }
    
    // Get courses from transcript that match the elective options AND you've taken AND are not assigned to other electives
    const availableCourses = transcript.filter(item => 
      electiveOptions.includes(item.code) && !assignedCourses.has(item.code)
    );
    
    // If you've taken courses for this elective, show the first one directly
    if (availableCourses.length > 0) {
      const takenCourse = availableCourses[0]; // Show the first taken course
      const courseHistory = transcript.filter(item => item.name === takenCourse.name).sort((a, b) => {
        // Sort by semester to show most recent first
        const getSemesterOrder = (semester: string) => {
          const yearMatch = semester.match(/(\d{4})-(\d{4})/);
          if (!yearMatch) return 0;
          const startYear = parseInt(yearMatch[1]);
          const endYear = parseInt(yearMatch[2]);
          
          // Determine semester order: Güz (Fall) = 1, Bahar (Spring) = 2, Yaz (Summer) = 3
          let semesterOrder = 1;
          if (semester.includes('Bahar')) semesterOrder = 2;
          else if (semester.includes('Yaz')) semesterOrder = 3;
          
          return (startYear * 10 + semesterOrder);
        };
        
        return getSemesterOrder(b.semester) - getSemesterOrder(a.semester);
      });
      
      return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto mx-4">
            {/* Header */}
            <div className="flex justify-between items-center p-4 lg:p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl lg:text-2xl font-bold text-gray-800">{courseCode}</h2>
                <p className="text-gray-600 mt-1">Elective Course - {getCourseNameFromData(takenCourse.code) || takenCourse.name}</p>
                {takenCourse.credits && (
                  <p className="text-sm text-blue-600 mt-1">
                    Credits: {takenCourse.credits}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Course History */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Course History</h3>
                  {onAddCourse && selectedSemester && (
                    <button
                      onClick={() => onAddCourse()}
                      className="px-3 py-1 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors"
                    >
                      Add New Attempt
                    </button>
                  )}
                </div>
                {courseHistory.length === 0 ? (
                  <p className="text-gray-500">No attempts found for this course.</p>
                ) : (
                  <div className="space-y-3">
                    {courseHistory.map((attempt, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-4 relative">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-800">{attempt.semester}</p>
                            <p className="text-sm text-gray-600">
                              <span className="font-semibold">{attempt.code.replace(/\s+/g, '')}</span> - {getCourseNameFromData(attempt.code) || attempt.name}
                            </p>
                            {attempt.credits && (
                              <p className="text-xs text-blue-600 mt-1">
                                Credits: {attempt.credits}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className={`text-lg font-bold ${getGradeColor(attempt.grade)}`}>
                              {attempt.grade || 'In Progress'}
                            </p>
                          </div>
                        </div>
                        {onDeleteAttempt && (
                          <button
                            onClick={() => onDeleteAttempt(attempt.code, attempt.semester)}
                            className="absolute top-2 right-2 text-red-500 hover:text-red-700 text-sm font-bold p-1 rounded-full hover:bg-red-50 transition-colors"
                            title="Delete this attempt"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Prerequisites */}
              {(() => {
                const prerequisites = getPrerequisites(takenCourse.code);
                if (!prerequisites || prerequisites.length === 0) {
                  return (
                    <div className="border-t border-gray-200 pt-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">Prerequisites</h3>
                      <p className="text-gray-500 text-sm">No prerequisites required for this course.</p>
                    </div>
                  );
                }

                return (
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Prerequisites</h3>
                    <div className="space-y-4">
                      {prerequisites.map((group, groupIndex) => {
                        const isGroupSatisfied = isPrerequisiteGroupSatisfied(group);
                        return (
                          <div key={groupIndex} className="bg-gray-50 rounded-lg p-4">
                            <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                              <div className={`w-3 h-3 rounded-full mr-2 ${isGroupSatisfied ? 'bg-green-500' : 'bg-red-500'}`}></div>
                              Group {group.group} {isGroupSatisfied && <span className="text-green-600 text-xs ml-2">(Satisfied)</span>}
                            </h4>
                            <div className="space-y-2">
                              {group.courses.map((prereq, prereqIndex) => {
                                const isSatisfied = isPrerequisiteSatisfied(prereq.code, prereq.min);
                                const courseName = getCourseNameFromData(prereq.code) || prereq.code;
                                const courseHistory = transcript.filter(t => t.code === prereq.code);
                                const latestGrade = courseHistory.length > 0 ? courseHistory[courseHistory.length - 1].grade : '';
                                
                                return (
                                  <div key={prereqIndex} className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                      <div className={`w-3 h-3 rounded-full ${isSatisfied ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                      <span className="text-sm font-medium text-gray-800">{courseName}</span>
                                    </div>
                                    <div className="text-right">
                                      <span className={`text-sm font-semibold ${
                                        getPrerequisiteStatus(prereq.code) === 'Not taken' ? 'text-gray-400' :
                                        getPrerequisiteStatus(prereq.code) === 'Planned to pass' ? 'text-blue-600' :
                                        getPrerequisiteStatus(prereq.code) === 'Failed' ? 'text-red-600' :
                                        isSatisfied ? 'text-green-600' : 'text-red-600'
                                      }`}>
                                        {getPrerequisiteStatus(prereq.code)}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="flex justify-end p-6 border-t border-gray-200">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      );
    }
    
    // If you haven't taken any courses for this elective, show available options
    const allCourses = electiveOptions;
    
    // Get courses that are taken but assigned to other electives
    const takenButAssigned = transcript.filter(item => 
      electiveOptions.includes(item.code) && assignedCourses.has(item.code)
    );
    
    // Filter transcript for the selected elective course
    const courseHistory = selectedElectiveCourse ? transcript.filter(item => item.name === selectedElectiveCourse).sort((a, b) => {
      // Sort by semester to show most recent first
      const getSemesterOrder = (semester: string) => {
        const yearMatch = semester.match(/(\d{4})-(\d{4})/);
        if (!yearMatch) return 0;
        const startYear = parseInt(yearMatch[1]);
        const endYear = parseInt(yearMatch[2]);
        
        // Determine semester order: Güz (Fall) = 1, Bahar (Spring) = 2, Yaz (Summer) = 3
        let semesterOrder = 1;
        if (semester.includes('Bahar')) semesterOrder = 2;
        else if (semester.includes('Yaz')) semesterOrder = 3;
        
        return (startYear * 10 + semesterOrder);
      };
      
      return getSemesterOrder(b.semester) - getSemesterOrder(a.semester);
    }) : [];
    
    // Get the most recent attempt
    const latestAttempt = courseHistory[courseHistory.length - 1];
    
    // Get course name from the latest attempt or use selected course
    const displayCourseName = selectedElectiveCourse || courseCode;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto mx-4">
          {/* Header */}
          <div className="flex justify-between items-center p-6 border-b border-gray-200">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{courseCode}</h2>
              <p className="text-gray-600 mt-1">Elective Course Category</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Course Selector */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Available Options</h3>
              <p className="text-gray-600 mb-4">You haven't taken any courses for this elective yet. Here are the available options:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {allCourses.map((courseCode) => {
                  const attempts = transcript.filter(item => item.code === courseCode);
                  const latestGrade = attempts.length > 0 ? attempts[attempts.length - 1].grade : '';
                  const courseName = getCourseNameFromData(courseCode) || (attempts.length > 0 ? attempts[0].name : courseCode);
                  const isAssignedToOther = assignedCourses.has(courseCode);
                  
                  return (
                    <button
                      key={courseCode}
                      onClick={() => !isAssignedToOther && (setSelectedElectiveCourse(courseName), setSelectedElectiveCourseCode(courseCode))}
                      disabled={isAssignedToOther}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        isAssignedToOther
                          ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
                          : selectedElectiveCourse === courseName
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      <div className="text-sm font-medium">{courseCode}</div>
                      <div className="text-xs text-gray-600">{courseName}</div>
                      {isAssignedToOther && (
                        <div className="text-xs text-gray-500 mt-1">
                          Assigned to other elective
                        </div>
                      )}
                      {attempts.length > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          {attempts.length} attempt{attempts.length !== 1 ? 's' : ''} • {latestGrade}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              
              {takenButAssigned.length > 0 && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="text-sm font-semibold text-yellow-800 mb-2">Courses Already Assigned</h4>
                  <div className="text-xs text-yellow-700">
                    {takenButAssigned.map(course => (
                      <div key={course.code} className="mb-1">
                        {course.code} - {getCourseNameFromData(course.code) || course.name} (Grade: {course.grade})
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Course History */}
            {selectedElectiveCourse && (
              <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Course History</h3>
                  {onAddCourse && selectedSemester && selectedElectiveCourseCode && (
                    <button
                      onClick={() => onAddCourse(selectedElectiveCourseCode)}
                      className="px-3 py-1 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors"
                    >
                      Add New Attempt
                    </button>
                  )}
                </div>
                {courseHistory.length === 0 ? (
                  <p className="text-gray-500">No attempts found for this course.</p>
                ) : (
                  <div className="space-y-3">
                    {courseHistory.map((attempt, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-800">{attempt.semester}</p>
                            <p className="text-sm text-gray-600">
                              <span className="font-semibold">{attempt.code.replace(/\s+/g, '')}</span> - {getCourseNameFromData(attempt.code) || attempt.name}
                            </p>
                            {attempt.credits && (
                              <p className="text-xs text-blue-600 mt-1">
                                Credits: {attempt.credits}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className={`text-lg font-bold ${getGradeColor(attempt.grade)}`}>
                              {attempt.grade || 'In Progress'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Connected Courses (Placeholder for future feature) */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Connected Courses</h3>
              <p className="text-gray-500 text-sm">
                This feature will show related courses and prerequisites in the future.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end p-6 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Regular course logic (non-elective)
  // Filter transcript for this specific course
  // If we have a matched course code, use that for history; otherwise use the plan course code
  const actualCourseCode = matchedCourseCode || planCourseCode;
  const courseHistory = transcript.filter(item => {
    if (item.code !== actualCourseCode) return false;
    
    // If we have a specific course name provided, match it exactly
    if (providedCourseName) {
      return item.name === providedCourseName;
    }
    
    // Otherwise, show all courses with the same code
    return true;
  }).sort((a, b) => {
    // Sort by semester to show most recent first
    // Extract year and semester from semester string (e.g., "2023-2024 Güz Dönemi")
    const getSemesterOrder = (semester: string) => {
      const yearMatch = semester.match(/(\d{4})-(\d{4})/);
      if (!yearMatch) return 0;
      const startYear = parseInt(yearMatch[1]);
      const endYear = parseInt(yearMatch[2]);
      
      // Determine semester order: Güz (Fall) = 1, Bahar (Spring) = 2, Yaz (Summer) = 3
      let semesterOrder = 1;
      if (semester.includes('Bahar')) semesterOrder = 2;
      else if (semester.includes('Yaz')) semesterOrder = 3;
      
      return (startYear * 10 + semesterOrder);
    };
    
    return getSemesterOrder(b.semester) - getSemesterOrder(a.semester);
  });
  
  // Get the most recent attempt
  const latestAttempt = courseHistory[0]; // Now first item is most recent
  
  // Get course name from courses.json, then from transcript, then fallback to provided name or code
  const displayCourseName = getCourseNameFromData(planCourseCode) || latestAttempt?.name || providedCourseName || planCourseCode;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
                     <div>
             <h2 className="text-2xl font-bold text-gray-800">{planCourseCode}</h2>
             <p className="text-gray-600 mt-1">{displayCourseName}</p>
             {latestAttempt && (
               <p className="text-sm text-blue-600 mt-1">
                 Credits: {latestAttempt.credits}
               </p>
             )}
             {matchedCourseCode && hasWarningIcon && (
               <p className="text-sm text-orange-600 mt-1">
                 ⚠️ Matched with {matchedCourseCode} from transcript
               </p>
             )}
           </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
                    {/* Course History */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Course History</h3>
              {onAddCourse && selectedSemester && (
                <button
                  onClick={() => onAddCourse(courseCode)}
                  className="px-3 py-1 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors"
                >
                  Add New Attempt
                </button>
              )}
            </div>
            {courseHistory.length === 0 ? (
              <p className="text-gray-500">No attempts found for this course.</p>
            ) : (
              <div className="space-y-3">
                {courseHistory.map((attempt, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-4 relative">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-800">{attempt.semester}</p>
                        <p className="text-sm text-gray-600">
                          <span className="font-semibold">{attempt.code.replace(/\s+/g, '')}</span> - {getCourseNameFromData(attempt.code) || attempt.name}
                        </p>
                        {attempt.credits && (
                          <p className="text-xs text-blue-600 mt-1">
                            Credits: {attempt.credits}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold ${getGradeColor(attempt.grade)}`}>
                          {attempt.grade || 'In Progress'}
                        </p>
                      </div>
                    </div>
                    {onDeleteAttempt && attempt.grade === "--" && (
                      <button
                        onClick={() => onDeleteAttempt(attempt.code, attempt.semester)}
                        className="absolute bottom-2 right-2 text-red-500 hover:text-red-700 text-lg font-bold p-2 rounded-full hover:bg-red-50 transition-colors"
                        title="Delete this attempt"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          

          {/* Prerequisites */}
          {(() => {
            const prerequisites = getPrerequisites(planCourseCode);
            if (!prerequisites || prerequisites.length === 0) {
              return (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Prerequisites</h3>
                  <p className="text-gray-500 text-sm">No prerequisites required for this course.</p>
                </div>
              );
            }

            return (
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Prerequisites</h3>
                                    <div className="space-y-4">
                      {prerequisites.map((group, groupIndex) => {
                        const isGroupSatisfied = isPrerequisiteGroupSatisfied(group);
                        return (
                          <div key={groupIndex} className="bg-gray-50 rounded-lg p-4">
                            <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                              <div className={`w-3 h-3 rounded-full mr-2 ${isGroupSatisfied ? 'bg-green-500' : 'bg-red-500'}`}></div>
                              Group {group.group} {isGroupSatisfied && <span className="text-green-600 text-xs ml-2">(Satisfied)</span>}
                            </h4>
                            <div className="space-y-2">
                              {group.courses.map((prereq, prereqIndex) => {
                                const isSatisfied = isPrerequisiteSatisfied(prereq.code, prereq.min);
                                const courseName = getCourseNameFromData(prereq.code) || prereq.code;
                                const courseHistory = transcript.filter(t => t.code === prereq.code);
                                const latestGrade = courseHistory.length > 0 ? courseHistory[courseHistory.length - 1].grade : '';
                                
                                return (
                                  <div key={prereqIndex} className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                      <div className={`w-3 h-3 rounded-full ${isSatisfied ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                      <span className="text-sm font-medium text-gray-800">{courseName}</span>
                                    </div>
                                    <div className="text-right">
                                      <span className={`text-sm font-semibold ${
                                        getPrerequisiteStatus(prereq.code) === 'Not taken' ? 'text-gray-400' :
                                        getPrerequisiteStatus(prereq.code) === 'Planned to pass' ? 'text-blue-600' :
                                        getPrerequisiteStatus(prereq.code) === 'Failed' ? 'text-red-600' :
                                        isSatisfied ? 'text-green-600' : 'text-red-600'
                                      }`}>
                                        {getPrerequisiteStatus(prereq.code)}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
              </div>
            );
          })()}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
} 