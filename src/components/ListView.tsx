import { useState, useEffect } from 'react';
import List from './List';
import { useOpenRouterAPI } from '../hooks/useOpenRouterAPI';
import { useToast } from '../context/ToastContext';
import { useLists, Item, ListData } from '../context/ListContext';

/**
 * Loading indicator component
 */
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

/**
 * Main component for displaying and managing lists
 */
export default function ListView() {
    // Use the context for list management
    const { 
        lists, 
        addList, 
        addItem,
        updateItem, 
        updateTitle,
        reorderItems,
        deleteItem,
        toggleComplete,
        clearAllData,
        replaceLists
    } = useLists();
    
    // Local state for regrouping operation
    const [isRegrouping, setIsRegrouping] = useState(false);
    
    // Access toast context for notifications
    const { showToast } = useToast();

    const preparePromptFromLists = () => {
        // Create a representation that includes list IDs for reference
        const listsText = lists.map(list => {
            const itemsText = list.items
                .map(item => {
                    // Escape any special characters in item values to prevent JSON errors
                    const escapedValue = item.value.trim().replace(/"/g, '\\"');
                    return `{"id": "${item.id}", "value": "${escapedValue}", "completed": ${item.completed}}`;
                })
                .filter(Boolean)
                .join(", ");
            return `{"listId": "${list.id}", "items": [${itemsText}]}`;
        }).join("\n");

        // Modified prompt with clearer instructions and examples
        return `Analyze these lists and their items for reorganization:
${listsText}

IMPORTANT: You must return ONLY a valid JSON object with no additional text, comments, or explanations.

Rules:
1. Group items based on themes and semantic similarity
2. Preserve item IDs and completion status exactly as provided
3. Create clear, descriptive category names for each group
4. Return a JSON object showing how to reorganize the items into categories
5. Every item must be included exactly once
6. Ensure the JSON is properly formatted with no syntax errors

The response MUST be a valid JSON object in exactly this format:
{
    "lists": [
        {
            "title": "Category Name",
            "items": [
                {"id": "original-item-id", "value": "item text", "completed": boolean}
            ]
        }
    ]
}

Do not include any text before or after the JSON object. The response should begin with '{' and end with '}'.`;
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

    // Using Record for flexibility with different API response structures
    interface AIReorganizeResponse {
        lists?: ReorganizedList[];
        // For single list response format:
        title?: string;
        items?: ReorganizedItem[];
    }

    /**
     * Converts the AI's response to ListData[] format, performing necessary validations and transformations
     */
    const parseAIResponse = (parsedResponse: AIReorganizeResponse): ListData[] => {
        console.log('Received AI response:', parsedResponse);
        
        // Normalize the response structure if needed
        if (!parsedResponse.lists && parsedResponse.title && Array.isArray(parsedResponse.items)) {
            console.log('Received single list instead of lists array, normalizing structure...');
            // We got a single list instead of an array wrapped in "lists"
            parsedResponse = {
                lists: [{
                    title: parsedResponse.title,
                    items: parsedResponse.items
                }]
            };
        } else if (!parsedResponse.lists || !Array.isArray(parsedResponse.lists)) {
            console.error('Invalid response structure:', parsedResponse);
            throw new Error('Invalid response structure: missing lists array');
        }

        // Create a map of existing items for reference (to maintain completion status, etc.)
        const existingItemsMap = new Map<string, Item>();
        lists.forEach(list => {
            list.items.forEach(item => {
                existingItemsMap.set(item.id, item);
            });
        });

        // Process each list in the response
        return (parsedResponse.lists || []).map(category => ({
            id: `list-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: category.title?.trim() || "Unnamed Category",
            items: category.items
                .map(item => {
                    // Ensure required fields exist
                    if (!item.id || !item.value) {
                        console.warn('Item missing required fields:', item);
                        return null;
                    }
                    
                    // Try to find existing item to maintain state
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
                        completed: !!item.completed
                    };
                })
                .filter((item): item is Item => item !== null) // Type-safe filter for non-null items
                .filter(item => item.value.trim() !== '') // Remove any empty items
        }));
    };

    // Setup the AI API hook with the correct type
    const regroupApi = useOpenRouterAPI<AIReorganizeResponse>({
        prompt: preparePromptFromLists(),
        systemPrompt: "You are an assistant that reorganizes lists and always responds in valid JSON format matching the user's requested structure.",
        responseFormat: 'json_object',
        maxTokens: 1000,
        temperature: 0.7
    });

    const regroupListsWithAI = async () => {
        if (lists.length === 0) return;
        setIsRegrouping(true);

        try {
            // Validate that we have items to regroup
            const totalItems = lists.reduce((sum, list) => sum + list.items.length, 0);
            if (totalItems === 0) {
                throw new Error('No items to regroup. Please add some items first.');
            }

            // Execute the API call using our custom hook
            // Execute the API call
            const result = await regroupApi.execute();
            
            if (!result) {
                throw new Error('Failed to get response from AI service');
            }

            // The response is already parsed as AIReorganizeResponse from our improved hook
            const newLists = parseAIResponse(result);

            console.log('New lists:', newLists);

            // Validate that we haven't lost any items
            const newTotalItems = newLists.reduce((sum, list) => sum + list.items.length, 0);
            if (newTotalItems !== totalItems) {
                throw new Error('Some items were lost during regrouping. Operation cancelled.');
            }

            // Replace lists with the new lists from the AI
            if (newLists.length > 0) {
                // Use the context function to replace all lists at once
                replaceLists(newLists);
                showToast('Lists regrouped successfully!', 'success');
            } else {
                throw new Error('No valid lists returned from AI');
            }

        } catch (error: unknown) {
            console.error('AI regrouping error:', error);
            if (error instanceof Error) {
                showToast(`Failed to regroup lists: ${error.message}`, 'error');
            } else {
                showToast('Failed to regroup lists: An unknown error occurred', 'error');
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
                    Clear All
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
