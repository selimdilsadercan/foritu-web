'use client';

import { useState } from 'react';
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

interface SemesterGridProps {
  plan: SemesterItem[][];
  transcript?: TranscriptItem[];
}

export default function SemesterGrid({ plan, transcript = [] }: SemesterGridProps) {
  const [popupOpen, setPopupOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [isSelectedElective, setIsSelectedElective] = useState(false);

    const getItemColor = (item: SemesterItem) => {
    if (item.type === 'elective') {
      return 'bg-purple-500'; // All electives use purple (same as not taken)
    }
    
         // For courses, check if they have been taken and their grade
     const courseHistory = transcript.filter(t => t.code === item.code);
     if (courseHistory.length > 0) {
       const latestGrade = courseHistory[courseHistory.length - 1].grade;
               if (['AA', 'BA', 'BB', 'CB', 'CB+', 'CC', 'BL'].includes(latestGrade)) {
          return 'bg-green-600'; // Passed (darker green)
        } else if (['DC', 'DC+', 'DD'].includes(latestGrade)) {
          return 'bg-green-400'; // Conditional pass (lighter green)
        } else if (['FD', 'FF', 'VF'].includes(latestGrade)) {
          return 'bg-red-500'; // Failed
        }
     }
     
    return 'bg-purple-500'; // Default for not taken
  };

  const formatCourseCode = (code: string) => {
    return code.replace(/\s+/g, '');
  };



  const handleCourseClick = (courseCode: string, isElective: boolean = false) => {
    setSelectedCourse(courseCode);
    setIsSelectedElective(isElective);
    setPopupOpen(true);
  };

  // Helper function to get the actual course name from transcript
  const getCourseNameFromTranscript = (courseCode: string) => {
    const courseHistory = transcript.filter(t => t.code === courseCode);
    if (courseHistory.length > 0) {
      return courseHistory[courseHistory.length - 1].name;
    }
    return undefined;
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

  return (
    <div className="w-full max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
        Computer Engineering Curriculum
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-6">
        {plan.map((semester, semesterIndex) => (
          <div key={semesterIndex} className="space-y-3">
            <h2 className="text-lg font-semibold text-center text-gray-700 bg-gray-100 py-2 rounded-lg shadow-sm">
              Semester {semesterIndex + 1}
            </h2>
            
            <div className="space-y-2">
              {semester.map((item, itemIndex) => (
                <div key={itemIndex}>
                  {item.type === 'course' ? (
                    <div 
                      className={`${getItemColor(item)} text-white p-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer transform hover:scale-105 relative`}
                      onClick={() => handleCourseClick(item.code)}
                    >
                      <div className="text-sm font-medium text-center">
                        {formatCourseCode(item.code)}
                      </div>
                      {(() => {
                        const courseHistory = transcript.filter(t => t.code === item.code);
                        if (courseHistory.length > 0) {
                          const latestGrade = courseHistory[courseHistory.length - 1].grade;
                          return (
                            <div className="absolute -top-1 -right-1 bg-white text-gray-800 text-xs font-bold px-1 rounded-full min-w-[20px] text-center">
                              {latestGrade}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
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
                             onClick={() => handleCourseClick(assignedCourse.code)}
                           >
                             <div className="text-xs font-medium text-center">
                               {formatCourseCode(assignedCourse.code)}
                             </div>
                             <div className="text-xs text-center mt-1 opacity-75">
                               ({item.category})
                             </div>
                             {latestGrade && (
                               <div className="absolute -top-1 -right-1 bg-white text-gray-800 text-xs font-bold px-1 rounded-full min-w-[20px] text-center">
                                 {latestGrade}
                               </div>
                             )}
                           </div>
                         );
                                               } else {
                          // Show elective name if no course is assigned
                          return (
                            <div 
                              className={`${getItemColor(item)} text-white p-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer transform hover:scale-105`}
                              onClick={() => handleCourseClick(item.name, true)}
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

      <div className="mt-8 p-6 bg-gray-50 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold mb-4 text-gray-700">Legend</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-5 h-5 bg-purple-500 rounded shadow-sm"></div>
            <span className="text-sm text-gray-600">Not Taken</span>
          </div>
                     <div className="flex items-center space-x-3">
             <div className="w-5 h-5 bg-green-600 rounded shadow-sm"></div>
             <span className="text-sm text-gray-600">Passed</span>
           </div>
           <div className="flex items-center space-x-3">
             <div className="w-5 h-5 bg-green-400 rounded shadow-sm"></div>
             <span className="text-sm text-gray-600">Conditional Pass</span>
           </div>
                     <div className="flex items-center space-x-3">
             <div className="w-5 h-5 bg-red-500 rounded shadow-sm"></div>
             <span className="text-sm text-gray-600">Failed</span>
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
      />
    </div>
  );
} 