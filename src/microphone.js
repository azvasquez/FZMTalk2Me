let recognition = null;
let active       = false;

/**
 * Start continuous speech recognition.
 * @param {{ onTranscript, onError }} callbacks
 * @returns {boolean} false if SpeechRecognition is unsupported
 */
export function startListening({ onTranscript, onError }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    onError?.('SpeechRecognition is not supported — try Chrome or Edge');
    return false;
  }

  recognition              = new SR();
  recognition.continuous   = true;
  recognition.interimResults = true;
  recognition.lang         = 'en-US';

  recognition.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const text    = e.results[i][0].transcript.trim();
      const isFinal = e.results[i].isFinal;
      if (text) onTranscript({ text, isFinal });
    }
  };

  recognition.onerror = (e) => {
    if (e.error === 'no-speech') return; // normal silence — ignore
    onError?.(e.error);
  };

  // Auto-restart: browsers stop recognition after ~60s silence or network hiccups
  recognition.onend = () => {
    if (active) recognition.start();
  };

  active = true;
  recognition.start();
  return true;
}

export function stopListening() {
  active = false;
  recognition?.stop();
  recognition = null;
}

export function isListening() {
  return active;
}
