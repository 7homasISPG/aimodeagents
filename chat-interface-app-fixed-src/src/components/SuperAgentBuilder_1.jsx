// SuperAgentBuilder_1.jsx
import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, Bot, User, Send, Loader2, Plus, Trash2, Brain, Zap, Settings, Save, Upload } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// --- Reusable UI Components ---

const Expander = ({ title, children, defaultOpen = true, icon: Icon = Settings }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <Card className="mb-6 border-border bg-card-secondary">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-6 text-left transition-colors hover:bg-muted/50"
      >
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5 text-primary" />
          <span className="font-semibold text-card-foreground">{title}</span>
        </div>
        {isOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
      </button>
      {isOpen && (
        <div className="border-t border-border">
          <div className="p-6">{children}</div>
        </div>
      )}
    </Card>
  );
};

const ChatMessage = ({ sender, content, role }) => {
  const isUser = sender === 'UserProxy' || role === 'user';
  const isSupervisor = sender === 'Supervisor';
  const Icon = isUser ? User : Bot;
  
  let bgClass = "bg-muted";
  let textClass = "text-foreground";
  let avatarClass = "bg-muted-foreground";
  
  if (isUser) {
    bgClass = "bg-agent-user";
    textClass = "text-white";
    avatarClass = "bg-agent-user";
  } else if (isSupervisor) {
    bgClass = "bg-agent-supervisor";
    textClass = "text-white";
    avatarClass = "bg-agent-supervisor";
  } else {
    bgClass = "bg-agent-assistant";
    textClass = "text-white";
    avatarClass = "bg-agent-assistant";
  }

  const alignment = isUser ? 'justify-end' : 'justify-start';
  const senderName = isUser ? 'You' : sender || 'Assistant';

  return (
    <div className={`flex items-end gap-3 my-4 ${alignment}`}>
      {!isUser && (
        <div className={`flex-shrink-0 w-8 h-8 ${avatarClass} rounded-full flex items-center justify-center`}>
          <Icon size={16} className="text-white" />
        </div>
      )}
      <div className="max-w-xl">
        <p className={`text-xs text-muted-foreground mb-1 ${isUser ? 'text-right' : 'text-left'}`}>
          {senderName}
        </p>
        <div className={`px-4 py-3 rounded-xl ${bgClass} ${textClass} shadow-elegant`}>
          <p className="whitespace-pre-wrap">{content}</p>
        </div>
      </div>
      {isUser && (
        <div className={`flex-shrink-0 w-8 h-8 ${avatarClass} rounded-full flex items-center justify-center`}>
          <Icon size={16} className="text-white" />
        </div>
      )}
    </div>
  );
};

const TaskManager = ({ tasks, onTasksChange }) => {
  const handleTaskChange = (taskIndex, field, value) => {
    const newTasks = [...tasks];
    newTasks[taskIndex] = { ...newTasks[taskIndex], [field]: value };
    onTasksChange(newTasks);
  };
  
  const addTask = () => {
    const newTask = {
      name: '',
      description: '',
      endpoint: '',
      params_schema: {
        type: 'object',
        properties: {},
        required: [],
      },
    };
    onTasksChange([...tasks, newTask]);
  };

  const removeTask = (index) => {
    onTasksChange(tasks.filter((_, i) => i !== index));
  };
  
  const addParameter = (taskIndex) => {
    const newTasks = JSON.parse(JSON.stringify(tasks));
    const newParamName = `param${Object.keys(newTasks[taskIndex].params_schema.properties).length + 1}`;
    newTasks[taskIndex].params_schema.properties[newParamName] = {
      type: 'string',
      description: '',
    };
    onTasksChange(newTasks);
  };

  const removeParameter = (taskIndex, paramName) => {
    const newTasks = JSON.parse(JSON.stringify(tasks));
    delete newTasks[taskIndex].params_schema.properties[paramName];
    newTasks[taskIndex].params_schema.required = newTasks[taskIndex].params_schema.required.filter(
      (p) => p !== paramName
    );
    onTasksChange(newTasks);
  };
  
  const handleParamChange = (taskIndex, oldParamName, newParamName, field, value) => {
    const newTasks = JSON.parse(JSON.stringify(tasks));
    const properties = newTasks[taskIndex].params_schema.properties;
    const required = newTasks[taskIndex].params_schema.required;
    const paramData = properties[oldParamName];

    if (field === 'name') {
        delete properties[oldParamName];
        properties[newParamName] = paramData;
        if(required.includes(oldParamName)) {
            newTasks[taskIndex].params_schema.required = required.map(p => p === oldParamName ? newParamName : p);
        }
    } else {
        properties[oldParamName][field] = value;
    }
    
    onTasksChange(newTasks);
  };
  
  const handleRequiredChange = (taskIndex, paramName, isChecked) => {
    const newTasks = JSON.parse(JSON.stringify(tasks));
    const required = newTasks[taskIndex].params_schema.required;
    if(isChecked) {
        if(!required.includes(paramName)) {
            required.push(paramName);
        }
    } else {
        newTasks[taskIndex].params_schema.required = required.filter(p => p !== paramName);
    }
    onTasksChange(newTasks);
  };

  return (
    <div className="space-y-4">
      {(tasks || []).map((task, taskIndex) => (
        <Card key={taskIndex} className="border-border bg-muted/30 overflow-hidden">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Tool {taskIndex + 1}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => removeTask(taskIndex)} className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor={`task-name-${taskIndex}`} className="text-sm">Function Name</Label>
                <Input id={`task-name-${taskIndex}`} value={task.name} onChange={(e) => handleTaskChange(taskIndex, 'name', e.target.value)} placeholder="e.g., search_apis" className="bg-background border-border" />
              </div>
              <div>
                <Label htmlFor={`task-endpoint-${taskIndex}`} className="text-sm">API Endpoint</Label>
                <Input id={`task-endpoint-${taskIndex}`} value={task.endpoint} onChange={(e) => handleTaskChange(taskIndex, 'endpoint', e.target.value)} placeholder="https://api.example.com/data" className="bg-background border-border" />
              </div>
            </div>
            <div>
              <Label htmlFor={`task-description-${taskIndex}`} className="text-sm">Description</Label>
              <Input id={`task-description-${taskIndex}`} value={task.description} onChange={(e) => handleTaskChange(taskIndex, 'description', e.target.value)} placeholder="What this tool does..." className="bg-background border-border" />
            </div>
            <Separator className="my-4" />
            <div>
                <Label className="text-sm font-medium mb-2 block">Parameters</Label>
                <div className="space-y-3">
                    {Object.entries(task.params_schema.properties).map(([paramName, paramSchema]) => (
                        <div key={paramName} className="p-3 bg-background rounded-md border border-border grid grid-cols-12 gap-2 items-center">
                            <div className="col-span-3">
                                <Input value={paramName} onChange={(e) => handleParamChange(taskIndex, paramName, e.target.value, 'name', e.target.value)} placeholder="param_name" className="h-8"/>
                            </div>
                            <div className="col-span-3">
                                <Select value={paramSchema.type} onValueChange={(value) => handleParamChange(taskIndex, paramName, paramName, 'type', value)}>
                                    <SelectTrigger className="h-8"><SelectValue placeholder="Type" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="string">String</SelectItem>
                                        <SelectItem value="number">Number</SelectItem>
                                        <SelectItem value="boolean">Boolean</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="col-span-4">
                                <Input value={paramSchema.description} onChange={(e) => handleParamChange(taskIndex, paramName, paramName, 'description', e.target.value)} placeholder="Description" className="h-8"/>
                            </div>
                            <div className="col-span-1 flex items-center justify-center gap-2">
                                <Checkbox id={`required-${taskIndex}-${paramName}`} checked={task.params_schema.required.includes(paramName)} onCheckedChange={(checked) => handleRequiredChange(taskIndex, paramName, checked)} />
                                <Label htmlFor={`required-${taskIndex}-${paramName}`} className="text-xs">Req</Label>
                            </div>
                            <div className="col-span-1">
                                <Button variant="ghost" size="icon" onClick={() => removeParameter(taskIndex, paramName)} className="h-8 w-8 text-destructive/70 hover:text-destructive">
                                    <Trash2 className="h-4 w-4"/>
                                </Button>
                            </div>
                        </div>
                    ))}
                    <Button onClick={() => addParameter(taskIndex)} variant="outline" size="sm" className="w-full border-dashed"><Plus className="h-4 w-4 mr-2" />Add Parameter</Button>
                </div>
            </div>
          </CardContent>
        </Card>
      ))}
      <Button onClick={addTask} variant="outline" className="w-full border-dashed border-primary/50 text-primary hover:bg-primary/10">
        <Plus className="h-4 w-4 mr-2" />
        Add Tool
      </Button>
    </div>
  );
};

// --- Main Super Agent Builder Component ---
const SuperAgentBuilder = () => {
  const API_URL = "http://localhost:8000";

  // Configuration state
  const [profile, setProfile] = useState({
    prompt: 'Find public APIs related to animals and tell me the name of the first one.',
    supervisor_system_message: 'You are the Supervisor. Coordinate assistants step-by-step to complete the task. Ask the user for clarification if needed. End with TERMINATE.',
    max_turns: 16
  });

  const [assistants, setAssistants] = useState([
    {
      name: 'APISearchAgent',
      system_message: 'You are an expert at finding public APIs. Use your tools to search for APIs based on user queries.',
      tasks: []
    }
  ]);

  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [userMessage, setUserMessage] = useState(''); // input box value
  const [sessionId, setSessionId] = useState(null);

  const chatContainerRef = useRef(null);
  const fileInputRef = useRef(null);


  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleProfileChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const addAssistant = () => {
    const newAssistant = {
      name: '',
      system_message: '',
      tasks: []
    };
    setAssistants([...assistants, newAssistant]);
  };

  const updateAssistant = (index, updates) => {
    const newAssistants = [...assistants];
    newAssistants[index] = { ...newAssistants[index], ...updates };
    setAssistants(newAssistants);
  };

  const removeAssistant = (index) => {
    if (assistants.length > 1) {
      setAssistants(assistants.filter((_, i) => i !== index));
    }
  };
  const runFromFile = async (type) => {
    setIsLoading(true);
    setChatHistory([]);
    setResponse('');

  const endpoint = type === "saved" 
    ? `${API_URL}/api/run-saved-config/`
    : `${API_URL}/api/run-supervisor-profile/`;

    try {
        const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to run from file');
        }

        const data = await response.json();
        setChatHistory(data.chat_history || []);
        setResponse(data.response || '');
        setIsRunning(true);
        
        console.log(`Run from ${type} completed successfully!`);

    } catch (error) {
        console.error(`An error occurred while running from ${type}:`, error);
        alert(error.message);
    } finally {
        setIsLoading(false);
    }
    };

  const loadExample = async () => {
    try {
      const response = await fetch(`${API_URL}/api/example-spec`);
      if (!response.ok) throw new Error('Failed to load example');
      
      const data = await response.json();
      setProfile({
        prompt: data.prompt,
        supervisor_system_message: data.supervisor_system_message,
        max_turns: data.max_turns
      });
      setAssistants(data.assistants || []);
      
      console.log("Example loaded successfully.");
    } catch (error) {
      console.error("Failed to load example configuration:", error);
      alert("Error: Failed to load example configuration.");
    }
  };

  const saveConfiguration = async () => {
    setIsSaving(true);
    const payload = {
      ...profile,
      assistants: assistants,
    };
    
    try {
        const response = await fetch(`${API_URL}/api/save-config/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to save configuration.');
        }

        const result = await response.json();
        console.log("Configuration saved successfully:", result);
        alert("Configuration saved successfully!");

    } catch (error) {
        console.error("Error saving configuration:", error);
        alert(`Error: ${error.message}`);
    } finally {
        setIsSaving(false);
    }
  };

    const runCombinedConfig = async () => {
    setIsLoading(true);
    setChatHistory([]);
    setResponse('');
    
    try {
        const response = await fetch(`${API_URL}/api/run-combined-config/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to run combined config');
        }

        const data = await response.json();
        setChatHistory(data.chat_history || []);
        setResponse(data.response || '');
        setIsRunning(true);
        
        console.log("Combined Supervisor + Assistants run successfully!");
    } catch (error) {
        console.error("Error running combined config:", error);
        alert(error.message);
    } finally {
        setIsLoading(false);
    }
    };


  const handleFileLoad = (event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const data = JSON.parse(content);

        setProfile({
          prompt: data.prompt || '',
          supervisor_system_message: data.supervisor_system_message || '',
          max_turns: data.max_turns || 16,
        });
        setAssistants(data.assistants || []);
        console.log("Configuration loaded successfully.");
      } catch (error) {
        console.error("Failed to parse configuration file:", error);
        alert("Error: Invalid configuration file. Please ensure it is a valid JSON.");
      }
    };
    reader.readAsText(file);
    event.target.value = null;
  };


    const runSuperAgent = async () => {
    if (!profile.prompt.trim()) {
        alert("Error: Please enter a prompt to start.");
        return;
    }

    setIsLoading(true);
    setChatHistory([]);
    setResponse('');
        
    const payload = {
        prompt: profile.prompt,
        supervisor_system_message: profile.supervisor_system_message,
        assistants: assistants.filter(a => a.name.trim() && a.system_message.trim()),
        max_turns: profile.max_turns
    };

    try {
        const resp = await fetch(`${API_URL}/api/chat/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        });

        if (!resp.ok) throw new Error("Failed to start session");
        const data = await resp.json();

        // store session id for future sends
        setSessionId(data.session_id);
        setIsRunning(true);

        console.log("Interactive session started:", data.session_id);
    } catch (error) {
        console.error("Error starting chat:", error);
        alert(error.message);
    } finally {
        setIsLoading(false);
    }
    };


  return (
    <div className="min-h-screen bg-gradient-background">
      <div className="container mx-auto p-6 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <h1 className="text-3xl font-bold text-foreground">Assistant Agent Builder</h1>
            <div className="p-3 bg-gradient-primary rounded-xl shadow-glow animate-float">
              <Brain className="h-8 w-8 text-black" />
            </div>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Configure and orchestrate a team of specialized AI agents to solve complex tasks collaboratively.
          </p>
        </div>

        {!isRunning ? (
          <>
            {/* Agent Configuration */}
            <Expander title="Agent Team Configuration" icon={Bot} defaultOpen={true}>
            <div className="space-y-6">
                
                {/* Load Config Section */}
                <Card className="border-border bg-card-secondary">
                <CardHeader>
                    <CardTitle className="text-lg">Load Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-3">
                    <Button 
                        onClick={() => fileInputRef.current.click()} 
                        variant="outline" 
                        className="flex-1"
                    >
                        <Upload className="h-4 w-4 mr-2" />
                        Load from File
                    </Button>
                    <Button 
                        onClick={loadExample} 
                        variant="outline" 
                        className="flex-1"
                    >
                        <Bot className="h-4 w-4 mr-2" />
                        Load Example
                    </Button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileLoad}
                        accept=".json"
                        className="hidden"
                    />
                    </div>
                </CardContent>
                </Card>

                {/* Assistants Section */}
                {(assistants || []).map((assistant, index) => (
                <Card key={index} className="border-border bg-card-secondary">
                    <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="bg-agent-assistant text-white">
                            Agent {index + 1}
                        </Badge>
                        <CardTitle className="text-lg">
                            {assistant.name || `Assistant ${index + 1}`}
                        </CardTitle>
                        </div>
                        {assistants.length > 1 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAssistant(index)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        )}
                    </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                        <Label htmlFor={`agent-name-${index}`} className="text-sm font-medium">Agent Name</Label>
                        <Input
                            id={`agent-name-${index}`}
                            value={assistant.name}
                            onChange={(e) => updateAssistant(index, { name: e.target.value })}
                            placeholder="e.g., APISearchAgent"
                            className="bg-background border-border"
                        />
                        </div>
                        <div>
                        <Label htmlFor={`agent-message-${index}`} className="text-sm font-medium">System Message</Label>
                        <Textarea
                            id={`agent-message-${index}`}
                            value={assistant.system_message}
                            onChange={(e) => updateAssistant(index, { system_message: e.target.value })}
                            placeholder="Define this agent's specialization and capabilities..."
                            className="bg-background border-border min-h-[80px]"
                        />
                        </div>
                    </div>
                    
                    <Separator className="bg-border" />
                    
                    <div>
                        <Label className="text-sm font-medium mb-3 block">Available Tools</Label>
                        <TaskManager
                        tasks={assistant.tasks || []}
                        onTasksChange={(tasks) => updateAssistant(index, { tasks })}
                        />
                    </div>
                    </CardContent>
                </Card>
                ))}

                {/* Add Assistant Button */}
                <Button
                onClick={addAssistant}
                variant="outline"
                className="w-full border-dashed border-primary/50 text-primary hover:bg-primary/10"
                >
                <Plus className="h-4 w-4 mr-2" />
                Add Assistant Agent
                </Button>
            </div>
            </Expander>


            {/* Launch Section */}
            <div className="text-center mt-8 flex flex-col sm:flex-row justify-center gap-4">
            {/* Configure & Save Button */}
            <Button
                onClick={saveConfiguration}
                disabled={isSaving}
                size="lg"
                variant="outline"
                className="border-primary/50 text-primary hover:bg-primary/10 shadow-sm transition-all duration-300 px-8 py-3"
            >
                {isSaving ? (
                <>
                    <Loader2 className="animate-spin mr-2 h-5 w-5" />
                    Saving Configuration...
                </>
                ) : (
                <>
                    <Save className="mr-2 h-5 w-5" />
                    Configure & Save
                </>
                )}
            </Button>

            {/* Launch Agent Team Button */}
            <Button 
                onClick={runSuperAgent}
                disabled={isLoading}
                size="lg"
                className="bg-gradient-primary hover:bg-gradient-primary/90 text-white shadow-glow hover:shadow-accent transition-all duration-300 px-8 py-3"
            >
                {isLoading ? (
                <>
                    <Loader2 className="animate-spin mr-2 h-5 w-5" />
                    Initializing Agent Team...
                </>
                ) : (
                <>
                    <Zap className="mr-2 h-5 w-5" />
                    Launch Agent Team
                </>
                )}
            </Button>
            <Button 
            onClick={runCombinedConfig}
            disabled={isLoading}
            size="lg"
            className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-glow hover:shadow-accent transition-all duration-300 px-8 py-3"
            >
            {isLoading ? (
                <>
                <Loader2 className="animate-spin mr-2 h-5 w-5" />
                Running Supervisor + Assistants...
                </>
            ) : (
                <>
                <Zap className="mr-2 h-5 w-5" />
                Run Combined Config
                </>
            )}
            </Button>

            </div>
          </>
        ) : (
           <Card className="border-border bg-card shadow-elegant">
            <CardHeader className="border-b border-border">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl">Agent Team Execution</CardTitle>
                  <CardDescription className="mt-1">
                    Collaborative problem-solving in progress
                  </CardDescription>
                </div>
                <Button 
                  onClick={() => setIsRunning(false)}
                  variant="outline"
                  size="sm"
                >
                  ← Back to Configuration
                </Button>
              </div>
            </CardHeader>
            
            {/* Execution Mode */}
            <Card className="border-border bg-card shadow-elegant">

            <CardContent className="p-0">

                {/* Final Response (if any) */}
                {response && (
                <div className="border-t border-border p-6 bg-card">
                    <h3 className="font-semibold text-accent mb-3 flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    Final Result
                    </h3>
                    <div className="bg-gradient-accent/10 border border-accent/20 rounded-lg p-4">
                    <p className="text-accent-foreground whitespace-pre-wrap">{response}</p>
                    </div>
                </div>
                )}

                {/* User Reply Box */}
                <div className="border-t border-border p-4 flex gap-2 items-center">
                <Input
                    placeholder="Type your reply..."
                    value={userMessage}
                    onChange={(e) => setUserMessage(e.target.value)}
                    className="flex-1"
                />
                <Button
                    onClick={async () => {
                    if (!userMessage.trim()) return;
                    try {
                        // send message
                        await fetch(`${API_URL}/api/chat/${sessionId}/send`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ message: userMessage }),
                        });
                        setChatHistory([
                        ...chatHistory,
                        { sender: "UserProxy", text: userMessage, role: "user" },
                        ]);
                        setUserMessage(""); // clear input

                        // step agents forward
                        const stepResp = await fetch(`${API_URL}/api/chat/${sessionId}/step`, {
                        method: "POST",
                        });
                        if (stepResp.ok) {
                        const newMsgs = await stepResp.json();
                        setChatHistory((prev) => [...prev, ...newMsgs.new_messages]);
                        }
                    } catch (err) {
                        console.error("Error sending user reply:", err);
                    }
                    }}
                >
                    <Send className="h-4 w-4 mr-2" />
                    Send
                </Button>
                </div>


            </CardContent>
            </Card>

          </Card>
        )}
      </div>
    </div>
  );
};

export default SuperAgentBuilder;