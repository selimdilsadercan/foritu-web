"use client";

import { useState, useEffect } from "react";
import React from "react"; // Added missing import for React

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

interface SelectedLesson {
  courseCode: string;
  lessonId: string;
  session: LessonSession;
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

interface SemesterItem {
  type: "course" | "elective";
  code?: string;
  name?: string;
  category?: string;
  options?: string[];
}

interface LessonCalendarProps {
  lessons: Lesson[];
  selectedLessons: SelectedLesson[];
  onLessonSelect: (lesson: SelectedLesson) => void;
  onLessonDeselect: (lessonId: string) => void;
  courseCode: string;
  userSelectedLessonIds?: string[];
  userCourses?: TranscriptItem[];
  selectedPlan?: SemesterItem[][];
  onLessonClick?: (lesson: Lesson) => void; // Add callback for lesson clicks
}

export default function LessonCalendar({
  lessons,
  selectedLessons,
  onLessonSelect,
  onLessonDeselect,
  courseCode,
  userSelectedLessonIds = [],
  userCourses = [],
  selectedPlan = [],
  onLessonClick,
}: LessonCalendarProps) {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const [lessonsData, setLessonsData] = useState<Lesson[]>([]);
  const [isLessonsDataLoaded, setIsLessonsDataLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load lessons data from public file
  const loadLessonsData = async () => {
    setIsLoading(true);
    try {
      console.log("Calendar: Loading lessons data...");
      const lessonsResponse = await fetch("/lessons.json");
      const lessonsData = await lessonsResponse.json();

      // Handle the structure where lessons are nested under 'lessons' property
      const lessonsArray = Array.isArray(lessonsData)
        ? lessonsData
        : lessonsData.lessons;

      if (Array.isArray(lessonsArray)) {
        setLessonsData(lessonsArray);
        setIsLessonsDataLoaded(true);
        console.log(
          "Calendar: Lessons data loaded successfully, count:",
          lessonsArray.length
        );
      } else {
        console.error(
          "Calendar: lessons.json does not contain a lessons array:",
          lessonsData
        );
        console.log("Calendar: lessons.json structure:", typeof lessonsData);
        setLessonsData([]);
        setIsLessonsDataLoaded(false);
      }
    } catch (error) {
      console.error("Calendar: Error loading lessons data:", error);
      setLessonsData([]);
      setIsLessonsDataLoaded(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Load lessons data on component mount
  useEffect(() => {
    loadLessonsData();
  }, []);

  // Function to get selected lesson IDs from current plan and user courses
  const getSelectedLessonIds = () => {
    const selectedLessonIds: string[] = [];

    // Get lesson IDs from user courses (transcript)
    userCourses.forEach((course) => {
      if (course.lesson_id) {
        selectedLessonIds.push(course.lesson_id);
        console.log(
          `Calendar: Course ${course.code} has lesson_id: ${course.lesson_id}`
        );
      }
    });

    // Get lesson IDs from current plan (if any courses have selected lessons)
    selectedPlan.forEach((semester) => {
      semester.forEach((item) => {
        if (item.type === "course") {
          // Find the course in user courses to get its lesson_id
          const courseInTranscript = userCourses.find(
            (course) => course.code === item.code
          );
          if (courseInTranscript?.lesson_id) {
            selectedLessonIds.push(courseInTranscript.lesson_id);
          }
        }
      });
    });

    console.log("Calendar: Selected lesson IDs:", selectedLessonIds);
    return selectedLessonIds;
  };

  // Function to get filtered lessons for calendar display
  const getFilteredLessonsForCalendar = () => {
    const selectedLessonIds = getSelectedLessonIds();

    if (selectedLessonIds.length === 0) {
      return [];
    }

    // Ensure lessonsData is an array before filtering
    if (!Array.isArray(lessonsData)) {
      console.error("Calendar: lessonsData is not an array:", lessonsData);
      console.log("Calendar: lessonsData type:", typeof lessonsData);
      return [];
    }

    console.log("Calendar: Total lessons available:", lessonsData.length);
    console.log("Calendar: Sample lesson structure:", lessonsData[0]);

    // Show all available lesson IDs for debugging
    const availableLessonIds = lessonsData
      .map((lesson) => lesson.lesson_id)
      .slice(0, 10); // Show first 10
    console.log(
      "Calendar: Available lesson IDs (first 10):",
      availableLessonIds
    );

    // Check if specific lesson IDs from transcript exist in lessons data
    selectedLessonIds.forEach((lessonId) => {
      const exists = lessonsData.some(
        (lesson) => lesson.lesson_id === lessonId
      );
      console.log(
        `Calendar: Lesson ID ${lessonId} exists in lessons data:`,
        exists
      );

      // If lesson exists, show its session details
      if (exists) {
        const lesson = lessonsData.find((l) => l.lesson_id === lessonId);
        console.log(`Calendar: Lesson ${lessonId} sessions:`, lesson?.sessions);

        // Show day names from sessions
        lesson?.sessions.forEach((session, index) => {
          console.log(
            `Calendar: Session ${index} day: "${session.day}", time: "${session.time}"`
          );
        });
      }
    });

    // Filter lessons data to only include selected lessons
    const filteredLessons = lessonsData.filter((lesson) =>
      selectedLessonIds.includes(lesson.lesson_id)
    );

    console.log("Calendar: Filtered lessons count:", filteredLessons.length);
    console.log("Calendar: Filtered lessons:", filteredLessons);

    return filteredLessons;
  };

  // Generate time slots from 8:30 to 18:00 with 30-minute intervals
  const generateTimeSlots = () => {
    const slots = [];
    const startHour = 8;
    const startMinute = 30;
    const endHour = 16;
    const endMinute = 0;

    for (let hour = startHour; hour <= endHour; hour++) {
      for (let minute of [0, 30]) {
        if (hour === startHour && minute < startMinute) continue;
        if (hour === endHour && minute > endMinute) continue;

        const timeString = `${hour.toString().padStart(2, "0")}:${minute
          .toString()
          .padStart(2, "0")}`;
        const nextMinute = minute === 30 ? 0 : 30;
        const nextHour = minute === 30 ? hour + 1 : hour;
        const nextTimeString = `${nextHour
          .toString()
          .padStart(2, "0")}:${nextMinute.toString().padStart(2, "0")}`;

        slots.push({
          start: timeString,
          end: nextTimeString,
          display: `${timeString}-${nextTimeString}`,
        });
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  // Map Turkish day names to English
  const dayNameMap: { [key: string]: string } = {
    Pazartesi: "Monday",
    Salı: "Tuesday",
    Çarşamba: "Wednesday",
    Perşembe: "Thursday",
    Cuma: "Friday",
    Cumartesi: "Saturday",
    Pazar: "Sunday",
  };

  // Helper function to check if a lesson session is in a specific time slot
  const isSessionInTimeSlot = (
    session: LessonSession,
    timeSlot: { start: string; end: string }
  ) => {
    console.log(
      `Calendar: Checking time match - session time: "${session.time}", timeSlot: ${timeSlot.start}-${timeSlot.end}`
    );

    // Handle both "-" and "/" separators in time format
    const timeParts = session.time.includes("-")
      ? session.time.split("-")
      : session.time.split("/");

    if (timeParts.length !== 2) {
      console.log(`Calendar: Invalid time format: ${session.time}`);
      return false;
    }

    const sessionStart = timeParts[0].trim();
    const sessionEnd = timeParts[1].trim();

    console.log(
      `Calendar: Parsed session time - start: "${sessionStart}", end: "${sessionEnd}"`
    );
    console.log(
      `Calendar: TimeSlot - start: "${timeSlot.start}", end: "${timeSlot.end}"`
    );

    // Convert times to minutes for easier comparison
    const timeToMinutes = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(":").map(Number);
      return hours * 60 + minutes;
    };

    const sessionStartMinutes = timeToMinutes(sessionStart);
    const sessionEndMinutes = timeToMinutes(sessionEnd);
    const slotStartMinutes = timeToMinutes(timeSlot.start);
    const slotEndMinutes = timeToMinutes(timeSlot.end);

    // Check if the session overlaps with the time slot
    // A session overlaps if it starts before the slot ends AND ends after the slot starts
    const overlap =
      sessionStartMinutes < slotEndMinutes &&
      sessionEndMinutes > slotStartMinutes;

    console.log(
      `Calendar: Time overlap result: ${overlap} (session: ${sessionStartMinutes}-${sessionEndMinutes}, slot: ${slotStartMinutes}-${slotEndMinutes})`
    );

    return overlap;
  };

  // Helper function to check if a lesson session starts in this time slot
  const isSessionStartingInTimeSlot = (
    session: LessonSession,
    timeSlot: { start: string; end: string }
  ) => {
    console.log(
      `Calendar: Checking if session starts in time slot - session time: "${session.time}", timeSlot: ${timeSlot.start}-${timeSlot.end}`
    );

    // Handle both "-" and "/" separators in time format
    const timeParts = session.time.includes("-")
      ? session.time.split("-")
      : session.time.split("/");

    if (timeParts.length !== 2) {
      console.log(`Calendar: Invalid time format: ${session.time}`);
      return false;
    }

    const sessionStart = timeParts[0].trim();

    console.log(
      `Calendar: Session start time: "${sessionStart}", timeSlot start: "${timeSlot.start}"`
    );

    // Check if the session starts exactly at this time slot
    const startsInSlot = sessionStart === timeSlot.start;

    console.log(`Calendar: Session starts in this slot: ${startsInSlot}`);

    return startsInSlot;
  };

  // Helper function to get lessons for a specific day and time slot
  const getLessonsForSlot = (
    day: string,
    timeSlot: { start: string; end: string }
  ) => {
    const filteredLessons = getFilteredLessonsForCalendar();
    console.log(
      `Calendar: Checking for lessons on ${day} at ${timeSlot.start}-${timeSlot.end}`
    );
    console.log(`Calendar: Filtered lessons count: ${filteredLessons.length}`);

    const lessonsForSlot = filteredLessons.filter((lesson) => {
      const hasSession = lesson.sessions.some((session) => {
        // Map Turkish day name to English
        const mappedDay = dayNameMap[session.day] || session.day;
        const dayMatch = mappedDay === day;
        const startsInSlot = isSessionStartingInTimeSlot(session, timeSlot);
        console.log(
          `Calendar: Lesson ${lesson.lesson_id} session: day="${session.day}" -> "${mappedDay}" (${dayMatch}), starts in slot: ${startsInSlot}`
        );
        return dayMatch && startsInSlot;
      });
      return hasSession;
    });

    console.log(
      `Calendar: Found ${lessonsForSlot.length} lessons starting in ${day} at ${timeSlot.start}-${timeSlot.end}`
    );
    return lessonsForSlot;
  };

  // Helper function to calculate how many time slots a lesson spans
  const getLessonSpan = (session: LessonSession) => {
    const timeParts = session.time.includes("-")
      ? session.time.split("-")
      : session.time.split("/");

    if (timeParts.length !== 2) return 1;

    const sessionStart = timeParts[0].trim();
    const sessionEnd = timeParts[1].trim();

    // Convert times to minutes
    const timeToMinutes = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(":").map(Number);
      return hours * 60 + minutes;
    };

    const startMinutes = timeToMinutes(sessionStart);
    const endMinutes = timeToMinutes(sessionEnd);
    const durationMinutes = endMinutes - startMinutes;

    // Calculate how many 30-minute slots this spans
    const span = Math.ceil(durationMinutes / 30);

    console.log(
      `Calendar: Lesson duration: ${durationMinutes} minutes, spans ${span} slots`
    );
    return Math.max(1, span);
  };

  // Helper function to check if a lesson is selected
  const isLessonSelected = (lessonId: string) => {
    return (
      selectedLessons.some((selected) => selected.lessonId === lessonId) ||
      userSelectedLessonIds.includes(lessonId)
    );
  };

  // Helper function to get selected lesson for a slot
  const getSelectedLessonForSlot = (
    day: string,
    timeSlot: { start: string; end: string }
  ) => {
    return selectedLessons.find(
      (selected) =>
        selected.session.day === day &&
        isSessionInTimeSlot(selected.session, timeSlot)
    );
  };

  // Helper function to handle cell click
  const handleCellClick = (
    day: string,
    timeSlot: { start: string; end: string }
  ) => {
    const lessonsForSlot = getLessonsForSlot(day, timeSlot);

    if (lessonsForSlot.length === 0) return;

    // If there's only one lesson, select/deselect it
    if (lessonsForSlot.length === 1) {
      const lesson = lessonsForSlot[0];
      const session = lesson.sessions.find(
        (s) => s.day === day && isSessionInTimeSlot(s, timeSlot)
      )!;

      if (isLessonSelected(lesson.lesson_id)) {
        onLessonDeselect(lesson.lesson_id);
      } else {
        onLessonSelect({
          courseCode,
          lessonId: lesson.lesson_id,
          session,
          instructor: lesson.instructor,
          deliveryMode: lesson.delivery_mode,
        });
      }
    } else {
      // If there are multiple lessons, show a selection modal or handle differently
      // For now, just select the first one
      const lesson = lessonsForSlot[0];
      const session = lesson.sessions.find(
        (s) => s.day === day && isSessionInTimeSlot(s, timeSlot)
      )!;

      if (!isLessonSelected(lesson.lesson_id)) {
        onLessonSelect({
          courseCode,
          lessonId: lesson.lesson_id,
          session,
          instructor: lesson.instructor,
          deliveryMode: lesson.delivery_mode,
        });
      }
    }
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading lessons data...</p>
        </div>
      </div>
    );
  }

  // Render empty state when no lessons data is loaded
  if (!isLessonsDataLoaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <svg
            className="w-16 h-16 text-gray-300 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Lessons Selected
          </h3>
          <p className="text-gray-600 mb-4">
            Select lessons for your courses to see them on the calendar.
          </p>
          <div className="bg-blue-50 rounded-lg p-4 max-w-md mx-auto">
            <h4 className="font-medium text-blue-900 mb-2">
              How to add lessons:
            </h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Go to the Semesters tab</li>
              <li>• Click on a course to open the course popup</li>
              <li>• Select a lesson from the available options</li>
              <li>• Your selected lessons will appear here</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Render empty state when no filtered lessons
  if (getFilteredLessonsForCalendar().length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <svg
            className="w-16 h-16 text-gray-300 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Lessons Selected
          </h3>
          <p className="text-gray-600 mb-4">
            Select lessons for your courses to see them on the calendar.
          </p>
          <div className="bg-blue-50 rounded-lg p-4 max-w-md mx-auto">
            <h4 className="font-medium text-blue-900 mb-2">
              How to add lessons:
            </h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Go to the Semesters tab</li>
              <li>• Click on a course to open the course popup</li>
              <li>• Select a lesson from the available options</li>
              <li>• Your selected lessons will appear here</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Calendar Container */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-lg">
        {/* Calendar Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white">
          <div className="grid grid-cols-6 border-b border-green-500">
            <div className="p-2 text-xs font-semibold text-center">Hours</div>
            {days.map((day) => (
              <div
                key={day}
                className="p-2 text-xs font-semibold text-center border-l border-green-500"
              >
                {day}
              </div>
            ))}
          </div>
        </div>

        {/* Calendar Body */}
        <div className="bg-gray-25 relative">
          {timeSlots.map((timeSlot, timeIndex) => (
            <div
              key={timeIndex}
              className="grid grid-cols-6 border-b border-gray-100 last:border-b-0"
            >
              {/* Time Slot Header */}
              <div className="p-1 text-xs font-medium text-gray-700 bg-gray-100 border-r border-gray-200 flex items-center justify-center">
                {timeSlot.display}
              </div>

              {/* Day Cells */}
              {days.map((day) => {
                const lessonsForSlot = getLessonsForSlot(day, timeSlot);
                const selectedLesson = getSelectedLessonForSlot(day, timeSlot);
                const hasLessons = lessonsForSlot.length > 0;
                const isSelected = selectedLesson !== undefined;

                // Check if this cell has a spanning lesson (long lesson)
                const hasSpanningLesson = lessonsForSlot.some((lesson) => {
                  const session = lesson.sessions.find((s) => {
                    const mappedDay = dayNameMap[s.day] || s.day;
                    return (
                      mappedDay === day &&
                      isSessionStartingInTimeSlot(s, timeSlot)
                    );
                  });
                  return session && getLessonSpan(session) > 1;
                });

                // Debug logging for cell state
                if (hasLessons) {
                  console.log(
                    `Calendar: Cell ${day} ${timeSlot.start}-${timeSlot.end} has ${lessonsForSlot.length} lessons`
                  );
                }

                return (
                  <div
                    key={day}
                    className={`p-1 border-r border-gray-100 last:border-r-0 min-h-[40px] relative transition-all duration-200 ${
                      isSelected
                        ? "bg-blue-50 border-blue-200 shadow-sm"
                        : hasLessons && !hasSpanningLesson
                        ? "bg-green-50 border-green-200"
                        : ""
                    }`}
                    onClick={() => handleCellClick(day, timeSlot)}
                    onMouseEnter={() =>
                      setHoveredCell(`${day}-${timeSlot.start}`)
                    }
                    onMouseLeave={() => setHoveredCell(null)}
                  >
                    {isSelected && (
                      <div className="text-xs space-y-0.5">
                        <div className="font-bold text-blue-900 text-[11px] leading-tight">
                          {selectedLesson.lessonId}
                        </div>
                        <div className="text-blue-800 text-[11px] leading-tight font-semibold">
                          {selectedLesson.courseCode ||
                            lessonsData.find(
                              (l) => l.lesson_id === selectedLesson.lessonId
                            )?.course_code ||
                            "Unknown Course"}
                        </div>
                        <div className="text-blue-700 text-[10px] leading-tight">
                          {selectedLesson.instructor || "TBA"}
                        </div>
                        <div className="text-blue-600 text-[10px] leading-tight font-medium">
                          {selectedLesson.session.time}
                        </div>
                        <div className="text-blue-500 text-[10px] leading-tight">
                          {selectedLesson.session.room !== "--"
                            ? selectedLesson.session.room
                            : "Online"}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Overlay for spanning lesson cards */}
          {getFilteredLessonsForCalendar().map((lesson) => {
            const session = lesson.sessions[0]; // Get the first session
            if (!session) return null;

            const mappedDay = dayNameMap[session.day] || session.day;
            const dayIndex = days.indexOf(mappedDay);
            if (dayIndex === -1) return null;

            // Find the time slot where this lesson starts
            const startTimeSlot = timeSlots.find((slot) =>
              isSessionStartingInTimeSlot(session, slot)
            );
            if (!startTimeSlot) return null;

            const startTimeIndex = timeSlots.indexOf(startTimeSlot);
            const span = getLessonSpan(session);
            const isLongLesson = span > 1;

            if (!isLongLesson) return null;

            // Calculate position
            const top = startTimeIndex * 40 + 10; // 40px per time slot
            const left = (dayIndex + 1) * (100 / 6) + 1; // +1 for time column, 6 columns total, +2 for margin
            const height = span * 40 - 4; // 40px per slot minus padding

            return (
              <div
                key={lesson.lesson_id}
                className="absolute bg-green-100 rounded border border-green-200 p-1 z-10 cursor-pointer hover:bg-green-200"
                style={{
                  top: `${top}px`,
                  left: `${left}%`,
                  width: `${100 / 6 - 2}%`,
                  height: `${height}px`,
                }}
                onClick={() => {
                  if (onLessonClick) {
                    onLessonClick(lesson);
                  }
                }}
              >
                <div className="text-xs">
                  <div className="font-bold text-green-900 text-[11px] leading-tight mb-0.5">
                    {lesson.lesson_id}
                  </div>
                  <div className="text-green-800 text-[11px] leading-tight font-semibold mb-0.5">
                    {lesson.course_code}
                  </div>
                  <div className="text-green-700 text-[10px] leading-tight mb-0.5">
                    {lesson.instructor || "TBA"}
                  </div>
                  <div className="text-green-600 text-[10px] leading-tight font-medium">
                    {session.time}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
