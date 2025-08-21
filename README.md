# Video Transcript & Subtitle Burner SaaS

A Next.js-based SaaS application that automatically generates transcripts from videos and burns subtitles directly into the video files. Supports both local video uploads and video links from platforms like YouTube.

## Features

- **Multiple Input Sources**: Upload local video files or paste YouTube/Vimeo links
- **Automatic Transcription**: AI-powered speech recognition for accurate transcripts
- **Subtitle Burning**: Hardcode subtitles directly into videos using FFmpeg
- **Real-time Processing**: Live progress updates during video processing
- **Free & Open Source**: Uses local Whisper.cpp models for transcription
- **Modern UI**: Beautiful, responsive interface built with Tailwind CSS

## Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **Backend**: Next.js API Routes
- **Video Processing**: FFmpeg with fluent-ffmpeg
- **Transcription**: YouTube Transcript API + Whisper.cpp (local)
- **File Handling**: Formidable for uploads, Node.js file system

## Prerequisites

- Node.js 18+ 
- FFmpeg installed on your system
- At least 2GB RAM for video processing
- 10GB+ free disk space for video storage

## Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd video-transcript
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install FFmpeg**
   
   **Ubuntu/Debian:**
   ```bash
   sudo apt update
   sudo apt install ffmpeg
   ```
   
   **macOS:**
   ```bash
   brew install ffmpeg
   ```
   
   **Windows:**
   Download from [FFmpeg official website](https://ffmpeg.org/download.html)

4. **Create required directories**
   ```bash
   mkdir -p uploads temp
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

### 1. Upload a Video File
- Drag and drop a video file (MP4, MOV, AVI, MKV) or click to browse
- Supported formats: MP4, MOV, AVI, MKV, WebM, FLV
- Maximum file size: 500MB

### 2. Or Provide a Video Link
- Paste a YouTube, Vimeo, or direct video URL
- YouTube videos will automatically fetch transcripts
- Other platforms require local transcription

### 3. Process the Video
- Click "Process Video" to start
- Watch real-time progress updates
- Wait for completion (2-5 minutes depending on length)

### 4. Download Result
- Preview the processed video with subtitles
- Click "Download Video" to get the final file
- Subtitles are permanently burned into the video

## API Endpoints

### POST `/api/process-video`
Main endpoint for video processing. Accepts multipart form data with either:
- `video`: Video file upload
- `videoLink`: Video URL string

### POST `/api/transcribe`
Transcription endpoint for audio files (used internally)

### GET `/api/video-preview?path=<filepath>`
Serves video files for preview

### GET `/api/video-download?path=<filepath>`
Serves processed videos for download

## Production Deployment

### Environment Variables
```bash
# Optional: Set custom upload directory
UPLOADS_DIR=/path/to/uploads
TEMP_DIR=/path/to/temp

# Optional: Set maximum file size (default: 500MB)
MAX_FILE_SIZE=524288000
```

### Deployment Considerations
1. **Storage**: Ensure sufficient disk space for video processing
2. **Memory**: Allocate at least 2GB RAM for FFmpeg operations
3. **CPU**: Video processing is CPU-intensive
4. **Security**: Implement proper authentication and rate limiting
5. **Cleanup**: Set up automated cleanup of temporary files

### Docker Deployment
```dockerfile
FROM node:18-alpine

# Install FFmpeg
RUN apk add --no-cache ffmpeg

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

## Advanced Configuration

### Whisper.cpp Integration
For production use, replace the mock transcription with actual Whisper.cpp:

1. **Install Whisper.cpp**
   ```bash
   git clone https://github.com/ggerganov/whisper.cpp.git
   cd whisper.cpp
   make
   ```

2. **Download Models**
   ```bash
   bash ./models/download-ggml-model.sh base.en
   ```

3. **Update Transcription Function**
   Replace the mock function in `/api/transcribe/route.js` with actual Whisper.cpp calls.

### Custom Subtitle Styling
Modify the FFmpeg command in `/api/process-video/route.js` to customize:
- Font family and size
- Text color and background
- Position and alignment
- Border and shadow effects

## Troubleshooting

### Common Issues

**FFmpeg not found**
- Ensure FFmpeg is installed and in your PATH
- Check installation with `ffmpeg -version`

**Video processing fails**
- Verify video file format is supported
- Check available disk space
- Ensure sufficient memory allocation

**Upload fails**
- Check file size limits
- Verify upload directory permissions
- Check network connectivity

**Transcription errors**
- Ensure audio quality is sufficient
- Check Whisper.cpp model availability
- Verify audio file format compatibility

### Performance Optimization

1. **Use SSD storage** for faster file I/O
2. **Increase Node.js memory limit**:
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" npm run dev
   ```
3. **Optimize FFmpeg settings** for your use case
4. **Implement video compression** for faster processing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review FFmpeg and Whisper.cpp documentation

## Roadmap

- [ ] Multi-language support
- [ ] Custom subtitle styling options
- [ ] Batch processing
- [ ] Cloud storage integration
- [ ] User authentication
- [ ] Processing queue management
- [ ] Real-time collaboration features
