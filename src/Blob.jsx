import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';
import './SunShader'; 

const Blob = ({ state }) => {
  const materialRef = useRef();

  // Define our Color Palettes
  const colors = useMemo(() => ({
    idle: {
      core: new THREE.Color("#550000"),   // Dark Red
      surface: new THREE.Color("#ff5500"), // Orange
      distort: 0.1, // Smooth surface
      speed: 0.2
    },
    thinking: {
      core: new THREE.Color("#330000"),   // Black/Red Core
      surface: new THREE.Color("#ff0000"), // PURE RED
      distort: 0.6, // HUGE SPIKES (Flares)
      speed: 2.0    // Violent boiling
    },
    speaking: {
      core: new THREE.Color("#ff8800"),
      surface: new THREE.Color("#ffffaa"), // White Hot
      distort: 0.2,
      speed: 0.5
    }
  }), []);

  useFrame(({ clock }) => {
    if (!materialRef.current) return;

    // 1. Get Target Data based on State
    const target = colors[state] || colors.idle;

    // 2. LERP (Smoothly transition) Values
    // This makes the color shift gradual (0.05 speed) instead of instant
    
    // Colors
    materialRef.current.uColor1.lerp(target.core, 0.05);
    materialRef.current.uColor2.lerp(target.surface, 0.05);
    
    // Physics
    // We manually interpolate numbers since .lerp() is only for colors/vectors
    materialRef.current.uDistort = THREE.MathUtils.lerp(
      materialRef.current.uDistort, 
      target.distort, 
      0.05
    );

    // Time (Speed of boiling)
    materialRef.current.time += target.speed * 0.02;
  });

  return (
    <Sphere args={[1.5, 128, 128]}> 
      {/* 128,128 segments is CRITICAL. 
         Low polygon count = Blocky spikes. 
         High polygon count = Sharp, needle-like flares.
      */}
      <sunShaderMaterial 
        ref={materialRef} 
        transparent={true}
        uColor1={colors.idle.core}
        uColor2={colors.idle.surface}
        uDistort={0.1}
      />
    </Sphere>
  );
};

export default Blob;