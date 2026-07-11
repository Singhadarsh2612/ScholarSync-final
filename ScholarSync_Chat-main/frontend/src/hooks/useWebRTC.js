import { useRef, useState, useCallback, useEffect } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export const useWebRTC = ({ socket, roomId, isExpert }) => {
  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnection  = useRef(null);
  const localStream     = useRef(null);

  const [callState, setCallState] = useState('idle'); // idle | calling | in-call | ended
  const [isVideoOn,  setIsVideoOn]  = useState(true);
  const [isAudioOn,  setIsAudioOn]  = useState(true);
  const [remoteStream, setRemoteStream] = useState(null);

  const startLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStream.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch (err) {
      console.error('getUserMedia error:', err);
      throw err;
    }
  }, []);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc:ice-candidate', { roomId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      setRemoteStream(stream);
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setCallState('in-call');
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        setCallState('ended');
      }
    };

    if (localStream.current) {
      localStream.current.getTracks().forEach(track =>
        pc.addTrack(track, localStream.current)
      );
    }

    peerConnection.current = pc;
    return pc;
  }, [socket, roomId]);

  const startCall = useCallback(async () => {
    try {
      await startLocalStream();
      const pc = createPeerConnection();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket?.emit('webrtc:offer', { roomId, offer });
      socket?.emit('callStarted', { roomId });
      setCallState('calling');
    } catch (err) {
      console.error('Start call error:', err);
    }
  }, [startLocalStream, createPeerConnection, socket, roomId]);

  const handleOffer = useCallback(async ({ offer }) => {
    try {
      await startLocalStream();
      const pc = createPeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket?.emit('webrtc:answer', { roomId, answer });
      setCallState('in-call');
    } catch (err) {
      console.error('Handle offer error:', err);
    }
  }, [startLocalStream, createPeerConnection, socket, roomId]);

  const handleAnswer = useCallback(async ({ answer }) => {
    try {
      await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(answer));
      setCallState('in-call');
    } catch (err) {
      console.error('Handle answer error:', err);
    }
  }, []);

  const handleIceCandidate = useCallback(async ({ candidate }) => {
    try {
      await peerConnection.current?.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('ICE candidate error:', err);
    }
  }, []);

  const endCall = useCallback(() => {
    peerConnection.current?.close();
    peerConnection.current = null;
    localStream.current?.getTracks().forEach(t => t.stop());
    localStream.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setCallState('idle');
    setRemoteStream(null);
    socket?.emit('callEnded', { roomId });
  }, [socket, roomId]);

  const toggleVideo = useCallback(() => {
    if (localStream.current) {
      const track = localStream.current.getVideoTracks()[0];
      if (track) { track.enabled = !track.enabled; setIsVideoOn(track.enabled); }
    }
  }, []);

  const toggleAudio = useCallback(() => {
    if (localStream.current) {
      const track = localStream.current.getAudioTracks()[0];
      if (track) { track.enabled = !track.enabled; setIsAudioOn(track.enabled); }
    }
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('webrtc:offer',         handleOffer);
    socket.on('webrtc:answer',        handleAnswer);
    socket.on('webrtc:ice-candidate', handleIceCandidate);
    socket.on('callEnded',            endCall);

    return () => {
      socket.off('webrtc:offer',         handleOffer);
      socket.off('webrtc:answer',        handleAnswer);
      socket.off('webrtc:ice-candidate', handleIceCandidate);
      socket.off('callEnded',            endCall);
    };
  }, [socket, handleOffer, handleAnswer, handleIceCandidate, endCall]);

  useEffect(() => {
    return () => {
      localStream.current?.getTracks().forEach(t => t.stop());
      peerConnection.current?.close();
    };
  }, []);

  return {
    localVideoRef,
    remoteVideoRef,
    callState,
    isVideoOn,
    isAudioOn,
    remoteStream,
    startCall,
    endCall,
    toggleVideo,
    toggleAudio,
  };
};
