"use client";

import { useState, useEffect } from "react";

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

interface LessonCalendarProps {
  lessons: Lesson[];
  selectedLessons: SelectedLesson[];
  onLessonSelect: (lesson: SelectedLesson) => void;
  onLessonDeselect: (lessonId: string) => void;
  courseCode: string;
}

export default function LessonCalendar({
  lessons,
  selectedLessons,
  onLessonSelect,
  onLessonDeselect,
  courseCode,
}: LessonCalendarProps) {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  // Generate time slots from 8:30 to 16:00 with 30-minute intervals
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

  // Helper function to check if a lesson session is in a specific time slot
  const isSessionInTimeSlot = (
    session: LessonSession,
    timeSlot: { start: string; end: string }
  ) => {
    // Handle both "-" and "/" separators in time format
    const timeParts = session.time.includes("-")
      ? session.time.split("-")
      : session.time.split("/");
    const sessionStart = timeParts[0].trim();
    const sessionEnd = timeParts[1].trim();

    return sessionStart === timeSlot.start && sessionEnd === timeSlot.end;
  };

  // Helper function to get lessons for a specific day and time slot
  const getLessonsForSlot = (
    day: string,
    timeSlot: { start: string; end: string }
  ) => {
    return lessons.filter((lesson) =>
      lesson.sessions.some(
        (session) =>
          session.day === day && isSessionInTimeSlot(session, timeSlot)
      )
    );
  };

  // Helper function to check if a lesson is selected
  const isLessonSelected = (lessonId: string) => {
    return selectedLessons.some((selected) => selected.lessonId === lessonId);
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
        <div className="bg-gray-25">
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

                return (
                  <div
                    key={day}
                    className={`p-1 border-r border-gray-100 last:border-r-0 min-h-[40px] relative transition-all duration-200 ${
                      isSelected
                        ? "bg-blue-50 border-blue-200 shadow-sm"
                        : hasLessons
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
                        <div className="font-semibold text-blue-900">
                          {selectedLesson.courseCode}
                        </div>
                        <div className="text-blue-700">
                          {selectedLesson.session.location}
                        </div>
                        <div className="text-blue-600">
                          {selectedLesson.session.room !== "--"
                            ? selectedLesson.session.room
                            : "Online"}
                        </div>
                      </div>
                    )}

                    {!isSelected && hasLessons && (
                      <div className="text-xs">
                        <div className="font-medium text-green-800">
                          {lessonsForSlot.length} lesson
                          {lessonsForSlot.length !== 1 ? "s" : ""} available
                        </div>
                        {hoveredCell === `${day}-${timeSlot.start}` && (
                          <div className="absolute z-20 bg-white border border-gray-300 rounded-lg shadow-xl p-3 mt-2 left-full ml-3 min-w-[220px]">
                            <div className="text-xs font-semibold text-gray-900 mb-2">
                              Available Lessons:
                            </div>
                            {lessonsForSlot.map((lesson) => (
                              <div
                                key={lesson.lesson_id}
                                className="text-xs text-gray-700 mb-2 p-2 bg-gray-50 rounded"
                              >
                                <div className="font-medium text-gray-900">
                                  {lesson.lesson_id}
                                </div>
                                <div className="text-gray-600">
                                  {lesson.instructor || "TBA"}
                                </div>
                                <div className="text-gray-500">
                                  {lesson.delivery_mode}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
