import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { existsSync, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { YoutubeTranscript } from 'youtube-transcript';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import ytdl from 'ytdl-core';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// Helper function to extract YouTube video ID
function extractYouTubeId(url) {
  const regex = /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([^&\n?#]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// Normalize transcript entries to include offset/duration in ms and start/end in seconds
function normalizeTranscript(rawEntries) {
  return rawEntries.map((entry) => {
    const startSeconds = typeof entry.offset === 'number' ? entry.offset : (typeof entry.start === 'number' ? entry.start : 0);
    const durationSeconds = typeof entry.duration === 'number' ? entry.duration : (typeof entry.end === 'number' ? (entry.end - (entry.start ?? startSeconds)) : 0);
    const startMs = Math.round(startSeconds * 1000);
    const durationMs = Math.max(0, Math.round(durationSeconds * 1000));
    return {
      text: entry.text ?? '',
      offset: startMs,
      duration: durationMs,
      start: startSeconds,
      end: startSeconds + durationSeconds,
    };
  });
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

// Helper function to process video with ffmpeg
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
        '-preset medium',
        '-crf 23'
      ])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

// Helper function to extract audio from video (kept for file uploads)
function extractAudio(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions(['-vn', '-acodec pcm_s16le', '-ar 16000', '-ac 1'])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

async function fetchYouTubeTranscript(youtubeId) {
  const raw = await YoutubeTranscript.fetchTranscript(youtubeId);
  return normalizeTranscript(raw);
}

async function downloadYouTubeVideo(videoUrl, destPath) {
  const readable = ytdl(videoUrl, { filter: 'audioandvideo', quality: 'highest' });
  const writable = createWriteStream(destPath);
  await pipeline(readable, writable);
}

export async function POST(request) {
  try {
    // Ensure uploads directory exists
    const uploadsDir = join(process.cwd(), 'uploads');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    const formData = await request.formData();

    let videoPath;
    let transcript;

    const videoLink = formData.get('videoLink');
    const providedTranscript = formData.get('transcript');

    if (videoLink) {
      const youtubeId = extractYouTubeId(String(videoLink));
      if (!youtubeId) {
        throw new Error('Only YouTube links are supported at the moment. Please upload a file instead.');
      }

      // Use provided transcript if present, otherwise fetch quickly
      transcript = providedTranscript ? normalizeTranscript(JSON.parse(String(providedTranscript))) : await fetchYouTubeTranscript(youtubeId);

      // Download the YouTube video fast
      videoPath = join(uploadsDir, `yt_${youtubeId}_${Date.now()}.mp4`);
      await downloadYouTubeVideo(String(videoLink), videoPath);
    } else {
      const file = formData.get('video');
      if (file && typeof file === 'object' && 'arrayBuffer' in file) {
        const arrayBuffer = await file.arrayBuffer();
        const originalName = file.name || `upload_${Date.now()}.mp4`;
        const ext = extname(originalName) || '.mp4';
        videoPath = join(uploadsDir, `upload_${Date.now()}${ext}`);
        await writeFile(videoPath, Buffer.from(arrayBuffer));

        // For demo: create a short mock transcript covering ~12s
        transcript = normalizeTranscript([
          { start: 0, duration: 3, text: 'Hello, welcome to this video.' },
          { start: 3, duration: 4, text: 'This is a demonstration of our video processing service.' },
          { start: 7, duration: 3, text: 'We hope you find it useful and informative.' },
          { start: 10, duration: 2, text: 'Thank you for watching!' },
        ]);
      } else {
        throw new Error('No video file or link provided');
      }
    }

    // Generate SRT subtitle file from normalized transcript
    const subtitlePath = join(uploadsDir, `subtitles_${Date.now()}.srt`);
    const srtContent = generateSRT(transcript);
    await writeFile(subtitlePath, srtContent, 'utf8');

    // Process video with subtitles burned in
    const outputPath = join(uploadsDir, `output_${Date.now()}.mp4`);
    await processVideoWithSubtitles(videoPath, subtitlePath, outputPath);

    // Return payload aligned with UI expectations
    const durationSeconds = Math.round((transcript.at(-1)?.end ?? 0));

    return NextResponse.json({
      success: true,
      message: 'Video processed successfully',
      video: {
        filename: 'video-with-subtitles.mp4',
        duration: durationSeconds,
        format: 'MP4',
        quality: 'Original',
        subtitles: true,
        transcript,
        previewUrl: `/api/video-preview?path=${encodeURIComponent(outputPath)}`,
        downloadUrl: `/api/video-download?path=${encodeURIComponent(outputPath)}`,
      },
    });
  } catch (error) {
    console.error('Error processing video:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to process video',
      },
      { status: 500 }
    );
  }
}