'use client';

import { useState, useEffect } from 'react';

export default function ProcessingStatus({ step }) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const getStepIcon = (stepText) => {
    if (stepText.includes('Starting')) return '🚀';
    if (stepText.includes('Uploading')) return '📤';
    if (stepText.includes('Downloading')) return '⬇️';
    if (stepText.includes('Extracting')) return '🎵';
    if (stepText.includes('Transcribing')) return '🎤';
    if (stepText.includes('Generating')) return '📝';
    if (stepText.includes('Burning')) return '🔥';
    if (stepText.includes('Complete')) return '✅';
    return '⚙️';
  };

  const getStepColor = (stepText) => {
    if (stepText.includes('Complete')) return 'text-green-600';
    if (stepText.includes('Error')) return 'text-red-600';
    return 'text-blue-600';
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Processing Status</h3>
      
      <div className="space-y-4">
        {/* Current Step */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-lg">{getStepIcon(step)}</span>
          </div>
          <div className="flex-1">
            <p className={`font-medium ${getStepColor(step)}`}>
              {step}{dots}
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all duration-500 animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Processing Steps */}
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-sm text-gray-600">Video uploaded</span>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-sm text-gray-600">Audio extraction</span>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-sm text-gray-600">Speech recognition</span>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-sm text-gray-600">Subtitle generation</span>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-sm text-gray-600">Video processing</span>
          </div>
        </div>

        {/* Estimated Time */}
        <div className="bg-blue-50 rounded-lg p-3">
          <p className="text-sm text-blue-700">
            <span className="font-medium">Estimated time:</span> 2-5 minutes depending on video length
          </p>
        </div>
      </div>
    </div>
  );
}