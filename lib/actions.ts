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

export interface GetTranscriptResult {
  courses: TranscriptCourse[];
  error: string;
  success: boolean;
}

export interface StoreTranscriptResult {
  success: boolean;
  error: string;
  message: string;
}

export interface DeleteTranscriptResult {
  success: boolean;
  error: string;
  message: string;
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

/**
 * Server action to get user's transcript
 */
export async function GetTranscript(userId: string): Promise<GetTranscriptResult> {
  try {
    console.log('Server: Getting transcript for user:', userId);
    
    // Create API client for staging environment
    const client = new Client(Environment('staging'));
    
    console.log('Server: Sending request to get transcript...');
    
    // Call the API to get user's transcript
    const response = await client.transcript.GetTranscript(userId);
    
    console.log('Server: GetTranscript API Response received:');
    console.log('Server: Transcript found:', response.transcript ? 'Yes' : 'No');
    
    // Log each course if available
    if (response.transcript?.courses) {
      console.log('Server: Courses found:', response.transcript.courses.length);
      response.transcript.courses.forEach((course, index) => {
        console.log(`Server: Course ${index + 1}:`, {
          semester: course.semester,
          code: course.code,
          name: course.name,
          credits: course.credits,
          grade: course.grade
        });
      });
    }
    
    return {
      courses: response.transcript?.courses || [],
      error: '',
      success: !!response.transcript
    };
    
  } catch (error) {
    console.error('Server: Error getting transcript:', error);
    
    return {
      courses: [],
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      success: false
    };
  }
}

/**
 * Server action to store user's transcript
 */
export async function StoreTranscript(userId: string, courses: TranscriptCourse[]): Promise<StoreTranscriptResult> {
  try {
    console.log('Server: Storing transcript for user:', userId);
    console.log('Server: Courses to store:', courses.length);
    
    // Create API client for staging environment
    const client = new Client(Environment('staging'));
    
    // Prepare request payload
    const request = {
      userId: userId,
      courses: courses
    };
    
    console.log('Server: Sending request to store transcript...');
    
    // Call the API to store user's transcript
    const response = await client.transcript.StoreTranscript(request);
    
    console.log('Server: StoreTranscript API Response received:');
    console.log('Server: Message:', response.message);
    console.log('Server: User ID:', response.userId);
    
    return {
      success: true,
      error: '',
      message: response.message
    };
    
  } catch (error) {
    console.error('Server: Error storing transcript:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      message: ''
    };
  }
}

/**
 * Server action to delete user's transcript
 */
export async function DeleteTranscript(userId: string): Promise<DeleteTranscriptResult> {
  try {
    console.log('Server: Deleting transcript for user:', userId);
    const client = new Client(Environment('staging'));
    console.log('Server: Sending request to delete transcript...');
    const response = await client.transcript.DeleteTranscript(userId);
    
    console.log('Server: DeleteTranscript API Response received:');
    console.log('Server: Message:', response.message);
    console.log('Server: User ID:', response.userId);
    
    return {
      success: true,
      error: '',
      message: response.message
    };
    
  } catch (error) {
    console.error('Server: Error deleting transcript:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      message: ''
    };
  }
}

/**
 * Server action to parse and store transcript in one operation
 */
export async function ParseAndStoreTranscript(userId: string, base64Data: string): Promise<StoreTranscriptResult> {
  try {
    console.log('Server: Starting parse and store transcript for user:', userId);
    
    // First parse the transcript
    const parseResult = await parseTranscriptFromBase64(base64Data);
    
    if (parseResult.error) {
      console.error('Server: Error parsing transcript:', parseResult.error);
      return {
        success: false,
        error: parseResult.error,
        message: 'Failed to parse transcript'
      };
    }
    
    if (parseResult.courses.length === 0) {
      console.log('Server: No courses found in transcript');
      return {
        success: false,
        error: 'No courses found in transcript',
        message: 'Please check if the file contains valid transcript data'
      };
    }
    
    // Then store the transcript
    const storeResult = await StoreTranscript(userId, parseResult.courses);
    
    console.log('Server: Parse and store completed successfully');
    return storeResult;
    
  } catch (error) {
    console.error('Server: Error in parse and store transcript:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      message: 'Failed to process transcript'
    };
  }
} 