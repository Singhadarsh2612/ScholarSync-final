import React from 'react';
import styles from './VideoPanel.module.css';

const VideoPanel = ({ webrtc, onEndCall }) => {
  const {
    localVideoRef,
    remoteVideoRef,
    callState,
    isVideoOn,
    isAudioOn,
    toggleVideo,
    toggleAudio,
  } = webrtc;

  return (
    <div className={styles.panel}>
      {/* Remote video (main) */}
      <div className={styles.remoteWrap}>
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={styles.remoteVideo}
        />
        {callState !== 'in-call' && (
          <div className={styles.callOverlay}>
            {callState === 'calling' && (
              <div className={styles.callingMsg}>
                <span className="pulse" style={{ fontSize: '2rem' }}>📹</span>
                <p>Connecting…</p>
              </div>
            )}
            {callState === 'idle' && (
              <div className={styles.callingMsg}>
                <span style={{ fontSize: '2rem' }}>📷</span>
                <p>Starting camera…</p>
              </div>
            )}
            {callState === 'ended' && (
              <div className={styles.callingMsg}>
                <span style={{ fontSize: '2rem' }}>📵</span>
                <p>Call ended</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Local video (picture-in-picture) */}
      <div className={styles.localWrap}>
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={styles.localVideo}
        />
        {!isVideoOn && (
          <div className={styles.videoOffBadge}>Cam Off</div>
        )}
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <button
          className={`${styles.ctrlBtn} ${!isAudioOn ? styles.ctrlOff : ''}`}
          onClick={toggleAudio}
          title={isAudioOn ? 'Mute mic' : 'Unmute mic'}
        >
          {isAudioOn ? '🎤' : '🔇'}
          <span>{isAudioOn ? 'Mute' : 'Unmute'}</span>
        </button>

        <button
          className={`${styles.ctrlBtn} ${!isVideoOn ? styles.ctrlOff : ''}`}
          onClick={toggleVideo}
          title={isVideoOn ? 'Turn off camera' : 'Turn on camera'}
        >
          {isVideoOn ? '📹' : '📷'}
          <span>{isVideoOn ? 'Cam Off' : 'Cam On'}</span>
        </button>

        <button
          className={`${styles.ctrlBtn} ${styles.endBtn}`}
          onClick={onEndCall}
          title="End call"
        >
          📵
          <span>End Call</span>
        </button>
      </div>
    </div>
  );
};

export default VideoPanel;
