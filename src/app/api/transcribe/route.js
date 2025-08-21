import { NextResponse } from 'next/server';
import { writeFile, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// Mock transcription function - in production, this would use Whisper.cpp
async function transcribeAudio(audioPath) {
  // This is a mock implementation
  // In production, you would:
  // 1. Use Whisper.cpp bindings or faster-whisper
  // 2. Process the audio file with the model
  // 3. Return actual transcription results
  
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Return mock transcript
  return [
    { offset: 0, duration: 3000, text: "Hello, welcome to this video." },
    { offset: 3000, duration: 4000, text: "This is a demonstration of our video processing service." },
    { offset: 7000, duration: 3000, text: "We hope you find it useful and informative." },
    { offset: 10000, duration: 2000, text: "Thank you for watching!" },
    { offset: 12000, duration: 3000, text: "This transcript was generated using our local speech recognition model." },
    { offset: 15000, duration: 2500, text: "The model runs entirely on your server, ensuring privacy and cost-effectiveness." }
  ];
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio');
    
    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Create temp directory if it doesn't exist
    const tempDir = join(process.cwd(), 'temp');
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
    }

    // Save uploaded audio file
    const audioPath = join(tempDir, `audio_${Date.now()}.wav`);
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    await writeFile(audioPath, audioBuffer);

    try {
      // Transcribe audio
      const transcript = await transcribeAudio(audioPath);
      
      // Clean up temp file
      await unlink(audioPath);
      
      return NextResponse.json({
        success: true,
        transcript: transcript,
        duration: transcript.reduce((total, entry) => total + entry.duration, 0) / 1000
      });
      
    } catch (error) {
      // Clean up temp file on error
      if (existsSync(audioPath)) {
        await unlink(audioPath);
      }
      throw error;
    }

  } catch (error) {
    console.error('Error transcribing audio:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to transcribe audio' 
      },
      { status: 500 }
    );
  }
}