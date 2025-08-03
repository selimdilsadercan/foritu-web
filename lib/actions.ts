'use server';

import Client, { Environment } from '@/lib/client';

export interface TranscriptCourse {
  semester: string;
  code: string;
  name: string;
  credits: string;
  grade: string;
}

export interface ParseTranscriptResult {
  courses: TranscriptCourse[];
  error: string;
  debug: string;
}

/**
 * Server action to parse transcript from base64 PDF data
 */
export async function parseTranscriptFromBase64(base64Data: string): Promise<ParseTranscriptResult> {
  try {
    console.log('Server: Starting transcript parsing...');
    console.log('Server: Base64 data length:', base64Data.length);
    
    // Create API client for staging environment
    const client = new Client(Environment('staging'));
    
    // Prepare request payload
    const request = {
      pdf_base64: base64Data
    };
    
    console.log('Server: Sending request to API...');
    
    // Call the API
    const response = await client.transcript.ParseTranscript(request);
    
    console.log('Server: API Response received:');
    console.log('Server: Courses found:', response.courses.length);
    console.log('Server: Error:', response.error);
    console.log('Server: Debug:', response.debug);
    
    // Log each course
    response.courses.forEach((course, index) => {
      console.log(`Server: Course ${index + 1}:`, {
        semester: course.semester,
        code: course.code,
        name: course.name,
        credits: course.credits,
        grade: course.grade
      });
    });
    
    return response;
    
  } catch (error) {
    console.error('Server: Error parsing transcript:', error);
    
    return {
      courses: [],
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      debug: 'Error occurred during API call'
    };
  }
} 