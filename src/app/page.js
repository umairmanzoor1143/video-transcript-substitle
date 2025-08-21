'use client';

import { useState, useRef } from 'react';
import VideoUploader from './components/VideoUploader';
import VideoLinkInput from './components/VideoLinkInput';
import VideoPreview from './components/VideoPreview';
import ProcessingStatus from './components/ProcessingStatus';
import TranscriptDisplay from './components/TranscriptDisplay';

export default function Home() {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [videoLink, setVideoLink] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [processedVideo, setProcessedVideo] = useState(null);
  const [youtubeTranscript, setYoutubeTranscript] = useState(null);
  const [error, setError] = useState('');

  const handleFileUpload = (file) => {
    setUploadedFile(file);
    setVideoLink('');
    setProcessedVideo(null);
    setYoutubeTranscript(null);
    setError('');
  };

  const handleLinkSubmit = (link) => {
    setVideoLink(link);
    setUploadedFile(null);
    setProcessedVideo(null);
    setYoutubeTranscript(null);
    setError('');
  };

  const handleProcess = async () => {
    if (!uploadedFile && !videoLink) {
      setError('Please upload a video file or provide a video link');
      return;
    }

    setIsProcessing(true);
    setProcessingStep('Starting processing...');
    setError('');

    try {
      if (uploadedFile) {
        // Process local video file - fast processing
        await processLocalVideo(uploadedFile);
      } else if (videoLink) {
        // Process YouTube link - fast transcript extraction
        await processYouTubeLink(videoLink);
      }
    } catch (err) {
      setError(err.message || 'An error occurred during processing');
    } finally {
      setIsProcessing(false);
    }
  };

  const processLocalVideo = async (file) => {
    setProcessingStep('Processing local video...');
    
    const formData = new FormData();
    formData.append('video', file);
    
    const response = await fetch('/api/process-local-video', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to process local video');
    }

    const result = await response.json();
    setProcessedVideo(result.video);
    setProcessingStep('Local video processing complete!');
  };

  const processYouTubeLink = async (link) => {
    setProcessingStep('Extracting YouTube transcript...');
    
    const formData = new FormData();
    formData.append('videoLink', link);
    
    const response = await fetch('/api/process-video', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to process YouTube link');
    }

    const result = await response.json();
    
    if (result.isYouTube) {
      setYoutubeTranscript(result);
      setProcessingStep('YouTube transcript extracted!');
    } else {
      throw new Error('Unexpected response from YouTube processing');
    }
  };

  const handleDownloadTranscript = () => {
    if (youtubeTranscript && youtubeTranscript.transcript) {
      const srtContent = generateSRT(youtubeTranscript.transcript);
      const blob = new Blob([srtContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `youtube-transcript-${youtubeTranscript.youtubeId}.srt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const generateSRT = (transcript) => {
    let srtContent = '';
    transcript.forEach((entry, index) => {
      const startTime = formatTime(entry.offset / 1000);
      const endTime = formatTime((entry.offset + entry.duration) / 1000);
      srtContent += `${index + 1}\n${startTime} --> ${endTime}\n${entry.text}\n\n`;
    });
    return srtContent;
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  };

  const canProcess = (uploadedFile || videoLink) && !isProcessing;

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Video Transcript & Subtitle Burner
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Upload a video file or provide a video link to automatically generate transcripts 
            and burn subtitles into your video. Support for YouTube, Vimeo, and direct video links.
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Left Column - Input Methods */}
          <div className="space-y-6">
            <VideoUploader onFileUpload={handleFileUpload} uploadedFile={uploadedFile} />
            <div className="text-center text-gray-500">- OR -</div>
            <VideoLinkInput onSubmit={handleLinkSubmit} videoLink={videoLink} />
            
            {canProcess && (
              <button
                onClick={handleProcess}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
              >
                {uploadedFile ? 'Process Local Video' : 'Extract YouTube Transcript'}
              </button>
            )}
          </div>

          {/* Right Column - Preview/Status */}
          <div className="space-y-6">
            {isProcessing && (
              <ProcessingStatus step={processingStep} />
            )}
            
            {youtubeTranscript && (
              <TranscriptDisplay 
                transcript={youtubeTranscript} 
                onDownloadTranscript={handleDownloadTranscript}
              />
            )}
            
            {processedVideo && (
              <VideoPreview video={processedVideo} />
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Features */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Multiple Input Sources</h3>
              <p className="text-gray-600 text-sm">Upload local files or paste YouTube/Vimeo links</p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Auto Transcription</h3>
              <p className="text-gray-600 text-sm">AI-powered speech recognition for accurate transcripts</p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Hardcoded Subtitles</h3>
              <p className="text-gray-600 text-sm">Burn subtitles directly into video for permanent display</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
