import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Send, 
  Upload, 
  MessageSquare, 
  Bot, 
  User, 
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle,
  Zap
} from 'lucide-react';
import axios from 'axios';

// Configuration
const API_ASK_URL = 'http://localhost:8000/api/ask';
const API_UPLOAD_URL = 'http://localhost:8000/api/upload';
const WS_URL = 'ws://localhost:8000/ws';

const ChatInterface = ({
  startInConversation = false,
  currentThread = null,
  onThreadUpdate = null
}) => {
  // State Management
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationStarted, setConversationStarted] = useState(startInConversation);
  const [isInteractiveSession, setIsInteractiveSession] = useState(false);
  
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const ws = useRef(null);
  const { toast } = useToast();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Clean up WebSocket connection when component unmounts
  useEffect(() => {
    return () => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        console.log("Closing WebSocket connection on component unmount.");
        ws.current.close();
      }
    };
  }, []);

  // Reset state when switching between threads
  useEffect(() => {
    if (currentThread && currentThread.id) {
      setMessages([]);
      setConversationStarted(startInConversation);
      if (ws.current) {
        ws.current.close();
      }
      setIsInteractiveSession(false);
    }
  }, [currentThread, startInConversation]);

  // WebSocket Connection Logic
  const connectWebSocket = useCallback(() => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      console.log("WebSocket is already connected.");
      return;
    }

    console.log("Attempting to connect to WebSocket...");
    ws.current = new WebSocket(WS_URL);

    ws.current.onopen = () => {
      console.log("WebSocket connection established.");
      setIsInteractiveSession(true);
      setIsLoading(false);
      toast({
        title: "Interactive session started",
        description: "You can now have a real-time conversation with the AI agents.",
      });
    };

    ws.current.onmessage = (event) => {
      console.log("WebSocket message received:", event.data);
      let newMessage;

      try {
        const parsed = JSON.parse(event.data);
        
        if (parsed.type === "final_answer") {
          newMessage = {
            role: "assistant",
            content: { text: parsed.text },
            timestamp: new Date().toISOString()
          };
        } else if (parsed.type === "agent_message") {
          // Properly handle agent messages with sender information
          newMessage = {
            role: "assistant",
            content: { text: parsed.text },
            timestamp: new Date().toISOString(),
            sender: parsed.sender
          };
        } else {
          // Fallback for any other message format
          newMessage = {
            role: "assistant", 
            content: { text: typeof parsed === 'string' ? parsed : JSON.stringify(parsed) },
            timestamp: new Date().toISOString()
          };
        }
      } catch (e) {
        // If it's not JSON, treat it as plain text
        newMessage = {
          role: "assistant",
          content: { text: event.data },
          timestamp: new Date().toISOString()
        };
      }

      if (newMessage) {
        setMessages(prev => [...prev, newMessage]);
      }
      setIsLoading(false);
    };

    ws.current.onclose = () => {
      console.log("WebSocket connection closed.");
      setIsInteractiveSession(false);
      setIsLoading(false);
      
      const systemMessage = {
        role: 'system',
        content: { text: "The interactive session has ended." },
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, systemMessage]);
      
      toast({
        title: "Session ended",
        description: "The interactive conversation has concluded.",
        variant: "destructive",
      });
    };

    ws.current.onerror = (error) => {
      console.error("WebSocket error:", error);
      setIsLoading(false);
      
      const errorMessage = {
        role: 'assistant',
        content: { text: "Sorry, I lost connection with my team. Please try again." },
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: "Connection error",
        description: "Failed to connect to the AI agents. Please try again.",
        variant: "destructive",
      });
    };
  }, [toast]);

  // Core Message Handling Logic
  const handleSendMessage = async (query) => {
    if (!query.trim()) return;
    if (!conversationStarted) setConversationStarted(true);

    const userMessage = {
      role: 'user',
      content: { text: query },
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');

    // Interactive session (WebSocket mode)
    if (isInteractiveSession && ws.current && ws.current.readyState === WebSocket.OPEN) {
      console.log("Sending message via WebSocket:", query);
      ws.current.send(query);
      setIsLoading(true); // Show loading indicator for WebSocket messages too
      return;
    }

    // One-shot RAG (HTTP mode)
    setIsLoading(true);
    try {
      console.log("Sending query via HTTP POST:", query);
      const response = await axios.post(API_ASK_URL, { query, lang: "en" });
      const responseData = response.data;
      console.log("Received structured response from backend:", responseData);

      const assistantMessage = {
        role: 'assistant',
        content: responseData,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, assistantMessage]);

      if (responseData.type === 'interactive_session_start') {
        connectWebSocket(); // WebSocket will handle streaming
      } else {
        setIsLoading(false);
      }

      if (onThreadUpdate && currentThread) {
        const updatedThread = {
          ...currentThread,
          lastMessage: query,
          timestamp: new Date(),
          messageCount: (currentThread.messageCount || 0) + 2
        };
        onThreadUpdate(updatedThread);
      }

    } catch (error) {
      console.error('Error fetching response from backend:', error);
      let errorMessageText = 'Sorry, I encountered an error. Please try again.';
      
      if (axios.isAxiosError(error)) {
        if (error.response) {
          errorMessageText = `Sorry, server error: ${error.response.data.detail || 'Unknown error'}`;
        } else if (error.request) {
          errorMessageText = 'Could not connect to backend. Please ensure it is running.';
        }
      }
      
      const errorMessage = {
        role: 'assistant',
        content: { type: 'answer', text: errorMessageText },
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
      
      toast({
        title: "Error",
        description: errorMessageText,
        variant: "destructive",
      });
    }
  };

  // File Upload Handling
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!conversationStarted) setConversationStarted(true);

    const systemMessage = {
      role: 'system',
      content: { text: `Uploading ${file.name}...` },
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, systemMessage]);
    setIsLoading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(API_UPLOAD_URL, formData);
      const successMessage = {
        role: 'system',
        content: { text: `✅ ${response.data.message}` },
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, successMessage]);
      
      toast({
        title: "File uploaded",
        description: `Successfully processed ${file.name}`,
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      const errorMessage = {
        role: 'system',
        content: { text: `❌ Error uploading ${file.name}.` },
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: "Upload failed",
        description: `Failed to upload ${file.name}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(input);
    }
  };

  const MessageIcon = ({ role, sender }) => {
    if (role === 'user') return <User className="h-4 w-4" />;
    if (role === 'system') return <AlertCircle className="h-4 w-4" />;
    if (sender) return <Zap className="h-4 w-4" />;
    return <Bot className="h-4 w-4" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-chat-surface flex flex-col">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-r from-primary to-chat-primary-glow">
                <MessageSquare className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">AI Agent Chat</h1>
                <p className="text-sm text-muted-foreground">
                  {isInteractiveSession ? (
                    <span className="flex items-center gap-1">
                      <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                      Interactive session active
                    </span>
                  ) : (
                    'Ask questions or upload documents'
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6 flex flex-col">
        {!conversationStarted ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex items-center justify-center"
          >
            <Card className="max-w-2xl w-full p-8 text-center border-border/50 bg-card/50 backdrop-blur">
              <div className="mb-6">
                <div className="mx-auto w-16 h-16 bg-gradient-to-r from-primary to-chat-primary-glow rounded-2xl flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-primary-foreground" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Welcome to AI Agent Chat</h2>
                <p className="text-muted-foreground">
                  Ask questions, upload documents, or start a conversation with our intelligent agents.
                </p>
              </div>
              
              <div className="space-y-4">
                <div className="relative">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask me anything..."
                    className="pr-12 h-12 bg-background/50"
                    disabled={isLoading}
                  />
                  <Button
                    onClick={() => handleSendMessage(input)}
                    disabled={!input.trim() || isLoading}
                    className="absolute right-1 top-1 h-10 w-10"
                    size="sm"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                
                <div className="flex items-center gap-2">
                  <Separator className="flex-1" />
                  <span className="text-sm text-muted-foreground">or</span>
                  <Separator className="flex-1" />
                </div>
                
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="w-full"
                  disabled={isLoading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </Button>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt"
                />
              </div>
            </Card>
          </motion.div>
        ) : (
          <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4 py-4">
                <AnimatePresence>
                  {messages.map((message, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card className={`max-w-[80%] p-4 ${
                        message.role === 'user' 
                          ? 'ml-auto bg-primary text-primary-foreground' 
                          : message.role === 'system'
                          ? 'mx-auto bg-muted text-center'
                          : 'bg-card'
                      } border-border/50`}>
                        <div className="flex items-start gap-3">
                          <div className={`p-1.5 rounded-full ${
                            message.role === 'user' 
                              ? 'bg-primary-foreground/20' 
                              : message.role === 'system'
                              ? 'bg-muted-foreground/20'
                              : 'bg-primary/20'
                          }`}>
                            <MessageIcon role={message.role} sender={message.sender} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium">
                                {message.role === 'user' 
                                  ? 'You' 
                                  : message.sender 
                                  ? message.sender
                                  : message.role === 'system'
                                  ? 'System'
                                  : 'Assistant'
                                }
                              </span>
                              {message.sender && (
                                <Badge variant="secondary" className="text-xs">
                                  Agent
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm leading-relaxed">
                              {message.content.text}
                            </p>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-center"
                  >
                    <Card className="p-4 bg-card border-border/50">
                      <div className="flex items-center gap-3">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">
                          {isInteractiveSession ? 'Agent is thinking...' : 'Processing...'}
                        </span>
                      </div>
                    </Card>
                  </motion.div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            
            <div className="mt-4 space-y-2">
              <div className="relative">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={isInteractiveSession ? "Continue the conversation..." : "Ask a follow-up question..."}
                  className="pr-24 h-12 bg-background/50"
                  disabled={isLoading}
                />
                <div className="absolute right-1 top-1 flex gap-1">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    size="sm"
                    variant="ghost"
                    className="h-10 w-10"
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => handleSendMessage(input)}
                    disabled={!input.trim() || isLoading}
                    className="h-10 w-10"
                    size="sm"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                accept=".pdf,.doc,.docx,.txt"
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ChatInterface;