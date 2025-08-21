#!/usr/bin/env node

/**
 * Demo script for testing video processing functionality
 * Run with: node scripts/demo.js
 */

const { writeFile, mkdir } = require('fs/promises');
const { join } = require('path');
const { existsSync } = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// Mock transcript data
const mockTranscript = [
  { offset: 0, duration: 3000, text: "Hello, welcome to this demo video." },
  { offset: 3000, duration: 4000, text: "This is a demonstration of our video processing service." },
  { offset: 7000, duration: 3000, text: "We hope you find it useful and informative." },
  { offset: 10000, duration: 2000, text: "Thank you for watching!" },
  { offset: 12000, duration: 3000, text: "This transcript was generated using our local speech recognition model." },
  { offset: 15000, duration: 2500, text: "The model runs entirely on your server, ensuring privacy and cost-effectiveness." }
];

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

// Helper function to create a test video
function createTestVideo(outputPath) {
  return new Promise((resolve, reject) => {
    // Create a simple test video with a color background and text
    ffmpeg()
      .input('color=black:size=640x480:duration=20')
      .input('testsrc=duration=20:size=640x480:rate=30')
      .complexFilter([
        '[0:v][1:v]overlay=shortest=1'
      ])
      .outputOptions([
        '-c:v libx264',
        '-preset ultrafast',
        '-t 20'
      ])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

// Helper function to process video with subtitles
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

async function runDemo() {
  try {
    console.log('🎬 Starting Video Processing Demo...\n');

    // Create directories
    const uploadsDir = join(process.cwd(), 'uploads');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
      console.log('✅ Created uploads directory');
    }

    // Create test video
    console.log('📹 Creating test video...');
    const testVideoPath = join(uploadsDir, 'test_video.mp4');
    await createTestVideo(testVideoPath);
    console.log('✅ Test video created');

    // Generate SRT subtitle file
    console.log('📝 Generating subtitles...');
    const subtitlePath = join(uploadsDir, 'test_subtitles.srt');
    const srtContent = generateSRT(mockTranscript);
    await writeFile(subtitlePath, srtContent, 'utf8');
    console.log('✅ Subtitles generated');

    // Process video with subtitles
    console.log('🔥 Burning subtitles into video...');
    const outputPath = join(uploadsDir, 'output_with_subtitles.mp4');
    await processVideoWithSubtitles(testVideoPath, subtitlePath, outputPath);
    console.log('✅ Video processing completed');

    // Display results
    console.log('\n🎉 Demo completed successfully!');
    console.log('\n📁 Generated files:');
    console.log(`   - Test video: ${testVideoPath}`);
    console.log(`   - Subtitles: ${subtitlePath}`);
    console.log(`   - Output video: ${outputPath}`);
    
    console.log('\n📊 Transcript preview:');
    mockTranscript.slice(0, 3).forEach((entry, index) => {
      const startTime = formatTime(entry.offset / 1000);
      const endTime = formatTime((entry.offset + entry.duration) / 1000);
      console.log(`   ${index + 1}. [${startTime} --> ${endTime}] ${entry.text}`);
    });

    console.log('\n🚀 You can now test the web interface by running: npm run dev');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    process.exit(1);
  }
}

// Run demo if this file is executed directly
if (require.main === module) {
  runDemo();
}

module.exports = { runDemo };