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

// Storage key for our lists in localStorage
const STORAGE_KEY = 'inda-lists-data';

export default function ListView() {
    // Modified useState to accept a function that initializes from localStorage
    const [lists, setLists] = useState<ListData[]>(() => {
        // Try to get existing lists from localStorage during initialization
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

    // Function to provide default lists when no saved data exists
    function getDefaultLists(): ListData[] {
        return [{
            id: 'list-1',
            title: 'My First List',
            items: [
                { id: 'item-1', value: 'Item 1', completed: false },
                { id: 'item-2', value: 'Item 2', completed: false },
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

    return (
        <div className="mx-4 mb-4 px-4 flex-grow">
            <div className="flex justify-between items-center mb-4">
                <button
                    onClick={addList}
                    className="bg-stone-900 text-white px-4 py-2"
                >
                    Add New List
                </button>
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