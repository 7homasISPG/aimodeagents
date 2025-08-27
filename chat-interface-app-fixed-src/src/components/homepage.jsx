import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import TopBar from './TopBar';
import SideBar from './SideBar';
import ChatInterface from './ChatInterface2';
import ChatThreadSidebar from './ChatThreadSidebar';
import LoginForm from './LoginForm';
import LandingPage from './LandingPage';
import AIAssistance from './AIAssistance';
import { useAuth } from '../contexts/AuthContext';

const MainLayout = () => {
    const { isAuthenticated, isLoading } = useAuth();
    const [activeView, setActiveView] = useState('landing');
    const [showLoginForm, setShowLoginForm] = useState(false);
    const [showThreadSidebar, setShowThreadSidebar] = useState(false);
    const [activeThreadId, setActiveThreadId] = useState(null);
    const [currentThread, setCurrentThread] = useState(null);

    // Show login form if not authenticated
    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            setShowLoginForm(true);
        } else {
            setShowLoginForm(false);
        }
    }, [isAuthenticated, isLoading]);

    useEffect(() => {
        const handleOpenLogin = () => setShowLoginForm(true);
        window.addEventListener('openLoginModal', handleOpenLogin);
        return () => window.removeEventListener('openLoginModal', handleOpenLogin);
    }, []);


    // Auto-open thread sidebar on desktop when authenticated
    useEffect(() => {
        if (isAuthenticated && window.innerWidth >= 768) {
            setShowThreadSidebar(true);
        }
    }, [isAuthenticated]);

    const handleViewChange = (viewId) => {
        setActiveView(viewId);
        if (viewId === 'chat' || viewId === 'explore') {
            setShowThreadSidebar(true);
        }
    };

    const handleThreadSelect = (thread) => {
        setActiveThreadId(thread.id);
        setCurrentThread(thread);
        setActiveView('chat');
    };

    const handleNewThread = (thread) => {
        setActiveThreadId(thread.id);
        setCurrentThread(thread);
        setActiveView('explore');
    };

    const toggleThreadSidebar = () => {
        setShowThreadSidebar(!showThreadSidebar);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }


    return (
        <div className="min-h-screen bg-gray-50">
            <TopBar 
                isAuthenticated={isAuthenticated}
                onToggleThreadSidebar={toggleThreadSidebar}
                showThreadSidebar={showThreadSidebar}
            />
            
            {isAuthenticated && (
                <SideBar 
                    activeView={activeView} 
                    onViewChange={handleViewChange} 
                />
            )}

            {isAuthenticated && (
                <ChatThreadSidebar
                    isOpen={showThreadSidebar}
                    onClose={() => setShowThreadSidebar(false)}
                    activeThreadId={activeThreadId}
                    onThreadSelect={handleThreadSelect}
                    onNewThread={handleNewThread}
                />
            )}

            <main className={`${
                isAuthenticated 
                    ? `ml-20 ${showThreadSidebar ? 'lg:ml-[400px]' : ''} pt-16` 
                    : 'pt-16'
            } min-h-screen transition-all duration-300`}>
                <div className={activeView === 'landing' ? '' : 'p-6'}>
                    {activeView === 'landing' && <LandingPage />}
                    
                    {(activeView === 'explore' || activeView === 'chat') && (
                        <ChatInterface
                            key={`${activeView}-${activeThreadId}`}
                            startInConversation={activeView === 'chat'}
                            currentThread={currentThread}
                            onThreadUpdate={(updatedThread) => {
                                setCurrentThread(updatedThread);
                            }}
                        />
                    )}

                    {activeView === 'ai-assistance' && <AIAssistance />}

                    {activeView === 'activities' && (
                        <div className="flex items-center justify-center h-96">
                            <div className="text-center">
                                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Activities</h2>
                                <p className="text-gray-600">Activities view coming soon...</p>
                            </div>
                        </div>
                    )}

                    {activeView === 'interactions' && (
                        <div className="flex items-center justify-center h-96">
                            <div className="text-center">
                                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Interactions</h2>
                                <p className="text-gray-600">Interactions view coming soon...</p>
                            </div>
                        </div>
                    )}
                </div>
            </main>

        </div>
    );
};

export default MainLayout;
