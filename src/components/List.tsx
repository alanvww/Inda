// List.tsx
import { useState } from 'react';
import { Reorder } from 'motion/react';

interface Item {
    id: string;
    value: string;
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
}

export default function List({
    listIndex,
    list,
    addItem,
    updateItem,
    updateTitle,
    reorderItems,
}: ListProps) {
    const [editingTitle, setEditingTitle] = useState(false);
    const [editingItems, setEditingItems] = useState<{ [key: string]: boolean }>({});

    const handleTitleDoubleClick = () => {
        setEditingTitle(true);
    };

    const handleTitleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        updateTitle(listIndex, e.target.value);
        setEditingTitle(false);
    };

    const handleItemDoubleClick = (itemId: string) => {
        setEditingItems({ ...editingItems, [itemId]: true });
    };

    const handleItemBlur = (itemId: string, e: React.FocusEvent<HTMLInputElement>) => {
        updateItem(listIndex, itemId, e.target.value);
        setEditingItems({ ...editingItems, [itemId]: false });
    };

    return (
        <div className="border-2 border-stone-900 p-4 h-64 flex flex-col overflow-auto">
            <div className="relative flex justify-between mb-2">
                {/* Editable Title */}
                {editingTitle ? (
                    <input
                        type="text"
                        value={list.title}
                        onChange={(e) => updateTitle(listIndex, e.target.value)}
                        onBlur={handleTitleBlur}
                        autoFocus
                        className="text-xl font-bold mb-2 w-full"
                    />
                ) : (
                    <h2
                        onDoubleClick={handleTitleDoubleClick}
                        className="text-xl font-bold mb-2 cursor-pointer"
                    >
                        {list.title}
                    </h2>
                )}

                <button
                    onClick={() => addItem(listIndex)}
                    className="mb-2 bg-stone-900 text-white px-2 py-1"
                >
                    Add Item
                </button></div>


            {/* Reorderable List */}
            <Reorder.Group
                axis="y"
                values={list.items}
                onReorder={(newOrder) => reorderItems(listIndex, newOrder)}
                
                className='overflow-y-scroll w-full flex-grow'
            >
                {list.items.map((item) => (
                    <Reorder.Item key={item.id} value={item} className="p-2 bg-gray-100 my-1">
                        {editingItems[item.id] ? (
                            <input
                                type="text"
                                value={item.value}
                                onChange={(e) => updateItem(listIndex, item.id, e.target.value)}
                                onBlur={(e) => handleItemBlur(item.id, e)}
                                autoFocus
                                className="w-full"
                            />
                        ) : (
                            <div
                                onDoubleClick={() => handleItemDoubleClick(item.id)}
                                className="cursor-pointer"
                            >
                                {item.value || <span className="text-gray-400 italic">Empty Item</span>}
                            </div>
                        )}
                    </Reorder.Item>
                ))}
            </Reorder.Group>
        </div>
    );
}