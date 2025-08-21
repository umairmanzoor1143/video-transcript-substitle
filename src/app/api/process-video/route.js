import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import formidable from 'formidable';
import { YoutubeTranscript } from 'youtube-transcript';
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

// Helper function to extract YouTube video ID
function extractYouTubeId(url) {
  const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

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

// Helper function to process video with ffmpeg (optimized for speed)
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
        '-preset ultrafast', // Changed to ultrafast for speed
        '-crf 28', // Slightly lower quality for faster processing
        '-movflags +faststart' // Optimize for web playback
      ])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

// Helper function to extract audio from video (optimized)
function extractAudio(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-vn', 
        '-acodec pcm_s16le', 
        '-ar 16000', 
        '-ac 1',
        '-f wav'
      ])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
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

    let videoPath;
    let transcript;
    let isYouTube = false;
    let videoUrl = '';
    let youtubeId = '';

    // Handle video link (YouTube, Vimeo, direct)
    if (fields.videoLink && fields.videoLink[0]) {
      videoUrl = fields.videoLink[0];
      
      // Check if it's a YouTube URL
      youtubeId = extractYouTubeId(videoUrl);
      if (youtubeId) {
        try {
          console.log('Fetching YouTube transcript for:', youtubeId);
          // Fetch YouTube transcript - this is fast and free
          transcript = await YoutubeTranscript.fetchTranscript(youtubeId);
          isYouTube = true;
          console.log('YouTube transcript fetched successfully:', transcript.length, 'entries');
          
          // For YouTube, we'll return the transcript immediately and provide options
          // instead of trying to download the video
          return NextResponse.json({
            success: true,
            message: 'YouTube transcript extracted successfully',
            isYouTube: true,
            youtubeId: youtubeId,
            videoUrl: videoUrl,
            transcript: transcript,
            duration: transcript.reduce((total, entry) => total + entry.duration, 0) / 1000,
            options: {
              canProcessLocally: false,
              canDownloadSubtitles: true,
              canBurnSubtitles: false, // YouTube videos can't be downloaded easily
              message: 'YouTube videos cannot be downloaded for subtitle burning. You can download the transcript or upload a local video file instead.'
            }
          });
        } catch (error) {
          console.error('YouTube transcript error:', error);
          throw new Error('Failed to fetch YouTube transcript: ' + error.message);
        }
      } else {
        // For other URLs, we'd need to download them
        throw new Error('Direct video URL processing not implemented in this demo. Please upload a video file instead.');
      }
    }
    // Handle uploaded video file
    else if (files.video && files.video[0]) {
      const uploadedFile = files.video[0];
      videoPath = uploadedFile.filepath;
      
      console.log('Processing uploaded video file:', uploadedFile.originalFilename);
      
      // Extract audio for transcription
      const audioPath = join(uploadsDir, `audio_${Date.now()}.wav`);
      console.log('Extracting audio...');
      await extractAudio(videoPath, audioPath);
      console.log('Audio extraction completed');
      
      // For demo purposes, we'll create a mock transcript
      // In production, you'd use Whisper.cpp or another speech-to-text service
      transcript = [
        { offset: 0, duration: 3000, text: "Hello, welcome to this video." },
        { offset: 3000, duration: 4000, text: "This is a demonstration of our video processing service." },
        { offset: 7000, duration: 3000, text: "We hope you find it useful and informative." },
        { offset: 10000, duration: 2000, text: "Thank you for watching!" }
      ];
      
      console.log('Mock transcript generated');
    } else {
      throw new Error('No video file or link provided');
    }

    // For uploaded videos, continue with subtitle burning
    if (videoPath) {
      console.log('Generating SRT subtitles...');
      // Generate SRT subtitle file
      const subtitlePath = join(uploadsDir, `subtitles_${Date.now()}.srt`);
      const srtContent = generateSRT(transcript);
      await writeFile(subtitlePath, srtContent, 'utf8');
      console.log('SRT file generated');

      console.log('Processing video with subtitles...');
      // Process video with subtitles
      const outputPath = join(uploadsDir, `output_${Date.now()}.mp4`);
      await processVideoWithSubtitles(videoPath, subtitlePath, outputPath);
      console.log('Video processing completed');

      // Return success response for uploaded videos
      return NextResponse.json({
        success: true,
        message: 'Video processed successfully with subtitles',
        isYouTube: false,
        video: {
          filename: 'video-with-subtitles.mp4',
          duration: transcript.reduce((total, entry) => total + entry.duration, 0) / 1000,
          format: 'MP4',
          quality: 'HD',
          subtitles: true,
          transcript: transcript,
          previewUrl: `/api/video-preview?path=${encodeURIComponent(outputPath)}`,
          downloadUrl: `/api/video-download?path=${encodeURIComponent(outputPath)}`
        }
      });
    }

  } catch (error) {
    console.error('Error processing video:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to process video' 
      },
      { status: 500 }
    );
  }
}