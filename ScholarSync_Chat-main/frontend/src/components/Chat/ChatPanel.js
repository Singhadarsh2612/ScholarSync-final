import React, { useState, useRef, useEffect } from 'react';
import styles from './ChatPanel.module.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const isImageUrl = (url) => /\.(jpg|jpeg|png|gif|webp)$/i.test(url);

const MessageBubble = ({ msg, isOwn, serverUrl }) => {
  const time = new Date(msg.timestamp).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className={`${styles.msgRow} ${isOwn ? styles.msgRowOwn : ''}`}>
      <div className={`${styles.bubble} ${isOwn ? styles.bubbleOwn : styles.bubblePeer}`}>
        {msg.message && <p className={styles.msgText}>{msg.message}</p>}

        {msg.fileUrl && (
          <div className={styles.fileBlock}>
            {isImageUrl(msg.fileUrl) ? (
              <a href={msg.fileUrl} target="_blank" rel="noreferrer">
                <img src={msg.fileUrl} alt={msg.fileName || 'image'} className={styles.fileImg} />
              </a>
            ) : (
              <a href={msg.fileUrl} target="_blank" rel="noreferrer" className={styles.fileLink}>
                <span className={styles.fileIcon}>📎</span>
                <span className={styles.fileName}>{msg.fileName || 'File'}</span>
                <span className={styles.fileDownload}>↓</span>
              </a>
            )}
          </div>
        )}

        <span className={styles.msgTime}>{time}</span>
      </div>
    </div>
  );
};

const ChatPanel = ({
  messages,
  role,
  expertName,
  isTyping,
  onSendMessage,
  onSendFile,
  onTyping,
  compact,
}) => {
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendMessage(text.trim());
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await onSendFile(file);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const groupLabel = (msg, prev) => {
    if (!prev) return true;
    if (msg.sender !== prev.sender) return true;
    const gap = new Date(msg.timestamp) - new Date(prev.timestamp);
    return gap > 5 * 60 * 1000; // 5 minutes
  };

  return (
    <div className={`${styles.panel} ${compact ? styles.compact : ''}`}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.headerTitle}>
          {role === 'expert' ? '💬 Chat with User' : `💬 Chat with ${expertName || 'Expert'}`}
        </span>
        <span className={styles.msgCount}>{messages.length} messages</span>
      </div>

      {/* Messages */}
      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.emptyChat}>
            <span>No messages yet.</span>
            <p>Start the conversation below.</p>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isOwn = msg.sender === role;
          const showLabel = groupLabel(msg, messages[idx - 1]);
          return (
            <React.Fragment key={msg._id || idx}>
              {showLabel && (
                <div className={styles.senderLabel}>
                  {msg.sender === 'expert' ? (expertName || 'Expert') : 'User'}
                </div>
              )}
              <MessageBubble msg={msg} isOwn={isOwn} serverUrl={API_URL} />
            </React.Fragment>
          );
        })}

        {isTyping && (
          <div className={styles.typingIndicator}>
            <span /><span /><span />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form className={styles.inputArea} onSubmit={handleSend}>
        <button
          type="button"
          className={styles.attachBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="Attach file"
        >
          {uploading ? <span className="spin">◌</span> : '📎'}
        </button>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*,.pdf,.doc,.docx,.txt"
          style={{ display: 'none' }}
        />

        <textarea
          className={styles.textInput}
          value={text}
          onChange={e => { setText(e.target.value); onTyping(); }}
          onKeyDown={handleKeyDown}
          placeholder="Type a message… (Enter to send)"
          rows={1}
        />

        <button
          type="submit"
          className={styles.sendBtn}
          disabled={!text.trim()}
          title="Send message"
        >
          ↑
        </button>
      </form>
    </div>
  );
};

export default ChatPanel;
