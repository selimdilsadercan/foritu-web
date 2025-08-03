'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import SemesterGrid from '@/components/SemesterGrid';
import SemesterPanel from '@/components/SemesterPanel';
import CoursePopup from '@/components/CoursePopup';
import PlanSelectionModal from '@/components/PlanSelectionModal';
import { parseTranscriptFromBase64, GetTranscript, StoreTranscript, GetPlan } from '@/lib/actions';

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

export default function Home() {
  const { user } = useUser();
  const [selectedSemester, setSelectedSemester] = useState<string | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [isSelectedElective, setIsSelectedElective] = useState(false);
  const [hasWarningIcon, setHasWarningIcon] = useState(false);
  const [coursesData, setCoursesData] = useState<CourseInfo[]>([]);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlanLoading, setIsPlanLoading] = useState(false);
  const [planLoaded, setPlanLoaded] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SemesterItem[][]>([]);
  const [showPlanModal, setShowPlanModal] = useState(false);

  // Load courses data from JSON file and get user's data in correct order
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

    // Load user's plan from API - FIRST PRIORITY
    const loadUserPlan = async () => {
      setIsPlanLoading(true);
      setPlanLoaded(false);
      if (user?.id) {
        try {
          console.log('Client: Loading user plan first...');
          const result = await GetPlan(user.id);
          
          if (result.success && result.plan) {
            // Convert PlanCourse[][] back to SemesterItem[][]
            const convertedPlan: SemesterItem[][] = result.plan.map(semester => 
              semester.map(item => {
                if (item.type === 'course') {
                  return {
                    type: 'course' as const,
                    code: item.code
                  } as SemesterItem;
                } else {
                  return {
                    type: 'elective' as const,
                    name: item.name || '',
                    category: item.category || '',
                    options: item.options || []
                  } as SemesterItem;
                }
              })
            );
            setSelectedPlan(convertedPlan);
            setPlanLoaded(true);
            console.log('Client: Plan loaded successfully');
          } else {
            setSelectedPlan([]); // Use empty array if no plan found
            setPlanLoaded(true);
            console.log('Client: No plan found, using empty plan');
          }
        } catch (error) {
          console.error('Client: Error loading user plan:', error);
          setSelectedPlan([]); // Use empty array on error
          setPlanLoaded(true);
        }
      } else {
        console.log('Client: No user ID available, using empty plan');
        setSelectedPlan([]);
        setPlanLoaded(true);
      }
      setIsPlanLoading(false);
    };

    // Load user's transcript from API - SECOND PRIORITY (after plan is loaded)
    const loadUserTranscript = async () => {
      setIsLoading(true);
      if (user?.id) {
        try {
          console.log('Client: Loading user transcript after plan...');
          const result = await GetTranscript(user.id);
          
          if (result.success && result.courses.length > 0) {
            setTranscript(result.courses);
          } else {
            setTranscript([]); // Use empty array instead of static data
          }
        } catch (error) {
          console.error('Client: Error loading user transcript:', error);
          setTranscript([]); // Use empty array instead of static data
        }
      } else {
        console.log('Client: No user ID available, using empty transcript');
        setTranscript([]);
      }
      setIsLoading(false);
    };

    // Execute in the correct order: courses data -> plan -> transcript
    const initializeData = async () => {
      await loadCoursesData();
      
      if (user?.id) {
        await loadUserPlan(); // Load plan FIRST
        await loadUserTranscript(); // Then load transcript
      } else {
        // If no user ID, still load courses data but use empty plan and transcript
        setSelectedPlan([]);
        setTranscript([]);
        setIsLoading(false);
      }
    };

    initializeData();
  }, [user?.id]);

  // Show plan selection modal automatically when no plan is selected and plan loading is complete
  useEffect(() => {
    if (selectedPlan.length === 0 && !isLoading && !isPlanLoading && planLoaded) {
      console.log('Client: Showing plan selection modal - no plan found and loading complete');
      setShowPlanModal(true);
    }
  }, [selectedPlan.length, isLoading, isPlanLoading, planLoaded]);

  const handleSemesterSelect = (semesterName: string) => {
    setSelectedSemester(semesterName);
  };

  // Note: No longer saving to localStorage - transcript is managed via API

  // Handle transcript upload
  const handleTranscriptUpload = async (file: File) => {
    try {
      // Convert file to base64
      const base64 = await convertFileToBase64(file);
      
      // Call server action to parse transcript
      const result = await parseTranscriptFromBase64(base64);
      
      if (result.error) {
        alert(`Error parsing transcript: ${result.error}`);
        return;
      }
      
             if (result.courses.length > 0) {
         // Convert server response courses to local format and add to transcript
         const newCourses: TranscriptItem[] = result.courses.map(course => ({
           semester: course.semester,
           code: course.code,
           name: course.name,
           credits: course.credits,
           grade: course.grade
         }));
         
         const updatedTranscript = [...transcript, ...newCourses];
         setTranscript(updatedTranscript);
         
         // Store the updated transcript via API
         if (user?.id) {
           try {
             const storeResult = await StoreTranscript(user.id, result.courses);
             if (storeResult.success) {
               console.log('Client: Transcript stored successfully:', storeResult.message);
             } else {
               console.error('Client: Failed to store transcript:', storeResult.error);
               alert('Warning: Transcript parsed but failed to save to server. Please try again.');
             }
           } catch (error) {
             console.error('Client: Error storing transcript:', error);
             alert('Warning: Transcript parsed but failed to save to server. Please try again.');
           }
         }
         
         alert(`Successfully parsed ${result.courses.length} courses from transcript!`);
       } else {
        alert('No courses found in the transcript. Please check if the file contains valid transcript data.');
      }
      
    } catch (error) {
      console.error('Client: Upload error:', error);
      alert('Failed to upload and parse transcript. Please try again.');
      throw error;
    }
  };

  // Convert file to base64 with UTF-8 encoding
  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result as string;
        // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
        const base64Data = base64String.split(',')[1];
        
        // For UTF-8 encoding, we can also try reading as text first if it's a text file
        if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
          const textReader = new FileReader();
          textReader.readAsText(file, 'UTF-8');
          textReader.onload = () => {
            const textContent = textReader.result as string;
            const utf8Base64 = btoa(unescape(encodeURIComponent(textContent)));
            resolve(utf8Base64);
          };
          textReader.onerror = (error) => reject(error);
        } else {
          // For binary files like PDF, the base64 is already properly encoded
          resolve(base64Data);
        }
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // Add new semester to transcript
  const addNewSemester = () => {
    // Get all existing semesters and sort them chronologically
    const existingSemesters = [...new Set(transcript.map(item => item.semester))];
    const sortedSemesters = existingSemesters.sort((a, b) => {
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
      
      const yearA = getYear(a);
      const yearB = getYear(b);
      
      if (yearA !== yearB) return yearA - yearB;
      
      return getSemesterOrder(a) - getSemesterOrder(b);
    });

    if (sortedSemesters.length === 0) {
      // If no semesters exist, start with 2024-2025 Güz Dönemi
      const newSemester = '2024-2025 Güz Dönemi';
      // Add a placeholder course to make the semester appear in the list
      const placeholderCourse: TranscriptItem = {
        semester: newSemester,
        code: 'PLACEHOLDER',
        name: 'Placeholder Course',
        credits: '0',
        grade: '--'
      };
             const updatedTranscript = [...transcript, placeholderCourse];
       setTranscript(updatedTranscript);
       return;
    }

    // Get the latest semester
    const latestSemester = sortedSemesters[sortedSemesters.length - 1];
    
    // Extract year and semester type from the latest semester
    const yearMatch = latestSemester.match(/(\d{4})-(\d{4})/);
    if (!yearMatch) return;
    
    const startYear = parseInt(yearMatch[1]);
    const endYear = parseInt(yearMatch[2]);
    
    let newStartYear = startYear;
    let newEndYear = endYear;
    let newSemesterType = '';
    
    if (latestSemester.includes('Güz')) {
      newSemesterType = 'Bahar';
    } else if (latestSemester.includes('Bahar')) {
      newSemesterType = 'Yaz';
    } else if (latestSemester.includes('Yaz')) {
      newSemesterType = 'Güz';
      newStartYear = startYear + 1;
      newEndYear = endYear + 1;
    }
    
    const newSemester = `${newStartYear}-${newEndYear} ${newSemesterType} Dönemi`;
    
    // Add a placeholder course to make the semester appear in the list
    const placeholderCourse: TranscriptItem = {
      semester: newSemester,
      code: 'PLACEHOLDER',
      name: 'Placeholder Course',
      credits: '0',
      grade: '--'
    };
    
         // Update transcript state with the new semester
     const updatedTranscript = [...transcript, placeholderCourse];
     setTranscript(updatedTranscript);
  };

  // Delete latest added semester
  const deleteLatestSemester = () => {
    // Get all existing semesters and sort them chronologically
    const existingSemesters = [...new Set(transcript.map(item => item.semester))];
    const sortedSemesters = existingSemesters.sort((a, b) => {
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
      
      const yearA = getYear(a);
      const yearB = getYear(b);
      
      if (yearA !== yearB) return yearA - yearB;
      
      return getSemesterOrder(a) - getSemesterOrder(b);
    });

    if (sortedSemesters.length === 0) return;

    // Get the latest semester
    const latestSemester = sortedSemesters[sortedSemesters.length - 1];
    
    // Remove all courses from the latest semester
    const updatedTranscript = transcript.filter(item => item.semester !== latestSemester);
    
    // If the deleted semester was selected, select the previous semester
    if (selectedSemester === latestSemester) {
      const previousSemester = sortedSemesters[sortedSemesters.length - 2];
      setSelectedSemester(previousSemester || null);
    }
    
    setTranscript(updatedTranscript);
  };

  // Delete specific semester
  const deleteSemester = (semesterName: string) => {
    // Remove all courses from the specified semester
    const updatedTranscript = transcript.filter(item => item.semester !== semesterName);
    
    // If the deleted semester was selected, select the previous semester
    if (selectedSemester === semesterName) {
      const existingSemesters = [...new Set(transcript.map(item => item.semester))];
      const sortedSemesters = existingSemesters.sort((a, b) => {
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
        
        const yearA = getYear(a);
        const yearB = getYear(b);
        
        if (yearA !== yearB) return yearA - yearB;
        
        return getSemesterOrder(a) - getSemesterOrder(b);
      });
      
      const currentIndex = sortedSemesters.indexOf(semesterName);
      const previousSemester = currentIndex > 0 ? sortedSemesters[currentIndex - 1] : null;
      setSelectedSemester(previousSemester);
    }
    
    setTranscript(updatedTranscript);
  };

  // Function to normalize course codes (remove spaces for comparison)
  const normalizeCourseCode = (code: string): string => {
    return code.replace(/\s+/g, '');
  };

  // Function to check if a prerequisite is satisfied
  const isPrerequisiteSatisfied = (prereqCode: string, minGrade: string): boolean => {
    const normalizedPrereqCode = normalizeCourseCode(prereqCode);
    const courseHistory = filteredTranscript.filter((t: TranscriptItem) => normalizeCourseCode(t.code) === normalizedPrereqCode);
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

  // Function to check if a course has unsatisfied prerequisites
  const hasUnsatisfiedPrerequisites = (courseCode: string): boolean => {
    const prerequisites = getPrerequisites(courseCode);
    if (!prerequisites || prerequisites.length === 0) return false;
    
    // Check if any group is not satisfied
    return prerequisites.some(group => !isPrerequisiteGroupSatisfied(group));
  };

  // Get transcript data up to the selected semester
  const getTranscriptUpToSelected = () => {
    if (!selectedSemester) return [];
    
    // Get all unique semesters from transcript and sort them
    const semesters = [...new Set(transcript.map(item => item.semester))];
    const sortedSemesters = semesters.sort((a, b) => {
      const getYear = (semester: string) => {
        const yearMatch = semester.match(/(\d{4})/);
        return yearMatch ? parseInt(yearMatch[1]) : 0;
      };
      
      const getSemesterOrder = (semester: string) => {
        if (semester.includes('Fall')) return 1;
        if (semester.includes('Spring')) return 2;
        if (semester.includes('Summer')) return 3;
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
    return transcript.filter(item => semestersUpToSelected.includes(item.semester));
  };

  const filteredTranscript = getTranscriptUpToSelected();

  const getItemColor = (item: SemesterItem) => {
    if (item.type === 'elective') {
      // For electives, check if there's an assigned course and use its grade for coloring
      const assignedCourse = getAssignedCourseForElective(item.name);
             if (assignedCourse) {
         const courseHistory = filteredTranscript.filter((t: TranscriptItem) => t.code === assignedCourse.code);
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
     const courseHistory = filteredTranscript.filter((t: TranscriptItem) => t.code === item.code);
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
      const matchedCourse = transcript.find((t: TranscriptItem) => t.code === matchedCourseCode);
      if (matchedCourse) {
        // This will be used in the popup to show the matched course info
        setSelectedCourse(`${courseCode}|${matchedCourseCode}`);
      }
    }
  };

  const handlePlanSelect = (plan: SemesterItem[][]) => {
    // Ensure plan is a valid array of arrays
    if (!Array.isArray(plan)) {
      console.error('Plan is not an array:', plan);
      console.error('Plan type:', typeof plan);
      return;
    }
    
    // Validate each semester is an array
    const validPlan = plan.filter(semester => {
      const isValid = Array.isArray(semester);
      if (!isValid) {
        console.warn('Invalid semester found:', semester);
        console.warn('Semester type:', typeof semester);
      }
      return isValid;
    });
    
    if (validPlan.length !== plan.length) {
      console.warn('Some semesters were not arrays and were filtered out');
    }
    
    setSelectedPlan(validPlan);
    setShowPlanModal(false);
  };

  // Helper function to get the actual course name from transcript
  const getCourseNameFromTranscript = (courseCode: string) => {
    const courseHistory = filteredTranscript.filter((t: TranscriptItem) => t.code === courseCode);
    if (courseHistory.length > 0) {
      return courseHistory[courseHistory.length - 1].name;
    }
    return undefined;
  };

  // Helper function to find a course by number part (e.g., "210" in "BLG210")
  const findCourseByNumber = (targetCourseCode: string, planCourseCodes: Set<string>) => {
    const targetNumber = targetCourseCode.replace(/[A-Z]/g, ''); // Extract number part
    return filteredTranscript.find((t: TranscriptItem) => {
      const courseNumber = t.code.replace(/[A-Z]/g, ''); // Extract number from transcript course
      // Only match if the transcript course is NOT already in the plan
      return courseNumber === targetNumber && !planCourseCodes.has(t.code);
    });
  };

  // Helper function to get assigned course for elective
  const getAssignedCourseForElective = (electiveName: string) => {
    // Find the elective in the plan to get its options
    let electiveOptions: string[] = [];
    for (const semester of selectedPlan) {
      for (const item of semester) {
        if (item.type === 'elective' && item.name === electiveName) {
          electiveOptions = item.options || [];
          break;
        }
      }
      if (electiveOptions.length > 0) break;
    }

    // Get all taken courses that match this elective's options
    const takenCoursesForThisElective = filteredTranscript.filter((item: TranscriptItem) => 
      electiveOptions.includes(item.code)
    );

    if (takenCoursesForThisElective.length === 0) {
      return null; // No courses taken for this elective
    }

    // Create a global assignment map to ensure each course is only assigned once
    const globalAssignmentMap = new Map<string, string>(); // courseCode -> electiveName
    
    // First pass: assign courses to electives that have only one option
    for (const semester of selectedPlan) {
      for (const item of semester) {
        if (item.type === 'elective') {
          const otherElectiveOptions = item.options || [];
          const takenForOtherElective = filteredTranscript.filter((t: TranscriptItem) => otherElectiveOptions.includes(t.code));
          
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
        if (item.type === 'elective') {
          const otherElectiveOptions = item.options || [];
          const takenForOtherElective = filteredTranscript.filter((t: TranscriptItem) => otherElectiveOptions.includes(t.code));
          
          // If this elective has multiple taken courses, find one that's not assigned
          if (takenForOtherElective.length > 1) {
            const availableCourse = takenForOtherElective.find((course: TranscriptItem) => 
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
        return filteredTranscript.find((t: TranscriptItem) => t.code === courseCode) || null;
      }
    }
    
    return null; // No course assigned to this elective
  };

  // Get all course codes from the plan
  const planCourseCodes = new Set<string>();
  selectedPlan.forEach((semester: SemesterItem[]) => {
    semester.forEach((item: SemesterItem) => {
      if (item.type === 'course') {
        planCourseCodes.add(item.code);
      } else if (item.type === 'elective') {
        // Add elective options to the set
        item.options?.forEach((option: string) => planCourseCodes.add(option));
      }
    });
  });

  // Calculate progress metrics
  const calculateProgressMetrics = () => {
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

    completedCourses.forEach((course: TranscriptItem) => {
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
    <div className="min-h-screen bg-gray-50">
      {/* Loading Indicator */}
      {isLoading && (
        <div className="fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 text-lg font-medium">
              {isPlanLoading ? 'Loading your academic plan...' : 'Loading your transcript...'}
            </p>
            <p className="text-gray-500 text-sm mt-2">
              {isPlanLoading 
                ? 'Please wait while we fetch your academic plan first' 
                : 'Please wait while we fetch your academic data'
              }
            </p>
          </div>
        </div>
      )}



      {/* Main Content with Left Panel */}
      <div className="flex h-screen">
          {/* Left Panel */}
          <SemesterPanel
            transcript={transcript}
            plan={selectedPlan}
            onSemesterSelect={handleSemesterSelect}
            selectedSemester={selectedSemester}
            onAddNewSemester={addNewSemester}
            onDeleteLatestSemester={deleteLatestSemester}
            onDeleteSemester={deleteSemester}
            onUploadTranscript={handleTranscriptUpload}
          />
          
          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto">
            {/* Compact Progress Summary */}
            {selectedPlan.length > 0 && (
              <div className="w-full max-w-7xl mx-auto p-6">
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
              </div>
            )}

            {selectedPlan.length > 0 && selectedSemester ? (
              <div className="w-full max-w-7xl mx-auto p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-6">
                  {Array.isArray(selectedPlan) && selectedPlan.map((semester: SemesterItem[], semesterIndex: number) => (
                    <div key={semesterIndex} className="space-y-3">
                      <h2 className="text-lg font-semibold text-center text-gray-700 bg-gray-100 py-2 rounded-lg shadow-sm">
                        Semester {semesterIndex + 1}
                      </h2>
                      
                      <div className="space-y-2">
                        {Array.isArray(semester) && semester.map((item: SemesterItem, itemIndex: number) => (
                          <div key={itemIndex}>
                            {item.type === 'course' ? (
                              (() => {
                                // First check if the exact course code exists in filtered transcript
                                const exactMatch = filteredTranscript.find((t: TranscriptItem) => t.code === item.code);
                                
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
                                        const courseHistory = filteredTranscript.filter((t: TranscriptItem) => t.code === displayCourse.code);
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
                                  const courseHistory = filteredTranscript.filter((t: TranscriptItem) => t.code === assignedCourse.code);
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

                {/* Legend */}
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
              </div>
            ) : selectedPlan.length > 0 ? (
              <SemesterGrid plan={selectedPlan} transcript={transcript} />
            ) : null}
          </div>
        </div>

        {/* Course Popup */}
        <CoursePopup
          isOpen={popupOpen}
          onClose={() => setPopupOpen(false)}
          courseCode={selectedCourse}
          courseName={getCourseNameFromTranscript(selectedCourse)}
          transcript={filteredTranscript}
          isElective={isSelectedElective}
          plan={selectedPlan}
          hasWarningIcon={hasWarningIcon}
        />

        {/* Plan Selection Modal */}
        <PlanSelectionModal
          isOpen={showPlanModal}
          onClose={() => setShowPlanModal(false)}
          onPlanSelect={handlePlanSelect}
          userId={user?.id || ''}
        />

      </div>
    );
  }