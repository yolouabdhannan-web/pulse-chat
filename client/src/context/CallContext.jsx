import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Mic, MicOff, Phone, PhoneOff, Video, X } from 'lucide-react';
import { api, errMsg } from '../lib/api.js';
import { socket } from '../lib/socket.js';

const Ctx = createContext(null);
export const useCalls = () => useContext(Ctx);

export function CallProvider({ children }) {
  const [call, setCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [muted, setMuted] = useState(false);
  const [callError, setCallError] = useState('');
  const peer = useRef(null);
  const local = useRef(null);
  const remote = useRef(null);
  const active = useRef(null);
  const candidates = useRef([]);
  const outgoingCandidates = useRef([]);
  const remoteReady = useRef(false);

  const signal = useCallback((data) => new Promise((resolve, reject) => {
    socket.timeout(8000).emit('call:signal', data, (error, result) => {
      if (error || !result?.ok) reject(new Error(result?.error || 'Signal d’appel impossible'));
      else resolve();
    });
  }), []);

  const sendIce = useCallback(({ conversationId, targetId, candidate }) => {
    signal({ type: 'ice', conversationId, targetId, candidate })
      .catch((error) => console.error('Échec de transmission ICE', error));
  }, [signal]);

  const flushOutgoingCandidates = useCallback(() => {
    remoteReady.current = true;
    outgoingCandidates.current.splice(0).forEach(sendIce);
  }, [sendIce]);

  const closeMedia = useCallback(() => {
    peer.current?.close();
    peer.current = null;
    local.current?.getTracks().forEach((track) => track.stop());
    local.current = null;
    remote.current = null;
    candidates.current = [];
    outgoingCandidates.current = [];
    remoteReady.current = false;
    active.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setMuted(false);
    setCall(null);
  }, []);

  const getIceServers = useCallback(async () => {
    try {
      const { data } = await api.get('/calls/config');
      if (!Array.isArray(data.iceServers) || data.iceServers.length === 0) {
        throw new Error('Aucun serveur ICE configuré pour les appels.');
      }
      return data.iceServers;
    } catch (error) {
      throw new Error(errMsg(error, 'Impossible de charger la configuration réseau des appels.'));
    }
  }, []);

  const createPeer = useCallback((conversationId, targetId, stream, iceServers) => {
    const connection = new RTCPeerConnection({
      iceServers,
    });
    peer.current = connection;
    stream.getTracks().forEach((track) => connection.addTrack(track, stream));
    connection.ontrack = (event) => {
      remote.current = event.streams[0];
      setRemoteStream(event.streams[0]);
    };
    connection.onconnectionstatechange = () => {
      if (connection.connectionState === 'failed') {
        setCallError('Connexion impossible. Vérifiez le réseau ou configurez un serveur TURN.');
      }
    };
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        const ice = {
          conversationId,
          targetId,
          candidate: event.candidate.toJSON(),
        };
        if (remoteReady.current) sendIce(ice);
        else outgoingCandidates.current.push(ice);
      }
    };
    return connection;
  }, [sendIce]);

  const flushCandidates = useCallback(async () => {
    const connection = peer.current;
    if (!connection?.remoteDescription) return;
    const pending = candidates.current;
    candidates.current = [];
    for (const candidate of pending) await connection.addIceCandidate(candidate);
  }, []);

  const endCall = useCallback(async (notify = true) => {
    const current = active.current;
    if (notify && current) {
      try {
        await signal({
          type: 'end',
          conversationId: current.conversationId,
          targetId: current.peerId,
        });
      } catch (error) {
        console.error('Échec de fermeture de l’appel', error);
      }
    }
    closeMedia();
  }, [closeMedia, signal]);

  const startCall = useCallback(async (conversationId, peerId, peerName, media) => {
    if (active.current) throw new Error('Un appel est déjà en cours');
    setCallError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Les appels nécessitent HTTPS (ou localhost) et un navigateur compatible.');
    }
    const iceServers = await getIceServers();
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: media === 'video',
      });
    } catch (error) {
      throw new Error(error.name === 'NotAllowedError'
        ? 'Autorisez l’accès au microphone et à la caméra pour démarrer l’appel.'
        : error.name === 'NotFoundError'
          ? 'Aucun microphone ou caméra compatible n’a été trouvé.'
          : error.message || 'Impossible d’accéder au microphone ou à la caméra.');
    }
    local.current = stream;
    setLocalStream(stream);
    active.current = { conversationId, peerId, peerName, media };
    setCall({ ...active.current, status: 'outgoing' });
    try {
      const connection = createPeer(conversationId, peerId, stream, iceServers);
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      await signal({
        type: 'offer',
        conversationId,
        targetId: peerId,
        media,
        sdp: connection.localDescription.sdp,
      });
      flushOutgoingCandidates();
    } catch (error) {
      closeMedia();
      throw error;
    }
  }, [closeMedia, createPeer, flushOutgoingCandidates, getIceServers, signal]);

  const answerCall = useCallback(async () => {
    const invitation = active.current;
    if (!invitation?.offer) return;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Les appels nécessitent HTTPS (ou localhost) et un navigateur compatible.');
      }
      const iceServers = await getIceServers();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: invitation.media === 'video',
      });
      local.current = stream;
      setLocalStream(stream);
      const connection = createPeer(invitation.conversationId, invitation.peerId, stream, iceServers);
      await connection.setRemoteDescription({ type: 'offer', sdp: invitation.offer });
      await flushCandidates();
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      await signal({
        type: 'answer',
        conversationId: invitation.conversationId,
        targetId: invitation.peerId,
        sdp: connection.localDescription.sdp,
      });
      flushOutgoingCandidates();
      setCall((current) => ({ ...current, status: 'active' }));
    } catch (error) {
      closeMedia();
      setCallError(error.name === 'NotAllowedError'
        ? 'Autorisez l’accès au microphone et à la caméra pour rejoindre l’appel.'
        : error.message || 'Impossible de rejoindre cet appel');
    }
  }, [closeMedia, createPeer, flushCandidates, flushOutgoingCandidates, getIceServers, signal]);

  useEffect(() => {
    const onSignal = async (message) => {
      try {
      if (message.type === 'offer') {
        if (active.current) {
          signal({
            type: 'reject',
            conversationId: message.conversationId,
            targetId: message.from,
          }).catch((error) => console.error('Échec du refus d’appel', error));
          return;
        }
        active.current = {
          conversationId: message.conversationId,
          peerId: message.from,
          peerName: message.username,
          media: message.media,
          offer: message.sdp,
        };
        setCall({ ...active.current, status: 'incoming' });
        return;
      }

      const current = active.current;
      if (!current || current.peerId !== message.from
        || current.conversationId !== message.conversationId) return;
      if (message.type === 'reject' || message.type === 'end') {
        closeMedia();
        return;
      }
      if (message.type === 'answer' && peer.current) {
        await peer.current.setRemoteDescription({ type: 'answer', sdp: message.sdp });
        await flushCandidates();
        setCall((previous) => ({ ...previous, status: 'active' }));
      } else if (message.type === 'ice') {
        if (peer.current?.remoteDescription) await peer.current.addIceCandidate(message.candidate);
        else candidates.current.push(message.candidate);
      }
      } catch (error) {
        setCallError(error.message || 'Erreur pendant l’appel');
        closeMedia();
      }
    };
    socket.on('call:signal', onSignal);
    return () => socket.off('call:signal', onSignal);
  }, [closeMedia, flushCandidates, signal]);

  const value = {
    call,
    localStream,
    remoteStream,
    muted,
    callError,
    clearCallError: () => setCallError(''),
    startCall,
    answerCall,
    endCall,
    toggleMute: () => {
      const next = !muted;
      local.current?.getAudioTracks().forEach((track) => { track.enabled = !next; });
      setMuted(next);
    },
    toggleVideo: () => {
      local.current?.getVideoTracks().forEach((track) => { track.enabled = !track.enabled; });
    },
  };

  return <Ctx.Provider value={value}>{children}<CallPanel /></Ctx.Provider>;
}

function Stream({ stream, muted = false, ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} {...props} />;
}

function CallAudio({ stream }) {
  const ref = useRef(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    audio.srcObject = stream;
    audio.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
  }, [stream]);

  return (
    <>
      <audio ref={ref} autoPlay />
      {blocked && (
        <button type="button" onClick={() => ref.current?.play().then(() => setBlocked(false)).catch(() => setBlocked(true))}
          className="mb-4 rounded-xl bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-900">
          Activer le son de l’appel
        </button>
      )}
    </>
  );
}

function CallPanel() {
  const { call, localStream, remoteStream, muted, callError, clearCallError, answerCall, endCall, toggleMute, toggleVideo } = useCalls();
  return (
    <>
      <AnimatePresence>
        {call && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] grid place-items-center bg-emerald-950/70 p-4 backdrop-blur-md">
            <motion.section initial={{ y: 18, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 18, scale: 0.97 }}
              className="glass-strong w-full max-w-lg overflow-hidden rounded-3xl p-5 sm:p-7">
              <div className="mb-5 text-center">
                <p className="text-xs font-semibold uppercase tracking-[.2em] text-emerald-700">
                  {call.status === 'incoming' ? 'Appel entrant' : call.status === 'outgoing' ? 'Appel en cours…' : 'Appel connecté'}
                </p>
                <h2 className="mt-2 text-2xl font-bold">{call.peerName}</h2>
                <p className="mt-1 text-sm text-slate-400">{call.media === 'video' ? 'Appel vidéo' : 'Appel audio'}</p>
              </div>
              {call.media === 'video' && (
                <div className="relative mb-5 aspect-video overflow-hidden rounded-2xl bg-emerald-950/60">
                  {remoteStream && <Stream stream={remoteStream} className="h-full w-full object-cover" />}
                  {!remoteStream && <div className="grid h-full place-items-center text-sm text-slate-400">En attente de la vidéo…</div>}
                  {localStream && <Stream stream={localStream} muted className="absolute bottom-3 right-3 h-24 w-32 rounded-xl border border-white/20 bg-emerald-950 object-cover" />}
                </div>
              )}
              {call.media === 'audio' && remoteStream && <CallAudio stream={remoteStream} />}
              <div className="flex items-center justify-center gap-3">
                {call.status === 'incoming' ? (
                  <>
                    <button onClick={answerCall} className="grid h-12 w-12 place-items-center rounded-full bg-emerald-500 text-white" aria-label="Répondre"><Phone size={20} /></button>
                    <button onClick={() => endCall()} className="grid h-12 w-12 place-items-center rounded-full bg-emerald-700 text-white" aria-label="Refuser"><PhoneOff size={20} /></button>
                  </>
                ) : (
                  <>
                    <button onClick={toggleMute} className="grid h-11 w-11 place-items-center rounded-full bg-emerald-100 text-emerald-800" aria-label={muted ? 'Activer le micro' : 'Couper le micro'}>{muted ? <MicOff size={19} /> : <Mic size={19} />}</button>
                    {call.media === 'video' && <button onClick={toggleVideo} className="grid h-11 w-11 place-items-center rounded-full bg-emerald-100 text-emerald-800" aria-label="Activer/désactiver la caméra"><Video size={19} /></button>}
                    <button onClick={() => endCall()} className="grid h-12 w-12 place-items-center rounded-full bg-emerald-700 text-white" aria-label="Raccrocher"><PhoneOff size={20} /></button>
                  </>
                )}
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
      {callError && (
        <div role="alert" className="fixed bottom-5 left-1/2 z-[80] flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-900 px-4 py-3 text-sm text-white shadow-xl">
          <span>{callError}</span>
          <button onClick={clearCallError} aria-label="Fermer le message" className="rounded p-1 hover:bg-white/10"><X size={16} /></button>
        </div>
      )}
    </>
  );
}
