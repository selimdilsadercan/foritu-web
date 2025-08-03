'use client';

import { useState, useEffect } from 'react';
import { StorePlan, PlanCourse } from '@/lib/actions';

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

interface Plan {
  name: string;
  semesters: Array<Array<{
    type: 'course' | 'elective';
    code?: string;
    name?: string;
    category?: string;
    options?: string[];
    data?: {
      name: string;
      category: string;
      options: string[];
    };
  }>>;
}

interface Program {
  name: string;
  periods: Array<{
    name: string;
    semesters: Plan['semesters'];
  }>;
}

interface Faculty {
  name: string;
  programs: Program[];
}

interface PlansData {
  faculties: Faculty[];
}

interface PlanSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlanSelect: (plan: SemesterItem[][]) => void;
  userId: string; // Add userId prop for backend operations
}

export default function PlanSelectionModal({ isOpen, onClose, onPlanSelect, userId }: PlanSelectionModalProps) {
  const [plansData, setPlansData] = useState<PlansData | null>(null);
  const [selectedFaculty, setSelectedFaculty] = useState<string>('');
  const [selectedProgram, setSelectedProgram] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isStoring, setIsStoring] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const loadPlansData = async () => {
      try {
        const response = await fetch('/plans.json');
        const data = await response.json();
        setPlansData(data);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading plans data:', error);
        setIsLoading(false);
        setError('Failed to load plans data');
      }
    };

    if (isOpen) {
      loadPlansData();
    }
  }, [isOpen]);

  const handlePlanSelect = async () => {
    if (!plansData || !selectedFaculty || !selectedProgram || !selectedPeriod) {
      return;
    }

    if (!userId) {
      setError('User ID is required to store plan');
      return;
    }

    const faculty = plansData.faculties.find(f => f.name === selectedFaculty);
    if (!faculty) {
      return;
    }

    const program = faculty.programs.find(p => p.name === selectedProgram);
    if (!program) {
      return;
    }

    const period = program.periods.find(per => per.name === selectedPeriod);
    if (!period) {
      return;
    }

    // Ensure period.semesters is an array
    if (!Array.isArray(period.semesters)) {
      return;
    }

    // Transform the plan data to match the expected format
    const transformedPlan: SemesterItem[][] = period.semesters.map((semester) => {
      // Handle case where semester might be an object instead of an array
      if (!Array.isArray(semester)) {
        // If semester is an object, try to extract courses from it
        if (typeof semester === 'object' && semester !== null) {
          const semesterObj = semester as any; // Type assertion for dynamic object
          
          // Check if the object has a 'courses' property
          if (semesterObj.courses && Array.isArray(semesterObj.courses)) {
            return semesterObj.courses.map((item: any) => {
              if (item.type === 'course') {
                return {
                  type: 'course' as const,
                  code: item.code || ''
                } as SemesterItem;
              } else if (item.type === 'elective') {
                return {
                  type: 'elective' as const,
                  name: item.data?.name || item.name || '',
                  category: item.data?.category || item.category || '',
                  options: item.data?.options || item.options || []
                } as SemesterItem;
              }
              return item as SemesterItem;
            });
          }
          
          // If no courses property, try to treat the object itself as a course
          if (semesterObj.type === 'course') {
            return [{
              type: 'course' as const,
              code: semesterObj.code || ''
            } as SemesterItem];
          } else if (semesterObj.type === 'elective') {
            return [{
              type: 'elective' as const,
              name: semesterObj.data?.name || semesterObj.name || '',
              category: semesterObj.data?.category || semesterObj.category || '',
              options: semesterObj.data?.options || semesterObj.options || []
            } as SemesterItem];
          }
        }
        
        // If we can't handle it, return empty array
        return [];
      }
      
      const transformedSemester = semester.map(item => {
        if (item.type === 'course') {
          return {
            type: 'course' as const,
            code: item.code || ''
          } as SemesterItem;
        } else if (item.type === 'elective') {
          return {
            type: 'elective' as const,
            name: item.data?.name || item.name || '',
            category: item.data?.category || item.category || '',
            options: item.data?.options || item.options || []
          } as SemesterItem;
        }
        return item as SemesterItem;
      });
      
      return transformedSemester;
    });

    // Store the plan in the backend
    setIsStoring(true);
    setError('');

    try {
      // Convert SemesterItem[][] to PlanCourse[][] for backend storage
      const planForBackend: PlanCourse[][] = transformedPlan.map(semester => 
        semester.map(item => {
          if (item.type === 'course') {
            return {
              type: 'course',
              code: item.code
            } as PlanCourse;
          } else {
            return {
              type: 'elective',
              name: item.name,
              category: item.category,
              options: item.options
            } as PlanCourse;
          }
        })
      );

      const result = await StorePlan(userId, planForBackend);
      
      if (result.success) {
        // Plan stored successfully, call the callback
        onPlanSelect(transformedPlan);
        onClose();
      } else {
        setError(result.error || 'Failed to store plan');
      }
    } catch (error) {
      console.error('Error storing plan:', error);
      setError('Failed to store plan. Please try again.');
    } finally {
      setIsStoring(false);
    }
  };

  const resetSelections = () => {
    setSelectedFaculty('');
    setSelectedProgram('');
    setSelectedPeriod('');
    setError('');
  };

  const handleClose = () => {
    // Do nothing - modal cannot be closed
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={(e) => e.stopPropagation()}>
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Select Your Academic Plan</h2>
            {/* Remove close button - modal cannot be closed */}
          </div>
          <p className="text-gray-600 mt-2">Choose your faculty, program, and period to view your academic plan</p>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading plans...</span>
            </div>
          ) : plansData ? (
            <div className="space-y-6">
              {/* Error message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}

              {/* Faculty Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Faculty
                </label>
                <select
                  value={selectedFaculty}
                  onChange={(e) => {
                    setSelectedFaculty(e.target.value);
                    setSelectedProgram('');
                    setSelectedPeriod('');
                    setError('');
                  }}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                >
                  <option value="">Select a faculty</option>
                  {plansData.faculties.map((faculty) => (
                    <option key={faculty.name} value={faculty.name}>
                      {faculty.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Program Selection */}
              {selectedFaculty && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Program
                  </label>
                  <select
                    value={selectedProgram}
                    onChange={(e) => {
                      setSelectedProgram(e.target.value);
                      setSelectedPeriod('');
                      setError('');
                    }}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  >
                    <option value="">Select a program</option>
                    {plansData.faculties
                      .find(f => f.name === selectedFaculty)
                      ?.programs.map((program) => (
                        <option key={program.name} value={program.name}>
                          {program.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Period Selection */}
              {selectedProgram && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Period
                  </label>
                  <select
                    value={selectedPeriod}
                    onChange={(e) => {
                      setSelectedPeriod(e.target.value);
                      setError('');
                    }}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  >
                    <option value="">Select a period</option>
                    {plansData.faculties
                      .find(f => f.name === selectedFaculty)
                      ?.programs.find(p => p.name === selectedProgram)
                      ?.periods.map((period) => (
                        <option key={period.name} value={period.name}>
                          {period.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600">Failed to load plans data</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
          {/* Remove Cancel button - modal cannot be closed */}
          <button
            onClick={handlePlanSelect}
            disabled={!selectedFaculty || !selectedProgram || !selectedPeriod || isStoring}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {isStoring ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Storing Plan...
              </>
            ) : (
              'Select Plan'
            )}
          </button>
        </div>
      </div>
    </div>
  );
} 