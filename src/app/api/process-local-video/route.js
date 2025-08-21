import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import formidable from 'formidable';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// Configure formidable for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper function to generate SRT subtitle content
function generateSRT(transcript) {
  let srtContent = '';
  transcript.forEach((entry, index) => {
    const startTime = formatTime(entry.offset / 1000);
    const endTime = formatTime((entry.offset + entry.duration) / 1000);
    srtContent += `${index + 1}\n${startTime} --> ${endTime}\n${entry.text}\n\n`;
  });
  return srtContent;
}

// Helper function to format time for SRT
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

// Fast video processing with subtitles
function processVideoWithSubtitles(inputPath, subtitlePath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters({
        filter: 'subtitles',
        options: subtitlePath
      })
      .outputOptions([
        '-c:v libx264',
        '-c:a aac',
        '-preset ultrafast', // Fastest processing
        '-crf 28', // Good quality, fast encoding
        '-movflags +faststart', // Optimize for web
        '-threads 0' // Use all available CPU threads
      ])
      .output(outputPath)
      .on('progress', (progress) => {
        console.log('Processing:', progress.percent, '% done');
      })
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

// Get video duration
function getVideoDuration(inputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata.format.duration);
    });
  });
}

export async function POST(request) {
  try {
    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'uploads');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Parse form data
    const form = formidable({
      uploadDir: uploadsDir,
      keepExtensions: true,
      maxFileSize: 500 * 1024 * 1024, // 500MB limit
    });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(request, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    if (!files.video || !files.video[0]) {
      throw new Error('No video file provided');
    }

    const uploadedFile = files.video[0];
    const videoPath = uploadedFile.filepath;
    
    console.log('Processing local video:', uploadedFile.originalFilename);

    // Get video duration
    const duration = await getVideoDuration(videoPath);
    console.log('Video duration:', duration, 'seconds');

    // Generate mock transcript based on duration
    // In production, you'd use Whisper.cpp here
    const transcript = generateMockTranscript(duration);
    console.log('Generated transcript with', transcript.length, 'entries');

    // Generate SRT subtitle file
    console.log('Generating SRT subtitles...');
    const subtitlePath = join(uploadsDir, `subtitles_${Date.now()}.srt`);
    const srtContent = generateSRT(transcript);
    await writeFile(subtitlePath, srtContent, 'utf8');
    console.log('SRT file generated');

    // Process video with subtitles
    console.log('Burning subtitles into video...');
    const outputPath = join(uploadsDir, `output_${Date.now()}.mp4`);
    await processVideoWithSubtitles(videoPath, subtitlePath, outputPath);
    console.log('Video processing completed');

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Local video processed successfully with subtitles',
      isYouTube: false,
      video: {
        filename: uploadedFile.originalFilename || 'video-with-subtitles.mp4',
        duration: duration,
        format: 'MP4',
        quality: 'HD',
        subtitles: true,
        transcript: transcript,
        previewUrl: `/api/video-preview?path=${encodeURIComponent(outputPath)}`,
        downloadUrl: `/api/video-download?path=${encodeURIComponent(outputPath)}`
      }
    });

  } catch (error) {
    console.error('Error processing local video:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to process local video' 
      },
      { status: 500 }
    );
  }
}

// Generate mock transcript based on video duration
function generateMockTranscript(duration) {
  const entries = [];
  let currentTime = 0;
  let entryIndex = 0;
  
  const phrases = [
    "Hello, welcome to this video.",
    "This is a demonstration of our video processing service.",
    "We hope you find it useful and informative.",
    "Thank you for watching!",
    "This transcript was generated automatically.",
    "The video processing is working perfectly.",
    "You can now download your video with subtitles.",
    "Feel free to use this service again.",
    "We appreciate your feedback and support.",
    "Have a great day!"
  ];
  
  while (currentTime < duration && entryIndex < phrases.length) {
    const phrase = phrases[entryIndex % phrases.length];
    const phraseDuration = Math.min(3 + Math.random() * 2, duration - currentTime); // 3-5 seconds
    
    entries.push({
      offset: currentTime * 1000,
      duration: phraseDuration * 1000,
      text: phrase
    });
    
    currentTime += phraseDuration;
    entryIndex++;
  }
  
  return entries;
}