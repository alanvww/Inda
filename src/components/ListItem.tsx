import { useState, KeyboardEvent } from 'react';
import { Reorder } from 'motion/react';

interface Item {
    id: string;
    value: string;
    completed?: boolean;
}

interface ListItemProps {
    item: Item;
    onUpdate: (itemId: string, newValue: string) => void;
    onDelete: (itemId: string) => void;
    onToggleComplete: (itemId: string) => void;
}

export default function ListItem({
    item,
    onUpdate,
    onDelete,
    onToggleComplete,
}: ListItemProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    // Adding local state to manage the input value while editing
    const [inputValue, setInputValue] = useState(item.value);

    const handleDoubleClick = () => {
        if (!item.completed) {
            setIsEditing(true);
            // Initialize input value when starting to edit
            setInputValue(item.value);
        }
    };

    const handleEditComplete = () => {
        onUpdate(item.id, inputValue);
        setIsEditing(false);
    };

    const handleBlur = () => {
        handleEditComplete();
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            // Prevent the default form submission behavior
            e.preventDefault();
            handleEditComplete();
        } else if (e.key === 'Escape') {
            // Cancel editing and revert to original value
            setInputValue(item.value);
            setIsEditing(false);
        }
    };

    return (
        <Reorder.Item 
            value={item} 
            className="p-2 bg-gray-100 my-1 relative group"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {isEditing ? (
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    className="w-full"
                />
            ) : (
                <div className="flex items-center justify-between">
                    <div
                        onDoubleClick={handleDoubleClick}
                        className={`cursor-pointer flex-grow ${
                            item.completed ? 'line-through text-gray-500' : ''
                        }`}
                    >
                        {item.value || <span className="text-gray-400 italic">Empty Item</span>}
                    </div>
                    {isHovered && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => onToggleComplete(item.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label={item.completed ? "Mark as incomplete" : "Mark as complete"}
                            >
                                {item.completed ? '🔲' : '☑️'}
                            </button>
                            <button
                                onClick={() => onDelete(item.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label="Delete item"
                            >
                                ❌
                            </button>
                        </div>
                    )}
                </div>
            )}
        </Reorder.Item>
    );
}