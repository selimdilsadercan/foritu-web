'use client';

import { useEffect, useState } from 'react';

interface TranscriptItem {
  semester: string;
  code: string;
  name: string;
  credits: string;
  grade: string;
  selectedLessons?: SelectedLesson[];
}

interface SelectedLesson {
  courseCode: string;
  lessonId: string;
  session: LessonSession;
  instructor: string;
  deliveryMode: string;
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

interface LessonSession {
  location: string;
  day: string;
  time: string;
  room: string;
}

interface Lesson {
  lesson_id: string;
  course_code: string;
  delivery_mode: string;
  instructor: string;
  capacity: string;
  enrolled: string;
  sessions: LessonSession[];
}

interface LessonsData {
  metadata: {
    source_file: string;
    total_lessons: number;
    conversion_notes: string;
  };
  lessons: Lesson[];
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
  onUpdateGrade?: (courseCode: string, semester: string, newGrade: string) => void;
  onUpdateSelectedLessons?: (courseCode: string, semester: string, selectedLessons: SelectedLesson[]) => void;
  selectedSemester?: string | null;
}

export default function CoursePopup({ isOpen, onClose, courseCode, courseName: providedCourseName, transcript, isElective = false, plan = [], hasWarningIcon = false, onAddCourse, onDeleteAttempt, onUpdateGrade, onUpdateSelectedLessons, selectedSemester }: CoursePopupProps) {
  const [selectedElectiveCourse, setSelectedElectiveCourse] = useState<string>('');
  const [selectedElectiveCourseCode, setSelectedElectiveCourseCode] = useState<string>('');
  const [coursesData, setCoursesData] = useState<CourseInfo[]>([]);
  const [courseMappings, setCourseMappings] = useState<Record<string, string[]>>({});
  const [lessonsData, setLessonsData] = useState<LessonsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingGrades, setEditingGrades] = useState<Record<string, string>>({});
  const [prereqExpanded, setPrereqExpanded] = useState<boolean | null>(null);
  const [electiveFilter, setElectiveFilter] = useState<'all' | 'opened'>('opened');
  const [electiveViewMode, setElectiveViewMode] = useState<'selection' | 'details'>('selection');
  const [selectedLessons, setSelectedLessons] = useState<SelectedLesson[]>([]);
  
  // Parse courseCode to handle matched courses (format: "PLANCODE|MATCHEDCODE")
  const [planCourseCode, matchedCourseCode] = courseCode.includes('|') ? courseCode.split('|') : [courseCode, null];
  
  // Determine the actual course code to use for display
  const getDisplayCourseCode = () => {
    if (isElective && electiveViewMode === 'details' && selectedElectiveCourseCode) {
      return selectedElectiveCourseCode;
    }
    return planCourseCode;
  };
  
  const displayCourseCode = getDisplayCourseCode();
  
  // Available grades for selection
  const availableGrades = [
    { value: 'AA', label: 'AA', color: 'text-green-600' },
    { value: 'BA', label: 'BA', color: 'text-green-600' },
    { value: 'BB', label: 'BB', color: 'text-green-600' },
    { value: 'CB', label: 'CB', color: 'text-blue-600' },
    { value: 'CC', label: 'CC', color: 'text-blue-600' },
    { value: 'DC', label: 'DC', color: 'text-yellow-600' },
    { value: 'DD', label: 'DD', color: 'text-yellow-600' },
    { value: 'FD', label: 'FD', color: 'text-red-600' },
    { value: 'FF', label: 'FF', color: 'text-red-600' },
    { value: 'VF', label: 'VF', color: 'text-red-600' },
    { value: 'BL', label: 'BL', color: 'text-green-600' }
  ];

  // Function to check if selected semester is the current semester
  const isCurrentSemester = (): boolean => {
    if (!selectedSemester) return false;
    
    // Get all unique semesters from transcript
    const semesters = [...new Set(transcript.map(item => item.semester))];
    
    // Check if the selected semester is a planned semester (contains "Planı")
    if (selectedSemester.includes('Planı')) {
      return true;
    }
    
    // Find the last actual semester (not a planned semester)
    for (let i = 0; i < semesters.length; i++) {
      const semester = semesters[i];
      const semesterCourses = transcript.filter(item => item.semester === semester);
      const isPlannedSemester = semesterCourses.length === 1 && semesterCourses[0].code === 'PLACEHOLDER';
      const isPlannedSemesterByName = semester.includes('Planı');
      
      if (!isPlannedSemester && !isPlannedSemesterByName) {
        // This is the current semester
        return semester === selectedSemester;
      }
    }
    
    return false;
  };

  // Function to get active lessons for a course
  const getActiveLessons = (courseCode: string): Lesson[] => {
    if (!lessonsData) return [];
    
    return lessonsData.lessons.filter(lesson => 
      lesson.course_code === courseCode
    );
  };

  // Function to handle lesson selection
  const handleLessonSelect = (lesson: SelectedLesson) => {
    setSelectedLessons([lesson]); // Only allow one lesson to be selected at a time
  };

  // Function to handle lesson deselection
  const handleLessonDeselect = (lessonId: string) => {
    setSelectedLessons(prev => prev.filter(l => l.lessonId !== lessonId));
  };

  // Function to save selected lesson to transcript
  const saveSelectedLessons = () => {
    if (selectedLessons.length === 0) return;

    // Find the current semester course in transcript
    const currentSemesterCourse = transcript.find(item => 
      item.code === displayCourseCode && 
      item.semester === selectedSemester
    );

    if (currentSemesterCourse && onUpdateSelectedLessons) {
      // Call the parent function to update the transcript state
      onUpdateSelectedLessons(displayCourseCode, selectedSemester!, selectedLessons);
      console.log('Selected lesson saved:', selectedLessons[0]);
    }
  };

  // Load selected lessons from transcript on component mount
  useEffect(() => {
    if (isCurrentSemester()) {
      const currentSemesterCourse = transcript.find(item => 
        item.code === displayCourseCode && 
        item.semester === selectedSemester
      );
      
      if (currentSemesterCourse?.selectedLessons) {
        setSelectedLessons(currentSemesterCourse.selectedLessons);
      }
    }
  }, [transcript, displayCourseCode, selectedSemester]);

  // Function to handle grade selection
  const handleGradeSelect = (courseCode: string, semester: string, newGrade: string) => {
    setEditingGrades(prev => ({
      ...prev,
      [`${courseCode}-${semester}`]: newGrade
    }));
    
    if (onUpdateGrade) {
      // Add asterisk to indicate this is a planned grade
      const gradeWithAsterisk = newGrade !== "--" ? `${newGrade}*` : newGrade;
      onUpdateGrade(courseCode, semester, gradeWithAsterisk);
    }
  };

  const getGradeColor = (grade: string) => {
    if (!grade || grade === '') return 'text-gray-400';
    // Remove asterisk for color determination
    const gradeWithoutAsterisk = grade.replace('*', '');
    if (gradeWithoutAsterisk === 'AA' || gradeWithoutAsterisk === 'BA' || gradeWithoutAsterisk === 'BB' || gradeWithoutAsterisk === 'BL') return 'text-green-600 font-semibold';
    if (gradeWithoutAsterisk === 'CB' || gradeWithoutAsterisk === 'CB+' || gradeWithoutAsterisk === 'CC') return 'text-blue-600 font-semibold';
    if (gradeWithoutAsterisk === 'DC' || gradeWithoutAsterisk === 'DC+' || gradeWithoutAsterisk === 'DD') return 'text-yellow-600 font-semibold';
    if (gradeWithoutAsterisk === 'FD' || gradeWithoutAsterisk === 'FF' || gradeWithoutAsterisk === 'VF') return 'text-red-600 font-semibold';
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

  // Helper function to check if all prerequisites are satisfied
  const areAllPrerequisitesSatisfied = (prerequisites: PrerequisiteGroup[]): boolean => {
    return prerequisites.every(group => isPrerequisiteGroupSatisfied(group));
  };

  // Get expanded state for prerequisites section
  const getPrereqExpanded = (prerequisites: PrerequisiteGroup[]): boolean => {
    if (prereqExpanded !== null) return prereqExpanded;
    return !areAllPrerequisitesSatisfied(prerequisites);
  };

  const togglePrerequisites = (prerequisites: PrerequisiteGroup[]) => {
    const current = getPrereqExpanded(prerequisites);
    setPrereqExpanded(!current);
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

        // Load lessons data
        const lessonsResponse = await fetch('/lessons.json');
        const lessonsData = await lessonsResponse.json();
        setLessonsData(lessonsData);
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
    
    // Handle planned grades (-- or with asterisk)
    const isPlannedGrade = latestGrade === '--' || (typeof latestGrade === 'string' && (latestGrade as string).endsWith('*'));
    
    if (isPlannedGrade) {
      // Check if user has selected a grade for this planned course
      const selectedGrade = editingGrades[`${latestAttempt.code}-${latestAttempt.semester}`];
      
      if (selectedGrade && selectedGrade !== '--') {
        // Use the selected grade for prerequisite calculation
        const gradeOrder = ['FF', 'FD', 'VF', 'DD', 'DD+', 'DC', 'DC+', 'CC', 'CC+', 'CB', 'CB+', 'BB', 'BB+', 'BA', 'BA+', 'AA', 'BL'];
        const selectedGradeIndex = gradeOrder.indexOf(selectedGrade);
        const minGradeIndex = gradeOrder.indexOf(minGrade);
        
        return selectedGradeIndex >= minGradeIndex;
      }
      
      // If no grade is selected but grade has asterisk, use the grade without asterisk
      if (latestGrade !== '--' && typeof latestGrade === 'string' && (latestGrade as string).endsWith('*')) {
        const gradeWithoutAsterisk = (latestGrade as string).replace('*', '');
        const gradeOrder = ['FF', 'FD', 'VF', 'DD', 'DD+', 'DC', 'DC+', 'CC', 'CC+', 'CB', 'CB+', 'BB', 'BB+', 'BA', 'BA+', 'AA', 'BL'];
        const gradeIndex = gradeOrder.indexOf(gradeWithoutAsterisk);
        const minGradeIndex = gradeOrder.indexOf(minGrade);
        
        return gradeIndex >= minGradeIndex;
      }
      
      // If no grade is selected, check if we're viewing a semester after the planned semester
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
    
    const latestAttempt = courseHistory[courseHistory.length - 1];
    const latestGrade = latestAttempt.grade;
    
    if (latestGrade === '--' || (typeof latestGrade === 'string' && latestGrade.endsWith('*'))) {
      // Check if user has selected a grade for this planned course
      const selectedGrade = editingGrades[`${latestAttempt.code}-${latestAttempt.semester}`];
      if (selectedGrade && selectedGrade !== '--') {
        return selectedGrade;
      }
      // If grade has asterisk, return the grade with asterisk
      if (typeof latestGrade === 'string' && latestGrade.endsWith('*')) {
        return latestGrade;
      }
      return 'Planned to pass';
    }
    
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
        <div className="fixed inset-0 bg-[#000000DD] flex items-center justify-center z-50 p-4">
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
                  <h3 className="text-lg font-semibold text-gray-800">Course Attempts</h3>
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

              {/* Active Lessons - Only show for current semester */}
              {isCurrentSemester() && (() => {
                const activeLessons = getActiveLessons(takenCourse.code);
                
                if (activeLessons.length === 0) {
                  return (
                    <div className="border-t border-gray-200 pt-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">Active Lessons</h3>
                      <p className="text-gray-500 text-sm">No active lessons found for this course in the current semester.</p>
                    </div>
                  );
                }
                
                return (
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Active Lessons</h3>
                    <div className="space-y-4">
                      {activeLessons.map((lesson, index) => (
                        <div key={lesson.lesson_id} className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="text-sm font-semibold text-blue-800">Lesson {lesson.lesson_id}</h4>
                              <p className="text-xs text-blue-600 mt-1">{lesson.delivery_mode}</p>
                              {lesson.instructor && lesson.instructor !== "-" && (
                                <p className="text-xs text-blue-600 mt-1">Instructor: {lesson.instructor}</p>
                              )}
                            </div>
                          </div>
                          
                          {lesson.sessions && lesson.sessions.length > 0 && (
                            <div className="space-y-2">
                              <h5 className="text-xs font-medium text-blue-700">Sessions:</h5>
                              {lesson.sessions.map((session, sessionIndex) => (
                                <div key={sessionIndex} className="bg-white rounded p-3 border border-blue-100">
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                      <span className="font-medium text-gray-700">Day:</span>
                                      <span className="ml-1 text-gray-600">{session.day}</span>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-700">Time:</span>
                                      <span className="ml-1 text-gray-600">{session.time}</span>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-700">Location:</span>
                                      <span className="ml-1 text-gray-600">{session.location}</span>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-700">Room:</span>
                                      <span className="ml-1 text-gray-600">{session.room !== "--" ? session.room : "Online"}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

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

                const allSatisfied = areAllPrerequisitesSatisfied(prerequisites);
                const isExpanded = getPrereqExpanded(prerequisites);
                
                return (
                  <div className="border-t border-gray-200 pt-6">
                    <button
                      onClick={() => togglePrerequisites(prerequisites)}
                      className="flex items-center justify-between w-full text-left hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors group"
                    >
                      <div className="flex items-center">
                        <h3 className="text-lg font-semibold text-gray-800">Prerequisites</h3>
                        {allSatisfied && <span className="text-green-600 text-sm ml-2">(All Satisfied)</span>}
                      </div>
                      <svg
                        className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    {isExpanded && (
                      <div className="mt-4 space-y-4">
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
                    )}
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
      <div className="fixed inset-0 bg-[#000000DD] flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto mx-4">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-start mb-3">
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
            {electiveViewMode === 'details' && selectedElectiveCourse && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg w-full">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-800">Selected Course</p>
                    <p className="text-sm font-semibold text-blue-700">{selectedElectiveCourseCode}</p>
                    <p className="text-sm text-blue-600">{selectedElectiveCourse}</p>
                  </div>
                  <div className="text-blue-400 ml-4">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-6">
            {electiveViewMode === 'selection' ? (
              /* Selection Mode */
              <div>
                {/* Course Selector */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Available Options</h3>
                  <p className="text-gray-600 mb-4">You haven't taken any courses for this elective yet. Here are the available options:</p>
                  
                  {/* Filter Controls */}
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setElectiveFilter('opened')}
                        className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                          electiveFilter === 'opened'
                            ? 'bg-green-500 text-white border-green-500'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        Opened Courses ({allCourses.filter(code => getActiveLessons(code).length > 0).length})
                      </button>
                      <button
                        onClick={() => setElectiveFilter('all')}
                        className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                          electiveFilter === 'all'
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        All Courses ({allCourses.length})
                      </button>
                    </div>
                  </div>
                  
                  {/* Filtered Courses */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(() => {
                      const filteredCourses = allCourses.filter((courseCode) => {
                        if (electiveFilter === 'all') return true;
                        
                        if (electiveFilter === 'opened') {
                          const activeLessons = getActiveLessons(courseCode);
                          return activeLessons.length > 0;
                        }
                        
                        return true;
                      });

                      if (filteredCourses.length === 0) {
                        return (
                          <div className="col-span-2 text-center py-8">
                            <div className="text-gray-400 mb-2">
                              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                            </div>
                            <p className="text-gray-500 text-sm">
                              No opened courses available in the current semester
                            </p>
                            <button
                              onClick={() => setElectiveFilter('all')}
                              className="mt-2 text-blue-500 text-xs hover:text-blue-600"
                            >
                              Show all courses
                            </button>
                          </div>
                        );
                      }

                      return filteredCourses.map((courseCode) => {
                        const attempts = transcript.filter(item => item.code === courseCode);
                        const latestGrade = attempts.length > 0 ? attempts[attempts.length - 1].grade : '';
                        const courseName = getCourseNameFromData(courseCode) || (attempts.length > 0 ? attempts[0].name : courseCode);
                        const isAssignedToOther = assignedCourses.has(courseCode);
                        
                        // Check if lessons are available for this course
                        const activeLessons = getActiveLessons(courseCode);
                        const hasLessons = activeLessons.length > 0;
                        
                        return (
                          <button
                            key={courseCode}
                            onClick={() => !isAssignedToOther && (setSelectedElectiveCourse(courseName), setSelectedElectiveCourseCode(courseCode), setElectiveViewMode('details'))}
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
                            
                            {/* Lesson availability indicator */}
                            <div className="flex items-center mt-1">
                              <div className={`w-2 h-2 rounded-full mr-1 ${hasLessons ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                              <span className={`text-xs ${hasLessons ? 'text-green-600' : 'text-gray-500'}`}>
                                {hasLessons ? `${activeLessons.length} lesson${activeLessons.length !== 1 ? 's' : ''} available` : 'No lessons'}
                              </span>
                            </div>
                            
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
                      });
                    })()}
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
              </div>
            ) : (
              /* Details Mode - Show unified course content with back button for electives */
              <div>
                {/* Back to Selection Button - Only for elective courses */}
                {isElective && (
                  <div className="mb-6">
                    <button
                      onClick={() => {
                        setElectiveViewMode('selection');
                        setSelectedElectiveCourse('');
                        setSelectedElectiveCourseCode('');
                      }}
                      className="flex items-center text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Back to Select Mode
                    </button>
                  </div>
                )}

                {/* Unified Course Content - Same for both regular and elective courses */}
                {/* Course History */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">Course History</h3>
                    {onAddCourse && selectedSemester && displayCourseCode && (
                      <button
                        onClick={() => onAddCourse(displayCourseCode)}
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
                              {(attempt.grade === "--" || attempt.grade.endsWith('*')) ? (
                                <div className="flex items-center space-x-3">
                                  <select
                                    value={editingGrades[`${attempt.code}-${attempt.semester}`] || (attempt.grade.endsWith('*') ? attempt.grade.replace('*', '') : "--")}
                                    onChange={(e) => handleGradeSelect(attempt.code, attempt.semester, e.target.value)}
                                    className={`px-3 py-2 border rounded-lg text-sm font-medium bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                                      editingGrades[`${attempt.code}-${attempt.semester}`] && editingGrades[`${attempt.code}-${attempt.semester}`] !== "--"
                                        ? `border-green-500 ${getGradeColor(editingGrades[`${attempt.code}-${attempt.semester}`])}`
                                        : 'border-gray-300 hover:border-gray-400'
                                    }`}
                                  >
                                    <option value="--">Select Grade</option>
                                    {availableGrades.map((grade) => (
                                      <option key={grade.value} value={grade.value} className={grade.color}>
                                        {grade.label}
                                      </option>
                                    ))}
                                  </select>
                                  {(() => {
                                    const hasSelectedGrade = editingGrades[`${attempt.code}-${attempt.semester}`] && editingGrades[`${attempt.code}-${attempt.semester}`] !== "--";
                                    const hasAsteriskGrade = attempt.grade.endsWith('*');
                                    const displayGrade = hasAsteriskGrade ? attempt.grade : editingGrades[`${attempt.code}-${attempt.semester}`];
                                    
                                    if (hasSelectedGrade || hasAsteriskGrade) {
                                      return (
                                        <div className="flex flex-col items-center">
                                          <span className={`text-xs font-medium ${getGradeColor(displayGrade)}`}>
                                            {displayGrade}
                                          </span>
                                          <span className="text-xs text-gray-400">Selected</span>
                                        </div>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              ) : (
                                <div className="flex flex-col items-center">
                                  <p className={`text-lg font-bold ${getGradeColor(attempt.grade)}`}>
                                    {attempt.grade || 'In Progress'}
                                  </p>
                                  <span className="text-xs text-gray-400">Final Grade</span>
                                </div>
                              )}
                            </div>
                          </div>
                          {onDeleteAttempt && (attempt.grade === "--" || attempt.grade.endsWith('*')) && (
                            <button
                              onClick={() => onDeleteAttempt(attempt.code, attempt.semester)}
                              className="absolute bottom-2 right-2 text-red-500 hover:text-red-700 text-base font-bold p-1.5 rounded-full hover:bg-red-100 transition-colors"
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

                {/* Active Lessons */}
                {isCurrentSemester() && (() => {
                  const activeLessons = getActiveLessons(displayCourseCode);
                  
                  if (activeLessons.length === 0) {
                    return (
                      <div className="border-t border-gray-200 pt-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Active Lessons</h3>
                        <p className="text-gray-500 text-sm">No active lessons found for this course in the current semester.</p>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="border-t border-gray-200 pt-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">Active Lessons</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-gray-300">
                          <thead>
                            <tr className="bg-gray-700 text-white">
                              <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium">CRN</th>
                              <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium">Ders Kodu</th>
                              <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium">Öğretim Üyesi</th>
                              <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium">Bina</th>
                              <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium">Gün</th>
                              <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium">Saat</th>
                              <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium">Derslik</th>
                              <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium">Kontenjan</th>
                              <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium">Yazılan</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeLessons.map((lesson, index) => (
                              lesson.sessions && lesson.sessions.map((session, sessionIndex) => (
                                <tr key={`${lesson.lesson_id}-${sessionIndex}`} className="bg-white hover:bg-gray-50">
                                  <td className="border border-gray-300 px-3 py-2 text-xs text-gray-700">
                                    {sessionIndex === 0 ? lesson.lesson_id : ''}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-2 text-xs font-medium text-blue-600">
                                    {displayCourseCode}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-2 text-xs text-gray-700">
                                    {getCourseNameFromData(displayCourseCode) || displayCourseName}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-2 text-xs text-gray-700">
                                    {lesson.delivery_mode}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-2 text-xs text-gray-700">
                                    {lesson.instructor && lesson.instructor !== "-" ? lesson.instructor : '-'}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-2 text-xs font-medium text-blue-600">
                                    {session.location}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-2 text-xs text-gray-700">
                                    {session.day}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-2 text-xs text-gray-700">
                                    {session.time}
                                  </td>
                                </tr>
                              ))
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {/* Prerequisites */}
                {(() => {
                  const prerequisites = getPrerequisites(displayCourseCode);
                  if (!prerequisites || prerequisites.length === 0) {
                    return (
                      <div className="border-t border-gray-200 pt-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Prerequisites</h3>
                        <p className="text-gray-500 text-sm">No prerequisites required for this course.</p>
                      </div>
                    );
                  }

                  const allSatisfied = areAllPrerequisitesSatisfied(prerequisites);
                  const isExpanded = getPrereqExpanded(prerequisites);
                  
                  return (
                    <div className="border-t border-gray-200 pt-6">
                      <button
                        onClick={() => togglePrerequisites(prerequisites)}
                        className="flex items-center justify-between w-full text-left hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors group"
                      >
                        <div className="flex items-center">
                          <h3 className="text-lg font-semibold text-gray-800">Prerequisites</h3>
                          {allSatisfied && <span className="text-green-600 text-sm ml-2">(All Satisfied)</span>}
                        </div>
                        <svg
                          className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      {isExpanded && (
                        <div className="mt-4 space-y-4">
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
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
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

  // Unified course logic for both regular and elective courses
  // Filter transcript for this specific course
  const courseHistory = transcript.filter(item => {
    if (item.code !== displayCourseCode) return false;
    
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
    <div className="fixed inset-0 bg-[#000000DD] flex items-center justify-center z-50 p-4">
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
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Course Attempts</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Select grades for planned courses to calculate prerequisite satisfaction and grade probability
                </p>
              </div>
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
                        {(attempt.grade === "--" || attempt.grade.endsWith('*')) ? (
                          <div className="flex items-center space-x-3">
                            <select
                              value={editingGrades[`${attempt.code}-${attempt.semester}`] || (attempt.grade.endsWith('*') ? attempt.grade.replace('*', '') : "--")}
                              onChange={(e) => handleGradeSelect(attempt.code, attempt.semester, e.target.value)}
                              className={`px-3 py-2 border rounded-lg text-sm font-medium bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                                editingGrades[`${attempt.code}-${attempt.semester}`] && editingGrades[`${attempt.code}-${attempt.semester}`] !== "--"
                                  ? `border-green-500 ${getGradeColor(editingGrades[`${attempt.code}-${attempt.semester}`])}`
                                  : 'border-gray-300 hover:border-gray-400'
                              }`}
                            >
                              <option value="--">Select Grade</option>
                              {availableGrades.map((grade) => (
                                <option key={grade.value} value={grade.value} className={grade.color}>
                                  {grade.label}
                                </option>
                              ))}
                            </select>
                            {(() => {
                              const hasSelectedGrade = editingGrades[`${attempt.code}-${attempt.semester}`] && editingGrades[`${attempt.code}-${attempt.semester}`] !== "--";
                              const hasAsteriskGrade = attempt.grade.endsWith('*');
                              const displayGrade = hasAsteriskGrade ? attempt.grade : editingGrades[`${attempt.code}-${attempt.semester}`];
                              
                              if (hasSelectedGrade || hasAsteriskGrade) {
                                return (
                                  <div className="flex flex-col items-center">
                                    <span className={`text-xs font-medium ${getGradeColor(displayGrade)}`}>
                                      {displayGrade}
                                    </span>
                                    <span className="text-xs text-gray-400">Selected</span>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <p className={`text-lg font-bold ${getGradeColor(attempt.grade)}`}>
                              {attempt.grade || 'In Progress'}
                            </p>
                            <span className="text-xs text-gray-400">Final Grade</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {onDeleteAttempt && (attempt.grade === "--" || attempt.grade.endsWith('*')) && (
                      <button
                        onClick={() => onDeleteAttempt(attempt.code, attempt.semester)}
                        className="absolute bottom-2 right-2 text-red-500 hover:text-red-700 text-base font-bold p-1.5 rounded-full hover:bg-red-100 transition-colors"
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

          

          {/* Active Lessons - Only show for current semester */}
          {isCurrentSemester() && (() => {
            const activeLessons = getActiveLessons(displayCourseCode);
            
            if (activeLessons.length === 0) {
              return (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Active Lessons</h3>
                  <p className="text-gray-500 text-sm">No active lessons found for this course in the current semester.</p>
                </div>
              );
            }
            
                            return (
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Active Lessons</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300">
                        <thead>
                          <tr className="bg-gray-700 text-white">
                            <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium">CRN</th>
                            <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium">Öğretim Üyesi</th>
                            <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium">Bina</th>
                            <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium">Gün</th>
                            <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium">Saat</th>
                            <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium">Kontenjan</th>
                            <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium">Yazılan</th>
                            <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeLessons.map((lesson, index) => (
                            lesson.sessions && lesson.sessions.map((session, sessionIndex) => {
                              const isSelected = selectedLessons.length > 0 && 
                                selectedLessons[0].lessonId === lesson.lesson_id && 
                                selectedLessons[0].session.day === session.day && 
                                selectedLessons[0].session.time === session.time;
                              
                              return (
                                <tr key={`${lesson.lesson_id}-${sessionIndex}`} className="bg-white hover:bg-gray-50">
                                  <td className="border border-gray-300 px-3 py-2 text-xs font-medium text-blue-600">
                                    {sessionIndex === 0 ? lesson.lesson_id : ''}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-2 text-xs text-gray-700">
                                    {lesson.instructor && lesson.instructor !== "-" ? lesson.instructor : '-'}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-2 text-xs text-gray-700">
                                    {session.location}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-2 text-xs text-gray-700">
                                    {session.day}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-2 text-xs text-gray-700">
                                    {session.time}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-2 text-xs text-gray-700">
                                    {lesson.capacity}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-2 text-xs text-gray-700">
                                    {lesson.enrolled}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-2 text-xs text-center">
                                    {isSelected ? (
                                      <button
                                        onClick={() => handleLessonDeselect(lesson.lesson_id)}
                                        className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors"
                                      >
                                        Remove
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => handleLessonSelect({
                                          courseCode: displayCourseCode,
                                          lessonId: lesson.lesson_id,
                                          session,
                                          instructor: lesson.instructor,
                                          deliveryMode: lesson.delivery_mode
                                        })}
                                        className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors"
                                      >
                                        Add
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Save Button */}
                    {selectedLessons.length > 0 && (
                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={saveSelectedLessons}
                          className="px-4 py-2 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors"
                        >
                          Save Selected Lesson
                        </button>
                      </div>
                    )}
                  </div>
                );
          })()}

          {/* Prerequisites */}
          {(() => {
            const prerequisites = getPrerequisites(displayCourseCode);
            if (!prerequisites || prerequisites.length === 0) {
              return (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Prerequisites</h3>
                  <p className="text-gray-500 text-sm">No prerequisites required for this course.</p>
                </div>
              );
            }

            const allSatisfied = areAllPrerequisitesSatisfied(prerequisites);
            const isExpanded = getPrereqExpanded(prerequisites);
            
            return (
              <div className="border-t border-gray-200 pt-6">
                <button
                  onClick={() => togglePrerequisites(prerequisites)}
                  className="flex items-center justify-between w-full text-left hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors group"
                >
                  <div className="flex items-center">
                    <h3 className="text-lg font-semibold text-gray-800">Prerequisites</h3>
                    {allSatisfied && <span className="text-green-600 text-sm ml-2">(All Satisfied)</span>}
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                {isExpanded && (
                  <div className="mt-4 space-y-4">
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
                )}
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