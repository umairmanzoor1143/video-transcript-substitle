'use client';

import { useState } from 'react';

export default function VideoLinkInput({ onSubmit, videoLink }) {
  const [inputValue, setInputValue] = useState(videoLink);
  const [isValid, setIsValid] = useState(true);

  const validateUrl = (url) => {
    if (!url) return false;
    
    // YouTube URL patterns
    const youtubePatterns = [
      /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/,
      /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=.+/,
      /^(https?:\/\/)?(www\.)?youtu\.be\/.+/,
    ];
    
    // Vimeo URL patterns
    const vimeoPatterns = [
      /^(https?:\/\/)?(www\.)?vimeo\.com\/.+/,
      /^(https?:\/\/)?(www\.)?player\.vimeo\.com\/video\/.+/,
    ];
    
    // Direct video file patterns
    const videoPatterns = [
      /^(https?:\/\/)?(www\.)?.+\.(mp4|mov|avi|mkv|webm|flv)(\?.*)?$/i,
    ];
    
    const allPatterns = [...youtubePatterns, ...vimeoPatterns, ...videoPatterns];
    
    return allPatterns.some(pattern => pattern.test(url));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!inputValue.trim()) {
      setIsValid(false);
      return;
    }
    
    if (validateUrl(inputValue.trim())) {
      setIsValid(true);
      onSubmit(inputValue.trim());
    } else {
      setIsValid(false);
    }
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    if (e.target.value && !isValid) {
      setIsValid(true);
    }
  };

  const clearInput = () => {
    setInputValue('');
    onSubmit('');
    setIsValid(true);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Video Link</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="videoLink" className="block text-sm font-medium text-gray-700 mb-2">
            Paste video URL
          </label>
          <div className="relative">
            <input
              id="videoLink"
              type="url"
              value={inputValue}
              onChange={handleInputChange}
              placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 ${
                isValid ? 'border-gray-300' : 'border-red-300 focus:border-red-500 focus:ring-red-500'
              }`}
            />
            {inputValue && (
              <button
                type="button"
                onClick={clearInput}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          
          {!isValid && (
            <p className="text-sm text-red-600 mt-1">
              Please enter a valid YouTube, Vimeo, or direct video URL
            </p>
          )}
        </div>
        
        <button
          type="submit"
          className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
        >
          Use This Link
        </button>
      </form>
      
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <h4 className="text-sm font-medium text-blue-900 mb-2">Supported Platforms:</h4>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• YouTube videos (automatic transcript extraction)</li>
          <li>• Vimeo videos</li>
          <li>• Direct video file links (MP4, MOV, AVI, etc.)</li>
        </ul>
      </div>
    </div>
  );
}