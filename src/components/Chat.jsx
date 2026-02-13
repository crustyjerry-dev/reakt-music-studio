import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db, query, orderByChild, limitToLast, onValue, push, serverTimestamp, ref } from '../firebase.js';

const Chat = ({ uid }) => {
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const messagesQuery = useMemo(() => query(ref(db, 'messages'), orderByChild('time'), limitToLast(50)), []);

  useEffect(() => {
    const unsubscribe = onValue(messagesQuery, (snapshot) => {
      const msgs = [];
      snapshot.forEach((childSnapshot) => {
        msgs.push(childSnapshot.val());
      });
      setMessages(msgs);
    });
    return unsubscribe;
  }, [messagesQuery]);

  const sendMessage = useCallback(async () => {
    if (!uid || !messageText.trim()) return;
    try {
      await push(ref(db, 'messages'), {
        uid: uid.slice(0,8),
        text: messageText.trim(),
        time: serverTimestamp(),
      });
      setMessageText('');
    } catch (err) {
      console.error(err);
    }
  }, [uid, messageText]);

  return (
    <div style={{ marginTop: '10px', fontSize: '12px' }}>
      <div style={{ height: '120px', overflowY: 'auto', background: 'rgba(0,0,0,0.8)', padding: '5px', borderRadius: '4px' }}>
        {messages.slice(-10).map((m, i) => (
          <div key={i} style={{ marginBottom: '2px' }}>
            <span style={{ color: '#00ff00' }}>{m.uid}:</span> {m.text}
          </div>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} style={{ marginTop: '5px' }}>
        <input 
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder="Chat..."
          style={{ width: '140px', padding: '2px', fontSize: '12px', background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid #444' }}
          maxLength={100}
        />
        <button type="submit" style={{ padding: '2px 8px', fontSize: '12px', marginLeft: '5px' }}>Send</button>
      </form>
    </div>
  );
};

export default Chat;