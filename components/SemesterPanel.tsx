'use client';

import { useState, useEffect } from 'react';
import UploadTranscriptModal from './UploadTranscriptModal';

interface TranscriptItem {
  semester: string;
  code: string;
  name: string;
  credits: string;
  grade: string;
}

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

interface SemesterPanelProps {
  transcript: TranscriptItem[];
  plan: SemesterItem[][];
  onSemesterSelect: (semesterName: string) => void;
  selectedSemester: string | null;
  onAddNewSemester: () => void;
  onDeleteLatestSemester: () => void;
  onDeleteSemester: (semesterName: string) => void;
  onUploadTranscript: (file: File) => Promise<void>;
}

export default function SemesterPanel({ 
  transcript, 
  plan, 
  onSemesterSelect, 
  selectedSemester,
  onAddNewSemester,
  onDeleteLatestSemester,
  onDeleteSemester,
  onUploadTranscript
}: SemesterPanelProps) {
  // Get unique semesters from transcript, sorted in reverse chronological order
  const getUniqueSemesters = () => {
    const semesters = [...new Set(transcript.map(item => item.semester))];
    
    // Sort semesters in reverse chronological order (newest first)
    return semesters.sort((a, b) => {
      // Extract year and semester type for sorting
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
      
      if (yearA !== yearB) return yearB - yearA; // Reverse year comparison
      
      return getSemesterOrder(b) - getSemesterOrder(a); // Reverse semester order comparison
    });
  };

  const semesters = getUniqueSemesters();
  
  // Determine current semester (last actual semester before plans)
  const getCurrentSemester = () => {
    if (semesters.length === 0) return null;
    
    // Find the last actual semester (not a planned semester)
    for (let i = 0; i < semesters.length; i++) {
      const semester = semesters[i];
      const semesterCourses = transcript.filter(item => item.semester === semester);
      const isPlannedSemester = semesterCourses.length === 1 && semesterCourses[0].code === 'PLACEHOLDER';
      
      if (!isPlannedSemester) {
        return semester; // Return the first (most recent) non-planned semester
      }
    }
    
    return null; // If all semesters are planned, return null
  };
  
  const currentSemester = getCurrentSemester();
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  // Set initial selected semester to the current semester if none is selected
  useEffect(() => {
    if (!selectedSemester && currentSemester) {
      onSemesterSelect(currentSemester);
    }
  }, [selectedSemester, currentSemester, onSemesterSelect]);

  // Get courses for a specific semester
  const getCoursesForSemester = (semesterName: string) => {
    return transcript.filter(item => item.semester === semesterName);
  };

  // Get semester statistics
  const getSemesterStats = (semesterName: string) => {
    const courses = getCoursesForSemester(semesterName);
    const totalCredits = courses.reduce((sum, course) => sum + parseFloat(course.credits || '0'), 0);
    const passedCourses = courses.filter(course => 
      ['AA', 'BA', 'BA+', 'BB', 'BB+', 'CB', 'CB+', 'CC', 'CC+', 'DC', 'DC+', 'DD', 'DD+', 'BL'].includes(course.grade)
    ).length;
    const failedCourses = courses.filter(course => 
      ['FD', 'FF', 'VF'].includes(course.grade)
    ).length;
    const currentCourses = courses.filter(course => course.grade === '--').length;

    return {
      totalCourses: courses.length,
      totalCredits,
      passedCourses,
      failedCourses,
      currentCourses
    };
  };

  // Get grade color
  const getGradeColor = (grade: string) => {
    if (grade === '--') return 'text-blue-600';
    if (['AA', 'BA', 'BA+', 'BB', 'BB+', 'CB', 'CB+', 'CC', 'CC+', 'DC', 'DC+', 'DD', 'DD+', 'BL'].includes(grade)) {
      return 'text-green-600';
    }
    if (['FD', 'FF', 'VF'].includes(grade)) {
      return 'text-red-600';
    }
    return 'text-gray-600';
  };

  return (
    <div className="w-80 bg-gray-50 border-r border-gray-200 overflow-y-auto">
      <div className="p-6 border-b border-gray-200 bg-white">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">🐝Foritu</h1>
        <p className="text-sm text-gray-500">Academic Progress Tracker</p>
      </div>
      
      <div className="p-4 space-y-2">
        {/* Upload Transcript Button */}
        <button
          className="w-full text-center px-3 py-2 rounded-lg transition-all duration-200 bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md cursor-pointer"
          onClick={() => setUploadModalOpen(true)}
        >
          <div className="flex items-center justify-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span className="font-medium text-sm">
              Upload Transcript
            </span>
          </div>
        </button>

        {/* Plan Next Semester Button */}
        <button
          className="w-full text-center px-3 py-2 rounded-lg transition-all duration-200 bg-white hover:bg-gray-50 text-gray-700 border-2 border-dashed border-gray-300 hover:border-blue-300 hover:shadow-sm cursor-pointer"
          onClick={onAddNewSemester}
        >
          <div className="flex items-center justify-center">
            <svg className="w-4 h-4 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span className="font-medium text-sm text-gray-800">
              Plan Next Semester
            </span>
          </div>
        </button>

          
         
                                       {semesters.map((semester, index) => {
               const isSelected = selectedSemester === semester;
               const isCurrentSemester = semester === currentSemester;
               
               // Check if this is a planned semester (has only placeholder course)
               const semesterCourses = transcript.filter(item => item.semester === semester);
               const isPlannedSemester = semesterCourses.length === 1 && semesterCourses[0].code === 'PLACEHOLDER';
               
               // Format semester name for planned semesters
               const formatSemesterName = (semesterName: string) => {
                 if (!isPlannedSemester) return semesterName;
                 
                 if (semesterName.includes('Güz Dönemi')) {
                   return semesterName.replace('Güz Dönemi', 'Güz Planı');
                 } else if (semesterName.includes('Bahar Dönemi')) {
                   return semesterName.replace('Bahar Dönemi', 'Bahar Planı');
                 } else if (semesterName.includes('Yaz Dönemi')) {
                   return semesterName.replace('Yaz Dönemi', 'Yaz Planı');
                 }
                 return semesterName;
               };
               
                               return (
                  <div key={index} className="relative">
                    <button
                      className={`w-full text-left px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer ${
                        isSelected 
                          ? 'bg-blue-600 text-white shadow-lg' 
                          : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 hover:border-blue-300 hover:shadow-sm'
                      }`}
                      onClick={() => onSemesterSelect(semester)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          {isPlannedSemester ? (
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          )}
                          <span className={`font-medium text-sm ${
                            isSelected ? 'text-white' : 'text-gray-800'
                          }`}>
                            {formatSemesterName(semester)}
                          </span>
                        </div>
                        {isCurrentSemester && !isPlannedSemester && (
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            isSelected ? 'bg-white text-blue-600' : 'bg-green-100 text-green-700'
                          }`}>
                            Current
                          </span>
                        )}
                      </div>
                    </button>
                    {isPlannedSemester && (
                      <button
                        className="absolute top-1 right-1 p-1 rounded-full hover:bg-red-100 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Are you sure you want to delete "${formatSemesterName(semester)}"?`)) {
                            onDeleteSemester(semester);
                          }
                        }}
                        title="Delete semester"
                      >
                        <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
                      })}
         </div>
        
        {/* Upload Transcript Modal */}
        <UploadTranscriptModal
          isOpen={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          onUpload={onUploadTranscript}
        />
      </div>
    );
} 