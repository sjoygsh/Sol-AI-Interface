import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import Blob from './Blob';
import { chatWithBrain } from './api';
import { generateImage } from './comfy'; // Import the artist

// --- HELPER: TEXT PARSER ---
// Separates the <think> block from the actual response
const parseResponse = (text) => {
  const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/);
  if (thinkMatch) {
    return {
      thought: thinkMatch[1].trim(),
      answer: text.replace(thinkMatch[0], '').trim()
    };
  }
  return { thought: null, answer: text };
};

function App() {
  const [aiState, setAiState] = useState('idle'); 
  const [inputText, setInputText] = useState('');
  
  // Response Data (Text + Thoughts)
  const [responseData, setResponseData] = useState({ 
    thought: null, 
    answer: "System Online. Neural Link Established." 
  });
  
  const [showThought, setShowThought] = useState(false); // Toggle for logs
  const [generatedImage, setGeneratedImage] = useState(null); // State for the image

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    
    const userQuery = inputText;
    setInputText(''); 
    setGeneratedImage(null); // Clear previous images
    setShowThought(false);   // Reset logs
    
    // --- BRANCH 1: EDIT MODE ---
    // Usage: /edit filename.png selection -> prompt
    if (userQuery.toLowerCase().startsWith('/edit ')) {
      setAiState('thinking');
      setResponseData({ thought: "Vision Pipeline Active", answer: "Scanning image for editing..." });
      
      // Parse Command: "/edit photo.png face -> robot"
      const cleanQuery = userQuery.replace('/edit ', '');
      // Take the first word as filename (e.g. "photo.png")
      const [filename, ...restParts] = cleanQuery.split(' '); 
      const rest = restParts.join(' ');

      if (!rest || !rest.includes('->')) {
         setResponseData({ thought: "Syntax Error", answer: "Usage: /edit image.png what_to_select -> what_to_paint" });
         setAiState('idle');
         return;
      }

      const [selection, generation] = rest.split('->');

      // Call the API with specific structure for editing
      const imageUrl = await generateImage({
        type: 'edit',
        filename: filename.trim(),
        selection: selection.trim(),
        prompt: generation.trim()
      });
      
      if (imageUrl) {
        setGeneratedImage(imageUrl);
        setResponseData({ thought: "Edit Complete", answer: "Image modification successful." });
      } else {
        setResponseData({ thought: "IO Error", answer: "Could not find file. Is it in ComfyUI/input folder?" });
      }
      setAiState('idle');
      return; 
    }

    // --- BRANCH 2: IMAGE GENERATION ---
    // Usage: /img prompt --no negative
    if (userQuery.toLowerCase().startsWith('/img ')) {
      setAiState('thinking');
      setResponseData({ thought: "ComfyUI Pipeline Active", answer: "Initializing Visual Cortex..." });
      
      const fullPrompt = userQuery.replace('/img ', '');
      let positive = fullPrompt;
      let negative = "";

      // Parse logic for Negative Prompt
      if (fullPrompt.includes("--no")) {
        const parts = fullPrompt.split("--no");
        positive = parts[0].trim();
        negative = parts[1].trim();
      }

      // Call the API with specific structure for generation
      const imageUrl = await generateImage({
        type: 'gen',
        prompt: positive,
        negative: negative
      });
      
      if (imageUrl) {
        setGeneratedImage(imageUrl);
        setResponseData({ 
          thought: `Render Complete. Seed: ${Math.floor(Math.random() * 1000000)}`, 
          answer: "Visual construction complete. Displaying output." 
        });
      } else {
        setResponseData({ 
          thought: "Connection Error", 
          answer: "Failed to connect to ComfyUI. Is the backend running with --listen?" 
        });
      }
      
      setAiState('idle'); // Return to idle immediately after image
      return; 
    }

    // --- BRANCH 3: NORMAL TEXT CHAT ---
    setAiState('thinking');
    setResponseData({ thought: null, answer: "Analyzing..." });

    const rawResponse = await chatWithBrain(userQuery);
    
    // Parse the <think> block
    const parsed = parseResponse(rawResponse);
    setResponseData(parsed);
    
    setAiState('speaking');
    
    // Calculate reading time before going back to idle
    setTimeout(() => setAiState('idle'), 3000);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSendMessage();
  };

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000", position: 'relative', overflow: 'hidden' }}>
      
      {/* --- 3D SCENE --- */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
        <Canvas camera={{ position: [0, 2, 7] }}> {/* Camera HIGH so sun is at top */}
          <color attach="background" args={['#000000']} /> 
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
          
          {/* Shift Sun UP */}
          <group position={[0, 1.5, 0]}>
             <Blob state={aiState} />
          </group>

          <OrbitControls enableZoom={false} enablePan={false} />
        </Canvas>
      </div>

      {/* --- UI LAYER --- */}
      <div style={{ 
        position: 'absolute', zIndex: 2, 
        width: '100%', height: '100%', 
        display: 'flex', flexDirection: 'column', 
        padding: '20px', boxSizing: 'border-box', pointerEvents: 'none' 
      }}>
        
        {/* 1. TOP HEADER */}
        <div style={{ 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '20px'
        }}>
          <div>
            <h1 style={{ 
              fontFamily: 'Orbitron, sans-serif', fontSize: '3rem', margin: 0, 
              color: 'white', letterSpacing: '10px', textShadow: '0 0 20px rgba(255, 100, 0, 0.8)' 
            }}>
              SOL
            </h1>
            <span style={{ color: '#666', fontSize: '0.8rem', letterSpacing: '2px', fontFamily: 'Orbitron' }}>
              SENTIENT ORBITAL LATTICE // V.3.1
            </span>
          </div>
          
          <div style={{ textAlign: 'right' }}>
             <div style={{ color: aiState === 'thinking' ? '#ff0000' : '#ffaa00', fontFamily: 'Orbitron', fontSize: '1.2rem' }}>
                {aiState.toUpperCase()}
             </div>
             <div style={{ fontSize: '0.7rem', color: '#444', fontFamily: 'Orbitron' }}>CORE TEMP: 15MK</div>
          </div>
        </div>

        {/* 2. SPACER (Pushes everything down) */}
        <div style={{ flex: 1 }}></div>

        {/* 3. GENERATED IMAGE DISPLAY */}
        {generatedImage && (
          <div style={{ 
            pointerEvents: 'auto', textAlign: 'center', marginBottom: '10px',
            animation: 'fadeIn 1s ease-in'
          }}>
            <img 
              src={generatedImage} 
              alt="Generated Output" 
              style={{ 
                maxHeight: '40vh', maxWidth: '100%', 
                border: '1px solid #ff4400', borderRadius: '10px',
                boxShadow: '0 0 30px rgba(255, 68, 0, 0.2)'
              }} 
            />
          </div>
        )}

        {/* 4. RESPONSE TERMINAL (Bottom) */}
        <div style={{ 
          pointerEvents: 'auto', 
          background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(10, 5, 0, 0.9) 100%)',
          padding: '20px', borderRadius: '20px',
          backdropFilter: 'blur(2px)',
          marginBottom: '20px',
          maxHeight: '35vh', overflowY: 'auto'
        }}>
          
          {/* LOGS (Hidden by default) */}
          {responseData.thought && (
            <div style={{ marginBottom: '15px' }}>
              <button 
                onClick={() => setShowThought(!showThought)}
                style={{
                  background: 'none', border: '1px solid #333', color: '#666',
                  fontFamily: 'Orbitron', fontSize: '0.7rem', padding: '5px 10px',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px'
                }}
              >
                {showThought ? '[-]' : '[+]'} SYSTEM_LOGS // NEURAL_PROCESS
              </button>
              
              {showThought && (
                <div style={{ 
                  marginTop: '10px', padding: '10px', 
                  borderLeft: '2px solid #333', 
                  color: '#555', fontFamily: 'monospace', fontSize: '0.8rem',
                  whiteSpace: 'pre-wrap'
                }}>
                  {responseData.thought}
                </div>
              )}
            </div>
          )}

          {/* MAIN TEXT */}
          <div style={{ 
            color: '#eee', fontSize: '1.2rem', lineHeight: '1.6', 
            textShadow: '0 0 5px rgba(0,0,0,1)', fontFamily: 'Rajdhani, sans-serif'
          }}>
            {responseData.answer}
          </div>

        </div>

        {/* 5. INPUT FIELD */}
        <div style={{ display: 'flex', gap: '15px', pointerEvents: 'auto' }}>
          <input 
            type="text" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="ENTER COMMAND (Try: /img fire dragon)..."
            style={{
              flex: 1, padding: '20px', borderRadius: '5px', border: '1px solid #333',
              background: 'rgba(0, 0, 0, 0.8)', color: '#ffaa00', fontSize: '1.2rem',
              outline: 'none', fontFamily: 'Orbitron, sans-serif', letterSpacing: '1px'
            }}
          />
          <button 
            onClick={handleSendMessage}
            style={{
              padding: '0 40px', borderRadius: '5px', border: '1px solid #ff4400',
              background: 'rgba(50, 10, 0, 0.5)', color: '#ff4400', 
              fontFamily: 'Orbitron', fontWeight: 'bold', cursor: 'pointer',
              transition: '0.2s', letterSpacing: '2px'
            }}
          >
            TRANSMIT
          </button>
        </div>

      </div>
    </div>
  );
}

export default App;