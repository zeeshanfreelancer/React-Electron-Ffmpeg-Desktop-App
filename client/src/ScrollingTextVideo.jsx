import React, { useState, useEffect } from 'react';
import './ScrollingTextVideo.css';

function ScrollingTextVideo() {
  const [imagePath, setImagePath] = useState('');
  const [text, setText] = useState('');
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [scrollSpeed, setScrollSpeed] = useState(100);
  const [textColor, setTextColor] = useState('#ffffff');
  const [fontSize, setFontSize] = useState(48);
  const [fontFamily, setFontFamily] = useState('Arial');
  const [fps, setFps] = useState(30);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    // Set up event listeners
    window.electronAPI.onScrollingVideoProgress((progressData) => {
      if (progressData.type === 'frame') {
        setProgress(progressData.progress);
        setProgressMessage(`Generating frames: ${progressData.current}/${progressData.total}`);
      } else if (progressData.type === 'encoding') {
        setProgress(progressData.progress);
        setProgressMessage(progressData.message || 'Encoding video...');
      }
    });

    window.electronAPI.onScrollingVideoDone((path) => {
      setIsGenerating(false);
      setProgress(100);
      setProgressMessage('');
      setStatus(`✅ Video created successfully: ${path}`);
    });

    window.electronAPI.onScrollingVideoError((error) => {
      setIsGenerating(false);
      setProgress(0);
      setProgressMessage('');
      setStatus(`❌ Error: ${error}`);
    });

    return () => {
      window.electronAPI.removeScrollingVideoListeners();
    };
  }, []);

  const handleSelectImage = async () => {
    const path = await window.electronAPI.selectSingleImage();
    if (path) {
      setImagePath(path);
      setStatus('');
    }
  };

  const handleGenerate = () => {
    // Validation
    if (!imagePath) {
      setStatus('❌ Please select a background image');
      return;
    }

    if (!text.trim()) {
      setStatus('❌ Please enter text to scroll');
      return;
    }

    if (width <= 0 || height <= 0) {
      setStatus('❌ Width and height must be greater than 0');
      return;
    }

    if (scrollSpeed <= 0) {
      setStatus('❌ Scroll speed must be greater than 0');
      return;
    }

    if (fontSize <= 0) {
      setStatus('❌ Font size must be greater than 0');
      return;
    }

    // Start generation
    setIsGenerating(true);
    setProgress(0);
    setProgressMessage('Initializing...');
    setStatus('🎬 Generating video...');

    const options = {
      imagePath,
      text: text.trim(),
      width: parseInt(width),
      height: parseInt(height),
      scrollSpeed: parseFloat(scrollSpeed),
      textColor,
      fontSize: parseInt(fontSize),
      fontFamily,
      fps: parseInt(fps),
    };

    window.electronAPI.generateScrollingVideo(options);
  };

  const fontFamilies = [
    'Arial',
    'Helvetica',
    'Times New Roman',
    'Georgia',
    'Courier New',
    'Verdana',
    'Trebuchet MS',
    'Comic Sans MS',
    'Impact',
    'Palatino',
  ];

  return (
    <div className="scrolling-video-container">
      <h1>📜 Scrolling Text Video Generator</h1>
      
      <div className="form-section">
        {/* Image Selection */}
        <div className="form-group">
          <label>Background Image</label>
          <div className="input-with-button">
            <input
              type="text"
              value={imagePath ? imagePath.split(/[/\\]/).pop() : ''}
              placeholder="No image selected"
              readOnly
            />
            <button onClick={handleSelectImage} disabled={isGenerating}>
              📸 Select Image
            </button>
          </div>
        </div>

        {/* Text Input */}
        <div className="form-group">
          <label>Scrolling Text</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter your text here. This text will scroll from bottom to top over the background image..."
            rows={6}
            disabled={isGenerating}
          />
        </div>

        {/* Video Dimensions */}
        <div className="form-row">
          <div className="form-group">
            <label>Width (px)</label>
            <input
              type="number"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              min="1"
              disabled={isGenerating}
            />
          </div>
          <div className="form-group">
            <label>Height (px)</label>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              min="1"
              disabled={isGenerating}
            />
          </div>
        </div>

        {/* Scroll Speed and FPS */}
        <div className="form-row">
          <div className="form-group">
            <label>Scroll Speed (px/s)</label>
            <input
              type="number"
              value={scrollSpeed}
              onChange={(e) => setScrollSpeed(e.target.value)}
              min="1"
              step="10"
              disabled={isGenerating}
            />
          </div>
          <div className="form-group">
            <label>FPS</label>
            <input
              type="number"
              value={fps}
              onChange={(e) => setFps(e.target.value)}
              min="1"
              max="60"
              disabled={isGenerating}
            />
          </div>
        </div>

        {/* Text Styling */}
        <div className="form-row">
          <div className="form-group">
            <label>Text Color</label>
            <div className="color-input-wrapper">
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                disabled={isGenerating}
              />
              <input
                type="text"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                disabled={isGenerating}
                className="color-text"
              />
            </div>
          </div>
          <div className="form-group">
            <label>Font Size (px)</label>
            <input
              type="number"
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value)}
              min="1"
              disabled={isGenerating}
            />
          </div>
        </div>

        {/* Font Family */}
        <div className="form-group">
          <label>Font Family</label>
          <select
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            disabled={isGenerating}
          >
            {fontFamilies.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
        </div>

        {/* Generate Button */}
        <button
          className="generate-button"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? '⏳ Generating...' : '🎥 Generate Video'}
        </button>

        {/* Progress Bar */}
        {isGenerating && (
          <div className="progress-section">
            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{ width: `${progress}%` }}
              >
                <span className="progress-text">{progress}%</span>
              </div>
            </div>
            {progressMessage && (
              <p className="progress-message">{progressMessage}</p>
            )}
          </div>
        )}

        {/* Status Message */}
        {status && <p className="status-message">{status}</p>}
      </div>

      {/* Info Section */}
      <div className="info-section">
        <h3>ℹ️ How it works</h3>
        <ul>
          <li>Select a background image (JPG or PNG)</li>
          <li>Enter the text you want to scroll</li>
          <li>Adjust video dimensions, scroll speed, and text styling</li>
          <li>Click "Generate Video" and wait for processing</li>
          <li>The video will be saved to your Desktop</li>
        </ul>
        <p className="tip">
          <strong>Tip:</strong> Longer text or slower scroll speeds will result in longer videos.
          A scroll speed of 100 px/s is a good starting point.
        </p>
      </div>
    </div>
  );
}

export default ScrollingTextVideo;

