import { useState, KeyboardEvent, useRef } from 'react';
import { Reorder } from 'motion/react';
import ListItem from './ListItem';
import { useOpenRouterAPI } from '../hooks/useOpenRouterAPI';
import { useToast } from '../context/ToastContext';
import { useScreenshot } from '../hooks/useScreenshot';

interface Item {
    id: string;
    value: string;
    completed?: boolean;
}

interface ListProps {
    listIndex: number;
    list: {
        id: string;
        title: string;
        items: Item[];
    };
    addItem: (listIndex: number) => void;
    updateItem: (listIndex: number, itemId: string, newValue: string) => void;
    updateTitle: (listIndex: number, newTitle: string) => void;
    reorderItems: (listIndex: number, newOrder: Item[]) => void;
    deleteItem: (listIndex: number, itemId: string) => void;
    toggleComplete: (listIndex: number, itemId: string) => void;
}

export default function List({
    listIndex,
    list,
    addItem,
    updateItem,
    updateTitle,
    reorderItems,
    deleteItem,
    toggleComplete,
}: ListProps) {
    const [editingTitle, setEditingTitle] = useState(false);
    const [titleValue, setTitleValue] = useState(list.title);
    const [isGenerating, setIsGenerating] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);
    
    // Access toast context
    const { showToast } = useToast();

    const preparePrompt = (title: string) => {
        return `Create a focused todo list with exactly 10 items for "${title}". 
Return ONLY a JSON array of strings in this exact format, with no additional text:
["item 1", "item 2", "item 3", ...]

The items should be:
1. Specific and actionable
2. Relevant to the list title
3. Reasonably achievable
4. Written in a consistent style
5. Not too long (each item under 50 characters)`;
    };

    // Initialize the API hook
    // Define types for possible API responses
    type ItemResponse = string[] | { items: string[] } | Record<string, unknown>;

    const itemsApi = useOpenRouterAPI<ItemResponse>({
        prompt: preparePrompt(list.title),
        systemPrompt: "You are an assistant that creates focused todo lists and always responds in valid JSON format.",
        responseFormat: 'json_object',
        maxTokens: 500,
        temperature: 0.7
    });

    const generateItems = async () => {
        setIsGenerating(true);
        try {
            // Execute the API call using our custom hook - will return parsed string[]
            const result = await itemsApi.execute();
            
            if (!result) {
                throw new Error('Failed to get response from AI service');
            }

            // The response is already parsed by our improved hook, but we need to normalize the format
            let items: string[];
            
            if (Array.isArray(result)) {
                // It's already a string array
                items = result.map(item => typeof item === 'string' ? item : String(item));
            } else if (typeof result === 'object' && result !== null) {
                // Check if it has an items property
                if ('items' in result && Array.isArray(result.items)) {
                    items = result.items.map(item => typeof item === 'string' ? item : String(item));
                // Check if it has a text property or similar that might contain items
                } else if ('text' in result && typeof result.text === 'string') {
                    // Try to extract JSON array from the text
                    try {
                        const extractedItems = JSON.parse(result.text);
                        if (Array.isArray(extractedItems)) {
                            items = extractedItems.map(item => typeof item === 'string' ? item : String(item));
                        } else {
                            throw new Error('Extracted content is not an array');
                        }
                    } catch {
                        // If parsing fails, just use the text as a single item
                        items = [String(result.text)];
                    }
                } else {
                    // Fallback: try to stringify the whole object and use that
                    items = [JSON.stringify(result)];
                    console.warn('Unexpected response format, using stringified result', result);
                }
            } else {
                throw new Error('Unexpected response format: could not extract items array');
            }

            // Filter out any empty or invalid items
            items = items.filter(item => typeof item === 'string' && item.trim() !== '');

            // Create all items first (with unique IDs)
            const newItems = items.map(itemValue => ({
                id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                value: itemValue.trim(),
                completed: false
            }));

            // Update the list with all new items at once
            const updatedList = {
                ...list,
                items: [...list.items, ...newItems]
            };

            // Use reorderItems to update the entire list
            reorderItems(listIndex, updatedList.items);
            
            showToast('Items generated successfully!', 'success');

        } catch (error) {
            console.error('Error generating items:', error);
            showToast('Failed to generate items. Please try again.', 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    // Use the screenshot hook
    const { takeScreenshot } = useScreenshot();

    const handleScreenshot = async () => {
        try {
            const result = await takeScreenshot(listRef, {
                filename: `${list.title.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.png`,
                prepare: (element) => {
                    // Make container auto-height and visible overflow
                    element.style.height = 'auto';
                    element.style.overflow = 'visible';

                    // Find and modify the Reorder.Group container
                    const groupElement = element.querySelector('[data-reorder-group]');
                    if (groupElement) {
                        (groupElement as HTMLElement).style.height = 'auto';
                        (groupElement as HTMLElement).style.overflow = 'visible';
                    }

                    // Find and hide the buttons container
                    const buttonsContainer = element.querySelector('[data-buttons-container]');
                    if (buttonsContainer) {
                        (buttonsContainer as HTMLElement).style.display = 'none';
                    }

                    // Adjust the header layout after hiding buttons
                    const headerContainer = element.querySelector('[data-header-container]');
                    if (headerContainer) {
                        (headerContainer as HTMLElement).style.justifyContent = 'flex-start';
                    }
                }
            });
            
            if (!result) {
                throw new Error('Failed to capture screenshot');
            }
            
            showToast('Screenshot saved!', 'success');
        } catch (error) {
            console.error('Error taking screenshot:', error);
            showToast('Failed to take screenshot. Please try again.', 'error');
        }
    };

    const handleTitleDoubleClick = () => {
        setEditingTitle(true);
        setTitleValue(list.title);
    };

    const handleTitleBlur = () => {
        updateTitle(listIndex, titleValue);
        setEditingTitle(false);
    };

    const handleTitleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            updateTitle(listIndex, titleValue);
            setEditingTitle(false);
        } else if (e.key === 'Escape') {
            setTitleValue(list.title);
            setEditingTitle(false);
        }
    };

    const sortedItems = [...list.items].sort((a, b) => {
        if (a.completed === b.completed) return 0;
        return a.completed ? 1 : -1;
    });

    return (
        <div
            ref={listRef}
            className="border-2 border-stone-900 p-4 h-64 flex flex-col overflow-auto"
        >
            <div
                data-header-container
                className="relative flex justify-between mb-2"
            >
                {editingTitle ? (
                    <input
                        type="text"
                        value={titleValue}
                        onChange={(e) => setTitleValue(e.target.value)}
                        onBlur={handleTitleBlur}
                        onKeyDown={handleTitleKeyDown}
                        autoFocus
                        className="text-lg font-bold w-fit px-2 py-1"
                    />
                ) : (
                    <h2
                        onDoubleClick={handleTitleDoubleClick}
                        className="text-xl font-bold mb-2 cursor-pointer"
                    >
                        {list.title}
                    </h2>
                )}
                <div
                    data-buttons-container
                    className="flex gap-2"
                >
                    <button
                        onClick={() => addItem(listIndex)}
                        className="mb-2 bg-stone-900 text-white px-2 py-1"
                    >
                        +
                    </button>
                    <button
                        onClick={handleScreenshot}
                        className="mb-2 bg-stone-900 text-white px-2 py-1"
                        title="Save list as image"
                    >
                        ↓
                    </button>
                </div>
            </div>

            <div
                data-reorder-group
                className="overflow-y-scroll w-full flex-grow"
            >
                {list.items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <button
                            onClick={generateItems}
                            disabled={isGenerating}
                            className={`text-4xl transition-transform hover:scale-110 ${isGenerating ? 'animate-pulse cursor-wait' : 'hover:animate-bounce'
                                }`}
                            title="Generate items using AI"
                        >
                            🤖
                        </button>
                        <p className="mt-2 text-sm">
                            {isGenerating ? 'Thinking...' : 'Generate items'}
                        </p>
                    </div>
                ) : (
                    <Reorder.Group
                        axis="y"
                        values={sortedItems}
                        onReorder={(newOrder) => reorderItems(listIndex, newOrder)}
                        className="w-full"
                    >
                        {sortedItems.map((item) => (
                            <ListItem
                                key={item.id}
                                item={item}
                                onUpdate={(itemId, newValue) => updateItem(listIndex, itemId, newValue)}
                                onDelete={(itemId) => deleteItem(listIndex, itemId)}
                                onToggleComplete={(itemId) => toggleComplete(listIndex, itemId)}
                            />
                        ))}
                    </Reorder.Group>
                )}
            </div>
        </div>
    );
}
