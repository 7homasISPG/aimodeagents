import React from 'react';
import { Button } from '@/components/ui/button';
import { 
    Compass, 
    MessageCircle, 
    Calendar, 
    Users,
    Bot,
    Home
} from 'lucide-react';

const menuItems = [
    { id: 'landing', text: 'Home', icon: Home },
    { id: 'explore', text: 'Explore', icon: Compass },
    { id: 'chat', text: 'Messages', icon: MessageCircle },
    // Example default AI Assistance (no params)
    { id: 'ai-assistance', text: 'AI Assistance', icon: Bot },
    { id: 'activities', text: 'Activities', icon: Calendar },
    { id: 'interactions', text: 'Interactions', icon: Users },
];

const SideBar = ({ activeView, onViewChange }) => {
    return (
        <div className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-20 bg-white border-r border-gray-200 flex flex-col items-center py-6 z-40">
            <nav className="flex flex-col space-y-4">
                {menuItems.map((item) => {
                    const IconComponent = item.icon;
                    const isActive = activeView === item.id;
                    
                    return (
                        <Button
                            key={item.id}
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                if (item.id === 'ai-assistance') {
                                    // You could customize the params here
                                    onViewChange('ai-assistance', { action: 'book', item: 'hotel', date: '2025-09-01' });
                                } else {
                                    onViewChange(item.id);
                                }
                            }}
                            className={`w-12 h-12 p-0 rounded-xl transition-all duration-200 ${
                                isActive 
                                    ? 'bg-blue-50 text-blue-600 border border-blue-200' 
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                            title={item.text}
                        >
                            <IconComponent className="h-5 w-5" />
                        </Button>
                    );
                })}
            </nav>
        </div>
    );
};

export default SideBar;
