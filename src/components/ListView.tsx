import { useState, useEffect } from 'react';
import List from './List';

interface Item {
    id: string;
    value: string;
    completed?: boolean;
}

interface ListData {
    id: string;
    title: string;
    items: Item[];
}

const STORAGE_KEY = 'inda-lists-data';
const PROXY_URL = import.meta.env.VITE_REPLICATE_PROXY;


function LoadingIndicator() {
    const [frame, setFrame] = useState(0);

    // Using useEffect to create the animation cycle
    useEffect(() => {
        const frames = ['0.0', '>.0', '0.<'];
        const intervalId = setInterval(() => {
            setFrame(current => (current + 1) % frames.length);
        }, 300); // Adjust timing as needed

        // Cleanup on unmount
        return () => clearInterval(intervalId);
    }, []);

    const frames = ['0.0', '>.0', '0.<'];
    return (
        <div className="font-bold text-5xl">{frames[frame]}</div>
    );
}


export default function ListView() {
    const [lists, setLists] = useState<ListData[]>(() => {
        const savedLists = localStorage.getItem(STORAGE_KEY);
        if (savedLists) {
            try {
                return JSON.parse(savedLists);
            } catch (error) {
                console.error('Error parsing saved lists:', error);
                return getDefaultLists();
            }
        }
        return getDefaultLists();
    });
    const [isRegrouping, setIsRegrouping] = useState(false);

    // Function to provide default lists when no saved data exists
    function getDefaultLists(): ListData[] {
        return [{
            id: 'list-1',
            title: '0.0 Inda 101',
            items: [
                { id: 'item-1', value: 'add item and save using the buttons', completed: false },
                { id: 'item-2', value: 'Hover to ☑️ check or ❌ delete the item', completed: false },
                { id: 'item-3', value: 'Double-click to edit list title and item text', completed: false },
                { id: 'item-5', value: 'completed item looks like this', completed: true },

            ],
        }];
    }

    // Save to localStorage whenever lists change
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
        } catch (error) {
            console.error('Error saving lists to localStorage:', error);
        }
    }, [lists]);

    // Wrap state updates in a helper function to handle errors
    const updateListsWithStorage = (newLists: ListData[]) => {
        try {
            setLists(newLists);
        } catch (error) {
            console.error('Error updating lists:', error);
            // Optionally show user feedback
            alert('Failed to update lists. Please try again.');
        }
    };

    const addList = () => {
        const newList: ListData = {
            id: Date.now().toString(),
            title: 'New List',
            items: [],
        };
        updateListsWithStorage([...lists, newList]);
    };

    const addItem = (listIndex: number) => {
        const newItem: Item = {
            id: Date.now().toString(),
            value: '',
            completed: false,
        };
        const updatedLists = lists.map((list, index) =>
            index === listIndex ? { ...list, items: [...list.items, newItem] } : list
        );
        updateListsWithStorage(updatedLists);
    };

    const updateItem = (listIndex: number, itemId: string, newValue: string) => {
        const updatedLists = lists.map((list, index) => {
            if (index === listIndex) {
                const updatedItems = list.items.map((item) =>
                    item.id === itemId ? { ...item, value: newValue } : item
                );
                return { ...list, items: updatedItems };
            }
            return list;
        });
        updateListsWithStorage(updatedLists);
    };

    const updateTitle = (listIndex: number, newTitle: string) => {
        const updatedLists = lists.map((list, index) =>
            index === listIndex ? { ...list, title: newTitle } : list
        );
        updateListsWithStorage(updatedLists);
    };

    const reorderItems = (listIndex: number, newOrder: Item[]) => {
        const updatedLists = lists.map((list, index) =>
            index === listIndex ? { ...list, items: newOrder } : list
        );
        updateListsWithStorage(updatedLists);
    };

    const deleteItem = (listIndex: number, itemId: string) => {
        const updatedLists = lists.map((list, index) => {
            if (index === listIndex) {
                return {
                    ...list,
                    items: list.items.filter(item => item.id !== itemId)
                };
            }
            return list;
        });
        updateListsWithStorage(updatedLists);
    };

    const toggleComplete = (listIndex: number, itemId: string) => {
        const updatedLists = lists.map((list, index) => {
            if (index === listIndex) {
                const updatedItems = list.items.map((item) =>
                    item.id === itemId ? { ...item, completed: !item.completed } : item
                );
                return { ...list, items: updatedItems };
            }
            return list;
        });
        updateListsWithStorage(updatedLists);
    };

    // Added function to clear all data (useful for testing)
    const clearAllData = () => {
        if (window.confirm('Are you sure you want to clear all lists? This cannot be undone.')) {
            localStorage.removeItem(STORAGE_KEY);
            updateListsWithStorage(getDefaultLists());
        }
    };

    const preparePromptFromLists = () => {
        // Create a representation that includes list IDs for reference
        const listsText = lists.map(list => {
            const itemsText = list.items
                .map(item => `{"id": "${item.id}", "value": "${item.value.trim()}", "completed": ${item.completed}}`)
                .filter(Boolean)
                .join(", ");
            return `{"listId": "${list.id}", "items": [${itemsText}]}`;
        }).join("\n");

        // Modified prompt to request regrouping with existing items
        return `Analyze these lists and their items for reorganization:
${listsText}

Rules:
1. Group items based on themes and semantic similarity
2. Preserve item IDs and completion status
3. Create clear, descriptive category names for each group
4. Return a JSON object showing how to reorganize the items into categories
5. Every item must be included exactly once

Return ONLY a JSON object in this exact format:
{
    "lists": [
        {
            "title": "Category Name",
            "items": [
                {"id": "original-item-id", "value": "item text", "completed": boolean}
            ]
        }
    ]
}`;
    };

    interface ReorganizedItem {
        id: string;
        value: string;
        completed: boolean;
    }

    interface ReorganizedList {
        title: string;
        items: ReorganizedItem[];
    }

    interface AIReorganizeResponse {
        lists: ReorganizedList[];
    }

    const parseAIResponse = (rawResponse: { output: unknown[]; }): ListData[] => {
        const responseText = rawResponse.output.join('').trim();
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            throw new Error('No valid JSON found in response');
        }

        try {
            const parsedResponse: AIReorganizeResponse = JSON.parse(jsonMatch[0]);

            if (!parsedResponse.lists || !Array.isArray(parsedResponse.lists)) {
                throw new Error('Invalid response structure');
            }

            // Create a map of existing items for reference
            const existingItemsMap = new Map<string, Item>();
            lists.forEach(list => {
                list.items.forEach(item => {
                    existingItemsMap.set(item.id, item);
                });
            });

            // Transform AI response into new lists while preserving existing items
            return parsedResponse.lists.map(category => ({
                id: `list-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                title: category.title.trim(),
                items: category.items
                    .map(item => {
                        // Try to find existing item
                        const existingItem = existingItemsMap.get(item.id);
                        if (existingItem) {
                            return {
                                ...existingItem,
                                value: item.value.trim() // Use AI's suggested value in case it was cleaned up
                            };
                        }
                        // If item wasn't found (shouldn't happen), create new one
                        return {
                            id: item.id,
                            value: item.value.trim(),
                            completed: item.completed
                        };
                    })
                    .filter(item => item.value) // Remove any empty items
            }));
        } catch (error) {
            console.error('Error parsing AI response:', error);
            throw new Error('Failed to parse AI response');
        }
    };

    const regroupListsWithAI = async () => {
        if (lists.length === 0) return;
        setIsRegrouping(true);

        try {
            // Validate that we have items to regroup
            const totalItems = lists.reduce((sum, list) => sum + list.items.length, 0);
            if (totalItems === 0) {
                throw new Error('No items to regroup. Please add some items first.');
            }

            const data = {
                modelURL: "https://api.replicate.com/v1/models/meta/meta-llama-3-70b-instruct/predictions",
                input: {
                    prompt: preparePromptFromLists(),
                    max_tokens: 1000,
                    temperature: 0.7,
                    top_p: 0.9,
                },
            };

            const response = await fetch(PROXY_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const result = await response.json();

            if (result.error) {
                throw new Error(result.error);
            }

            const newLists = parseAIResponse(result);

            console.log('New lists:', newLists);

            // Validate that we haven't lost any items
            const newTotalItems = newLists.reduce((sum, list) => sum + list.items.length, 0);
            if (newTotalItems !== totalItems) {
                throw new Error('Some items were lost during regrouping. Operation cancelled.');
            }

            if (newLists.length > 0) {
                updateListsWithStorage(newLists);
            } else {
                throw new Error('No valid lists returned from AI');
            }

        } catch (error: unknown) {
            console.error('AI regrouping error:', error);
            if (error instanceof Error) {
                alert(`Failed to regroup lists: ${error.message}`);
            } else {
                alert('Failed to regroup lists: An unknown error occurred');
            }
        } finally {
            setIsRegrouping(false);
        }
    };

    return (
        <div className="mx-4 mb-4 px-4 flex-grow">
            {isRegrouping && (
                <div
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
                    onMouseDown={(e) => e.preventDefault()}
                >
                    <div className="bg-white p-6 shadow-lg text-center">
                        <div className="mb-4">
                            <LoadingIndicator />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">LLM is regrouping the lists and their items</h3>
                        <p className="text-gray-600">Please wait while items are being organized...</p>
                    </div>
                </div>
            )}
            <div className="flex justify-between items-center mb-4">
                <div className="flex gap-4">
                    <button
                        onClick={addList}
                        className="bg-stone-900 text-white px-4 py-2"
                    >
                        Add New List
                    </button>
                    <button
                        onClick={regroupListsWithAI}
                        disabled={isRegrouping || lists.length === 0}
                        className={`bg-blue-600 text-white px-4 py-2 ${(isRegrouping || lists.length === 0) ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                    >
                        {isRegrouping ? 'Regrouping...' : '🤖 Regroup'}
                    </button>
                </div>
                <button
                    onClick={clearAllData}
                    className="bg-red-600 text-white px-4 py-2"
                    title="Clear all lists and reset to default"
                >
                    Reset All
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {lists.map((list, listIndex) => (
                    <List
                        key={list.id}
                        listIndex={listIndex}
                        list={list}
                        addItem={addItem}
                        updateItem={updateItem}
                        updateTitle={updateTitle}
                        reorderItems={reorderItems}
                        deleteItem={deleteItem}
                        toggleComplete={toggleComplete}
                    />
                ))}
            </div>
        </div>
    );
}