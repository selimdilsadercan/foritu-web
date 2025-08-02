'use client';

import { useState } from 'react';
import SemesterGrid from '@/components/SemesterGrid';
import SemesterHistory from '@/components/SemesterHistory';
import planData from '../plan.json';
import transcriptData from '../parsed-transcript.json';
import Link from 'next/link';

// Type assertion for the plan data
const typedPlanData = planData as any;

export default function Home() {
  const [activeTab, setActiveTab] = useState<'curriculum' | 'semesters'>('curriculum');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-800">Foritu Web</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setActiveTab('curriculum')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'curriculum'
                    ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Curriculum
              </button>
              <button
                onClick={() => setActiveTab('semesters')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'semesters'
                    ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Semesters
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      {activeTab === 'curriculum' && <SemesterGrid plan={typedPlanData} transcript={transcriptData} />}
      {activeTab === 'semesters' && <SemesterHistory transcript={transcriptData} />}
    </div>
  );
}
