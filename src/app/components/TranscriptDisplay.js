'use client';

import { useState } from 'react';

export default function TranscriptDisplay({ transcript, onDownloadTranscript }) {
  const [showFullTranscript, setShowFullTranscript] = useState(false);

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  };

  const displayTranscript = showFullTranscript 
    ? transcript.transcript 
    : transcript.transcript.slice(0, 5);

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">YouTube Transcript</h3>
        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            YouTube
          </span>
        </div>
      </div>

      {/* Video Info */}
      <div className="bg-blue-50 rounded-lg p-4 mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-blue-900">Video ID: {transcript.youtubeId}</p>
            <p className="text-sm text-blue-700">Duration: {formatDuration(transcript.duration)}</p>
            <p className="text-sm text-blue-700">{transcript.transcript.length} transcript entries</p>
          </div>
        </div>
      </div>

      {/* Transcript Content */}
      <div className="space-y-3 mb-4">
        <h4 className="font-medium text-gray-900">Transcript Preview</h4>
        <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
          {displayTranscript.map((entry, index) => (
            <div key={index} className="mb-3 p-2 bg-white rounded border-l-4 border-blue-500">
              <div className="flex items-start justify-between">
                <span className="text-xs text-gray-500 font-mono">
                  [{formatTime(entry.offset / 1000)} - {formatTime((entry.offset + entry.duration) / 1000)}]
                </span>
                <span className="text-xs text-gray-400">#{index + 1}</span>
              </div>
              <p className="text-sm text-gray-700 mt-1">{entry.text}</p>
            </div>
          ))}
          
          {!showFullTranscript && transcript.transcript.length > 5 && (
            <div className="text-center py-2">
              <button
                onClick={() => setShowFullTranscript(true)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Show all {transcript.transcript.length} entries
              </button>
            </div>
          )}
          
          {showFullTranscript && (
            <div className="text-center py-2">
              <button
                onClick={() => setShowFullTranscript(false)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Show less
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <button
          onClick={onDownloadTranscript}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>Download SRT Subtitles</span>
        </button>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-start space-x-2">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div className="text-sm text-yellow-800">
              <p className="font-medium">Want to burn subtitles into a video?</p>
              <p className="mt-1">
                YouTube videos cannot be downloaded for processing. Upload a local video file instead to generate a video with burned-in subtitles.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-start space-x-2">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-800">
              <p className="font-medium">What you can do:</p>
              <ul className="mt-1 space-y-1">
                <li>• Download the transcript as an SRT file</li>
                <li>• Use the transcript for your own video editing</li>
                <li>• Upload a local video to burn subtitles into it</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}