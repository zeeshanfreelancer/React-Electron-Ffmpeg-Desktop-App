import React, { useState } from 'react';
import './App.css';

function App() {
  const [images, setImages] = useState([]);
  const [audio, setAudio] = useState(null);
  const [status, setStatus] = useState('');

  const selectImages = async () => {
    const result = await window.electronAPI.selectImages();
    if (result) setImages(result);
  };

  const selectAudio = async () => {
    const result = await window.electronAPI.selectAudio();
    if (result) setAudio(result);
  };

  const handleGenerate = () => {
    if (!images.length || !audio) {
      setStatus('Please upload images and audio first!');
      return;
    }
    setStatus('Generating video...');
    window.electronAPI.generateVideo({ images, audioPath: audio });
  };

  window.electronAPI.onVideoDone((path) => {
    setStatus(`✅ Video created: ${path}`);
  });

  window.electronAPI.onVideoError((err) => {
    setStatus(`❌ Error: ${err}`);
  });

  return (
    <div className="app">
      <h1>🎬 Slideshow Maker</h1>
      <button onClick={selectImages}>📸 Select Images</button>
      <button onClick={selectAudio}>🎵 Select Audio</button>
      <button onClick={handleGenerate}>🎥 Generate Video</button>
      <p>{status}</p>
    </div>
  );
}

export default App;