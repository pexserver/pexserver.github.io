class Music {
    static js = {
        audioContext: null,
        
        init() {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
        },
        
        play(frequency, duration, waveType = 'sine', volume = 0.5) {
            this.init();
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.type = waveType;
            oscillator.frequency.value = frequency;
            
            gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(
                0.01, this.audioContext.currentTime + duration
            );
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration);
        },
        
        playChord(frequencies, duration, waveType = 'sine', volume = 0.3) {
            frequencies.forEach(freq => {
                this.play(freq, duration, waveType, volume);
            });
        },
        
        playSequence(notes, intervalMs = 100) {
            notes.forEach((note, index) => {
                setTimeout(() => {
                    if (Array.isArray(note.frequency)) {
                        this.playChord(note.frequency, note.duration || 0.2, note.waveType, note.volume);
                    } else {
                        this.play(note.frequency, note.duration || 0.2, note.waveType || 'sine', note.volume || 0.5);
                    }
                }, index * intervalMs);
            });
        },
        
        playSweep(startFreq, endFreq, duration, waveType = 'sine') {
            this.init();
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.type = waveType;
            oscillator.frequency.setValueAtTime(startFreq, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(endFreq, this.audioContext.currentTime + duration);
            
            gainNode.gain.setValueAtTime(0.4, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration);
        }
    };
}
