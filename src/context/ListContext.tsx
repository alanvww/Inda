import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useToast } from './ToastContext';

// Define types
export interface Item {
  id: string;
  value: string;
  completed?: boolean;
}

export interface ListData {
  id: string;
  title: string;
  items: Item[];
}

interface ListContextType {
  lists: ListData[];
  addList: () => void;
  addItem: (listIndex: number) => void;
  updateItem: (listIndex: number, itemId: string, newValue: string) => void;
  updateTitle: (listIndex: number, newTitle: string) => void;
  reorderItems: (listIndex: number, newOrder: Item[]) => void;
  deleteItem: (listIndex: number, itemId: string) => void;
  toggleComplete: (listIndex: number, itemId: string) => void;
  clearAllData: () => void;
  replaceLists: (newLists: ListData[]) => void; // Add this method for replacing all lists
}

// Create the context
const ListContext = createContext<ListContextType | undefined>(undefined);

// Storage key
const STORAGE_KEY = 'inda-lists-data';

// Default lists
function getDefaultLists(): ListData[] {
  return [
    {
      id: 'list-1',
      title: '0.0 Inda 101',
      items: [
        { id: 'item-1', value: 'add item and save using the buttons', completed: false },
        { id: 'item-2', value: 'Hover to ☑️ check or ❌ delete the item', completed: false },
        { id: 'item-3', value: 'Double-click to edit list title and item text', completed: false },
        { id: 'item-5', value: 'completed item looks like this', completed: true },
      ],
    },
  ];
}

// Provider component
interface ListProviderProps {
  children: ReactNode;
}

export function ListProvider({ children }: ListProviderProps) {
  const { showToast } = useToast();

  // Initialize lists from localStorage
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

  // Save to localStorage whenever lists change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
    } catch (error) {
      console.error('Error saving lists to localStorage:', error);
      showToast('Failed to save lists to local storage.', 'error');
    }
  }, [lists, showToast]);

  // Add a new list
  const addList = () => {
    const newList: ListData = {
      id: Date.now().toString(),
      title: 'New List',
      items: [],
    };
    setLists([...lists, newList]);
    showToast('New list added', 'success');
  };

  // Add item to a list
  const addItem = (listIndex: number) => {
    const newItem: Item = {
      id: Date.now().toString(),
      value: '',
      completed: false,
    };
    const updatedLists = lists.map((list, index) =>
      index === listIndex ? { ...list, items: [...list.items, newItem] } : list
    );
    setLists(updatedLists);
  };

  // Update an item in a list
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
    setLists(updatedLists);
  };

  // Update list title
  const updateTitle = (listIndex: number, newTitle: string) => {
    const updatedLists = lists.map((list, index) =>
      index === listIndex ? { ...list, title: newTitle } : list
    );
    setLists(updatedLists);
  };

  // Reorder items in a list
  const reorderItems = (listIndex: number, newOrder: Item[]) => {
    const updatedLists = lists.map((list, index) =>
      index === listIndex ? { ...list, items: newOrder } : list
    );
    setLists(updatedLists);
  };

  // Delete an item from a list
  const deleteItem = (listIndex: number, itemId: string) => {
    const updatedLists = lists.map((list, index) => {
      if (index === listIndex) {
        return {
          ...list,
          items: list.items.filter((item) => item.id !== itemId),
        };
      }
      return list;
    });
    setLists(updatedLists);
  };

  // Toggle item completion status
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
    setLists(updatedLists);
  };

  // Clear all data and reset to default
  const clearAllData = () => {
    if (window.confirm('Are you sure you want to clear all lists? This cannot be undone.')) {
      localStorage.removeItem(STORAGE_KEY);
      setLists([]);
      showToast('All lists have been cleared.', 'info');
    }
  };
  
  // Replace all lists with a new set of lists
  const replaceLists = (newLists: ListData[]) => {
    try {
      setLists(newLists);
      showToast('Lists updated successfully', 'success');
    } catch (error) {
      console.error('Error replacing lists:', error);
      showToast('Failed to update lists. Please try again.', 'error');
    }
  };

  // Context value
  const value = {
    lists,
    addList,
    addItem,
    updateItem,
    updateTitle,
    reorderItems,
    deleteItem,
    toggleComplete,
    clearAllData,
    replaceLists, // Add the new method to the context value
  };

  return <ListContext.Provider value={value}>{children}</ListContext.Provider>;
}

// Custom hook to use the list context
export function useLists() {
  const context = useContext(ListContext);
  if (context === undefined) {
    throw new Error('useLists must be used within a ListProvider');
  }
  return context;
}
