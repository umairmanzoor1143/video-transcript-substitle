'use client';

import { useState } from 'react';

export default function VideoPreview({ video }) {
  const [isPlaying, setIsPlaying] = useState(false);

  const handleDownload = () => {
    if (video.downloadUrl) {
      const link = document.createElement('a');
      link.href = video.downloadUrl;
      link.download = video.filename || 'video-with-subtitles.mp4';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Processed Video</h3>
      
      <div className="space-y-4">
        {/* Video Player */}
        <div className="relative bg-black rounded-lg overflow-hidden">
          {video.previewUrl ? (
            <video
              className="w-full h-64 object-contain"
              controls
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            >
              <source src={video.previewUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          ) : (
            <div className="w-full h-64 flex items-center justify-center">
              <div className="text-center text-white">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <p className="text-lg font-medium">Video Preview</p>
                <p className="text-sm text-gray-400">Click download to get your video</p>
              </div>
            </div>
          )}
          
          {/* Play/Pause Overlay */}
          {!isPlaying && video.previewUrl && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
              <div className="w-16 h-16 bg-white bg-opacity-90 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-800" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Video Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">Duration:</span>
            <span className="ml-2 text-gray-600">
              {video.duration ? formatDuration(video.duration) : 'N/A'}
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Format:</span>
            <span className="ml-2 text-gray-600">
              {video.format || 'MP4'}
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Quality:</span>
            <span className="ml-2 text-gray-600">
              {video.quality || 'Original'}
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Subtitles:</span>
            <span className="ml-2 text-gray-600">
              {video.subtitles ? 'Burned In' : 'N/A'}
            </span>
          </div>
        </div>

        {/* Transcript Preview */}
        {video.transcript && Array.isArray(video.transcript) && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Transcript Preview</h4>
            <div className="max-h-32 overflow-y-auto text-sm text-gray-600">
              {video.transcript.slice(0, 3).map((entry, index) => (
                <div key={index} className="mb-2">
                  <span className="text-gray-500 text-xs">
                    [{formatDuration(entry.start || (entry.offset ?? 0) / 1000)} - {formatDuration(entry.end || ((entry.offset ?? 0) + (entry.duration ?? 0)) / 1000)}]
                  </span>
                  <span className="ml-2">{entry.text}</span>
                </div>
              ))}
              {video.transcript.length > 3 && (
                <p className="text-gray-500 text-xs italic">
                  ... and {video.transcript.length - 3} more entries
                </p>
              )}
            </div>
          </div>
        )}

        {/* Download Section */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Ready for Download</h4>
              <p className="text-sm text-gray-600">
                Your video with burned-in subtitles is ready
              </p>
            </div>
            <button
              onClick={handleDownload}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Download Video</span>
            </button>
          </div>
        </div>

        {/* Success Message */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm text-green-700">
              Video processing completed successfully! Subtitles have been burned into the video.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}