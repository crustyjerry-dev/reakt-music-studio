import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as Tone from 'tone';

const Studio = ({ isStudio, setIsStudio }) => {
  const patternRef = useRef(Array(16).fill(0));
  const synthRef = useRef(null);
  const kickRef = useRef(null);
  const loopRef = useRef(null);

  const generatePattern = useCallback(() => {
    patternRef.current = Array.from({length: 16}, () => Math.random() < 0.25 ? 1 : 0);
  }, []);

  const initStudio = useCallback(async () => {
    await Tone.start();
    synthRef.current = new Tone.Synth().toDestination();
    kickRef.current = new Tone.MembraneSynth({ pitchDecay: 0.05 }).toDestination();
    Tone.Transport.bpm.value = 130;
    generatePattern();
    const loop = new Tone.Loop((time) => {
      const step = Math.floor(Tone.Transport.ticks / 6) % 16;
      if (patternRef.current[step]) {
        kickRef.current.triggerAttackRelease('C1', '16n', time);
      }
      if (Math.random() < 0.15) {
        synthRef.current.triggerAttackRelease(
          Tone.Frequency(Math.random() * 400 + 200).toNote(),
          '8n',
          time
        );
      }
    }, '16n');
    loopRef.current = loop;
    loop.start(0);
  }, [generatePattern]);

  const toggleStudio = useCallback(async () => {
    if (isStudio) {
      if (Tone.Transport.state === 'started') {
        Tone.Transport.stop();
      }
      if (loopRef.current) {
        loopRef.current.dispose();
        loopRef.current = null;
      }
      if (synthRef.current) {
        synthRef.current.dispose();
        synthRef.current = null;
      }
      if (kickRef.current) {
        kickRef.current.dispose();
        kickRef.current = null;
      }
      setIsStudio(false);
    } else {
      await initStudio();
      setIsStudio(true);
    }
  }, [isStudio, initStudio, setIsStudio]);

  const playStop = useCallback(() => {
    if (Tone.Transport.state === 'started') {
      Tone.Transport.stop();
    } else {
      Tone.Transport.start();
    }
  }, []);

  useEffect(() => {
    return () => {
      if (loopRef.current) loopRef.current.dispose();
      if (synthRef.current) synthRef.current.dispose();
      if (kickRef.current) kickRef.current.dispose();
      Tone.Transport.stop();
    };
  }, []);

  return (
    <div style={{ position: 'absolute', bottom: 20, right: 20, background: 'rgba(0,0,0,0.7)', padding: '10px', borderRadius: '8px', fontSize: '12px' }}>
      <button onClick={toggleStudio} style={{ marginBottom: '5px', padding: '4px 8px' }}>
        {isStudio ? 'Exit Studio' : 'Enter Studio'}
      </button>
      {isStudio && (
        <>
          <button onClick={generatePattern} style={{ marginRight: '5px', padding: '4px 6px', fontSize: '11px' }}>Gen Beats</button>
          <button onClick={playStop} style={{ padding: '4px 6px', fontSize: '11px' }}>
            {Tone.Transport.state === 'started' ? 'Stop' : 'Play'}
          </button>
        </>
      )}
    </div>
  );
};

export default Studio;