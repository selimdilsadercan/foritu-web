'use client';

import { useState, useEffect } from 'react';

interface TranscriptItem {
  semester: string;
  code: string;
  name: string;
  credits: string;
  grade: string;
}

interface SemesterHistoryProps {
  transcript: TranscriptItem[];
}

export default function SemesterHistory({ transcript }: SemesterHistoryProps) {
  const [selectedSemester, setSelectedSemester] = useState<string>('');

  // Get unique semesters and sort them chronologically
  const semesters = Array.from(new Set(transcript.map(item => item.semester)))
    .sort((a, b) => {
      // Sort by year and semester type (Güz, Bahar, Yaz)
      const yearA = parseInt(a.split(' ')[0].split('-')[0]);
      const yearB = parseInt(b.split(' ')[0].split('-')[0]);
      if (yearA !== yearB) return yearB - yearA; // Most recent first
      
      const semesterA = a.includes('Güz') ? 1 : a.includes('Bahar') ? 2 : 3;
      const semesterB = b.includes('Güz') ? 1 : b.includes('Bahar') ? 2 : 3;
      return semesterB - semesterA;
    });

  // Set default selected semester to the most recent one
  useEffect(() => {
    if (!selectedSemester && semesters.length > 0) {
      setSelectedSemester(semesters[0]);
    }
  }, [selectedSemester, semesters]);

  // Filter courses for selected semester
  const semesterCourses = transcript.filter(item => item.semester === selectedSemester);

  const getGradeColor = (grade: string) => {
    if (!grade || grade === '') return 'text-gray-400';
    if (grade === 'AA' || grade === 'BA' || grade === 'BB') return 'text-green-600 font-semibold';
    if (grade === 'CB' || grade === 'CC') return 'text-blue-600 font-semibold';
    if (grade === 'DC' || grade === 'DD') return 'text-yellow-600 font-semibold';
    if (grade === 'FD' || grade === 'FF' || grade === 'VF') return 'text-red-600 font-semibold';
    return 'text-gray-600';
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
        Academic Transcript
      </h1>
      
      {/* Semester Selection */}
      <div className="mb-8">
        <p className="text-gray-600 mb-4 text-center">
          Dönem seçerek ilgili dönemlere ait notlarınızı görüntüleyebilirsiniz.
        </p>
        <div className="max-w-md mx-auto">
          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-800 font-medium"
          >
            {semesters.map((semester) => (
              <option key={semester} value={semester}>
                {semester}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Courses Table */}
      {selectedSemester && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-blue-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-blue-800">
                    CRN
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-blue-800">
                    Ders Kodu
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-blue-800">
                    Ders Adı
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-blue-800">
                    Harf Notu
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {semesterCourses.map((course, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {/* Generate a consistent mock CRN since it's not in the data */}
                      {20000 + index}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-800">
                      {course.code}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-800">
                      {course.name}
                    </td>
                    <td className={`px-6 py-4 text-sm ${getGradeColor(course.grade)}`}>
                      {course.grade || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary Statistics */}
      {selectedSemester && semesterCourses.length > 0 && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Courses</h3>
            <p className="text-3xl font-bold text-blue-600">{semesterCourses.length}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Completed</h3>
            <p className="text-3xl font-bold text-green-600">
              {semesterCourses.filter(course => course.grade && course.grade !== '').length}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">In Progress</h3>
            <p className="text-3xl font-bold text-yellow-600">
              {semesterCourses.filter(course => !course.grade || course.grade === '').length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
} 