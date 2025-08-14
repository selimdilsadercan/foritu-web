"use client";

export default function CourseLegend() {
  return (
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
          <div className="w-5 h-5 bg-yellow-500 rounded shadow-sm flex items-center justify-center text-xs">
            🔒
          </div>
          <span className="text-sm text-gray-600">Prerequisites Not Met</span>
        </div>
        <div className="flex items-center space-x-3">
          <div className="w-5 h-5 bg-orange-500 rounded shadow-sm flex items-center justify-center text-xs">
            ⚠️
          </div>
          <span className="text-sm text-gray-600">Mapped Course</span>
        </div>
      </div>
    </div>
  );
}
