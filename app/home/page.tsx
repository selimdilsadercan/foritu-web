'use client';

import { useState, useEffect, useMemo } from 'react';
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
  const [courseMappings, setCourseMappings] = useState<Record<string, string[]>>({});
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlanLoading, setIsPlanLoading] = useState(false);
  const [planLoaded, setPlanLoaded] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SemesterItem[][]>([]);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [showResetPlanConfirmation, setShowResetPlanConfirmation] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isResettingPlan, setIsResettingPlan] = useState(false);
  const [lastSavedTranscript, setLastSavedTranscript] = useState<TranscriptItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Load courses data from JSON file and get user's data in correct order
  useEffect(() => {
    const loadCoursesData = async () => {
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
            // Initialize last saved transcript to current state
            setLastSavedTranscript(result.courses);
          } else {
            setTranscript([]); // Use empty array instead of static data
            setLastSavedTranscript([]);
          }
        } catch (error) {
          console.error('Client: Error loading user transcript:', error);
          setTranscript([]); // Use empty array instead of static data
          setLastSavedTranscript([]);
        }
      } else {
        console.log('Client: No user ID available, using empty transcript');
        setTranscript([]);
        setLastSavedTranscript([]);
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

  // Function to add a single course to transcript as a new attempt
  const addCourseToTranscript = (courseCode?: string) => {
    if (!courseCode) {
      console.error('No course code provided for adding to transcript');
      return;
    }

    if (!selectedSemester) {
      console.error('No semester selected for adding course');
      return;
    }

    // Handle courseCode that might contain pipe separator (e.g., "BLG210|BLG210E")
    const codeToUse = courseCode.split('|')[0];
    
    // Don't normalize - keep the space in course code (e.g., "BLG 102")
    const actualCourseCode = codeToUse;
    
    // Get course info from courses.json using the actual course code with space
    const courseInfo = coursesData.find(course => course.code === actualCourseCode);
    
    if (!courseInfo) {
      console.error('Course not found in courses.json:', actualCourseCode);
      alert(`Course ${actualCourseCode} not found in course database`);
      return;
    }
    
    const courseName = courseInfo.name;
    const courseCredits = courseInfo.credits || '3';

    console.log('Course info found:', { courseInfo, courseName, courseCredits });

    // Add the course to transcript as a new attempt
    const newCourse: TranscriptItem = {
      semester: selectedSemester,
      code: actualCourseCode,
      name: courseName,
      credits: courseCredits,
      grade: '--' // Planned grade
    };

    console.log('Adding new course to transcript:', newCourse);
    setTranscript(prev => {
      const updated = [...prev, newCourse];
      console.log('Updated transcript:', updated);
      return updated;
    });
  };

  const deleteAttempt = (courseCode: string, semester: string) => {
    setTranscript(prev => {
      const updated = prev.filter(attempt => 
        !(attempt.code === courseCode && attempt.semester === semester)
      );
      console.log('Deleted attempt:', { courseCode, semester });
      console.log('Updated transcript:', updated);
      return updated;
    });
  };

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
         
                   // Successfully parsed courses - no alert needed
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
     
     const newSemester = `${newStartYear}-${newEndYear} ${newSemesterType} Planı`;
    
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

  // Handle transcript reset
  const handleResetTranscript = async () => {
    if (user?.id) {
      setIsResetting(true);
      try {
        const { DeleteTranscript } = await import('@/lib/actions');
        const result = await DeleteTranscript(user.id);
        if (result.success) {
          console.log('Client: Transcript reset successfully:', result.message);
          // Reload the page to refresh the transcript data
          window.location.reload();
        } else {
          console.error('Client: Failed to reset transcript:', result.error);
          alert('Failed to reset transcript. Please try again.');
        }
      } catch (error) {
        console.error('Client: Error resetting transcript:', error);
        alert('Failed to reset transcript. Please try again.');
      } finally {
        setIsResetting(false);
        setShowResetConfirmation(false);
      }
    }
  };

  // Handle academic plan reset
  const handleResetPlan = async () => {
    if (user?.id) {
      setIsResettingPlan(true);
      try {
        const { DeletePlan } = await import('@/lib/actions');
        const result = await DeletePlan(user.id);
        if (result.success) {
          console.log('Client: Academic plan reset successfully:', result.message);
          // Reload the page to refresh the plan data
          window.location.reload();
        } else {
          console.error('Client: Failed to reset academic plan:', result.error);
          alert('Failed to reset academic plan. Please try again.');
        }
      } catch (error) {
        console.error('Client: Error resetting academic plan:', error);
        alert('Failed to reset academic plan. Please try again.');
      } finally {
        setIsResettingPlan(false);
        setShowResetPlanConfirmation(false);
      }
    }
  };

  // Check if there are unsaved changes by comparing current transcript with last saved
  const hasUnsavedChanges = () => {
    console.log('Checking for unsaved changes...');
    console.log('Current transcript length:', transcript.length);
    console.log('Last saved transcript length:', lastSavedTranscript.length);
    
    if (lastSavedTranscript.length === 0) {
      // If no last saved transcript, consider current state as "saved"
      console.log('No last saved transcript, returning false');
      return false;
    }
    
    // Deep comparison of transcripts
    if (transcript.length !== lastSavedTranscript.length) {
      console.log('Transcript lengths differ, returning true');
      return true;
    }
    
    // Compare each transcript item
    for (let i = 0; i < transcript.length; i++) {
      const current = transcript[i];
      const saved = lastSavedTranscript[i];
      
      if (current.semester !== saved.semester ||
          current.code !== saved.code ||
          current.name !== saved.name ||
          current.credits !== saved.credits ||
          current.grade !== saved.grade) {
        console.log('Found difference at index', i, 'returning true');
        return true;
      }
    }
    
    console.log('No differences found, returning false');
    return false;
  };

  // Handle saving transcript changes
  const handleSaveChanges = async () => {
    if (!user?.id) return;

    setIsSaving(true);
    try {
      console.log('Saving transcript changes...');
      
      // Call the UpdateTranscript action
      const { UpdateTranscript } = await import('@/lib/actions');
      const result = await UpdateTranscript(user.id, transcript);
      
      if (result.success) {
        // Update the last saved transcript to current state
        setLastSavedTranscript([...transcript]);
        console.log('Transcript changes saved successfully:', result.message);
        
        // Show success message
        alert('Changes saved successfully!');
      } else {
        console.error('Failed to save transcript changes:', result.error);
        alert(`Failed to save changes: ${result.error}`);
      }
    } catch (error) {
      console.error('Error saving transcript changes:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle canceling changes - revert to last saved state
  const handleCancelChanges = () => {
    if (window.confirm('Are you sure you want to cancel all changes? This will revert to the last saved state.')) {
      console.log('Canceling changes, reverting to last saved state...');
      setTranscript([...lastSavedTranscript]);
      console.log('Changes canceled, transcript reverted');
    }
  };

  // Test function to simulate changes (temporary for debugging)
  const testAddChange = () => {
    const testCourse: TranscriptItem = {
      semester: 'Test Semester',
      code: 'TEST101',
      name: 'Test Course',
      credits: '3',
      grade: '--'
    };
    setTranscript(prev => [...prev, testCourse]);
    console.log('Added test course, should show save button now');
  };

  // Function to check if a prerequisite is satisfied
  const isPrerequisiteSatisfied = (prereqCode: string, minGrade: string): boolean => {
    const allAvailableCourses = getAllAvailableCourses();
    
    // First check for exact match (with and without spaces)
    let courseHistory = allAvailableCourses.filter((t: TranscriptItem) => t.code === prereqCode);
    
    // If no exact match, also check with spaces removed
    if (courseHistory.length === 0) {
      const prereqCodeNoSpaces = prereqCode.replace(/\s+/g, '');
      courseHistory = allAvailableCourses.filter((t: TranscriptItem) => t.code.replace(/\s+/g, '') === prereqCodeNoSpaces);
    }
    
    // If no exact match, try to find equivalent course using course mappings
    if (courseHistory.length === 0) {
      // Check if the target course has explicit mappings in course-mappings.json
      const alternatives = courseMappings[prereqCode] || [];
      
      // Look for any of the alternative courses in the available courses
      for (const alternativeCode of alternatives) {
        const equivalentMatch = allAvailableCourses.find((t: TranscriptItem) => t.code === alternativeCode);
        if (equivalentMatch) {
          courseHistory = allAvailableCourses.filter((t: TranscriptItem) => t.code === equivalentMatch.code);
          break;
        }
      }
    }
    
    if (courseHistory.length === 0) return false;
    
    // Get the latest attempt for this prerequisite course
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

  // Helper function to get all available courses (transcript + planned) up to selected semester
  const getAllAvailableCourses = () => {
    const availableCourses: TranscriptItem[] = [...filteredTranscript];
    
    // Add planned courses from the selected plan
    if (selectedPlan.length > 0) {
      // Get all courses from the plan that are not already in the transcript
      selectedPlan.forEach((semester: SemesterItem[], semesterIndex: number) => {
        semester.forEach((item: SemesterItem) => {
          if (item.type === 'course') {
            // Check if this course is already in the transcript
            const existingCourse = availableCourses.find(course => course.code === item.code);
            if (!existingCourse) {
              // Get course info from courses.json
              const courseInfo = coursesData.find(course => course.code === item.code);
              if (courseInfo) {
                const plannedCourse: TranscriptItem = {
                  semester: `Semester ${semesterIndex + 1}`,
                  code: item.code,
                  name: courseInfo.name,
                  credits: courseInfo.credits || '3',
                  grade: '--' // Planned grade
                };
                availableCourses.push(plannedCourse);
              }
            }
          } else if (item.type === 'elective') {
            // For electives, add the assigned course if any
            const assignedCourse = getAssignedCourseForElective(item.name);
            if (assignedCourse) {
              const existingCourse = availableCourses.find(course => course.code === assignedCourse.code);
              if (!existingCourse) {
                const plannedCourse: TranscriptItem = {
                  semester: `Semester ${semesterIndex + 1}`,
                  code: assignedCourse.code,
                  name: assignedCourse.name,
                  credits: assignedCourse.credits,
                  grade: '--' // Planned grade
                };
                availableCourses.push(plannedCourse);
              }
            }
          }
        });
      });
    }
    
    return availableCourses;
  };

  // Helper function to get effective grade for a course based on selected semester
  const getEffectiveGrade = (courseCode: string): string => {
    const courseHistory = filteredTranscript.filter((t: TranscriptItem) => t.code === courseCode);
    if (courseHistory.length === 0) return '';
    
    const latestAttempt = courseHistory[courseHistory.length - 1];
    const latestGrade = latestAttempt.grade;
    
    // If the latest grade is not "--", return it as is
    if (latestGrade !== '--') return latestGrade;
    
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
        if (semester.includes('Bahar')) semesterOrder = 2;
        else if (semester.includes('Yaz')) semesterOrder = 3;
        
        return year * 10 + semesterOrder;
      };
      
      const plannedOrder = getSemesterOrder(plannedSemester);
      const selectedOrder = getSemesterOrder(selectedSemester);
      
      // If selected semester is after the planned semester, show as passed with "?"
      if (selectedOrder > plannedOrder) {
        return '?'; // Passed (assumed)
      }
    }
    
    return latestGrade; // Return "--" if still in the same or earlier semester
  };

  const getItemColor = (item: SemesterItem) => {
    if (item.type === 'elective') {
      // For electives, check if there's an assigned course and use its grade for coloring
      const assignedCourse = getAssignedCourseForElective(item.name);
             if (assignedCourse) {
         const courseHistory = filteredTranscript.filter((t: TranscriptItem) => t.code === assignedCourse.code);
         if (courseHistory.length > 0) {
          const effectiveGrade = getEffectiveGrade(assignedCourse.code);
          if (effectiveGrade === '--') {
            return 'bg-blue-500'; // Currently taken
          } else if (effectiveGrade === '?') {
            return 'bg-green-600'; // Passed (assumed)
          } else if (['AA', 'BA', 'BA+', 'BB', 'BB+', 'CB', 'CB+', 'CC', 'CC+', 'DC', 'DC+', 'DD', 'DD+', 'BL'].includes(effectiveGrade)) {
            return 'bg-green-600'; // Passed (including conditional pass)
          } else if (['FD', 'FF', 'VF'].includes(effectiveGrade)) {
            return 'bg-red-400'; // Failed (more subtle)
          }
        }
      }
      return 'bg-purple-500'; // Default for electives with no assigned course
    }
    
         // For courses, check if they have been taken and their grade
     const courseHistory = filteredTranscript.filter((t: TranscriptItem) => t.code === item.code);
     if (courseHistory.length > 0) {
      const effectiveGrade = getEffectiveGrade(item.code);
      if (effectiveGrade === '--') {
        return 'bg-blue-500'; // Currently taken
      } else if (effectiveGrade === '?') {
        return 'bg-green-600'; // Passed (assumed)
      } else if (['AA', 'BA', 'BA+', 'BB', 'BB+', 'CB', 'CB+', 'CC', 'CC+', 'DC', 'DC+', 'DD', 'DD+', 'BL'].includes(effectiveGrade)) {
        return 'bg-green-600'; // Passed (including conditional pass)
      } else if (['FD', 'FF', 'VF'].includes(effectiveGrade)) {
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

  // Helper function to find a course using course mappings and E suffix matching
  const findCourseByMapping = (targetCourseCode: string, planCourseCodes: Set<string>) => {
    // First, check if there's an exact match
    const exactMatch = filteredTranscript.find((t: TranscriptItem) => t.code === targetCourseCode);
    if (exactMatch) return exactMatch;

    // Check course mappings from course-mappings.json
    const mappedCourses = courseMappings[targetCourseCode] || [];
    for (const mappedCourse of mappedCourses) {
      const mappedMatch = filteredTranscript.find((t: TranscriptItem) => 
        t.code === mappedCourse && !planCourseCodes.has(t.code)
      );
      if (mappedMatch) return mappedMatch;
    }

    // Check reverse mappings (if target course is in the mapped courses)
    for (const [mappedCode, alternatives] of Object.entries(courseMappings)) {
      if (alternatives.includes(targetCourseCode)) {
        const reverseMatch = filteredTranscript.find((t: TranscriptItem) => 
          t.code === mappedCode && !planCourseCodes.has(t.code)
        );
        if (reverseMatch) return reverseMatch;
      }
    }

    // Check E suffix matching (e.g., BLG210E matches BLG210 and vice versa)
    const hasE = targetCourseCode.endsWith('E');
    const baseCode = hasE ? targetCourseCode.slice(0, -1) : targetCourseCode;
    const eCode = hasE ? targetCourseCode : targetCourseCode + 'E';
    
    // Try matching with E suffix
    const eMatch = filteredTranscript.find((t: TranscriptItem) => 
      t.code === eCode && !planCourseCodes.has(t.code)
    );
    if (eMatch) return eMatch;

    // Try matching without E suffix
    const baseMatch = filteredTranscript.find((t: TranscriptItem) => 
      t.code === baseCode && !planCourseCodes.has(t.code)
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
      if (lastAttempt.grade) {
        lastAttempts.push(lastAttempt);
      }
    });

    const completedCourses = lastAttempts;

    // Define passing grades
    const passingGrades = ['AA', 'BA+', 'BA', 'BB+', 'BB', 'CB+', 'CB', 'CC+', 'CC', 'DC+', 'DC', 'DD+', 'DD', 'BL'];

    // Helper functions for semester comparison
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
    
    // Filter for passed courses only, including those with "?" effective grade
    const passedCourses = completedCourses.filter(course => {
      // Check if the grade is directly passing
      if (passingGrades.includes(course.grade)) {
        return true;
      }
      
      // Check if the grade is "--" but should be considered as "?" (passed) based on selected semester
      if (course.grade === '--' && selectedSemester && course.semester !== selectedSemester) {
        const plannedOrder = getYear(course.semester) * 10 + getSemesterOrder(course.semester);
        const selectedOrder = getYear(selectedSemester) * 10 + getSemesterOrder(selectedSemester);
        
        
        // If selected semester is after the planned semester, consider it as passed
        if (selectedOrder > plannedOrder) {
          return true;
        } 
        return false;
      }
      
      return false;
    });

    
    // Debug courses that are being converted from "--" to "?" (passed)
    const convertedCourses = completedCourses.filter(course => {
      if (course.grade === '--' && selectedSemester && course.semester !== selectedSemester) {
        const plannedOrder = getYear(course.semester) * 10 + getSemesterOrder(course.semester);
        const selectedOrder = getYear(selectedSemester) * 10 + getSemesterOrder(selectedSemester);
        return selectedOrder > plannedOrder;
      }
      return false;
    });

    // If we're viewing a planned semester, include planned courses from previous semesters
    let totalCredits = passedCourses.reduce((sum, course) => {
      return sum + parseFloat(course.credits || '0');
    }, 0);

    

    // Calculate GPA
    const gradePoints = {
      'AA': 4.0, 'BA+': 3.75, 'BA': 3.5, 'BB+': 3.25, 'BB': 3.0, 
      'CB+': 2.75, 'CB': 2.5, 'CC+': 2.25, 'CC': 2.0, 
      'DC+': 1.75, 'DC': 1.5, 'DD+': 1.25, 'DD': 1.0, 
      'FD': 0.5, 'FF': 0.0, 'VF': 0.0, 'BL': 0.0
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
      completedCourses: passedCourses.length
    };
  };

  const progressMetrics = useMemo(() => calculateProgressMetrics(), [
    transcript, 
    selectedSemester, 
    selectedPlan, 
    coursesData
  ]);

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

      {/* Mobile Header */}
      <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">🐝Foritu</h1>
            <p className="text-xs text-gray-500">Academic Progress Tracker</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {/* Temporary test button */}
          <button
            onClick={testAddChange}
            className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
          >
            Test Change
          </button>
          {user?.imageUrl ? (
            <img 
              src={user.imageUrl} 
              alt="Profile" 
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-sm">
                {user?.firstName?.charAt(0) || user?.emailAddresses[0]?.emailAddress?.charAt(0) || 'U'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content with Left Panel */}
      <div className="flex h-screen lg:h-[calc(100vh-0px)]">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Left Panel */}
        <div className={`
          fixed lg:relative inset-y-0 left-0 z-50 w-80 bg-gray-50 border-r border-gray-200 transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <SemesterPanel
            transcript={transcript}
            plan={selectedPlan}
            onSemesterSelect={handleSemesterSelect}
            selectedSemester={selectedSemester}
            onAddNewSemester={addNewSemester}
            onDeleteLatestSemester={deleteLatestSemester}
            onDeleteSemester={deleteSemester}
            onUploadTranscript={handleTranscriptUpload}
            onClose={() => setSidebarOpen(false)}
            onShowResetConfirmation={() => setShowResetConfirmation(true)}
            onShowResetPlanConfirmation={() => setShowResetPlanConfirmation(true)}
            isResetting={isResetting}
            isResettingPlan={isResettingPlan}
            hasUnsavedChanges={hasUnsavedChanges()}
            onSaveChanges={handleSaveChanges}
            isSaving={isSaving}
            onMarkChangesAsUnsaved={() => {}} // No longer needed since we check differences automatically
          />
        </div>
        
        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto lg:overflow-y-auto">
          {/* Compact Progress Summary */}
          {selectedPlan.length > 0 && (
            <div className="w-full max-w-7xl mx-auto p-4 lg:p-6">
              <div className="bg-white rounded-lg shadow-md p-4 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                  <div className="flex flex-wrap items-center gap-4">
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
              <div className="w-full max-w-7xl mx-auto p-4 lg:p-6">
                                <div className="flex overflow-x-auto xl:overflow-x-visible gap-4 xl:gap-6 pb-4 xl:pb-0">
                  <div className="flex xl:grid xl:grid-cols-8 gap-4 xl:gap-6 min-w-max xl:min-w-0 xl:w-full">
                    {Array.isArray(selectedPlan) && selectedPlan.map((semester: SemesterItem[], semesterIndex: number) => (
                      <div key={semesterIndex} className="space-y-3 w-32 xl:w-auto flex-shrink-0">
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
                              
                              // If no exact match, try to find by course mappings and E suffix
                              const mappedMatch = !exactMatch ? findCourseByMapping(item.code, planCourseCodes) : null;
                              
                              // Determine which course to display
                              const displayCourse = exactMatch || mappedMatch;
                              const isMappedMatch = !exactMatch && mappedMatch;
                              
                              return (
                                <div 
                                  className={`${displayCourse ? getItemColor({ type: 'course', code: displayCourse.code }) : getItemColor(item)} text-white p-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer transform hover:scale-105 relative`}
                                  onClick={() => handleCourseClick(item.code, false, displayCourse?.code, Boolean(isMappedMatch))}
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
                                       const effectiveGrade = getEffectiveGrade(displayCourse.code);
                                       if (effectiveGrade) {
                                         return (
                                           <div className="absolute -top-1 -right-1 bg-white text-gray-800 text-xs font-bold px-1 rounded-full min-w-[20px] text-center">
                                             {effectiveGrade}
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
                                                                         {(() => {
                                       const effectiveGrade = getEffectiveGrade(assignedCourse.code);
                                       if (effectiveGrade) {
                                         return (
                                           <div className="absolute -top-1 -right-1 bg-white text-gray-800 text-xs font-bold px-1 rounded-full min-w-[20px] text-center">
                                             {effectiveGrade}
                                           </div>
                                         );
                                       } else if (hasUnsatisfiedPrerequisites(assignedCourse.code)) {
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
                </div>

                {/* Legend */}
                <div className="mt-8 p-4 lg:p-6 bg-gray-50 rounded-lg shadow-sm">
                <h3 className="text-lg font-semibold mb-4 text-gray-700">Legend</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
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
                    <span className="text-sm text-gray-600">Mapped Course</span>
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
        onAddCourse={(code?: string) => addCourseToTranscript(code)}
        onDeleteAttempt={deleteAttempt}
        selectedSemester={selectedSemester}
      />

      {/* Plan Selection Modal */}
      <PlanSelectionModal
        isOpen={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        onPlanSelect={handlePlanSelect}
        userId={user?.id || ''}
      />

      {/* Reset Transcript Confirmation Modal */}
      {showResetConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Transcript Reset</h3>
            <p className="text-sm text-gray-700 mb-4">
              Are you sure you want to reset your transcript? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-2">
              <button
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-100"
                onClick={() => setShowResetConfirmation(false)}
                disabled={isResetting}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50"
                onClick={handleResetTranscript}
                disabled={isResetting}
              >
                {isResetting ? 'Resetting...' : 'Reset Transcript'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Academic Plan Confirmation Modal */}
      {showResetPlanConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Academic Plan Reset</h3>
            <p className="text-sm text-gray-700 mb-4">
              Are you sure you want to reset your academic plan? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-2">
              <button
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-100"
                onClick={() => setShowResetPlanConfirmation(false)}
                disabled={isResettingPlan}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50"
                onClick={handleResetPlan}
                disabled={isResettingPlan}
              >
                {isResettingPlan ? 'Resetting...' : 'Reset Academic Plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Bar for Unsaved Changes */}
      {hasUnsavedChanges() && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-800 bg-opacity-95 backdrop-blur-sm border-t border-gray-700 z-50">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-white text-sm font-medium">
                  Transcript has unsaved changes
                </span>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="w-px h-6 bg-gray-600"></div>
                <button
                  onClick={handleCancelChanges}
                  disabled={isSaving}
                  className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Cancel Changes</span>
                </button>
                <button
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  {isSaving ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}