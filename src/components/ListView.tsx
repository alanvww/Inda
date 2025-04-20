import { useState, useEffect } from 'react';
import List from './List';
import { useGeminiAPI } from '../hooks/useGeminiAPI'; // Keep updated import
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
    const [isRegrouping, setIsRegrouping] = useState(false); // Tracks AI API call
    const [showRegroupPreview, setShowRegroupPreview] = useState(false); // Controls preview modal
    const [suggestedRegrouping, setSuggestedRegrouping] = useState<ListData[] | null>(null); // Holds AI suggestion

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
            console.error('Invalid AI response structure after normalization:', parsedResponse);
            throw new Error('AI response error: Expected a top-level "lists" array containing category objects, but received an invalid structure.');
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

    // Setup the AI API hook with the correct type using Gemini
    const regroupApi = useGeminiAPI<AIReorganizeResponse>({ // Updated hook usage
        prompt: preparePromptFromLists(),
        systemPrompt: "You are an expert organizer. Reorganize the provided lists based on their content and titles into logical groups. Return ONLY the JSON structure specified.", // Adjusted system prompt slightly for clarity
        responseFormat: 'json', // Expecting JSON output (matches hook/proxy)
        temperature: 0.5, // Lower temperature for more deterministic grouping (Restored from previous plan)
        maxTokens: 1000, // Keep maxTokens
    });

    const regroupListsWithAI = async () => {
        if (lists.length === 0) {
            showToast('Add some lists before regrouping.', 'info');
            return;
        }
        // Reset previous suggestions if any
        setSuggestedRegrouping(null);
        setShowRegroupPreview(false);
        setIsRegrouping(true); // Start loading indicator for API call

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

            // Store suggestion and show preview instead of direct replacement
            if (newLists.length > 0) {
                setSuggestedRegrouping(newLists);
                setShowRegroupPreview(true);
                // Stop the main loading indicator, preview has its own UI
                setIsRegrouping(false);
            } else {
                // Handle case where AI returns empty/invalid structure
                setIsRegrouping(false); // Stop loading
                throw new Error('AI did not return a valid regrouping structure.');
            }
            // Note: replaceLists is now called in handleConfirmRegroup

        } catch (error: unknown) {
            console.error('AI regrouping error:', error);
            if (error instanceof Error) {
                showToast(`Failed to regroup lists: ${error.message}`, 'error');
            } else {
                showToast('Failed to regroup lists: An unknown error occurred', 'error');
            }
            // Ensure loading stops on error
            setIsRegrouping(false);
            setSuggestedRegrouping(null);
            setShowRegroupPreview(false);
        }
        // No finally block needed for setIsRegrouping(false) anymore
    };

    // Handle confirming the AI's suggestion
    const handleConfirmRegroup = () => {
        if (suggestedRegrouping) {
            replaceLists(suggestedRegrouping); // Apply the changes
            showToast('Lists regrouped successfully!', 'success');
        } else {
            showToast('Error applying regrouping: No suggestion found.', 'error');
        }
        // Reset state
        setSuggestedRegrouping(null);
        setShowRegroupPreview(false);
    };

    // Handle cancelling the preview
    const handleCancelRegroup = () => {
        setSuggestedRegrouping(null);
        setShowRegroupPreview(false);
        showToast('Regrouping cancelled.', 'info');
    };

    return (
        <div className="mx-4 mb-4 px-4 flex-grow relative"> {/* Added relative positioning */}
            {/* Loading overlay ONLY for AI call */}
            {isRegrouping && (
                <div
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center" // Lower z-index than preview
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

            {/* Preview Modal */}
            {showRegroupPreview && suggestedRegrouping && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-lg w-full">
                        <h3 className="text-xl font-semibold mb-4 text-gray-800">Regrouping Preview</h3>
                        <p className="mb-4 text-gray-600">The AI suggests organizing your items into these categories:</p>
                        <ul className="list-disc list-inside mb-6 space-y-1 text-gray-700 max-h-60 overflow-y-auto">
                            {suggestedRegrouping.map((list) => (
                                <li key={list.id}>
                                    <strong>{list.title}</strong> ({list.items.length} items)
                                </li>
                            ))}
                        </ul>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={handleCancelRegroup}
                                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmRegroup}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            >
                                Confirm Regrouping
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Controls */}
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
                        // Disable button if AI call is in progress OR preview is shown OR no lists exist
                        disabled={isRegrouping || showRegroupPreview || lists.length === 0}
                        className={`bg-blue-600 text-white px-4 py-2 ${(isRegrouping || showRegroupPreview || lists.length === 0) ? 'opacity-50 cursor-not-allowed' : ''}`} // Fixed closing backtick placement
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
