"use client";

import { useState, useEffect, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import SemesterPanel from "@/components/SemesterPanel";
import CoursePopup from "@/components/CoursePopup";
import PlanSelectionModal from "@/components/PlanSelectionModal";
import LessonCalendar from "@/components/LessonCalendar";
import ProgressStats from "@/components/ProgressStats";
import CourseLegend from "@/components/CourseLegend";
import SemesterGrid from "@/components/SemesterGrid";
import JsonPreview from "@/components/JsonPreview";
import TabNavigation, { TabType } from "@/components/TabNavigation";
import {
  parseTranscriptFromBase64,
  GetTranscript,
  StoreTranscript,
  GetPlan,
} from "@/lib/actions";

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

interface SelectedLesson {
  courseCode: string;
  lessonId: string;
  session: {
    location: string;
    day: string;
    time: string;
    room: string;
  };
  instructor: string;
  deliveryMode: string;
}

interface TranscriptItem {
  semester: string;
  code: string;
  name: string;
  credits: string;
  grade: string;
  lesson_id?: string;
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

export default function Home() {
  const { user } = useUser();
  const [selectedSemester, setSelectedSemester] = useState<string | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [isSelectedElective, setIsSelectedElective] = useState(false);
  const [hasWarningIcon, setHasWarningIcon] = useState(false);
  const [coursesData, setCoursesData] = useState<CourseInfo[]>([]);
  const [courseMappings, setCourseMappings] = useState<
    Record<string, string[]>
  >({});
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlanLoading, setIsPlanLoading] = useState(false);
  const [planLoaded, setPlanLoaded] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SemesterItem[][]>([]);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [showResetPlanConfirmation, setShowResetPlanConfirmation] =
    useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isResettingPlan, setIsResettingPlan] = useState(false);
  const [lastSavedTranscript, setLastSavedTranscript] = useState<
    TranscriptItem[]
  >([]);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("semesters");
  const [selectedLessons, setSelectedLessons] = useState<SelectedLesson[]>([]);

  // Ensure activeTab is valid for current environment
  useEffect(() => {
    if (activeTab === "json" && process.env.NODE_ENV !== "development") {
      setActiveTab("semesters");
    }
  }, [activeTab]);

  // Load courses data from JSON file and get user's data in correct order
  useEffect(() => {
    // Prevent running multiple times if user is still loading
    if (!user && user !== null) {
      return; // Wait for user to be loaded
    }

    const loadCoursesData = async () => {
      try {
        // Load courses data
        const coursesResponse = await fetch("/courses.json");
        const coursesData = await coursesResponse.json();
        setCoursesData(coursesData);

        // Load course mappings
        const mappingsResponse = await fetch("/course-mappings.json");
        const mappingsData = await mappingsResponse.json();
        setCourseMappings(mappingsData);
      } catch (error) {
        console.error("Error loading courses data:", error);
      }
    };

    // Load user's plan from API - FIRST PRIORITY
    const loadUserPlan = async () => {
      setIsPlanLoading(true);
      setPlanLoaded(false);
      if (user?.id) {
        try {
          console.log("Client: Loading user plan first...");
          const result = await GetPlan(user.id);

          if (result.success && result.plan) {
            // Convert PlanCourse[][] back to SemesterItem[][]
            const convertedPlan: SemesterItem[][] = result.plan.map(
              (semester) =>
                semester.map((item) => {
                  if (item.type === "course") {
                    return {
                      type: "course" as const,
                      code: item.code,
                    } as SemesterItem;
                  } else {
                    return {
                      type: "elective" as const,
                      name: item.name || "",
                      category: item.category || "",
                      options: item.options || [],
                    } as SemesterItem;
                  }
                })
            );
            setSelectedPlan(convertedPlan);
            setPlanLoaded(true);
            console.log("Client: Plan loaded successfully");
          } else {
            setSelectedPlan([]); // Use empty array if no plan found
            setPlanLoaded(true);
            console.log("Client: No plan found, using empty plan");
          }
        } catch (error) {
          console.error("Client: Error loading user plan:", error);
          setSelectedPlan([]); // Use empty array on error
          setPlanLoaded(true);
        }
      } else {
        console.log("Client: No user ID available, using empty plan");
        setSelectedPlan([]);
        setPlanLoaded(true);
      }
      setIsPlanLoading(false);
    };

    // Load user's transcript from API - SECOND PRIORITY (after plan is loaded)
    const loadUserTranscript = async () => {
      if (user?.id) {
        try {
          console.log("Client: Loading user transcript after plan...");
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
          console.error("Client: Error loading user transcript:", error);
          setTranscript([]); // Use empty array instead of static data
          setLastSavedTranscript([]);
        }
      } else {
        console.log("Client: No user ID available, using empty transcript");
        setTranscript([]);
        setLastSavedTranscript([]);
      }
    };

    // Execute in the correct order: courses data -> plan -> transcript
    const initializeData = async () => {
      // Set loading state at the very beginning
      setIsLoading(true);

      await loadCoursesData();

      if (user?.id) {
        await loadUserPlan(); // Load plan FIRST
        await loadUserTranscript(); // Then load transcript
      } else {
        // If no user ID, still load courses data but use empty plan and transcript
        setSelectedPlan([]);
        setTranscript([]);
      }

      // Set loading to false only after everything is complete
      setIsLoading(false);
    };

    initializeData();
  }, [user]);

  // Show plan selection modal automatically when no plan is selected and plan loading is complete
  useEffect(() => {
    if (
      selectedPlan.length === 0 &&
      !isLoading &&
      !isPlanLoading &&
      planLoaded
    ) {
      console.log(
        "Client: Showing plan selection modal - no plan found and loading complete"
      );
      setShowPlanModal(true);
    }
  }, [selectedPlan.length, isLoading, isPlanLoading, planLoaded]);

  // Function to add a single course to transcript as a new attempt
  const addCourseToTranscript = (courseCode?: string) => {
    if (!courseCode) {
      console.error("No course code provided for adding to transcript");
      return;
    }

    if (!selectedSemester) {
      console.error("No semester selected for adding course");
      return;
    }

    // Handle courseCode that might contain pipe separator (e.g., "BLG210|BLG210E")
    const codeToUse = courseCode.split("|")[0];

    // Don't normalize - keep the space in course code (e.g., "BLG 102")
    const actualCourseCode = codeToUse;

    // Get course info from courses.json using the actual course code with space
    const courseInfo = coursesData.find(
      (course) => course.code === actualCourseCode
    );

    if (!courseInfo) {
      console.error("Course not found in courses.json:", actualCourseCode);
      alert(`Course ${actualCourseCode} not found in course database`);
      return;
    }

    const courseName = courseInfo.name;
    const courseCredits = courseInfo.credits || "3";

    console.log("Course info found:", {
      courseInfo,
      courseName,
      courseCredits,
    });

    // Add the course to transcript as a new attempt
    const newCourse: TranscriptItem = {
      semester: selectedSemester,
      code: actualCourseCode,
      name: courseName,
      credits: courseCredits,
      grade: "--", // Planned grade
    };

    console.log("Adding new course to transcript:", newCourse);
    setTranscript((prev) => {
      const updated = [...prev, newCourse];
      console.log("Updated transcript:", updated);
      return updated;
    });
  };

  const deleteAttempt = (courseCode: string, semester: string) => {
    setTranscript((prev) => {
      const updated = prev.filter(
        (attempt) =>
          !(attempt.code === courseCode && attempt.semester === semester)
      );
      console.log("Deleted attempt:", { courseCode, semester });
      console.log("Updated transcript:", updated);
      return updated;
    });
  };

  const updateGrade = (
    courseCode: string,
    semester: string,
    newGrade: string
  ) => {
    setTranscript((prev) => {
      const updated = prev.map((attempt) =>
        attempt.code === courseCode && attempt.semester === semester
          ? { ...attempt, grade: newGrade }
          : attempt
      );
      console.log("Updated grade:", { courseCode, semester, newGrade });
      console.log("Updated transcript:", updated);
      return updated;
    });
  };

  const updateSelectedLessons = (
    courseCode: string,
    semester: string,
    lessonId: string | undefined
  ) => {
    setTranscript((prev) => {
      const updated = prev.map((attempt) =>
        attempt.code === courseCode && attempt.semester === semester
          ? {
              ...attempt,
              lesson_id: lessonId,
            }
          : attempt
      );
      console.log("Updated lesson_id:", {
        courseCode,
        semester,
        lesson_id: lessonId,
      });
      console.log("Updated transcript:", updated);
      return updated;
    });
  };

  // Helper function to handle lesson selection
  const handleLessonSelect = (lesson: SelectedLesson) => {
    setSelectedLessons((prev) => [...prev, lesson]);
  };

  // Helper function to handle lesson deselection
  const handleLessonDeselect = (lessonId: string) => {
    setSelectedLessons((prev) =>
      prev.filter((lesson) => lesson.lessonId !== lessonId)
    );
  };

  // Helper function to handle lesson clicks
  const handleLessonClick = (lesson: any) => {
    console.log("Lesson clicked:", lesson);
    // Here you can add logic to show the course popup
    // For example, you could set the selected course and open the popup
    setSelectedCourse(lesson.course_code);
    setPopupOpen(true);
  };

  const handleSemesterSelect = (semesterName: string) => {
    setSelectedSemester(semesterName);
  };

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
        const newCourses: TranscriptItem[] = result.courses.map((course) => ({
          semester: course.semester,
          code: course.code,
          name: course.name,
          credits: course.credits,
          grade: course.grade,
        }));

        const updatedTranscript = [...transcript, ...newCourses];
        setTranscript(updatedTranscript);

        // Store the updated transcript via API
        if (user?.id) {
          try {
            const storeResult = await StoreTranscript(user.id, result.courses);
            if (storeResult.success) {
              console.log(
                "Client: Transcript stored successfully:",
                storeResult.message
              );
            } else {
              console.error(
                "Client: Failed to store transcript:",
                storeResult.error
              );
              alert(
                "Warning: Transcript parsed but failed to save to server. Please try again."
              );
            }
          } catch (error) {
            console.error("Client: Error storing transcript:", error);
            alert(
              "Warning: Transcript parsed but failed to save to server. Please try again."
            );
          }
        }

        // Successfully parsed courses - no alert needed
      } else {
        alert(
          "No courses found in the transcript. Please check if the file contains valid transcript data."
        );
      }
    } catch (error) {
      console.error("Client: Upload error:", error);
      alert("Failed to upload and parse transcript. Please try again.");
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
        const base64Data = base64String.split(",")[1];

        // For UTF-8 encoding, we can also try reading as text first if it's a text file
        if (file.type === "text/plain" || file.name.endsWith(".txt")) {
          const textReader = new FileReader();
          textReader.readAsText(file, "UTF-8");
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
    const existingSemesters = [
      ...new Set(transcript.map((item) => item.semester)),
    ];
    const sortedSemesters = existingSemesters.sort((a, b) => {
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

      const yearA = getYear(a);
      const yearB = getYear(b);

      if (yearA !== yearB) return yearA - yearB;

      return getSemesterOrder(a) - getSemesterOrder(b);
    });

    if (sortedSemesters.length === 0) {
      // If no semesters exist, start with 2024-2025 Güz Dönemi
      const newSemester = "2024-2025 Güz Dönemi";
      // Add a placeholder course to make the semester appear in the list
      const placeholderCourse: TranscriptItem = {
        semester: newSemester,
        code: "PLACEHOLDER",
        name: "Placeholder Course",
        credits: "0",
        grade: "--",
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
    let newSemesterType = "";

    if (latestSemester.includes("Güz")) {
      newSemesterType = "Bahar";
    } else if (latestSemester.includes("Bahar")) {
      newSemesterType = "Yaz";
    } else if (latestSemester.includes("Yaz")) {
      newSemesterType = "Güz";
      newStartYear = startYear + 1;
      newEndYear = endYear + 1;
    }

    const newSemester = `${newStartYear}-${newEndYear} ${newSemesterType} Planı`;

    // Add a placeholder course to make the semester appear in the list
    const placeholderCourse: TranscriptItem = {
      semester: newSemester,
      code: "PLACEHOLDER",
      name: "Placeholder Course",
      credits: "0",
      grade: "--",
    };

    // Update transcript state with the new semester
    const updatedTranscript = [...transcript, placeholderCourse];
    setTranscript(updatedTranscript);
  };

  // Delete latest added semester
  const deleteLatestSemester = () => {
    // Get all existing semesters and sort them chronologically
    const existingSemesters = [
      ...new Set(transcript.map((item) => item.semester)),
    ];
    const sortedSemesters = existingSemesters.sort((a, b) => {
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

      const yearA = getYear(a);
      const yearB = getYear(b);

      if (yearA !== yearB) return yearA - yearB;

      return getSemesterOrder(a) - getSemesterOrder(b);
    });

    if (sortedSemesters.length === 0) return;

    // Get the latest semester
    const latestSemester = sortedSemesters[sortedSemesters.length - 1];

    // Remove all courses from the latest semester
    const updatedTranscript = transcript.filter(
      (item) => item.semester !== latestSemester
    );

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
    const updatedTranscript = transcript.filter(
      (item) => item.semester !== semesterName
    );

    // If the deleted semester was selected, select the previous semester
    if (selectedSemester === semesterName) {
      const existingSemesters = [
        ...new Set(transcript.map((item) => item.semester)),
      ];
      const sortedSemesters = existingSemesters.sort((a, b) => {
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

        const yearA = getYear(a);
        const yearB = getYear(b);

        if (yearA !== yearB) return yearA - yearB;

        return getSemesterOrder(a) - getSemesterOrder(b);
      });

      const currentIndex = sortedSemesters.indexOf(semesterName);
      const previousSemester =
        currentIndex > 0 ? sortedSemesters[currentIndex - 1] : null;
      setSelectedSemester(previousSemester);
    }

    setTranscript(updatedTranscript);
  };

  // Handle transcript reset
  const handleResetTranscript = async () => {
    if (user?.id) {
      setIsResetting(true);
      try {
        const { DeleteTranscript } = await import("@/lib/actions");
        const result = await DeleteTranscript(user.id);
        if (result.success) {
          console.log("Client: Transcript reset successfully:", result.message);
          // Reload the page to refresh the transcript data
          window.location.reload();
        } else {
          console.error("Client: Failed to reset transcript:", result.error);
          alert("Failed to reset transcript. Please try again.");
        }
      } catch (error) {
        console.error("Client: Error resetting transcript:", error);
        alert("Failed to reset transcript. Please try again.");
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
        const { DeletePlan } = await import("@/lib/actions");
        const result = await DeletePlan(user.id);
        if (result.success) {
          console.log(
            "Client: Academic plan reset successfully:",
            result.message
          );
          // Reload the page to refresh the plan data
          window.location.reload();
        } else {
          console.error("Client: Failed to reset academic plan:", result.error);
          alert("Failed to reset academic plan. Please try again.");
        }
      } catch (error) {
        console.error("Client: Error resetting academic plan:", error);
        alert("Failed to reset academic plan. Please try again.");
      } finally {
        setIsResettingPlan(false);
        setShowResetPlanConfirmation(false);
      }
    }
  };

  // Check if there are unsaved changes by comparing current transcript with last saved
  const hasUnsavedChanges = () => {
    if (lastSavedTranscript.length === 0) {
      return false;
    }

    // Deep comparison of transcripts
    if (transcript.length !== lastSavedTranscript.length) {
      return true;
    }

    // Compare each transcript item
    for (let i = 0; i < transcript.length; i++) {
      const current = transcript[i];
      const saved = lastSavedTranscript[i];

      if (
        current.semester !== saved.semester ||
        current.code !== saved.code ||
        current.name !== saved.name ||
        current.credits !== saved.credits ||
        current.grade !== saved.grade ||
        current.lesson_id !== saved.lesson_id
      ) {
        return true;
      }
    }

    return false;
  };

  // Handle saving transcript changes
  const handleSaveChanges = async () => {
    if (!user?.id) return;

    setIsSaving(true);
    try {
      console.log("Saving transcript changes...");
      console.log(
        "Transcript data being sent:",
        transcript.map((t) => ({
          semester: t.semester,
          code: t.code,
          name: t.name,
          credits: t.credits,
          grade: t.grade,
          lesson_id: t.lesson_id,
        }))
      );

      // Call the UpdateTranscript action
      const { UpdateTranscript } = await import("@/lib/actions");
      const result = await UpdateTranscript(user.id, transcript);

      if (result.success) {
        // Update the last saved transcript to current state
        setLastSavedTranscript([...transcript]);
        console.log("Transcript changes saved successfully:", result.message);

        // Calendar will automatically refresh when props change
      } else {
        console.error("Failed to save transcript changes:", result.error);
        alert(`Failed to save changes: ${result.error}`);
      }
    } catch (error) {
      console.error("Error saving transcript changes:", error);
      alert("Failed to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle canceling changes - revert to last saved state
  const handleCancelChanges = () => {
    if (
      window.confirm(
        "Are you sure you want to cancel all changes? This will revert to the last saved state."
      )
    ) {
      console.log("Canceling changes, reverting to last saved state...");
      setTranscript([...lastSavedTranscript]);
      console.log("Changes canceled, transcript reverted");
    }
  };

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

  const filteredTranscript = getTranscriptUpToSelected();

  const handleCourseClick = (
    courseCode: string,
    isElective: boolean = false,
    matchedCourseCode?: string,
    hasWarning: boolean = false
  ) => {
    setSelectedCourse(courseCode);
    setIsSelectedElective(isElective);
    setHasWarningIcon(hasWarning);
    setPopupOpen(true);
    // Store the matched course code for the popup to use
    if (matchedCourseCode) {
      // We'll pass this information to the popup through the courseName parameter
      const matchedCourse = transcript.find(
        (t: TranscriptItem) => t.code === matchedCourseCode
      );
      if (matchedCourse) {
        // This will be used in the popup to show the matched course info
        setSelectedCourse(`${courseCode}|${matchedCourseCode}`);
      }
    }
  };

  const handlePlanSelect = (plan: SemesterItem[][]) => {
    // Ensure plan is a valid array of arrays
    if (!Array.isArray(plan)) {
      console.error("Plan is not an array:", plan);
      console.error("Plan type:", typeof plan);
      return;
    }

    // Validate each semester is an array
    const validPlan = plan.filter((semester) => {
      const isValid = Array.isArray(semester);
      if (!isValid) {
        console.warn("Invalid semester found:", semester);
        console.warn("Semester type:", typeof semester);
      }
      return isValid;
    });

    if (validPlan.length !== plan.length) {
      console.warn("Some semesters were not arrays and were filtered out");
    }

    setSelectedPlan(validPlan);
    setShowPlanModal(false);
  };

  // Helper function to get the actual course name from transcript
  const getCourseNameFromTranscript = (courseCode: string) => {
    const courseHistory = filteredTranscript.filter(
      (t: TranscriptItem) => t.code === courseCode
    );
    if (courseHistory.length > 0) {
      return courseHistory[courseHistory.length - 1].name;
    }
    return undefined;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Loading Indicator */}
      {isLoading && (
        <div className="fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 text-lg font-medium">
              {isPlanLoading
                ? "Loading your academic plan..."
                : "Loading your transcript..."}
            </p>
            <p className="text-gray-500 text-sm mt-2">
              {isPlanLoading
                ? "Please wait while we fetch your academic plan first"
                : "Please wait while we fetch your academic data"}
            </p>
          </div>
        </div>
      )}

      {/* Mobile Header */}
      <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {!isLoading && (
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold text-gray-900">🐝Foritu</h1>
            <p className="text-xs text-gray-500">Academic Progress Tracker</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {user?.imageUrl ? (
            <img
              src={user.imageUrl}
              alt="Profile"
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-sm">
                {user?.firstName?.charAt(0) ||
                  user?.emailAddresses[0]?.emailAddress?.charAt(0) ||
                  "U"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content with Left Panel */}
      <div className="flex h-screen lg:h-[calc(100vh-0px)]">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && !isLoading && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Left Panel - Only show when not loading */}
        {!isLoading && (
          <div
            className={`
            fixed lg:relative inset-y-0 left-0 z-50 w-80 bg-gray-50 border-r border-gray-200 transform transition-transform duration-300 ease-in-out
            ${
              sidebarOpen
                ? "translate-x-0"
                : "-translate-x-full lg:translate-x-0"
            }
          `}
          >
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
              onShowResetPlanConfirmation={() =>
                setShowResetPlanConfirmation(true)
              }
              isResetting={isResetting}
              isResettingPlan={isResettingPlan}
              hasUnsavedChanges={hasUnsavedChanges()}
              onSaveChanges={handleSaveChanges}
              isSaving={isSaving}
              onMarkChangesAsUnsaved={() => {}} // No longer needed since we check differences automatically
            />
          </div>
        )}

        {/* Main Content Area */}
        <div
          className={`overflow-y-auto lg:overflow-y-auto ${
            !isLoading ? "flex-1" : "w-full"
          }`}
        >
          {selectedPlan.length > 0 && selectedSemester ? (
            <>
              {/* Tabs */}
              <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

              {/* Tab Content */}
              <div className="px-4 lg:px-6 max-w-7xl mx-auto mb-8 pt-6">
                {activeTab === "semesters" ? (
                  <>
                    <ProgressStats
                      transcript={transcript}
                      selectedSemester={selectedSemester}
                      selectedPlan={selectedPlan}
                      coursesData={coursesData}
                    />
                    <SemesterGrid
                      selectedPlan={selectedPlan}
                      transcript={transcript}
                      selectedSemester={selectedSemester}
                      coursesData={coursesData}
                      courseMappings={courseMappings}
                      onCourseClick={handleCourseClick}
                    />
                    <CourseLegend />
                  </>
                ) : activeTab === "calendar" ? (
                  <LessonCalendar
                    lessons={[]}
                    selectedLessons={selectedLessons}
                    onLessonSelect={handleLessonSelect}
                    onLessonDeselect={handleLessonDeselect}
                    onLessonClick={handleLessonClick}
                    courseCode=""
                    userCourses={transcript}
                    selectedPlan={selectedPlan}
                  />
                ) : activeTab === "json" &&
                  process.env.NODE_ENV === "development" ? (
                  <JsonPreview data={transcript} title="Transcript JSON Data" />
                ) : null}
              </div>
            </>
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
        onUpdateGrade={updateGrade}
        onUpdateSelectedLessons={updateSelectedLessons}
        selectedSemester={selectedSemester}
      />

      {/* Plan Selection Modal */}
      <PlanSelectionModal
        isOpen={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        onPlanSelect={handlePlanSelect}
        userId={user?.id || ""}
      />

      {/* Reset Transcript Confirmation Modal */}
      {showResetConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Confirm Transcript Reset
            </h3>
            <p className="text-sm text-gray-700 mb-4">
              Are you sure you want to reset your transcript? This action cannot
              be undone.
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
                {isResetting ? "Resetting..." : "Reset Transcript"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Academic Plan Confirmation Modal */}
      {showResetPlanConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Confirm Academic Plan Reset
            </h3>
            <p className="text-sm text-gray-700 mb-4">
              Are you sure you want to reset your academic plan? This action
              cannot be undone.
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
                {isResettingPlan ? "Resetting..." : "Reset Academic Plan"}
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
                  Your academic plan has unsaved changes
                </span>
              </div>

              <div className="flex items-center space-x-3">
                <div className="w-px h-6 bg-gray-600"></div>
                <button
                  onClick={handleCancelChanges}
                  disabled={isSaving}
                  className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
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
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
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
