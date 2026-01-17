// client/src/components/Chatbot/Chatbot.jsx
import { useState, useRef, useEffect } from 'react';
import api from '../../api/api';
import { AiOutlineSend, AiOutlineClose, AiOutlineRobot, AiOutlineUser } from 'react-icons/ai';
import { BiLoader } from 'react-icons/bi';
import './Chatbot.css';

const Chatbot = ({ isOpen, onClose, patientName }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize chat with welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      initializeChat();
    }
  }, [isOpen]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const initializeChat = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await api.post(
        'http://localhost:5000/api/chatbot/chat',
        {
          message: 'Hello',
          conversationHistory: []
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setMessages([
        {
          type: 'bot',
          content: response.data.response,
          timestamp: new Date(),
          doctors: response.data.doctors || []
        }
      ]);
    } catch (error) {
      console.error('Error initializing chat:', error);
      setMessages([
        {
          type: 'bot',
          content: 'Hello! I\'m your healthcare assistant. How can I help you today?',
          timestamp: new Date()
        }
      ]);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');

    // Add user message to chat
    const newUserMessage = {
      type: 'user',
      content: userMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newUserMessage]);
    setIsLoading(true);

    try {
      const token = localStorage.getItem('token');
      console.log('Sending chatbot request:', { message: userMessage, token: token ? 'exists' : 'missing' });
      
      const response = await api.post(
        'http://localhost:5000/api/chatbot/chat',
        {
          message: userMessage,
          conversationHistory: messages
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      console.log('Chatbot response received:', response.data);

      // Add bot response to chat
      const botMessage = {
        type: 'bot',
        content: response.data.response,
        timestamp: new Date(),
        doctors: response.data.doctors || [],
        specialization: response.data.specialization
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      const errorMessage = {
        type: 'bot',
        content: error.response?.data?.message || 'I apologize, but I encountered an error. Please try again or contact our support team.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessage = (content) => {
    // Format message with markdown-like syntax
    return content.split('\n').map((line, index) => {
      // Bold text
      if (line.includes('**')) {
        const parts = line.split('**');
        return (
          <p key={index} className="message-line">
            {parts.map((part, i) => (
              i % 2 === 1 ? <strong key={i}>{part}</strong> : part
            ))}
          </p>
        );
      }
      // Bullet points
      if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
        return <li key={index} className="message-bullet">{line.trim().substring(1)}</li>;
      }
      // Regular line
      return line.trim() ? <p key={index} className="message-line">{line}</p> : <br key={index} />;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="chatbot-overlay">
      <div className="chatbot-container">
        {/* Header */}
        <div className="chatbot-header">
          <div className="chatbot-header-content">
            <AiOutlineRobot className="chatbot-icon" />
            <div>
              <h3>Healthcare Assistant</h3>
              <span className="chatbot-status">Online</span>
            </div>
          </div>
          <button onClick={onClose} className="chatbot-close-btn">
            <AiOutlineClose />
          </button>
        </div>

        {/* Messages */}
        <div className="chatbot-messages">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`message ${message.type === 'user' ? 'message-user' : 'message-bot'}`}
            >
              <div className="message-avatar">
                {message.type === 'user' ? <AiOutlineUser /> : <AiOutlineRobot />}
              </div>
              <div className="message-content">
                <div className="message-text">
                  {formatMessage(message.content)}
                </div>
                <span className="message-time">
                  {new Date(message.timestamp).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="message message-bot">
              <div className="message-avatar">
                <AiOutlineRobot />
              </div>
              <div className="message-content">
                <div className="message-text typing-indicator">
                  <BiLoader className="loading-spinner" />
                  <span>Analyzing your symptoms...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="chatbot-input-container">
          <textarea
            ref={inputRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Describe your symptoms..."
            className="chatbot-input"
            rows="2"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className="chatbot-send-btn"
          >
            <AiOutlineSend />
          </button>
        </div>

        {/* Quick suggestions */}
        {messages.length <= 1 && (
          <div className="chatbot-suggestions">
            <p className="suggestions-title">Common concerns:</p>
            <div className="suggestions-buttons">
              <button onClick={() => setInputMessage('I have stomach pain and nausea')}>
                Stomach issues
              </button>
              <button onClick={() => setInputMessage('I have a severe headache')}>
                Headache
              </button>
              <button onClick={() => setInputMessage('I have chest pain')}>
                Chest pain
              </button>
              <button onClick={() => setInputMessage('I have skin rash')}>
                Skin problems
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chatbot;
