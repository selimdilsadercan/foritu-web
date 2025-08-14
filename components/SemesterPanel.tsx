'use client';

import { useState, useEffect } from 'react';
import { useUser, SignOutButton, UserButton } from '@clerk/nextjs';
import { DeleteTranscript, ParseAndStoreTranscript, DeletePlan } from '@/lib/actions';

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
  onClose?: () => void; // Add optional close handler for mobile
  onMarkChangesAsUnsaved?: () => void; // Callback to mark changes as unsaved
  onShowResetConfirmation?: () => void; // Callback to show reset transcript confirmation
  onShowResetPlanConfirmation?: () => void; // Callback to show reset plan confirmation
  isResetting?: boolean; // Whether transcript reset is in progress
  isResettingPlan?: boolean; // Whether plan reset is in progress
  hasUnsavedChanges?: boolean; // Whether there are unsaved changes
  onSaveChanges?: () => void; // Callback to save changes
  isSaving?: boolean; // Whether saving is in progress
}

export default function SemesterPanel({ 
  transcript, 
  plan, 
  onSemesterSelect, 
  selectedSemester,
  onAddNewSemester,
  onDeleteLatestSemester,
  onDeleteSemester,
  onUploadTranscript,
  onClose,
  onMarkChangesAsUnsaved,
  onShowResetConfirmation,
  onShowResetPlanConfirmation,
  isResetting = false,
  isResettingPlan = false,
  hasUnsavedChanges = false,
  onSaveChanges,
  isSaving = false
}: SemesterPanelProps) {
  const { user } = useUser();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Check if transcript is empty (no transcript found)
  const hasTranscript = transcript && transcript.length > 0;

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  // Handle file upload and processing
  const handleUploadAndProcess = async () => {
    if (!selectedFile || !user?.id) return;

    setIsUploading(true);
    try {
      // Convert file to base64
      const base64 = await convertFileToBase64(selectedFile);
      
      // Call the combined parse and store action
      const result = await ParseAndStoreTranscript(user.id, base64);
      
      if (result.success) {
        console.log('Client: Transcript uploaded and processed successfully:', result.message);
        // Reload the page to refresh the transcript data
        window.location.reload();
      } else {
        console.error('Client: Failed to upload and process transcript:', result.error);
        alert(`Failed to upload transcript: ${result.error}`);
      }
    } catch (error) {
      console.error('Client: Error uploading transcript:', error);
      alert('Failed to upload transcript. Please try again.');
    } finally {
      setIsUploading(false);
      setSelectedFile(null);
    }
  };

  // Convert file to base64
  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle transcript reset
  const handleResetTranscript = async () => {
    if (user?.id) {
      try {
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
      }
    }
  };

  // Handle academic plan reset
  const handleResetPlan = async () => {
    if (user?.id) {
      try {
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
      }
    }
  };

  // Function to mark changes as unsaved (call this when user makes changes)
  const markChangesAsUnsaved = () => {
    onMarkChangesAsUnsaved?.();
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showUserMenu && !target.closest('.user-menu-container')) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);
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
      const isPlannedSemesterByName = semester.includes('Planı');
      
      if (!isPlannedSemester && !isPlannedSemesterByName) {
        return semester; // Return the first (most recent) non-planned semester
      }
    }
    
    return null; // If all semesters are planned, return null
  };
  
  const currentSemester = getCurrentSemester();

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
    <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
      {/* Desktop Header */}
      <div className="hidden lg:block p-6 border-b border-gray-200 bg-white">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">🐝Foritu</h1>
        <p className="text-sm text-gray-500">Academic Progress Tracker</p>
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden p-4 border-b border-gray-200 bg-white flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">🐝Foritu</h1>
          <p className="text-xs text-gray-500">Academic Progress Tracker</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-2">
          {/* Plan Next Semester Button */}
          {!hasTranscript && (
            <div className="space-y-3">
              {/* File Upload Button */}
              <div className="text-center px-3 py-2 rounded-lg transition-all duration-200 bg-white hover:bg-gray-50 text-gray-900 border-2 border-dashed border-gray-300 hover:border-blue-300 hover:shadow-sm cursor-pointer">
                <label htmlFor="file-upload" className="flex items-center justify-center cursor-pointer">
                  <svg className="w-4 h-4 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="font-medium text-sm text-gray-900">
                    Upload Transcript
                  </span>
                </label>
                <input
                  id="file-upload"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="hidden text-gray-900"
                />
              </div>

              {/* File Selection Display */}
              {selectedFile && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-2 flex-1 min-w-0">
                      <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-medium text-blue-900 break-all leading-tight">
                          {selectedFile.name}
                        </span>
                        <div className="text-xs text-blue-700 mt-1">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="text-blue-600 hover:text-blue-800 flex-shrink-0 ml-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  {/* Upload Button */}
                  <button
                    onClick={handleUploadAndProcess}
                    disabled={isUploading}
                    className="w-full mt-3 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {isUploading ? (
                      <div className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </div>
                    ) : (
                      'Upload & Process'
                    )}
                  </button>
                </div>
              )}

              {/* Instructions */}
              <div className="text-xs text-gray-500 text-center">
                Upload your transcript PDF to get started
              </div>
            </div>
          )}
          {hasTranscript && (
            <button
              className="w-full text-center px-3 py-2 rounded-lg transition-all duration-200 bg-white hover:bg-gray-50 text-gray-900 border-2 border-dashed border-gray-300 hover:border-blue-300 hover:shadow-sm cursor-pointer"
              onClick={() => {
                onAddNewSemester();
                markChangesAsUnsaved();
              }}
            >
              <div className="flex items-center justify-center">
                <svg className="w-4 h-4 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span className="font-medium text-sm text-gray-900">
                  Plan Next Semester
                </span>
              </div>
            </button>
          )}

          {/* Semester List */}
          {semesters.map((semester, index) => {
            const isSelected = selectedSemester === semester;
            const isCurrentSemester = semester === currentSemester;
            
            // Check if this is a planned semester (has only placeholder course or ends with "Planı")
            const semesterCourses = transcript.filter(item => item.semester === semester);
            const isPlannedSemester = (semesterCourses.length === 1 && semesterCourses[0].code === 'PLACEHOLDER') || semester.includes('Planı');
            
            // Find the latest plan (first planned semester in the sorted list)
            const plannedSemesters = semesters.filter(s => {
              const sCourses = transcript.filter(item => item.semester === s);
              return (sCourses.length === 1 && sCourses[0].code === 'PLACEHOLDER') || s.includes('Planı');
            });
            const isLatestPlan = plannedSemesters.length > 0 && semester === plannedSemesters[0];
            
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
                  onClick={() => {
                    onSemesterSelect(semester);
                    // Close sidebar on mobile when semester is selected
                    if (onClose) {
                      onClose();
                    }
                  }}
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
                {isPlannedSemester && isLatestPlan && (
                  <button
                    className={`absolute top-1/2 right-1 transform -translate-y-1/2 p-1 rounded-full transition-colors ${
                      isSelected 
                        ? 'hover:bg-red-500 hover:bg-opacity-20' 
                        : 'hover:bg-red-100'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Are you sure you want to delete "${formatSemesterName(semester)}"?`)) {
                        onDeleteSemester(semester);
                        markChangesAsUnsaved();
                      }
                    }}
                    title="Delete semester"
                  >
                    <svg className={`w-3 h-3 ${
                      isSelected ? 'text-white' : 'text-red-600'
                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* User Profile at Bottom */}
      <div className="border-t border-gray-200">
        <div className="p-4">
          <div className="relative user-menu-container">
            {/* Clickable User Info */}
            <button
              className="w-full flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              {/* Clerk Avatar */}
              <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200">
                {user?.imageUrl ? (
                  <img 
                    src={user.imageUrl} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-blue-600 flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">
                      {user?.firstName?.charAt(0) || user?.emailAddresses[0]?.emailAddress?.charAt(0) || 'U'}
                    </span>
                  </div>
                )}
              </div>
              
              {/* User Details */}
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.firstName || user?.emailAddresses[0]?.emailAddress || 'User'}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user?.emailAddresses[0]?.emailAddress || 'user@example.com'}
                </p>
              </div>
              
              {/* Dropdown Arrow */}
              <svg 
                className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <div className="py-1">
                  {/* Reset Academic Plan */}
                  <button
                    className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    onClick={() => {
                      setShowUserMenu(false);
                      onShowResetPlanConfirmation?.();
                    }}
                  >
                    <svg className="w-4 h-4 mr-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    Reset Academic Plan
                  </button>

                  {/* Reset My Transcript */}
                  <button
                    className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    onClick={() => {
                      setShowUserMenu(false);
                      onShowResetConfirmation?.();
                    }}
                  >
                    <svg className="w-4 h-4 mr-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Reset Transcript
                  </button>
                  
                  {/* Sign Out */}
                  <SignOutButton>
                    <button
                      className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign Out
                    </button>
                  </SignOutButton>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      



    </div>
  );
} 