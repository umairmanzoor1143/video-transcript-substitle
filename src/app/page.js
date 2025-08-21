'use client';

import { useState, useRef } from 'react';
import VideoUploader from './components/VideoUploader';
import VideoLinkInput from './components/VideoLinkInput';
import VideoPreview from './components/VideoPreview';
import ProcessingStatus from './components/ProcessingStatus';

export default function Home() {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [videoLink, setVideoLink] = useState('');
  const [transcript, setTranscript] = useState(null);
  const [isFetchingTranscript, setIsFetchingTranscript] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [processedVideo, setProcessedVideo] = useState(null);
  const [error, setError] = useState('');

  const handleFileUpload = (file) => {
    setUploadedFile(file);
    setVideoLink('');
    setTranscript(null);
    setProcessedVideo(null);
    setError('');
  };

  const fetchTranscriptForLink = async (link) => {
    try {
      setIsFetchingTranscript(true);
      setTranscript(null);
      setError('');
      const resp = await fetch('/api/youtube-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoLink: link })
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch transcript');
      }
      setTranscript(data.transcript);
    } catch (e) {
      setError(e.message || 'Failed to fetch transcript');
    } finally {
      setIsFetchingTranscript(false);
    }
  };

  const handleLinkSubmit = (link) => {
    setVideoLink(link);
    setUploadedFile(null);
    setProcessedVideo(null);
    setError('');
    if (link) {
      fetchTranscriptForLink(link);
    } else {
      setTranscript(null);
    }
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
      const formData = new FormData();
      if (uploadedFile) {
        formData.append('video', uploadedFile);
      } else if (videoLink) {
        formData.append('videoLink', videoLink);
        if (transcript) {
          formData.append('transcript', JSON.stringify(transcript));
        }
      }

      setProcessingStep('Downloading video...');
      const response = await fetch('/api/process-video', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to process video');
      }

      setProcessedVideo(result.video);
      setProcessingStep('Processing complete!');
    } catch (err) {
      setError(err.message || 'An error occurred during processing');
    } finally {
      setIsProcessing(false);
    }
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

            {/* Transcript Panel for YouTube links */}
            {videoLink && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">Transcript</h3>
                  {isFetchingTranscript && (
                    <span className="text-sm text-blue-600">Fetching...</span>
                  )}
                </div>
                {transcript ? (
                  <div className="max-h-48 overflow-y-auto text-sm text-gray-700 space-y-2">
                    {transcript.slice(0, 50).map((t, i) => (
                      <div key={i} className="flex items-start">
                        <span className="text-gray-500 text-xs w-24 shrink-0">
                          {Math.floor(t.start / 60)}:{Math.floor(t.start % 60).toString().padStart(2, '0')} - {Math.floor(t.end / 60)}:{Math.floor(t.end % 60).toString().padStart(2, '0')}
                        </span>
                        <span className="ml-2">{t.text}</span>
                      </div>
                    ))}
                    {transcript.length > 50 && (
                      <p className="text-gray-500 text-xs italic">... and more</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">{isFetchingTranscript ? 'Please wait...' : 'No transcript available yet.'}</p>
                )}

                <button
                  disabled={!transcript || isProcessing}
                  onClick={handleProcess}
                  className={`mt-4 w-full ${!transcript || isProcessing ? 'bg-gray-300 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'} text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200`}
                >
                  Burn subtitles into video
                </button>
              </div>
            )}

            {canProcess && !videoLink && (
              <button
                onClick={handleProcess}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
              >
                Process Video
              </button>
            )}
          </div>

          {/* Right Column - Preview/Status */}
          <div className="space-y-6">
            {isProcessing && (
              <ProcessingStatus step={processingStep} />
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
