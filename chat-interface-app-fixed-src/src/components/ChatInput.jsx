import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Send, Paperclip, Mic, MicOff } from 'lucide-react';

const ChatInput = ({ input, setInput, onSendMessage, onFileUpload, fileInputRef, isLoading }) => {
    const [isRecording, setIsRecording] = useState(false);
    const recognitionRef = useRef(null);
    const tempTranscriptRef = useRef(''); // store speech before sending

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!input.trim()) return;
        onSendMessage(input);
        setInput('');
    };

    // Start voice recording
    const startRecording = () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert('Speech recognition is not supported in this browser.');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = true;
        recognition.continuous = false;

        recognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            tempTranscriptRef.current = transcript.trim();
            setInput(transcript);
        };

        recognition.onend = () => {
            setIsRecording(false);
            // Auto-send the transcript if it exists
            if (tempTranscriptRef.current) {
                onSendMessage(tempTranscriptRef.current);
                setInput('');
                tempTranscriptRef.current = '';
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            setIsRecording(false);
        };

        recognition.start();
        recognitionRef.current = recognition;
        setIsRecording(true);
    };

    // Stop voice recording
    const stopRecording = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
    };

    const toggleRecording = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    return (
        <Card className="shadow-lg border border-gray-200">
            <CardContent className="p-3">
                <form onSubmit={handleSubmit} className="flex items-center space-x-3">
                    {/* Attach File */}
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-gray-600 hover:text-gray-800 px-3"
                        disabled={isLoading}
                    >
                        <Paperclip className="h-4 w-4 mr-1" />
                        Attach
                    </Button>

                    {/* Text Input */}
                    <div className="flex-1">
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask Anything"
                            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
                            disabled={isLoading}
                        />
                    </div>

                    {/* Mic Button */}
                    <Button
                        type="button"
                        variant={isRecording ? 'destructive' : 'ghost'}
                        size="sm"
                        onClick={toggleRecording}
                        disabled={isLoading}
                        className="p-2"
                        title={isRecording ? 'Stop Recording' : 'Start Voice Input'}
                    >
                        {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                    </Button>

                    {/* Send Button */}
                    <Button
                        type="submit"
                        size="sm"
                        disabled={isLoading || !input.trim()}
                        className="bg-blue-600 hover:bg-blue-700 text-white p-2"
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                </form>

                {/* Hidden File Input */}
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={onFileUpload}
                    className="hidden"
                />
            </CardContent>
        </Card>
    );
};

export default ChatInput;
