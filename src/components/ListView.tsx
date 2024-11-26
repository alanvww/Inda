// ListView.tsx
import { useState } from 'react';
import List from './List';

interface Item {
    id: string;
    value: string;
}

interface ListData {
    id: string;
    title: string;
    items: Item[];
}

export default function ListView() {
    const [lists, setLists] = useState<ListData[]>([
        {
            id: 'list-1',
            title: 'My First List',
            items: [
                { id: 'item-1', value: 'Item 1' },
                { id: 'item-2', value: 'Item 2' },
            ],
        },
    ]);

    const addList = () => {
        const newList: ListData = {
            id: Date.now().toString(),
            title: 'New List',
            items: [],
        };
        setLists([...lists, newList]);
    };

    const addItem = (listIndex: number) => {
        const newItem: Item = {
            id: Date.now().toString(),
            value: '',
        };
        const updatedLists = lists.map((list, index) =>
            index === listIndex ? { ...list, items: [...list.items, newItem] } : list
        );
        setLists(updatedLists);
    };

    const updateItem = (listIndex: number, itemId: string, newValue: string) => {
        const updatedLists = lists.map((list, index) => {
            if (index === listIndex) {
                const updatedItems = list.items.map((item) =>
                    item.id === itemId ? { ...item, value: newValue } : item
                );
                return { ...list, items: updatedItems };
            } else {
                return list;
            }
        });
        setLists(updatedLists);
    };

    const updateTitle = (listIndex: number, newTitle: string) => {
        const updatedLists = lists.map((list, index) =>
            index === listIndex ? { ...list, title: newTitle } : list
        );
        setLists(updatedLists);
    };

    const reorderItems = (listIndex: number, newOrder: Item[]) => {
        const updatedLists = lists.map((list, index) =>
            index === listIndex ? { ...list, items: newOrder } : list
        );
        setLists(updatedLists);
    };

    return (
        <div className="mx-4 mb-4 px-4 py-4 border-2 border-stone-900 ">
            <button
                onClick={addList}
                className="mb-2 bg-stone-900 text-white px-4 py-2"
            >
                Add New List
            </button>
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
                    />
                ))}
            </div>

        </div>
    );
}