import { useState, KeyboardEvent, useRef } from 'react';
import { Reorder } from 'motion/react';
import html2canvas from 'html2canvas';
import ListItem from './ListItem';

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
    const listRef = useRef<HTMLDivElement>(null);

    const handleScreenshot = async () => {
        if (!listRef.current) return;

        try {
            const canvas = await html2canvas(listRef.current, {
                scale: 2,
                backgroundColor: '#ffffff',
                scrollY: -window.scrollY,
                useCORS: true,
                onclone: (_document, element) => {
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
                },
                removeContainer: true,
                logging: false,
            });

            canvas.toBlob((blob) => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                const filename = `${list.title.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.png`;

                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();

                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 'image/png');
        } catch (error) {
            console.error('Error taking screenshot:', error);
            alert('Failed to take screenshot. Please try again.');
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
            </div>
        </div>
    );
}