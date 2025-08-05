'use client';

import { SignedIn, SignedOut, SignInButton, SignUpButton } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import AdSense from '@/components/AdSense';

export default function RootPage() {
  const router = useRouter();

  // Redirect signed-in users to home page
  useEffect(() => {
    const redirectToHome = () => {
      router.push('/home');
    };
    
    // Add a small delay to ensure Clerk has loaded
    const timer = setTimeout(redirectToHome, 100);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <SignedIn>
        {/* Redirect to home page for signed-in users */}
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Redirecting to dashboard...</p>
          </div>
        </div>
      </SignedIn>

      <SignedOut>
        <div className="min-h-screen bg-gray-50">
          {/* Header */}
          <header className="flex justify-between items-center p-4 lg:p-6 border-b bg-white shadow-sm">
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Foritu Web</h1>
            <div className="flex gap-2">
              <SignInButton mode="modal">
                <button className="px-3 lg:px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="px-3 lg:px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors">
                  Sign Up
                </button>
              </SignUpButton>
            </div>
          </header>
          
          {/* Top Ad */}
          <div className="bg-white py-4 px-4 lg:px-6 border-b">
            <AdSense adSlot="9322735635196756" className="text-center" />
          </div>
          
          {/* Main Content */}
          <div className="flex items-center justify-center min-h-[calc(100vh-80px)] bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="max-w-md w-full mx-auto p-4 lg:p-8">
              <div className="bg-white rounded-lg shadow-xl p-6 lg:p-8 text-center">
                <div className="mb-6">
                  <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">Foritu Web</h1>
                  <p className="text-gray-600">Course planning and transcript analysis</p>
                </div>

                <div className="space-y-4">
                  <p className="text-gray-700 text-sm lg:text-base">
                    Welcome to Foritu Web! This application helps you track your academic progress, 
                    analyze your transcript, and plan your course schedule.
                  </p>
                  
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-900 mb-2">Features:</h3>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Upload and parse your transcript</li>
                      <li>• Track course progress and grades</li>
                      <li>• View prerequisite requirements</li>
                      <li>• Monitor GPA and credit progress</li>
                      <li>• Plan future semesters</li>
                    </ul>
                  </div>
                  
                  {/* Middle Ad */}
                  <div className="py-4">
                    <AdSense adSlot="9322735635196756" className="text-center" />
                  </div>
                  
                  <p className="text-sm text-gray-500">
                    Please sign in to access your personalized course planning dashboard.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Bottom Ad */}
          <div className="bg-white py-4 px-4 lg:px-6 border-t">
            <AdSense adSlot="9322735635196756" className="text-center" />
          </div>
        </div>
      </SignedOut>
    </div>
  );
}
